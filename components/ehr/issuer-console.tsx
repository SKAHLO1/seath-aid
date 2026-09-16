"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Issuer console: magic-link sign-in, a connected wallet, and the issuers this
// operator is bound to.
//
// An issuer needs BOTH identities. Supabase says who may issue as which issuer;
// the wallet pays for the transaction that puts the credential on chain. Every
// issuance and revocation here is a real transaction costing DUST and minutes.

import { Ban, LogOut, Mail, Wallet } from "lucide-react";
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
import { CLAIM_TYPE_META } from "@/lib/midnight/claim-types";
import { isIssuerRegistered } from "@/lib/midnight/ledger-view";
import {
  DEMO_ISSUERS,
  demoIssuerForPublicKey,
  demoIssuerPublicKey,
} from "@/lib/midnight/demo-issuer";
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
import { useVeriHealth } from "./verihealth-provider";
import { WalletConnect } from "./wallet-connect";

// Lazy for the same reason as in verihealth-provider.tsx: this module reaches a
// Node native addon and must stay out of Next's prerender pass.
const loadChain = () => import("@/lib/midnight/browser/chain");

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

/**
 * One-time bootstrap: the contract as deployed has no registered issuers, and
 * no credential can be issued — nor any proof produced — until they exist on
 * chain. One transaction per issuer.
 */
function RegisterIssuers() {
  const { chain, ledger, refreshLedger } = useVeriHealth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!chain || !ledger) return null;

  const missing = DEMO_ISSUERS.filter(
    (i) => !isIssuerRegistered(ledger, demoIssuerPublicKey(i)),
  );
  if (missing.length === 0) return null;

  async function registerAll() {
    setError(null);
    try {
      const { registerIssuerOnChain } = await loadChain();
      for (const issuer of missing) {
        setBusy(issuer.name);
        await registerIssuerOnChain(chain!, issuer);
      }
      await refreshLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="text-base">Register issuers on chain</CardTitle>
        <CardDescription>
          {missing.length} of {DEMO_ISSUERS.length} demo issuers are not yet
          registered with the deployed contract. Until they are, credentials
          cannot be issued and no proof can succeed. This submits one transaction
          per issuer — each costs DUST and takes a few minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button onClick={registerAll} disabled={busy !== null}>
          {busy ? `Registering ${busy}…` : `Register ${missing.length} issuer(s)`}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function IssuerConsole() {
  const { chain, ledger, wallet, status, error: chainError, refreshLedger } =
    useVeriHealth();
  const [user, setUser] = useState<IssuerUser | null | undefined>(undefined);
  const [issuers, setIssuers] = useState<IssuerRow[] | null>(null);
  const [issued, setIssued] = useState<CredentialRow[]>([]);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the issuer console.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const issuerById = new Map((issuers ?? []).map((i) => [i.id, i]));

  async function onRevoke(row: CredentialRow) {
    const issuerRow = issuerById.get(row.issuer_id);
    const demo = issuerRow ? demoIssuerForPublicKey(issuerRow.public_key) : undefined;
    if (!chain || !demo) {
      setError(
        "Revoking writes to the chain and needs the issuer's signing key, which " +
          "this console only has for the demo issuers.",
      );
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      // Chain first: the registry entry is what actually stops proofs. The
      // Supabase flag only mirrors it for the UI.
      const { revokeCredentialOnChain } = await loadChain();
      await revokeCredentialOnChain(chain, demo, row.nullifier_hash);
      await revokeIssuedCredential(row.id);
      await Promise.all([refreshLedger(), load()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The credential could not be revoked.");
    } finally {
      setBusyId(null);
    }
  }

  if (status === "unconfigured") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="font-medium">Not configured</h2>
        <p className="mt-1 text-sm text-muted-foreground">{chainError}</p>
      </div>
    );
  }

  if (user === undefined) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (user === null) return <SignIn />;

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

      {!wallet ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Connect a wallet to issue
            </CardTitle>
            <CardDescription>
              Issuing and revoking are transactions on the deployed contract. This
              wallet signs and pays for them, so it needs DUST.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-start">
            <WalletConnect />
          </CardContent>
        </Card>
      ) : (
        <RegisterIssuers />
      )}

      {issuers === null ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : issuers.length === 0 ? (
        <NotBound user={user} onRetry={load} />
      ) : (
        <>
          {wallet && chain && ledger && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issue a credential</CardTitle>
                <CardDescription>
                  The values you enter never leave this browser. The chain receives
                  only the commitment; Supabase records only that commitment, the
                  revocation handle, and a label.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IssueCredentialForm issuers={issuers} onIssued={load} />
              </CardContent>
            </Card>
          )}

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
                        {issuerById.get(c.issuer_id)?.name} ·{" "}
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
                    disabled={c.revoked || busyId === c.id || !wallet}
                    onClick={() => onRevoke(c)}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {c.revoked
                      ? "Revoked"
                      : busyId === c.id
                        ? "Revoking on chain…"
                        : "Revoke credential"}
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
