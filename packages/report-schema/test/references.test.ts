import { describe, expect, it } from "vitest";
import {
  JsonPointerSyntaxSchema,
  PreflightReportSchema,
  type PreflightReportInput,
} from "../src/index.js";
import { buildManualReviewReport, unavailable } from "./synthetic.js";

function setSelectionReferences(
  report: PreflightReportInput,
  sourceReferences: string[],
): void {
  report.selection.reason.sourceReferences = sourceReferences;
}

describe("JSON Pointer syntax and contextual SourceReference validation", () => {
  it.each([
    "/decision/reasons/0",
    "/alignment/checks/0",
    "/does/not/exist",
    "/capability/raw/display",
    "/capability/raw/tx#hash",
  ])("accepts syntax without claiming report context for %s", (pointer) => {
    expect(JsonPointerSyntaxSchema.safeParse(pointer).success).toBe(true);
  });

  it.each(["", "intent", "#/intent", "/intent%2Faccount", "/intent/~2"])(
    "rejects invalid pointer syntax %s",
    (pointer) => {
      expect(JsonPointerSyntaxSchema.safeParse(pointer).success).toBe(false);
    },
  );

  it.each([
    ["a decision path", "/decision"],
    ["a limitations path", "/limitations"],
    ["an alignment result", "/alignment/checks/0"],
    ["a dangling path", "/quotes/99"],
    ["an ambiguous non-canonical array index", "/quotes/01"],
    ["reference metadata", "/selection/reason/sourceReferences/0"],
  ])("rejects %s in full report context", (_name, pointer) => {
    const report = buildManualReviewReport();
    setSelectionReferences(report, [pointer]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it.each([
    ["itself", "/selection/reason"],
    ["an owner ancestor", "/selection"],
    ["an owner descendant", "/selection/reason/code"],
  ])("rejects owner self-authentication through %s", (_name, pointer) => {
    const report = buildManualReviewReport();
    setSelectionReferences(report, [pointer]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects a resolvable cross-owner metadata-array reference", () => {
    const report = buildManualReviewReport();
    report.limitations = [
      {
        code: "SYNTHETIC_METADATA_REFERENCE",
        description: "Synthetic limitation for reference validation.",
        sourceReferences: ["/selection/reason/sourceReferences/0"],
      },
    ];

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it.each([
    ["Selection to later Capability", "/capability"],
    ["Selection to later Simulation", "/simulation"],
  ])("rejects an unrelated %s reference", (_name, pointer) => {
    const report = buildManualReviewReport();
    setSelectionReferences(report, [pointer]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects a cross-owner reference cycle", () => {
    const report = buildManualReviewReport();
    if (report.simulation.availability !== "AVAILABLE") {
      throw new Error("synthetic report must have simulation evidence");
    }
    report.simulation.receipts = unavailable(
      "MISSING",
      "SYNTHETIC_RECEIPTS_MISSING",
      ["/simulation/outcomes/failure"],
    );
    report.simulation.outcomes = unavailable(
      "MISSING",
      "SYNTHETIC_OUTCOMES_MISSING",
      ["/simulation/receipts/failure"],
    );
    report.decision = {
      status: "STOP",
      reasons: [
        {
          code: "SYNTHETIC_COMPONENT_CYCLE",
          sourceReferences: ["/simulation/receipts", "/simulation/outcomes"],
        },
      ],
    };

    const parsed = PreflightReportSchema.safeParse(report);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("cyclic report unexpectedly passed");
    }
    expect(
      parsed.error.issues.some((issue) => issue.message.includes("cycle")),
    ).toBe(true);
  });

  it("allows reserved field names inside source-owned raw subtrees", () => {
    const report = buildManualReviewReport();
    const quote = report.quotes[0];
    const check = report.alignment.checks[0];
    if (quote?.status !== "SUCCESS" || check === undefined) {
      throw new Error("synthetic report is incomplete");
    }
    if (report.simulation.availability !== "AVAILABLE") {
      throw new Error("synthetic report must have simulation evidence");
    }
    if (report.simulation.receipts.availability !== "AVAILABLE") {
      throw new Error("synthetic report must have Receipt evidence");
    }

    quote.raw = { prose: { preserved: true } };
    report.capability = {
      availability: "AVAILABLE",
      raw: { display: { preserved: true } },
    };
    report.simulation.raw = {
      extensions: { preserved: true },
      sourceReferences: { preserved: true },
    };
    report.simulation.receipts.items[0] = {
      status: "SUCCESS",
      raw: { extension: { preserved: true } },
    };
    check.sourceReferences = [
      "/quotes/0/raw/prose",
      "/capability/raw/display",
      "/simulation/raw/extensions",
      "/simulation/raw/sourceReferences",
      "/simulation/receipts/items/0/raw/extension",
    ];

    const parsed = PreflightReportSchema.safeParse(report);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    expect(parsed.data.quotes[0]).toMatchObject({ raw: quote.raw });
    expect(parsed.data.capability).toEqual(report.capability);
    expect(parsed.data.simulation).toEqual(report.simulation);
  });

  it("accepts # as an ordinary token character in source-owned raw data", () => {
    const report = buildManualReviewReport();
    const check = report.alignment.checks[0];
    if (check === undefined) {
      throw new Error("synthetic report must contain an Alignment check");
    }

    report.capability = {
      availability: "AVAILABLE",
      raw: { "tx#hash": "synthetic-transaction-hash" },
    };
    check.sourceReferences = ["/capability/raw/tx#hash"];

    expect(PreflightReportSchema.safeParse(report).success).toBe(true);
  });
});
