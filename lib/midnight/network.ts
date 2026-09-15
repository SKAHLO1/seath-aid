// SPDX-License-Identifier: Apache-2.0
//
// Midnight network endpoints.
//
// The single most common deployment failure is mixing values across networks —
// a `preprod` network id pointed at a `preview` indexer, for example. Every
// endpoint therefore lives in exactly one record per network, keyed by the same
// id that gets handed to setNetworkId(). Nothing here may be overridden
// piecemeal; you pick a network and take all of it.
//
// The proof server is deliberately local on every network including mainnet:
// it sees your private witness data, so it must never be a shared host.
//
// Source: https://docs.midnight.network/guides/networks-and-environments

export type MidnightNetwork = "undeployed" | "preview" | "preprod" | "mainnet";

export type NetworkEndpoints = {
  /** Value passed to setNetworkId(). */
  readonly networkId: MidnightNetwork;
  /** Indexer GraphQL over HTTP. */
  readonly indexer: string;
  /** Indexer GraphQL over WebSocket. */
  readonly indexerWS: string;
  /** Node JSON-RPC over HTTP. */
  readonly node: string;
  /** Node JSON-RPC over WebSocket. */
  readonly nodeWS: string;
  /** Always local. See note above. */
  readonly proofServer: string;
  /** tNIGHT faucet, where one exists. */
  readonly faucet: string | undefined;
};

const PROOF_SERVER = process.env.MIDNIGHT_PROOF_SERVER ?? "http://localhost:6300";

export const NETWORKS: Record<MidnightNetwork, NetworkEndpoints> = {
  undeployed: {
    networkId: "undeployed",
    indexer: "http://localhost:8088/api/v4/graphql",
    indexerWS: "ws://localhost:8088/api/v4/graphql/ws",
    node: "http://localhost:9944",
    nodeWS: "ws://localhost:9944",
    proofServer: PROOF_SERVER,
    faucet: undefined,
  },
  preview: {
    networkId: "preview",
    indexer: "https://indexer.preview.midnight.network/api/v4/graphql",
    indexerWS: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
    node: "https://rpc.preview.midnight.network",
    nodeWS: "wss://rpc.preview.midnight.network",
    proofServer: PROOF_SERVER,
    faucet: "https://midnight-tmnight-preview.nethermind.dev/",
  },
  preprod: {
    networkId: "preprod",
    indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
    indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
    node: "https://rpc.preprod.midnight.network",
    nodeWS: "wss://rpc.preprod.midnight.network",
    proofServer: PROOF_SERVER,
    faucet: "https://midnight-tmnight-preprod.nethermind.dev/",
  },
  mainnet: {
    networkId: "mainnet",
    indexer: "https://indexer.mainnet.midnight.network/api/v4/graphql",
    indexerWS: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
    node: "https://rpc.mainnet.midnight.network",
    nodeWS: "wss://rpc.mainnet.midnight.network",
    proofServer: PROOF_SERVER,
    faucet: undefined,
  },
};

export function isMidnightNetwork(value: string): value is MidnightNetwork {
  return value in NETWORKS;
}

/**
 * Resolves the target network from MIDNIGHT_NETWORK, defaulting to preprod.
 *
 * Throws on an unknown name rather than silently falling back — a typo that
 * quietly deploys to the wrong chain is worse than a failed script.
 */
export function resolveNetwork(
  name: string | undefined = process.env.MIDNIGHT_NETWORK,
): NetworkEndpoints {
  const target = name ?? "preprod";
  if (!isMidnightNetwork(target)) {
    throw new Error(
      `Unknown MIDNIGHT_NETWORK "${target}". Expected one of: ${Object.keys(NETWORKS).join(", ")}`,
    );
  }
  return NETWORKS[target];
}
