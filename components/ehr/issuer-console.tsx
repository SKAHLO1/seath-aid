"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Issuer console when Supabase is configured: magic-link sign-in, the issuers
// this operator is bound to, issuance, and revocation of issued credentials.

import { Ban, LogOut, Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { CLAIM_TYPE_META, type ClaimType } from "@/lib/midnight/claim-types";
import { getSession } from "@/lib/midnight/session";
import {
  type IssuerUser,
  getIssuerUser,
  listIssuedCredentials,
  listMyIssuers,
  onIssuerAuthChange,
  revokeIssuedCredential,
  sendMagicLink,
  signOutIssuer,
} from "@/lib/supabase/issuer";
import type { CredentialRow, IssuerRow } from "@/lib/supabase/types";
import { IssueCredentialForm } from "./issue-credential-form";

function SignIn() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendMagicLink(email, `${window.location.origin}/issuer`);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issuer sign-in</CardTitle>
        <CardDescription>
          We email you a one-time sign-in link. Issuing requires an account an
          administrator has linked to an issuer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4" />
            Check {email} for the sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex gap-2">
            <Label htmlFor="issuer-email" className="sr-only">Email</Label>
            <Input
              id="issuer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.example"
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send link"}
            </Button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function NotBound({ user, onRetry }: { user: IssuerUser; onRetry: () => void }) {
  const snippet =
    `update issuers\n` +
    `   set auth_user_id = (select id from auth.users where email = '${user.email ?? "<email>"}')\n` +
    ` where is_demo;`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Not linked to an issuer yet</CardTitle>
        <CardDescription>
          You are signed in as {user.email}, but no issuer is linked to this
          account. An administrator links issuers once, by running this in the
          Supabase SQL Editor:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{snippet}</pre>
        <Button variant="outline" size="sm" onClick={onRetry}>
          I&apos;ve been linked — check again
        </Button>
      </CardContent>
    </Card>
  );
}

export function IssuerConsole() {
  const [user, setUser] = useState<IssuerUser | null | undefined>(undefined);
  const [issuers, setIssuers] = useState<IssuerRow[] | null>(null);
  const [issued, setIssued] = useState<CredentialRow[]>([]);
  const [claimTypes, setClaimTypes] = useState<Map<string, ClaimType>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getIssuerUser().then(setUser).catch(() => setUser(null));
    return onIssuerAuthChange(setUser);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const mine = await listMyIssuers(user.id);
      setIssuers(mine);
      setIssued(await listIssuedCredentials(mine.map((i) => i.id)));

      // Demo issuers each attest one claim type; map by public key.
      const { runtime } = await getSession();
      const map = new Map<string, ClaimType>();
      for (const i of mine) {
        const demo = runtime.demoIssuerForPublicKey(i.public_key);
        if (demo) map.set(i.id, demo.claimType);
      }
      setClaimTypes(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the issuer console.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRevoke(id: string) {
    setBusyId(id);
    try {
      await revokeIssuedCredential(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The credential could not be revoked.");
    } finally {
      setBusyId(null);
    }
  }

  if (user === undefined) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (user === null) return <SignIn />;

  const issuerName = new Map((issuers ?? []).map((i) => [i.id, i.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Signed in as {user.email}</span>
        <Button variant="ghost" size="sm" onClick={() => signOutIssuer()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {issuers === null ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : issuers.length === 0 ? (
        <NotBound user={user} onRetry={load} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue a credential</CardTitle>
              <CardDescription>
                The values you enter never leave this browser. Supabase records only
                the credential&apos;s commitment, revocation handle, and label.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IssueCredentialForm
                issuers={issuers}
                claimTypeFor={(i) => claimTypes.get(i.id) ?? null}
                onIssued={load}
              />
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Issued credentials</h2>
            {issued.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing issued yet.</p>
            )}
            {issued.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{c.display_label}</CardTitle>
                      <CardDescription>
                        {issuerName.get(c.issuer_id)} ·{" "}
                        {new Date(c.issued_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge variant={c.revoked ? "destructive" : "secondary"}>
                      {c.revoked ? "Revoked" : CLAIM_TYPE_META[c.claim_type].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Revocation handle</span>
                    <code className="mt-1 block truncate rounded bg-muted px-2 py-1">
                      {c.nullifier_hash}
                    </code>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={c.revoked || busyId === c.id}
                    onClick={() => onRevoke(c.id)}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {c.revoked ? "Revoked" : busyId === c.id ? "Revoking…" : "Revoke credential"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
