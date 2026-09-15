# Seath Aid — privacy-first health-record verification on Midnight

Prove a single medical fact without revealing the record behind it.

Health records today force an all-or-nothing trade. To prove one fact — "I'm
vaccinated", "my cholesterol is controlled", "I'm insured" — you hand over a
PDF, a portal login, or a full lab report to whoever is asking. That over-shares
sensitive data and creates breach risk at every verifier.

Seath Aid replaces that with narrow, single-purpose zero-knowledge proofs. A
patient holds their medical facts privately and generates a proof of one
specific claim via a Midnight Compact smart contract. The verifier receives a
boolean. Nothing else ever leaves the patient's device.

---

## What's in this repository

| Area | Status |
|---|---|
| Compact contract, 6 circuits, compiler 0.31.1 / language 0.23 | Complete |
| Vaccination Proof | Complete — contract, tests, UI |
| Lab-Value Threshold Proof | Complete — contract, tests, UI |
| Coverage/Eligibility Proof | Complete — contract, tests, UI |
| Nullifier + revocation registry shared across all claim types | Complete |
| Contract simulation tests (valid / tampered / revoked × 3) | 19 passing |
| Frontend tests (proof flows, credential packages, client config) | 27 passing |
| Supabase schema, RLS, issuance flow | Integrated; 27 RLS checks + end-to-end test pass on a local stack; hosted project not yet created |
| Patient dashboard, verifier view, issuer console, wallet connect | Complete |
| Contract deployed to Midnight preprod | `deployments/preprod.json`; the browser app still runs its own in-memory ledger |

---

## The dual-ledger split

This is the core of the design, and the compiler enforces it. Compact's taint
analysis refuses to compile any flow from a private witness to public state
unless it is explicitly wrapped in `disclose()`. There are exactly four
`disclose()` calls on the proving path, and each one is justified in a comment
in [`contracts/src/verihealth.compact`](contracts/src/verihealth.compact).

**Private state** — supplied as witnesses from the holder's device, never on chain:

- Vaccine code, dose count, completion date
- The exact laboratory value, its lab code and measurement date
- Policy reference, active status, expiry date
- The credential nonce that blinds the on-chain commitment
- The Merkle authentication path (which leaf, and its siblings)
- Issuer secret keys, on issuer-side circuits

**Public state** — the entire ledger, visible to everyone:

- `credentialTree: HistoricMerkleTree<10, Bytes<32>>` — blinded credential commitments
- `registeredIssuers: Set<Bytes<32>>` — demo issuer public keys
- `revocationRegistry: Set<Bytes<32>>` — revoked credential handles
- `usedNullifiers: Set<Bytes<32>>` — spent proof nullifiers
- `proofResults: Map<Bytes<32>, Boolean>` — a bare pass/fail per nullifier
- `proofCount: Counter`

The patient dashboard renders this entire public ledger in a panel, so you can
read everything the chain knows and confirm no medical value is in it. The
contract test suite asserts the same thing programmatically.

## How the attestation works

The PRD calls for an "issuer signature" as a private input. Verifying an ECDSA
signature inside a ZK circuit is expensive, and the naive shortcut — hashing the
issuer's secret key in-circuit — does not actually verify anything, because the
holder does not have that key. So Seath Aid uses the mechanism real verifiable
credential systems use:

1. **Issuance.** The issuer computes
   `commitment = persistentHash(domainTag, issuerPk, ...claimFields, nonce)` and
   calls `issueCredential`, which inserts it into an on-chain Merkle tree. The
   nonce blinds it, so the leaf reveals nothing even to an attacker who guesses
   the claim values.
2. **Proving.** The holder supplies the full preimage plus a Merkle path as
   private witnesses. The circuit recomputes the commitment, proves it is the
   leaf in the path, and checks the path's root against the tree. Altering any
   claim field changes the commitment and breaks membership.
3. **Revocation.** `deriveHandle(issuerPk, nonce)` produces an opaque handle both
   issuer and holder can compute. Revoking writes it to `revocationRegistry`;
   every proving circuit asserts non-membership.
4. **Replay protection.** `deriveNullifier(handle, verifierId)` is unique per
   (credential, verifier). It is inserted on use, so the same proof cannot be
   replayed to the same verifier.

Steps 2–4 live in a single `settleProof` helper circuit shared by all three
claim types. Adding a fourth claim type means adding a commitment scheme and a
predicate; the security-critical path is not duplicated.

---

## Architecture: on-chain vs off-chain

```
   Issuer (simulated clinic/lab/insurer)
     │  computes blinded commitment, calls issueCredential
     ▼
┌──────────────────────────────────────────────┐
│  MIDNIGHT — public ledger                    │
│    credentialTree · registeredIssuers        │
│    revocationRegistry · usedNullifiers       │
│    proofResults (booleans only)              │
└──────────────────────────────────────────────┘
     ▲                                    │
     │ Compact circuit reads/writes       │ pass/fail + nullifier
     │                                    ▼
   Holder's device                    Verifier
     private witnesses:               sees only:
     record · nonce · path            claim type + boolean

┌──────────────────────────────────────────────┐
│  SUPABASE — off-chain metadata (optional)    │
│    issuers · holders                         │
│    credentials (hashes + labels, no values)  │
│    proof_requests (verifier, type, boolean)  │
└──────────────────────────────────────────────┘
```

Supabase holds **only** data that is already public on the ledger, plus UI
labels. Every hash stored there also appears on chain. See the privacy invariant
at the top of [`supabase/migrations/0001_core_schema.sql`](supabase/migrations/0001_core_schema.sql):
there is deliberately no column anywhere for a vaccine code, dose count, lab
value, policy number, or expiry date.

---

## How the Midnight integration works

The frontend executes the **real compiled circuits**. Nothing is mocked.

- `contracts/src/verihealth.compact` is compiled by `compact compile` into
  TypeScript bindings, ZKIR, and prover/verifier keys under
  `contracts/src/managed/verihealth/`.
- [`lib/midnight/runtime.ts`](lib/midnight/runtime.ts) loads those artefacts and
  drives them through `@midnight-ntwrk/compact-runtime` — the same package the
  contract test suite uses and the same one a deployed DApp uses to build
  transactions.
- [`lib/midnight/wallet.ts`](lib/midnight/wallet.ts) implements Midnight's
  DApp connector flow (`dapp-connector-api` 4.x): it enumerates
  `window.midnight`, prefers **1AM**, then Lace, then any other injected wallet,
  and calls `connect(networkId)`. `NEXT_PUBLIC_PREFERRED_WALLET_RDNS` overrides
  the choice. With no wallet installed the UI offers a clearly-labelled demo
  identity so the flow is still walkable.

### Current scope: the ledger runs in the browser

The public ledger is held **in memory in the browser tab**, not on Midnight
testnet. That keeps the complete issue → hold → prove → verify → revoke loop
runnable with no funded wallet, no proof server, and no testnet sync.

What is genuinely enforced by the compiled Compact contract: the private/public
state split, Merkle attestation, the revocation check, nullifier replay
protection, and every claim predicate. What is not wired up yet: pointing the
app at the deployed contract, submitting real transactions, and generating
actual SNARK proofs via the proof server. Because no SNARK is generated in this
mode, the ~39 MB of prover keys are not required at runtime and are gitignored.

The contract itself **is** deployed to preprod — see
[`deployments/preprod.json`](deployments/preprod.json) — and `/deploy` (a
development-only page) deploys a new one from the browser.

Reloading the page resets the in-memory ledger and re-issues the demo
credentials. Navigate between routes using the in-app links so the dashboard,
verifier view, and issuer console share one ledger.

---

## Known privacy limitations

Flagging these rather than hiding them.

1. **Threshold probing on lab values.** The nullifier is scoped per
   (credential, verifier), so one verifier gets one proof per credential and
   cannot binary-search the exact value. A verifier willing to forge multiple
   identities still could. The fix is an issuer-governed allowlist of permitted
   thresholds; not implemented.
2. **Revocation-handle linkability.** Checking `revocationRegistry.member(handle)`
   requires disclosing the handle, so all proofs from one credential are
   correlatable. The handle is an opaque random-looking hash with no medical
   content, but it is a correlation vector. A non-membership accumulator would
   remove it; not implemented.
3. **Assert messages.** Circuit assertions use generic strings, and the UI shows
   a single generic failure message rather than which check failed, so a
   rejected proof does not disclose *why* it was rejected.

## Demo issuer

**Every issuer in this project is simulated.** There is no integration with any
real clinic, laboratory, insurer, or health system anywhere in this codebase.

The demo keypairs are hardcoded and published in
[`lib/midnight/demo-issuer.ts`](lib/midnight/demo-issuer.ts) with a prominent
banner, and the issuer console shows a warning label. They exist so anyone can
run the full loop unattended. In production an issuer key would live in an HSM
and the issuer registry would be a governed allowlist rather than the
self-service `registerIssuer` used here. All medical data is synthetic.

---

## Testing it locally

### Prerequisites

- Node 20+ and pnpm 10+
- A Chromium or Firefox browser
- Optional: a Midnight wallet — [1AM](https://1am.xyz) (the default) or
  [Lace](https://www.lace.io/midnight). Without one the app offers a demo identity.
- Optional, only to recompile the contract: the Compact toolchain (see below)

### Run it

```bash
pnpm install
pnpm build
pnpm start          # http://localhost:3000
```

`pnpm dev` also works. Compiled contract bindings are committed, so no Compact
toolchain is needed just to run the app.

### Walk the demo

1. Open **http://localhost:3000** and click **Open patient dashboard**.
2. The dashboard boots the contract runtime and issues three demo credentials
   through the real issuance circuit — one per claim type. The **Public ledger**
   panel shows 3 registered issuers and 0 proofs.
3. Connect your wallet (1AM by default), or click **Use demo identity**.
4. On the **MMR immunisation series** card, leave the verifier as "Acme Corp HR"
   and click **Generate proof**. This runs `proveVaccination`. You should see
   **Proof passed** and a proof reference. Copy it.
5. Click **Verifier view**. Paste the reference and click **Check**. You see the
   claim type and pass/fail — and confirm the dose count and vaccine code are
   nowhere on the page.
6. Go back and try the **LDL cholesterol panel** card. Set the threshold to
   `200` → passes. Set it to `100` → **Proof failed**. The exact value (150) is
   never shown, and both outcomes reveal only one bit.
7. Click **Issuer console**, then **Revoke credential** on the MMR credential.
   This writes its handle to the on-chain revocation registry.
8. Return to the dashboard. The MMR card is marked **Revoked** and its
   **Generate proof** button is disabled — the circuit would reject it anyway.
   The ledger panel's revoked count is now 1.

### Run the tests

```bash
pnpm test:all
```

Or separately:

```bash
pnpm test:contracts   # 19 Compact simulation tests
pnpm test             # 27 frontend tests (+1 Supabase E2E, skipped without a local stack)
```

Contract tests cover, for each of the three claim types: a valid non-revoked
credential produces a passing proof; a tampered credential fails; a revoked
credential fails even when otherwise valid. They also assert that no medical
value appears anywhere in the serialised public ledger.

### Recompiling the contract

Requires the Compact toolchain. On Linux/macOS:

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
export PATH="$HOME/.local/bin:$PATH"
compact update 0.31.1
pnpm compact
```

On Windows use WSL2. The toolchain is a POSIX shell installer and does not run
under PowerShell. You may need `unzip` and `zstd`:
`sudo apt-get install -y unzip zstd`. The committed artefacts are built with
**Compact compiler 0.31.1 / language version 0.23** — the versions every live
Midnight network currently runs. Newer compilers produce artefacts the networks
reject, so pin this one.

### Optional: Supabase

The app runs fully without it: the demo self-issues three credentials in the
browser and keeps an in-memory proof log. Configuring Supabase switches to the
**issuance flow** — issuers sign in and issue credentials to a patient's wallet,
patients import them, and credentials, proofs, and revocations persist.

1. Create a Supabase project.
2. In the SQL Editor, run the migrations in order:
   `supabase/migrations/0001_core_schema.sql`, `0002_rls_policies.sql`,
   `0003_seed_demo.sql`, `0004_integration.sql`.
3. **Authentication → Sign In / Providers:** enable **Anonymous sign-ins**
   (patients) and keep **Email** enabled (issuers use magic links). Enabling
   CAPTCHA / Turnstile for anonymous sign-ins is strongly recommended.
4. **Authentication → URL Configuration:** set the Site URL, and add
   `http://localhost:3000/issuer` plus your deployed `/issuer` URL to Redirect URLs.
5. Copy `.env.local.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (Project Settings → API Keys, `sb_publishable_…`). Supabase is deprecating the
   legacy anon key by the end of 2026; `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still
   accepted as a fallback.
6. Open `/issuer`, sign in with your email, then link that account to the demo
   issuers once in the SQL Editor:

   ```sql
   update issuers
      set auth_user_id = (select id from auth.users where email = 'you@example.com')
    where is_demo;
   ```

Never use a secret key (`sb_secret_…`) or legacy service-role key in the app — it
bypasses RLS. The client refuses to start with one.

**Issuance flow.** An issuer enters the patient's wallet address and the claim
details on `/issuer`. The credential is built in the issuer's browser; Supabase
records only its commitment, revocation handle, and a label. The issuer gets a
**credential package** (`vhcred1:…`) holding the private details and sends it to
the patient, who pastes it on `/dashboard`. The package is checked against the
record and stored only in that browser's IndexedDB — it never reaches the
server. Revoking on `/issuer` is recorded in Supabase and replayed into the
patient's ledger on their next load.

**RLS model.** Patients are anonymous Supabase users bound to one wallet through
`ensure_holder()`; binding does not prove wallet ownership, which is acceptable
only because all data here is synthetic. Issuer operators are permanent
(email) users bound to one or more issuers by an administrator; anonymous
sessions can never issue or revoke, even if mis-bound. Writes go only through
`issue_credential()` and `revoke_credential()`, which re-check the binding
server-side — there are no direct INSERT/UPDATE policies on `credentials` or
`holders`. A patient reads only their own `credentials` and `proof_requests`.
Verifiers are unauthenticated and never get SELECT on `proof_requests`: they
call `verify_proof(reference)`, which returns claim type, pass/fail, verifier
name, timestamp, and revocation status, and nothing else.

**Verifying the rules locally** (Docker required):

```bash
npx supabase@2.117.0 start            # applies 0001–0004
eval "$(npx supabase@2.117.0 status -o env)"
export API_URL PUBLISHABLE_KEY SECRET_KEY
node scripts/supabase-rls-check.mjs   # 27 access-rule checks
SUPABASE_E2E_API_URL=$API_URL SUPABASE_E2E_PUBLISHABLE_KEY=$PUBLISHABLE_KEY \
SUPABASE_E2E_SECRET_KEY=$SECRET_KEY \
  pnpm vitest run __tests__/supabase-e2e.test.ts   # full flow via app modules
```

Both refuse to run against anything but localhost.

**Current limit.** The ledger is still in-memory per browser, so a patient's tab
rebuilds it from Supabase records by acting as the issuer. Only the demo
issuers' keys are known, so only their credentials can be proven; other issuers'
credentials are recorded but show as not provable until the app uses the
deployed contract.

---

## Project layout

```
contracts/
  src/verihealth.compact          the contract — all 6 circuits
  src/managed/verihealth/         compiler output (bindings committed, keys ignored)
  src/test/                       simulation tests per claim type
lib/
  midnight/                       runtime, wallet, claim types, demo issuer, session
  supabase/                       client, types, proof log
app/
  page.tsx                        landing
  dashboard/                      patient dashboard
  verify/                         simulated verifier view
  issuer/                         issuer console (issue and revoke)
components/ehr/                   provider, credential card, history, ledger panel
supabase/migrations/              schema, RLS, seed
__tests__/                        frontend tests
```

## License

Apache 2.0. See [LICENSE](LICENSE). All Midnight-related code carries an
`SPDX-License-Identifier: Apache-2.0` header.

## Repository setup

After pushing, add the `midnightntwrk` topic to the GitHub repository
(Settings → About → Topics) so it is discoverable as a Midnight project.
