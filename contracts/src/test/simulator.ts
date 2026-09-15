// SPDX-License-Identifier: Apache-2.0
//
// Test harness that drives the compiled VeriHealth circuits through
// @midnight-ntwrk/compact-runtime, threading public ledger state and private
// witness state across calls exactly as a real DApp would.

import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type ChargedState,
  type ContractState,
  type MerkleTreePath,
} from "@midnight-ntwrk/compact-runtime";

import {
  Contract,
  ledger,
  pureCircuits,
  type CoveragePolicy,
  type LabResult,
  type Ledger,
  type VaccinationRecord,
  type Witnesses,
} from "../managed/verihealth/contract/index.js";

/**
 * The holder's private store. In the real app this lives in browser storage on
 * the patient's device; it is NEVER sent to Supabase or written to the ledger.
 */
export type VeriHealthPrivateState = {
  issuerSecretKey: Uint8Array;
  /** Vaccination claim data. */
  record: VaccinationRecord;
  /** Lab-value claim data. */
  lab: LabResult;
  /** Coverage claim data. */
  coverage: CoveragePolicy;
  nonce: Uint8Array;
  issuerPk: Uint8Array;
  path: MerkleTreePath<Uint8Array>;
};

const emptyPath: MerkleTreePath<Uint8Array> = {
  leaf: new Uint8Array(32),
  path: [],
};

export const witnesses: Witnesses<VeriHealthPrivateState> = {
  vaccinationRecord: ({ privateState }) => [privateState, privateState.record],
  labResult: ({ privateState }) => [privateState, privateState.lab],
  coveragePolicy: ({ privateState }) => [privateState, privateState.coverage],
  credentialNonce: ({ privateState }) => [privateState, privateState.nonce],
  credentialIssuerPk: ({ privateState }) => [privateState, privateState.issuerPk],
  credentialPath: ({ privateState }) => [privateState, privateState.path],
  issuerSecretKey: ({ privateState }) => [privateState, privateState.issuerSecretKey],
};

/** Deterministic 32-byte value from a label, for reproducible tests. */
export function bytes32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  const encoded = new TextEncoder().encode(label);
  out.set(encoded.subarray(0, 32));
  return out;
}

// DEMO ONLY — hardcoded simulated issuer keys. These correspond to no real
// healthcare provider and hold no authority. See README, "Demo issuer".
export const DEMO_CLINIC_SK = bytes32("demo-clinic-secret-key-DO-NOT-USE");
export const DEMO_LAB_SK = bytes32("demo-lab-secret-key-DO-NOT-USE");
export const DEMO_INSURER_SK = bytes32("demo-insurer-secret-key-DO-NOT-USE");

/** Dates are days since the Unix epoch. */
export const COMPLETION_DATE = 20_000n;
export const TODAY = 20_500n;
export const POLICY_EXPIRY = 21_000n;

/** A fully-populated private store for the demo patient. */
export function demoPrivateState(
  overrides: Partial<VeriHealthPrivateState> = {},
): VeriHealthPrivateState {
  return {
    issuerSecretKey: DEMO_CLINIC_SK,
    record: {
      vaccineCode: bytes32("MMR-2024"),
      doses: 2n,
      completionDate: COMPLETION_DATE,
    },
    lab: {
      labCode: bytes32("LDL-CHOLESTEROL"),
      value: 150n,
      measuredDate: COMPLETION_DATE,
    },
    coverage: {
      policyRef: bytes32("POLICY-4471"),
      active: true,
      expiryDate: POLICY_EXPIRY,
    },
    nonce: bytes32("credential-nonce-0001"),
    issuerPk: new Uint8Array(32),
    path: { leaf: new Uint8Array(32), path: [] },
    ...overrides,
  };
}

export class VeriHealthSimulator {
  readonly contractAddress = sampleContractAddress();
  private readonly coinPublicKey = "0".repeat(64);
  private readonly contract: Contract<VeriHealthPrivateState>;
  private contractState!: ContractState | ChargedState;
  privateState: VeriHealthPrivateState;

  private constructor(privateState: VeriHealthPrivateState) {
    this.contract = new Contract<VeriHealthPrivateState>(witnesses);
    this.privateState = privateState;
  }

  static async create(privateState: VeriHealthPrivateState): Promise<VeriHealthSimulator> {
    const sim = new VeriHealthSimulator(privateState);
    const initial = await sim.contract.initialState(
      createConstructorContext(privateState, sim.coinPublicKey),
    );
    sim.contractState = initial.currentContractState;
    sim.privateState = initial.currentPrivateState;
    return sim;
  }

  /** Current public ledger state — what any observer of the chain can see. */
  get ledger(): Ledger {
    const state = this.contractState as ContractState;
    return ledger(state.data ?? (this.contractState as ChargedState));
  }

  // compact-runtime 0.16.0 (the version every live network runs) derives the
  // circuit id internally; the parameter is retained so call sites stay legible.
  private context(_circuitId: string) {
    return createCircuitContext<VeriHealthPrivateState>(
      this.contractAddress,
      this.coinPublicKey,
      this.contractState,
      this.privateState,
    );
  }

  private commit(result: { context: { currentQueryContext: { state: ChargedState }; currentPrivateState: VeriHealthPrivateState | undefined } }) {
    this.contractState = result.context.currentQueryContext.state;
    if (result.context.currentPrivateState !== undefined) {
      this.privateState = result.context.currentPrivateState;
    }
  }

  async registerIssuer(): Promise<Uint8Array> {
    const res = await this.contract.impureCircuits.registerIssuer(this.context("registerIssuer"));
    this.commit(res as never);
    return res.result;
  }

  async issueCredential(commitment: Uint8Array): Promise<void> {
    const res = await this.contract.impureCircuits.issueCredential(
      this.context("issueCredential"),
      commitment,
    );
    this.commit(res as never);
  }

  async revokeCredential(handle: Uint8Array): Promise<void> {
    const res = await this.contract.impureCircuits.revokeCredential(
      this.context("revokeCredential"),
      handle,
    );
    this.commit(res as never);
  }

  async proveVaccination(
    currentDate: bigint,
    requiredDoses: bigint,
    verifierId: Uint8Array,
  ): Promise<boolean> {
    const res = await this.contract.impureCircuits.proveVaccination(
      this.context("proveVaccination"),
      currentDate,
      requiredDoses,
      verifierId,
    );
    this.commit(res as never);
    return res.result;
  }

  async proveLabThreshold(
    threshold: bigint,
    requireBelow: boolean,
    verifierId: Uint8Array,
  ): Promise<boolean> {
    const res = await this.contract.impureCircuits.proveLabThreshold(
      this.context("proveLabThreshold"),
      threshold,
      requireBelow,
      verifierId,
    );
    this.commit(res as never);
    return res.result;
  }

  async proveCoverage(currentDate: bigint, verifierId: Uint8Array): Promise<boolean> {
    const res = await this.contract.impureCircuits.proveCoverage(
      this.context("proveCoverage"),
      currentDate,
      verifierId,
    );
    this.commit(res as never);
    return res.result;
  }

  /**
   * Look up the Merkle authentication path for a credential and stash it in
   * private state. Mirrors what the holder's wallet does before proving.
   */
  loadPathFor(leaf: Uint8Array): boolean {
    const found = this.ledger.credentialTree.findPathForLeaf(leaf);
    this.privateState = { ...this.privateState, path: found ?? emptyPath };
    return found !== undefined;
  }
}

export { pureCircuits, emptyPath };
