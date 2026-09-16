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
// COMPLEXITY. The provider validates the passphrase and rejects anything using
// fewer than 3 of {uppercase, lowercase, digits, special}. A hex string is only
// 2 (lowercase + digits), which failed every connect with:
//
//   Password must contain at least 3 of: uppercase letters, lowercase letters,
//   digits, special characters. Found: 2
//
// So the generator below draws from all four classes and guarantees at least
// one of each, rather than relying on chance.
//
// Consequences, deliberately accepted:
//   - Clearing site data loses the passphrase and therefore the stored private
//     state. That is already true of the credential packages in IndexedDB; the
//     patient re-imports them from the issuer.
//   - It protects data at rest against another origin or a casual look at
//     IndexedDB, not against code running on this page.

const STORAGE_KEY = "seath-aid.stateKey";
const KEY_LENGTH = 32;

const CLASSES = [
  "abcdefghijklmnopqrstuvwxyz",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "0123456789",
  // Deliberately conservative: no quotes, backslash, or whitespace, so the
  // value stays safe to log, copy, or place in a config file if ever needed.
  "!@#$%^&*-_=+",
];

const ALL = CLASSES.join("");

/** How many of the four character classes this string uses. */
function classCount(value: string): number {
  return CLASSES.filter((set) => [...value].some((ch) => set.includes(ch))).length;
}

/** The provider's rule: at least 3 of the 4 classes. */
function meetsComplexity(value: string): boolean {
  return value.length >= 16 && classCount(value) >= 3;
}

function randomInt(bound: number): number {
  // Rejection sampling keeps the distribution uniform; a plain modulo would
  // bias toward the first `2^32 % bound` characters of the alphabet.
  const limit = Math.floor(0xffffffff / bound) * bound;
  const buf = new Uint32Array(1);
  let n = 0;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return n % bound;
}

function randomKey(): string {
  // One from each class first, so the complexity rule cannot be missed.
  const chars = CLASSES.map((set) => set[randomInt(set.length)]);
  while (chars.length < KEY_LENGTH) {
    chars.push(ALL[randomInt(ALL.length)]);
  }
  // Fisher-Yates, so the guaranteed characters are not always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * The passphrase for this browser, generating and storing one on first use.
 *
 * A stored value that does not meet the complexity rule is replaced rather than
 * returned: earlier builds saved a hex key that the provider rejects, and
 * handing it back would make this error survive the fix. Discarding it is safe
 * because a rejected passphrase means no store was ever successfully written.
 *
 * Falls back to a per-session key when storage is unavailable (private mode,
 * blocked cookies) so the app still works; the store is then simply not
 * readable after a reload.
 */
let sessionFallback: string | null = null;

export function getStateKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && meetsComplexity(existing)) return existing;
    const created = randomKey();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    sessionFallback ??= randomKey();
    return sessionFallback;
  }
}
