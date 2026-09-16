// SPDX-License-Identifier: Apache-2.0
"use client";

import Link from "next/link";

import { CredentialCard } from "@/components/ehr/credential-card";
import {
  ImportCredential,
  PendingCredentialCard,
} from "@/components/ehr/import-credential";
import { LedgerPanel } from "@/components/ehr/ledger-panel";
import { ProofHistory } from "@/components/ehr/proof-history";
import {
  VeriHealthProvider,
  useVeriHealth,
} from "@/components/ehr/verihealth-provider";
import { WalletConnect } from "@/components/ehr/wallet-connect";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardBody() {
  const {
    status,
    error,
    credentials,
    pending,
    credentialsLoading,
    credentialsError,
    wallet,
  } = useVeriHealth();

  if (status === "unconfigured" || status === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="font-medium">
          {status === "unconfigured" ? "Not configured" : "Could not reach the contract"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (status === "connecting") {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  // Credentials live on chain and belong to a wallet, so nothing can be shown
  // before one is connected. There is no demo identity.
  if (!wallet) {
    return (
      <div className="rounded-lg border p-6">
        <h2 className="font-medium">Connect your wallet to load your credentials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Credentials issued to your wallet address are read from the deployed
          Midnight contract. Proving one submits a transaction, so the wallet also
          needs DUST.
        </p>
      </div>
    );
  }

  const nothingYet =
    !credentialsLoading &&
    !credentialsError &&
    credentials.length === 0 &&
    pending.length === 0;

  return (
    <div className="space-y-8">
      <LedgerPanel />
      <section>
        <h2 className="mb-4 text-lg font-medium">Your credentials</h2>
        {credentialsError && (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {credentialsError}
          </p>
        )}
        {credentialsLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : nothingYet ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">
            No credentials have been issued to{" "}
            <code className="text-xs">{wallet.address}</code> yet. Give this address
            to an issuer.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {credentials.map((c) => (
              <CredentialCard key={c.id} credential={c} />
            ))}
            {pending.map((p) => (
              <PendingCredentialCard key={p.id} credential={p} />
            ))}
          </div>
        )}
      </section>
      <ImportCredential />
      <ProofHistory />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <VeriHealthProvider>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Logo className="mb-1" />
            <h1 className="text-3xl font-semibold tracking-tight">Patient dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Your medical facts stay on this device. Generating a proof runs a
              Midnight Compact circuit and publishes only a pass/fail result.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <WalletConnect />
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/verify">Verifier view</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/issuer">Issuer console</Link>
              </Button>
            </div>
          </div>
        </header>
        <DashboardBody />
      </main>
    </VeriHealthProvider>
  );
}
