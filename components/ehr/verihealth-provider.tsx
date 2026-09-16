"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Shared state for the dashboard, issuer console and verifier view.
//
// Everything here is live. There is no demo identity and no in-browser ledger:
// a wallet must be connected, the contract must be deployed and configured, and
// every issuance, revocation and proof is a signed transaction that costs DUST
// and takes minutes. Where that is slow or expensive, the UI says so rather
// than showing a plausible result.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Ledger } from "@/contracts/src/managed/verihealth/contract/index.js";
import type { ChainContext, ProofOptions } from "@/lib/midnight/browser/chain";
import type { ClaimType } from "@/lib/midnight/claim-types";
import {
  type LedgerSummary,
  ledgerView,
  summariseLedger,
} from "@/lib/midnight/ledger-view";
import { resolveOnChainConfig } from "@/lib/midnight/deployment";
import type { HeldCredential, ProofOutcome } from "@/lib/midnight/private-state";
import {
  type PendingCredential,
  importCredentialPackage,
  loadHolderCredentials,
} from "@/lib/midnight/session";
import {
  type MidnightWalletState,
  connectSession,
  isBrowserWalletAvailable,
} from "@/lib/midnight/wallet";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { type ProofLogEntry, listProofs, recordProof } from "@/lib/supabase/proof-log";
import type { CredentialWithIssuer } from "@/lib/supabase/types";

// The chain module is imported lazily, never at module scope.
//
// It reaches levelPrivateStateProvider, which resolves to `classic-level` — a
// NODE NATIVE addon — when evaluated on the server. Next prerenders even a
// "use client" page at build time, so a static import fails the build with
// "No native build was found for platform=win32 ... runtime=electron".
// Deferring to a dynamic import inside the handlers keeps that graph out of the
// SSR pass. The pure Ledger helpers above are safe to import statically.
const loadChain = () => import("@/lib/midnight/browser/chain");

type VeriHealthContextValue = {
  /**
   * "unconfigured" — no contract address or no Supabase; nothing can work.
   * "disconnected" — waiting for a wallet.
   * "connecting"   — attaching to the deployed contract.
   * "ready"        — chain is open.
   */
  status: "unconfigured" | "disconnected" | "connecting" | "ready" | "error";
  error: string | null;
  /** Live handle on the deployed contract, once a wallet is connected. */
  chain: ChainContext | null;
  /** The contract's public ledger as last read. */
  ledger: Ledger | null;
  ledgerSummary: LedgerSummary | null;
  refreshLedger: () => Promise<void>;

  wallet: MidnightWalletState | null;
  walletAvailable: boolean;
  connectWallet: () => Promise<void>;

  credentials: HeldCredential[];
  pending: PendingCredential[];
  credentialsLoading: boolean;
  credentialsError: string | null;
  proofs: ProofLogEntry[];
  importCredential: (code: string) => Promise<void>;
  refreshCredentials: () => Promise<void>;

  /** What the current transaction is doing, for a UI that waits minutes. */
  txStatus: string | null;
  generateProof: (
    credentialId: string,
    verifierName: string,
    options?: ProofOptions,
  ) => Promise<{ outcome: ProofOutcome; reference: string }>;
  isRevoked: (credentialId: string) => boolean;
};

const VeriHealthContext = createContext<VeriHealthContextValue | null>(null);

export function VeriHealthProvider({ children }: { children: React.ReactNode }) {
  const config = useMemo(() => {
    try {
      return resolveOnChainConfig();
    } catch {
      return null;
    }
  }, []);
  const supabaseReady = isSupabaseConfigured();

  const [status, setStatus] = useState<VeriHealthContextValue["status"]>(
    config && supabaseReady ? "disconnected" : "unconfigured",
  );
  const [error, setError] = useState<string | null>(
    config && supabaseReady
      ? null
      : !config
        ? "No contract is configured. Set NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS to the deployed contract address."
        : "Supabase is not configured, so issued credentials cannot be loaded. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );

  const [chain, setChain] = useState<ChainContext | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [wallet, setWallet] = useState<MidnightWalletState | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(false);

  const [credentials, setCredentials] = useState<HeldCredential[]>([]);
  const [pending, setPending] = useState<PendingCredential[]>([]);
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [proofs, setProofs] = useState<ProofLogEntry[]>([]);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const records = useRef<CredentialWithIssuer[]>([]);

  // Extensions inject into the page after load, so check on mount.
  useEffect(() => {
    setWalletAvailable(isBrowserWalletAvailable());
  }, []);

  const refreshLedger = useCallback(async () => {
    if (!chain) return;
    const { readLedger } = await loadChain();
    setLedger(await readLedger(chain.providers, chain.contractAddress));
  }, [chain]);

  const connectWallet = useCallback(async () => {
    if (!config) return;
    setStatus("connecting");
    setError(null);
    try {
      const { openChain, readLedger } = await loadChain();
      const session = await connectSession();
      const ctx = await openChain(config, session);
      const l = await readLedger(ctx.providers, ctx.contractAddress);
      setChain(ctx);
      setLedger(l);
      setWallet({
        address: session.address,
        coinPublicKey: session.shieldedCoinPublicKey,
        encryptionPublicKey: session.shieldedEncryptionPublicKey,
        walletName: session.walletName,
      });
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      // Connector and indexer errors are about configuration, not user data,
      // so they are safe to show and usually the only clue to what is wrong.
      setError(e instanceof Error ? e.message : "Could not connect to the contract.");
      throw e;
    }
  }, [config]);

  // Credentials belong to a wallet and are checked against the chain, so they
  // load once both exist, and reload whenever either changes.
  const refreshCredentials = useCallback(async () => {
    if (!wallet || !ledger) return;
    setCredentialsLoading(true);
    setCredentialsError(null);
    try {
      const loaded = await loadHolderCredentials(wallet.address, ledgerView(ledger));
      records.current = loaded.records;
      setCredentials(loaded.credentials);
      setPending(loaded.pending);
      setRevokedIds(loaded.revokedIds);
      setTick((t) => t + 1);
    } catch (e) {
      setCredentials([]);
      setPending([]);
      setCredentialsError(
        e instanceof Error ? e.message : "Could not load your credentials.",
      );
    } finally {
      setCredentialsLoading(false);
    }
  }, [wallet, ledger]);

  useEffect(() => {
    void refreshCredentials();
  }, [refreshCredentials]);

  useEffect(() => {
    if (credentials.length === 0) {
      setProofs([]);
      return;
    }
    listProofs(credentials.map((c) => c.id)).then(setProofs).catch(() => {});
  }, [credentials, tick]);

  const importCredential = useCallback(
    async (code: string) => {
      if (!wallet) throw new Error("Connect your wallet first.");
      await importCredentialPackage(code, records.current);
      await refreshCredentials();
    },
    [wallet, refreshCredentials],
  );

  const generateProof = useCallback(
    async (credentialId: string, verifierName: string, options: ProofOptions = {}) => {
      if (!chain) throw new Error("Connect your wallet first.");
      const credential = credentials.find((c) => c.id === credentialId);
      if (!credential) throw new Error("Credential not found.");

      setTxStatus(
        "Proving in the circuit and submitting the transaction. This takes a few minutes.",
      );
      try {
        const { proveClaimOnChain } = await loadChain();
        const outcome = await proveClaimOnChain(chain, credential, verifierName, options);
        setTxStatus("Proof settled. Recording the reference…");
        try {
          const entry = await recordProof({
            credentialId: credential.id,
            nullifier: outcome.nullifier,
            verifierName,
            claimType: credential.claimType,
            result: outcome.result,
          });
          return { outcome, reference: entry.proof_reference };
        } finally {
          // The nullifier is spent on chain either way.
          void refreshLedger();
          setTick((t) => t + 1);
        }
      } finally {
        setTxStatus(null);
      }
    },
    [chain, credentials, refreshLedger],
  );

  // Revocation comes from the chain, and also from the recorded flag so a
  // revocation made elsewhere shows before the next ledger read.
  const isRevoked = useCallback(
    (credentialId: string) => {
      if (revokedIds.has(credentialId)) return true;
      const credential = credentials.find((c) => c.id === credentialId);
      if (!credential || !ledger) return false;
      void tick;
      try {
        return ledgerView(ledger).isRevoked(credential.handle);
      } catch {
        return false;
      }
    },
    [credentials, revokedIds, ledger, tick],
  );

  const ledgerSummary = useMemo(() => {
    if (!ledger) return null;
    try {
      return summariseLedger(ledger);
    } catch {
      return null;
    }
  }, [ledger]);

  const value: VeriHealthContextValue = {
    status,
    error,
    chain,
    ledger,
    ledgerSummary,
    refreshLedger,
    wallet,
    walletAvailable,
    connectWallet,
    credentials,
    pending,
    credentialsLoading,
    credentialsError,
    proofs,
    importCredential,
    refreshCredentials,
    txStatus,
    generateProof,
    isRevoked,
  };

  return (
    <VeriHealthContext.Provider value={value}>{children}</VeriHealthContext.Provider>
  );
}

export function useVeriHealth(): VeriHealthContextValue {
  const ctx = useContext(VeriHealthContext);
  if (!ctx) throw new Error("useVeriHealth must be used inside VeriHealthProvider");
  return ctx;
}

export type { ClaimType, HeldCredential, PendingCredential, ProofLogEntry };
