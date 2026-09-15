import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_1 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_2 = __compactRuntime.CompactTypeBoolean;

const _descriptor_3 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_4 = __compactRuntime.CompactTypeField;

class _MerkleTreeDigest_0 {
  alignment() {
    return _descriptor_4.alignment();
  }
  fromValue(value_0) {
    return {
      field: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_4.toValue(value_0.field);
  }
}

const _descriptor_5 = new _MerkleTreeDigest_0();

const _descriptor_6 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

class _MerkleTreePathEntry_0 {
  alignment() {
    return _descriptor_5.alignment().concat(_descriptor_2.alignment());
  }
  fromValue(value_0) {
    return {
      sibling: _descriptor_5.fromValue(value_0),
      goes_left: _descriptor_2.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_5.toValue(value_0.sibling).concat(_descriptor_2.toValue(value_0.goes_left));
  }
}

const _descriptor_7 = new _MerkleTreePathEntry_0();

const _descriptor_8 = new __compactRuntime.CompactTypeVector(10, _descriptor_7);

class _MerkleTreePath_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_8.alignment());
  }
  fromValue(value_0) {
    return {
      leaf: _descriptor_1.fromValue(value_0),
      path: _descriptor_8.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.leaf).concat(_descriptor_8.toValue(value_0.path));
  }
}

const _descriptor_9 = new _MerkleTreePath_0();

class _LabResult_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      labCode: _descriptor_1.fromValue(value_0),
      value: _descriptor_0.fromValue(value_0),
      measuredDate: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.labCode).concat(_descriptor_0.toValue(value_0.value).concat(_descriptor_0.toValue(value_0.measuredDate)));
  }
}

const _descriptor_10 = new _LabResult_0();

class _CoveragePolicy_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      policyRef: _descriptor_1.fromValue(value_0),
      active: _descriptor_2.fromValue(value_0),
      expiryDate: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.policyRef).concat(_descriptor_2.toValue(value_0.active).concat(_descriptor_0.toValue(value_0.expiryDate)));
  }
}

const _descriptor_11 = new _CoveragePolicy_0();

class _VaccinationRecord_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_3.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      vaccineCode: _descriptor_1.fromValue(value_0),
      doses: _descriptor_3.fromValue(value_0),
      completionDate: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.vaccineCode).concat(_descriptor_3.toValue(value_0.doses).concat(_descriptor_0.toValue(value_0.completionDate)));
  }
}

const _descriptor_12 = new _VaccinationRecord_0();

const _descriptor_13 = new __compactRuntime.CompactTypeVector(6, _descriptor_1);

const _descriptor_14 = new __compactRuntime.CompactTypeBytes(6);

class _LeafPreimage_0 {
  alignment() {
    return _descriptor_14.alignment().concat(_descriptor_1.alignment());
  }
  fromValue(value_0) {
    return {
      domain_sep: _descriptor_14.fromValue(value_0),
      data: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_14.toValue(value_0.domain_sep).concat(_descriptor_1.toValue(value_0.data));
  }
}

const _descriptor_15 = new _LeafPreimage_0();

const _descriptor_16 = new __compactRuntime.CompactTypeVector(2, _descriptor_1);

const _descriptor_17 = new __compactRuntime.CompactTypeVector(3, _descriptor_1);

const _descriptor_18 = new __compactRuntime.CompactTypeVector(2, _descriptor_4);

class _Either_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_2.fromValue(value_0),
      left: _descriptor_1.fromValue(value_0),
      right: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.is_left).concat(_descriptor_1.toValue(value_0.left).concat(_descriptor_1.toValue(value_0.right)));
  }
}

const _descriptor_19 = new _Either_0();

const _descriptor_20 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_1.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.bytes);
  }
}

const _descriptor_21 = new _ContractAddress_0();

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.vaccinationRecord) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named vaccinationRecord');
    }
    if (typeof(witnesses_0.labResult) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named labResult');
    }
    if (typeof(witnesses_0.coveragePolicy) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named coveragePolicy');
    }
    if (typeof(witnesses_0.credentialNonce) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named credentialNonce');
    }
    if (typeof(witnesses_0.credentialIssuerPk) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named credentialIssuerPk');
    }
    if (typeof(witnesses_0.credentialPath) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named credentialPath');
    }
    if (typeof(witnesses_0.issuerSecretKey) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named issuerSecretKey');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      deriveIssuerPk(context, ...args_1) {
        return { result: pureCircuits.deriveIssuerPk(...args_1), context };
      },
      deriveHandle(context, ...args_1) {
        return { result: pureCircuits.deriveHandle(...args_1), context };
      },
      deriveNullifier(context, ...args_1) {
        return { result: pureCircuits.deriveNullifier(...args_1), context };
      },
      commitVaccination(context, ...args_1) {
        return { result: pureCircuits.commitVaccination(...args_1), context };
      },
      commitLabResult(context, ...args_1) {
        return { result: pureCircuits.commitLabResult(...args_1), context };
      },
      commitCoverage(context, ...args_1) {
        return { result: pureCircuits.commitCoverage(...args_1), context };
      },
      registerIssuer: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`registerIssuer: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('registerIssuer',
                                     'argument 1 (as invoked from Typescript)',
                                     'verihealth.compact line 145 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._registerIssuer_0(context, partialProofData);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      issueCredential: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`issueCredential: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const commitment_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('issueCredential',
                                     'argument 1 (as invoked from Typescript)',
                                     'verihealth.compact line 153 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(commitment_0.buffer instanceof ArrayBuffer && commitment_0.BYTES_PER_ELEMENT === 1 && commitment_0.length === 32)) {
          __compactRuntime.typeError('issueCredential',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'verihealth.compact line 153 char 1',
                                     'Bytes<32>',
                                     commitment_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(commitment_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._issueCredential_0(context,
                                                 partialProofData,
                                                 commitment_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      revokeCredential: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`revokeCredential: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const handle_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('revokeCredential',
                                     'argument 1 (as invoked from Typescript)',
                                     'verihealth.compact line 161 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(handle_0.buffer instanceof ArrayBuffer && handle_0.BYTES_PER_ELEMENT === 1 && handle_0.length === 32)) {
          __compactRuntime.typeError('revokeCredential',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'verihealth.compact line 161 char 1',
                                     'Bytes<32>',
                                     handle_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(handle_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._revokeCredential_0(context,
                                                  partialProofData,
                                                  handle_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      proveVaccination: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`proveVaccination: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const currentDate_0 = args_1[1];
        const requiredDoses_0 = args_1[2];
        const verifierId_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveVaccination',
                                     'argument 1 (as invoked from Typescript)',
                                     'verihealth.compact line 210 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(currentDate_0) === 'bigint' && currentDate_0 >= 0n && currentDate_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveVaccination',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'verihealth.compact line 210 char 1',
                                     'Uint<0..18446744073709551616>',
                                     currentDate_0)
        }
        if (!(typeof(requiredDoses_0) === 'bigint' && requiredDoses_0 >= 0n && requiredDoses_0 <= 255n)) {
          __compactRuntime.typeError('proveVaccination',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'verihealth.compact line 210 char 1',
                                     'Uint<0..256>',
                                     requiredDoses_0)
        }
        if (!(verifierId_0.buffer instanceof ArrayBuffer && verifierId_0.BYTES_PER_ELEMENT === 1 && verifierId_0.length === 32)) {
          __compactRuntime.typeError('proveVaccination',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'verihealth.compact line 210 char 1',
                                     'Bytes<32>',
                                     verifierId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(currentDate_0).concat(_descriptor_3.toValue(requiredDoses_0).concat(_descriptor_1.toValue(verifierId_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_1.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._proveVaccination_0(context,
                                                  partialProofData,
                                                  currentDate_0,
                                                  requiredDoses_0,
                                                  verifierId_0);
        partialProofData.output = { value: _descriptor_2.toValue(result_0), alignment: _descriptor_2.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      proveLabThreshold: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`proveLabThreshold: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const threshold_0 = args_1[1];
        const requireBelow_0 = args_1[2];
        const verifierId_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveLabThreshold',
                                     'argument 1 (as invoked from Typescript)',
                                     'verihealth.compact line 230 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(threshold_0) === 'bigint' && threshold_0 >= 0n && threshold_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveLabThreshold',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'verihealth.compact line 230 char 1',
                                     'Uint<0..18446744073709551616>',
                                     threshold_0)
        }
        if (!(typeof(requireBelow_0) === 'boolean')) {
          __compactRuntime.typeError('proveLabThreshold',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'verihealth.compact line 230 char 1',
                                     'Boolean',
                                     requireBelow_0)
        }
        if (!(verifierId_0.buffer instanceof ArrayBuffer && verifierId_0.BYTES_PER_ELEMENT === 1 && verifierId_0.length === 32)) {
          __compactRuntime.typeError('proveLabThreshold',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'verihealth.compact line 230 char 1',
                                     'Bytes<32>',
                                     verifierId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(threshold_0).concat(_descriptor_2.toValue(requireBelow_0).concat(_descriptor_1.toValue(verifierId_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_2.alignment().concat(_descriptor_1.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._proveLabThreshold_0(context,
                                                   partialProofData,
                                                   threshold_0,
                                                   requireBelow_0,
                                                   verifierId_0);
        partialProofData.output = { value: _descriptor_2.toValue(result_0), alignment: _descriptor_2.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      proveCoverage: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`proveCoverage: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const currentDate_0 = args_1[1];
        const verifierId_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveCoverage',
                                     'argument 1 (as invoked from Typescript)',
                                     'verihealth.compact line 248 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(currentDate_0) === 'bigint' && currentDate_0 >= 0n && currentDate_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveCoverage',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'verihealth.compact line 248 char 1',
                                     'Uint<0..18446744073709551616>',
                                     currentDate_0)
        }
        if (!(verifierId_0.buffer instanceof ArrayBuffer && verifierId_0.BYTES_PER_ELEMENT === 1 && verifierId_0.length === 32)) {
          __compactRuntime.typeError('proveCoverage',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'verihealth.compact line 248 char 1',
                                     'Bytes<32>',
                                     verifierId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(currentDate_0).concat(_descriptor_1.toValue(verifierId_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_1.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._proveCoverage_0(context,
                                               partialProofData,
                                               currentDate_0,
                                               verifierId_0);
        partialProofData.output = { value: _descriptor_2.toValue(result_0), alignment: _descriptor_2.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      registerIssuer: this.circuits.registerIssuer,
      issueCredential: this.circuits.issueCredential,
      revokeCredential: this.circuits.revokeCredential,
      proveVaccination: this.circuits.proveVaccination,
      proveLabThreshold: this.circuits.proveLabThreshold,
      proveCoverage: this.circuits.proveCoverage
    };
    this.provableCircuits = {
      registerIssuer: this.circuits.registerIssuer,
      issueCredential: this.circuits.issueCredential,
      revokeCredential: this.circuits.revokeCredential,
      proveVaccination: this.circuits.proveVaccination,
      proveLabThreshold: this.circuits.proveLabThreshold,
      proveCoverage: this.circuits.proveCoverage
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('registerIssuer', new __compactRuntime.ContractOperation());
    state_0.setOperation('issueCredential', new __compactRuntime.ContractOperation());
    state_0.setOperation('revokeCredential', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveVaccination', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveLabThreshold', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveCoverage', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(0n),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newArray()
                                                          .arrayPush(__compactRuntime.StateValue.newBoundedMerkleTree(
                                                                       new __compactRuntime.StateBoundedMerkleTree(10)
                                                                     )).arrayPush(__compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0n),
                                                                                                                        alignment: _descriptor_0.alignment() })).arrayPush(__compactRuntime.StateValue.newMap(
                                                                                                                                                                             new __compactRuntime.StateMap()
                                                                                                                                                                           ))
                                                          .encode() } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(2n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { dup: { n: 2 } },
                                       { idx: { cached: false,
                                                pushPath: false,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(0n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       'root',
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: true, n: 2 } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(1n),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(2n),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(3n),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(4n),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(5n),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0n),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _merkleTreePathRoot_0(path_0) {
    return { field:
               this._folder_0((...args_0) =>
                                this._merkleTreePathEntryRoot_0(...args_0),
                              this._degradeToTransient_0(this._persistentHash_3({ domain_sep:
                                                                                    new Uint8Array([109, 100, 110, 58, 108, 104]),
                                                                                  data:
                                                                                    path_0.leaf })),
                              path_0.path) };
  }
  _merkleTreePathEntryRoot_0(recursiveDigest_0, entry_0) {
    const left_0 = entry_0.goes_left ? recursiveDigest_0 : entry_0.sibling.field;
    const right_0 = entry_0.goes_left ?
                    entry_0.sibling.field :
                    recursiveDigest_0;
    return this._transientHash_0([left_0, right_0]);
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_18, value_0);
    return result_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_16, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_17, value_0);
    return result_0;
  }
  _persistentHash_2(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_13, value_0);
    return result_0;
  }
  _persistentHash_3(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_15, value_0);
    return result_0;
  }
  _degradeToTransient_0(x_0) {
    const result_0 = __compactRuntime.degradeToTransient(x_0);
    return result_0;
  }
  _vaccinationRecord_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.vaccinationRecord(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && result_0.vaccineCode.buffer instanceof ArrayBuffer && result_0.vaccineCode.BYTES_PER_ELEMENT === 1 && result_0.vaccineCode.length === 32 && typeof(result_0.doses) === 'bigint' && result_0.doses >= 0n && result_0.doses <= 255n && typeof(result_0.completionDate) === 'bigint' && result_0.completionDate >= 0n && result_0.completionDate <= 18446744073709551615n)) {
      __compactRuntime.typeError('vaccinationRecord',
                                 'return value',
                                 'verihealth.compact line 71 char 1',
                                 'struct VaccinationRecord<vaccineCode: Bytes<32>, doses: Uint<0..256>, completionDate: Uint<0..18446744073709551616>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_12.toValue(result_0),
      alignment: _descriptor_12.alignment()
    });
    return result_0;
  }
  _labResult_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.labResult(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && result_0.labCode.buffer instanceof ArrayBuffer && result_0.labCode.BYTES_PER_ELEMENT === 1 && result_0.labCode.length === 32 && typeof(result_0.value) === 'bigint' && result_0.value >= 0n && result_0.value <= 18446744073709551615n && typeof(result_0.measuredDate) === 'bigint' && result_0.measuredDate >= 0n && result_0.measuredDate <= 18446744073709551615n)) {
      __compactRuntime.typeError('labResult',
                                 'return value',
                                 'verihealth.compact line 72 char 1',
                                 'struct LabResult<labCode: Bytes<32>, value: Uint<0..18446744073709551616>, measuredDate: Uint<0..18446744073709551616>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_10.toValue(result_0),
      alignment: _descriptor_10.alignment()
    });
    return result_0;
  }
  _coveragePolicy_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.coveragePolicy(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && result_0.policyRef.buffer instanceof ArrayBuffer && result_0.policyRef.BYTES_PER_ELEMENT === 1 && result_0.policyRef.length === 32 && typeof(result_0.active) === 'boolean' && typeof(result_0.expiryDate) === 'bigint' && result_0.expiryDate >= 0n && result_0.expiryDate <= 18446744073709551615n)) {
      __compactRuntime.typeError('coveragePolicy',
                                 'return value',
                                 'verihealth.compact line 73 char 1',
                                 'struct CoveragePolicy<policyRef: Bytes<32>, active: Boolean, expiryDate: Uint<0..18446744073709551616>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_11.toValue(result_0),
      alignment: _descriptor_11.alignment()
    });
    return result_0;
  }
  _credentialNonce_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.credentialNonce(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('credentialNonce',
                                 'return value',
                                 'verihealth.compact line 74 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _credentialIssuerPk_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.credentialIssuerPk(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('credentialIssuerPk',
                                 'return value',
                                 'verihealth.compact line 75 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _credentialPath_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.credentialPath(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && result_0.leaf.buffer instanceof ArrayBuffer && result_0.leaf.BYTES_PER_ELEMENT === 1 && result_0.leaf.length === 32 && Array.isArray(result_0.path) && result_0.path.length === 10 && result_0.path.every((t) => typeof(t) === 'object' && typeof(t.sibling) === 'object' && typeof(t.sibling.field) === 'bigint' && t.sibling.field >= 0 && t.sibling.field <= __compactRuntime.MAX_FIELD && typeof(t.goes_left) === 'boolean'))) {
      __compactRuntime.typeError('credentialPath',
                                 'return value',
                                 'verihealth.compact line 76 char 1',
                                 'struct MerkleTreePath<leaf: Bytes<32>, path: Vector<10, struct MerkleTreePathEntry<sibling: struct MerkleTreeDigest<field: Field>, goes_left: Boolean>>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_9.toValue(result_0),
      alignment: _descriptor_9.alignment()
    });
    return result_0;
  }
  _issuerSecretKey_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.issuerSecretKey(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('issuerSecretKey',
                                 'return value',
                                 'verihealth.compact line 77 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _deriveIssuerPk_0(sk_0) {
    return this._persistentHash_0([new Uint8Array([118, 104, 58, 105, 115, 115, 117, 101, 114, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   sk_0]);
  }
  _deriveHandle_0(issuerPk_0, nonce_0) {
    return this._persistentHash_1([new Uint8Array([118, 104, 58, 104, 97, 110, 100, 108, 101, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   issuerPk_0,
                                   nonce_0]);
  }
  _deriveNullifier_0(handle_0, verifierId_0) {
    return this._persistentHash_1([new Uint8Array([118, 104, 58, 110, 117, 108, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   handle_0,
                                   verifierId_0]);
  }
  _commitVaccination_0(issuerPk_0, rec_0, nonce_0) {
    return this._persistentHash_2([new Uint8Array([118, 104, 58, 118, 97, 120, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   issuerPk_0,
                                   rec_0.vaccineCode,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        rec_0.doses,
                                                                        'verihealth.compact line 108 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        rec_0.completionDate,
                                                                        'verihealth.compact line 109 char 5'),
                                   nonce_0]);
  }
  _commitLabResult_0(issuerPk_0, rec_0, nonce_0) {
    return this._persistentHash_2([new Uint8Array([118, 104, 58, 108, 97, 98, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   issuerPk_0,
                                   rec_0.labCode,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        rec_0.value,
                                                                        'verihealth.compact line 121 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        rec_0.measuredDate,
                                                                        'verihealth.compact line 122 char 5'),
                                   nonce_0]);
  }
  _commitCoverage_0(issuerPk_0, pol_0, nonce_0) {
    return this._persistentHash_2([new Uint8Array([118, 104, 58, 99, 111, 118, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   issuerPk_0,
                                   pol_0.policyRef,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        pol_0.active
                                                                        ?
                                                                        1n :
                                                                        0n,
                                                                        'verihealth.compact line 134 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        pol_0.expiryDate,
                                                                        'verihealth.compact line 135 char 5'),
                                   nonce_0]);
  }
  _registerIssuer_0(context, partialProofData) {
    const pk_0 = this._deriveIssuerPk_0(this._issuerSecretKey_0(context,
                                                                partialProofData));
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(1n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(pk_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return pk_0;
  }
  _issueCredential_0(context, partialProofData, commitment_0) {
    const pk_0 = this._deriveIssuerPk_0(this._issuerSecretKey_0(context,
                                                                partialProofData));
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_3.toValue(1n),
                                                                                                                  alignment: _descriptor_3.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(pk_0),
                                                                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'unauthorized issuer');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(0n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(0n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { dup: { n: 2 } },
                                       { idx: { cached: false,
                                                pushPath: false,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(1n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell(__compactRuntime.leafHash(
                                                                                              { value: _descriptor_1.toValue(commitment_0),
                                                                                                alignment: _descriptor_1.alignment() }
                                                                                            )).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(1n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { addi: { immediate: 1 } },
                                       { ins: { cached: true, n: 1 } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(2n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { dup: { n: 2 } },
                                       { idx: { cached: false,
                                                pushPath: false,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(0n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       'root',
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 2 } }]);
    return [];
  }
  _revokeCredential_0(context, partialProofData, handle_0) {
    const pk_0 = this._deriveIssuerPk_0(this._issuerSecretKey_0(context,
                                                                partialProofData));
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_3.toValue(1n),
                                                                                                                  alignment: _descriptor_3.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(pk_0),
                                                                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'unauthorized issuer');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(2n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(handle_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _settleProof_0(context,
                 partialProofData,
                 issuerPk_0,
                 nonce_0,
                 leaf_0,
                 path_0,
                 verifierId_0,
                 result_0)
  {
    const root_0 = this._merkleTreePathRoot_0(path_0);
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_3.toValue(0n),
                                                                                                                  alignment: _descriptor_3.alignment() } }] } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_3.toValue(2n),
                                                                                                                  alignment: _descriptor_3.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(root_0),
                                                                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'credential not attested by any issuer');
    __compactRuntime.assert(this._equal_0(path_0.leaf, leaf_0),
                            'credential does not match attested commitment');
    const handle_0 = this._deriveHandle_0(issuerPk_0, nonce_0);
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_3.toValue(2n),
                                                                                                                   alignment: _descriptor_3.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(handle_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'credential revoked');
    const nullifier_0 = this._deriveNullifier_0(handle_0, verifierId_0);
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_3.toValue(3n),
                                                                                                                   alignment: _descriptor_3.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(nullifier_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'proof already used for this verifier');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(3n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(nullifier_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(4n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(nullifier_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(result_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_3.toValue(5n),
                                                                  alignment: _descriptor_3.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_6.toValue(tmp_0),
                                                                alignment: _descriptor_6.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return result_0;
  }
  _proveVaccination_0(context,
                      partialProofData,
                      currentDate_0,
                      requiredDoses_0,
                      verifierId_0)
  {
    const rec_0 = this._vaccinationRecord_0(context, partialProofData);
    const nonce_0 = this._credentialNonce_0(context, partialProofData);
    const issuerPk_0 = this._credentialIssuerPk_0(context, partialProofData);
    let t_0, t_1;
    const result_0 = (t_1 = rec_0.doses, t_1 >= requiredDoses_0)
                     &&
                     (t_0 = rec_0.completionDate, t_0 <= currentDate_0);
    return this._settleProof_0(context,
                               partialProofData,
                               issuerPk_0,
                               nonce_0,
                               this._commitVaccination_0(issuerPk_0,
                                                         rec_0,
                                                         nonce_0),
                               this._credentialPath_0(context, partialProofData),
                               verifierId_0,
                               result_0);
  }
  _proveLabThreshold_0(context,
                       partialProofData,
                       threshold_0,
                       requireBelow_0,
                       verifierId_0)
  {
    const rec_0 = this._labResult_0(context, partialProofData);
    const nonce_0 = this._credentialNonce_0(context, partialProofData);
    const issuerPk_0 = this._credentialIssuerPk_0(context, partialProofData);
    let t_0, t_1;
    const result_0 = requireBelow_0 ?
                     (t_0 = rec_0.value, t_0 <= threshold_0) :
                     (t_1 = rec_0.value, t_1 >= threshold_0);
    return this._settleProof_0(context,
                               partialProofData,
                               issuerPk_0,
                               nonce_0,
                               this._commitLabResult_0(issuerPk_0,
                                                       rec_0,
                                                       nonce_0),
                               this._credentialPath_0(context, partialProofData),
                               verifierId_0,
                               result_0);
  }
  _proveCoverage_0(context, partialProofData, currentDate_0, verifierId_0) {
    const pol_0 = this._coveragePolicy_0(context, partialProofData);
    const nonce_0 = this._credentialNonce_0(context, partialProofData);
    const issuerPk_0 = this._credentialIssuerPk_0(context, partialProofData);
    const result_0 = pol_0.active && currentDate_0 <= pol_0.expiryDate;
    return this._settleProof_0(context,
                               partialProofData,
                               issuerPk_0,
                               nonce_0,
                               this._commitCoverage_0(issuerPk_0, pol_0, nonce_0),
                               this._credentialPath_0(context, partialProofData),
                               verifierId_0,
                               result_0);
  }
  _folder_0(f, x, a0) {
    for (let i = 0; i < 10; i++) { x = f(x, a0[i]); }
    return x;
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    credentialTree: {
      isFull(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isFull: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(0n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(1n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(1024n),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'lt',
                                                                          'neg',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      checkRoot(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`checkRoot: expected 1 argument, received ${args_0.length}`);
        }
        const rt_0 = args_0[0];
        if (!(typeof(rt_0) === 'object' && typeof(rt_0.field) === 'bigint' && rt_0.field >= 0 && rt_0.field <= __compactRuntime.MAX_FIELD)) {
          __compactRuntime.typeError('checkRoot',
                                     'argument 1',
                                     'verihealth.compact line 30 char 1',
                                     'struct MerkleTreeDigest<field: Field>',
                                     rt_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(0n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(2n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(rt_0),
                                                                                                                                 alignment: _descriptor_5.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      root(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`root: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[0];
        return ((result) => result             ? __compactRuntime.CompactTypeMerkleTreeDigest.fromValue(result)             : undefined)(self_0.asArray()[0].asBoundedMerkleTree().rehash().root()?.value);
      },
      firstFree(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`first_free: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[0];
        return __compactRuntime.CompactTypeField.fromValue(self_0.asArray()[1].asCell().value);
      },
      pathForLeaf(...args_0) {
        if (args_0.length !== 2) {
          throw new __compactRuntime.CompactError(`path_for_leaf: expected 2 arguments, received ${args_0.length}`);
        }
        const index_0 = args_0[0];
        const leaf_0 = args_0[1];
        if (!(typeof(index_0) === 'bigint' && index_0 >= 0 && index_0 <= __compactRuntime.MAX_FIELD)) {
          __compactRuntime.typeError('path_for_leaf',
                                     'argument 1',
                                     'verihealth.compact line 30 char 1',
                                     'Field',
                                     index_0)
        }
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('path_for_leaf',
                                     'argument 2',
                                     'verihealth.compact line 30 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        const self_0 = state.asArray()[0];
        return ((result) => result             ? new __compactRuntime.CompactTypeMerkleTreePath(10, _descriptor_1).fromValue(result)             : undefined)(  self_0.asArray()[0].asBoundedMerkleTree().rehash().pathForLeaf(    index_0,    {      value: _descriptor_1.toValue(leaf_0),      alignment: _descriptor_1.alignment()    }  )?.value);
      },
      findPathForLeaf(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`find_path_for_leaf: expected 1 argument, received ${args_0.length}`);
        }
        const leaf_0 = args_0[0];
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('find_path_for_leaf',
                                     'argument 1',
                                     'verihealth.compact line 30 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        const self_0 = state.asArray()[0];
        return ((result) => result             ? new __compactRuntime.CompactTypeMerkleTreePath(10, _descriptor_1).fromValue(result)             : undefined)(  self_0.asArray()[0].asBoundedMerkleTree().rehash().findPathForLeaf(    {      value: _descriptor_1.toValue(leaf_0),      alignment: _descriptor_1.alignment()    }  )?.value);
      },
      history(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`history: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[0];
        return self_0.asArray()[2].asMap().keys().map(  (elem) => __compactRuntime.CompactTypeMerkleTreeDigest.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    registeredIssuers: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(1n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0n),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(1n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'verihealth.compact line 34 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(1n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return self_0.asMap().keys().map((elem) => _descriptor_1.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    revocationRegistry: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(2n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0n),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(2n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'verihealth.compact line 38 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(2n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[2];
        return self_0.asMap().keys().map((elem) => _descriptor_1.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    usedNullifiers: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(3n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0n),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(3n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'verihealth.compact line 41 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(3n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[3];
        return self_0.asMap().keys().map((elem) => _descriptor_1.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    proofResults: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(4n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(0n),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(4n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'verihealth.compact line 44 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(4n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'verihealth.compact line 44 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(4n),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[4];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_2.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    get proofCount() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_3.toValue(5n),
                                                                                                   alignment: _descriptor_3.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  vaccinationRecord: (...args) => undefined,
  labResult: (...args) => undefined,
  coveragePolicy: (...args) => undefined,
  credentialNonce: (...args) => undefined,
  credentialIssuerPk: (...args) => undefined,
  credentialPath: (...args) => undefined,
  issuerSecretKey: (...args) => undefined
});
export const pureCircuits = {
  deriveIssuerPk: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveIssuerPk: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const sk_0 = args_0[0];
    if (!(sk_0.buffer instanceof ArrayBuffer && sk_0.BYTES_PER_ELEMENT === 1 && sk_0.length === 32)) {
      __compactRuntime.typeError('deriveIssuerPk',
                                 'argument 1',
                                 'verihealth.compact line 83 char 1',
                                 'Bytes<32>',
                                 sk_0)
    }
    return _dummyContract._deriveIssuerPk_0(sk_0);
  },
  deriveHandle: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`deriveHandle: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const issuerPk_0 = args_0[0];
    const nonce_0 = args_0[1];
    if (!(issuerPk_0.buffer instanceof ArrayBuffer && issuerPk_0.BYTES_PER_ELEMENT === 1 && issuerPk_0.length === 32)) {
      __compactRuntime.typeError('deriveHandle',
                                 'argument 1',
                                 'verihealth.compact line 89 char 1',
                                 'Bytes<32>',
                                 issuerPk_0)
    }
    if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
      __compactRuntime.typeError('deriveHandle',
                                 'argument 2',
                                 'verihealth.compact line 89 char 1',
                                 'Bytes<32>',
                                 nonce_0)
    }
    return _dummyContract._deriveHandle_0(issuerPk_0, nonce_0);
  },
  deriveNullifier: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`deriveNullifier: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const handle_0 = args_0[0];
    const verifierId_0 = args_0[1];
    if (!(handle_0.buffer instanceof ArrayBuffer && handle_0.BYTES_PER_ELEMENT === 1 && handle_0.length === 32)) {
      __compactRuntime.typeError('deriveNullifier',
                                 'argument 1',
                                 'verihealth.compact line 95 char 1',
                                 'Bytes<32>',
                                 handle_0)
    }
    if (!(verifierId_0.buffer instanceof ArrayBuffer && verifierId_0.BYTES_PER_ELEMENT === 1 && verifierId_0.length === 32)) {
      __compactRuntime.typeError('deriveNullifier',
                                 'argument 2',
                                 'verihealth.compact line 95 char 1',
                                 'Bytes<32>',
                                 verifierId_0)
    }
    return _dummyContract._deriveNullifier_0(handle_0, verifierId_0);
  },
  commitVaccination: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`commitVaccination: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const issuerPk_0 = args_0[0];
    const rec_0 = args_0[1];
    const nonce_0 = args_0[2];
    if (!(issuerPk_0.buffer instanceof ArrayBuffer && issuerPk_0.BYTES_PER_ELEMENT === 1 && issuerPk_0.length === 32)) {
      __compactRuntime.typeError('commitVaccination',
                                 'argument 1',
                                 'verihealth.compact line 101 char 1',
                                 'Bytes<32>',
                                 issuerPk_0)
    }
    if (!(typeof(rec_0) === 'object' && rec_0.vaccineCode.buffer instanceof ArrayBuffer && rec_0.vaccineCode.BYTES_PER_ELEMENT === 1 && rec_0.vaccineCode.length === 32 && typeof(rec_0.doses) === 'bigint' && rec_0.doses >= 0n && rec_0.doses <= 255n && typeof(rec_0.completionDate) === 'bigint' && rec_0.completionDate >= 0n && rec_0.completionDate <= 18446744073709551615n)) {
      __compactRuntime.typeError('commitVaccination',
                                 'argument 2',
                                 'verihealth.compact line 101 char 1',
                                 'struct VaccinationRecord<vaccineCode: Bytes<32>, doses: Uint<0..256>, completionDate: Uint<0..18446744073709551616>>',
                                 rec_0)
    }
    if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
      __compactRuntime.typeError('commitVaccination',
                                 'argument 3',
                                 'verihealth.compact line 101 char 1',
                                 'Bytes<32>',
                                 nonce_0)
    }
    return _dummyContract._commitVaccination_0(issuerPk_0, rec_0, nonce_0);
  },
  commitLabResult: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`commitLabResult: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const issuerPk_0 = args_0[0];
    const rec_0 = args_0[1];
    const nonce_0 = args_0[2];
    if (!(issuerPk_0.buffer instanceof ArrayBuffer && issuerPk_0.BYTES_PER_ELEMENT === 1 && issuerPk_0.length === 32)) {
      __compactRuntime.typeError('commitLabResult',
                                 'argument 1',
                                 'verihealth.compact line 114 char 1',
                                 'Bytes<32>',
                                 issuerPk_0)
    }
    if (!(typeof(rec_0) === 'object' && rec_0.labCode.buffer instanceof ArrayBuffer && rec_0.labCode.BYTES_PER_ELEMENT === 1 && rec_0.labCode.length === 32 && typeof(rec_0.value) === 'bigint' && rec_0.value >= 0n && rec_0.value <= 18446744073709551615n && typeof(rec_0.measuredDate) === 'bigint' && rec_0.measuredDate >= 0n && rec_0.measuredDate <= 18446744073709551615n)) {
      __compactRuntime.typeError('commitLabResult',
                                 'argument 2',
                                 'verihealth.compact line 114 char 1',
                                 'struct LabResult<labCode: Bytes<32>, value: Uint<0..18446744073709551616>, measuredDate: Uint<0..18446744073709551616>>',
                                 rec_0)
    }
    if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
      __compactRuntime.typeError('commitLabResult',
                                 'argument 3',
                                 'verihealth.compact line 114 char 1',
                                 'Bytes<32>',
                                 nonce_0)
    }
    return _dummyContract._commitLabResult_0(issuerPk_0, rec_0, nonce_0);
  },
  commitCoverage: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`commitCoverage: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const issuerPk_0 = args_0[0];
    const pol_0 = args_0[1];
    const nonce_0 = args_0[2];
    if (!(issuerPk_0.buffer instanceof ArrayBuffer && issuerPk_0.BYTES_PER_ELEMENT === 1 && issuerPk_0.length === 32)) {
      __compactRuntime.typeError('commitCoverage',
                                 'argument 1',
                                 'verihealth.compact line 127 char 1',
                                 'Bytes<32>',
                                 issuerPk_0)
    }
    if (!(typeof(pol_0) === 'object' && pol_0.policyRef.buffer instanceof ArrayBuffer && pol_0.policyRef.BYTES_PER_ELEMENT === 1 && pol_0.policyRef.length === 32 && typeof(pol_0.active) === 'boolean' && typeof(pol_0.expiryDate) === 'bigint' && pol_0.expiryDate >= 0n && pol_0.expiryDate <= 18446744073709551615n)) {
      __compactRuntime.typeError('commitCoverage',
                                 'argument 2',
                                 'verihealth.compact line 127 char 1',
                                 'struct CoveragePolicy<policyRef: Bytes<32>, active: Boolean, expiryDate: Uint<0..18446744073709551616>>',
                                 pol_0)
    }
    if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
      __compactRuntime.typeError('commitCoverage',
                                 'argument 3',
                                 'verihealth.compact line 127 char 1',
                                 'Bytes<32>',
                                 nonce_0)
    }
    return _dummyContract._commitCoverage_0(issuerPk_0, pol_0, nonce_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
