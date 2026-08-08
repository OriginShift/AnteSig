import { JsonPointerSyntaxSchema } from "@moss-mini-demo/report-schema";

export const ALIGNMENT_CHECK_IDS_V0_1 = [
  "operation-v0-1",
  "account-v0-1",
  "input-asset-v0-1",
  "output-asset-v0-1",
  "amount-in-v0-1",
  "slippage-v0-1",
  "allowed-protocol-v0-1",
  "recipient-v0-1",
  "approval-spender-v0-1",
  "approval-amount-v0-1",
  "unexpected-funds-movement-v0-1",
  "capability-integrity-v0-1",
  "transaction-set-v0-1",
  "warning-presence-v0-1",
  "receipt-availability-v0-1",
  "coverage-v0-1",
  "ordering-v0-1",
  "state-continuity-v0-1",
] as const;

export type AlignmentCheckIdV0_1 = (typeof ALIGNMENT_CHECK_IDS_V0_1)[number];

export type AlignmentFactRoleV0_1 = "expected" | "observed" | "permitted";

export type AlignmentFactProofV0_1 = Readonly<{
  availability: "AVAILABLE" | "FAILED" | "MISSING" | "UNPROVABLE";
  sourceReference: string;
  value?: unknown;
}>;

export type ValidatedFactReferenceV0_1 =
  | Readonly<{ valid: true; reference: string; value: unknown }>
  | Readonly<{ valid: false }>;

type NodeProcess = Readonly<{
  getBuiltinModule(specifier: "node:util"): Readonly<{
    types: Readonly<{ isProxy(value: unknown): boolean }>;
  }>;
}>;

type ValidationState = {
  readonly active: WeakSet<object>;
  readonly completed: WeakSet<object>;
};

const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
const REPORT_OWNED_SEGMENTS = new Set([
  "alignment",
  "decision",
  "display",
  "extension",
  "extensions",
  "limitations",
  "prose",
  "sourceReferences",
]);

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function isProxy(value: object): boolean {
  try {
    const nodeProcess = (globalThis as unknown as { process?: NodeProcess })
      .process;
    if (nodeProcess === undefined) {
      return true;
    }
    return nodeProcess.getBuiltinModule("node:util").types.isProxy(value);
  } catch {
    return true;
  }
}

function exactDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    descriptor.get === undefined &&
    descriptor.set === undefined &&
    Object.hasOwn(descriptor, "value")
  );
}

function validateArray(value: unknown[], state: ValidationState): boolean {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.value !== value.length ||
    (lengthDescriptor.writable !== true &&
      !(lengthDescriptor.writable === false && Object.isFrozen(value))) ||
    lengthDescriptor.enumerable !== false ||
    lengthDescriptor.configurable !== false ||
    lengthDescriptor.get !== undefined ||
    lengthDescriptor.set !== undefined ||
    !Number.isSafeInteger(value.length) ||
    keys.length !== value.length + 1 ||
    keys[value.length] !== "length"
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
    if (
      !exactDataDescriptor(descriptor) ||
      !validateJsonNode(descriptor.value, state)
    ) {
      return false;
    }
  }
  return true;
}

function validateRecord(value: object, state: ValidationState): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== "string" ||
      hasLoneSurrogate(key) ||
      FORBIDDEN_SEGMENTS.has(key)
    ) {
      return false;
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      !exactDataDescriptor(descriptor) ||
      !validateJsonNode(descriptor.value, state)
    ) {
      return false;
    }
  }
  return true;
}

function validateJsonNode(value: unknown, state: ValidationState): boolean {
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" && !hasLoneSurrogate(value))
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && !Object.is(value, -0);
  }
  if (typeof value !== "object" || isProxy(value)) {
    return false;
  }
  if (state.active.has(value) || state.completed.has(value)) {
    return false;
  }
  state.active.add(value);
  const valid = Array.isArray(value)
    ? validateArray(value, state)
    : validateRecord(value, state);
  state.active.delete(value);
  if (valid) {
    state.completed.add(value);
  }
  return valid;
}

export function isJsonDescriptorClosedAlignmentInput(value: unknown): boolean {
  return validateJsonNode(value, {
    active: new WeakSet<object>(),
    completed: new WeakSet<object>(),
  });
}

function decodeJsonPointer(pointer: string): string[] {
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function resolveJsonPointer(
  document: unknown,
  segments: readonly string[],
): { resolved: true; value: unknown } | { resolved: false } {
  let current: unknown = document;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!ARRAY_INDEX_PATTERN.test(segment)) {
        return { resolved: false };
      }
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index >= current.length) {
        return { resolved: false };
      }
      current = current[index];
      continue;
    }
    if (
      typeof current !== "object" ||
      current === null ||
      !Object.hasOwn(current, segment)
    ) {
      return { resolved: false };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { resolved: true, value: current };
}

function isPrefix(prefix: readonly string[], path: readonly string[]): boolean {
  return (
    prefix.length <= path.length &&
    prefix.every((segment, index) => segment === path[index])
  );
}

function isQuoteRaw(path: readonly string[]): boolean {
  return (
    path[0] === "quotes" &&
    path[1] !== undefined &&
    ARRAY_INDEX_PATTERN.test(path[1]) &&
    path[2] === "raw" &&
    path.length >= 3
  );
}

function isCapabilityRaw(path: readonly string[]): boolean {
  return isPrefix(["capability", "raw"], path);
}

function isSimulationRaw(path: readonly string[]): boolean {
  if (isPrefix(["simulation", "raw"], path)) {
    return true;
  }
  return (
    isPrefix(["simulation", "coverage", "raw"], path) ||
    isPrefix(["simulation", "ordering", "raw"], path) ||
    isPrefix(["simulation", "stateContinuity", "raw"], path) ||
    (path[0] === "simulation" &&
      path[1] === "receipts" &&
      path[2] === "items" &&
      path[3] !== undefined &&
      ARRAY_INDEX_PATTERN.test(path[3]) &&
      path[4] === "raw") ||
    (path[0] === "simulation" &&
      path[1] === "warnings" &&
      path[2] === "items" &&
      path[3] !== undefined &&
      ARRAY_INDEX_PATTERN.test(path[3]))
  );
}

function hasSemanticLeaf(
  path: readonly string[],
  leaves: readonly string[],
): boolean {
  const leaf = path.at(-1);
  return leaf !== undefined && leaves.includes(leaf);
}

function isWarningItem(path: readonly string[]): boolean {
  return (
    path[0] === "simulation" &&
    path[1] === "warnings" &&
    path[2] === "items" &&
    path[3] !== undefined &&
    ARRAY_INDEX_PATTERN.test(path[3])
  );
}

function capabilityAvailability(path: readonly string[]): boolean {
  return path.length === 2 && isPrefix(["capability", "availability"], path);
}

function simulationAvailability(path: readonly string[]): boolean {
  if (path[0] !== "simulation" || path.at(-1) !== "availability") {
    return false;
  }
  return (
    path.length === 2 ||
    (path.length === 3 &&
      [
        "coverage",
        "ordering",
        "outcomes",
        "receipts",
        "stateContinuity",
        "warnings",
      ].includes(path[1] ?? ""))
  );
}

function rawRelevant(
  checkId: AlignmentCheckIdV0_1,
  role: AlignmentFactRoleV0_1,
  path: readonly string[],
): boolean {
  switch (checkId) {
    case "operation-v0-1":
      return (
        (role === "expected" ? isQuoteRaw(path) : isCapabilityRaw(path)) &&
        hasSemanticLeaf(path, ["method", "operation"])
      );
    case "account-v0-1":
      return isCapabilityRaw(path) && hasSemanticLeaf(path, ["account"]);
    case "input-asset-v0-1":
      return isCapabilityRaw(path) && hasSemanticLeaf(path, ["inputAsset"]);
    case "output-asset-v0-1":
      return isCapabilityRaw(path) && hasSemanticLeaf(path, ["outputAsset"]);
    case "amount-in-v0-1":
      return (
        isCapabilityRaw(path) &&
        hasSemanticLeaf(path, ["amountIn", "inputAmount"])
      );
    case "slippage-v0-1":
      return (
        isCapabilityRaw(path) &&
        hasSemanticLeaf(path, ["maxSlippageBps", "slippageBps"])
      );
    case "allowed-protocol-v0-1":
      return isCapabilityRaw(path) && hasSemanticLeaf(path, ["protocolId"]);
    case "recipient-v0-1":
      return isCapabilityRaw(path) && hasSemanticLeaf(path, ["recipient"]);
    case "approval-spender-v0-1":
      return (
        isCapabilityRaw(path) &&
        hasSemanticLeaf(path, [
          "approvalSpenderExpected",
          "approvalSpenderObserved",
          "spender",
        ])
      );
    case "approval-amount-v0-1":
      return isCapabilityRaw(path) && hasSemanticLeaf(path, ["approvalAmount"]);
    case "unexpected-funds-movement-v0-1":
      return role === "permitted"
        ? isCapabilityRaw(path) && hasSemanticLeaf(path, ["permittedMovements"])
        : isSimulationRaw(path) && hasSemanticLeaf(path, ["observedMovements"]);
    case "capability-integrity-v0-1":
      return (
        (isCapabilityRaw(path) || isSimulationRaw(path)) &&
        hasSemanticLeaf(path, ["capabilityIntegrity"])
      );
    case "transaction-set-v0-1":
      return role === "expected"
        ? isCapabilityRaw(path) &&
            hasSemanticLeaf(path, ["expectedTransactionTargets"])
        : isSimulationRaw(path) &&
            hasSemanticLeaf(path, ["observed", "observedTransactionTargets"]);
    case "warning-presence-v0-1":
      return (
        isSimulationRaw(path) &&
        (hasSemanticLeaf(path, ["warnings"]) || isWarningItem(path))
      );
    case "receipt-availability-v0-1":
      return isSimulationRaw(path) && hasSemanticLeaf(path, ["receipts"]);
    case "coverage-v0-1":
      return (
        isSimulationRaw(path) &&
        hasSemanticLeaf(path, ["coverage", "receiptCoverage"])
      );
    case "ordering-v0-1":
      return isSimulationRaw(path) && hasSemanticLeaf(path, ["ordering"]);
    case "state-continuity-v0-1":
      return (
        isSimulationRaw(path) && hasSemanticLeaf(path, ["stateContinuity"])
      );
  }
}

function availabilityRelevant(
  checkId: AlignmentCheckIdV0_1,
  path: readonly string[],
): boolean {
  switch (checkId) {
    case "operation-v0-1":
    case "account-v0-1":
    case "input-asset-v0-1":
    case "output-asset-v0-1":
    case "amount-in-v0-1":
    case "slippage-v0-1":
    case "allowed-protocol-v0-1":
    case "recipient-v0-1":
    case "approval-spender-v0-1":
    case "approval-amount-v0-1":
      return capabilityAvailability(path);
    case "unexpected-funds-movement-v0-1":
    case "transaction-set-v0-1":
      return capabilityAvailability(path) || simulationAvailability(path);
    case "capability-integrity-v0-1":
      return capabilityAvailability(path) || simulationAvailability(path);
    case "warning-presence-v0-1":
    case "receipt-availability-v0-1":
    case "coverage-v0-1":
    case "ordering-v0-1":
    case "state-continuity-v0-1":
      return simulationAvailability(path);
  }
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonEqual(value, right[index]))
    );
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        jsonEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function parseReference(reference: string): string[] | undefined {
  const parsed = JsonPointerSyntaxSchema.safeParse(reference);
  if (!parsed.success) {
    return undefined;
  }
  const path = decodeJsonPointer(reference);
  return path.some(
    (segment) =>
      FORBIDDEN_SEGMENTS.has(segment) || REPORT_OWNED_SEGMENTS.has(segment),
  )
    ? undefined
    : path;
}

export function validateFactReferenceV0_1(
  document: unknown,
  checkId: AlignmentCheckIdV0_1,
  role: AlignmentFactRoleV0_1,
  fact: AlignmentFactProofV0_1,
): ValidatedFactReferenceV0_1 {
  const path = parseReference(fact.sourceReference);
  if (path === undefined) {
    return { valid: false };
  }
  const relevant =
    fact.availability === "AVAILABLE"
      ? rawRelevant(checkId, role, path)
      : availabilityRelevant(checkId, path);
  if (!relevant) {
    return { valid: false };
  }
  const resolved = resolveJsonPointer(document, path);
  if (!resolved.resolved) {
    return { valid: false };
  }
  const expected =
    fact.availability === "AVAILABLE" ? fact.value : fact.availability;
  return jsonEqual(resolved.value, expected)
    ? { valid: true, reference: fact.sourceReference, value: resolved.value }
    : { valid: false };
}

function outputReferenceRelevant(
  checkId: AlignmentCheckIdV0_1,
  path: readonly string[],
): boolean {
  if (rawRelevant(checkId, "expected", path)) {
    return true;
  }
  if (rawRelevant(checkId, "observed", path)) {
    return true;
  }
  if (rawRelevant(checkId, "permitted", path)) {
    return true;
  }
  if (availabilityRelevant(checkId, path)) {
    return true;
  }
  switch (checkId) {
    case "operation-v0-1":
      return path[0] === "selection";
    case "account-v0-1":
      return isPrefix(["intent", "account"], path);
    case "input-asset-v0-1":
      return isPrefix(["intent", "inputAsset"], path);
    case "output-asset-v0-1":
      return isPrefix(["intent", "outputAsset"], path);
    case "amount-in-v0-1":
    case "approval-amount-v0-1":
      return isPrefix(["intent", "inputAmount"], path);
    case "slippage-v0-1":
      return isPrefix(["intent", "maxSlippageBps"], path);
    case "allowed-protocol-v0-1":
      return isPrefix(["intent", "allowedProtocols"], path);
    case "recipient-v0-1":
      return (
        isPrefix(["intent", "recipient"], path) ||
        isPrefix(["intent", "account"], path)
      );
    case "approval-spender-v0-1":
      return false;
    case "unexpected-funds-movement-v0-1":
      return path[0] === "intent";
    case "capability-integrity-v0-1":
    case "transaction-set-v0-1":
    case "warning-presence-v0-1":
    case "receipt-availability-v0-1":
    case "coverage-v0-1":
    case "ordering-v0-1":
    case "state-continuity-v0-1":
      return false;
  }
}

export function outputReferencesAreValidV0_1(
  document: unknown,
  checkId: AlignmentCheckIdV0_1,
  references: readonly string[],
): boolean {
  return (
    references.length > 0 &&
    new Set(references).size === references.length &&
    references.every((reference) => {
      const path = parseReference(reference);
      return (
        path !== undefined &&
        outputReferenceRelevant(checkId, path) &&
        resolveJsonPointer(document, path).resolved
      );
    })
  );
}

export function compareUtf8V0_1(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const sharedLength = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = Number(leftBytes[index]) - Number(rightBytes[index]);
    if (difference !== 0) {
      return difference;
    }
  }
  if (leftBytes.length !== rightBytes.length) {
    return leftBytes.length - rightBytes.length;
  }
  for (let index = 0; index < left.length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) {
      return difference;
    }
  }
  return left.length - right.length;
}
