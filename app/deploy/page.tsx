// SPDX-License-Identifier: Apache-2.0
//
// Dev-only deploy console.
//
// Deploying from the browser is not a convenience here — on a public testnet it
// is currently the ONLY path that works. deployContract() needs just a
// WalletProvider (public keys + balanceTx) and a MidnightProvider (submitTx);
// it never touches WalletFacade and never syncs chain history. Lace does its
// syncing inside the extension, so this page skips the Node-side wallet sync
// that OOMs on preprod (midnightntwrk/midnight-wallet#704).
//
// Not linked from anywhere in the app. It returns 404 in production.

"use client";

import { useEffect, useState } from "react";

import type { WalletSession } from "@/lib/midnight/browser/connector";
import { getStateKey } from "@/lib/midnight/browser/state-key";
import type { TxSubmittedDetail } from "@/lib/midnight/browser/wallet-provider";
import { resolveDeployTarget } from "@/lib/midnight/deployment";

// The browser provider stack is imported lazily, never at module scope.
//
// levelPrivateStateProvider resolves to `classic-level` — a NODE NATIVE addon —
// when evaluated on the server. Next prerenders even a "use client" page at
// build time, so a static import crashes the build with:
//
//   No native build was found for platform=win32 ... runtime=electron
//
// Deferring to a dynamic import inside the handlers keeps that whole graph out
// of the SSR pass; in the browser `level` resolves to browser-level as intended.
const loadConnector = () => import("@/lib/midnight/browser/connector");
const loadContract = () => import("@/lib/midnight/browser/contract");

type Phase = "idle" | "connecting" | "connected" | "deploying" | "done" | "error";

const ADDRESS_STORAGE_KEY = "verihealth.lastContractAddress";

// Mirrors TX_SUBMITTED_EVENT in lib/midnight/browser/wallet-provider.ts. Kept as
// a literal on purpose: importing that module as a value would pull the ledger
// WASM into this page's server prerender (see the lazy-import note above).
const TX_SUBMITTED_EVENT = "verihealth:tx-submitted";

/**
 * A deploy handed to the wallet but not yet confirmed by this page.
 *
 * Exists because a deploy can be ON CHAIN while the page still looks like it
 * is working or has failed — exactly how two contracts got deployed on
 * 2026-09-15. Persisted, so a reload or closed tab still remembers it, and the
 * Deploy button refuses a second submission until the operator has checked the
 * explorer and explicitly opted in.
 */
const PENDING_DEPLOY_KEY = "verihealth.pendingDeploy";

type PendingDeploy = TxSubmittedDetail & { readonly network: string };

function readPendingDeploy(): PendingDeploy | null {
  try {
    const raw = localStorage.getItem(PENDING_DEPLOY_KEY);
    return raw ? (JSON.parse(raw) as PendingDeploy) : null;
  } catch {
    return null;
  }
}

function writePendingDeploy(pending: PendingDeploy | null) {
  try {
    if (pending) localStorage.setItem(PENDING_DEPLOY_KEY, JSON.stringify(pending));
    else localStorage.removeItem(PENDING_DEPLOY_KEY);
  } catch {
    // Blocked storage: the in-memory guard still applies for this tab.
  }
}

function explorerTxUrl(txHash: string, network: string): string {
  return `https://explorer.1am.xyz/tx/${txHash}?network=${network}`;
}

/** Survives the tab closing. A deploy is expensive; do not lose the address. */
function rememberAddress(addr: string) {
  try {
    localStorage.setItem(ADDRESS_STORAGE_KEY, addr);
  } catch {
    // Private mode / blocked storage. The UI still shows it.
  }
}

function recallAddress(): string | null {
  try {
    return localStorage.getItem(ADDRESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Pulls the contract address out of a deploy result.
 *
 * The documented location is `deployTxData.public.contractAddress` — that
 * `public` is typed as `UnsubmittedDeployTxPublicData & FinalizedTxData`, and
 * the address comes from the first half. But this SDK moves fast, so rather
 * than dereference one path and hand back `undefined`, try the plausible ones
 * and fall back to a recursive search for anything that looks like a contract
 * address (64 hex characters).
 */
function extractContractAddress(result: unknown): string | null {
  const asString = (v: unknown): string | null => {
    if (typeof v === "string" && v.length > 0) return v;
    // ContractAddress may be a branded object rather than a bare string.
    if (v && typeof v === "object" && "toString" in v) {
      const s = String(v);
      if (s && s !== "[object Object]") return s;
    }
    return null;
  };

  const r = result as Record<string, any>;
  const candidates = [
    r?.deployTxData?.public?.contractAddress,
    r?.contractAddress,
    r?.deployTxData?.contractAddress,
    r?.public?.contractAddress,
  ];
  for (const c of candidates) {
    const s = asString(c);
    if (s) return s;
  }

  // Last resort: walk the object for a 64-hex value on a key mentioning
  // "address". Bounded depth so a cyclic SDK object cannot hang the page.
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): string | null => {
    if (!node || typeof node !== "object" || depth > 6 || seen.has(node)) return null;
    seen.add(node);
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (/address/i.test(k)) {
        const s = asString(v);
        if (s && /^[0-9a-f]{64}$/i.test(s)) return s;
      }
      const nested = walk(v, depth + 1);
      if (nested) return nested;
    }
    return null;
  };
  return walk(result, 0);
}

/** JSON.stringify that survives bigints, cycles and WASM objects. */
function safeStringify(value: unknown): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === "bigint") return `${v}n`;
        if (typeof v === "function") return "[function]";
        if (v && typeof v === "object") {
          if (seen.has(v)) return "[circular]";
          seen.add(v);
        }
        return v;
      },
      2,
    );
  } catch (e) {
    return `could not stringify result: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Recovers contract addresses from a PREVIOUS deploy in this browser.
 *
 * deployContract() stores the contract's maintenance signing key in the private
 * state store KEYED BY CONTRACT ADDRESS. That store is browser-level, i.e.
 * IndexedDB, so the addresses of everything ever deployed from this browser are
 * still there even if the address was never written down.
 *
 * The database name is NOT the store name we configured. browser-level prefixes
 * every database with `level-js-` (its DEFAULT_PREFIX) and names the object
 * store after the location, so `signingKeyStoreName: "verihealth-signing-keys"`
 * becomes database `level-js-verihealth-signing-keys` containing object store
 * `verihealth-signing-keys`.
 *
 * So ENUMERATE rather than guess. That also avoids a nasty side effect:
 * `indexedDB.open()` CREATES a database when the name does not exist, so
 * guessing wrong silently manufactures an empty database and then truthfully
 * reports finding nothing in it.
 */
async function recoverAddressesFromStorage(): Promise<{
  addresses: string[];
  scanned: string[];
}> {
  if (typeof indexedDB === "undefined") return { addresses: [], scanned: [] };

  // Firefox does not implement databases(); fall back to the known names.
  let names: string[] = [];
  try {
    if (typeof indexedDB.databases === "function") {
      names = (await indexedDB.databases())
        .map((d) => d.name ?? "")
        .filter(Boolean);
    }
  } catch {
    names = [];
  }
  if (names.length === 0) {
    names = [
      "level-js-verihealth-signing-keys",
      "level-js-verihealth-private-state",
    ];
  }

  // Anything plausibly ours. Broad on purpose: a renamed store still matches.
  const candidates = names.filter((n) => /verihealth|midnight|level-js/i.test(n));

  const openExisting = (name: string) =>
    new Promise<IDBDatabase | null>((resolve) => {
      let created = false;
      const req = indexedDB.open(name);
      // Fires only when the database did not already exist.
      req.onupgradeneeded = () => {
        created = true;
      };
      req.onsuccess = () => {
        if (created) {
          req.result.close();
          indexedDB.deleteDatabase(name); // undo our own side effect
          resolve(null);
          return;
        }
        resolve(req.result);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });

  const found = new Set<string>();
  const scanned: string[] = [];

  for (const name of candidates) {
    const db = await openExisting(name);
    if (!db) continue;
    scanned.push(name);
    try {
      for (const storeName of Array.from(db.objectStoreNames)) {
        const keys = await new Promise<IDBValidKey[]>((resolve) => {
          try {
            const req = db
              .transaction(storeName, "readonly")
              .objectStore(storeName)
              .getAllKeys();
            req.onsuccess = () => resolve(req.result ?? []);
            req.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });
        for (const k of keys) {
          const s = typeof k === "string" ? k : String(k);
          // Keys may be prefixed (sublevels) — pull any 64-hex run out.
          for (const m of s.matchAll(/[0-9a-f]{64}/gi)) found.add(m[0]);
        }
      }
    } finally {
      db.close();
    }
  }
  return { addresses: Array.from(found), scanned };
}

export default function DeployPage() {
  const [available, setAvailable] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<WalletSession | null>(null);
  const [dust, setDust] = useState<bigint | null>(null);
  const [dustCap, setDustCap] = useState<bigint | null>(null);
  const [apiMethods, setApiMethods] = useState<string[]>([]);
  const [night, setNight] = useState<bigint | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawResult, setRawResult] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<string[] | null>(null);
  const [scannedDbs, setScannedDbs] = useState<string[]>([]);
  const [wallets, setWallets] = useState<{ rdns: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<string>("");
  const [proofSrv, setProofSrv] = useState<{ uri: string; ok: boolean; local: boolean } | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [pending, setPending] = useState<PendingDeploy | null>(null);
  const [confirmRedeploy, setConfirmRedeploy] = useState(false);

  const target = resolveDeployTarget();

  useEffect(() => {
    loadConnector()
      .then((m) => {
        setAvailable(m.isWalletAvailable());
        setWallets(m.availableWallets());
      })
      .catch(() => setAvailable(false));
    // Surface an address from an earlier deploy in this browser immediately.
    const prior = recallAddress();
    if (prior) setAddress(prior);

    // A deploy submitted earlier (possibly before a reload) that never got an
    // address back. Its presence blocks an accidental second deploy.
    setPending(readPendingDeploy());

    // The wallet provider fires this the moment the transaction is handed to
    // the wallet — long before indexer confirmation — so the link is visible
    // even if confirmation is slow.
    const network = resolveDeployTarget().network;
    const onSubmitted = (ev: Event) => {
      const detail = (ev as CustomEvent<TxSubmittedDetail>).detail;
      const next: PendingDeploy = { ...detail, network };
      writePendingDeploy(next);
      setPending(next);
    };
    window.addEventListener(TX_SUBMITTED_EVENT, onSubmitted);
    return () => window.removeEventListener(TX_SUBMITTED_EVENT, onSubmitted);
  }, []);

  async function recover() {
    setError(null);
    const { addresses, scanned } = await recoverAddressesFromStorage();
    console.log("[verihealth] scanned IndexedDB databases:", scanned);
    console.log("[verihealth] candidate addresses:", addresses);
    setScannedDbs(scanned);
    setRecovered(addresses);
    if (addresses.length === 1) {
      rememberAddress(addresses[0]);
      setAddress(addresses[0]);
    }
  }

  if (process.env.NODE_ENV === "production") {
    return <main style={S.main}>Not available in production.</main>;
  }

  async function connect() {
    setError(null);
    setPhase("connecting");
    try {
      const {
        connectWallet,
        dustBalance,
        availableApiMethods,
        unshieldedBalances,
        totalUnshielded,
      } = await loadConnector();
      const s = await connectWallet(target.network, chosen || undefined);
      setSession(s);
      setApiMethods(availableApiMethods(s.api));
      const d = await dustBalance(s.api).catch(() => null);
      setDust(d ? d.balance : null);
      setDustCap(d ? d.cap : null);
      setNight(totalUnshielded(await unshieldedBalances(s.api)));

      // Everything that proves needs this, INCLUDING the wallet's own DUST
      // registration. Check it up front rather than failing opaquely later.
      // The session already carries the proof server chosen at connect time
      // (local when it answers), which is exactly what the deploy will use.
      const { proofServerReachable } = await loadConnector();
      setProofSrv({
        uri: s.proofServerUri,
        ok: await proofServerReachable(s.proofServerUri),
        local: s.proofServerIsLocal,
      });
      setPhase("connected");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // A dead extension channel only clears on a page reload, so say so
      // rather than inviting an endless retry loop against a corpse.
      setNeedsReload(
        /shutdown|no longer be used|did not respond|Extension context/i.test(msg),
      );
      setPhase("error");
    }
  }

  async function deploy() {
    if (!session) return;
    // Never send a second deploy by accident. A previous one may already be on
    // chain even though this page never confirmed it.
    if (readPendingDeploy() && !confirmRedeploy) {
      setPending(readPendingDeploy());
      setError(
        "A deploy from this browser was already submitted and never confirmed " +
          "here. Check its transaction on the explorer first — deploying again " +
          "creates a second, separate contract.",
      );
      return;
    }
    setError(null);
    setConfirmRedeploy(false);
    setPhase("deploying");
    try {
      // Proof generation for six circuits is slow — minutes, not seconds.
      const { deployNewContract } = await loadContract();
      const deployed = await deployNewContract({
        config: target,
        session,
        // This browser's own passphrase, shared with the dashboard and issuer
        // console so they all open the same private-state store. A value typed
        // here would have to be retyped identically everywhere, and a mismatch
        // surfaces much later as an unreadable store.
        storagePassword: getStateKey(),
      });

      // Log the WHOLE result before touching it. A deploy costs real DUST and
      // minutes of proving; if address extraction below is wrong for this SDK
      // version, the address must still be recoverable from the console rather
      // than lost with the tab.
      console.log("[verihealth] deploy result:", deployed);

      const addr = extractContractAddress(deployed);
      if (addr) {
        rememberAddress(addr);
        setAddress(addr);
        // Confirmed and recorded: the guard has done its job.
        writePendingDeploy(null);
        setPending(null);
      } else {
        // Never silently succeed with nothing. Show the raw result so the
        // address can be dug out by hand.
        setRawResult(safeStringify(deployed));
      }
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  return (
    <main style={S.main}>
      <h1 style={S.h1}>Seath Aid deploy console</h1>
      <p style={S.dim}>
        network <b>{target.network}</b> &middot; zk assets <b>{target.zkConfigBase}</b>
      </p>

      {!available && (
        <p style={S.warn}>
          No Midnight wallet detected. Install 1AM (or Lace), unlock it, set it
          to <b>{target.network}</b>, then reload this page.
        </p>
      )}

      <ol style={S.ol}>
        <li>
          {wallets.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <label style={S.label}>
                Wallet ({wallets.length} detected)
                <select
                  value={chosen}
                  onChange={(e) => setChosen(e.target.value)}
                  style={S.input}
                >
                  <option value="">Auto (prefers 1AM, then Lace)</option>
                  {wallets.map((w) => (
                    <option key={w.rdns} value={w.rdns}>
                      {w.name} — {w.rdns}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <button onClick={connect} disabled={!available || phase === "connecting"} style={S.btn}>
            {phase === "connecting" ? "Connecting…" : "1. Connect wallet"}
          </button>
          {session && (
            <div style={S.box}>
              <div><b>wallet</b> {session.walletName}</div>
              <div style={S.mono}><b>address</b> {session.address}</div>
              <div><b>DUST</b> {dust === null ? "unknown" : String(dust)}</div>
              <div style={S.dim}>
                <b>wallet API</b> {apiMethods.join(", ") || "none detected"}
              </div>
              <div><b>NIGHT</b> {night === null ? "unknown" : String(night)}</div>

              <div><b>DUST cap</b> {dustCap === null ? "unknown" : String(dustCap)}</div>

              {proofSrv && (
                <div style={proofSrv.ok ? S.okInline : S.warn}>
                  <b>Proof server</b> <code>{proofSrv.uri}</code>{" "}
                  {proofSrv.ok ? "reachable." : "NOT REACHABLE."}
                  {proofSrv.ok && proofSrv.local && " Local — witnesses stay on this machine."}
                  {proofSrv.ok && !proofSrv.local && (
                    <>
                      {" "}<b>Remote</b> — the local proof server on localhost:6300 is not
                      running, so proofs fall back to the server your wallet reports.
                      Its version cannot be verified from here, and it sees proof
                      inputs in the clear. Start the local one (command below) and
                      reconnect to switch.
                      <pre style={S.pre}>
docker start verihealth-proof-server
                      </pre>
                    </>
                  )}
                  {!proofSrv.ok && (
                    <>
                      {" "}Nothing can be proved without it — and that includes your
                      wallet&apos;s own &ldquo;Generate tDUST&rdquo; registration, which is
                      built and proved locally. This is the usual reason that button
                      fails. Start one with:
                      <pre style={S.pre}>
docker run -d --name verihealth-proof-server --restart unless-stopped \
  -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
                      </pre>
                      <a href="https://docs.midnight.network/guides/run-proof-server" target="_blank" rel="noreferrer">
                        docs.midnight.network/guides/run-proof-server
                      </a>
                    </>
                  )}
                </div>
              )}

              {/* The cap, not the balance, says whether registration happened. */}
              {dust !== null && dust === BigInt(0) && night !== null && night === BigInt(0) && (
                <div style={S.warn}>
                  <b>Not funded yet.</b> This address holds no NIGHT. Paste the{" "}
                  <i>unshielded</i> address above into the faucet at{" "}
                  <a href="https://midnight-tmnight-preprod.nethermind.dev/" target="_blank" rel="noreferrer">
                    midnight-tmnight-preprod.nethermind.dev
                  </a>
                  , wait for it to arrive, then reconnect.
                </div>
              )}

              {dust !== null && dust === BigInt(0) && night !== null && night > BigInt(0) &&
                dustCap !== null && dustCap > BigInt(0) && (
                <div style={S.okInline}>
                  <b>Registered — just wait.</b> DUST cap is {String(dustCap)}, so this
                  NIGHT IS registered for DUST generation even if your wallet reported
                  an error. The balance accrues over a few minutes; reconnect until it
                  is non-zero. Nothing further to do.
                </div>
              )}

              {dust !== null && dust === BigInt(0) && night !== null && night > BigInt(0) &&
                dustCap !== null && dustCap === BigInt(0) && (
                <div style={S.warn}>
                  <b>Funded, but NOT registered.</b> You hold NIGHT and the DUST cap is
                  zero, so registration has not taken effect — waiting will not help.
                  Holding NIGHT generates nothing on its own. Register it for DUST
                  generation in your wallet (1AM); make sure the local proof server is
                  running, since the wallet proves that transaction locally.
                </div>
              )}

              {dust !== null && dust === BigInt(0) && night === null && (
                <div style={S.warn}>
                  No DUST, and this wallet does not expose{" "}
                  <code>getUnshieldedBalances</code>, so I cannot tell whether it is
                  funded. Check the NIGHT balance in your wallet directly.
                </div>
              )}

              {dust !== null && dust > BigInt(0) && (
                <div style={S.okInline}>Ready to deploy — DUST available for fees.</div>
              )}
            </div>
          )}
        </li>

        <li style={{ marginTop: 18 }}>
          <button
            onClick={deploy}
            disabled={
              !session ||
              phase === "deploying" ||
              (pending !== null && !confirmRedeploy)
            }
            style={S.btn}
          >
            {phase === "deploying" ? "Deploying — proving 6 circuits…" : "2. Deploy contract"}
          </button>
          {phase === "deploying" && !pending && (
            <p style={S.dim}>
              Your wallet will prompt you to sign. Proving takes minutes. As soon as
              the transaction is submitted, its link appears here; the page then
              waits for the indexer to confirm it. Keep this tab open.
            </p>
          )}

          {pending && (
            <div style={phase === "deploying" ? S.okInline : S.warn}>
              <b>
                {phase === "deploying"
                  ? "Submitted — waiting for the indexer to confirm."
                  : "A deploy was already submitted from this browser."}
              </b>{" "}
              Transaction{" "}
              <a href={explorerTxUrl(pending.txHash, pending.network)} target="_blank" rel="noreferrer">
                <code>{pending.txHash.slice(0, 16)}…</code>
              </a>{" "}
              on {pending.network}, {new Date(pending.submittedAt).toLocaleString()}.
              {phase !== "deploying" && (
                <>
                  {" "}Open it on the explorer before doing anything else: if it
                  succeeded, the contract already exists, and deploying again
                  creates a second, separate one.
                  <label style={{ display: "block", marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={confirmRedeploy}
                      onChange={(e) => setConfirmRedeploy(e.target.checked)}
                    />{" "}
                    I checked the explorer — deploy a NEW contract anyway
                  </label>
                  <button
                    onClick={() => {
                      writePendingDeploy(null);
                      setPending(null);
                      setConfirmRedeploy(false);
                    }}
                    style={{ ...S.btn, marginTop: 8 }}
                  >
                    Dismiss — that deploy is accounted for
                  </button>
                </>
              )}
            </div>
          )}
        </li>
      </ol>

      {address && (
        <div style={S.ok}>
          <div><b>Contract address.</b> Add this to <code>.env.local</code>, then restart the dev server:</div>
          <pre style={S.pre}>NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS={address}</pre>
          <button
            onClick={() => navigator.clipboard?.writeText(address).catch(() => {})}
            style={{ ...S.btn, marginTop: 8 }}
          >
            Copy address
          </button>
        </div>
      )}

      {/* If extraction missed, never leave the user with nothing to go on. */}
      {rawResult && !address && (
        <div style={S.warn}>
          <b>Deploy returned, but the address was not where expected.</b> The full
          result is below and also logged to the browser console. Look for a
          64-character hex value.
          <pre style={{ ...S.pre, maxHeight: 320, overflow: "auto" }}>{rawResult}</pre>
        </div>
      )}

      {/* Recovery for a deploy whose address was lost with the tab. */}
      <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid #ddd" }}>
        <button onClick={recover} style={S.btn}>
          Recover address from a previous deploy
        </button>
        <p style={S.dim}>
          Deploying stores the contract&apos;s maintenance signing key in this
          browser, keyed by contract address. If a deploy succeeded here, the
          address can be read back out of IndexedDB even if it was never saved.
        </p>
        {recovered !== null && (
          recovered.length > 0 ? (
            <div style={S.ok}>
              <div><b>Found {recovered.length} contract address(es) in this browser:</b></div>
              {recovered.map((a) => (
                <pre key={a} style={S.pre}>NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS={a}</pre>
              ))}
              <div style={S.dim}>
                More than one means several deploys from this browser; the most
                recent is normally the one you want.
              </div>
            </div>
          ) : (
            <div style={S.warn}>
              <b>Nothing found.</b> Databases actually scanned:
              <pre style={S.pre}>
                {scannedDbs.length ? scannedDbs.join("\n") : "(none existed)"}
              </pre>
              If that list is empty, no deploy has ever completed in this browser
              profile — the transaction may have failed after signing, or site data
              was cleared, or a different browser/profile was used. Check the
              browser console for the full scan output.
            </div>
          )
        )}
      </div>

      {error && (
        <div style={S.err}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{error}</pre>
          {needsReload && (
            <div style={{ marginTop: 12 }}>
              <b>The wallet connection is dead and retrying will not revive it.</b>
              <ol style={{ margin: "8px 0 12px 18px" }}>
                <li>Unlock the wallet extension.</li>
                <li>
                  If it was just installed, updated, or re-enabled, fully reload
                  this page — the page is holding a reference to the old
                  extension context.
                </li>
                <li>Then connect again.</li>
              </ol>
              <button onClick={() => location.reload()} style={S.btn}>
                Reload page
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: { maxWidth: 760, margin: "0 auto", padding: 32, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 },
  h1: { fontSize: 22, marginBottom: 4 },
  dim: { color: "#666", fontSize: 14 },
  ol: { paddingLeft: 18, marginTop: 24 },
  btn: { padding: "8px 14px", fontSize: 15, cursor: "pointer", borderRadius: 6, border: "1px solid #888", background: "#f6f6f6" },
  box: { marginTop: 10, padding: 12, background: "#f6f6f6", borderRadius: 6, fontSize: 14 },
  mono: { fontFamily: "ui-monospace, monospace", wordBreak: "break-all" },
  label: { display: "block", fontSize: 14 },
  input: { display: "block", width: "100%", marginTop: 6, padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #bbb" },
  warn: { marginTop: 10, padding: 10, background: "#fff6e0", border: "1px solid #e6c980", borderRadius: 6, fontSize: 14 },
  okInline: { marginTop: 10, padding: 10, background: "#eaf7ea", border: "1px solid #96c996", borderRadius: 6, fontSize: 14 },
  ok: { marginTop: 24, padding: 14, background: "#eaf7ea", border: "1px solid #96c996", borderRadius: 6, fontSize: 14 },
  pre: { whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8, fontFamily: "ui-monospace, monospace", fontSize: 13 },
  err: { marginTop: 20, padding: 14, background: "#fdecec", border: "1px solid #e0a0a0", borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 },
};
