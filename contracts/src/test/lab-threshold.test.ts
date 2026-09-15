// SPDX-License-Identifier: Apache-2.0
//
// Lab-Value Threshold Proof — contract simulation tests.
// Covers the three required paths: valid, tampered, and revoked.

import { beforeEach, describe, expect, it } from "vitest";
import {
  VeriHealthSimulator,
  bytes32,
  demoPrivateState,
  pureCircuits,
} from "./simulator.js";

const CREDENTIAL_NONCE = bytes32("credential-nonce-0001");
const VERIFIER_ID = bytes32("wellness-program-01");

/** Issues the lab credential and leaves the simulator ready to prove. */
async function issueLabCredential(sim: VeriHealthSimulator) {
  const issuerPk = await sim.registerIssuer();
  sim.privateState = { ...sim.privateState, issuerPk };

  const commitment = pureCircuits.commitLabResult(
    issuerPk,
    sim.privateState.lab,
    sim.privateState.nonce,
  );
  await sim.issueCredential(commitment);
  sim.loadPathFor(commitment);
  return { issuerPk, commitment };
}

describe("Lab-Value Threshold Proof", () => {
  let sim: VeriHealthSimulator;

  // The demo credential attests an LDL value of 150 mg/dL. That exact number
  // is never revealed by any assertion below — only pass/fail is.
  beforeEach(async () => {
    sim = await VeriHealthSimulator.create(demoPrivateState());
  });

  it("a valid, non-revoked credential produces a passing proof", async () => {
    await issueLabCredential(sim);

    // "Is your LDL cholesterol at or below 200?"
    const result = await sim.proveLabThreshold(200n, true, VERIFIER_ID);

    expect(result).toBe(true);
    expect(sim.ledger.proofCount).toBe(1n);
  });

  it("returns false when the value does not meet the threshold", async () => {
    await issueLabCredential(sim);

    // "Is your LDL cholesterol at or below 100?" — it is not.
    const result = await sim.proveLabThreshold(100n, true, VERIFIER_ID);

    expect(result).toBe(false);
  });

  it("supports the at-least direction as well as at-most", async () => {
    await issueLabCredential(sim);

    // "Is the value at least 120?"
    await expect(sim.proveLabThreshold(120n, false, VERIFIER_ID)).resolves.toBe(true);
    // "Is the value at least 400?"
    await expect(
      sim.proveLabThreshold(400n, false, bytes32("second-verifier")),
    ).resolves.toBe(false);
  });

  it("a tampered credential fails", async () => {
    const { issuerPk } = await issueLabCredential(sim);

    // The holder edits their local lab value to look healthier than attested.
    sim.privateState = {
      ...sim.privateState,
      lab: { ...sim.privateState.lab, value: 90n },
    };

    await expect(sim.proveLabThreshold(100n, true, VERIFIER_ID)).rejects.toThrow();

    const tampered = pureCircuits.commitLabResult(
      issuerPk,
      sim.privateState.lab,
      sim.privateState.nonce,
    );
    expect(sim.loadPathFor(tampered)).toBe(false);
  });

  it("a revoked credential fails even though it is otherwise valid", async () => {
    const { issuerPk, commitment } = await issueLabCredential(sim);

    const handle = pureCircuits.deriveHandle(issuerPk, CREDENTIAL_NONCE);
    await sim.revokeCredential(handle);
    expect(sim.ledger.revocationRegistry.member(handle)).toBe(true);

    sim.loadPathFor(commitment);
    await expect(sim.proveLabThreshold(200n, true, VERIFIER_ID)).rejects.toThrow();
  });

  it("never writes the lab value to the public ledger", async () => {
    await issueLabCredential(sim);
    await sim.proveLabThreshold(200n, true, VERIFIER_ID);

    const visible = JSON.stringify(
      {
        revoked: [...sim.ledger.revocationRegistry].map(String),
        nullifiers: [...sim.ledger.usedNullifiers].map(String),
        results: [...sim.ledger.proofResults].map(([k, v]) => [String(k), v]),
      },
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    );

    expect(visible).not.toContain("150");
    expect(visible).not.toContain(String(sim.privateState.lab.labCode));
  });
});
