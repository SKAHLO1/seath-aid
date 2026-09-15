// SPDX-License-Identifier: Apache-2.0
//
// Generates a deploy wallet as a 24-word BIP-39 mnemonic, then derives the seed
// the deploy script consumes.
//
//   node scripts/new-deploy-wallet.mjs
//
// WHY MNEMONIC-FIRST, and why the seed is 128 hex chars, not 64:
//
// Lace derives its seed from a mnemonic with the standard BIP-39
// `mnemonicToSeed` step (PBKDF2-HMAC-SHA512, 2048 rounds, empty passphrase),
// which yields 64 bytes = 128 hex chars. testkit-js does exactly the same in
// WalletSeeds.fromMnemonic():
//
//     const seed = Buffer.from(mnemonicToSeedSync(mnemonic)).toString('hex');
//     return WalletSeeds.fromMasterSeed(seed);
//
// so `withMnemonic(words)` and `withSeed(mnemonicToSeedSync(words))` are the
// same wallet, and the same words restore that wallet in Lace.
//
// The trap: HDWallet.fromSeed() accepts ANY 16-64 byte seed, so a raw 32-byte
// random seed (the old `openssl rand -hex 32` recipe) is perfectly valid — it
// just has NO mnemonic and can never be imported into Lace. And converting
// such a seed with bip39.entropyToMnemonic() "works" but derives a DIFFERENT
// wallet, silently. Midnight's own create-mn-app template warns about this by
// name. Generating mnemonic-first is the only way to get both.

import { existsSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

import {
  generateMnemonicWords,
  joinMnemonicWords,
  validateMnemonic,
} from "@midnight-ntwrk/wallet-sdk-hd";
import { mnemonicToSeedSync } from "@scure/bip39";

const MNEMONIC_PATH = ".secrets/deployer.mnemonic";
const SEED_PATH = ".secrets/deployer.seed";

if (!process.env.FORCE_OVERWRITE) {
  for (const p of [MNEMONIC_PATH, SEED_PATH]) {
    if (existsSync(p)) {
      console.error(
        `refusing to overwrite existing ${p}\n` +
          `If this wallet holds funds you will LOSE them. To replace it anyway:\n` +
          `  FORCE_OVERWRITE=1 node scripts/new-deploy-wallet.mjs`,
      );
      process.exit(1);
    }
  }
}

await mkdir(".secrets", { recursive: true });

// 256 bits of entropy -> 24 words.
const mnemonic = joinMnemonicWords(generateMnemonicWords());
if (!validateMnemonic(mnemonic)) {
  throw new Error("generated mnemonic failed BIP-39 validation");
}

const seedHex = Buffer.from(mnemonicToSeedSync(mnemonic)).toString("hex");
if (seedHex.length !== 128) {
  throw new Error(
    `expected a 128-hex (64-byte) BIP-39 seed, got ${seedHex.length} chars`,
  );
}

writeFileSync(MNEMONIC_PATH, mnemonic + "\n", { mode: 0o600 });
writeFileSync(SEED_PATH, seedHex + "\n", { mode: 0o600 });

// Neither secret is printed. Read the words with:
//   cat .secrets/deployer.mnemonic
console.log(`words            ${mnemonic.split(" ").length}`);
console.log(`seed             ${seedHex.length} hex chars (${seedHex.length / 2} bytes)`);
console.log(`wrote            ${MNEMONIC_PATH}`);
console.log(`wrote            ${SEED_PATH}`);
console.log();
console.log("Both are gitignored and were NOT printed. To see the 24 words:");
console.log(`  cat ${MNEMONIC_PATH}`);
console.log("Import those words into Lace to control the SAME wallet the");
console.log("deploy script uses, then use Lace's 'Generate tDUST'.");
