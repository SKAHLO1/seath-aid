// SPDX-License-Identifier: Apache-2.0
//
// Credential packages: how an issuer hands a patient the private half of a
// credential.
//
// An issued credential has two halves. The PUBLIC half — commitment, revocation
// handle, claim type, label — is recorded in Supabase and on the ledger. The
// PRIVATE half — the nonce and the medical values the commitment hides — must
// reach the patient's device and nowhere else, because the patient supplies it
// as witness data when proving.
//
// A package carries both halves so the patient can check one against the other.
// It CONTAINS MEDICAL DATA. It is built in the issuer's browser, moved by
// copy/paste, stored only in the patient's browser, and must never be logged,
// sent to Supabase, or included in an error message.

import type { PureCircuits } from "@/contracts/src/managed/verihealth/contract/index.js";

import type { ClaimType } from "./claim-types";
import { CLAIM_TYPES, toEpochDays } from "./claim-types";
import {
  bytes32,
  fromHex,
  toHex,
  type CoveragePolicy,
  type HeldCredential,
  type LabResult,
  type VaccinationRecord,
} from "./private-state";

export const PACKAGE_PREFIX = "vhcred1:";

const HEX32 = /^[0-9a-f]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]{0,19})$/;

export type CredentialPackageV1 = {
  v: 1;
  claimType: ClaimType;
  issuerName: string;
  /** Hex, 32 bytes. */
  issuerPublicKey: string;
  /** Hex, 32 bytes. Blinds the commitment; secret. */
  nonce: string;
  displayLabel: string;
  /** Hex, 32 bytes. Must equal the recomputed commitment. */
  commitment: string;
  /** Hex, 32 bytes. Must equal the recomputed revocation handle. */
  handle: string;
  /** Exactly one payload, matching claimType. Bytes as hex, bigints decimal. */
  vaccination?: { vaccineCode: string; doses: string; completionDate: string };
  lab?: { labCode: string; value: string; measuredDate: string };
  coverage?: { policyRef: string; active: boolean; expiryDate: string };
};

/** What an issuer types into the console. Dates are calendar dates. */
export type CredentialInput =
  | { claimType: "vaccination"; vaccineCode: string; doses: bigint; completionDate: Date }
  | { claimType: "lab_threshold"; labCode: string; value: bigint; measuredDate: Date }
  | { claimType: "coverage"; policyRef: string; active: boolean; expiryDate: Date };

/**
 * Deliberately generic messages: a package holds medical values, so no error
 * may echo any field of it.
 */
export class CredentialPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialPackageError";
  }
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodePackage(pkg: CredentialPackageV1): string {
  return PACKAGE_PREFIX + toBase64Url(JSON.stringify(pkg));
}

/** Parses and structurally validates a package. Does not check the maths. */
export function decodePackage(code: string): CredentialPackageV1 {
  const trimmed = code.replace(/\s+/g, "");
  if (!trimmed.startsWith(PACKAGE_PREFIX)) {
    throw new CredentialPackageError("This is not a Seath Aid credential package.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(trimmed.slice(PACKAGE_PREFIX.length)));
  } catch {
    throw new CredentialPackageError("The credential package is damaged or incomplete.");
  }

  const bad = () =>
    new CredentialPackageError("The credential package is malformed.");
  const p = raw as Record<string, unknown>;
  const isHex32 = (v: unknown): v is string => typeof v === "string" && HEX32.test(v);
  const isDec = (v: unknown): v is string => typeof v === "string" && DECIMAL.test(v);
  const isText = (v: unknown, max: number): v is string =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;

  if (!p || typeof p !== "object" || p.v !== 1) throw bad();
  if (!CLAIM_TYPES.includes(p.claimType as ClaimType)) throw bad();
  if (!isHex32(p.issuerPublicKey) || !isHex32(p.nonce)) throw bad();
  if (!isHex32(p.commitment) || !isHex32(p.handle)) throw bad();
  if (!isText(p.issuerName, 200) || !isText(p.displayLabel, 120)) throw bad();

  const claimType = p.claimType as ClaimType;
  const payloads = ["vaccination", "lab", "coverage"].filter((k) => p[k] !== undefined);
  const expected =
    claimType === "vaccination" ? "vaccination" : claimType === "lab_threshold" ? "lab" : "coverage";
  if (payloads.length !== 1 || payloads[0] !== expected) throw bad();

  if (claimType === "vaccination") {
    const r = p.vaccination as Record<string, unknown>;
    if (!r || !isHex32(r.vaccineCode) || !isDec(r.doses) || !isDec(r.completionDate)) throw bad();
  } else if (claimType === "lab_threshold") {
    const r = p.lab as Record<string, unknown>;
    if (!r || !isHex32(r.labCode) || !isDec(r.value) || !isDec(r.measuredDate)) throw bad();
  } else {
    const r = p.coverage as Record<string, unknown>;
    if (!r || !isHex32(r.policyRef) || typeof r.active !== "boolean" || !isDec(r.expiryDate)) {
      throw bad();
    }
  }

  return p as unknown as CredentialPackageV1;
}

// ---------------------------------------------------------------------------
// Building (issuer side)
// ---------------------------------------------------------------------------

/** Encodes a short code (vaccine / lab / policy reference) into 32 bytes. */
function code32(value: string, field: string): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed) throw new CredentialPackageError(`${field} is required.`);
  if (new TextEncoder().encode(trimmed).length > 32) {
    throw new CredentialPackageError(`${field} must be at most 32 bytes.`);
  }
  return bytes32(trimmed);
}

function randomNonce(): Uint8Array {
  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);
  return nonce;
}

/**
 * Builds a credential in the issuer's browser.
 *
 * Uses the contract's own pure circuits, so the commitment recorded here is
 * byte-identical to the one the proving circuit recomputes from the witnesses.
 * The nonce is fresh randomness, so every credential gets a distinct
 * revocation handle.
 */
export function buildCredential(
  pure: PureCircuits,
  issuer: { name: string; publicKeyHex: string },
  input: CredentialInput,
  displayLabel: string,
): CredentialPackageV1 {
  if (!HEX32.test(issuer.publicKeyHex)) {
    throw new CredentialPackageError("Issuer public key is invalid.");
  }
  const label = displayLabel.trim();
  if (!label || label.length > 120) {
    throw new CredentialPackageError("Display label must be 1–120 characters.");
  }

  const issuerPk = fromHex(issuer.publicKeyHex);
  const nonce = randomNonce();
  const base = {
    v: 1 as const,
    claimType: input.claimType,
    issuerName: issuer.name,
    issuerPublicKey: issuer.publicKeyHex,
    nonce: toHex(nonce),
    displayLabel: label,
    handle: toHex(pure.deriveHandle(issuerPk, nonce)),
  };

  switch (input.claimType) {
    case "vaccination": {
      if (input.doses < BigInt(0)) throw new CredentialPackageError("Doses cannot be negative.");
      const record: VaccinationRecord = {
        vaccineCode: code32(input.vaccineCode, "Vaccine code"),
        doses: input.doses,
        completionDate: toEpochDays(input.completionDate),
      };
      return {
        ...base,
        commitment: toHex(pure.commitVaccination(issuerPk, record, nonce)),
        vaccination: {
          vaccineCode: toHex(record.vaccineCode),
          doses: record.doses.toString(),
          completionDate: record.completionDate.toString(),
        },
      };
    }
    case "lab_threshold": {
      if (input.value < BigInt(0)) throw new CredentialPackageError("Lab value cannot be negative.");
      const lab: LabResult = {
        labCode: code32(input.labCode, "Lab code"),
        value: input.value,
        measuredDate: toEpochDays(input.measuredDate),
      };
      return {
        ...base,
        commitment: toHex(pure.commitLabResult(issuerPk, lab, nonce)),
        lab: {
          labCode: toHex(lab.labCode),
          value: lab.value.toString(),
          measuredDate: lab.measuredDate.toString(),
        },
      };
    }
    case "coverage": {
      const coverage: CoveragePolicy = {
        policyRef: code32(input.policyRef, "Policy reference"),
        active: input.active,
        expiryDate: toEpochDays(input.expiryDate),
      };
      return {
        ...base,
        commitment: toHex(pure.commitCoverage(issuerPk, coverage, nonce)),
        coverage: {
          policyRef: toHex(coverage.policyRef),
          active: coverage.active,
          expiryDate: coverage.expiryDate.toString(),
        },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Verification and conversion (patient side)
// ---------------------------------------------------------------------------

function secretOf(pkg: CredentialPackageV1): HeldCredential["secret"] {
  const nonce = fromHex(pkg.nonce);
  if (pkg.vaccination) {
    return {
      nonce,
      record: {
        vaccineCode: fromHex(pkg.vaccination.vaccineCode),
        doses: BigInt(pkg.vaccination.doses),
        completionDate: BigInt(pkg.vaccination.completionDate),
      },
    };
  }
  if (pkg.lab) {
    return {
      nonce,
      lab: {
        labCode: fromHex(pkg.lab.labCode),
        value: BigInt(pkg.lab.value),
        measuredDate: BigInt(pkg.lab.measuredDate),
      },
    };
  }
  return {
    nonce,
    coverage: {
      policyRef: fromHex(pkg.coverage!.policyRef),
      active: pkg.coverage!.active,
      expiryDate: BigInt(pkg.coverage!.expiryDate),
    },
  };
}

/** The public half recorded for a credential, as stored in Supabase. */
export type PublicCredentialRecord = {
  claimType: ClaimType;
  issuerPublicKey: string;
  commitment: string;
  handle: string;
};

/**
 * Recomputes the commitment and handle from the private half and checks them
 * against the package's own claims and, when given, the recorded public half.
 * A mismatch means the package was altered, or belongs to another credential.
 */
export function verifyPackage(
  pure: PureCircuits,
  pkg: CredentialPackageV1,
  recorded?: PublicCredentialRecord,
): boolean {
  const issuerPk = fromHex(pkg.issuerPublicKey);
  const secret = secretOf(pkg);

  const commitment =
    pkg.claimType === "vaccination"
      ? pure.commitVaccination(issuerPk, secret.record!, secret.nonce)
      : pkg.claimType === "lab_threshold"
        ? pure.commitLabResult(issuerPk, secret.lab!, secret.nonce)
        : pure.commitCoverage(issuerPk, secret.coverage!, secret.nonce);
  const handle = pure.deriveHandle(issuerPk, secret.nonce);

  if (toHex(commitment) !== pkg.commitment || toHex(handle) !== pkg.handle) {
    return false;
  }
  if (!recorded) return true;
  return (
    recorded.claimType === pkg.claimType &&
    recorded.issuerPublicKey.toLowerCase() === pkg.issuerPublicKey &&
    recorded.commitment.toLowerCase() === pkg.commitment &&
    recorded.handle.toLowerCase() === pkg.handle
  );
}

/** The holder's view of an imported credential. `id` is the Supabase row id. */
export function toHeldCredential(
  pkg: CredentialPackageV1,
  id: string,
  issuedAt: string,
): HeldCredential {
  return {
    id,
    claimType: pkg.claimType,
    issuerName: pkg.issuerName,
    issuerPk: fromHex(pkg.issuerPublicKey),
    handle: pkg.handle,
    commitment: pkg.commitment,
    displayLabel: pkg.displayLabel,
    issuedAt,
    secret: secretOf(pkg),
  };
}
