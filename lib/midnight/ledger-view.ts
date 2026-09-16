// SPDX-License-Identifier: Apache-2.0
//
// Pure reads over the contract's public ledger.
//
// These are split out of browser/chain.ts on purpose. chain.ts pulls in the
// midnight-js provider stack, which reaches `classic-level` — a NODE NATIVE
// addon — when evaluated on the server, and Next prerenders even a "use client"
// page at build time:
//
//   No native build was found for platform=win32 ... runtime=electron
//
// So chain.ts may only ever be imported lazily, inside a handler. But the UI
// needs some of these answers synchronously while rendering (is this credential
// revoked? what do the ledger counters say?). Everything here is plain
// arithmetic over an already-fetched Ledger, with no runtime dependency beyond
// this repo, so it is safe to import statically from a component.

import type { Ledger } from "@/contracts/src/managed/verihealth/contract/index.js";

import { fromHex } from "./private-state";

export type LedgerSummary = {
  issuers: number;
  revoked: number;
  nullifiers: number;
  proofs: number;
};

export function summariseLedger(l: Ledger): LedgerSummary {
  return {
    issuers: Number(l.registeredIssuers.size()),
    revoked: Number(l.revocationRegistry.size()),
    nullifiers: Number(l.usedNullifiers.size()),
    proofs: Number(l.proofCount),
  };
}

/**
 * The two questions the credential list asks of the chain.
 *
 * Passing this rather than the Ledger itself keeps session.ts independent of
 * the generated contract types, and lets the Supabase test suite answer from
 * recorded rows instead of standing up a chain.
 */
export type ChainView = {
  isOnChain(commitmentHex: string): boolean;
  isRevoked(handleHex: string): boolean;
};

export function ledgerView(l: Ledger): ChainView {
  return {
    isOnChain: (commitmentHex) =>
      l.credentialTree.findPathForLeaf(fromHex(commitmentHex)) !== undefined,
    isRevoked: (handleHex) => l.revocationRegistry.member(fromHex(handleHex)),
  };
}

/** Has this issuer public key registered on chain? */
export function isIssuerRegistered(l: Ledger, publicKeyHex: string): boolean {
  return l.registeredIssuers.member(fromHex(publicKeyHex));
}
