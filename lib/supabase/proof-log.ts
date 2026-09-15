// SPDX-License-Identifier: Apache-2.0
//
// Proof-request logging.
//
// WHAT IS WRITTEN: verifier name, claim type, pass/fail, timestamp, an opaque
// nullifier, and a random share token. WHAT IS NEVER WRITTEN: the vaccine code,
// dose count, lab value, policy reference, expiry date, or any threshold the
// value was compared against that could narrow it down.
//
// When Supabase is not configured the log lives in memory, so the demo runs
// standalone; the in-memory store records exactly the same fields.
//
// When Supabase IS configured, failures are surfaced rather than quietly
// diverted to memory. An earlier version fell back silently, which meant a
// misconfigured project looked like it worked while persisting nothing — and an
// empty-but-successful RLS result blanked the proof history.

import type { ClaimType } from "@/lib/midnight/claim-types";
import { getSupabase, isSupabaseConfigured } from "./client";
import type { VerifyProofResult } from "./types";

export type ProofLogEntry = {
  proof_reference: string;
  credential_id: string;
  nullifier: string;
  verifier_name: string;
  claim_type: ClaimType;
  result: boolean;
  generated_at: string;
  /** Mirrors the credential's revocation state at lookup time. */
  revoked: boolean;
};

/**
 * The proof itself succeeded (its nullifier is spent on the ledger) but its
 * record could not be saved. Distinct from a rejected proof: retrying would now
 * fail as "already used with this verifier".
 */
export class ProofNotRecordedError extends Error {
  constructor() {
    super("The proof succeeded, but its record could not be saved.");
    this.name = "ProofNotRecordedError";
  }
}

const memoryLog = new Map<string, ProofLogEntry>();

function randomReference(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function recordProof(entry: {
  credentialId: string;
  nullifier: string;
  verifierName: string;
  claimType: ClaimType;
  result: boolean;
}): Promise<ProofLogEntry> {
  const record: ProofLogEntry = {
    proof_reference: randomReference(),
    credential_id: entry.credentialId,
    nullifier: entry.nullifier,
    verifier_name: entry.verifierName,
    claim_type: entry.claimType,
    result: entry.result,
    generated_at: new Date().toISOString(),
    revoked: false,
  };

  const supabase = getSupabase("holder");
  if (supabase) {
    const { data, error } = await supabase
      .from("proof_requests")
      .insert({
        credential_id: record.credential_id,
        proof_reference: record.proof_reference,
        nullifier: record.nullifier,
        verifier_name: record.verifier_name,
        claim_type: record.claim_type,
        result: record.result,
      })
      .select()
      .single();

    // The error is intentionally not logged: it can echo row contents.
    if (error || !data) throw new ProofNotRecordedError();
    return { ...record, ...data, revoked: false };
  }

  memoryLog.set(record.proof_reference, record);
  return record;
}

export async function listProofs(credentialIds: string[]): Promise<ProofLogEntry[]> {
  const supabase = getSupabase("holder");
  if (supabase) {
    if (credentialIds.length === 0) return [];
    const { data, error } = await supabase
      .from("proof_requests")
      .select("*")
      .in("credential_id", credentialIds)
      .order("generated_at", { ascending: false });
    if (error) throw new Error("Could not load proof history.");
    return (data ?? []).map((d) => ({ ...(d as ProofLogEntry), revoked: false }));
  }

  return [...memoryLog.values()]
    .filter((e) => credentialIds.includes(e.credential_id))
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

/**
 * Verifier-facing lookup by share token. Returns claim type and pass/fail only.
 * Uses the verify_proof() SECURITY DEFINER function so the verifier never gets
 * SELECT access to proof_requests itself. Resolves null for an unknown
 * reference; throws if the lookup itself failed.
 */
export async function lookupProof(
  reference: string,
): Promise<VerifyProofResult | null> {
  const supabase = getSupabase("holder");
  if (supabase) {
    const { data, error } = await supabase.rpc("verify_proof", {
      reference: reference.trim(),
    });
    if (error) throw new Error("The proof lookup failed. Try again.");
    const row = Array.isArray(data) ? data[0] : data;
    return (row as VerifyProofResult | undefined) ?? null;
  }

  const entry = memoryLog.get(reference.trim());
  if (!entry) return null;
  return {
    claim_type: entry.claim_type,
    result: entry.result,
    verifier_name: entry.verifier_name,
    generated_at: entry.generated_at,
    revoked: entry.revoked,
  };
}

/** Reflects an issuer revocation into the local log for the demo flow. */
export function markRevokedLocally(credentialId: string): void {
  for (const [ref, entry] of memoryLog) {
    if (entry.credential_id === credentialId) {
      memoryLog.set(ref, { ...entry, revoked: true });
    }
  }
}

export { isSupabaseConfigured };
