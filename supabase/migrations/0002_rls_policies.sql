-- SPDX-License-Identifier: Apache-2.0
--
-- Row-Level Security.
--
-- Model: a holder authenticates (Supabase auth) and their auth user is bound to
-- exactly one row in `holders` via holders.auth_user_id. Issuers are bound the
-- same way via issuers.auth_user_id. Every policy below derives from auth.uid().
--
-- Default posture is deny: RLS is enabled on all four tables and no policy
-- grants blanket access.

alter table issuers        enable row level security;
alter table holders        enable row level security;
alter table credentials    enable row level security;
alter table proof_requests enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- The calling user's holder id, or null if they are not a holder.
create or replace function current_holder_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from holders where auth_user_id = auth.uid();
$$;

-- The calling user's issuer id, or null if they are not an issuer.
create or replace function current_issuer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from issuers where auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- issuers: public directory (name + public key only), self-service writes.
-- ---------------------------------------------------------------------------

-- Issuer identity is public information, like a CA certificate. Verifiers need
-- to see it. No PHI is present in this table.
create policy issuers_read_all
  on issuers for select
  using (true);

create policy issuers_update_self
  on issuers for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- holders: a holder sees only their own row.
-- ---------------------------------------------------------------------------

create policy holders_read_own
  on holders for select
  using (auth_user_id = auth.uid());

create policy holders_update_own
  on holders for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- credentials
--   read  : the holder who owns it, or the issuer who issued it
--   insert: issuers only, and only rows attributed to themselves
--   update: issuers only, and only to flip the revocation flag
-- ---------------------------------------------------------------------------

create policy credentials_read_own
  on credentials for select
  using (holder_id = current_holder_id());

create policy credentials_read_as_issuer
  on credentials for select
  using (issuer_id = current_issuer_id());

-- An issuer can only write credentials attributed to itself: the WITH CHECK
-- forces issuer_id to be the caller's own issuer id, so one issuer cannot
-- forge a credential in another issuer's name.
create policy credentials_insert_as_issuer
  on credentials for insert
  with check (issuer_id = current_issuer_id());

create policy credentials_revoke_as_issuer
  on credentials for update
  using (issuer_id = current_issuer_id())
  with check (issuer_id = current_issuer_id());

-- Nobody deletes credentials: revocation is an append-only on-chain fact and
-- the off-chain row must remain as an audit trail.

-- ---------------------------------------------------------------------------
-- proof_requests
--   read  : only the holder of the underlying credential
--   insert: only the holder of the underlying credential
-- ---------------------------------------------------------------------------

create policy proof_requests_read_own
  on proof_requests for select
  using (
    exists (
      select 1 from credentials c
      where c.id = proof_requests.credential_id
        and c.holder_id = current_holder_id()
    )
  );

create policy proof_requests_insert_own
  on proof_requests for insert
  with check (
    exists (
      select 1 from credentials c
      where c.id = proof_requests.credential_id
        and c.holder_id = current_holder_id()
    )
  );

-- Proof records are immutable once written.

-- ---------------------------------------------------------------------------
-- Verifier lookup
--
-- A verifier is an unauthenticated third party holding only a proof_reference.
-- Rather than opening proof_requests to anon (which would expose the whole
-- table), this SECURITY DEFINER function returns the minimum a verifier needs
-- and nothing else: no credential id, no nullifier, no holder, no issuer.
-- ---------------------------------------------------------------------------

create or replace function verify_proof(reference text)
returns table (
  claim_type    claim_type,
  result        boolean,
  verifier_name text,
  generated_at  timestamptz,
  revoked       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.claim_type,
    pr.result,
    pr.verifier_name,
    pr.generated_at,
    c.revoked
  from proof_requests pr
  join credentials c on c.id = pr.credential_id
  where pr.proof_reference = reference;
$$;

revoke all on function verify_proof(text) from public;
grant execute on function verify_proof(text) to anon, authenticated;

comment on function verify_proof(text) is
  'Verifier-facing lookup. Returns claim type and pass/fail only; never the underlying value.';
