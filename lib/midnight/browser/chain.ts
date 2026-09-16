// SPDX-License-Identifier: Apache-2.0
//
// Every contract interaction, against the DEPLOYED contract.
//
// This replaces the in-browser runtime that used to execute circuits against a
// ledger held in the tab. Nothing here is simulated: each function below builds
// a real transaction, proves it on the proof server, has the wallet balance and
// sign it, submits it, and waits for the indexer to confirm it. That costs DUST
// and takes minutes.
//
// HOW A CALL WORKS. midnight-js reads the circuit's witnesses from the private
// state stored under PRIVATE_STATE_ID, so the correct witness bundle has to be
// in that store BEFORE the call — see stagePrivateState(). The store also
// insists on knowing which contract it is scoped to, and while submitCallTx()
// sets that itself, it does so too late for our staging write, so we set it too.
//
// WHY THE MERKLE PATH COMES FROM THE CHAIN. proveX() checks that the
// credential's commitment is a leaf of the on-chain credential tree. The path
// supplied as a witness must therefore be computed from the tree as the chain
// currently holds it, not from any local copy.

import {
  ledger,
  pureCircuits,
  type Ledger,
} from "@/contracts/src/managed/verihealth/contract/index.js";

import { toEpochDays } from "../claim-types";
import type { DemoIssuer } from "../demo-issuer";
import type { OnChainConfig } from "../deployment";
import {
  PRIVATE_STATE_ID,
  bytes32,
  emptyPrivateState,
  fromHex,
  toHex,
  type HeldCredential,
  type PrivateState,
  type ProofOutcome,
} from "../private-state";
import { connectToDeployedContract } from "./contract";
import type { WalletSession } from "./connector";
import { getStateKey } from "./state-key";
import type { buildBrowserProviders } from "./providers";

export type BrowserProviders = ReturnType<typeof buildBrowserProviders>;

/**
 * The connected contract, narrowed to what this module uses.
 *
 * `callTx` is generated per circuit by midnight-js; typing it precisely would
 * mean threading the contract's generics through every call site for no safety
 * the wrappers below do not already provide.
 */
export type ContractHandle = {
  callTx: Record<string, (...args: never[]) => Promise<CallTxResult>>;
};

type CallTxResult = {
  public: { txId: string; txHash: string };
};

export type TxReceipt = { txId: string; txHash: string };

export type ChainContext = {
  contract: ContractHandle;
  providers: BrowserProviders;
  contractAddress: string;
};

/** Raised when a transaction cannot be paid for. Worth saying plainly. */
export class InsufficientDustError extends Error {
  constructor() {
    super(
      "The wallet could not pay for this transaction. Fund it with tNIGHT and " +
        "register that NIGHT for DUST generation, then try again.",
    );
    this.name = "InsufficientDustError";
  }
}

function translate(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/dust|insufficient|unbalanced|fee/i.test(message)) return new InsufficientDustError();
  return error instanceof Error ? error : new Error(message);
}

/**
 * Connects to the deployed contract and returns everything a call needs.
 *
 * The private-state passphrase comes from this browser (see state-key.ts) so
 * the dashboard, the issuer console and /deploy all open the same store.
 */
export async function openChain(
  config: OnChainConfig,
  session: WalletSession,
): Promise<ChainContext> {
  const { contract, providers } = await connectToDeployedContract({
    config,
    session,
    storagePassword: getStateKey(),
  });
  return {
    contract: contract as unknown as ContractHandle,
    providers,
    contractAddress: config.contractAddress,
  };
}

// ---------------------------------------------------------------------------
// Reading public state
// ---------------------------------------------------------------------------

/** The contract's public ledger, exactly as any chain observer sees it. */
export async function readLedger(
  providers: BrowserProviders,
  contractAddress: string,
): Promise<Ledger> {
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state) {
    throw new Error(
      `No contract found at ${contractAddress.slice(0, 12)}… on this network. ` +
        "Check NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS and the wallet's network.",
    );
  }
  // queryContractState returns the state wrapped; ledger() wants the value.
  const value = (state as unknown as { data?: unknown }).data ?? state;
  return ledger(value as Parameters<typeof ledger>[0]);
}

// The pure Ledger helpers live in ../ledger-view so components can import them
// without dragging this module — and its native-addon dependency — into Next's
// prerender pass. Re-exported here because callers of readLedger() want them.
export {
  isIssuerRegistered,
  ledgerView,
  summariseLedger,
  type ChainView,
  type LedgerSummary,
} from "../ledger-view";

// ---------------------------------------------------------------------------
// Calling circuits
// ---------------------------------------------------------------------------

/**
 * Writes the witness bundle the next call will read.
 *
 * Starts from a zeroed private state rather than merging into whatever the last
 * call left behind: a stale nonce or Merkle path from a previous credential
 * would produce a proof that fails deep inside the circuit for no visible
 * reason.
 */
async function stagePrivateState(
  { providers, contractAddress }: ChainContext,
  patch: Partial<PrivateState>,
): Promise<void> {
  providers.privateStateProvider.setContractAddress(contractAddress);
  await providers.privateStateProvider.set(PRIVATE_STATE_ID, {
    ...emptyPrivateState(),
    ...patch,
  });
}

async function call(
  ctx: ChainContext,
  circuitId: string,
  patch: Partial<PrivateState>,
  args: unknown[],
): Promise<TxReceipt> {
  await stagePrivateState(ctx, patch);
  try {
    const result = await ctx.contract.callTx[circuitId](...(args as never[]));
    return { txId: result.public.txId, txHash: result.public.txHash };
  } catch (e) {
    throw translate(e);
  }
}

// ---------------------------------------------------------------------------
// Issuer-side transactions
// ---------------------------------------------------------------------------

/**
 * Registers a demo issuer's public key on chain. One transaction per issuer,
 * and only ever needed once per contract.
 */
export async function registerIssuerOnChain(
  ctx: ChainContext,
  issuer: DemoIssuer,
): Promise<TxReceipt> {
  return call(ctx, "registerIssuer", { issuerSecretKey: bytes32(issuer.secretLabel) }, []);
}

/** Publishes a credential's blinded commitment into the on-chain Merkle tree. */
export async function issueCredentialOnChain(
  ctx: ChainContext,
  issuer: DemoIssuer,
  commitmentHex: string,
): Promise<TxReceipt> {
  return call(ctx, "issueCredential", { issuerSecretKey: bytes32(issuer.secretLabel) }, [
    fromHex(commitmentHex),
  ]);
}

/** Writes a credential's handle to the on-chain revocation registry. */
export async function revokeCredentialOnChain(
  ctx: ChainContext,
  issuer: DemoIssuer,
  handleHex: string,
): Promise<TxReceipt> {
  return call(ctx, "revokeCredential", { issuerSecretKey: bytes32(issuer.secretLabel) }, [
    fromHex(handleHex),
  ]);
}

// ---------------------------------------------------------------------------
// Holder-side proving
// ---------------------------------------------------------------------------

export type ProofOptions = {
  requiredDoses?: bigint;
  threshold?: bigint;
  requireBelow?: boolean;
};

/**
 * Proves one claim about a credential and records the result on chain.
 *
 * The three checks before the call duplicate checks the circuit also makes.
 * That is deliberate: reaching them inside the circuit costs minutes of proving
 * and a DUST fee to arrive at a failure we can detect for free, and the
 * circuit's rejection carries no usable explanation.
 *
 * The outcome is read back from the ledger's `proofResults` rather than taken
 * from the call, because that is the value a verifier checking later will see.
 */
export async function proveClaimOnChain(
  ctx: ChainContext,
  credential: HeldCredential,
  verifierName: string,
  options: ProofOptions = {},
): Promise<ProofOutcome> {
  const l = await readLedger(ctx.providers, ctx.contractAddress);

  const path = l.credentialTree.findPathForLeaf(fromHex(credential.commitment));
  if (!path) {
    throw new Error(
      "This credential is not in the on-chain credential tree, so it cannot be " +
        "proven. Its issuance transaction may still be settling.",
    );
  }
  if (l.revocationRegistry.member(fromHex(credential.handle))) {
    throw new Error("This credential has been revoked by its issuer.");
  }

  const verifierId = bytes32(verifierName);
  const nullifier = pureCircuits.deriveNullifier(
    pureCircuits.deriveHandle(credential.issuerPk, credential.secret.nonce),
    verifierId,
  );
  if (l.usedNullifiers.member(nullifier)) {
    throw new Error(
      "This credential has already been proven to that verifier. The contract " +
        "rejects a second proof to the same verifier.",
    );
  }

  const patch: Partial<PrivateState> = {
    issuerPk: credential.issuerPk,
    nonce: credential.secret.nonce,
    path,
    ...(credential.secret.record ? { record: credential.secret.record } : {}),
    ...(credential.secret.lab ? { lab: credential.secret.lab } : {}),
    ...(credential.secret.coverage ? { coverage: credential.secret.coverage } : {}),
  };

  const today = toEpochDays(new Date());
  let receipt: TxReceipt;
  switch (credential.claimType) {
    case "vaccination":
      receipt = await call(ctx, "proveVaccination", patch, [
        today,
        options.requiredDoses ?? 2n,
        verifierId,
      ]);
      break;
    case "lab_threshold":
      receipt = await call(ctx, "proveLabThreshold", patch, [
        options.threshold ?? 200n,
        options.requireBelow ?? true,
        verifierId,
      ]);
      break;
    case "coverage":
      receipt = await call(ctx, "proveCoverage", patch, [today, verifierId]);
      break;
    default:
      // Unreachable for a well-formed credential, but a new claim type added
      // to ClaimType without a branch here must fail loudly, not silently
      // submit nothing and report a result.
      throw new Error(`No proving circuit for claim type "${credential.claimType}".`);
  }

  const after = await readLedger(ctx.providers, ctx.contractAddress);
  const result = after.proofResults.member(nullifier)
    ? after.proofResults.lookup(nullifier)
    : false;

  return { result, nullifier: toHex(nullifier), ...receipt };
}
