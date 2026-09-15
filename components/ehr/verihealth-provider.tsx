"use client";
// SPDX-License-Identifier: Apache-2.0

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ClaimType } from "@/lib/midnight/claim-types";
import type {
  HeldCredential,
  ProofOutcome,
  VeriHealthRuntime,
} from "@/lib/midnight/runtime";
import {
  type PendingCredential,
  getSession,
  importCredentialPackage,
  loadHolderCredentials,
} from "@/lib/midnight/session";
import {
  DEMO_WALLET,
  type MidnightWalletState,
  connectBrowserWallet,
  isBrowserWalletAvailable,
} from "@/lib/midnight/wallet";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  type ProofLogEntry,
  listProofs,
  markRevokedLocally,
  recordProof,
} from "@/lib/supabase/proof-log";
import type { CredentialWithIssuer } from "@/lib/supabase/types";

type ProofOptions = {
  requiredDoses?: bigint;
  threshold?: bigint;
  requireBelow?: boolean;
};

type VeriHealthContextValue = {
  /** "demo" self-issues credentials in-tab; "supabase" loads issued ones. */
  mode: "demo" | "supabase";
  status: "loading" | "ready" | "error";
  error: string | null;
  credentials: HeldCredential[];
  /** Supabase mode: recorded credentials this browser cannot prove yet. */
  pending: PendingCredential[];
  credentialsLoading: boolean;
  credentialsError: string | null;
  proofs: ProofLogEntry[];
  wallet: MidnightWalletState | null;
  /** "wallet" = a browser wallet (1AM by default), "demo" = the demo identity. */
  walletKind: "wallet" | "demo" | null;
  walletAvailable: boolean;
  connectWallet: () => Promise<void>;
  useDemoWallet: () => void;
  importCredential: (code: string) => Promise<void>;
  refreshCredentials: () => Promise<void>;
  generateProof: (
    credentialId: string,
    verifierName: string,
    options?: ProofOptions,
  ) => Promise<{ outcome: ProofOutcome; reference: string }>;
  revokeCredential: (credentialId: string) => Promise<void>;
  isRevoked: (credentialId: string) => boolean;
  ledgerSummary: {
    issuers: number;
    revoked: number;
    nullifiers: number;
    proofs: number;
  } | null;
};

const VeriHealthContext = createContext<VeriHealthContextValue | null>(null);

export function VeriHealthProvider({ children }: { children: React.ReactNode }) {
  const mode: "demo" | "supabase" = isSupabaseConfigured() ? "supabase" : "demo";

  const [runtime, setRuntime] = useState<VeriHealthRuntime | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<HeldCredential[]>([]);
  const [pending, setPending] = useState<PendingCredential[]>([]);
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [proofs, setProofs] = useState<ProofLogEntry[]>([]);
  const [wallet, setWallet] = useState<MidnightWalletState | null>(null);
  const [walletKind, setWalletKind] = useState<"wallet" | "demo" | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [tick, setTick] = useState(0);
  const records = useRef<CredentialWithIssuer[]>([]);

  // Boot the contract runtime. In demo mode this also self-issues the demo
  // credentials through the real issuance circuit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { runtime: rt, credentials: held } = await getSession();
        if (cancelled) return;
        setRuntime(rt);
        setCredentials(held);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        // Deliberately generic: runtime errors can echo circuit inputs.
        setError("Could not start the Midnight contract runtime in this browser.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setWalletAvailable(isBrowserWalletAvailable());
  }, []);

  // Supabase mode: credentials belong to a wallet, so they load once an
  // identity is chosen, and reload whenever it changes.
  const refreshCredentials = useCallback(async () => {
    if (mode !== "supabase" || !runtime || !wallet) return;
    setCredentialsLoading(true);
    setCredentialsError(null);
    try {
      const loaded = await loadHolderCredentials(runtime, wallet.address);
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
  }, [mode, runtime, wallet]);

  useEffect(() => {
    void refreshCredentials();
  }, [refreshCredentials]);

  // Refresh the proof history whenever a proof is generated.
  useEffect(() => {
    if (credentials.length === 0) {
      setProofs([]);
      return;
    }
    listProofs(credentials.map((c) => c.id)).then(setProofs).catch(() => {});
  }, [credentials, tick]);

  const connectWallet = useCallback(async () => {
    const state = await connectBrowserWallet();
    setWallet(state);
    setWalletKind("wallet");
  }, []);

  const useDemoWallet = useCallback(() => {
    setWallet(DEMO_WALLET);
    setWalletKind("demo");
  }, []);

  const importCredential = useCallback(
    async (code: string) => {
      if (mode !== "supabase") {
        throw new Error("Credential packages are only used when Supabase is configured.");
      }
      if (!runtime || !wallet) throw new Error("Choose an identity first.");
      await importCredentialPackage(runtime, code, records.current);
      await refreshCredentials();
    },
    [mode, runtime, wallet, refreshCredentials],
  );

  const generateProof = useCallback(
    async (credentialId: string, verifierName: string, options: ProofOptions = {}) => {
      if (!runtime) throw new Error("Contract runtime is not ready.");
      const credential = credentials.find((c) => c.id === credentialId);
      if (!credential) throw new Error("Credential not found.");

      const outcome = await runtime.generateProof(credential, verifierName, options);
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
        // The ledger changed either way (the nullifier is spent).
        setTick((t) => t + 1);
      }
    },
    [runtime, credentials],
  );

  const revokeCredential = useCallback(
    async (credentialId: string) => {
      if (mode === "supabase") {
        throw new Error("Revoke credentials from the issuer console.");
      }
      if (!runtime) throw new Error("Contract runtime is not ready.");
      const credential = credentials.find((c) => c.id === credentialId);
      if (!credential) throw new Error("Credential not found.");

      await runtime.revoke(credential.claimType, credential.handle);
      markRevokedLocally(credentialId);
      setTick((t) => t + 1);
    },
    [mode, runtime, credentials],
  );

  // Revocation status comes from the ledger, and in Supabase mode also from the
  // recorded flag, so a revocation made in another browser still shows.
  const isRevoked = useCallback(
    (credentialId: string) => {
      if (revokedIds.has(credentialId)) return true;
      if (!runtime) return false;
      const credential = credentials.find((c) => c.id === credentialId);
      if (!credential) return false;
      void tick;
      try {
        return runtime.isRevoked(credential.handle);
      } catch {
        return false;
      }
    },
    [runtime, credentials, revokedIds, tick],
  );

  const ledgerSummary = useMemo(() => {
    if (!runtime || status !== "ready") return null;
    void tick; // recompute after each on-chain write
    try {
      const l = runtime.ledger;
      return {
        issuers: Number(l.registeredIssuers.size()),
        revoked: Number(l.revocationRegistry.size()),
        nullifiers: Number(l.usedNullifiers.size()),
        proofs: Number(l.proofCount),
      };
    } catch {
      return null;
    }
  }, [runtime, status, tick]);

  const value: VeriHealthContextValue = {
    mode,
    status,
    error,
    credentials,
    pending,
    credentialsLoading,
    credentialsError,
    proofs,
    wallet,
    walletKind,
    walletAvailable,
    connectWallet,
    useDemoWallet,
    importCredential,
    refreshCredentials,
    generateProof,
    revokeCredential,
    isRevoked,
    ledgerSummary,
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
