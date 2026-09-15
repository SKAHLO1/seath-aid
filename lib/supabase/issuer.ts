// SPDX-License-Identifier: Apache-2.0
//
// Issuer-side Supabase access.
//
// Issuer operators sign in with an email magic link. An administrator binds the
// operator to one or more issuers once (see README, "Optional: Supabase"); after
// that, issuing and revoking go through the issue_credential() and
// revoke_credential() functions, which re-check the binding server-side and
// refuse anonymous sessions.
//
// Nothing here ever receives a claim value. issueCredential() sends only the
// opaque commitment and handle plus a display label.

import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type { ClaimType } from "@/lib/midnight/claim-types";
import { getSupabase } from "./client";
import type { CredentialRow, IssuerRow } from "./types";

function issuerClient(): SupabaseClient {
  const client = getSupabase("issuer");
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export type IssuerUser = { id: string; email: string | null };

function toUser(session: Session | null): IssuerUser | null {
  if (!session || session.user.is_anonymous) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/** Emails a sign-in link that returns to `redirectTo` (normally `/issuer`). */
export async function sendMagicLink(email: string, redirectTo: string): Promise<void> {
  const { error } = await issuerClient().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    throw new Error(
      /rate limit/i.test(error.message)
        ? "Too many sign-in emails requested. Wait a minute and try again."
        : "Could not send the sign-in link.",
    );
  }
}

export async function getIssuerUser(): Promise<IssuerUser | null> {
  const { data } = await issuerClient().auth.getSession();
  return toUser(data.session);
}

/** Calls back with the current operator whenever the issuer session changes. */
export function onIssuerAuthChange(callback: (user: IssuerUser | null) => void): () => void {
  const { data } = issuerClient().auth.onAuthStateChange((_event, session) => {
    callback(toUser(session));
  });
  return () => data.subscription.unsubscribe();
}

export async function signOutIssuer(): Promise<void> {
  await issuerClient().auth.signOut({ scope: "local" });
}

/** Issuers an administrator has bound to this operator. */
export async function listMyIssuers(userId: string): Promise<IssuerRow[]> {
  const { data, error } = await issuerClient()
    .from("issuers")
    .select("id, name, public_key, is_demo, auth_user_id, created_at")
    .eq("auth_user_id", userId)
    .order("name");
  if (error) throw new Error("Could not load your issuers.");
  return (data ?? []) as IssuerRow[];
}

export async function issueCredential(args: {
  issuerId: string;
  walletAddress: string;
  claimType: ClaimType;
  handle: string;
  commitment: string;
  displayLabel: string;
}): Promise<string> {
  const { data, error } = await issuerClient().rpc("issue_credential", {
    p_issuer_id: args.issuerId,
    p_wallet_address: args.walletAddress,
    p_claim_type: args.claimType,
    p_nullifier_hash: args.handle,
    p_commitment: args.commitment,
    p_display_label: args.displayLabel,
  });
  if (error) {
    throw new Error(
      /not permitted/i.test(error.message)
        ? "Your account is not authorised to issue as this issuer."
        : "The credential could not be recorded.",
    );
  }
  return data as string;
}

/** Credentials issued by the operator's issuers, newest first. */
export async function listIssuedCredentials(
  issuerIds: string[],
): Promise<CredentialRow[]> {
  if (issuerIds.length === 0) return [];
  const { data, error } = await issuerClient()
    .from("credentials")
    .select(
      "id, holder_id, issuer_id, claim_type, nullifier_hash, commitment, " +
        "display_label, issued_at, revoked, revoked_at",
    )
    .in("issuer_id", issuerIds)
    .order("issued_at", { ascending: false });
  if (error) throw new Error("Could not load issued credentials.");
  return (data ?? []) as unknown as CredentialRow[];
}

export async function revokeIssuedCredential(credentialId: string): Promise<void> {
  const { error } = await issuerClient().rpc("revoke_credential", {
    p_credential_id: credentialId,
  });
  if (error) throw new Error("The credential could not be revoked.");
}
