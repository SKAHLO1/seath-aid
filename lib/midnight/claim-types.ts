// SPDX-License-Identifier: Apache-2.0
//
// Shared claim-type definitions. Adding a fourth claim type means adding one
// entry here plus a commitment scheme and predicate in the Compact contract;
// the dashboard, verifier view, and issuer console all read from this table.

export type ClaimType = "vaccination" | "lab_threshold" | "coverage";

export const CLAIM_TYPES: ClaimType[] = ["vaccination", "lab_threshold", "coverage"];

export type ClaimTypeMeta = {
  id: ClaimType;
  label: string;
  /** What the verifier learns. Never the underlying value. */
  provesWhat: string;
  /** Which inputs are public in the circuit, for the UI's transparency panel. */
  publicInputs: string[];
  /** Which inputs stay private witnesses. */
  privateInputs: string[];
  accent: string;
};

export const CLAIM_TYPE_META: Record<ClaimType, ClaimTypeMeta> = {
  vaccination: {
    id: "vaccination",
    label: "Vaccination",
    provesWhat: "Fully vaccinated as of a given date",
    publicInputs: ["Current date", "Required dose count", "Verifier identity"],
    privateInputs: ["Vaccine code", "Dose count", "Completion date", "Credential nonce"],
    accent: "emerald",
  },
  lab_threshold: {
    id: "lab_threshold",
    label: "Lab Threshold",
    provesWhat: "A lab value meets a threshold",
    publicInputs: ["Threshold", "Comparison direction", "Verifier identity"],
    privateInputs: ["Lab code", "Exact lab value", "Measurement date", "Credential nonce"],
    accent: "sky",
  },
  coverage: {
    id: "coverage",
    label: "Coverage",
    provesWhat: "Insurance coverage active as of a given date",
    publicInputs: ["Current date", "Verifier identity"],
    privateInputs: ["Policy reference", "Policy status", "Policy expiry", "Credential nonce"],
    accent: "violet",
  },
};

/** Days since the Unix epoch — the date encoding used throughout the circuits. */
export function toEpochDays(date: Date): bigint {
  return BigInt(Math.floor(date.getTime() / 86_400_000));
}

export function fromEpochDays(days: bigint): Date {
  return new Date(Number(days) * 86_400_000);
}
