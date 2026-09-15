// SPDX-License-Identifier: Apache-2.0
//
// Coverage/Eligibility Proof — contract simulation tests.
// Covers the three required paths: valid, tampered, and revoked.

import { beforeEach, describe, expect, it } from "vitest";
import {
  POLICY_EXPIRY,
  TODAY,
  VeriHealthSimulator,
  bytes32,
  demoPrivateState,
  pureCircuits,
} from "./simulator.js";

const CREDENTIAL_NONCE = bytes32("credential-nonce-0001");
const VERIFIER_ID = bytes32("clinic-front-desk");

/** Issues the coverage credential and leaves the simulator ready to prove. */
async function issueCoverageCredential(sim: VeriHealthSimulator) {
  const issuerPk = await sim.registerIssuer();
  sim.privateState = { ...sim.privateState, issuerPk };

  const commitment = pureCircuits.commitCoverage(
    issuerPk,
    sim.privateState.coverage,
    sim.privateState.nonce,
  );
  await sim.issueCredential(commitment);
  sim.loadPathFor(commitment);
  return { issuerPk, commitment };
}

describe("Coverage/Eligibility Proof", () => {
  let sim: VeriHealthSimulator;

  beforeEach(async () => {
    sim = await VeriHealthSimulator.create(demoPrivateState());
  });

  it("a valid, non-revoked credential produces a passing proof", async () => {
    await issueCoverageCredential(sim);

    const result = await sim.proveCoverage(TODAY, VERIFIER_ID);

    expect(result).toBe(true);
    expect(sim.ledger.proofCount).toBe(1n);
  });

  it("returns false once the policy has expired", async () => {
    await issueCoverageCredential(sim);

    // Ask about a date after the policy expiry. The expiry date itself stays
    // private; only "not covered on that date" is revealed.
    const result = await sim.proveCoverage(POLICY_EXPIRY + 1n, VERIFIER_ID);

    expect(result).toBe(false);
  });

  it("returns false when the policy is inactive but unexpired", async () => {
    sim = await VeriHealthSimulator.create(
      demoPrivateState({
        coverage: {
          policyRef: bytes32("POLICY-4471"),
          active: false,
          expiryDate: POLICY_EXPIRY,
        },
      }),
    );
    await issueCoverageCredential(sim);

    const result = await sim.proveCoverage(TODAY, VERIFIER_ID);

    expect(result).toBe(false);
  });

  it("a tampered credential fails", async () => {
    const { issuerPk } = await issueCoverageCredential(sim);

    // The holder extends their own policy expiry locally.
    sim.privateState = {
      ...sim.privateState,
      coverage: { ...sim.privateState.coverage, expiryDate: 99_000n },
    };

    await expect(sim.proveCoverage(TODAY, VERIFIER_ID)).rejects.toThrow();

    const tampered = pureCircuits.commitCoverage(
      issuerPk,
      sim.privateState.coverage,
      sim.privateState.nonce,
    );
    expect(sim.loadPathFor(tampered)).toBe(false);
  });

  it("a revoked credential fails even though it is otherwise valid", async () => {
    const { issuerPk, commitment } = await issueCoverageCredential(sim);

    // This is the realistic revocation case: the policy lapses mid-term and
    // the insurer revokes the credential.
    const handle = pureCircuits.deriveHandle(issuerPk, CREDENTIAL_NONCE);
    await sim.revokeCredential(handle);
    expect(sim.ledger.revocationRegistry.member(handle)).toBe(true);

    sim.loadPathFor(commitment);
    await expect(sim.proveCoverage(TODAY, VERIFIER_ID)).rejects.toThrow();
  });

  it("never writes the policy reference or expiry to the public ledger", async () => {
    await issueCoverageCredential(sim);
    await sim.proveCoverage(TODAY, VERIFIER_ID);

    const visible = JSON.stringify(
      {
        revoked: [...sim.ledger.revocationRegistry].map(String),
        nullifiers: [...sim.ledger.usedNullifiers].map(String),
        results: [...sim.ledger.proofResults].map(([k, v]) => [String(k), v]),
      },
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    );

    expect(visible).not.toContain(POLICY_EXPIRY.toString());
    expect(visible).not.toContain(String(sim.privateState.coverage.policyRef));
  });
});
