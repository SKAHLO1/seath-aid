// SPDX-License-Identifier: Apache-2.0
//
// Vaccination Proof — contract simulation tests.
// Covers the three required paths: valid, tampered, and revoked.

import { beforeEach, describe, expect, it } from "vitest";
import {
  COMPLETION_DATE,
  TODAY,
  VeriHealthSimulator,
  bytes32,
  demoPrivateState,
  pureCircuits,
} from "./simulator.js";

const CREDENTIAL_NONCE = bytes32("credential-nonce-0001");
const VERIFIER_ID = bytes32("acme-employer-hr");

/**
 * Runs the full issuance flow and leaves the simulator ready to prove.
 * Returns the on-chain commitment and the issuer public key.
 */
async function issueDemoCredential(sim: VeriHealthSimulator) {
  const issuerPk = await sim.registerIssuer();
  sim.privateState = { ...sim.privateState, issuerPk };

  const commitment = pureCircuits.commitVaccination(
    issuerPk,
    sim.privateState.record,
    sim.privateState.nonce,
  );
  await sim.issueCredential(commitment);
  sim.loadPathFor(commitment);
  return { issuerPk, commitment };
}

describe("Vaccination Proof", () => {
  let sim: VeriHealthSimulator;

  beforeEach(async () => {
    sim = await VeriHealthSimulator.create(demoPrivateState());
  });

  it("a valid, non-revoked credential produces a passing proof", async () => {
    await issueDemoCredential(sim);

    const result = await sim.proveVaccination(TODAY, 2n, VERIFIER_ID);

    expect(result).toBe(true);
    expect(sim.ledger.proofCount).toBe(1n);
  });

  it("returns false when the dose requirement is not met", async () => {
    await issueDemoCredential(sim);

    // The credential attests 2 doses; the verifier demands 3.
    const result = await sim.proveVaccination(TODAY, 3n, VERIFIER_ID);

    expect(result).toBe(false);
  });

  it("a tampered credential fails", async () => {
    const { issuerPk } = await issueDemoCredential(sim);

    // The holder edits their local record to claim more doses than attested.
    // The recomputed commitment no longer matches the on-chain leaf, so the
    // Merkle membership check fails.
    sim.privateState = {
      ...sim.privateState,
      record: { ...sim.privateState.record, doses: 5n },
    };

    await expect(sim.proveVaccination(TODAY, 5n, VERIFIER_ID)).rejects.toThrow();

    // Sanity check: the tampered record commits to a different leaf entirely.
    const tamperedCommitment = pureCircuits.commitVaccination(
      issuerPk,
      sim.privateState.record,
      sim.privateState.nonce,
    );
    expect(sim.loadPathFor(tamperedCommitment)).toBe(false);
  });

  it("a revoked credential fails even though it is otherwise valid", async () => {
    const { issuerPk, commitment } = await issueDemoCredential(sim);

    // Confirm it would otherwise pass.
    const handle = pureCircuits.deriveHandle(issuerPk, CREDENTIAL_NONCE);
    await sim.revokeCredential(handle);
    expect(sim.ledger.revocationRegistry.member(handle)).toBe(true);

    sim.loadPathFor(commitment);
    await expect(sim.proveVaccination(TODAY, 2n, VERIFIER_ID)).rejects.toThrow();
  });

  it("rejects replaying the same proof to the same verifier", async () => {
    await issueDemoCredential(sim);

    await expect(sim.proveVaccination(TODAY, 2n, VERIFIER_ID)).resolves.toBe(true);
    await expect(sim.proveVaccination(TODAY, 2n, VERIFIER_ID)).rejects.toThrow();
  });

  it("allows the same credential to be proven to a different verifier", async () => {
    await issueDemoCredential(sim);

    await expect(sim.proveVaccination(TODAY, 2n, VERIFIER_ID)).resolves.toBe(true);
    await expect(
      sim.proveVaccination(TODAY, 2n, bytes32("border-agency-xyz")),
    ).resolves.toBe(true);
    expect(sim.ledger.proofCount).toBe(2n);
  });

  it("leaks no medical values to the public ledger", async () => {
    const { issuerPk } = await issueDemoCredential(sim);
    await sim.proveVaccination(TODAY, 2n, VERIFIER_ID);

    const handle = pureCircuits.deriveHandle(issuerPk, CREDENTIAL_NONCE);
    const nullifier = pureCircuits.deriveNullifier(handle, VERIFIER_ID);

    // The public result map stores a bare boolean under an opaque nullifier.
    expect(sim.ledger.proofResults.lookup(nullifier)).toBe(true);

    // Nothing on the ledger equals the vaccine code, the dose count, or the
    // completion date. Serialise the whole visible state and check.
    const visible = JSON.stringify(
      {
        issuers: [...sim.ledger.registeredIssuers].map(String),
        revoked: [...sim.ledger.revocationRegistry].map(String),
        nullifiers: [...sim.ledger.usedNullifiers].map(String),
        results: [...sim.ledger.proofResults].map(([k, v]) => [String(k), v]),
      },
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    );

    expect(visible).not.toContain(String(sim.privateState.record.vaccineCode));
    expect(visible).not.toContain(COMPLETION_DATE.toString());
    expect(visible).not.toContain(String(CREDENTIAL_NONCE));
  });
});
