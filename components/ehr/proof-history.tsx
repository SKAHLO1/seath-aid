"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Proof history. Shows verifier, claim type, timestamp, and pass/fail.
// It deliberately does not show — and cannot show — the underlying value.

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CLAIM_TYPE_META } from "@/lib/midnight/claim-types";
import { useVeriHealth } from "./verihealth-provider";

export function ProofHistory() {
  const { proofs } = useVeriHealth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proof history</CardTitle>
        <CardDescription>
          Every proof you have generated. Records the claim type and the result —
          never the value behind it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {proofs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No proofs generated yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Verifier</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proofs.map((p) => (
                <TableRow key={p.proof_reference}>
                  <TableCell className="font-medium">{p.verifier_name}</TableCell>
                  <TableCell>{CLAIM_TYPE_META[p.claim_type]?.label ?? p.claim_type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(p.generated_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.result ? "default" : "destructive"}>
                      {p.result ? "Pass" : "Fail"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
