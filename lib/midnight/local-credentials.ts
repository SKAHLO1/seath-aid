// SPDX-License-Identifier: Apache-2.0
//
// The patient's on-device store of imported credential packages.
//
// This is the ONLY place a credential's private half (nonce and medical values)
// is persisted. It lives in this browser's IndexedDB, is keyed by the opaque
// revocation handle, and is never sent anywhere. Clearing site data deletes it,
// after which the patient needs the package from the issuer again.
//
// Native IndexedDB rather than a helper library: the store is four operations
// on one object store, and adding a dependency for that is not worth it.

import type { CredentialPackageV1 } from "./credential-package";

const DB_NAME = "verihealth-credentials";
const STORE = "packages";
const VERSION = 1;

export function localCredentialsAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!localCredentialsAvailable()) {
      reject(new Error("This browser has no IndexedDB; credentials cannot be stored."));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "handle" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open credential store."));
  });
}

function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Credential store operation failed."));
        tx.oncomplete = () => db.close();
        tx.onabort = () => db.close();
      }),
  );
}

export async function saveLocalCredential(pkg: CredentialPackageV1): Promise<void> {
  await run("readwrite", (s) => s.put(pkg));
}

export async function getLocalCredential(handle: string): Promise<CredentialPackageV1 | null> {
  const found = await run<CredentialPackageV1 | undefined>("readonly", (s) => s.get(handle));
  return found ?? null;
}

export async function listLocalCredentials(): Promise<CredentialPackageV1[]> {
  return run<CredentialPackageV1[]>("readonly", (s) => s.getAll());
}

export async function deleteLocalCredential(handle: string): Promise<void> {
  await run("readwrite", (s) => s.delete(handle));
}
