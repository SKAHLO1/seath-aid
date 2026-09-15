// SPDX-License-Identifier: Apache-2.0
//
// WalletProvider + MidnightProvider backed by the browser wallet.
//
// This is the browser counterpart to lib/midnight/node/wallet-provider.ts, and
// the crucial difference is that NO signing key ever exists in this process.
// Balancing and submission are delegated to the wallet extension; we only hand
// it serialized transactions.
//
// midnight-js speaks in ledger objects (UnboundTransaction / FinalizedTransaction)
// while the connector speaks in hex strings, so this class is mostly a
// serialization boundary:
//
//   balanceTx: UnboundTransaction --serialize--> hex
//              -> wallet.balanceUnsealedTransaction
//              -> hex --deserialize--> FinalizedTransaction
//
// The marker arguments passed to Transaction.deserialize describe the type of
// the transaction coming back: signature-enabled, proven, and bound. That
// matches what the connector documents balanceUnsealedTransaction as returning.

import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import {
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
  Transaction,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error("Wallet returned a hex string of odd length.");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export class BrowserWalletProvider implements WalletProvider, MidnightProvider {
  constructor(
    private readonly api: ConnectedAPI,
    private readonly coinPublicKey: CoinPublicKey,
    private readonly encryptionPublicKey: EncPublicKey,
  ) {}

  getCoinPublicKey(): CoinPublicKey {
    return this.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.encryptionPublicKey;
  }

  /**
   * Hands the unbound transaction to the wallet, which pays the fee and adds
   * whatever inputs and outputs are needed to balance it.
   *
   * `ttl` is accepted to satisfy WalletProvider but is not forwarded: the 4.x
   * connector does not expose a TTL parameter, so the wallet applies its own.
   */
  async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
    const { tx: balanced } = await this.api.balanceUnsealedTransaction(
      toHex(tx.serialize()),
    );
    return Transaction.deserialize(
      "signature",
      "proof",
      "binding",
      fromHex(balanced),
    ) as FinalizedTransaction;
  }

  /**
   * Submits via the wallet as relayer and returns a transaction IDENTIFIER.
   *
   * It must be an identifier, NOT the transaction hash. A Midnight transaction
   * has one hash and one-or-more identifiers (`tx.transactionHash()` vs
   * `tx.identifiers()`, ledger-v8.d.ts:2404/2410), and MidnightProvider.submitTx
   * is typed `Promise<TransactionId>`. midnight-js then blocks on
   * `publicDataProvider.watchForTxData(txId)`, which polls the indexer for
   * `transactions(offset: { identifier: txId })` and, per its own docs, "waits
   * indefinitely". Returning the hash here meant that query could never match:
   * the transaction landed on chain, but deployContract never resolved, the UI
   * spun forever, and a retry deployed a second contract (preprod, 2026-09-15:
   * contract 472d2b5a… in tx 8ac4798e…, plus one more).
   *
   * The Node path gets this right for free — WalletFacade.submitTransaction
   * already returns an identifier.
   */
  async submitTx(tx: FinalizedTransaction): Promise<string> {
    const identifiers = tx.identifiers();
    const txHash = tx.transactionHash();
    if (identifiers.length === 0) {
      // Would hang forever in watchForTxData; refuse before submitting.
      throw new Error(
        "Transaction has no identifiers, so its confirmation cannot be tracked. " +
          "Not submitting.",
      );
    }

    await this.api.submitTransaction(toHex(tx.serialize()));

    // Announce the submission immediately, before the (possibly long) wait for
    // indexer confirmation, so the UI can show a tx link and refuse to let the
    // same deploy be sent twice. Browser-only; a no-op anywhere else.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(TX_SUBMITTED_EVENT, {
          detail: { txHash, identifiers, submittedAt: Date.now() },
        }),
      );
    }

    return identifiers[0];
  }
}

/** Fired on window right after a transaction is handed to the wallet. */
export const TX_SUBMITTED_EVENT = "verihealth:tx-submitted";

export type TxSubmittedDetail = {
  readonly txHash: string;
  readonly identifiers: string[];
  readonly submittedAt: number;
};
