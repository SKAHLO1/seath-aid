// SPDX-License-Identifier: Apache-2.0
//
// Patient-side Supabase access.
//
// A patient is an anonymous Supabase user bound to one wallet address through
// the ensure_holder() function (supabase/migrations/0004_integration.sql). RLS
// then limits them to their own credentials and proof log.
//
// Binding a wallet does not prove the caller controls it. That is an accepted
// limitation of this demo, which holds only synthetic data.

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "./client";
import type { CredentialWithIssuer } from "./types";

function holderClient(): SupabaseClient {
  const client = getSupabase("holder");
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

async function ensureAnonymousSession(client: SupabaseClient): Promise<void> {
  const { data } = await client.auth.getSession();
  if (data.session) return;

  const { data: signedIn, error } = await client.auth.signInAnonymously();
  if (error || !signedIn.session) {
    throw new Error(
      "Could not start a Supabase session. Check that Anonymous sign-ins are " +
        "enabled for this project (Authentication → Sign In / Providers).",
    );
  }
}

/**
 * Makes sure this browser has a holder session bound to `walletAddress`, and
 * returns the holder id.
 *
 * If the session is already bound to a DIFFERENT wallet — typically the demo
 * identity first, then a real wallet — a fresh anonymous session is started for
 * the new wallet rather than failing. The old binding stays with the old
 * session.
 */
export async function ensureHolderSession(walletAddress: string): Promise<string> {
  const client = holderClient();
  await ensureAnonymousSession(client);

  const bind = () =>
    client.rpc("ensure_holder", { p_wallet_address: walletAddress });

  let { data, error } = await bind();
  if (error && /different wallet/i.test(error.message)) {
    await client.auth.signOut({ scope: "local" });
    await ensureAnonymousSession(client);
    ({ data, error } = await bind());
  }
  if (error) {
    throw new Error(
      /another session/i.test(error.message)
        ? "This wallet is already linked to a different browser session."
        : "Could not link this wallet to your session.",
    );
  }
  return data as string;
}

/** The signed-in holder's credentials (public half only), oldest first. */
export async function listMyCredentials(): Promise<CredentialWithIssuer[]> {
  const { data, error } = await holderClient()
    .from("credentials")
    .select(
      "id, holder_id, issuer_id, claim_type, nullifier_hash, commitment, " +
        "display_label, issued_at, revoked, revoked_at, " +
        "issuer:issuers(name, public_key, is_demo)",
    )
    .order("issued_at", { ascending: true });

  if (error) throw new Error("Could not load your credentials.");
  return (data ?? []) as unknown as CredentialWithIssuer[];
}
