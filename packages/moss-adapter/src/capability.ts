import canonicalize from "canonicalize";
import {
  AssetSchema,
  EvmAddressSchema,
  ProtocolIdSchema,
  type Asset,
  type EvmAddress,
  type ProtocolId,
} from "@moss-mini-demo/report-schema";
import { smallestUnitToHumanDecimal } from "./amount.js";
import { assetKey, createAssetCatalogSnapshot } from "./asset-catalog.js";
import { MossAdapterError, type MossAdapterErrorCode } from "./errors.js";
import {
  CAPABILITY_DIGEST_DOMAIN,
  capabilityDigestFromSnapshot,
  currentCapabilityDigest,
  currentCapabilityMatchesSnapshot,
  isJsonDescriptorClosedInput,
  isJsonExactValue,
  observeCapability,
} from "./integrity.js";
import {
  createSelectedQuoteDigest,
  validateQuoteCollectionRequest,
} from "./quote.js";
import type {
  ActionInput,
  CapabilityConstructionPolicyV0_1,
  CapabilityConstructionResultV0_1,
  JsonValue,
  MossPort,
  QuoteCandidateOutcomeV0_1,
  QuoteCollectionRequestV0_1,
  QuoteCollectionResultV0_1,
  RawCapabilityEvidence,
  SelectedQuoteDigestV0_1,
} from "./types.js";

type SelectedResult = Extract<
  QuoteCollectionResultV0_1,
  { status: "SELECTED" }
>;
type EligibleOutcome = Extract<
  QuoteCandidateOutcomeV0_1,
  { status: "ELIGIBLE" }
>;

const UINT256 = /^sha256:[0-9a-f]{64}$/;
const POLICY_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SOURCE_VERSION =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const SOURCE_REFERENCE = /^test\/[a-z0-9][a-z0-9._/@-]{0,122}$/;
const POLICY_KEYS = [
  "schemaVersion",
  "policyId",
  "sourceVersion",
  "provenance",
  "sourceReference",
  "chainId",
  "catalogDigest",
  "protocolId",
  "inputAsset",
  "outputAsset",
  "expectedNodeCount",
  "expectedTransactionTargets",
] as const;
const NODE_COUNT_KEYS = [
  "capabilityNodes",
  "transactionNodes",
  "totalNodes",
] as const;
const TARGET_KEYS = ["address", "role"] as const;
const CATALOG_KEYS = [
  "schemaVersion",
  "catalogId",
  "sourceVersion",
  "provenance",
  "sourceReference",
  "chainId",
  "validFrom",
  "validUntil",
  "entries",
  "digest",
] as const;
const SELECTION_KEYS = [
  "status",
  "method",
  "catalog",
  "outcomes",
  "selected",
] as const;
const SELECTED_KEYS = ["protocolId", "digest"] as const;
const SELECTED_DIGEST_KEYS = ["algorithm", "value", "payload"] as const;
const ACTION_ERROR_CODES = new Set([
  "INVALID_INPUT",
  "CHAIN_ID_MISMATCH",
  "SOURCE_CONTRACT_VIOLATION",
  "UNSUPPORTED_PROTOCOL",
  "UNSUPPORTED_METHOD",
  "ACTION_FAILED",
]);

function invalidInput(): never {
  throw new MossAdapterError("INVALID_INPUT", "action");
}

function sourceViolation(): never {
  throw new MossAdapterError("SOURCE_CONTRACT_VIOLATION", "action");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function keysEqual(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function parseWith<T>(
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  value: unknown,
): T {
  try {
    const parsed = schema.safeParse(value);
    if (!parsed.success || parsed.data === undefined) {
      return invalidInput();
    }
    return parsed.data;
  } catch {
    return invalidInput();
  }
}

function parseAsset(value: unknown): Asset {
  return parseWith(AssetSchema, value);
}

function assetsEqual(left: Asset, right: Asset): boolean {
  return assetKey(left) === assetKey(right);
}

function cloneInput(value: unknown): unknown {
  try {
    return structuredClone(value);
  } catch {
    return invalidInput();
  }
}

function parsePolicy(value: unknown): CapabilityConstructionPolicyV0_1 {
  if (!isJsonExactValue(value) || !isRecord(value)) {
    return invalidInput();
  }
  const cloned = cloneInput(value);
  if (!isRecord(cloned) || !keysEqual(cloned, POLICY_KEYS)) {
    return invalidInput();
  }
  if (
    cloned.schemaVersion !== "0.1" ||
    typeof cloned.policyId !== "string" ||
    !POLICY_ID.test(cloned.policyId) ||
    typeof cloned.sourceVersion !== "string" ||
    !SOURCE_VERSION.test(cloned.sourceVersion) ||
    cloned.provenance !== "SYNTHETIC_TEST" ||
    typeof cloned.sourceReference !== "string" ||
    !SOURCE_REFERENCE.test(cloned.sourceReference) ||
    cloned.chainId !== 143 ||
    typeof cloned.catalogDigest !== "string" ||
    !UINT256.test(cloned.catalogDigest) ||
    !isRecord(cloned.expectedNodeCount) ||
    !keysEqual(cloned.expectedNodeCount, NODE_COUNT_KEYS) ||
    !Array.isArray(cloned.expectedTransactionTargets)
  ) {
    invalidInput();
  }

  const protocolId = parseWith<ProtocolId>(ProtocolIdSchema, cloned.protocolId);
  const inputAsset = parseAsset(cloned.inputAsset);
  const outputAsset = parseAsset(cloned.outputAsset);
  const counts = cloned.expectedNodeCount;
  const capabilityNodes = counts.capabilityNodes;
  const transactionNodes = counts.transactionNodes;
  const totalNodes = counts.totalNodes;
  if (
    typeof capabilityNodes !== "number" ||
    !Number.isSafeInteger(capabilityNodes) ||
    capabilityNodes < 1 ||
    typeof transactionNodes !== "number" ||
    !Number.isSafeInteger(transactionNodes) ||
    transactionNodes < 0 ||
    typeof totalNodes !== "number" ||
    !Number.isSafeInteger(totalNodes) ||
    totalNodes !== capabilityNodes + transactionNodes
  ) {
    return invalidInput();
  }

  const targets = cloned.expectedTransactionTargets.map((entry) => {
    if (!isRecord(entry) || !keysEqual(entry, TARGET_KEYS)) {
      return invalidInput();
    }
    const address = parseWith<EvmAddress>(EvmAddressSchema, entry.address);
    if (
      entry.role !== "PROTOCOL" &&
      entry.role !== "SPENDER" &&
      entry.role !== "TOKEN"
    ) {
      return invalidInput();
    }
    return Object.freeze({ address, role: entry.role });
  });
  if (
    new Set(targets.map((target) => target.address)).size !== targets.length
  ) {
    return invalidInput();
  }

  return deepFreeze({
    schemaVersion: "0.1" as const,
    policyId: cloned.policyId,
    sourceVersion: cloned.sourceVersion,
    provenance: "SYNTHETIC_TEST" as const,
    sourceReference: cloned.sourceReference,
    chainId: 143 as const,
    catalogDigest: cloned.catalogDigest as `sha256:${string}`,
    protocolId,
    inputAsset,
    outputAsset,
    expectedNodeCount: {
      capabilityNodes,
      transactionNodes,
      totalNodes,
    },
    expectedTransactionTargets: targets,
  });
}

function digestEqual(
  left: SelectedQuoteDigestV0_1,
  right: SelectedQuoteDigestV0_1,
): boolean {
  try {
    return (
      left.algorithm === "RFC8785-SHA256" &&
      right.algorithm === "RFC8785-SHA256" &&
      left.value === right.value &&
      canonicalize(left.payload) === canonicalize(right.payload)
    );
  } catch {
    return false;
  }
}

function parseSelection(value: unknown): Readonly<{
  selection: SelectedResult;
  outcome: EligibleOutcome;
  digest: SelectedQuoteDigestV0_1;
}> {
  if (!isJsonDescriptorClosedInput(value)) {
    return invalidInput();
  }
  const cloned = cloneInput(value);
  if (
    !isRecord(cloned) ||
    !keysEqual(cloned, SELECTION_KEYS) ||
    cloned.status !== "SELECTED" ||
    cloned.method !== "DETERMINISTIC_CANDIDATE_SELECTION_V0_1" ||
    !isRecord(cloned.selected) ||
    !keysEqual(cloned.selected, SELECTED_KEYS) ||
    !Array.isArray(cloned.outcomes) ||
    !isRecord(cloned.catalog) ||
    !keysEqual(cloned.catalog, CATALOG_KEYS)
  ) {
    return invalidInput();
  }
  const selectedProtocol = parseWith<ProtocolId>(
    ProtocolIdSchema,
    cloned.selected.protocolId,
  );
  const selectedDigest = cloned.selected.digest;
  if (
    !isRecord(selectedDigest) ||
    !keysEqual(selectedDigest, SELECTED_DIGEST_KEYS) ||
    selectedDigest.algorithm !== "RFC8785-SHA256" ||
    typeof selectedDigest.value !== "string" ||
    !UINT256.test(selectedDigest.value) ||
    !isRecord(selectedDigest.payload)
  ) {
    return invalidInput();
  }

  const { digest: catalogDigest, ...catalogValue } = cloned.catalog;
  if (
    typeof catalogDigest !== "string" ||
    !UINT256.test(catalogDigest) ||
    cloned.catalog.provenance !== "SYNTHETIC_TEST"
  ) {
    return invalidInput();
  }
  const rebuiltCatalog = createAssetCatalogSnapshot(catalogValue as never);
  if (
    rebuiltCatalog.digest !== catalogDigest ||
    canonicalize(rebuiltCatalog) !== canonicalize(cloned.catalog)
  ) {
    return invalidInput();
  }

  const matches = cloned.outcomes.filter(
    (outcome): outcome is EligibleOutcome =>
      isRecord(outcome) &&
      outcome.status === "ELIGIBLE" &&
      outcome.protocolId === selectedProtocol,
  );
  if (matches.length !== 1) {
    return invalidInput();
  }
  const outcome = matches[0];
  if (outcome === undefined) {
    return invalidInput();
  }
  let expectedDigest: SelectedQuoteDigestV0_1;
  try {
    expectedDigest = createSelectedQuoteDigest(outcome);
  } catch {
    return invalidInput();
  }
  if (!digestEqual(expectedDigest, selectedDigest as SelectedQuoteDigestV0_1)) {
    return invalidInput();
  }

  return Object.freeze({
    selection: cloned as unknown as SelectedResult,
    outcome,
    digest: expectedDigest,
  });
}

function assertAssociation(
  selection: SelectedResult,
  outcome: EligibleOutcome,
  request: QuoteCollectionRequestV0_1,
  policy: CapabilityConstructionPolicyV0_1,
): void {
  const normalized = outcome.normalized;
  if (
    selection.selected.protocolId !== policy.protocolId ||
    selection.catalog.digest !== policy.catalogDigest ||
    normalized.chainId !== 143 ||
    normalized.protocolId !== policy.protocolId ||
    normalized.method !== request.quoteInput.method ||
    normalized.account !== request.quoteInput.account ||
    normalized.inputAmount !== request.amountIn ||
    normalized.catalog.digest !== policy.catalogDigest ||
    normalized.catalog.catalogId !== selection.catalog.catalogId ||
    normalized.catalog.sourceVersion !== selection.catalog.sourceVersion ||
    normalized.catalog.provenance !== "SYNTHETIC_TEST" ||
    normalized.catalog.sourceReference !== selection.catalog.sourceReference ||
    normalized.mossSource.provenance !== "SYNTHETIC_FAKE" ||
    outcome.raw.source.mossOriginal.source.provenance !== "SYNTHETIC_FAKE" ||
    !assetsEqual(normalized.inputAsset, request.inputAsset) ||
    !assetsEqual(normalized.outputAsset, request.outputAsset) ||
    !assetsEqual(policy.inputAsset, request.inputAsset) ||
    !assetsEqual(policy.outputAsset, request.outputAsset)
  ) {
    invalidInput();
  }
}

function actionInput(
  request: QuoteCollectionRequestV0_1,
  humanAmount: string,
): ActionInput {
  const params = request.quoteInput.params;
  return deepFreeze({
    method: request.quoteInput.method,
    account: request.quoteInput.account,
    params: {
      ...params,
      inputAsset: request.inputAsset,
      outputAsset: request.outputAsset,
      amountIn: humanAmount,
    } satisfies JsonValue,
  });
}

async function invokeAction(
  port: MossPort,
  protocolId: ProtocolId,
  input: ActionInput,
): Promise<RawCapabilityEvidence> {
  let action: MossPort["action"];
  try {
    action = port.action;
  } catch {
    return invalidInput();
  }
  if (typeof action !== "function") {
    return invalidInput();
  }
  try {
    return await action.call(port, protocolId, input);
  } catch (error) {
    let code: MossAdapterErrorCode = "ACTION_FAILED";
    try {
      if (
        error instanceof MossAdapterError &&
        ACTION_ERROR_CODES.has(error.code)
      ) {
        code = error.code;
      }
    } catch {
      code = "ACTION_FAILED";
    }
    throw new MossAdapterError(code, "action");
  }
}

function verifyActionEvidence(
  evidence: RawCapabilityEvidence,
  protocolId: ProtocolId,
  method: string,
): void {
  try {
    if (
      evidence.operation.chainId !== 143 ||
      evidence.operation.protocolId !== protocolId ||
      evidence.operation.method !== method ||
      evidence.mossOriginal.source.layer !== "MOSS_ORIGINAL" ||
      evidence.mossOriginal.source.provenance !== "SYNTHETIC_FAKE" ||
      evidence.miniDemoDerived.source.layer !== "MINI_DEMO_DERIVED" ||
      evidence.miniDemoDerived.integrity.status !== "NOT_EVALUATED" ||
      evidence.miniDemoDerived.integrity.reason !== "DEFERRED_TO_M2_06" ||
      evidence.mossOriginal.value === evidence.miniDemoDerived.snapshot ||
      !Object.isFrozen(evidence.miniDemoDerived.snapshot)
    ) {
      sourceViolation();
    }
  } catch {
    sourceViolation();
  }
}

export async function constructCapabilityV0_1(
  port: MossPort,
  selectionValue: SelectedResult,
  requestValue: QuoteCollectionRequestV0_1,
  policyValue: CapabilityConstructionPolicyV0_1,
): Promise<CapabilityConstructionResultV0_1> {
  const parsedSelection = parseSelection(selectionValue);
  if (!isJsonDescriptorClosedInput(requestValue)) {
    return invalidInput();
  }
  const request = validateQuoteCollectionRequest(requestValue);
  const policy = parsePolicy(policyValue);
  assertAssociation(
    parsedSelection.selection,
    parsedSelection.outcome,
    request,
    policy,
  );

  const amount = smallestUnitToHumanDecimal(
    request.amountIn,
    parsedSelection.outcome.normalized.inputDecimals,
  );
  const input = actionInput(request, amount.humanDecimal);
  const evidence = await invokeAction(port, policy.protocolId, input);
  verifyActionEvidence(evidence, policy.protocolId, input.method);

  const raw = evidence.mossOriginal.value;
  const snapshot = evidence.miniDemoDerived.snapshot;
  if (!currentCapabilityMatchesSnapshot(raw, snapshot)) {
    return sourceViolation();
  }
  const digest = capabilityDigestFromSnapshot(snapshot);
  const observation = observeCapability(snapshot);
  if (
    digest === undefined ||
    observation === undefined ||
    observation.rootProtocol !== policy.protocolId ||
    observation.rootMethod !== input.method
  ) {
    return sourceViolation();
  }

  const expectedAddresses = new Set(
    policy.expectedTransactionTargets.map((target) => target.address),
  );
  const unexpected = Object.freeze(
    observation.transactionTargets.filter(
      (address) => !expectedAddresses.has(address),
    ),
  );
  const observedAddresses = new Set(observation.transactionTargets);
  const targetsExpected =
    unexpected.length === 0 &&
    policy.expectedTransactionTargets.every((target) =>
      observedAddresses.has(target.address),
    );
  const nodeCountExpected =
    observation.nodeCount.capabilityNodes ===
      policy.expectedNodeCount.capabilityNodes &&
    observation.nodeCount.transactionNodes ===
      policy.expectedNodeCount.transactionNodes &&
    observation.nodeCount.totalNodes === policy.expectedNodeCount.totalNodes;

  const verifyCurrentIntegrity = () => {
    const actualDigest = currentCapabilityDigest(raw);
    if (actualDigest === undefined) {
      return Object.freeze({
        status: "UNPROVABLE" as const,
        expectedDigest: digest,
        actualDigest: null,
      });
    }
    return Object.freeze({
      status:
        actualDigest === digest ? ("MATCH" as const) : ("MISMATCH" as const),
      expectedDigest: digest,
      actualDigest,
    });
  };

  const miniDemoDerived = Object.freeze({
    source: evidence.miniDemoDerived.source,
    snapshot,
    selectedQuoteDigest: parsedSelection.digest,
    amount,
    integrity: Object.freeze({
      algorithm: "RFC8785-SHA256" as const,
      domain: CAPABILITY_DIGEST_DOMAIN,
      digest,
    }),
    nodeCount: Object.freeze({
      status: nodeCountExpected
        ? ("EXPECTED" as const)
        : ("UNEXPECTED" as const),
      expected: policy.expectedNodeCount,
      actual: observation.nodeCount,
    }),
    transactionTargets: Object.freeze({
      status: targetsExpected ? ("EXPECTED" as const) : ("UNEXPECTED" as const),
      expected: policy.expectedTransactionTargets,
      observed: observation.transactionTargets,
      unexpected,
    }),
  });

  return Object.freeze({
    status: "CONSTRUCTED_SYNTHETIC" as const,
    operation: evidence.operation,
    actionInput: input,
    mossOriginal: evidence.mossOriginal,
    simulatorInput: raw,
    miniDemoDerived,
    verifyCurrentIntegrity,
  });
}
