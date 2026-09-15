-- SPDX-License-Identifier: Apache-2.0
--
-- 0004 — integrate the schema with the app.
--
-- 0001–0003 described the intended model but left no way to reach it: the app
-- never authenticated, holders had no INSERT path, an unclaimed issuer could
-- never be claimed, and the issuer UPDATE policy let a bound issuer rewrite any
-- column. This migration adds the missing onboarding and write paths as
-- narrowly-scoped SECURITY DEFINER functions and removes the over-broad
-- policies they replace.
--
-- Identity model:
--   holders  — anonymous Supabase sign-in, bound to a wallet via ensure_holder().
--              Binding a wallet does NOT prove the caller controls it; this is
--              an accepted limitation for a demo with synthetic data.
--   issuers  — permanent (non-anonymous) users only, bound by an administrator:
--              update issuers set auth_user_id = (select id from auth.users
--                where email = '<email>') where is_demo;
--              One operator may run several issuers.
--
-- The privacy invariant from 0001 is unchanged: nothing here stores a claim
-- value. issue_credential() accepts only opaque hashes and a display label.

-- ---------------------------------------------------------------------------
-- Issuers: allow one operator to run several issuers.
-- ---------------------------------------------------------------------------

alter table issuers drop constraint if exists issuers_auth_user_id_key;
create index if not exists issuers_auth_user_idx on issuers (auth_user_id);

-- A bound issuer could previously rewrite its own public_key or is_demo flag.
-- Nothing needs to update issuers from the client; binding is administrative.
drop policy if exists issuers_update_self on issuers;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True for a signed-in, non-anonymous user. Issuer powers require this, so an
-- anonymous holder session can never act as an issuer even if mis-bound.
create or replace function is_permanent_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- True when the caller is a permanent user bound to this issuer.
create or replace function is_issuer_for(p_issuer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_permanent_user()
     and exists (
       select 1 from issuers
       where id = p_issuer_id
         and auth_user_id = auth.uid()
     );
$$;

-- Both are evaluated inside RLS policies for whichever role runs the query, so
-- every API role needs EXECUTE; they only return a boolean about the caller.
revoke all on function is_permanent_user() from public;
revoke all on function is_issuer_for(uuid) from public;
grant execute on function is_permanent_user() to anon, authenticated;
grant execute on function is_issuer_for(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Credentials: replace issuer policies built on the single-issuer helper.
-- ---------------------------------------------------------------------------

drop policy if exists credentials_read_as_issuer on credentials;
create policy credentials_read_as_issuer
  on credentials for select
  using (is_issuer_for(issuer_id));

-- Writes now go exclusively through issue_credential() / revoke_credential().
-- The old UPDATE policy let an issuer change holder_id, commitment, or anything
-- else on a row it had issued.
drop policy if exists credentials_insert_as_issuer on credentials;
drop policy if exists credentials_revoke_as_issuer on credentials;

-- current_issuer_id() assumed one issuer per user and is no longer referenced.
drop function if exists current_issuer_id();

-- ---------------------------------------------------------------------------
-- Holders: the only way to create or bind a holder row.
-- ---------------------------------------------------------------------------

-- A holder could previously rewrite their own wallet_address — including to an
-- unbound address an issuer had already issued credentials to, taking them
-- over. Binding is now only possible through ensure_holder().
drop policy if exists holders_update_own on holders;

create or replace function ensure_holder(p_wallet_address text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_address text := btrim(p_wallet_address);
  v_id      uuid;
  v_owner   uuid;
  v_bound   text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_address is null or length(v_address) < 8 or length(v_address) > 200 then
    raise exception 'invalid wallet address' using errcode = '22023';
  end if;

  -- This session is already a holder.
  select id, wallet_address into v_id, v_bound
  from holders where auth_user_id = v_uid;
  if v_id is not null then
    if v_bound <> v_address then
      raise exception 'session already bound to a different wallet'
        using errcode = '42501';
    end if;
    return v_id;
  end if;

  select id, auth_user_id into v_id, v_owner
  from holders where wallet_address = v_address
  for update;

  if v_id is null then
    insert into holders (wallet_address, auth_user_id)
    values (v_address, v_uid)
    returning id into v_id;
  elsif v_owner is null then
    -- Created earlier by an issuer issuing to this address.
    update holders set auth_user_id = v_uid where id = v_id;
  elsif v_owner <> v_uid then
    raise exception 'wallet already bound to another session'
      using errcode = '42501';
  end if;

  return v_id;
end;
$$;

revoke all on function ensure_holder(text) from public, anon;
grant execute on function ensure_holder(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Issuance and revocation
-- ---------------------------------------------------------------------------

create or replace function issue_credential(
  p_issuer_id      uuid,
  p_wallet_address text,
  p_claim_type     claim_type,
  p_nullifier_hash text,
  p_commitment     text,
  p_display_label  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_address text := btrim(p_wallet_address);
  v_label   text := btrim(p_display_label);
  v_holder  uuid;
  v_id      uuid;
begin
  if not is_issuer_for(p_issuer_id) then
    raise exception 'not permitted to issue as this issuer' using errcode = '42501';
  end if;
  if v_address is null or length(v_address) < 8 or length(v_address) > 200 then
    raise exception 'invalid wallet address' using errcode = '22023';
  end if;
  if v_label is null or length(v_label) = 0 or length(v_label) > 120 then
    raise exception 'invalid display label' using errcode = '22023';
  end if;

  -- The holder may not have connected yet; they bind this row on first
  -- ensure_holder() with the same address.
  insert into holders (wallet_address) values (v_address)
  on conflict (wallet_address) do nothing;
  select id into v_holder from holders where wallet_address = v_address;

  -- Hex format is enforced by the column CHECK constraints from 0001.
  insert into credentials
    (holder_id, issuer_id, claim_type, nullifier_hash, commitment, display_label)
  values
    (v_holder, p_issuer_id, p_claim_type,
     lower(p_nullifier_hash), lower(p_commitment), v_label)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function issue_credential(uuid, text, claim_type, text, text, text)
  from public, anon;
grant execute on function issue_credential(uuid, text, claim_type, text, text, text)
  to authenticated;

create or replace function revoke_credential(p_credential_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issuer uuid;
begin
  select issuer_id into v_issuer from credentials where id = p_credential_id;
  if v_issuer is null or not is_issuer_for(v_issuer) then
    raise exception 'not permitted to revoke this credential' using errcode = '42501';
  end if;

  -- Idempotent: revoking twice keeps the original revocation time.
  update credentials
     set revoked = true,
         revoked_at = coalesce(revoked_at, now())
   where id = p_credential_id;
end;
$$;

revoke all on function revoke_credential(uuid) from public, anon;
grant execute on function revoke_credential(uuid) to authenticated;
