// SPDX-License-Identifier: Apache-2.0
//
// Midnight DApp connector, against @midnight-ntwrk/dapp-connector-api 4.0.1.
//
// Wallets inject an InitialAPI per wallet under window.midnight, keyed by an
// arbitrary id. The 4.x flow is:
//
//   window.midnight[id]        -> InitialAPI  { rdns, name, icon, apiVersion }
//   InitialAPI.connect(netId)  -> ConnectedAPI
//   ConnectedAPI.getConfiguration() -> indexer / node / (deprecated) prover URIs
//
// Note this is NOT the older `enable()` + `state()` shape. A wallet speaking
// only the old spec will not satisfy this interface, which is deliberate: we
// would rather fail at connect time with a clear message than half-work.
//
// The wallet supplies identity, balancing, proving and submission. The holder's
// medical data never passes through it: witnesses stay in the private state
// store and are never included in a signing request.

import type {
  ConnectedAPI,
  Configuration,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import type { MidnightNetwork } from "../network";

export class WalletNotInstalledError extends Error {
  constructor() {
    super("No Midnight wallet was detected in this browser.");
    this.name = "WalletNotInstalledError";
  }
}

export class WalletNetworkMismatchError extends Error {
  constructor(wanted: string, got: string) {
    super(`Wallet is connected to "${got}" but this app expects "${wanted}".`);
    this.name = "WalletNetworkMismatchError";
  }
}

/** Every wallet currently injected, in discovery order. */
export function listWallets(): InitialAPI[] {
  if (typeof window === "undefined" || !window.midnight) return [];
  return Object.values(window.midnight).filter(
    (api): api is InitialAPI => typeof api?.connect === "function",
  );
}

/** rdns the 1AM extension registers under `window.midnight["1am"]`. */
export const ONE_AM_RDNS = "com.midnight.1am";

/**
 * Wallet preference when the caller does not pick one explicitly, highest
 * first. NEXT_PUBLIC_PREFERRED_WALLET_RDNS overrides the whole order.
 *
 * 1AM comes before Lace. Verified against the installed 1AM 6.3.11 extension
 * (content-scripts/injected.js): it defines `window.midnight["1am"]` as
 * `{ rdns: "com.midnight.1am", name: "1AM", apiVersion: "4.0.0", connect }`
 * and its ConnectedAPI implements balanceUnsealedTransaction,
 * submitTransaction, getConfiguration, getProvingProvider and hintUsage — the
 * same 4.x connector shape this module targets. (It ALSO injects a Cardano
 * CIP-30 provider with `apiVersion: "1"` and `enable()`; that one is unrelated
 * and is not picked up here, because listWallets() only reads window.midnight.)
 *
 * Lace is demoted because its DUST registration and connection handshake have
 * been unreliable in practice on preprod.
 */
const PREFERRED_WALLETS: readonly ((w: InitialAPI) => boolean)[] = [
  (w) => w.rdns === ONE_AM_RDNS,
  (w) => w.rdns?.toLowerCase().includes("lace") ?? false,
];

/**
 * Picks a wallet to connect to.
 *
 * Order: explicit `rdns` argument, then NEXT_PUBLIC_PREFERRED_WALLET_RDNS, then
 * 1AM, then Lace, then whatever was injected first — so the app is never
 * hard-wired to a single vendor, and installing a second wallet is never
 * silently defeated by a hardcoded default.
 */
export function pickWallet(rdns?: string): InitialAPI | undefined {
  const wallets = listWallets();

  const requested = rdns || process.env.NEXT_PUBLIC_PREFERRED_WALLET_RDNS;
  if (requested) {
    const exact = wallets.find((w) => w.rdns === requested);
    if (exact) return exact;
  }

  for (const matches of PREFERRED_WALLETS) {
    const found = wallets.find(matches);
    if (found) return found;
  }
  return wallets[0];
}

/** Injected wallets, as plain data for a picker UI. */
export function availableWallets(): { rdns: string; name: string }[] {
  return listWallets().map((w, i) => ({
    rdns: w.rdns ?? `wallet-${i}`,
    name: w.name ?? w.rdns ?? `Wallet ${i + 1}`,
  }));
}

export function isWalletAvailable(): boolean {
  return pickWallet() !== undefined;
}

/** Documented default for a locally run proof server. */
export const LOCAL_PROOF_SERVER = "http://localhost:6300";

/**
 * Is a proof server answering at `uri`?
 *
 * Uses no-cors: proof servers send no CORS headers, so an ordinary fetch is
 * blocked even when the server is healthy. An opaque response still proves
 * something answered on that port; only a thrown error means nothing did.
 */
export async function proofServerReachable(uri: string): Promise<boolean> {
  try {
    await fetch(`${uri.replace(/\/$/, "")}/health`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Chooses the proof server: the LOCAL one whenever it answers, otherwise the
 * one the wallet reports, otherwise the local default.
 *
 * Why local wins, even over the wallet's own setting:
 *
 * 1. Privacy. A proof server sees circuit witnesses in the clear. For
 *    VeriHealth those are vaccine codes, dates and exact lab values; sending
 *    them to someone else's server breaks the product's core promise.
 * 2. Compatibility. Wallets default to hosted servers we cannot version-check.
 *    Verified 2026-09-14: 1AM 6.3.11 reports `https://api-preprod.1am.xyz` for
 *    preprod — a combined 1AM API (bridge, chain data, POST /prove,
 *    /prove-and-balance) with no GET /version, so there is no way to confirm it
 *    matches the proof-server 8.1.0 this SDK is pinned to. Lace reports
 *    `https://proof-server.preprod.midnight.network` (8.1.0). A local
 *    midnightntwrk/proof-server:8.1.0 is known-good.
 *
 * `proverServerUri` is also @deprecated in dapp-connector-api 4.0.1 and "likely
 * to not be present", so it cannot be the primary source anyway.
 */
export async function resolveProofServer(
  config: Configuration,
): Promise<{ uri: string; local: boolean }> {
  if (await proofServerReachable(LOCAL_PROOF_SERVER)) {
    return { uri: LOCAL_PROOF_SERVER, local: true };
  }
  const reported = config.proverServerUri;
  if (reported) {
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(reported);
    return { uri: reported, local };
  }
  return { uri: LOCAL_PROOF_SERVER, local: true };
}

export type WalletSession = {
  readonly api: ConnectedAPI;
  readonly config: Configuration;
  /**
   * Proof server chosen at connect time by resolveProofServer(). Fixed for the
   * session so the page and the providers can never disagree about it.
   */
  readonly proofServerUri: string;
  /** False when proofs (and their witnesses) would leave this machine. */
  readonly proofServerIsLocal: boolean;
  /** Bech32m unshielded address. */
  readonly address: string;
  readonly shieldedCoinPublicKey: string;
  readonly shieldedEncryptionPublicKey: string;
  readonly walletName: string;
};

/**
 * The wallet extension answered, then stopped answering.
 *
 * Lace injects an object backed by an extension messaging channel. If the
 * extension reloads, updates, or is disabled while the page holds a reference,
 * that channel dies and the object becomes a corpse — Lace reports this as:
 *
 *   Remote API with channel 'feature-flags' was shutdown: object can no
 *   longer be used
 *
 * The nasty part is that `connect()` on a dead object may simply NEVER SETTLE,
 * so an unguarded `await` hangs the UI forever with no error at all.
 */
export class WalletChannelDeadError extends Error {
  constructor(cause?: unknown) {
    super(
      "The wallet extension stopped responding. Its injected connection was " +
        "shut down — usually because the extension reloaded or updated while " +
        "this page was open. Reload the page (and unlock the wallet) and try " +
        "again.",
    );
    this.name = "WalletChannelDeadError";
    this.cause = cause;
  }
}

/** How long to wait on any single wallet call before giving up. */
const WALLET_CALL_TIMEOUT_MS = 30_000;

/**
 * Rejects rather than hanging.
 *
 * Every call into the injected wallet object goes through this. A dead channel
 * produces a promise that never settles, and without a timeout the only symptom
 * is a button stuck on "Connecting…" — no error, nothing in the console,
 * nothing to act on.
 */
async function walletCall<T>(what: string, op: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        try {
          return await op();
        } catch (e) {
          // Lace surfaces the dead channel as a plain Error; translate it.
          const msg = e instanceof Error ? e.message : String(e);
          if (/shutdown|no longer be used|disconnected|Extension context/i.test(msg)) {
            throw new WalletChannelDeadError(e);
          }
          throw e;
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Wallet did not respond to ${what} within ` +
                  `${WALLET_CALL_TIMEOUT_MS / 1000}s. If no wallet popup appeared, ` +
                  "its connection is probably dead: reload this page, make sure " +
                  "the wallet is unlocked, and try again.",
              ),
            ),
          WALLET_CALL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Connects, then verifies the wallet is actually on the network we expect.
 *
 * The network check matters: a wallet left on preview will happily connect and
 * then produce transactions the preprod indexer never sees, which is a
 * miserable failure to debug from the UI.
 */
export async function connectWallet(
  network: MidnightNetwork,
  rdns?: string,
): Promise<WalletSession> {
  const wallet = pickWallet(rdns);
  if (!wallet) throw new WalletNotInstalledError();

  // midnight-js keeps the network id in module-level global state, and throws
  // "Network ID has not been configured" from deep inside address/transaction
  // handling if it was never set. scripts/deploy.mts and scripts/address.mts
  // each call this at startup; the browser path had no equivalent entry point,
  // so it must happen here — before ANY wallet or contract operation.
  //
  // Safe to call on every connect: it is an idempotent setter, and connecting
  // is the earliest moment the browser knows which network it is targeting.
  setNetworkId(network);

  const api = await walletCall("connect", () => wallet.connect(network));
  const config = await walletCall("getConfiguration", () =>
    api.getConfiguration(),
  );

  if (config.networkId !== network) {
    throw new WalletNetworkMismatchError(network, config.networkId);
  }

  // Ask up front for everything the DApp will need, so the wallet can gather
  // permissions in one prompt rather than interrupting mid-flow.
  //
  // OPTIONAL, and deliberately non-fatal. hintUsage is declared in
  // dapp-connector-api 4.0.1 (api.d.ts:197) but shipping Lace builds do not all
  // implement it yet — calling it unguarded throws
  // "api.hintUsage is not a function" and kills the whole connection. It is
  // only a prompt-batching optimisation, so a wallet without it works fine,
  // just with more prompts.
  if (typeof api.hintUsage === "function") {
    try {
      await api.hintUsage([
        "getUnshieldedAddress",
        "getShieldedAddresses",
        "getDustBalance",
        "balanceUnsealedTransaction",
        "submitTransaction",
        "getProvingProvider",
      ]);
    } catch {
      // A wallet may also reject the hint outright. Not worth failing over.
    }
  }

  const [{ unshieldedAddress }, shielded] = await Promise.all([
    walletCall("getUnshieldedAddress", () => api.getUnshieldedAddress()),
    walletCall("getShieldedAddresses", () => api.getShieldedAddresses()),
  ]);

  const proofServer = await resolveProofServer(config);

  return {
    api,
    config,
    proofServerUri: proofServer.uri,
    proofServerIsLocal: proofServer.local,
    address: unshieldedAddress,
    shieldedCoinPublicKey: shielded.shieldedCoinPublicKey,
    shieldedEncryptionPublicKey: shielded.shieldedEncryptionPublicKey,
    walletName: wallet.name,
  };
}

/**
 * Spendable DUST plus the generation CAP.
 *
 * The cap is the diagnostic that matters and the earlier version of this
 * function threw it away. A zero BALANCE is ambiguous — it means either
 * "NIGHT was never registered" or "registered and still accruing" — and those
 * need opposite responses. The cap disambiguates:
 *
 *   cap == 0                 NIGHT is NOT registered for DUST generation.
 *                            Registration is missing; waiting will not help.
 *   cap  > 0, balance == 0   Registered. DUST is accruing. Just wait.
 *   balance > 0              Ready to pay fees.
 *
 * This matters when the Lace "Generate tDUST" UI errors: registration may
 * actually have gone through, and a non-zero cap proves it.
 */
export async function dustBalance(
  api: ConnectedAPI,
): Promise<{ balance: bigint; cap: bigint }> {
  const { balance, cap } = await api.getDustBalance();
  return { balance, cap };
}

/**
 * Which ConnectedAPI methods the connected wallet actually implements.
 *
 * The dapp-connector-api spec runs ahead of shipping Lace builds, so a method
 * being declared in the .d.ts is no guarantee it exists at runtime. When a
 * connection fails with "x is not a function", call this to see what the wallet
 * really offers rather than guessing.
 */
export function availableApiMethods(api: ConnectedAPI): string[] {
  const wanted = [
    "getUnshieldedAddress",
    "getShieldedAddresses",
    "getDustBalance",
    "getUnshieldedBalances",
    "balanceUnsealedTransaction",
    "submitTransaction",
    "getProvingProvider",
    "getConfiguration",
    "hintUsage",
  ];
  const rec = api as unknown as Record<string, unknown>;
  return wanted.filter((m) => typeof rec[m] === "function");
}

/**
 * Unshielded (NIGHT) balances by token type, or null if the wallet lacks the
 * method.
 *
 * Distinguishes the two very different states that both show DUST = 0:
 *   NIGHT == 0 -> the address was never funded; go to the faucet
 *   NIGHT  > 0 -> funded but never REGISTERED for DUST generation
 * Without this the UI can only say "no DUST", which does not tell you which
 * half of the problem you have.
 */
export async function unshieldedBalances(
  api: ConnectedAPI,
): Promise<Record<string, bigint> | null> {
  const rec = api as unknown as Record<string, unknown>;
  if (typeof rec.getUnshieldedBalances !== "function") return null;
  try {
    return await api.getUnshieldedBalances();
  } catch {
    return null;
  }
}

/** Total across every unshielded token type. Zero means "not funded". */
export function totalUnshielded(
  balances: Record<string, bigint> | null,
): bigint | null {
  if (!balances) return null;
  return Object.values(balances).reduce((a, b) => a + b, BigInt(0));
}
