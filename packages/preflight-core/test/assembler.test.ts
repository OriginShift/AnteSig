import { DecisionInputErrorV0_1 } from "@moss-mini-demo/decision-engine";
import {
  GeneratedAtSchema,
  JsonPointerSyntaxSchema,
  NetworkSchema,
  PreflightReportSchema,
  ReportIdSchema,
  StableCodeSchema,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import { cloneDescriptorClosedJsonV0_1 } from "../src/assembler.js";
import {
  assemblePreflightReportV0_1,
  evaluateAlignmentV0_1,
  PreflightAssemblyErrorV0_1,
  type PreflightAssemblyMetadataV0_1,
  type PreflightAssemblySourceV0_1,
} from "../src/index.js";
import { buildPassingInput } from "./synthetic.js";

type MutableRecord = Record<string, unknown>;
type ErrorCode = PreflightAssemblyErrorV0_1["code"];

function pointer(value: string) {
  return JsonPointerSyntaxSchema.parse(value);
}

function buildMetadata(): PreflightAssemblyMetadataV0_1 {
  return {
    reportId: ReportIdSchema.parse("88888888-8888-4888-8888-888888888888"),
    generatedAt: GeneratedAtSchema.parse("2031-03-04T05:06:07.000Z"),
    network: NetworkSchema.parse("eip155:143"),
    provenance: "FIXTURE",
    limitations: [
      {
        code: StableCodeSchema.parse("SYNTHETIC_CONTEXT_LIMITATION"),
        description: "Synthetic context is not live evidence.",
        sourceReferences: [pointer("/simulation/raw/context/block")],
      },
    ],
  };
}

function addAssemblyContext(input: ReturnType<typeof buildPassingInput>): void {
  if (input.simulation.availability !== "AVAILABLE") {
    throw new Error("synthetic simulation is unavailable");
  }
  const raw = input.simulation.raw as MutableRecord;
  const context = raw.context as MutableRecord;
  context.block = {
    status: "PROVEN",
    blockNumber: "0x123",
    blockHash: `0x${"ab".repeat(32)}`,
  };
  context.moss = {
    sourceMode: "SYNTHETIC_TEST",
    upstreamCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
    integrationCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
  };
}

function buildSource(
  mutate?: (input: ReturnType<typeof buildPassingInput>) => void,
): PreflightAssemblySourceV0_1 {
  const input = buildPassingInput();
  mutate?.(input);
  addAssemblyContext(input);
  return {
    schemaVersion: input.schemaVersion,
    intent: input.intent,
    quotes: input.quotes,
    selection: input.selection,
    capability: input.capability,
    simulation: input.simulation,
    alignment: evaluateAlignmentV0_1(input),
  };
}

function expectAssemblyError(
  source: unknown,
  metadata: unknown,
  code: ErrorCode,
): void {
  let thrown: unknown;
  try {
    assemblePreflightReportV0_1(source, metadata);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(PreflightAssemblyErrorV0_1);
  expect(thrown).toMatchObject({ code });
}

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && Object.hasOwn(descriptor, "value")) {
      deepFreeze(descriptor.value);
    }
  }
  Object.freeze(value);
}

describe("PreflightReport v0.1 assembly", () => {
  it("parses DecisionInput before the public Engine and returns exact MANUAL_REVIEW", () => {
    const source = buildSource();
    const metadata = buildMetadata();
    const report = assemblePreflightReportV0_1(source, metadata);

    expect(report.decision).toEqual({ status: "MANUAL_REVIEW" });
    expect(Object.keys(report.decision)).toEqual(["status"]);
    expect(PreflightReportSchema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      schemaVersion: "0.1",
      reportId: metadata.reportId,
      generatedAt: metadata.generatedAt,
      network: metadata.network,
      provenance: metadata.provenance,
      limitations: metadata.limitations,
    });

    const {
      decision: _decision,
      limitations: _limitations,
      ...projection
    } = report;
    expect(projection).toEqual({
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
  });

  it("uses the public Engine's complete STOP output without duplicating rules", () => {
    const warning = {
      code: "SYNTHETIC_WARNING",
      message: "synthetic source warning",
      value: "source-owned-value",
    };
    const source = buildSource((input) => {
      if (
        input.simulation.availability !== "AVAILABLE" ||
        input.simulation.warnings.availability !== "AVAILABLE"
      ) {
        throw new Error("synthetic warnings are unavailable");
      }
      input.simulation.warnings.items = [structuredClone(warning)];
      const raw = input.simulation.raw as MutableRecord;
      (raw.context as MutableRecord).warnings = [structuredClone(warning)];
      if (input.observations.warnings.availability !== "AVAILABLE") {
        throw new Error("synthetic warning observation is unavailable");
      }
      input.observations.warnings.value = [structuredClone(warning)];
    });
    const report = assemblePreflightReportV0_1(source, buildMetadata());

    expect(report.decision).toEqual({
      status: "STOP",
      reasons: [
        {
          code: "WARNING_PRESENT",
          sourceReferences: ["/simulation/warnings/items/0"],
        },
        {
          code: "CRITICAL_ALIGNMENT_FAIL",
          sourceReferences: ["/simulation/raw/context/warnings"],
        },
      ],
    });
    expect(PreflightReportSchema.safeParse(report).success).toBe(true);
  });

  it("requires complete block and Moss records only in available raw context", () => {
    const metadata = buildMetadata();
    for (const mutate of [
      (source: MutableRecord) => {
        const simulation = source.simulation as MutableRecord;
        const raw = simulation.raw as MutableRecord;
        delete raw.context;
      },
      (source: MutableRecord) => {
        const context = (
          (source.simulation as MutableRecord).raw as MutableRecord
        ).context as MutableRecord;
        context.block = {};
      },
      (source: MutableRecord) => {
        const context = (
          (source.simulation as MutableRecord).raw as MutableRecord
        ).context as MutableRecord;
        context.moss = [];
      },
    ]) {
      const source = structuredClone(buildSource()) as unknown as MutableRecord;
      mutate(source);
      expectAssemblyError(source, metadata, "MISSING_SIMULATION_CONTEXT");
    }

    const extra = {
      ...buildSource(),
      block: { number: "0x123" },
      moss: { commit: "synthetic" },
    };
    expectAssemblyError(extra, metadata, "INVALID_SOURCE_INPUT");
  });

  it("allows unavailable simulation to produce STOP without invented raw context", () => {
    const source = buildSource();
    source.simulation = {
      availability: "MISSING",
      failure: {
        code: StableCodeSchema.parse("SYNTHETIC_SIMULATION_MISSING"),
        sourceReferences: [pointer("/capability")],
      },
    };
    source.alignment.checks = source.alignment.checks.map((check) => ({
      ...check,
      sourceReferences: [pointer("/simulation/availability")],
    }));
    const metadata = { ...buildMetadata(), limitations: [] };
    const report = assemblePreflightReportV0_1(source, metadata);

    expect(report.simulation).not.toHaveProperty("raw");
    expect(report.decision).toEqual({
      status: "STOP",
      reasons: [
        {
          code: "SIMULATION_MISSING",
          sourceReferences: ["/simulation/availability"],
        },
      ],
    });
  });

  it("keeps no-critical validation owned by the public Decision Engine", () => {
    const source = buildSource();
    source.alignment.checks = source.alignment.checks.map((check) => ({
      ...check,
      critical: false,
    }));

    expect(() => assemblePreflightReportV0_1(source, buildMetadata())).toThrow(
      DecisionInputErrorV0_1,
    );
  });

  it("rejects strict source, metadata, and final-report failures", () => {
    const source = buildSource();
    const metadata = buildMetadata();
    expectAssemblyError(
      { ...source, schemaVersion: "0.2" },
      metadata,
      "UNSUPPORTED_SCHEMA_VERSION",
    );
    expectAssemblyError(
      { ...source, display: true },
      metadata,
      "INVALID_SOURCE_INPUT",
    );
    const duplicateQuotes = structuredClone(source);
    duplicateQuotes.quotes.push(structuredClone(duplicateQuotes.quotes[0]));
    expectAssemblyError(duplicateQuotes, metadata, "INVALID_SOURCE_INPUT");
    expectAssemblyError(
      source,
      { ...metadata, generatedAt: "now" },
      "INVALID_METADATA",
    );
    expectAssemblyError(
      source,
      { ...metadata, display: true },
      "INVALID_METADATA",
    );
    expectAssemblyError(
      source,
      {
        ...metadata,
        limitations: [
          {
            ...metadata.limitations[0],
            sourceReferences: [pointer("/simulation/raw/missing")],
          },
        ],
      },
      "INVALID_PREFLIGHT_REPORT",
    );
  });

  it("is deterministic, fresh, non-mutating, and metadata-injected", () => {
    const source = buildSource();
    const metadata = buildMetadata();
    const sourceBefore = structuredClone(source);
    const metadataBefore = structuredClone(metadata);
    const first = assemblePreflightReportV0_1(source, metadata);
    const second = assemblePreflightReportV0_1(source, metadata);
    const changedMetadata = {
      ...metadata,
      reportId: ReportIdSchema.parse("99999999-9999-4999-8999-999999999999"),
      generatedAt: GeneratedAtSchema.parse("2031-03-04T05:06:08.000Z"),
    };
    const changed = assemblePreflightReportV0_1(source, changedMetadata);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.intent).not.toBe(second.intent);
    expect(source).toEqual(sourceBefore);
    expect(metadata).toEqual(metadataBefore);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(metadata)).toBe(false);
    expect(changed.decision).toEqual(first.decision);
    expect(changed.intent).toEqual(first.intent);
    expect(changed.reportId).toBe(changedMetadata.reportId);
    expect(changed.generatedAt).toBe(changedMetadata.generatedAt);
  });

  it("does not read clock, randomness, or network", () => {
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("clock forbidden");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("random forbidden");
    });
    const fetch = vi.fn(() => {
      throw new Error("network forbidden");
    });
    vi.stubGlobal("fetch", fetch);
    try {
      expect(
        assemblePreflightReportV0_1(buildSource(), buildMetadata()).decision,
      ).toEqual({ status: "MANUAL_REVIEW" });
      expect(now).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      random.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe("descriptor-safe JSON cloning", () => {
  it("accepts primitives, valid Unicode, null prototypes, frozen data, and aliases", () => {
    for (const value of [null, true, "😀", 42]) {
      expect(cloneDescriptorClosedJsonV0_1(value)).toEqual({
        success: true,
        value,
      });
    }
    const shared = { value: true };
    const input = Object.assign(Object.create(null), {
      first: shared,
      second: shared,
      list: [shared],
    });
    deepFreeze(input);
    const cloned = cloneDescriptorClosedJsonV0_1(input);
    expect(cloned.success).toBe(true);
    if (!cloned.success) {
      throw new Error("valid JSON graph was rejected");
    }
    const output = cloned.value as MutableRecord;
    expect(output).toEqual({
      first: { value: true },
      second: { value: true },
      list: [{ value: true }],
    });
    expect(output.first).not.toBe(output.second);
  });

  it("rejects accessors without reading them and rejects Proxies", () => {
    let reads = 0;
    const accessor: MutableRecord = {};
    Object.defineProperty(accessor, "secret", {
      enumerable: true,
      get() {
        reads += 1;
        return "must-not-read";
      },
    });
    expect(cloneDescriptorClosedJsonV0_1(accessor)).toEqual({
      success: false,
    });
    expect(reads).toBe(0);

    const proxy = new Proxy(
      {},
      {
        get() {
          throw new Error("proxy trap must not run");
        },
      },
    );
    expect(cloneDescriptorClosedJsonV0_1(proxy)).toEqual({ success: false });
  });

  it("fails closed when the Node Proxy detector is absent or throws", () => {
    const originalProcess = (globalThis as unknown as { process: unknown })
      .process;
    vi.stubGlobal("process", undefined);
    expect(cloneDescriptorClosedJsonV0_1({ value: true })).toEqual({
      success: false,
    });
    vi.stubGlobal("process", {
      getBuiltinModule() {
        throw new Error("node:util unavailable");
      },
    });
    expect(cloneDescriptorClosedJsonV0_1({ value: true })).toEqual({
      success: false,
    });
    vi.stubGlobal("process", originalProcess);
    vi.unstubAllGlobals();
  });

  it.each([
    ["undefined", undefined],
    ["function", () => true],
    ["symbol", Symbol("value")],
    ["bigint", 1n],
    ["non-finite", Number.POSITIVE_INFINITY],
    ["negative zero", -0],
    ["lone high surrogate", "\uD800"],
    ["lone low surrogate", "\uDC00"],
    ["custom prototype", new Date(0)],
  ])("rejects %s", (_name, value) => {
    expect(cloneDescriptorClosedJsonV0_1(value)).toEqual({ success: false });
  });

  it("rejects cycles and invalid child values", () => {
    const cycle: MutableRecord = {};
    cycle.self = cycle;
    expect(cloneDescriptorClosedJsonV0_1(cycle)).toEqual({ success: false });
    expect(cloneDescriptorClosedJsonV0_1({ value: () => true })).toEqual({
      success: false,
    });
    expect(cloneDescriptorClosedJsonV0_1([() => true])).toEqual({
      success: false,
    });
  });

  it("rejects invalid record keys and descriptors", () => {
    const values: object[] = [];
    for (const key of ["__proto__", "constructor", "prototype", "\uD800"]) {
      const value = {};
      Object.defineProperty(value, key, {
        configurable: true,
        enumerable: true,
        value: true,
        writable: true,
      });
      values.push(value);
    }
    const symbol = {};
    Object.defineProperty(symbol, Symbol("key"), {
      enumerable: true,
      value: true,
    });
    values.push(symbol);
    const hidden = {};
    Object.defineProperty(hidden, "hidden", {
      enumerable: false,
      value: true,
    });
    values.push(hidden);
    for (const value of values) {
      expect(cloneDescriptorClosedJsonV0_1(value)).toEqual({
        success: false,
      });
    }
  });

  it("rejects sparse, extended, hidden-index, and custom-prototype arrays", () => {
    const sparse = new Array(2);
    const extended = [1];
    Object.defineProperty(extended, "extra", {
      enumerable: true,
      value: 2,
    });
    const hidden = [1];
    Object.defineProperty(hidden, "0", {
      enumerable: false,
      value: 1,
    });
    const custom = Object.setPrototypeOf([1], null);
    for (const value of [sparse, extended, hidden, custom]) {
      expect(cloneDescriptorClosedJsonV0_1(value)).toEqual({
        success: false,
      });
    }
  });

  it("classifies hostile public inputs without triggering them", () => {
    let reads = 0;
    const hostile = buildSource() as unknown as MutableRecord;
    Object.defineProperty(hostile, "secret", {
      enumerable: true,
      get() {
        reads += 1;
        return "must-not-read";
      },
    });
    expectAssemblyError(hostile, buildMetadata(), "INVALID_SOURCE_INPUT");
    expect(reads).toBe(0);
    expectAssemblyError(buildSource(), { value: 1n }, "INVALID_METADATA");
  });
});
