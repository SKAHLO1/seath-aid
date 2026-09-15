"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Issuer side of issuance.
//
// The medical values typed here stay in this browser. The credential is built
// locally with the contract's pure circuits; Supabase receives only the opaque
// commitment and revocation handle plus a display label. The package shown on
// success DOES contain the values — it is for the patient only, and is cleared
// from the page as soon as the issuer moves on.

import { AlertTriangle, Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CLAIM_TYPE_META, CLAIM_TYPES, type ClaimType } from "@/lib/midnight/claim-types";
import {
  type CredentialInput,
  CredentialPackageError,
  buildCredential,
  encodePackage,
} from "@/lib/midnight/credential-package";
import { getSession } from "@/lib/midnight/session";
import { issueCredential } from "@/lib/supabase/issuer";
import type { IssuerRow } from "@/lib/supabase/types";

const INTEGER = /^[0-9]{1,12}$/;

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function IssueCredentialForm({
  issuers,
  claimTypeFor,
  onIssued,
}: {
  issuers: IssuerRow[];
  /** The claim type a demo issuer attests, or null for a non-demo issuer. */
  claimTypeFor: (issuer: IssuerRow) => ClaimType | null;
  onIssued: () => void;
}) {
  const [issuerId, setIssuerId] = useState(issuers[0]?.id ?? "");
  const issuer = issuers.find((i) => i.id === issuerId) ?? null;
  const fixedClaimType = issuer ? claimTypeFor(issuer) : null;

  const [chosenClaimType, setChosenClaimType] = useState<ClaimType>("vaccination");
  const claimType = fixedClaimType ?? chosenClaimType;

  const [wallet, setWallet] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState(""); // doses or lab value
  const [date, setDate] = useState(""); // completion / measured / expiry
  const [active, setActive] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedPackage, setIssuedPackage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fields = useMemo(() => {
    switch (claimType) {
      case "vaccination":
        return { code: "Vaccine code", amount: "Doses", date: "Completion date" };
      case "lab_threshold":
        return { code: "Lab code", amount: "Lab value", date: "Measured date" };
      case "coverage":
        return { code: "Policy reference", amount: null, date: "Expiry date" };
    }
  }, [claimType]);

  function reset() {
    setWallet("");
    setLabel("");
    setCode("");
    setAmount("");
    setDate("");
    setActive(true);
    setIssuedPackage(null);
    setError(null);
  }

  async function onIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!issuer) return;
    setError(null);

    const parsedDate = parseDate(date);
    if (!parsedDate) return setError(`${fields.date} is required.`);
    if (fields.amount && !INTEGER.test(amount)) {
      return setError(`${fields.amount} must be a whole number.`);
    }

    let input: CredentialInput;
    if (claimType === "vaccination") {
      input = { claimType, vaccineCode: code, doses: BigInt(amount), completionDate: parsedDate };
    } else if (claimType === "lab_threshold") {
      input = { claimType, labCode: code, value: BigInt(amount), measuredDate: parsedDate };
    } else {
      input = { claimType, policyRef: code, active, expiryDate: parsedDate };
    }

    setBusy(true);
    try {
      const { runtime } = await getSession();
      const pkg = buildCredential(
        runtime.pureCircuits,
        { name: issuer.name, publicKeyHex: issuer.public_key },
        input,
        label,
      );
      // Only hashes and the label leave the browser.
      await issueCredential({
        issuerId: issuer.id,
        walletAddress: wallet,
        claimType,
        handle: pkg.handle,
        commitment: pkg.commitment,
        displayLabel: pkg.displayLabel,
      });
      setIssuedPackage(encodePackage(pkg));
      // The values are now inside the package; clear the form fields.
      setCode("");
      setAmount("");
      setDate("");
      onIssued();
    } catch (err) {
      setError(
        err instanceof CredentialPackageError || err instanceof Error
          ? err.message
          : "The credential could not be issued.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyPackage() {
    if (!issuedPackage) return;
    await navigator.clipboard.writeText(issuedPackage);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (issuedPackage) {
    return (
      <div className="space-y-3" data-testid="issued-package">
        <p className="flex items-center gap-2 font-medium">
          <Check className="h-4 w-4 text-emerald-600" />
          Credential issued and recorded
        </p>
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            This package contains the medical details. Send it only to the patient.
            It was <strong>not</strong> stored on the server and cannot be shown
            again once you leave this screen.
          </span>
        </div>
        <Textarea readOnly value={issuedPackage} rows={4} spellCheck={false} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyPackage}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy package"}
          </Button>
          <Button size="sm" onClick={reset}>
            Issue another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onIssue} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="issuer" className="text-xs">Issue as</Label>
          <select
            id="issuer"
            value={issuerId}
            onChange={(e) => setIssuerId(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {issuers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="claim-type" className="text-xs">Claim type</Label>
          <select
            id="claim-type"
            value={claimType}
            disabled={fixedClaimType !== null}
            onChange={(e) => setChosenClaimType(e.target.value as ClaimType)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70"
          >
            {CLAIM_TYPES.map((t) => (
              <option key={t} value={t}>
                {CLAIM_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {issuer && fixedClaimType === null && (
        <p className="text-xs text-muted-foreground">
          This is not a demo issuer. Its credentials are recorded, but patients
          cannot prove them until the app uses the deployed contract.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="holder-wallet" className="text-xs">Patient wallet address</Label>
        <Input
          id="holder-wallet"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="mn_addr_…"
          required
          spellCheck={false}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="display-label" className="text-xs">
          Display label (shown to the patient; must not contain the value)
        </Label>
        <Input
          id="display-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            claimType === "vaccination"
              ? "MMR immunisation series"
              : claimType === "lab_threshold"
                ? "LDL cholesterol panel"
                : "Health policy"
          }
          maxLength={120}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="claim-code" className="text-xs">{fields.code}</Label>
          <Input
            id="claim-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={32}
            required
            autoComplete="off"
          />
        </div>
        {fields.amount ? (
          <div className="space-y-2">
            <Label htmlFor="claim-amount" className="text-xs">{fields.amount}</Label>
            <Input
              id="claim-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
        ) : (
          <div className="flex items-end gap-2 pb-2">
            <input
              id="claim-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <Label htmlFor="claim-active" className="text-xs">Policy active</Label>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="claim-date" className="text-xs">{fields.date}</Label>
          <Input
            id="claim-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={busy || !issuer}>
        {busy ? "Issuing…" : "Issue credential"}
      </Button>
    </form>
  );
}
