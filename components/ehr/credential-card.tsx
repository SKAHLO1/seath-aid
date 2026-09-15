"use client";
// SPDX-License-Identifier: Apache-2.0

import { Check, Copy, Lock, ShieldAlert, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLAIM_TYPE_META } from "@/lib/midnight/claim-types";
import type { HeldCredential } from "@/lib/midnight/runtime";
import { ProofNotRecordedError } from "@/lib/supabase/proof-log";
import { useVeriHealth } from "./verihealth-provider";

type Outcome = {
  result: boolean;
  reference: string;
};

export function CredentialCard({ credential }: { credential: HeldCredential }) {
  const { generateProof, isRevoked } = useVeriHealth();
  const meta = CLAIM_TYPE_META[credential.claimType];
  const revoked = isRevoked(credential.id);

  const [verifierName, setVerifierName] = useState("Acme Corp HR");
  const [threshold, setThreshold] = useState("200");
  const [requiredDoses, setRequiredDoses] = useState("2");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onGenerate() {
    setBusy(true);
    setOutcome(null);
    setFailure(null);
    try {
      const { outcome: res, reference } = await generateProof(
        credential.id,
        verifierName.trim() || "Unnamed verifier",
        {
          requiredDoses: BigInt(requiredDoses || "0"),
          threshold: BigInt(threshold || "0"),
          requireBelow: true,
        },
      );
      setOutcome({ result: res.result, reference });
    } catch (e) {
      // Messages are deliberately generic and never echo circuit inputs.
      if (e instanceof ProofNotRecordedError) {
        // Not a rejection: the proof ran and its nullifier is spent, but the
        // record was not saved, so no shareable reference exists.
        setFailure(
          "The proof ran, but its record could not be saved, so there is no reference to share. It cannot be generated again for this verifier.",
        );
        return;
      }
      setFailure(
        revoked
          ? "This credential has been revoked by its issuer. No proof can be generated."
          : "The contract rejected this proof. The credential may be revoked, altered, or already used with this verifier.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyReference() {
    if (!outcome) return;
    await navigator.clipboard.writeText(outcome.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className={revoked ? "border-destructive/50" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{credential.displayLabel}</CardTitle>
            <CardDescription>{credential.issuerName}</CardDescription>
          </div>
          <Badge variant={revoked ? "destructive" : "secondary"}>
            {revoked ? "Revoked" : meta.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{meta.provesWhat}</p>

        {/* Transparency panel: makes the dual-ledger split visible to the user. */}
        <div className="rounded-md border bg-muted/40 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <Lock className="h-3 w-3" />
            Stays private on your device
          </div>
          <p className="text-muted-foreground">{meta.privateInputs.join(" · ")}</p>
          <div className="mt-2 mb-1 font-medium">Shared with the verifier</div>
          <p className="text-muted-foreground">
            {meta.publicInputs.join(" · ")} · pass/fail result
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`verifier-${credential.id}`} className="text-xs">
            Verifier
          </Label>
          <Input
            id={`verifier-${credential.id}`}
            value={verifierName}
            onChange={(e) => setVerifierName(e.target.value)}
            placeholder="Who is asking?"
          />
        </div>

        {credential.claimType === "lab_threshold" && (
          <div className="space-y-2">
            <Label htmlFor={`threshold-${credential.id}`} className="text-xs">
              Prove the value is at or below
            </Label>
            <Input
              id={`threshold-${credential.id}`}
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        )}

        {credential.claimType === "vaccination" && (
          <div className="space-y-2">
            <Label htmlFor={`doses-${credential.id}`} className="text-xs">
              Required doses
            </Label>
            <Input
              id={`doses-${credential.id}`}
              type="number"
              value={requiredDoses}
              onChange={(e) => setRequiredDoses(e.target.value)}
            />
          </div>
        )}

        <Button
          onClick={onGenerate}
          disabled={busy || revoked}
          className="w-full"
          data-testid={`generate-${credential.id}`}
        >
          {busy ? "Generating proof…" : "Generate proof"}
        </Button>

        {outcome && (
          <div
            className="rounded-md border p-3 text-sm"
            data-testid={`outcome-${credential.id}`}
          >
            <div className="flex items-center gap-2 font-medium">
              {outcome.result ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Proof passed</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-destructive" />
                  <span>Proof failed</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this reference with {verifierName || "the verifier"}. It reveals
              the claim type and the result — nothing else.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                {outcome.reference}
              </code>
              <Button size="sm" variant="outline" onClick={copyReference}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )}

        {failure && (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            data-testid={`failure-${credential.id}`}
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{failure}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
