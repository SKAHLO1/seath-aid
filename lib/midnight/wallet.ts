// SPDX-License-Identifier: Apache-2.0
//
// Wallet integration for the UI.
//
// The connection mechanics live in ./browser/connector.ts, written against
// @midnight-ntwrk/dapp-connector-api 4.0.1. This module is the thin,
// UI-shaped view of that: enough identity to render, plus the demo fallback.
//
// Historical note: this file previously implemented the older connector shape
// (`window.midnight.mnLace.enable()` returning an object with `state()`).
// Current wallets expose `connect(networkId)` on an InitialAPI instead, so that
// code could not have connected to a current Lace build.
//
// The wallet supplies identity only. The holder's medical data never passes
// through it, and no claim value is ever included in a signing request.

import {
  connectWallet,
  isWalletAvailable,
  listWallets,
  pickWallet,
  WalletNotInstalledError,
} from "./browser/connector";
import type { WalletSession } from "./browser/connector";
import { resolveOnChainConfig } from "./deployment";

export { WalletNotInstalledError };
export type { WalletSession };

export type MidnightWalletState = {
  address: string;
  coinPublicKey: string;
  encryptionPublicKey?: string;
  /** Display name of the connected wallet, e.g. "1AM". Absent for the demo identity. */
  walletName?: string;
};

/** True when any Midnight wallet is injected into this page. */
export function isBrowserWalletAvailable(): boolean {
  return isWalletAvailable();
}

/**
 * Name of the wallet a connect will use, or null if none is injected.
 *
 * 1AM is the default provider: pickWallet() prefers it over Lace (see
 * ./browser/connector.ts), and NEXT_PUBLIC_PREFERRED_WALLET_RDNS can override.
 */
export function preferredWalletName(): string | null {
  return pickWallet()?.name ?? null;
}

/** Display names of every injected wallet, for a chooser UI. */
export function availableWalletNames(): string[] {
  return listWallets().map((w) => w.name);
}

/**
 * Connects to the wallet and returns the identity fields the UI renders.
 *
 * The network comes from the deployment configuration so the wallet is asked
 * for the same chain the contract lives on. With no deployment configured we
 * default to preprod, which is the network the deploy script targets.
 */
export async function connectBrowserWallet(): Promise<MidnightWalletState> {
  const network = resolveOnChainConfig()?.network ?? "preprod";
  const session = await connectWallet(network);
  return {
    address: session.address,
    coinPublicKey: session.shieldedCoinPublicKey,
    encryptionPublicKey: session.shieldedEncryptionPublicKey,
    walletName: session.walletName,
  };
}

/**
 * Full session, including the connected API needed to build providers.
 * The UI uses connectBrowserWallet() for display; the on-chain path needs this.
 */
export async function connectSession(): Promise<WalletSession> {
  const network = resolveOnChainConfig()?.network ?? "preprod";
  return connectWallet(network);
}

/**
 * Service URIs in use for this session (indexer and node from the wallet).
 *
 * The proof server is the one actually used for proving — resolved at connect
 * time, preferring localhost:6300 when it answers — NOT necessarily the one the
 * wallet reports. Displaying the wallet's value here would show a hosted server
 * while proofs were really going to the local one, or vice versa.
 */
export async function getServiceUris(): Promise<Record<string, string>> {
  const session = await connectSession();
  return {
    indexerUri: session.config.indexerUri,
    indexerWsUri: session.config.indexerWsUri,
    substrateNodeUri: session.config.substrateNodeUri,
    proverServerUri: session.proofServerUri,
  };
}

/**
 * Deterministic stand-in identity so judges without a wallet installed can
 * still walk the full local flow. Clearly labelled as a demo identity in the UI.
 */
export const DEMO_WALLET: MidnightWalletState = {
  address: "mn_demo1qq7x9c0k3demoholderwalletaddress0000000000",
  coinPublicKey: "0".repeat(64),
};
