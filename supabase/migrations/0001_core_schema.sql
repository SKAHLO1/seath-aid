-- SPDX-License-Identifier: Apache-2.0
--
-- VeriHealth off-chain metadata schema.
--
-- PRIVACY INVARIANT (enforced by review, documented here for auditors):
--   No table in this schema may ever hold a raw claim value, a medical record,
--   or any PHI. Specifically there is deliberately NO column for: vaccine code,
--   dose count, lab value, lab units, policy number, policy expiry, diagnosis,
--   or any free-text clinical note.
--
--   What IS stored: opaque hashes (commitments, revocation handles, proof
--   nullifiers), issuer/holder identity records, and pass/fail booleans.
--   Every hash here is also public on the Midnight ledger, so this database
--   holds nothing the chain does not already expose.
--
--   Raw claim data lives ONLY in the holder's local browser store and is used
--   solely as a private witness during proof generation.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Claim types. Additive by design: new claim types extend this enum without
-- requiring changes to credentials or proof_requests.
-- ---------------------------------------------------------------------------
create type claim_type as enum (
  'vaccination',
  'lab_threshold',
  'coverage'
);

-- ---------------------------------------------------------------------------
-- Issuers — simulated clinics, labs, and insurers.
-- ---------------------------------------------------------------------------
create table issuers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- Hex-encoded 32-byte issuer public key, matching deriveIssuerPk() in the
  -- Compact contract. Public by design.
  public_key    text not null unique check (public_key ~ '^[0-9a-f]{64}$'),
  -- True for every issuer in this buildathon submission. There are no real
  -- healthcare-provider integrations.
  is_demo       boolean not null default true,
  -- Supabase auth user permitted to act as this issuer. Null until claimed.
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table issuers is
  'Credential issuers. All rows are simulated demo issuers; no PHI.';

-- ---------------------------------------------------------------------------
-- Holders — patients, identified by Midnight wallet address.
-- ---------------------------------------------------------------------------
create table holders (
  id              uuid primary key default gen_random_uuid(),
  wallet_address  text not null unique,
  -- Supabase auth user bound to this wallet. Set when the holder first
  -- connects Lace and authenticates; drives every RLS policy below.
  auth_user_id    uuid unique references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table holders is
  'Patients, keyed by wallet address. Contains no name, DOB, or PHI.';

-- ---------------------------------------------------------------------------
-- Credentials — metadata about an attestation. NOT the attestation itself.
-- ---------------------------------------------------------------------------
create table credentials (
  id              uuid primary key default gen_random_uuid(),
  holder_id       uuid not null references holders (id) on delete cascade,
  issuer_id       uuid not null references issuers (id) on delete restrict,
  claim_type      claim_type not null,

  -- Hex-encoded revocation handle: persistentHash("vh:handle:v1", issuerPk,
  -- nonce) from the contract. Opaque; reveals nothing about the claim.
  -- Named nullifier_hash to match the PRD's terminology.
  nullifier_hash  text not null unique check (nullifier_hash ~ '^[0-9a-f]{64}$'),

  -- Hex-encoded Merkle leaf published on chain at issuance. Lets the frontend
  -- locate the credential's authentication path. Blinded by the private nonce,
  -- so it is safe to store and safe to publish.
  commitment      text not null check (commitment ~ '^[0-9a-f]{64}$'),

  -- Human-readable label for the dashboard, e.g. "MMR immunisation" or
  -- "LDL cholesterol". Describes WHICH claim exists, never its value.
  display_label   text not null,

  issued_at       timestamptz not null default now(),
  revoked         boolean not null default false,
  revoked_at      timestamptz,

  constraint revoked_at_consistent
    check ((revoked = false and revoked_at is null)
        or (revoked = true  and revoked_at is not null))
);

comment on column credentials.nullifier_hash is
  'Opaque revocation handle. Never a claim value.';
comment on column credentials.display_label is
  'UI label describing which claim exists. MUST NOT encode the claim value.';

create index credentials_holder_idx on credentials (holder_id);
create index credentials_issuer_idx on credentials (issuer_id);

-- ---------------------------------------------------------------------------
-- Proof requests — an audit log of proofs the holder generated.
-- ---------------------------------------------------------------------------
create table proof_requests (
  id               uuid primary key default gen_random_uuid(),
  credential_id    uuid not null references credentials (id) on delete cascade,

  -- Short shareable token the holder hands to a verifier. Random, not derived
  -- from any claim data.
  proof_reference  text not null unique default encode(gen_random_bytes(16), 'hex'),

  -- Hex-encoded on-chain nullifier for this (credential, verifier) pair.
  nullifier        text not null check (nullifier ~ '^[0-9a-f]{64}$'),

  verifier_name    text not null,
  claim_type       claim_type not null,

  -- The ONLY outcome data stored: pass or fail.
  result           boolean not null,

  generated_at     timestamptz not null default now()
);

comment on table proof_requests is
  'Audit log of generated proofs. Stores pass/fail only, never the underlying value.';

create index proof_requests_credential_idx on proof_requests (credential_id);
create index proof_requests_reference_idx on proof_requests (proof_reference);
