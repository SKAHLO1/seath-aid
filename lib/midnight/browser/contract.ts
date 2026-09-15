// SPDX-License-Identifier: Apache-2.0
//
// Attaching to the deployed VeriHealth contract from the browser.
//
// The Node deploy path binds ZK assets with withCompiledFileAssets(), which
// reads prover/verifier keys off disk. There is no filesystem here, so the
// browser build stops at withWitnesses() and lets the FetchZkConfigProvider in
// the providers record serve those assets over HTTP instead.

import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import { Contract } from "@/contracts/src/managed/verihealth/contract/index.js";

import type { DeployTarget, OnChainConfig } from "../deployment";
import {
  PRIVATE_STATE_ID,
  emptyPrivateState,
  witnesses,
} from "../private-state";
import { buildBrowserProviders } from "./providers";
import type { WalletSession } from "./connector";

/** The compiled contract bound to its witnesses, without filesystem assets. */
export function browserCompiledContract() {
  return CompiledContract.withWitnesses(
    CompiledContract.make("verihealth", Contract),
    witnesses,
  );
}

export type ConnectOptions = {
  readonly config: OnChainConfig;
  readonly session: WalletSession;
  readonly storagePassword: string;
};

/**
 * Finds the already-deployed contract and returns a handle for calling it.
 *
 * `initialPrivateState` is only used the first time this browser sees the
 * contract; afterwards the stored private state wins, which is what keeps a
 * holder's witnesses across reloads.
 */
export async function connectToDeployedContract({
  config,
  session,
  storagePassword,
}: ConnectOptions) {
  const providers = buildBrowserProviders({ config, session, storagePassword });

  return findDeployedContract(providers as never, {
    compiledContract: browserCompiledContract(),
    contractAddress: config.contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: emptyPrivateState(),
  } as never);
}

/**
 * Deploys a NEW VeriHealth contract from the browser, signing with Lace.
 *
 * This is the path real projects use to get a contract onto a public testnet,
 * and it is the ONLY one that works on preprod today.
 *
 * deployContract() needs just two things from a wallet: a WalletProvider
 * (public keys + balanceTx) and a MidnightProvider (submitTx). It has no
 * dependency on WalletFacade. So the Node-side wallet — and its full chain
 * sync — is not actually required to deploy at all. Lace does its own syncing
 * inside the extension, so the page never replays chain history.
 *
 * That matters because the Node path is currently unusable on preprod:
 * midnightntwrk/midnight-wallet#704. Both the shielded and dust sub-wallets
 * subscribe to UNFILTERED, chain-wide ledger event streams (`zswapLedgerEvents`
 * and `dustLedgerEvents`, each keyed only by a numeric cursor) and filter
 * client-side against their own secret keys. A fresh wallet starts at cursor 0
 * and must download and decrypt every event ever emitted, so the heap grows
 * without bound and OOMs long before the tip. There is no viewing-key filter
 * indexer-side and no birth-height/checkpoint to skip ahead.
 *
 * Requires the ZK assets to be reachable over HTTP — `pnpm zk:assets` writes
 * them to public/zk — because there is no filesystem to read prover keys from.
 *
 * Returns the deployed contract handle; the address is at
 * `result.deployTxData.public.contractAddress`. Persist that into
 * NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS so the app can find it again.
 */
export type DeployOptions = {
  readonly config: DeployTarget;
  readonly session: WalletSession;
  readonly storagePassword: string;
};

export async function deployNewContract({
  config,
  session,
  storagePassword,
}: DeployOptions) {
  const providers = buildBrowserProviders({ config, session, storagePassword });

  return deployContract(providers as never, {
    compiledContract: browserCompiledContract(),
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: emptyPrivateState(),
  } as never);
}
