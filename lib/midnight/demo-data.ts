// SPDX-License-Identifier: Apache-2.0
//
// Seeds the demo patient's wallet by running the REAL issuance circuit for each
// claim type, so every credential shown in the dashboard has a genuine
// commitment in the on-chain Merkle tree and can actually be proven.
//
// The raw values below are synthetic. No real patient data appears anywhere.

import { demoIssuerFor } from "./demo-issuer";
import {
  type HeldCredential,
  type VeriHealthRuntime,
  bytes32,
  toHex,
} from "./runtime";

const DAY = 86_400_000;
const today = () => BigInt(Math.floor(Date.now() / DAY));

export async function issueDemoCredentials(
  rt: VeriHealthRuntime,
): Promise<HeldCredential[]> {
  await rt.registerDemoIssuers();

  const held: HeldCredential[] = [];
  const now = new Date().toISOString();

  // --- 1. Vaccination -------------------------------------------------------
  {
    const issuer = demoIssuerFor("vaccination");
    const issuerPk = rt.issuerPks.get(issuer.id)!;
    const nonce = bytes32("vh-demo-nonce-vaccination");
    const record = {
      vaccineCode: bytes32("MMR-2024"),
      doses: 2n,
      completionDate: today() - 400n,
    };
    const commitment = rt.pureCircuits.commitVaccination(issuerPk, record, nonce);
    await rt.issueCommitment("vaccination", commitment);

    held.push({
      id: "demo-vaccination",
      claimType: "vaccination",
      issuerName: issuer.name,
      issuerPk,
      handle: toHex(rt.pureCircuits.deriveHandle(issuerPk, nonce)),
      commitment: toHex(commitment),
      displayLabel: "MMR immunisation series",
      issuedAt: now,
      secret: { nonce, record },
    });
  }

  // --- 2. Lab threshold -----------------------------------------------------
  {
    const issuer = demoIssuerFor("lab_threshold");
    const issuerPk = rt.issuerPks.get(issuer.id)!;
    const nonce = bytes32("vh-demo-nonce-lab");
    const lab = {
      labCode: bytes32("LDL-CHOLESTEROL"),
      value: 150n,
      measuredDate: today() - 30n,
    };
    const commitment = rt.pureCircuits.commitLabResult(issuerPk, lab, nonce);
    await rt.issueCommitment("lab_threshold", commitment);

    held.push({
      id: "demo-lab",
      claimType: "lab_threshold",
      issuerName: issuer.name,
      issuerPk,
      handle: toHex(rt.pureCircuits.deriveHandle(issuerPk, nonce)),
      commitment: toHex(commitment),
      displayLabel: "LDL cholesterol panel",
      issuedAt: now,
      secret: { nonce, lab },
    });
  }

  // --- 3. Coverage ----------------------------------------------------------
  {
    const issuer = demoIssuerFor("coverage");
    const issuerPk = rt.issuerPks.get(issuer.id)!;
    const nonce = bytes32("vh-demo-nonce-coverage");
    const coverage = {
      policyRef: bytes32("POLICY-4471"),
      active: true,
      expiryDate: today() + 200n,
    };
    const commitment = rt.pureCircuits.commitCoverage(issuerPk, coverage, nonce);
    await rt.issueCommitment("coverage", commitment);

    held.push({
      id: "demo-coverage",
      claimType: "coverage",
      issuerName: issuer.name,
      issuerPk,
      handle: toHex(rt.pureCircuits.deriveHandle(issuerPk, nonce)),
      commitment: toHex(commitment),
      displayLabel: "Health policy #4471",
      issuedAt: now,
      secret: { nonce, coverage },
    });
  }

  return held;
}
