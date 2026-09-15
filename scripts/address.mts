// SPDX-License-Identifier: Apache-2.0
//
// Prints the deployer wallet's unshielded (NIGHT) address without syncing.
//
//   pnpm deploy:address
//
// Use this to get the address to fund at the faucet. A full sync is not
// required to know your own address, and is currently broken on preprod
// (midnightntwrk/midnight-wallet#704 — unbounded heap growth replaying chain
// history, no checkpoint option to skip it).

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { WebSocket } from "ws";

import { resolveNetwork } from "@/lib/midnight/network";
import { deployerAddress, readSeed } from "@/lib/midnight/node/wallet-provider";

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const env = resolveNetwork();
setNetworkId(env.networkId);

const address = await deployerAddress(env, readSeed());

console.log();
console.log(`network   ${env.networkId}`);
console.log(`address   ${address}`);
console.log();
console.log(`Fund it:  ${env.faucet ?? "(no faucet on this network)"}`);
console.log();
console.log("Then register that NIGHT for DUST generation — import the 24");
console.log("words in .secrets/deployer.mnemonic into Lace and use");
console.log("'Generate tDUST'. Holding NIGHT alone generates nothing.");

// The facade opens indexer/node connections on construction even though we
// never started syncing, so nothing closes them. Exit explicitly.
process.exit(0);
