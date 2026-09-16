// SPDX-License-Identifier: Apache-2.0
//
// Passphrase for this browser's private-state store.
//
// levelPrivateStateProvider encrypts what it keeps in IndexedDB — witness data
// and contract signing keys — with a passphrase the app supplies. There is no
// person to ask for one during a proof, and a value shipped in the bundle would
// make the encryption decorative, so each browser generates its own random
// passphrase on first use and reuses it thereafter.
//
// Consequences, deliberately accepted:
//   - Clearing site data loses the passphrase and therefore the stored private
//     state. That is already true of the credential packages in IndexedDB; the
//     patient re-imports them from the issuer.
//   - It protects data at rest against another origin or a casual look at
//     IndexedDB, not against code running on this page.

const STORAGE_KEY = "seath-aid.stateKey";

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The passphrase for this browser, generating and storing one on first use.
 *
 * Falls back to a per-session key when storage is unavailable (private mode,
 * blocked cookies) so the app still works; the store is then simply not
 * readable after a reload.
 */
let sessionFallback: string | null = null;

export function getStateKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 32) return existing;
    const created = randomKey();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    sessionFallback ??= randomKey();
    return sessionFallback;
  }
}
