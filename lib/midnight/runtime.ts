// SPDX-License-Identifier: Apache-2.0
//
// VeriHealth runtime — executes the REAL compiled Compact circuits.
//
// This is not a mock. It loads the artefacts produced by `compact compile`
// (contracts/src/managed/verihealth) and runs them through
// @midnight-ntwrk/compact-runtime, the same package the contract test suite
// uses and the same one a deployed DApp uses to build transactions.
//
// PRIVACY: the holder's raw claim data lives in `privateState` and is supplied
// to circuits only as witnesses. It is never sent to Supabase, never written to
// the ledger, and never included in any log line or error message.
//
// WAVE 1 SCOPE: the public ledger is held in memory in the browser rather than
// on Midnight testnet, so judges can run the whole loop without a funded wallet
// or a proof server. Circuit execution, the dual-ledger split, Merkle
// attestation, revocation, and nullifiers are all genuinely enforced by the
// compiled contract. Testnet deployment is Wave 2. See README.

import type { ChargedState, ContractState } from "@midnight-ntwrk/compact-runtime";

import type { ClaimType } from "./claim-types";
import { DEMO_ISSUERS, type DemoIssuer, demoIssuerFor } from "./demo-issuer";
import {
  bytes32,
  EMPTY_PATH,
  emptyPrivateState,
  fromHex,
  toHex,
} from "./private-state";
import type {
  CoveragePolicy,
  LabResult,
  PrivateState,
  VaccinationRecord,
} from "./private-state";

// The witness types and helpers live in ./private-state so the Node-side
// deploy tooling constructs byte-identical initial private state. Re-exported
// here because the DApp and the test suite import them from this module.
export type {
  CoveragePolicy,
  LabResult,
  PrivateState,
  VaccinationRecord,
} from "./private-state";
export { bytes32, fromHex, toHex } from "./private-state";

/** A credential as the holder's device knows it, including the private data. */
export type HeldCredential = {
  id: string;
  claimType: ClaimType;
  issuerName: string;
  issuerPk: Uint8Array;
  /** Opaque revocation handle, hex. Safe to store off-chain. */
  handle: string;
  /** On-chain Merkle leaf, hex. Safe to store off-chain. */
  commitment: string;
  displayLabel: string;
  issuedAt: string;
  /** The private witness payload. NEVER leaves the device. */
  secret: {
    nonce: Uint8Array;
    record?: VaccinationRecord;
    lab?: LabResult;
    coverage?: CoveragePolicy;
  };
};

export type ProofOutcome = {
  result: boolean;
  /** Hex nullifier written to the public ledger. */
  nullifier: string;
};

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

type ContractModule = typeof import("@contract");

export class VeriHealthRuntime {
  private mod!: ContractModule;
  private rt!: typeof import("@midnight-ntwrk/compact-runtime");
  private contract!: InstanceType<ContractModule["Contract"]>;
  private contractState!: ContractState | ChargedState;
  private contractAddress!: string;
  private readonly coinPublicKey = "0".repeat(64);

  private privateState: PrivateState = emptyPrivateState();

  /** Issuer public keys by demo issuer id, populated during bootstrap. */
  readonly issuerPks = new Map<string, Uint8Array>();

  private async load() {
    // Dynamic import keeps the WASM runtime out of the server bundle.
    this.rt = await import("@midnight-ntwrk/compact-runtime");
    this.mod = (await import(
      /* webpackIgnore: false */ "@/contracts/src/managed/verihealth/contract/index.js"
    )) as unknown as ContractModule;
  }

  static async create(): Promise<VeriHealthRuntime> {
    const r = new VeriHealthRuntime();
    await r.load();

    r.contractAddress = r.rt.sampleContractAddress();
    r.contract = new r.mod.Contract<PrivateState>({
      vaccinationRecord: ({ privateState }) => [privateState, privateState.record],
      labResult: ({ privateState }) => [privateState, privateState.lab],
      coveragePolicy: ({ privateState }) => [privateState, privateState.coverage],
      credentialNonce: ({ privateState }) => [privateState, privateState.nonce],
      credentialIssuerPk: ({ privateState }) => [privateState, privateState.issuerPk],
      credentialPath: ({ privateState }) => [privateState, privateState.path],
      issuerSecretKey: ({ privateState }) => [privateState, privateState.issuerSecretKey],
    });

    const initial = await r.contract.initialState(
      r.rt.createConstructorContext(r.privateState, r.coinPublicKey),
    );
    r.contractState = initial.currentContractState;
    // initialState() types its private state as `unknown`; the constructor
    // context above was built from a PrivateState, so this is that value.
    r.privateState = initial.currentPrivateState as PrivateState;
    return r;
  }

  /** The public ledger — exactly what any chain observer could see. */
  get ledger() {
    const s = this.contractState as ContractState;
    return this.mod.ledger(s.data ?? (this.contractState as ChargedState));
  }

  get pureCircuits() {
    return this.mod.pureCircuits;
  }

  // compact-runtime 0.16.0 (the version every live network runs) derives the
  // circuit id internally; the parameter is retained so call sites stay legible.
  private ctx(_circuitId: string) {
    return this.rt.createCircuitContext<PrivateState>(
      this.contractAddress,
      this.coinPublicKey,
      this.contractState,
      this.privateState,
    );
  }

  private commit(res: any) {
    this.contractState = res.context.currentQueryContext.state;
    if (res.context.currentPrivateState !== undefined) {
      this.privateState = res.context.currentPrivateState;
    }
  }

  // -------------------------------------------------------------------------
  // Issuer-side operations
  // -------------------------------------------------------------------------

  private async asIssuer<T>(secretLabel: string, fn: () => Promise<T>): Promise<T> {
    this.privateState = { ...this.privateState, issuerSecretKey: bytes32(secretLabel) };
    return fn();
  }

  async registerDemoIssuers(): Promise<void> {
    for (const issuer of DEMO_ISSUERS) {
      await this.asIssuer(issuer.secretLabel, async () => {
        const res = await this.contract.impureCircuits.registerIssuer(
          this.ctx("registerIssuer"),
        );
        this.commit(res);
        this.issuerPks.set(issuer.id, res.result);
      });
    }
  }

  async issueCommitment(claimType: ClaimType, commitment: Uint8Array): Promise<void> {
    await this.issueAs(demoIssuerFor(claimType), commitment);
  }

  /** Issuer-side revocation. Writes the handle to the on-chain registry. */
  async revoke(claimType: ClaimType, handleHex: string): Promise<void> {
    await this.revokeAs(demoIssuerFor(claimType), handleHex);
  }

  private async issueAs(issuer: DemoIssuer, commitment: Uint8Array): Promise<void> {
    await this.asIssuer(issuer.secretLabel, async () => {
      const res = await this.contract.impureCircuits.issueCredential(
        this.ctx("issueCredential"),
        commitment,
      );
      this.commit(res);
    });
  }

  private async revokeAs(issuer: DemoIssuer, handleHex: string): Promise<void> {
    await this.asIssuer(issuer.secretLabel, async () => {
      const res = await this.contract.impureCircuits.revokeCredential(
        this.ctx("revokeCredential"),
        fromHex(handleHex),
      );
      this.commit(res);
    });
  }

  // -------------------------------------------------------------------------
  // Replay from Supabase
  //
  // In Wave 1 the ledger lives in this tab's memory and starts empty on every
  // load. When credentials are issued from the issuer console and recorded in
  // Supabase, the patient's tab rebuilds the relevant ledger state from those
  // records: each commitment is inserted into the credential tree, and each
  // recorded revocation is written to the registry, so proofs behave exactly as
  // they would against a persistent chain.
  //
  // Replay acts as the issuer, so it needs the issuer's secret key. Only the
  // DEMO issuers' keys are known (they are public by design), so only their
  // credentials can be replayed. A real issuer's credentials need the deployed
  // contract, which is out of Wave 1 scope.
  // -------------------------------------------------------------------------

  private readonly replayedCommitments = new Set<string>();

  /** The demo issuer with this public key, or undefined for any other issuer. */
  demoIssuerForPublicKey(publicKeyHex: string): DemoIssuer | undefined {
    const wanted = publicKeyHex.toLowerCase();
    return DEMO_ISSUERS.find((issuer) => {
      const pk = this.issuerPks.get(issuer.id);
      return pk !== undefined && toHex(pk) === wanted;
    });
  }

  /** Inserts a recorded commitment into the credential tree, once per tab. */
  async replayIssuance(issuerPublicKeyHex: string, commitmentHex: string): Promise<void> {
    const key = commitmentHex.toLowerCase();
    if (this.replayedCommitments.has(key)) return;
    const issuer = this.demoIssuerForPublicKey(issuerPublicKeyHex);
    if (!issuer) throw new Error("Only demo-issuer credentials can be replayed.");
    await this.issueAs(issuer, fromHex(key));
    this.replayedCommitments.add(key);
  }

  /** Writes a recorded revocation to the registry. No-op if already revoked. */
  async replayRevocation(issuerPublicKeyHex: string, handleHex: string): Promise<void> {
    if (this.isRevoked(handleHex)) return;
    const issuer = this.demoIssuerForPublicKey(issuerPublicKeyHex);
    if (!issuer) throw new Error("Only demo-issuer revocations can be replayed.");
    await this.revokeAs(issuer, handleHex);
  }

  isRevoked(handleHex: string): boolean {
    return this.ledger.revocationRegistry.member(fromHex(handleHex));
  }

  // -------------------------------------------------------------------------
  // Holder-side proving
  // -------------------------------------------------------------------------

  /**
   * Loads a credential's private data and Merkle path into private state, then
   * runs the matching circuit. Throws if the credential is revoked, tampered
   * with, or already proven to this verifier — those checks live in the
   * contract, not here.
   */
  async generateProof(
    credential: HeldCredential,
    verifierName: string,
    options: { requiredDoses?: bigint; threshold?: bigint; requireBelow?: boolean } = {},
  ): Promise<ProofOutcome> {
    const leaf = fromHex(credential.commitment);
    const found = this.ledger.credentialTree.findPathForLeaf(leaf);

    this.privateState = {
      ...this.privateState,
      issuerPk: credential.issuerPk,
      nonce: credential.secret.nonce,
      path: found ?? EMPTY_PATH,
      record: credential.secret.record ?? this.privateState.record,
      lab: credential.secret.lab ?? this.privateState.lab,
      coverage: credential.secret.coverage ?? this.privateState.coverage,
    };

    const verifierId = bytes32(verifierName);
    const today = BigInt(Math.floor(Date.now() / 86_400_000));

    let res: any;
    switch (credential.claimType) {
      case "vaccination":
        res = await this.contract.impureCircuits.proveVaccination(
          this.ctx("proveVaccination"),
          today,
          options.requiredDoses ?? 2n,
          verifierId,
        );
        break;
      case "lab_threshold":
        res = await this.contract.impureCircuits.proveLabThreshold(
          this.ctx("proveLabThreshold"),
          options.threshold ?? 200n,
          options.requireBelow ?? true,
          verifierId,
        );
        break;
      case "coverage":
        res = await this.contract.impureCircuits.proveCoverage(
          this.ctx("proveCoverage"),
          today,
          verifierId,
        );
        break;
    }

    this.commit(res);
    const handle = this.mod.pureCircuits.deriveHandle(
      credential.issuerPk,
      credential.secret.nonce,
    );
    return {
      result: res.result as boolean,
      nullifier: toHex(this.mod.pureCircuits.deriveNullifier(handle, verifierId)),
    };
  }
}
