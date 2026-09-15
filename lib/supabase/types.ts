// SPDX-License-Identifier: Apache-2.0
//
// Types mirroring supabase/migrations/0001_core_schema.sql.
//
// Note what is absent: there is no field anywhere below for a vaccine code,
// dose count, lab value, policy number, or expiry date. That is deliberate and
// load-bearing — see the privacy invariant at the top of the migration.

import type { ClaimType } from "@/lib/midnight/claim-types";

export type IssuerRow = {
  id: string;
  name: string;
  public_key: string;
  is_demo: boolean;
  /** Operator bound to this issuer by an administrator; several issuers may share one. */
  auth_user_id: string | null;
  created_at: string;
};

export type HolderRow = {
  id: string;
  wallet_address: string;
  /** Anonymous auth user bound via ensure_holder(). Null until the holder connects. */
  auth_user_id: string | null;
  created_at: string;
};

/** A credential row with its issuer's public identity embedded. */
export type CredentialWithIssuer = CredentialRow & {
  issuer: Pick<IssuerRow, "name" | "public_key" | "is_demo">;
};

export type CredentialRow = {
  id: string;
  holder_id: string;
  issuer_id: string;
  claim_type: ClaimType;
  /** Opaque revocation handle (hex). */
  nullifier_hash: string;
  /** On-chain Merkle leaf (hex). */
  commitment: string;
  display_label: string;
  issued_at: string;
  revoked: boolean;
  revoked_at: string | null;
};

export type ProofRequestRow = {
  id: string;
  credential_id: string;
  proof_reference: string;
  nullifier: string;
  verifier_name: string;
  claim_type: ClaimType;
  /** Pass/fail. The only outcome data recorded. */
  result: boolean;
  generated_at: string;
};

/** Shape returned by the verify_proof() SECURITY DEFINER function. */
export type VerifyProofResult = {
  claim_type: ClaimType;
  result: boolean;
  verifier_name: string;
  generated_at: string;
  revoked: boolean;
};
