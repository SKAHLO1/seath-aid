"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Patient side of issuance: shows recorded credentials that are not yet provable
// in this browser, and accepts the credential package an issuer sent.
//
// The pasted package contains medical values. It is verified in the browser,
// stored in this browser's IndexedDB, and never sent anywhere. The textarea is
// cleared on success and no part of the package is ever rendered back.

import { Check, Clock, FileKey, ShieldAlert } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CLAIM_TYPE_META } from "@/lib/midnight/claim-types";
import { CredentialPackageError } from "@/lib/midnight/credential-package";
import type { PendingCredential } from "@/lib/midnight/session";
import { useVeriHealth } from "./verihealth-provider";

const REASON_TEXT: Record<PendingCredential["reason"], string> = {
  "awaiting-package":
    "Waiting for the credential package from your issuer. Paste it below to use this credential in this browser.",
  "package-mismatch":
    "The package saved in this browser no longer matches the issued record. Import the issuer's package again.",
  "non-demo-issuer":
    "Issued by a non-demo issuer. It cannot be proven until the app uses the deployed contract.",
};

export function PendingCredentialCard({ credential }: { credential: PendingCredential }) {
  const meta = CLAIM_TYPE_META[credential.claimType];
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{credential.displayLabel}</CardTitle>
            <CardDescription>{credential.issuerName}</CardDescription>
          </div>
          <Badge variant={credential.revoked ? "destructive" : "outline"}>
            {credential.revoked ? "Revoked" : meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          {REASON_TEXT[credential.reason]}
        </p>
      </CardContent>
    </Card>
  );
}

export function ImportCredential() {
  const { importCredential, wallet } = useVeriHealth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onImport() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await importCredential(code);
      setCode("");
      setMessage({ ok: true, text: "Credential imported. It is stored only in this browser." });
    } catch (e) {
      setMessage({
        ok: false,
        // CredentialPackageError messages never contain package contents; any
        // other error is replaced by a generic line for the same reason.
        text:
          e instanceof CredentialPackageError
            ? e.message
            : "The credential could not be imported.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileKey className="h-4 w-4" />
          Import a credential package
        </CardTitle>
        <CardDescription>
          Your issuer gives you a package when they issue a credential to{" "}
          <code className="text-xs">{wallet ? `${wallet.address.slice(0, 18)}…` : "your wallet"}</code>.
          It holds the private details your proofs need. It is checked against the
          issued record, then kept in this browser only — never uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="credential-package" className="text-xs">
          Credential package
        </Label>
        <Textarea
          id="credential-package"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="vhcred1:…"
          rows={3}
          spellCheck={false}
          autoComplete="off"
          data-testid="credential-package-input"
        />
        <Button onClick={onImport} disabled={busy || !code.trim()}>
          {busy ? "Verifying…" : "Import"}
        </Button>
        {message && (
          <p
            className={`flex items-start gap-2 text-sm ${message.ok ? "text-emerald-700" : "text-destructive"}`}
          >
            {message.ok ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
