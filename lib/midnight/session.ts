// SPDX-License-Identifier: Apache-2.0
//
// The patient's credentials: what Supabase recorded, paired with what this
// browser holds privately, checked against what the chain actually shows.
//
// A credential is only usable when all three agree:
//
//   Supabase  the public record — who issued it, its label, its handle
//   chain     the commitment is a leaf of the on-chain credential tree
//   browser   the imported package holding the nonce and medical values
//
// Anything short of that is reported as pending, with the reason, rather than
// shown as a credential that will fail the moment it is used.
//
// The private half of a credential never reaches a server: it arrives as a
// package the patient imports, and lives only in this browser's IndexedDB.

import { ensureHolderSession, listMyCredentials } from "@/lib/supabase/holder";
import type { CredentialWithIssuer } from "@/lib/supabase/types";
import type { ClaimType } from "./claim-types";
import type { ChainView } from "./ledger-view";
import {
  CredentialPackageError,
  decodePackage,
  toHeldCredential,
  verifyPackage,
} from "./credential-package";
import { getLocalCredential, saveLocalCredential } from "./local-credentials";
import type { HeldCredential } from "./private-state";

import { pureCircuits } from "@/contracts/src/managed/verihealth/contract/index.js";

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
    | "not-on-chain"; // commitment absent from the on-chain tree
};

export type HolderCredentials = {
  credentials: HeldCredential[];
  pending: PendingCredential[];
  /** Row ids recorded as revoked in Supabase, or revoked on chain. */
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
 * Binds this browser's holder session to `walletAddress` and assembles the
 * patient's credentials from the record, the chain, and local storage.
 *
 * A credential is treated as revoked if EITHER source says so. The chain is
 * authoritative for proving, but the Supabase flag is what another browser's
 * revocation shows up as before the ledger read catches it.
 */
export async function loadHolderCredentials(
  walletAddress: string,
  chain: ChainView,
): Promise<HolderCredentials> {
  await ensureHolderSession(walletAddress);
  const records = await listMyCredentials();

  const credentials: HeldCredential[] = [];
  const pending: PendingCredential[] = [];
  const revokedIds = new Set<string>();

  for (const row of records) {
    const revoked = row.revoked || chain.isRevoked(row.nullifier_hash);
    if (revoked) revokedIds.add(row.id);

    // No point pairing a package with a commitment the chain has never seen:
    // the proof would fail for want of a Merkle path.
    if (!chain.isOnChain(row.commitment)) {
      pending.push(pendingFrom(row, "not-on-chain"));
      continue;
    }

    const pkg = await getLocalCredential(row.nullifier_hash);
    if (!pkg) {
      pending.push(pendingFrom(row, "awaiting-package"));
      continue;
    }
    const matches = verifyPackage(pureCircuits, pkg, {
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
  const matches = verifyPackage(pureCircuits, pkg, {
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
