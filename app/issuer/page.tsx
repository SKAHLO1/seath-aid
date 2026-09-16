// SPDX-License-Identifier: Apache-2.0
"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { IssuerConsole } from "@/components/ehr/issuer-console";
import { VeriHealthProvider } from "@/components/ehr/verihealth-provider";
import { Button } from "@/components/ui/button";

export default function IssuerPage() {
  return (
    <VeriHealthProvider>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-8">
          <p className="text-sm text-muted-foreground">Seath Aid</p>
          <h1 className="text-3xl font-semibold tracking-tight">Issuer console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Issuing publishes a credential&apos;s commitment to the on-chain Merkle
            tree; revoking writes its handle to the on-chain revocation registry.
            Every subsequent proof attempt for a revoked credential fails inside
            the circuit.
          </p>
        </header>

        <div className="mb-6 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Simulated issuers.</strong> These keypairs are hardcoded demo
            values and correspond to no real clinic, lab, or insurer. There is no
            integration with any healthcare provider.
          </span>
        </div>

        <IssuerConsole />

        <div className="mt-6 flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Patient dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/verify">Verifier view</Link>
          </Button>
        </div>
      </main>
    </VeriHealthProvider>
  );
}
