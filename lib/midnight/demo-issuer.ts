// SPDX-License-Identifier: Apache-2.0
//
// ============================================================================
//                        *** DEMO ISSUERS — NOT REAL ***
// ============================================================================
// These are SIMULATED issuer keypairs for this demo. They
// correspond to no real clinic, laboratory, or insurer, and there is no
// integration with any actual healthcare provider anywhere in this codebase.
//
// The secret keys are deliberately hardcoded and published in this repository.
// They exist so anyone can run the full issue -> hold -> prove -> verify ->
// revoke loop unattended. In production an issuer's key would live in an HSM
// and the issuer registry would be a governed allowlist, not self-service.
// ============================================================================

import { pureCircuits } from "@/contracts/src/managed/verihealth/contract/index.js";

import type { ClaimType } from "./claim-types";
import { bytes32, toHex } from "./private-state";

export type DemoIssuer = {
  id: string;
  name: string;
  /** Label hashed to 32 bytes to form the DEMO secret key. */
  secretLabel: string;
  /** Which claim type this issuer attests in the demo. */
  claimType: ClaimType;
  isDemo: true;
};

export const DEMO_ISSUERS: DemoIssuer[] = [
  {
    id: "clinic",
    name: "Northside Community Clinic (DEMO)",
    secretLabel: "demo-clinic-secret-key-DO-NOT-USE",
    claimType: "vaccination",
    isDemo: true,
  },
  {
    id: "lab",
    name: "Meridian Diagnostics Lab (DEMO)",
    secretLabel: "demo-lab-secret-key-DO-NOT-USE",
    claimType: "lab_threshold",
    isDemo: true,
  },
  {
    id: "insurer",
    name: "Harbour Health Insurance (DEMO)",
    secretLabel: "demo-insurer-secret-key-DO-NOT-USE",
    claimType: "coverage",
    isDemo: true,
  },
];

export function demoIssuerFor(claimType: ClaimType): DemoIssuer {
  const issuer = DEMO_ISSUERS.find((i) => i.claimType === claimType);
  if (!issuer) throw new Error(`No demo issuer configured for ${claimType}`);
  return issuer;
}

/**
 * The issuer's on-chain public key, hex.
 *
 * deriveIssuerPk is a pure circuit (`proof: false`), so this is plain local
 * arithmetic — no contract instance, no transaction, no wallet. It is the same
 * value registerIssuer() writes to the ledger, and the same one seeded into
 * Supabase by 0003_seed_demo.sql.
 */
export function demoIssuerPublicKey(issuer: DemoIssuer): string {
  return toHex(pureCircuits.deriveIssuerPk(bytes32(issuer.secretLabel)));
}

/** The demo issuer with this public key, or undefined for any other issuer. */
export function demoIssuerForPublicKey(publicKeyHex: string): DemoIssuer | undefined {
  const wanted = publicKeyHex.toLowerCase();
  return DEMO_ISSUERS.find((issuer) => demoIssuerPublicKey(issuer) === wanted);
}
