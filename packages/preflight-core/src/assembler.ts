import { evaluateDecisionV0_1 } from "@moss-mini-demo/decision-engine";
import {
  AlignmentSchema,
  CapabilitySchema,
  DecisionInputV0_1Schema,
  GeneratedAtSchema,
  IntentSchema,
  LimitationSchema,
  NetworkSchema,
  type PreflightReport,
  PreflightReportSchema,
  ProvenanceSchema,
  QuoteSchema,
  ReportIdSchema,
  SelectionSchema,
  SimulationSchema,
} from "@moss-mini-demo/report-schema";
import { z } from "zod";

const ERROR_MESSAGES = {
  UNSUPPORTED_SCHEMA_VERSION: "Unsupported preflight assembly source version",
  INVALID_SOURCE_INPUT: "Invalid preflight assembly source",
  INVALID_METADATA: "Invalid preflight assembly metadata",
  MISSING_SIMULATION_CONTEXT:
    "Available simulation requires block and Moss source context",
  INVALID_PREFLIGHT_REPORT: "Invalid assembled PreflightReport",
} as const;

type PreflightAssemblyErrorCodeV0_1 = keyof typeof ERROR_MESSAGES;

type NodeProcess = Readonly<{
  getBuiltinModule(specifier: "node:util"): Readonly<{
    types: Readonly<{ isProxy(value: unknown): boolean }>;
  }>;
}>;

type CloneResult =
  | Readonly<{ success: true; value: unknown }>
  | Readonly<{ success: false }>;

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const ASSEMBLY_SOURCE_SCHEMA = z.strictObject({
  schemaVersion: z.literal("0.1"),
  intent: IntentSchema,
  quotes: z.array(QuoteSchema).min(1),
  selection: SelectionSchema,
  capability: CapabilitySchema,
  simulation: SimulationSchema,
  alignment: AlignmentSchema,
});

const ASSEMBLY_METADATA_SCHEMA = z.strictObject({
  reportId: ReportIdSchema,
  generatedAt: GeneratedAtSchema,
  network: NetworkSchema,
  provenance: ProvenanceSchema,
  limitations: z.array(LimitationSchema),
});

export type PreflightAssemblySourceV0_1 = z.infer<
  typeof ASSEMBLY_SOURCE_SCHEMA
>;
export type PreflightAssemblyMetadataV0_1 = z.infer<
  typeof ASSEMBLY_METADATA_SCHEMA
>;

export class PreflightAssemblyErrorV0_1 extends Error {
  readonly code: PreflightAssemblyErrorCodeV0_1;

  constructor(code: PreflightAssemblyErrorCodeV0_1) {
    super(ERROR_MESSAGES[code]);
    this.name = "PreflightAssemblyErrorV0_1";
    this.code = code;
  }
}

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

function cloneArray(value: unknown[], active: WeakSet<object>): CloneResult {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return { success: false };
  }
  const keys = Reflect.ownKeys(value);
  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.value !== value.length ||
    lengthDescriptor.enumerable !== false ||
    lengthDescriptor.configurable !== false ||
    lengthDescriptor.get !== undefined ||
    lengthDescriptor.set !== undefined ||
    !Number.isSafeInteger(value.length) ||
    keys.length !== value.length + 1
  ) {
    return { success: false };
  }

  const clone: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
    if (!exactDataDescriptor(descriptor)) {
      return { success: false };
    }
    const child = cloneNode(descriptor.value, active);
    if (!child.success) {
      return child;
    }
    clone.push(child.value);
  }
  return { success: true, value: clone };
}

function cloneRecord(value: object, active: WeakSet<object>): CloneResult {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return { success: false };
  }

  const clone: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== "string" ||
      hasLoneSurrogate(key) ||
      FORBIDDEN_KEYS.has(key)
    ) {
      return { success: false };
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (!exactDataDescriptor(descriptor)) {
      return { success: false };
    }
    const child = cloneNode(descriptor.value, active);
    if (!child.success) {
      return child;
    }
    clone[key] = child.value;
  }
  return { success: true, value: clone };
}

function cloneNode(value: unknown, active: WeakSet<object>): CloneResult {
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" && !hasLoneSurrogate(value))
  ) {
    return { success: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && !Object.is(value, -0)
      ? { success: true, value }
      : { success: false };
  }
  if (typeof value !== "object" || isProxy(value) || active.has(value)) {
    return { success: false };
  }

  active.add(value);
  const result = Array.isArray(value)
    ? cloneArray(value, active)
    : cloneRecord(value, active);
  active.delete(value);
  return result;
}

export function cloneDescriptorClosedJsonV0_1(input: unknown): CloneResult {
  return cloneNode(input, new WeakSet<object>());
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function hasRequiredSimulationContext(
  source: PreflightAssemblySourceV0_1,
): boolean {
  if (source.simulation.availability !== "AVAILABLE") {
    return true;
  }
  const raw = source.simulation.raw;
  if (!isNonEmptyRecord(raw) || !isNonEmptyRecord(raw.context)) {
    return false;
  }
  return (
    isNonEmptyRecord(raw.context.block) && isNonEmptyRecord(raw.context.moss)
  );
}

function parseSource(input: unknown): PreflightAssemblySourceV0_1 {
  const cloned = cloneDescriptorClosedJsonV0_1(input);
  if (!cloned.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_SOURCE_INPUT");
  }
  if (
    typeof cloned.value !== "object" ||
    cloned.value === null ||
    !("schemaVersion" in cloned.value) ||
    cloned.value.schemaVersion !== "0.1"
  ) {
    throw new PreflightAssemblyErrorV0_1("UNSUPPORTED_SCHEMA_VERSION");
  }
  const parsed = ASSEMBLY_SOURCE_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_SOURCE_INPUT");
  }
  if (!hasRequiredSimulationContext(parsed.data)) {
    throw new PreflightAssemblyErrorV0_1("MISSING_SIMULATION_CONTEXT");
  }
  return parsed.data;
}

function parseMetadata(input: unknown): PreflightAssemblyMetadataV0_1 {
  const cloned = cloneDescriptorClosedJsonV0_1(input);
  if (!cloned.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_METADATA");
  }
  const parsed = ASSEMBLY_METADATA_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_METADATA");
  }
  return parsed.data;
}

export function assemblePreflightReportV0_1(
  sourceInput: unknown,
  metadataInput: unknown,
): PreflightReport {
  const source = parseSource(sourceInput);
  const metadata = parseMetadata(metadataInput);
  const decisionInput = DecisionInputV0_1Schema.safeParse({
    schemaVersion: source.schemaVersion,
    reportId: metadata.reportId,
    generatedAt: metadata.generatedAt,
    network: metadata.network,
    provenance: metadata.provenance,
    intent: source.intent,
    quotes: source.quotes,
    selection: source.selection,
    capability: source.capability,
    simulation: source.simulation,
    alignment: source.alignment,
  });
  if (!decisionInput.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_SOURCE_INPUT");
  }

  const decision = evaluateDecisionV0_1(decisionInput.data);
  const report = PreflightReportSchema.safeParse({
    ...decisionInput.data,
    decision,
    limitations: metadata.limitations,
  });
  if (!report.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_PREFLIGHT_REPORT");
  }
  return report.data;
}
