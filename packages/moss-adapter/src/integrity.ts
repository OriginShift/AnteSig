import canonicalize from "canonicalize";
import {
  EvmAddressSchema,
  type EvmAddress,
} from "@moss-mini-demo/report-schema";
import { sha256CanonicalText } from "./asset-catalog.js";
import type { JsonValue, RawCapability } from "./types.js";

export const CAPABILITY_DIGEST_DOMAIN =
  "moss-mini-demo:capability:v0.1\n" as const;

type NodeProcess = Readonly<{
  getBuiltinModule(specifier: "node:util"): Readonly<{
    types: Readonly<{ isProxy(value: unknown): boolean }>;
  }>;
}>;

type CapabilityObservation = Readonly<{
  rootProtocol: string;
  rootMethod: string;
  nodeCount: Readonly<{
    capabilityNodes: number;
    transactionNodes: number;
    totalNodes: number;
  }>;
  transactionTargets: readonly EvmAddress[];
}>;

type ValidationState = {
  readonly active: WeakSet<object>;
  readonly completed: WeakSet<object>;
  readonly allowRepeatedReferences: boolean;
  readonly allowFrozenArrays: boolean;
};

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

function nodeIsProxy(value: object): boolean {
  const nodeProcess = (globalThis as unknown as { process: NodeProcess })
    .process;
  return nodeProcess.getBuiltinModule("node:util").types.isProxy(value);
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

function validateRecord(
  value: object,
  state: ValidationState,
): value is Readonly<Record<string, JsonValue>> {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    if (typeof key !== "string" || hasLoneSurrogate(key)) {
      return false;
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      !exactDataDescriptor(descriptor) ||
      !validateJsonExactNode(descriptor.value, state)
    ) {
      return false;
    }
  }
  return true;
}

function validateArray(
  value: unknown[],
  state: ValidationState,
): value is JsonValue[] {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.value !== value.length ||
    (lengthDescriptor.writable !== true &&
      !(
        state.allowFrozenArrays &&
        lengthDescriptor.writable === false &&
        Object.isFrozen(value)
      )) ||
    lengthDescriptor.enumerable !== false ||
    lengthDescriptor.configurable !== false ||
    lengthDescriptor.get !== undefined ||
    lengthDescriptor.set !== undefined ||
    !Number.isSafeInteger(value.length) ||
    value.length < 0 ||
    keys.length !== value.length + 1 ||
    keys[value.length] !== "length"
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    if (keys[index] !== key) {
      return false;
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      !exactDataDescriptor(descriptor) ||
      !validateJsonExactNode(descriptor.value, state)
    ) {
      return false;
    }
  }
  return true;
}

function validateJsonExactNode(
  value: unknown,
  state: ValidationState,
): value is JsonValue {
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
  if (typeof value !== "object" || nodeIsProxy(value)) {
    return false;
  }
  if (state.active.has(value)) {
    return false;
  }
  if (state.completed.has(value)) {
    return state.allowRepeatedReferences;
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

function validateJsonValue(
  value: unknown,
  options: Readonly<{
    allowRepeatedReferences: boolean;
    allowFrozenArrays: boolean;
  }>,
): value is JsonValue {
  try {
    return validateJsonExactNode(value, {
      active: new WeakSet<object>(),
      completed: new WeakSet<object>(),
      ...options,
    });
  } catch {
    return false;
  }
}

export function isJsonExactValue(value: unknown): value is JsonValue {
  return validateJsonValue(value, {
    allowRepeatedReferences: false,
    allowFrozenArrays: false,
  });
}

export function isJsonDescriptorClosedInput(
  value: unknown,
): value is JsonValue {
  return validateJsonValue(value, {
    allowRepeatedReferences: true,
    allowFrozenArrays: true,
  });
}

function canonicalizeOwned(value: RawCapability): string | undefined {
  try {
    return canonicalize(value);
  } catch {
    return undefined;
  }
}

export function capabilityDigestFromSnapshot(
  snapshot: RawCapability,
): `sha256:${string}` | undefined {
  const canonical = canonicalizeOwned(snapshot);
  return canonical === undefined
    ? undefined
    : sha256CanonicalText(`${CAPABILITY_DIGEST_DOMAIN}${canonical}`);
}

export function currentCapabilityDigest(
  value: unknown,
): `sha256:${string}` | undefined {
  if (!isJsonExactValue(value) || Array.isArray(value)) {
    return undefined;
  }
  return capabilityDigestFromSnapshot(value as RawCapability);
}

export function currentCapabilityMatchesSnapshot(
  value: unknown,
  snapshot: RawCapability,
): boolean {
  if (!isJsonExactValue(value) || Array.isArray(value)) {
    return false;
  }
  const current = canonicalizeOwned(value as RawCapability);
  const acquired = canonicalizeOwned(snapshot);
  return (
    current !== undefined && acquired !== undefined && current === acquired
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAddress(value: unknown): EvmAddress | undefined {
  try {
    const parsed = EvmAddressSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function observeCapability(
  snapshot: RawCapability,
): CapabilityObservation | undefined {
  try {
    if (
      snapshot.kind !== "capability" ||
      typeof snapshot.protocol !== "string" ||
      typeof snapshot.method !== "string" ||
      !Array.isArray(snapshot.children)
    ) {
      return undefined;
    }
    const stack: unknown[] = [snapshot];
    const targets: EvmAddress[] = [];
    let capabilityNodes = 0;
    let transactionNodes = 0;

    while (stack.length > 0) {
      const node = stack.pop();
      if (!isRecord(node)) {
        return undefined;
      }
      if (node.kind === "capability") {
        if (
          typeof node.protocol !== "string" ||
          typeof node.method !== "string" ||
          !Array.isArray(node.children)
        ) {
          return undefined;
        }
        capabilityNodes += 1;
        for (let index = node.children.length - 1; index >= 0; index -= 1) {
          stack.push(node.children[index]);
        }
      } else if (node.kind === "transaction") {
        if (!isRecord(node.transaction)) {
          return undefined;
        }
        const from = parseAddress(node.transaction.from);
        const to = parseAddress(node.transaction.to);
        if (
          from === undefined ||
          to === undefined ||
          typeof node.transaction.data !== "string" ||
          !/^0x(?:[0-9a-fA-F]{2})*$/.test(node.transaction.data) ||
          typeof node.transaction.value !== "string" ||
          !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(node.transaction.value)
        ) {
          return undefined;
        }
        transactionNodes += 1;
        targets.push(to);
      } else {
        return undefined;
      }
    }

    const transactionTargets = Object.freeze(
      targets.filter((address, index) => targets.indexOf(address) === index),
    );
    return Object.freeze({
      rootProtocol: snapshot.protocol,
      rootMethod: snapshot.method,
      nodeCount: Object.freeze({
        capabilityNodes,
        transactionNodes,
        totalNodes: capabilityNodes + transactionNodes,
      }),
      transactionTargets,
    });
  } catch {
    return undefined;
  }
}
