// SPDX-License-Identifier: Apache-2.0
"use client";

import { AlertTriangle, Ban } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  VeriHealthProvider,
  useVeriHealth,
} from "@/components/ehr/verihealth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IssuerConsole } from "@/components/ehr/issuer-console";
import { Skeleton } from "@/components/ui/skeleton";
import { CLAIM_TYPE_META } from "@/lib/midnight/claim-types";

function IssuerBody() {
  const { mode, status, credentials, revokeCredential, isRevoked } = useVeriHealth();
  const [busy, setBusy] = useState<string | null>(null);

  if (status !== "ready") {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  // With Supabase configured, credentials are issued and revoked by signed-in
  // issuer operators rather than self-issued in this tab.
  if (mode === "supabase") {
    return <IssuerConsole />;
  }

  async function onRevoke(id: string) {
    setBusy(id);
    try {
      await revokeCredential(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {credentials.map((c) => {
        const revoked = isRevoked(c.id);
        return (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{c.displayLabel}</CardTitle>
                  <CardDescription>{c.issuerName}</CardDescription>
                </div>
                <Badge variant={revoked ? "destructive" : "secondary"}>
                  {revoked ? "Revoked" : CLAIM_TYPE_META[c.claimType].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Revocation handle</span>
                <code className="mt-1 block truncate rounded bg-muted px-2 py-1">
                  {c.handle}
                </code>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={revoked || busy === c.id}
                onClick={() => onRevoke(c.id)}
                data-testid={`revoke-${c.id}`}
              >
                <Ban className="mr-2 h-4 w-4" />
                {revoked
                  ? "Already revoked"
                  : busy === c.id
                    ? "Revoking…"
                    : "Revoke credential"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function IssuerPage() {
  return (
    <VeriHealthProvider>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-8">
          <p className="text-sm text-muted-foreground">Seath Aid</p>
          <h1 className="text-3xl font-semibold tracking-tight">Issuer console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Revoking writes the credential&apos;s handle to the on-chain revocation
            registry. Every subsequent proof attempt for that credential fails
            inside the circuit.
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

        <IssuerBody />

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
