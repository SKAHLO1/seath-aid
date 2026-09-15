// SPDX-License-Identifier: Apache-2.0
//
// Supabase browser clients.
//
// Supabase is OPTIONAL for the demo. When the env vars are absent the app falls
// back to an in-memory proof log so anyone can run the whole flow without
// provisioning a database. isSupabaseConfigured() drives that switch.
//
// Two clients, one per role, each with its own auth storage key:
//   holder — anonymous session bound to the patient's wallet
//   issuer — email magic-link session of an issuer operator
// Separate storage keys let both sessions exist in the same browser. With a
// single client, an issuer signing in on /issuer would silently replace the
// patient's anonymous session and orphan their credentials.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// API KEYS. Supabase replaced the legacy `anon` / `service_role` JWT keys with
// publishable (`sb_publishable_…`) and secret (`sb_secret_…`) keys, and is
// deprecating the legacy pair by the end of 2026
// (https://supabase.com/docs/guides/api/api-keys). The publishable key maps to
// the same `anon` role — and to `authenticated` once a user signs in — so RLS is
// unaffected.
//
// The browser takes the PUBLISHABLE key. The legacy anon-key variable is still
// read as a fallback so existing .env files keep working until the deprecation.
// Both are referenced literally so Next.js can inline them at build time.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type SupabaseRole = "holder" | "issuer";

export function isSupabaseConfigured(): boolean {
  return Boolean(url && publishableKey);
}

/**
 * True for a key that must never reach a browser: a secret key, or a legacy
 * JWT whose role is service_role. Either bypasses RLS entirely.
 *
 * Supabase already rejects secret keys from browsers (401 by User-Agent), but by
 * then the key has been shipped in the bundle. Failing loudly here makes the
 * misconfiguration obvious instead of looking like a broken connection.
 */
function isPrivilegedKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

const clients = new Map<SupabaseRole, SupabaseClient>();

export function getSupabase(role: SupabaseRole = "holder"): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (isPrivilegedKey(publishableKey!)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret / service_role key. " +
        "That key bypasses Row-Level Security and must never be shipped to the " +
        "browser. Use the project's publishable key (sb_publishable_…) and rotate " +
        "the exposed secret key.",
    );
  }
  let client = clients.get(role);
  if (!client) {
    client = createClient(url!, publishableKey!, {
      auth: {
        storageKey: `vh-${role}-auth`,
        persistSession: true,
        autoRefreshToken: true,
        // Only the issuer receives magic-link redirects carrying a session.
        detectSessionInUrl: role === "issuer",
      },
    });
    clients.set(role, client);
  }
  return client;
}
