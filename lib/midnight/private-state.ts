// SPDX-License-Identifier: Apache-2.0
//
// The contract's private state, shared by the in-browser runtime and the
// Node-side deployment tooling.
//
// This is the witness payload. Everything in it is supplied to circuits as a
// private input and never written to the ledger. It was extracted from
// runtime.ts so that the deploy script and the DApp construct byte-identical
// initial private state — a mismatch here surfaces much later as an
// unexplained proof failure.

import type { MerkleTreePath } from "@midnight-ntwrk/compact-runtime";

// ---------------------------------------------------------------------------
// Witness record shapes, mirroring the structs in verihealth.compact
// ---------------------------------------------------------------------------

export type VaccinationRecord = {
  vaccineCode: Uint8Array;
  doses: bigint;
  completionDate: bigint;
};

export type LabResult = {
  labCode: Uint8Array;
  value: bigint;
  measuredDate: bigint;
};

export type CoveragePolicy = {
  policyRef: Uint8Array;
  active: boolean;
  expiryDate: bigint;
};

export type PrivateState = {
  issuerSecretKey: Uint8Array;
  record: VaccinationRecord;
  lab: LabResult;
  coverage: CoveragePolicy;
  nonce: Uint8Array;
  issuerPk: Uint8Array;
  path: MerkleTreePath<Uint8Array>;
};

/**
 * Every circuit in the contract that produces a proof.
 *
 * NodeZkConfigProvider is generic over these ids and will look for a matching
 * `.prover` / `.verifier` / `.bzkir` triple on disk for each one, so this union
 * must stay in step with the `proof: true` circuits in contract-info.json.
 */
export type VeriHealthCircuitId =
  | "registerIssuer"
  | "issueCredential"
  | "revokeCredential"
  | "proveVaccination"
  | "proveLabThreshold"
  | "proveCoverage";

export const VERIHEALTH_CIRCUIT_IDS: readonly VeriHealthCircuitId[] = [
  "registerIssuer",
  "issueCredential",
  "revokeCredential",
  "proveVaccination",
  "proveLabThreshold",
  "proveCoverage",
];

/** Key under which the contract's private state is filed by the provider. */
export const PRIVATE_STATE_ID = "verihealth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function bytes32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(label).subarray(0, 32));
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export const EMPTY_PATH: MerkleTreePath<Uint8Array> = {
  leaf: new Uint8Array(32),
  path: [],
};

/**
 * The zeroed private state a contract is deployed with.
 *
 * The constructor touches no witness, so these values are never read on chain;
 * they exist because the runtime requires a well-formed private state object
 * before any circuit — including the constructor — can be built.
 */
export function emptyPrivateState(): PrivateState {
  return {
    issuerSecretKey: new Uint8Array(32),
    record: { vaccineCode: new Uint8Array(32), doses: 0n, completionDate: 0n },
    lab: { labCode: new Uint8Array(32), value: 0n, measuredDate: 0n },
    coverage: { policyRef: new Uint8Array(32), active: false, expiryDate: 0n },
    nonce: new Uint8Array(32),
    issuerPk: new Uint8Array(32),
    path: EMPTY_PATH,
  };
}

/**
 * The witness implementations expected by the compiled contract.
 *
 * Each one reads a field straight out of private state and returns it
 * unchanged. All seven must be supplied; a missing witness fails at proof time
 * with an error that does not name the circuit.
 */
export const witnesses = {
  vaccinationRecord: ({ privateState }: { privateState: PrivateState }) =>
    [privateState, privateState.record] as const,
  labResult: ({ privateState }: { privateState: PrivateState }) =>
    [privateState, privateState.lab] as const,
  coveragePolicy: ({ privateState }: { privateState: PrivateState }) =>
    [privateState, privateState.coverage] as const,
  credentialNonce: ({ privateState }: { privateState: PrivateState }) =>
    [privateState, privateState.nonce] as const,
  credentialIssuerPk: ({ privateState }: { privateState: PrivateState }) =>
    [privateState, privateState.issuerPk] as const,
  credentialPath: ({ privateState }: { privateState: PrivateState }) =>
    [privateState, privateState.path] as const,
  issuerSecretKey: ({ privateState }: { privateState: PrivateState }) =>
    [privateState, privateState.issuerSecretKey] as const,
};
