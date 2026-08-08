import {
  GeneratedAtSchema,
  JsonPointerSyntaxSchema,
  NetworkSchema,
  type PreflightReport,
  PreflightReportSchema,
  ReportIdSchema,
  StableCodeSchema,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import {
  assemblePreflightReportV0_1,
  derivePreflightPresentationV0_1,
  evaluateAlignmentV0_1,
  PreflightAssemblyErrorV0_1,
  type PreflightAssemblyMetadataV0_1,
  type PreflightAssemblySourceV0_1,
} from "../src/index.js";
import { buildPassingInput } from "./synthetic.js";

type MutableRecord = Record<string, unknown>;

function pointer(value: string) {
  return JsonPointerSyntaxSchema.parse(value);
}

function metadata(
  limitations: PreflightAssemblyMetadataV0_1["limitations"] = [
    {
      code: StableCodeSchema.parse("SYNTHETIC_PRESENTATION_LIMITATION"),
      description: "Synthetic material is not live evidence.",
      sourceReferences: [pointer("/simulation/raw/context/block")],
    },
  ],
): PreflightAssemblyMetadataV0_1 {
  return {
    reportId: ReportIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    generatedAt: GeneratedAtSchema.parse("2031-03-04T05:06:07.000Z"),
    network: NetworkSchema.parse("eip155:143"),
    provenance: "FIXTURE",
    limitations,
  };
}

function source(
  mutate?: (input: ReturnType<typeof buildPassingInput>) => void,
): PreflightAssemblySourceV0_1 {
  const input = buildPassingInput();
  mutate?.(input);
  if (input.simulation.availability !== "AVAILABLE") {
    throw new Error("synthetic simulation is unavailable");
  }
  const context = (input.simulation.raw as MutableRecord)
    .context as MutableRecord;
  context.block = {
    status: "PROVEN",
    blockNumber: "0x456",
    blockHash: `0x${"cd".repeat(32)}`,
  };
  context.moss = {
    buildInfo: {
      sourceMode: "SYNTHETIC_TEST",
      upstreamCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
    },
    mossCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
  };
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

function manualReport(): PreflightReport {
  return assemblePreflightReportV0_1(source(), metadata());
}

function stopReport(): PreflightReport {
  const warning = {
    code: "RAW_WARNING_CODE",
    message: "raw source message",
    value: "raw source value",
  };
  return assemblePreflightReportV0_1(
    source((input) => {
      if (
        input.simulation.availability !== "AVAILABLE" ||
        input.simulation.warnings.availability !== "AVAILABLE"
      ) {
        throw new Error("synthetic warnings are unavailable");
      }
      input.simulation.warnings.items = [structuredClone(warning)];
      const context = (input.simulation.raw as MutableRecord)
        .context as MutableRecord;
      context.warnings = [structuredClone(warning)];
      if (input.observations.warnings.availability !== "AVAILABLE") {
        throw new Error("synthetic warning observation is unavailable");
      }
      input.observations.warnings.value = [structuredClone(warning)];
    }),
    metadata(),
  );
}

function resolvePointer(document: unknown, pointerValue: string): unknown {
  let current = document;
  for (const segment of pointerValue
    .slice(1)
    .split("/")
    .map((value) => value.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (typeof current !== "object" || current === null) {
      throw new Error(`unresolved synthetic pointer ${pointerValue}`);
    }
    current = (current as MutableRecord)[segment];
  }
  return current;
}

describe("Preflight presentation sidecar", () => {
  it("preserves exact reasonless MANUAL_REVIEW semantics", () => {
    const presentation = derivePreflightPresentationV0_1(manualReport());

    expect(presentation.decision).toEqual({ status: "MANUAL_REVIEW" });
    expect(Object.keys(presentation.decision)).toEqual(["status"]);
    expect(presentation.decision).not.toHaveProperty("reasons");
    expect(JSON.stringify(presentation)).not.toMatch(
      /safe|approved|authorized|executable|permission to sign/i,
    );
  });

  it("derives every STOP explanation from exact Engine code and references", () => {
    const report = stopReport();
    const presentation = derivePreflightPresentationV0_1(report);
    if (
      report.decision.status !== "STOP" ||
      presentation.decision.status !== "STOP"
    ) {
      throw new Error("synthetic STOP was not preserved");
    }

    expect(presentation.decision.heading).toBe("STOP");
    expect(presentation.decision.actionBoundary).toBe(
      "DO_NOT_PROCEED_TO_SIGNER",
    );
    expect(presentation.decision.reasons.map((reason) => reason.code)).toEqual(
      report.decision.reasons.map((reason) => reason.code),
    );
    expect(
      presentation.decision.reasons.map((reason) => reason.sourceReferences),
    ).toEqual(report.decision.reasons.map((reason) => reason.sourceReferences));
    expect(
      presentation.decision.reasons.every(
        (reason) => reason.explanation.length > 0,
      ),
    ).toBe(true);
  });

  it("never copies or overrides raw code, message, value, block, or Moss data", () => {
    const report = stopReport();
    const reportBefore = structuredClone(report);
    const presentation = derivePreflightPresentationV0_1(report);
    const serialized = JSON.stringify(presentation);

    expect(serialized).not.toContain("RAW_WARNING_CODE");
    expect(serialized).not.toContain("raw source message");
    expect(serialized).not.toContain("raw source value");
    expect(serialized).not.toContain("blockNumber");
    expect(serialized).not.toContain("upstreamCommit");
    expect(presentation).not.toHaveProperty("raw");
    expect(report).toEqual(reportBefore);

    if (presentation.decision.status !== "STOP") {
      throw new Error("synthetic STOP was not preserved");
    }
    const mutable = presentation.decision
      .reasons[0] as unknown as MutableRecord;
    mutable.explanation = "caller mutation";
    (mutable.sourceReferences as string[])[0] = "/intent";
    expect(report).toEqual(reportBefore);

    expect(() =>
      derivePreflightPresentationV0_1({
        ...report,
        presentation: { rawCode: "OVERRIDE" },
      }),
    ).toThrow(PreflightAssemblyErrorV0_1);
  });

  it("links only existing source context and limitation values", () => {
    const report = manualReport();
    const presentation = derivePreflightPresentationV0_1(report);

    expect(presentation.sourceContextReferences).toEqual([
      "/simulation/raw/context/block",
      "/simulation/raw/context/moss",
    ]);
    expect(presentation.limitationReferences).toEqual(["/limitations/0"]);
    for (const reference of [
      ...presentation.sourceContextReferences,
      ...presentation.limitationReferences,
    ]) {
      expect(resolvePointer(report, reference)).toBeDefined();
    }
    if (presentation.decision.status !== "MANUAL_REVIEW") {
      throw new Error("synthetic MANUAL_REVIEW was not preserved");
    }
    expect(presentation.decision).not.toHaveProperty("sourceReferences");
  });

  it("omits context references when valid public reports do not contain them", () => {
    const noContext = structuredClone(manualReport());
    if (noContext.simulation.availability !== "AVAILABLE") {
      throw new Error("synthetic simulation is unavailable");
    }
    noContext.simulation.raw = { source: "public-schema-only" };
    noContext.alignment.checks = noContext.alignment.checks.map((check) => ({
      ...check,
      sourceReferences: [pointer("/intent")],
    }));
    noContext.limitations = [];
    expect(PreflightReportSchema.safeParse(noContext).success).toBe(true);
    expect(
      derivePreflightPresentationV0_1(noContext).sourceContextReferences,
    ).toEqual([]);

    const scalarRaw = structuredClone(noContext);
    if (scalarRaw.simulation.availability !== "AVAILABLE") {
      throw new Error("synthetic simulation is unavailable");
    }
    scalarRaw.simulation.raw = "source-owned-scalar";
    expect(PreflightReportSchema.safeParse(scalarRaw).success).toBe(true);
    expect(
      derivePreflightPresentationV0_1(scalarRaw).sourceContextReferences,
    ).toEqual([]);
  });

  it("includes only context keys that actually exist", () => {
    const blockOnly = structuredClone(manualReport());
    if (blockOnly.simulation.availability !== "AVAILABLE") {
      throw new Error("synthetic simulation is unavailable");
    }
    const blockContext = (blockOnly.simulation.raw as MutableRecord)
      .context as MutableRecord;
    delete blockContext.moss;
    blockOnly.limitations = [];
    expect(
      derivePreflightPresentationV0_1(blockOnly).sourceContextReferences,
    ).toEqual(["/simulation/raw/context/block"]);

    const mossOnly = structuredClone(manualReport());
    if (mossOnly.simulation.availability !== "AVAILABLE") {
      throw new Error("synthetic simulation is unavailable");
    }
    const mossContext = (mossOnly.simulation.raw as MutableRecord)
      .context as MutableRecord;
    delete mossContext.block;
    mossOnly.limitations = [];
    expect(
      derivePreflightPresentationV0_1(mossOnly).sourceContextReferences,
    ).toEqual(["/simulation/raw/context/moss"]);
  });

  it("omits context for unavailable simulation without inventing values", () => {
    const assemblySource = source();
    assemblySource.simulation = {
      availability: "UNPROVABLE",
      failure: {
        code: StableCodeSchema.parse("SYNTHETIC_UNPROVABLE"),
        sourceReferences: [pointer("/capability")],
      },
    };
    assemblySource.alignment.checks = assemblySource.alignment.checks.map(
      (check) => ({
        ...check,
        sourceReferences: [pointer("/simulation/availability")],
      }),
    );
    const report = assemblePreflightReportV0_1(assemblySource, metadata([]));
    const presentation = derivePreflightPresentationV0_1(report);

    expect(presentation.sourceContextReferences).toEqual([]);
    expect(presentation.decision.status).toBe("STOP");
  });

  it("rejects invalid and descriptor-hostile reports before reading them", () => {
    expect(() =>
      derivePreflightPresentationV0_1({ schemaVersion: "0.1" }),
    ).toThrow(PreflightAssemblyErrorV0_1);
    let reads = 0;
    const accessor = manualReport() as unknown as MutableRecord;
    Object.defineProperty(accessor, "secret", {
      enumerable: true,
      get() {
        reads += 1;
        return "must-not-read";
      },
    });
    expect(() => derivePreflightPresentationV0_1(accessor)).toThrow(
      PreflightAssemblyErrorV0_1,
    );
    expect(reads).toBe(0);

    const cycle = manualReport() as unknown as MutableRecord;
    const simulation = cycle.simulation as MutableRecord;
    const raw = simulation.raw as MutableRecord;
    raw.cycle = raw;
    expect(() => derivePreflightPresentationV0_1(cycle)).toThrow(
      PreflightAssemblyErrorV0_1,
    );

    const proxy = new Proxy(manualReport(), {});
    expect(() => derivePreflightPresentationV0_1(proxy)).toThrow(
      PreflightAssemblyErrorV0_1,
    );
  });

  it("is fresh, deterministic, and free of clock/random/network access", () => {
    const report = stopReport();
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
      const first = derivePreflightPresentationV0_1(report);
      const second = derivePreflightPresentationV0_1(report);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.decision).not.toBe(second.decision);
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
