// SPDX-License-Identifier: Apache-2.0
//
// Process-wide singleton for the contract runtime and the patient's credentials.
//
// The issuer console, patient dashboard, and verifier view are separate routes
// but must observe the SAME public ledger — otherwise revoking a credential in
// the issuer console would not affect proofs generated in the dashboard, and
// the revocation path could not be demonstrated end to end.
//
// Two modes:
//   demo      — Supabase not configured. The tab self-issues three demo
//               credentials through the real issuance circuit. Unchanged Wave 1
//               behaviour; the test suite runs in this mode.
//   supabase  — credentials are issued from the issuer console and recorded in
//               Supabase. The tab starts with an empty credential list, and
//               loadHolderCredentials() rebuilds ledger state and the patient's
//               credentials once a wallet identity is known.
//
// The private half of a credential (nonce and medical values) is never sent to
// a server: in demo mode it lives in this tab; in supabase mode it comes from a
// package the patient imported into this browser's IndexedDB.

import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureHolderSession, listMyCredentials } from "@/lib/supabase/holder";
import type { CredentialWithIssuer } from "@/lib/supabase/types";
import type { ClaimType } from "./claim-types";
import {
  CredentialPackageError,
  decodePackage,
  toHeldCredential,
  verifyPackage,
} from "./credential-package";
import { issueDemoCredentials } from "./demo-data";
import { getLocalCredential, saveLocalCredential } from "./local-credentials";
import { type HeldCredential, VeriHealthRuntime } from "./runtime";

export type Session = {
  runtime: VeriHealthRuntime;
  /** Demo mode: the self-issued credentials. Supabase mode: empty until loaded. */
  credentials: HeldCredential[];
};

let sessionPromise: Promise<Session> | null = null;

export function getSession(): Promise<Session> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const runtime = await VeriHealthRuntime.create();
      if (isSupabaseConfigured()) {
        // Issuers must be registered before any recorded credential can be
        // replayed into the tree.
        await runtime.registerDemoIssuers();
        return { runtime, credentials: [] };
      }
      const credentials = await issueDemoCredentials(runtime);
      return { runtime, credentials };
    })().catch((e) => {
      // Allow a later retry rather than caching a permanent failure.
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

/** Test helper: drop the cached session so each test starts clean. */
export function resetSession(): void {
  sessionPromise = null;
}

// ---------------------------------------------------------------------------
// Supabase mode
// ---------------------------------------------------------------------------

/** A recorded credential this browser cannot prove yet, and why. */
export type PendingCredential = {
  id: string;
  claimType: ClaimType;
  displayLabel: string;
  issuerName: string;
  issuedAt: string;
  revoked: boolean;
  handle: string;
  reason:
    | "awaiting-package" // no package imported in this browser yet
    | "package-mismatch" // an imported package no longer matches the record
    | "non-demo-issuer"; // cannot be replayed into the in-memory ledger
};

export type HolderCredentials = {
  credentials: HeldCredential[];
  pending: PendingCredential[];
  /** Row ids recorded as revoked in Supabase. */
  revokedIds: Set<string>;
  /** Public records, kept so imports can be checked without a refetch. */
  records: CredentialWithIssuer[];
};

function pendingFrom(
  row: CredentialWithIssuer,
  reason: PendingCredential["reason"],
): PendingCredential {
  return {
    id: row.id,
    claimType: row.claim_type,
    displayLabel: row.display_label,
    issuerName: row.issuer.name,
    issuedAt: row.issued_at,
    revoked: row.revoked,
    handle: row.nullifier_hash,
    reason,
  };
}

/**
 * Binds this browser's holder session to `walletAddress`, loads the patient's
 * recorded credentials, replays their issuance and revocation into the
 * in-memory ledger, and pairs each with its imported package.
 */
export async function loadHolderCredentials(
  runtime: VeriHealthRuntime,
  walletAddress: string,
): Promise<HolderCredentials> {
  await ensureHolderSession(walletAddress);
  const records = await listMyCredentials();

  const credentials: HeldCredential[] = [];
  const pending: PendingCredential[] = [];
  const revokedIds = new Set<string>();

  for (const row of records) {
    if (row.revoked) revokedIds.add(row.id);

    if (!runtime.demoIssuerForPublicKey(row.issuer.public_key)) {
      pending.push(pendingFrom(row, "non-demo-issuer"));
      continue;
    }

    // Ledger first, so the credential is provable (or correctly revoked) the
    // moment its package is available.
    await runtime.replayIssuance(row.issuer.public_key, row.commitment);
    if (row.revoked) {
      await runtime.replayRevocation(row.issuer.public_key, row.nullifier_hash);
    }

    const pkg = await getLocalCredential(row.nullifier_hash);
    if (!pkg) {
      pending.push(pendingFrom(row, "awaiting-package"));
      continue;
    }
    const matches = verifyPackage(runtime.pureCircuits, pkg, {
      claimType: row.claim_type,
      issuerPublicKey: row.issuer.public_key,
      commitment: row.commitment,
      handle: row.nullifier_hash,
    });
    if (!matches) {
      pending.push(pendingFrom(row, "package-mismatch"));
      continue;
    }
    credentials.push(toHeldCredential(pkg, row.id, row.issued_at));
  }

  return { credentials, pending, revokedIds, records };
}

/**
 * Verifies a pasted credential package against the patient's recorded
 * credentials and stores it in this browser. Throws CredentialPackageError with
 * a generic message on any failure — the package holds medical values, so no
 * field of it is ever echoed.
 */
export async function importCredentialPackage(
  runtime: VeriHealthRuntime,
  code: string,
  records: CredentialWithIssuer[],
): Promise<void> {
  const pkg = decodePackage(code);
  const row = records.find((r) => r.nullifier_hash === pkg.handle);
  if (!row) {
    throw new CredentialPackageError(
      "This package is not for any credential issued to the connected wallet.",
    );
  }
  const matches = verifyPackage(runtime.pureCircuits, pkg, {
    claimType: row.claim_type,
    issuerPublicKey: row.issuer.public_key,
    commitment: row.commitment,
    handle: row.nullifier_hash,
  });
  if (!matches) {
    throw new CredentialPackageError(
      "This package does not match the issued credential. It may have been altered.",
    );
  }
  await saveLocalCredential(pkg);
}
