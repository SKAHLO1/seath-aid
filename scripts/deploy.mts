// SPDX-License-Identifier: Apache-2.0
//
// Deploys the VeriHealth contract to a Midnight network.
//
//   pnpm deploy:contract                     # preprod (default)
//   MIDNIGHT_NETWORK=preview pnpm deploy:contract
//
// Requires, in order:
//   1. A local proof server on :6300
//        docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0 \
//          midnight-proof-server -v
//   2. A funded seed in MIDNIGHT_WALLET_SEED_FILE, registered for DUST
//   3. Contract artifacts built by a COMPATIBLE toolchain — see the version
//      check below, which refuses to run rather than emit a broken deployment
//
// On success the contract address is written to deployments/<network>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { WebSocket } from "ws";

import contractInfo from "@/contracts/src/managed/verihealth/compiler/contract-info.json";
import { resolveNetwork } from "@/lib/midnight/network";
import {
  buildProviders,
  compiledContract,
  deployContract,
} from "@/lib/midnight/node/providers";
import { buildWallet, readSeed } from "@/lib/midnight/node/wallet-provider";
import {
  emptyPrivateState,
  PRIVATE_STATE_ID,
  VERIHEALTH_CIRCUIT_IDS,
} from "@/lib/midnight/private-state";

// The SDK opens a WebSocket to the indexer; Node needs one installed globally.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

/**
 * Versions every live network runs, from the compatibility matrix.
 * https://docs.midnight.network/relnotes/support-matrix
 */
const REQUIRED_RUNTIME_VERSION = "0.16.0";

/**
 * Refuses to deploy artifacts built against a runtime the network cannot
 * execute.
 *
 * This repo was compiled with Compact 0.34.0 / runtime 0.19.0, which binds
 * onchain-runtime v4. Every deployed network — preview, preprod and mainnet —
 * runs onchain-runtime v3 via runtime 0.16.0. Deploying anyway wastes tNIGHT
 * and fails with an opaque ledger error, so the check is fatal.
 */
function assertCompatibleArtifacts(): void {
  const actual = contractInfo["runtime-version"];
  if (actual === REQUIRED_RUNTIME_VERSION) return;

  throw new Error(
    [
      `Contract artifacts target compact-runtime ${actual}, but every live`,
      `Midnight network runs ${REQUIRED_RUNTIME_VERSION}.`,
      "",
      "These artifacts cannot be deployed. To fix:",
      `  1. compact update 0.31.1`,
      `  2. pin @midnight-ntwrk/compact-runtime to exactly ${REQUIRED_RUNTIME_VERSION}`,
      "     in package.json AND contracts/package.json (no ^ or ~)",
      "  3. pnpm install && pnpm compact",
      "",
      "Set MIDNIGHT_SKIP_VERSION_CHECK=1 to override (it will not work).",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const env = resolveNetwork();

  if (!process.env.MIDNIGHT_SKIP_VERSION_CHECK) {
    assertCompatibleArtifacts();
  }

  setNetworkId(env.networkId);
  console.log(`network      ${env.networkId}`);
  console.log(`indexer      ${env.indexer}`);
  console.log(`node         ${env.node}`);
  console.log(`proof server ${env.proofServer}`);
  console.log(`circuits     ${VERIHEALTH_CIRCUIT_IDS.join(", ")}`);
  console.log();

  const storagePassword = process.env.MIDNIGHT_PRIVATE_STATE_PASSWORD;
  if (!storagePassword || storagePassword.length < 16) {
    throw new Error(
      "MIDNIGHT_PRIVATE_STATE_PASSWORD must be set and at least 16 characters.",
    );
  }

  console.log("syncing wallet (this can take several minutes on a cold seed)…");
  const { provider, summary } = await buildWallet(env, readSeed());

  console.log(`address      ${summary.address}`);
  console.log(`dust         ${summary.dust}`);
  for (const [token, amount] of Object.entries(summary.balances)) {
    console.log(`balance      ${amount}  ${token}`);
  }
  console.log();

  if (summary.dust === 0n) {
    await provider.stop();
    throw new Error(
      [
        "Wallet has no spendable DUST, so it cannot pay transaction fees.",
        "",
        `  1. Fund the address above with tNIGHT: ${env.faucet ?? "(no faucet on this network)"}`,
        "  2. Register that NIGHT for DUST generation. Holding NIGHT alone",
        "     generates nothing — registration is what starts it.",
        "",
        "     Via Lace: import this deploy wallet into Lace, then choose",
        "     'Generate tDUST'. NOTE the seed here is a 64-char hex string and",
        "     Lace's import expects a 24-word mnemonic; wallet-sdk-hd exports no",
        "     hex->mnemonic conversion, so this import may not be possible.",
        "",
        "     If Lace will not take it, register from this script instead:",
        "     wallet-sdk-facade exposes registerNightUtxosForDustGeneration(),",
        "     which returns an UnprovenTransactionRecipe still needing proving",
        "     and submission.",
        "",
        "  3. Wait for the DUST tank to accrue, then re-run.",
      ].join("\n"),
    );
  }

  const providers = buildProviders({
    env,
    wallet: provider,
    accountId: summary.address,
    storagePassword,
  });

  console.log("deploying…");
  const deployed = await deployContract(providers, {
    compiledContract: compiledContract(),
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: emptyPrivateState(),
  } as never);

  const address = deployed.deployTxData.public.contractAddress;
  const txId = deployed.deployTxData.public.txId;

  const outDir = resolve(process.cwd(), "deployments");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, `${env.networkId}.json`);
  writeFileSync(
    outFile,
    `${JSON.stringify(
      {
        network: env.networkId,
        contractAddress: address,
        deployTxId: txId,
        deployedAt: new Date().toISOString(),
        compilerVersion: contractInfo["compiler-version"],
        runtimeVersion: contractInfo["runtime-version"],
      },
      null,
      2,
    )}\n`,
  );

  console.log();
  console.log(`contract     ${address}`);
  console.log(`tx           ${txId}`);
  console.log(`written to   ${outFile}`);

  await provider.stop();
}

main().catch((error: unknown) => {
  console.error(`\ndeploy failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
