// SPDX-License-Identifier: Apache-2.0
//
// The six providers midnight-js needs, assembled for the browser.
//
// Mirrors lib/midnight/node/providers.ts, with three deliberate differences:
//
//   zkConfigProvider  fetches keys over HTTP instead of reading them off disk
//   privateState      persists to IndexedDB (level resolves to browser-level)
//   wallet/midnight   delegate to the extension; no signing key in this process
//
// PROOF SERVER. The proof server sees witness data in the clear, so it must be
// one the user controls. We therefore take its URI from the wallet's own
// configuration rather than shipping a hosted default: whatever proof server
// the user has configured in their wallet is, by construction, one they trust.
// If the wallet does not advertise one we fall back to localhost:6300, the
// documented default for a locally run proof server, and never to a remote host.

import type { ConnectedAPI, Configuration } from "@midnight-ntwrk/dapp-connector-api";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import type { DeployTarget } from "../deployment";
import type { PrivateState, VeriHealthCircuitId } from "../private-state";
import { BrowserWalletProvider } from "./wallet-provider";
import type { WalletSession } from "./connector";


export type BuildBrowserProvidersOptions = {
  readonly config: DeployTarget;
  readonly session: WalletSession;
  /** Passphrase encrypting the private state store in IndexedDB. */
  readonly storagePassword: string;
};

export function buildBrowserProviders({
  config,
  session,
  storagePassword,
}: BuildBrowserProvidersOptions) {
  // Belt and braces. connectWallet() already sets this, but midnight-js reads
  // the network id from module-level global state, and that global is lost on
  // a page reload or a fresh module instance while a session object may not be.
  // Setting it again here is idempotent and costs nothing; missing it throws
  // "Network ID has not been configured" from somewhere far less obvious.
  setNetworkId(config.network);

  // The second argument is NOT optional in practice, despite defaulting.
  //
  // FetchZkConfigProvider declares `constructor(baseURL, fetchFunc = fetch)` and
  // then calls `this.fetchFunc(...)`. Invoking it as a method sets `this` to the
  // provider rather than `window`, and Chrome rejects a detached window.fetch
  // with "TypeError: Illegal invocation". Node's fetch is not bound-sensitive,
  // so this fails ONLY in the browser — and the adapter in midnight-js-types
  // catches it and rethrows as ZKConfigurationReadError with the real cause
  // hidden, producing "Failed to read verifier key" for every circuit at once.
  //
  // Passing an arrow that closes over the global keeps `this` correct.
  const zkConfigProvider = new FetchZkConfigProvider<VeriHealthCircuitId>(
    absoluteZkBase(config.zkConfigBase),
    (...args: Parameters<typeof fetch>) => fetch(...args),
  );

  return {
    privateStateProvider: levelPrivateStateProvider<string, PrivateState>({
      privateStateStoreName: "verihealth-private-state",
      signingKeyStoreName: "verihealth-signing-keys",
      privateStoragePasswordProvider: () => storagePassword,
      accountId: session.address,
    }),
    publicDataProvider: indexerPublicDataProvider(
      session.config.indexerUri,
      session.config.indexerWsUri,
    ),
    zkConfigProvider,
    // Resolved once at connect time (connector.resolveProofServer): the local
    // proof server when it answers, else the wallet's. Read from the session
    // so this can never disagree with what /deploy showed the user.
    proofProvider: httpClientProofProvider(
      session.proofServerUri,
      zkConfigProvider,
    ),
    walletProvider: browserWalletProvider(session),
    midnightProvider: browserWalletProvider(session),
  };
}

// One instance satisfies both WalletProvider and MidnightProvider, exactly as
// on the Node side; memoised per session so the two entries above are the same
// object rather than two wrappers around one extension.
const providerCache = new WeakMap<ConnectedAPI, BrowserWalletProvider>();

function browserWalletProvider(session: WalletSession): BrowserWalletProvider {
  const cached = providerCache.get(session.api);
  if (cached) return cached;
  const created = new BrowserWalletProvider(
    session.api,
    session.shieldedCoinPublicKey as never,
    session.shieldedEncryptionPublicKey as never,
  );
  providerCache.set(session.api, created);
  return created;
}

/**
 * FetchZkConfigProvider requires an ABSOLUTE base URL.
 *
 * Its constructor runs `new URL(baseURL)` with no second argument, so a
 * site-relative value like the default "/zk" throws:
 *
 *   Failed to construct 'URL': Invalid URL
 *
 * which surfaces at deploy time as an opaque failure with nothing pointing at
 * the ZK assets. "/zk" is still the right thing to put in the env var — it is
 * where `pnpm zk:assets` writes, and it keeps the config portable across
 * localhost, preview URLs and production — so resolve it against the current
 * origin here instead of forcing operators to hardcode a host.
 *
 * An already-absolute value (an object-storage/CDN origin) is passed through.
 */
export function absoluteZkBase(base: string): string {
  if (/^https?:\/\//i.test(base)) return base;
  if (typeof window === "undefined") return base;
  return new URL(base, window.location.origin).toString();
}

