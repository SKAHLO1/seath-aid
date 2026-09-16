// SPDX-License-Identifier: Apache-2.0
//
// Reads the PUBLIC ledger state of the deployed contract straight off the
// indexer, and prints what it contains.
//
//   pnpm contract:state                     # uses NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS
//   pnpm contract:state <contractAddress>
//
// Read-only: no wallet, no DUST, no transaction. It answers the question the
// on-chain wiring depends on — whether the contract has any registered issuers
// or credentials yet, or is still empty as deployed.

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { WebSocket } from "ws";

import { ledger } from "@/contracts/src/managed/verihealth/contract/index.js";
import { resolveNetwork } from "@/lib/midnight/network";

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const env = resolveNetwork(process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK);
setNetworkId(env.networkId);

const address =
  process.argv[2] ?? process.env.NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS ?? "";
if (!address) {
  console.error(
    "No contract address. Pass one, or set NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS.",
  );
  process.exit(2);
}

console.log(`network   ${env.networkId}`);
console.log(`indexer   ${env.indexer}`);
console.log(`contract  ${address}`);

const provider = indexerPublicDataProvider(env.indexer, env.indexerWS);
const state = await provider.queryContractState(address);

if (!state) {
  console.error("\nNo contract state found at that address on this network.");
  process.exit(1);
}

// `ledger()` accepts the contract's state data and exposes the typed public
// ledger — the same view the in-browser runtime renders.
const l = ledger((state as unknown as { data?: unknown }).data ?? state);

console.log();
console.log(`registered issuers   ${l.registeredIssuers.size()}`);
console.log(`revoked credentials  ${l.revocationRegistry.size()}`);
console.log(`spent nullifiers     ${l.usedNullifiers.size()}`);
console.log(`proofs recorded      ${l.proofCount}`);
console.log();

if (Number(l.registeredIssuers.size()) === 0) {
  console.log(
    "The contract is EMPTY as deployed: no issuer has registered, so no\n" +
      "credential can be issued and no proof can be produced against it yet.\n" +
      "Going live means registering issuers and issuing credentials ON CHAIN\n" +
      "first — each is a signed transaction that costs DUST.",
  );
}

process.exit(0);
