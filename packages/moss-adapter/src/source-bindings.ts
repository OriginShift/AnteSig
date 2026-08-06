import { MOSS_BUILD_INFO, matchesMossBuildInfo } from "./build-info.js";
import {
  MossAdapterError,
  type MossAdapterErrorCode,
  type MossAdapterOperation,
} from "./errors.js";
import type {
  ActionInput,
  JsonValue,
  MiniDemoDerivedSource,
  MossLoadedOperation,
  MossOriginalSource,
  MossPort,
  MossSourceBindings,
  QuoteInput,
  RawCapability,
  RawOperationContract,
} from "./types.js";

type SourceProvenance = MossOriginalSource["provenance"];
type SafeContext = Readonly<{ protocolId?: unknown; method?: unknown }>;

const CHAIN_ID = 143;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const DERIVED_SOURCE = Object.freeze({
  layer: "MINI_DEMO_DERIVED",
  ruleVersion: "moss-adapter-boundary-v0.1",
} as const satisfies MiniDemoDerivedSource);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
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

function isJsonSafe(value: unknown, seen = new WeakSet<object>()): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object" || seen.has(value)) {
    return false;
  }
  seen.add(value);

  let safe: boolean;
  if (Array.isArray(value)) {
    safe = value.every((item) => isJsonSafe(item, seen));
  } else if (isPlainRecord(value)) {
    safe = Object.values(value).every((item) => isJsonSafe(item, seen));
  } else {
    safe = false;
  }
  seen.delete(value);
  return safe;
}

function safelyIsJsonSafe(value: unknown): boolean {
  try {
    return isJsonSafe(value);
  } catch {
    return false;
  }
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

function inputError(
  operation: MossAdapterOperation,
  context: SafeContext,
): MossAdapterError {
  return new MossAdapterError("INVALID_INPUT", operation, context);
}

function sourceError(
  operation: MossAdapterOperation,
  context: SafeContext = {},
): MossAdapterError {
  return new MossAdapterError("SOURCE_CONTRACT_VIOLATION", operation, context);
}

function assertIdentifier(
  value: unknown,
  operation: MossAdapterOperation,
  context: SafeContext,
): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw inputError(operation, context);
  }
}

function assertSourceIdentifier(
  value: unknown,
  operation: MossAdapterOperation,
  context: SafeContext,
): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw sourceError(operation, context);
  }
}

function assertJsonInput(
  value: unknown,
  operation: MossAdapterOperation,
  context: SafeContext,
): asserts value is JsonValue {
  if (!safelyIsJsonSafe(value)) {
    throw inputError(operation, context);
  }
}

function assertMethodInput(
  input: unknown,
  operation: "quote" | "action",
  context: SafeContext,
): asserts input is QuoteInput | ActionInput {
  if (!isPlainRecord(input)) {
    throw inputError(operation, context);
  }
  assertIdentifier(input.method, operation, context);
  if (
    typeof input.account !== "string" ||
    input.account.length === 0 ||
    input.account.length > 128
  ) {
    throw inputError(operation, { ...context, method: input.method });
  }
  assertJsonInput(input.params, operation, {
    ...context,
    method: input.method,
  });
}

function assertLoadedOperation(
  value: unknown,
  expectedProtocolId: string,
  expectedMethod: string,
  operation: MossAdapterOperation,
): asserts value is MossLoadedOperation {
  const context = { protocolId: expectedProtocolId, method: expectedMethod };
  if (
    !isPlainRecord(value) ||
    value.protocolId !== expectedProtocolId ||
    value.method !== expectedMethod ||
    (value.operationKind !== "CAPABILITY" && value.operationKind !== "QUERY") ||
    !isPlainRecord(value.stub) ||
    value.stub.protocol !== expectedProtocolId ||
    value.stub.method !== expectedMethod ||
    value.stub.kind !== value.operationKind.toLowerCase() ||
    !Array.isArray(value.riskLabels) ||
    value.riskLabels !== value.stub.risk ||
    !value.riskLabels.every(
      (label) => typeof label === "string" && label.length > 0,
    ) ||
    !safelyIsJsonSafe(value.stub)
  ) {
    throw sourceError(operation, context);
  }
}

function originalSource(provenance: SourceProvenance): MossOriginalSource {
  return Object.freeze({
    layer: "MOSS_ORIGINAL",
    provenance,
    buildInfo: MOSS_BUILD_INFO,
  });
}

function operationContract(
  loaded: MossLoadedOperation,
  protocolId: string,
  method: string,
  operation: MossAdapterOperation,
  source: MossOriginalSource,
): RawOperationContract {
  assertLoadedOperation(loaded, protocolId, method, operation);
  return Object.freeze({
    chainId: CHAIN_ID,
    protocolId,
    method,
    buildInfo: MOSS_BUILD_INFO,
    mossOriginal: Object.freeze({
      source,
      protocolId: loaded.protocolId,
      method: loaded.method,
      stub: loaded.stub,
      riskLabels: loaded.riskLabels,
    }),
    miniDemoDerived: Object.freeze({
      source: DERIVED_SOURCE,
      protocolId,
      method,
      operationKind: loaded.operationKind,
      riskLabels: Object.freeze([...loaded.riskLabels]),
    }),
  });
}

function snapshotCapability(
  capability: unknown,
  operation: MossAdapterOperation,
  context: SafeContext,
): RawCapability {
  if (!isPlainRecord(capability) || !safelyIsJsonSafe(capability)) {
    throw sourceError(operation, context);
  }
  try {
    return deepFreeze(structuredClone(capability)) as RawCapability;
  } catch {
    throw sourceError(operation, context);
  }
}

async function invoke<T>(
  operation: MossAdapterOperation,
  failureCode: MossAdapterErrorCode,
  context: SafeContext,
  callback: () => Promise<T>,
): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof MossAdapterError) {
      throw new MossAdapterError(error.code, operation, context);
    }
    throw new MossAdapterError(failureCode, operation, context);
  }
}

function validateBindings(bindings: MossSourceBindings): void {
  if (typeof bindings !== "object" || bindings === null) {
    throw sourceError("buildInfo");
  }

  let chainId: unknown;
  try {
    chainId = bindings.chainId;
  } catch {
    throw sourceError("buildInfo");
  }
  if (chainId !== CHAIN_ID) {
    throw new MossAdapterError("CHAIN_ID_MISMATCH", "buildInfo");
  }

  let buildInfo: unknown;
  try {
    if (
      typeof bindings.buildInfo !== "function" ||
      typeof bindings.describe !== "function" ||
      typeof bindings.quote !== "function" ||
      typeof bindings.action !== "function" ||
      typeof bindings.simulate !== "function"
    ) {
      throw sourceError("buildInfo");
    }
    buildInfo = bindings.buildInfo();
  } catch (error) {
    if (error instanceof MossAdapterError) {
      throw error;
    }
    throw sourceError("buildInfo");
  }
  if (!matchesMossBuildInfo(buildInfo)) {
    throw sourceError("buildInfo");
  }
}

export function createBoundMossPort(
  bindings: MossSourceBindings,
  provenance: SourceProvenance,
): MossPort {
  validateBindings(bindings);
  const source = originalSource(provenance);

  return Object.freeze({
    async describe(protocolId: string, method: string) {
      const context = { protocolId, method };
      assertIdentifier(protocolId, "describe", context);
      assertIdentifier(method, "describe", context);
      const loaded = await invoke("describe", "DESCRIBE_FAILED", context, () =>
        bindings.describe(protocolId, method),
      );
      return operationContract(loaded, protocolId, method, "describe", source);
    },

    async quote(protocolId: string, input: QuoteInput) {
      const initialContext = { protocolId };
      assertIdentifier(protocolId, "quote", initialContext);
      assertMethodInput(input, "quote", initialContext);
      const context = { protocolId, method: input.method };
      const result = await invoke("quote", "QUOTE_FAILED", context, () =>
        bindings.quote(protocolId, input),
      );
      if (!isPlainRecord(result) || !safelyIsJsonSafe(result.quote)) {
        throw sourceError("quote", context);
      }
      const operation = operationContract(
        result.operation,
        protocolId,
        input.method,
        "quote",
        source,
      );
      return Object.freeze({
        operation,
        mossOriginal: Object.freeze({ source, value: result.quote }),
        miniDemoDerived: Object.freeze({
          source: DERIVED_SOURCE,
          normalizationStatus: "NOT_NORMALIZED",
          reason: "DEFERRED_TO_M2_05",
        }),
      });
    },

    async action(protocolId: string, input: ActionInput) {
      const initialContext = { protocolId };
      assertIdentifier(protocolId, "action", initialContext);
      assertMethodInput(input, "action", initialContext);
      const context = { protocolId, method: input.method };
      const result = await invoke("action", "ACTION_FAILED", context, () =>
        bindings.action(protocolId, input),
      );
      if (!isPlainRecord(result)) {
        throw sourceError("action", context);
      }
      const operation = operationContract(
        result.operation,
        protocolId,
        input.method,
        "action",
        source,
      );
      const snapshot = snapshotCapability(result.capability, "action", context);
      return Object.freeze({
        operation,
        mossOriginal: Object.freeze({
          source,
          value: result.capability,
        }),
        miniDemoDerived: Object.freeze({
          source: DERIVED_SOURCE,
          snapshot,
          integrity: Object.freeze({
            status: "NOT_EVALUATED",
            reason: "DEFERRED_TO_M2_06",
          }),
        }),
      });
    },

    async simulate(capability: RawCapability) {
      const context: SafeContext = {};
      if (!isPlainRecord(capability) || !safelyIsJsonSafe(capability)) {
        throw inputError("simulate", context);
      }
      const result = await invoke(
        "simulate",
        "SIMULATION_FAILED",
        context,
        () => bindings.simulate(capability),
      );
      if (!isPlainRecord(result)) {
        throw sourceError("simulate");
      }
      assertSourceIdentifier(result.protocolId, "simulate", {});
      assertSourceIdentifier(result.method, "simulate", {
        protocolId: result.protocolId,
      });
      if (!safelyIsJsonSafe(result.simulation)) {
        throw sourceError("simulate", {
          protocolId: result.protocolId,
          method: result.method,
        });
      }
      return Object.freeze({
        sourceContext: Object.freeze({
          chainId: CHAIN_ID,
          protocolId: result.protocolId,
          method: result.method,
          buildInfo: MOSS_BUILD_INFO,
        }),
        mossOriginal: Object.freeze({
          source,
          value: result.simulation,
        }),
        miniDemoDerived: Object.freeze({
          source: DERIVED_SOURCE,
          mappingStatus: "NOT_MAPPED",
          reason: "DEFERRED_TO_M2_07",
        }),
      });
    },

    buildInfo() {
      return MOSS_BUILD_INFO;
    },
  });
}
