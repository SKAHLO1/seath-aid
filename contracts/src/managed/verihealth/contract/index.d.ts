import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type VaccinationRecord = { vaccineCode: Uint8Array;
                                  doses: bigint;
                                  completionDate: bigint
                                };

export type LabResult = { labCode: Uint8Array;
                          value: bigint;
                          measuredDate: bigint
                        };

export type CoveragePolicy = { policyRef: Uint8Array;
                               active: boolean;
                               expiryDate: bigint
                             };

export type Witnesses<PS> = {
  vaccinationRecord(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, VaccinationRecord];
  labResult(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, LabResult];
  coveragePolicy(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, CoveragePolicy];
  credentialNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  credentialIssuerPk(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  credentialPath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { leaf: Uint8Array,
                                                                               path: { sibling: { field: bigint
                                                                                                },
                                                                                       goes_left: boolean
                                                                                     }[]
                                                                             }];
  issuerSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerIssuer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   handle_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveVaccination(context: __compactRuntime.CircuitContext<PS>,
                   currentDate_0: bigint,
                   requiredDoses_0: bigint,
                   verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveLabThreshold(context: __compactRuntime.CircuitContext<PS>,
                    threshold_0: bigint,
                    requireBelow_0: boolean,
                    verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveCoverage(context: __compactRuntime.CircuitContext<PS>,
                currentDate_0: bigint,
                verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  registerIssuer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   handle_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveVaccination(context: __compactRuntime.CircuitContext<PS>,
                   currentDate_0: bigint,
                   requiredDoses_0: bigint,
                   verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveLabThreshold(context: __compactRuntime.CircuitContext<PS>,
                    threshold_0: bigint,
                    requireBelow_0: boolean,
                    verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveCoverage(context: __compactRuntime.CircuitContext<PS>,
                currentDate_0: bigint,
                verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
  deriveIssuerPk(sk_0: Uint8Array): Uint8Array;
  deriveHandle(issuerPk_0: Uint8Array, nonce_0: Uint8Array): Uint8Array;
  deriveNullifier(handle_0: Uint8Array, verifierId_0: Uint8Array): Uint8Array;
  commitVaccination(issuerPk_0: Uint8Array,
                    rec_0: VaccinationRecord,
                    nonce_0: Uint8Array): Uint8Array;
  commitLabResult(issuerPk_0: Uint8Array, rec_0: LabResult, nonce_0: Uint8Array): Uint8Array;
  commitCoverage(issuerPk_0: Uint8Array,
                 pol_0: CoveragePolicy,
                 nonce_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  deriveIssuerPk(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveHandle(context: __compactRuntime.CircuitContext<PS>,
               issuerPk_0: Uint8Array,
               nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveNullifier(context: __compactRuntime.CircuitContext<PS>,
                  handle_0: Uint8Array,
                  verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commitVaccination(context: __compactRuntime.CircuitContext<PS>,
                    issuerPk_0: Uint8Array,
                    rec_0: VaccinationRecord,
                    nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commitLabResult(context: __compactRuntime.CircuitContext<PS>,
                  issuerPk_0: Uint8Array,
                  rec_0: LabResult,
                  nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commitCoverage(context: __compactRuntime.CircuitContext<PS>,
                 issuerPk_0: Uint8Array,
                 pol_0: CoveragePolicy,
                 nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   handle_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveVaccination(context: __compactRuntime.CircuitContext<PS>,
                   currentDate_0: bigint,
                   requiredDoses_0: bigint,
                   verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveLabThreshold(context: __compactRuntime.CircuitContext<PS>,
                    threshold_0: bigint,
                    requireBelow_0: boolean,
                    verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveCoverage(context: __compactRuntime.CircuitContext<PS>,
                currentDate_0: bigint,
                verifierId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  credentialTree: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  registeredIssuers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  revocationRegistry: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  usedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  proofResults: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  readonly proofCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
