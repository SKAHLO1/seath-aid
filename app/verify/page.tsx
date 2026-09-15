// SPDX-License-Identifier: Apache-2.0
"use client";

import { Check, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CLAIM_TYPE_META } from "@/lib/midnight/claim-types";
import { lookupProof } from "@/lib/supabase/proof-log";
import type { VerifyProofResult } from "@/lib/supabase/types";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "found"; proof: VerifyProofResult }
  | { kind: "missing" }
  | { kind: "error" };

export default function VerifyPage() {
  const [reference, setReference] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) return;
    setState({ kind: "checking" });
    try {
      const proof = await lookupProof(reference.trim());
      setState(proof ? { kind: "found", proof } : { kind: "missing" });
    } catch {
      // A failed lookup is not the same as "no such proof"; say so.
      setState({ kind: "error" });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Seath Aid</p>
        <h1 className="text-3xl font-semibold tracking-tight">Verifier</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste a proof reference from a patient. You will see which claim was
          proven and whether it passed — never the underlying medical data.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check a proof</CardTitle>
          <CardDescription>
            Works for all three claim types: vaccination, lab threshold, and coverage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCheck} className="flex gap-2">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Proof reference"
              aria-label="Proof reference"
              data-testid="reference-input"
            />
            <Button type="submit" disabled={state.kind === "checking"}>
              <Search className="mr-2 h-4 w-4" />
              {state.kind === "checking" ? "Checking…" : "Check"}
            </Button>
          </form>

          {state.kind === "missing" && (
            <p
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
              data-testid="verify-missing"
            >
              No proof found for that reference.
            </p>
          )}

          {state.kind === "error" && (
            <p
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
              data-testid="verify-error"
            >
              The lookup could not be completed. Check your connection and try again.
            </p>
          )}

          {state.kind === "found" && (
            <div className="mt-4 rounded-md border p-4" data-testid="verify-result">
              <div className="flex items-center gap-2">
                {state.proof.result ? (
                  <>
                    <Check className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium">Claim verified</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-destructive" />
                    <span className="font-medium">Claim not satisfied</span>
                  </>
                )}
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Claim type</dt>
                  <dd className="font-medium">
                    {CLAIM_TYPE_META[state.proof.claim_type]?.label ??
                      state.proof.claim_type}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">What this proves</dt>
                  <dd className="text-right font-medium">
                    {CLAIM_TYPE_META[state.proof.claim_type]?.provesWhat}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Requested by</dt>
                  <dd className="font-medium">{state.proof.verifier_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Generated</dt>
                  <dd className="font-medium">
                    {new Date(state.proof.generated_at).toLocaleString()}
                  </dd>
                </div>
                {state.proof.revoked && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Credential status</dt>
                    <dd className="font-medium text-destructive">
                      Revoked since this proof
                    </dd>
                  </div>
                )}
              </dl>

              <p className="mt-4 flex items-start gap-2 rounded bg-muted/50 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This is everything the verifier receives. The vaccine code, lab
                value, and policy details never left the patient&apos;s device.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to patient dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
