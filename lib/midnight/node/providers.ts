// SPDX-License-Identifier: Apache-2.0
//
// The six providers midnight-js needs, and the compiled-contract binding.
//
// deployContract() takes one providers record. Each entry answers a different
// question, and getting any of them wrong produces an error at a later step
// than you would expect, so they are built in one place:
//
//   privateStateProvider — where witness data and signing keys are persisted
//   publicDataProvider   — reads ledger state, via the indexer
//   zkConfigProvider     — locates prover/verifier keys on disk
//   proofProvider        — builds proofs, via the LOCAL proof server
//   walletProvider       — public keys + transaction balancing
//   midnightProvider     — transaction submission
//
// The last two are the same object; see NodeWalletProvider.

import { resolve } from "node:path";

import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import { Contract } from "@/contracts/src/managed/verihealth/contract/index.js";

import type { NetworkEndpoints } from "../network";
import {
  type PrivateState,
  type VeriHealthCircuitId,
  witnesses,
} from "../private-state";
import type { NodeWalletProvider } from "./wallet-provider";

/**
 * Directory holding the output of `compact compile`.
 *
 * NodeZkConfigProvider expects to find keys/ and zkir/ beneath this path, one
 * `.prover` / `.verifier` / `.bzkir` per proving circuit.
 */
export const ZK_CONFIG_PATH = resolve(
  process.cwd(),
  "contracts/src/managed/verihealth",
);

/**
 * Binds the compiled Compact output to its witness implementations and ZK
 * assets. The result is what deployContract() actually deploys.
 */
export function compiledContract() {
  return CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(
      CompiledContract.make("verihealth", Contract),
      witnesses,
    ),
    ZK_CONFIG_PATH,
  );
}

export type BuildProvidersOptions = {
  readonly env: NetworkEndpoints;
  readonly wallet: NodeWalletProvider;
  /** Bech32m address of the deployer; scopes the private state store. */
  readonly accountId: string;
  /** Passphrase for the encrypted private state store. */
  readonly storagePassword: string;
};

export function buildProviders({
  env,
  wallet,
  accountId,
  storagePassword,
}: BuildProvidersOptions) {
  const zkConfigProvider = new NodeZkConfigProvider<VeriHealthCircuitId>(
    ZK_CONFIG_PATH,
  );

  return {
    privateStateProvider: levelPrivateStateProvider<string, PrivateState>({
      privateStateStoreName: "verihealth-private-state",
      signingKeyStoreName: "verihealth-signing-keys",
      privateStoragePasswordProvider: () => storagePassword,
      accountId,
    }),
    publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
    zkConfigProvider,
    // Local by design: the proof server sees private witness data.
    proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
    walletProvider: wallet,
    midnightProvider: wallet,
  };
}

export { deployContract };
