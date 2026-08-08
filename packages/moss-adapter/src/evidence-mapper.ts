import { matchesMossBuildInfo } from "./build-info.js";
import { MossAdapterError } from "./errors.js";
import {
  CAPABILITY_DIGEST_DOMAIN,
  isJsonDescriptorClosedGraph,
  observeCapability,
} from "./integrity.js";
import type {
  JsonValue,
  MiniDemoDerivedSource,
  MossBuildInfo,
  MossOriginalSource,
  RawCapability,
  RawSimulationEvidence,
  SimulationBlockFailureCodeV0_1,
  SimulationBlockVerificationV0_1,
  SimulationRpcObservationV0_1,
  SimulationVerificationStatusV0_1,
  StateContinuityVerificationStatusV0_1,
} from "./types.js";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const GAS = /^(?:0|[1-9][0-9]*)$/;
const BLOCK_QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const BLOCK_HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x(?:[0-9a-fA-F]{2})*$/;
const WARNING_CODES = new Set([
  "REVERTED",
  "TRACE_FAILED",
  "CHANGE_ORDER_UNAVAILABLE",
  "RECEIPT_FAILED",
  "CHANGE_COVERAGE_MISMATCH",
  "STATE_CHAIN_FAILED",
]);
const SOURCE_REFERENCES = Object.freeze([
  "/sourceContext/buildInfo",
  "/mossOriginal/retained/capability",
  "/mossOriginal/retained/simulation",
  "/mossOriginal/transactions",
  "/mossOriginal/changes",
  "/mossOriginal/receipts",
  "/mossOriginal/outcomes",
  "/mossOriginal/warnings",
  "/mossOriginal/gas",
]);

type SimulationResult = Record<string, JsonValue> & {
  protocol: string;
  method: string;
  transaction: Record<string, JsonValue>;
  reverted: boolean;
  receipt?: ReceiptNode;
  changes?: readonly JsonValue[];
  warnings: readonly WarningNode[];
  gas: string | null;
};

type ReceiptNode = Record<string, JsonValue> & {
  kind: "receipt";
  protocol: string;
  outcome: JsonValue;
  text: string;
  changes: readonly JsonValue[];
};

type WarningNode = Record<string, JsonValue> & {
  code: string;
  message: string;
};

export type MapMossEvidenceInputV0_1 = Readonly<{
  protocolId: string;
  method: string;
  buildInfo: MossBuildInfo;
  originalSource: MossOriginalSource;
  derivedSource: MiniDemoDerivedSource;
  capability: unknown;
  retainedCapability: RawCapability;
  simulation: unknown;
  observation: SimulationRpcObservationV0_1;
  preSimulationDigest: `sha256:${string}` | null;
  postSimulationDigest: `sha256:${string}` | null;
}>;

function sourceViolation(): never {
  throw new MossAdapterError("SOURCE_CONTRACT_VIOLATION", "simulate");
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

function cloneGraph(value: JsonValue): JsonValue {
  try {
    return deepFreeze(structuredClone(value));
  } catch {
    return sourceViolation();
  }
}

function isUnsignedTransaction(value: JsonValue): boolean {
  return (
    isRecord(value) &&
    typeof value.from === "string" &&
    ADDRESS.test(value.from) &&
    typeof value.to === "string" &&
    ADDRESS.test(value.to) &&
    typeof value.data === "string" &&
    HEX.test(value.data) &&
    typeof value.value === "string" &&
    /^0x[0-9a-fA-F]+$/.test(value.value)
  );
}

function isChange(value: JsonValue): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind === "event") {
    return (
      typeof value.address === "string" &&
      ADDRESS.test(value.address) &&
      Array.isArray(value.topics) &&
      value.topics.every(
        (topic) => typeof topic === "string" && HEX.test(topic),
      ) &&
      typeof value.data === "string" &&
      HEX.test(value.data)
    );
  }
  return (
    value.kind === "nativeTransfer" &&
    typeof value.from === "string" &&
    ADDRESS.test(value.from) &&
    typeof value.to === "string" &&
    ADDRESS.test(value.to) &&
    typeof value.value === "string" &&
    GAS.test(value.value)
  );
}

function validateReceiptLeaf(value: JsonValue): boolean {
  return (
    isRecord(value) &&
    value.kind === "change" &&
    Object.hasOwn(value, "change") &&
    isChange(value.change) &&
    Object.hasOwn(value, "data") &&
    typeof value.text === "string"
  );
}

function flattenReceiptChanges(
  value: JsonValue,
  leaves: JsonValue[],
): value is ReceiptNode {
  if (
    !isRecord(value) ||
    value.kind !== "receipt" ||
    typeof value.protocol !== "string" ||
    !IDENTIFIER.test(value.protocol) ||
    !Object.hasOwn(value, "outcome") ||
    typeof value.text !== "string" ||
    !Array.isArray(value.changes)
  ) {
    return false;
  }
  for (const child of value.changes) {
    if (isRecord(child) && child.kind === "receipt") {
      if (!flattenReceiptChanges(child, leaves)) {
        return false;
      }
    } else if (validateReceiptLeaf(child)) {
      leaves.push(child.change);
    } else {
      return false;
    }
  }
  return true;
}

function validateResult(value: JsonValue): value is SimulationResult {
  if (
    !isRecord(value) ||
    typeof value.protocol !== "string" ||
    !IDENTIFIER.test(value.protocol) ||
    typeof value.method !== "string" ||
    !IDENTIFIER.test(value.method) ||
    !isUnsignedTransaction(value.transaction) ||
    typeof value.reverted !== "boolean" ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(
      (warning) =>
        isRecord(warning) &&
        typeof warning.code === "string" &&
        WARNING_CODES.has(warning.code) &&
        typeof warning.message === "string",
    ) ||
    !(
      value.gas === null ||
      (typeof value.gas === "string" && GAS.test(value.gas))
    ) ||
    (value.changes !== undefined &&
      (!Array.isArray(value.changes) || !value.changes.every(isChange))) ||
    (value.revertReason !== undefined && typeof value.revertReason !== "string")
  ) {
    return false;
  }

  if (value.receipt !== undefined) {
    const leaves: JsonValue[] = [];
    if (!flattenReceiptChanges(value.receipt, leaves)) {
      return false;
    }
  }
  return true;
}

function validateHalted(value: JsonValue | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  return (
    isRecord(value) &&
    typeof value.transactionIndex === "number" &&
    Number.isSafeInteger(value.transactionIndex) &&
    value.transactionIndex >= 0 &&
    typeof value.reason === "string"
  );
}

function parseSimulation(value: unknown): {
  raw: JsonValue;
  results: readonly SimulationResult[];
  halted: boolean;
} {
  if (!isJsonDescriptorClosedGraph(value) || !isRecord(value)) {
    return sourceViolation();
  }
  const results = value.results;
  if (
    !Array.isArray(results) ||
    !results.every(validateResult) ||
    !validateHalted(value.halted)
  ) {
    return sourceViolation();
  }
  return {
    raw: value,
    results,
    halted: value.halted !== undefined,
  };
}

function blockVerification(
  observation: SimulationRpcObservationV0_1,
  hasSimulationResults: boolean,
): SimulationBlockVerificationV0_1 {
  const reasons = [...observation.failures];
  const add = (code: SimulationBlockFailureCodeV0_1): void => {
    if (!reasons.includes(code)) {
      reasons.push(code);
    }
  };
  const blockNumber = observation.blockNumberResponses[0];
  if (
    observation.blockNumberResponses.length !== 1 ||
    blockNumber === undefined
  ) {
    add(
      observation.blockNumberResponses.length > 1
        ? "BLOCK_NUMBER_INCONSISTENT"
        : "BLOCK_NUMBER_UNOBSERVABLE",
    );
  } else if (!BLOCK_QUANTITY.test(blockNumber)) {
    add("BLOCK_NUMBER_UNOBSERVABLE");
  }

  for (const request of observation.requestBlocks) {
    if (request.blockParameter === null) {
      add("BLOCK_PARAMETER_UNOBSERVABLE");
    } else if (request.blockParameter !== blockNumber) {
      add("BLOCK_PARAMETER_INCONSISTENT");
    }
  }
  if (
    hasSimulationResults &&
    !observation.requestBlocks.some(
      ({ method }) => method === "debug_traceCall",
    )
  ) {
    add("BLOCK_PARAMETER_UNOBSERVABLE");
  }

  const preHash = observation.preBlockHashes[0];
  const postHash = observation.postBlockHash;
  if (
    observation.preBlockHashes.length !== 1 ||
    preHash === undefined ||
    preHash === null ||
    !BLOCK_HASH.test(preHash) ||
    postHash === null ||
    !BLOCK_HASH.test(postHash)
  ) {
    add("BLOCK_HASH_UNOBSERVABLE");
  } else if (preHash !== postHash) {
    add("BLOCK_HASH_CHANGED");
  }

  if (
    reasons.length === 0 &&
    blockNumber !== undefined &&
    preHash !== undefined &&
    preHash !== null
  ) {
    return deepFreeze({
      status: "PROVEN" as const,
      blockNumber,
      blockHash: preHash,
      observation,
    });
  }
  return deepFreeze({
    status: "UNPROVABLE" as const,
    reasons,
    observation,
  });
}

function warnings(
  results: readonly SimulationResult[],
): readonly WarningNode[] {
  return results.flatMap((result) => result.warnings);
}

function receiptLeaves(receipt: ReceiptNode): readonly JsonValue[] {
  const leaves: JsonValue[] = [];
  if (!flattenReceiptChanges(receipt, leaves)) {
    return sourceViolation();
  }
  return leaves;
}

function receiptCoverage(
  results: readonly SimulationResult[],
  expectedTransactions: number | undefined,
): SimulationVerificationStatusV0_1 {
  if (expectedTransactions === undefined || expectedTransactions < 1) {
    return "UNPROVABLE";
  }
  if (results.length !== expectedTransactions) {
    return "FAILED";
  }
  if (
    warnings(results).some(({ code }) => code === "CHANGE_COVERAGE_MISMATCH") ||
    results.some(({ receipt }) => receipt === undefined)
  ) {
    return "FAILED";
  }
  return results.every(({ receipt, changes }) => {
    if (receipt === undefined || changes === undefined) {
      return false;
    }
    const leaves = receiptLeaves(receipt);
    return (
      leaves.length === changes.length &&
      leaves.every((leaf, index) => leaf === changes[index])
    );
  })
    ? "PROVEN"
    : "FAILED";
}

function ordering(
  results: readonly SimulationResult[],
  expectedTransactions: number | undefined,
): SimulationVerificationStatusV0_1 {
  if (expectedTransactions === undefined || expectedTransactions < 1) {
    return "UNPROVABLE";
  }
  if (
    results.length !== expectedTransactions ||
    warnings(results).some(({ code }) => code === "CHANGE_ORDER_UNAVAILABLE")
  ) {
    return "FAILED";
  }
  if (
    results.some(
      ({ receipt, changes }) => receipt === undefined || changes === undefined,
    )
  ) {
    return "UNPROVABLE";
  }
  return results.every(({ receipt, changes }) => {
    if (receipt === undefined || changes === undefined) {
      return false;
    }
    const leaves = receiptLeaves(receipt);
    return (
      leaves.length === changes.length &&
      leaves.every((leaf, index) => leaf === changes[index])
    );
  })
    ? "PROVEN"
    : "FAILED";
}

function stateContinuity(
  results: readonly SimulationResult[],
  expectedTransactions: number | undefined,
  halted: boolean,
): StateContinuityVerificationStatusV0_1 {
  if (expectedTransactions === 1) {
    return "NOT_APPLICABLE";
  }
  if (expectedTransactions === undefined || expectedTransactions < 2) {
    return "UNPROVABLE";
  }
  return results.length === expectedTransactions &&
    !halted &&
    !warnings(results).some(({ code }) => code === "STATE_CHAIN_FAILED")
    ? "PROVEN"
    : "FAILED";
}

function capabilityIntegrity(
  pre: `sha256:${string}` | null,
  post: `sha256:${string}` | null,
): SimulationVerificationStatusV0_1 {
  if (pre === null || post === null) {
    return "UNPROVABLE";
  }
  return pre === post ? "PROVEN" : "FAILED";
}

export function mapMossEvidenceV0_1(
  input: MapMossEvidenceInputV0_1,
): RawSimulationEvidence {
  if (
    !matchesMossBuildInfo(input.buildInfo) ||
    input.originalSource.buildInfo !== input.buildInfo ||
    input.originalSource.layer !== "MOSS_ORIGINAL" ||
    input.derivedSource.layer !== "MINI_DEMO_DERIVED" ||
    typeof input.protocolId !== "string" ||
    !IDENTIFIER.test(input.protocolId) ||
    typeof input.method !== "string" ||
    !IDENTIFIER.test(input.method) ||
    !isJsonDescriptorClosedGraph(input.retainedCapability) ||
    Array.isArray(input.retainedCapability)
  ) {
    return sourceViolation();
  }

  const parsed = parseSimulation(input.simulation);
  const retainedSimulation = cloneGraph(parsed.raw);
  const observation = deepFreeze(structuredClone(input.observation));
  const expectedTransactions = observeCapability(input.retainedCapability)
    ?.nodeCount.transactionNodes;

  const transactions = parsed.results.map((result, transactionIndex) =>
    Object.freeze({ transactionIndex, value: result.transaction }),
  );
  const changes = parsed.results.flatMap((result, transactionIndex) =>
    (result.changes ?? []).map((value, changeIndex) =>
      Object.freeze({ transactionIndex, changeIndex, value }),
    ),
  );
  const receipts = parsed.results.flatMap((result, transactionIndex) =>
    result.receipt === undefined
      ? []
      : [Object.freeze({ transactionIndex, value: result.receipt })],
  );
  const outcomes = parsed.results.flatMap((result, transactionIndex) =>
    result.receipt === undefined
      ? []
      : [Object.freeze({ transactionIndex, value: result.receipt.outcome })],
  );
  const mappedWarnings = parsed.results.flatMap((result, transactionIndex) =>
    result.warnings.map((value, warningIndex) =>
      Object.freeze({
        transactionIndex,
        warningIndex,
        code: value.code,
        message: value.message,
        value,
      }),
    ),
  );
  const gas = parsed.results.map((result, transactionIndex) =>
    Object.freeze({ transactionIndex, value: result.gas }),
  );

  return Object.freeze({
    sourceContext: Object.freeze({
      chainId: 143 as const,
      protocolId: input.protocolId,
      method: input.method,
      buildInfo: input.buildInfo,
    }),
    mossOriginal: Object.freeze({
      source: input.originalSource,
      capability: input.capability,
      simulation: parsed.raw,
      retained: Object.freeze({
        capability: input.retainedCapability,
        simulation: retainedSimulation,
      }),
      transactions: Object.freeze(transactions),
      changes: Object.freeze(changes),
      receipts: Object.freeze(receipts),
      outcomes: Object.freeze(outcomes),
      warnings: Object.freeze(mappedWarnings),
      gas: Object.freeze(gas),
    }),
    miniDemoDerived: Object.freeze({
      source: input.derivedSource,
      derivedBy: "@moss-mini-demo/moss-adapter" as const,
      ruleVersion: "0.1" as const,
      mossCommit:
        input.buildInfo.integrationCommit ?? input.buildInfo.upstreamCommit,
      simulationBlock: blockVerification(
        observation,
        parsed.results.length > 0,
      ),
      capabilityIntegrity: capabilityIntegrity(
        input.preSimulationDigest,
        input.postSimulationDigest,
      ),
      capabilityDigests: Object.freeze({
        algorithm: "RFC8785-SHA256" as const,
        domain: CAPABILITY_DIGEST_DOMAIN,
        preSimulation: input.preSimulationDigest,
        postSimulation: input.postSimulationDigest,
      }),
      receiptCoverage: receiptCoverage(parsed.results, expectedTransactions),
      ordering: ordering(parsed.results, expectedTransactions),
      stateContinuity: stateContinuity(
        parsed.results,
        expectedTransactions,
        parsed.halted,
      ),
      sourceReferences: SOURCE_REFERENCES,
    }),
  });
}
