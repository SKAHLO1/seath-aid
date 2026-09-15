// SPDX-License-Identifier: Apache-2.0
//
// Which contract, on which network, the browser should talk to.
//
// The deploy script writes deployments/<network>.json. That file is committed,
// but the browser cannot read it directly: importing it would make the build
// fail on a clean checkout that has never deployed. So the address travels as
// a NEXT_PUBLIC_ env var, which is also what Vercel wants, and the JSON file
// stays the human-readable record of what was deployed.
//
// When no address is configured the app stays in local demo mode, which is the
// Wave 1 behaviour: real compiled circuits, in-memory ledger, no wallet needed.

import { type MidnightNetwork, isMidnightNetwork } from "./network";

/**
 * Everything needed to talk to a network EXCEPT which contract.
 *
 * Deploying is the one operation that has no contract address yet — it is
 * about to create one — so it takes this narrower type. Providers only ever
 * read zkConfigBase from here; the indexer and proof-server URIs come from the
 * connected wallet itself.
 */
export type DeployTarget = {
  readonly network: MidnightNetwork;
  /** Base URL serving keys/ and zkir/. See scripts/copy-zk-assets.mjs. */
  readonly zkConfigBase: string;
};

export type OnChainConfig = DeployTarget & {
  readonly contractAddress: string;
};

/**
 * Resolves on-chain configuration, or null when the app should run locally.
 *
 * Returns null rather than throwing on a missing address: an unconfigured
 * deployment is the normal demo case, not an error. A *malformed* network id
 * does throw, because that is a typo the operator needs to see.
 */
export function resolveOnChainConfig(): OnChainConfig | null {
  const address = process.env.NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS;
  if (!address) return null;

  const name = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? "preprod";
  if (!isMidnightNetwork(name)) {
    throw new Error(
      `NEXT_PUBLIC_MIDNIGHT_NETWORK "${name}" is not a Midnight network.`,
    );
  }

  return {
    network: name,
    contractAddress: address,
    zkConfigBase: process.env.NEXT_PUBLIC_ZK_CONFIG_BASE ?? "/zk",
  };
}

export function isOnChainConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS);
}

/**
 * Resolves the network to deploy TO, without requiring a contract address.
 *
 * Unlike resolveOnChainConfig() this never returns null: deploying is an
 * explicit operator action, so a missing address is expected rather than a
 * signal to fall back to demo mode.
 */
export function resolveDeployTarget(): DeployTarget {
  const name = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? "preprod";
  if (!isMidnightNetwork(name)) {
    throw new Error(
      `NEXT_PUBLIC_MIDNIGHT_NETWORK "${name}" is not a Midnight network.`,
    );
  }

  return {
    network: name,
    zkConfigBase: process.env.NEXT_PUBLIC_ZK_CONFIG_BASE ?? "/zk",
  };
}
