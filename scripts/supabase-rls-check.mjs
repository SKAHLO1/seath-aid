// SPDX-License-Identifier: Apache-2.0
//
// Exercises the Supabase schema's access rules against a LOCAL stack.
//
//   npx supabase@2.117.0 start
//   eval "$(npx supabase@2.117.0 status -o env)"
//   export API_URL PUBLISHABLE_KEY SECRET_KEY
//   node scripts/supabase-rls-check.mjs
//
// Clients use the PUBLISHABLE key, exactly as the browser does. The SECRET key
// is used only to create a throwaway issuer account and to perform the one-off
// administrator binding. Legacy ANON_KEY / SERVICE_ROLE_KEY are accepted as
// fallbacks (Supabase deprecates them by the end of 2026).
//
// LOCAL ONLY — never point it at a hosted project. It refuses to run unless
// API_URL is a localhost address. Every run uses fresh wallet addresses and a
// fresh email, so it can be re-run.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.API_URL;
const anonKey = process.env.PUBLISHABLE_KEY || process.env.ANON_KEY;
const serviceKey = process.env.SECRET_KEY || process.env.SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Set API_URL, PUBLISHABLE_KEY and SECRET_KEY (see header).");
  process.exit(2);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  console.error(`Refusing to run against non-local API_URL: ${url}`);
  process.exit(2);
}

const hex32 = () => randomBytes(32).toString("hex");
const run = randomBytes(4).toString("hex");
const walletA = `mn_addr_test_${run}_holder_a`;
const walletC = `mn_addr_test_${run}_holder_c`;

const client = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) failures += 1;
}

async function anonymousHolder() {
  const c = client();
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`anonymous sign-in failed: ${error.message}`);
  return c;
}

// --- actors -----------------------------------------------------------------

const holderA = await anonymousHolder();
const holderB = await anonymousHolder();
const holderC = await anonymousHolder();
const unauthenticated = client();

const email = `issuer-${run}@verihealth.test`;
const password = `pw-${hex32()}`;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw new Error(`createUser failed: ${created.error.message}`);
const issuerUserId = created.data.user.id;

const issuer = client();
{
  const { error } = await issuer.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`issuer sign-in failed: ${error.message}`);
}

// Administrator binding, exactly as the README snippet does it.
{
  const { error } = await admin
    .from("issuers")
    .update({ auth_user_id: issuerUserId })
    .eq("is_demo", true);
  if (error) throw new Error(`binding failed: ${error.message}`);
}

// --- holders ----------------------------------------------------------------

{
  const { data, error } = await holderA.rpc("ensure_holder", { p_wallet_address: walletA });
  check("holder A binds its wallet", !error && typeof data === "string", error?.message);
  const again = await holderA.rpc("ensure_holder", { p_wallet_address: walletA });
  check("ensure_holder is idempotent for the same wallet", !again.error && again.data === data);
}
{
  const { error } = await holderB.rpc("ensure_holder", { p_wallet_address: walletA });
  check("holder B cannot claim holder A's wallet", !!error);
}
{
  const { error } = await holderA.rpc("ensure_holder", { p_wallet_address: `${walletA}_other` });
  check("a bound session cannot switch to another wallet", !!error);
}
{
  const { error } = await unauthenticated.rpc("ensure_holder", { p_wallet_address: walletC });
  check("unauthenticated (anon role) cannot call ensure_holder", !!error);
}
{
  const { error, count } = await holderA
    .from("holders")
    .update({ wallet_address: walletC }, { count: "exact" })
    .eq("wallet_address", walletA);
  check("holder cannot rewrite its wallet address directly", !!error || count === 0);
}

// --- issuance ---------------------------------------------------------------

const { data: myIssuers } = await issuer
  .from("issuers")
  .select("id, name, public_key")
  .eq("auth_user_id", issuerUserId);
check("issuer operator is bound to all 3 demo issuers", myIssuers?.length === 3);
const issuerId = myIssuers?.[0]?.id;

const handleA = hex32();
const commitmentA = hex32();
let credentialA;
{
  const { data, error } = await issuer.rpc("issue_credential", {
    p_issuer_id: issuerId,
    p_wallet_address: walletA,
    p_claim_type: "vaccination",
    p_nullifier_hash: handleA,
    p_commitment: commitmentA,
    p_display_label: "MMR immunisation series",
  });
  credentialA = data;
  check("issuer issues a credential to holder A", !error && typeof data === "string", error?.message);
}
{
  const { error } = await holderA.rpc("issue_credential", {
    p_issuer_id: issuerId,
    p_wallet_address: walletA,
    p_claim_type: "vaccination",
    p_nullifier_hash: hex32(),
    p_commitment: hex32(),
    p_display_label: "forged",
  });
  check("an anonymous holder cannot issue", !!error);
}
{
  const { error } = await issuer.from("credentials").insert({
    holder_id: credentialA,
    issuer_id: issuerId,
    claim_type: "vaccination",
    nullifier_hash: hex32(),
    commitment: hex32(),
    display_label: "direct insert",
  });
  check("direct INSERT into credentials is blocked (RPC only)", !!error);
}
{
  const { error } = await issuer.rpc("issue_credential", {
    p_issuer_id: issuerId,
    p_wallet_address: walletA,
    p_claim_type: "vaccination",
    p_nullifier_hash: "not-hex",
    p_commitment: hex32(),
    p_display_label: "bad hash",
  });
  check("malformed hashes are rejected by the schema", !!error);
}

// Credential issued before the holder ever connects.
const handleC = hex32();
{
  const { error } = await issuer.rpc("issue_credential", {
    p_issuer_id: issuerId,
    p_wallet_address: walletC,
    p_claim_type: "coverage",
    p_nullifier_hash: handleC,
    p_commitment: hex32(),
    p_display_label: "Health policy",
  });
  check("issuer can issue to a wallet that has not connected yet", !error, error?.message);
}

// --- visibility -------------------------------------------------------------

{
  const { data } = await holderA.from("credentials").select("id, nullifier_hash");
  check("holder A sees its own credential", data?.length === 1 && data[0].nullifier_hash === handleA);
  const b = await holderB.from("credentials").select("id");
  check("holder B sees no credentials", (b.data ?? []).length === 0);
}
{
  const bind = await holderC.rpc("ensure_holder", { p_wallet_address: walletC });
  const { data } = await holderC.from("credentials").select("nullifier_hash");
  check(
    "holder C binds later and then sees the pre-issued credential",
    !bind.error && data?.length === 1 && data[0].nullifier_hash === handleC,
    bind.error?.message,
  );
}
{
  const { data } = await issuer.from("credentials").select("id").eq("id", credentialA);
  check("issuer can read credentials it issued", data?.length === 1);
}

// --- proofs -----------------------------------------------------------------

const reference = randomBytes(16).toString("hex");
{
  const { error } = await holderA.from("proof_requests").insert({
    credential_id: credentialA,
    proof_reference: reference,
    nullifier: hex32(),
    verifier_name: "Acme HR",
    claim_type: "vaccination",
    result: true,
  });
  check("holder A records a proof for its credential", !error, error?.message);
}
{
  const { error } = await holderB.from("proof_requests").insert({
    credential_id: credentialA,
    nullifier: hex32(),
    verifier_name: "Forger",
    claim_type: "vaccination",
    result: true,
  });
  check("holder B cannot record a proof on holder A's credential", !!error);
}
{
  const a = await holderA.from("proof_requests").select("id");
  const b = await holderB.from("proof_requests").select("id");
  check("holder A sees its proof; holder B sees none", a.data?.length === 1 && (b.data ?? []).length === 0);
}
{
  const { data, error } = await unauthenticated.rpc("verify_proof", { reference });
  const row = Array.isArray(data) ? data[0] : data;
  check(
    "an unauthenticated verifier resolves the reference to pass/fail only",
    !error && row?.result === true && row?.revoked === false && !("nullifier" in (row ?? {})),
    error?.message,
  );
}

// --- revocation -------------------------------------------------------------

{
  const a = await holderA.rpc("revoke_credential", { p_credential_id: credentialA });
  const b = await holderB.rpc("revoke_credential", { p_credential_id: credentialA });
  check("holders cannot revoke", !!a.error && !!b.error);
}
{
  const { error, count } = await issuer
    .from("credentials")
    .update({ commitment: hex32() }, { count: "exact" })
    .eq("id", credentialA);
  const { data } = await issuer.from("credentials").select("commitment").eq("id", credentialA);
  check(
    "issuer cannot edit credential columns directly",
    (!!error || count === 0) && data?.[0]?.commitment === commitmentA,
  );
}
let revokedAt;
{
  const { error } = await issuer.rpc("revoke_credential", { p_credential_id: credentialA });
  const { data } = await issuer.from("credentials").select("revoked, revoked_at").eq("id", credentialA);
  revokedAt = data?.[0]?.revoked_at;
  check("issuer revokes its credential", !error && data?.[0]?.revoked === true && !!revokedAt, error?.message);
}
{
  const { error } = await issuer.rpc("revoke_credential", { p_credential_id: credentialA });
  const { data } = await issuer.from("credentials").select("revoked_at").eq("id", credentialA);
  check("revoking twice keeps the original revocation time", !error && data?.[0]?.revoked_at === revokedAt);
}
{
  const { data } = await unauthenticated.rpc("verify_proof", { reference });
  const row = Array.isArray(data) ? data[0] : data;
  check("verify_proof reports the revocation", row?.revoked === true);
}
{
  const { data } = await holderA.from("credentials").select("revoked").eq("id", credentialA);
  check("holder A sees the revocation", data?.[0]?.revoked === true);
}

// --- a mis-bound anonymous user still cannot act as an issuer -----------------

{
  const { data: bUser } = await holderB.auth.getUser();
  await admin.from("issuers").update({ auth_user_id: bUser.user.id }).eq("id", issuerId);
  const { error } = await holderB.rpc("issue_credential", {
    p_issuer_id: issuerId,
    p_wallet_address: walletA,
    p_claim_type: "vaccination",
    p_nullifier_hash: hex32(),
    p_commitment: hex32(),
    p_display_label: "anonymous issuer",
  });
  check("an anonymous session bound to an issuer still cannot issue", !!error);
  await admin.from("issuers").update({ auth_user_id: issuerUserId }).eq("id", issuerId);
}

// --- cleanup ----------------------------------------------------------------

await admin.from("issuers").update({ auth_user_id: null }).eq("auth_user_id", issuerUserId);
await admin.auth.admin.deleteUser(issuerUserId);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
