"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Shows the ENTIRE public ledger state. The point of this panel is that a judge
// can read everything the chain knows and confirm no medical value is there.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useVeriHealth } from "./verihealth-provider";

export function LedgerPanel() {
  const { ledgerSummary } = useVeriHealth();
  if (!ledgerSummary) return null;

  const stats = [
    { label: "Registered issuers", value: ledgerSummary.issuers },
    { label: "Revoked credentials", value: ledgerSummary.revoked },
    { label: "Spent nullifiers", value: ledgerSummary.nullifiers },
    { label: "Proofs verified", value: ledgerSummary.proofs },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Public ledger</CardTitle>
        <CardDescription>
          Everything Midnight&apos;s public state holds. Opaque hashes and counts only —
          no vaccine codes, lab values, or policy details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
