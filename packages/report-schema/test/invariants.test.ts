import { describe, expect, it } from "vitest";
import {
  PreflightReportSchema,
  type PreflightReportInput,
} from "../src/index.js";
import {
  buildManualReviewReport,
  buildStopReport,
  syntheticAddress,
  unavailable,
} from "./synthetic.js";

function availableSimulation(report: PreflightReportInput) {
  if (report.simulation.availability !== "AVAILABLE") {
    throw new Error("synthetic MANUAL_REVIEW report must have a simulation");
  }
  return report.simulation;
}

function selectedQuote(report: PreflightReportInput) {
  const quote = report.quotes[0];
  if (quote?.status !== "SUCCESS") {
    throw new Error(
      "synthetic MANUAL_REVIEW report must have a successful quote",
    );
  }
  return quote;
}

describe("PreflightReport v0.1 cross-field invariants", () => {
  it.each([
    [
      "selects a protocol outside intent",
      (report: PreflightReportInput) => {
        report.intent.allowedProtocols = ["other-protocol"];
      },
    ],
    [
      "selects a failed quote",
      (report: PreflightReportInput) => {
        const quote = selectedQuote(report);
        report.quotes[0] = {
          quoteId: quote.quoteId,
          protocolId: quote.protocolId,
          inputAsset: quote.inputAsset,
          outputAsset: quote.outputAsset,
          inputAmount: quote.inputAmount,
          status: "FAILED",
          failure: {
            code: "SYNTHETIC_QUOTE_FAILED",
            sourceReferences: ["/intent"],
          },
        };
      },
    ],
    [
      "selects a quote with a mismatched amount",
      (report: PreflightReportInput) => {
        selectedQuote(report).inputAmount = "2";
      },
    ],
    [
      "selects a quote with a mismatched output asset",
      (report: PreflightReportInput) => {
        selectedQuote(report).outputAsset = {
          kind: "ERC20",
          address: syntheticAddress("wrong-output-asset"),
        };
      },
    ],
  ])("rejects a selection that %s", (_name, mutate) => {
    const report = buildManualReviewReport();
    mutate(report);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it.each([
    [
      "missing capability",
      (report: PreflightReportInput) => {
        report.capability = unavailable("MISSING");
      },
    ],
    [
      "unprovable simulation",
      (report: PreflightReportInput) => {
        report.simulation = unavailable(
          "UNPROVABLE",
          "SYNTHETIC_NO_SIMULATION",
          ["/capability"],
        );
      },
    ],
    [
      "failed simulation execution",
      (report: PreflightReportInput) => {
        availableSimulation(report).executionStatus = "FAILED";
      },
    ],
    [
      "missing receipts",
      (report: PreflightReportInput) => {
        availableSimulation(report).receipts = unavailable("MISSING");
      },
    ],
    [
      "failed receipt",
      (report: PreflightReportInput) => {
        const receipts = availableSimulation(report).receipts;
        if (receipts.availability !== "AVAILABLE") {
          throw new Error("synthetic report must have receipts");
        }
        receipts.items[0] = {
          status: "FAILED",
          raw: { id: "synthetic-failed" },
        };
      },
    ],
    [
      "empty outcomes",
      (report: PreflightReportInput) => {
        const outcomes = availableSimulation(report).outcomes;
        if (outcomes.availability !== "AVAILABLE") {
          throw new Error("synthetic report must have outcomes");
        }
        outcomes.items = [];
      },
    ],
    [
      "a proven warning",
      (report: PreflightReportInput) => {
        const warnings = availableSimulation(report).warnings;
        if (warnings.availability !== "AVAILABLE") {
          throw new Error("synthetic report must have warnings");
        }
        warnings.items = [{ code: "SYNTHETIC_WARNING" }];
      },
    ],
    [
      "incomplete coverage",
      (report: PreflightReportInput) => {
        const coverage = availableSimulation(report).coverage;
        if (coverage.availability !== "AVAILABLE") {
          throw new Error("synthetic report must have coverage");
        }
        coverage.complete = false;
      },
    ],
    [
      "invalid ordering",
      (report: PreflightReportInput) => {
        const ordering = availableSimulation(report).ordering;
        if (ordering.availability !== "AVAILABLE") {
          throw new Error("synthetic report must have ordering");
        }
        ordering.valid = false;
      },
    ],
    [
      "discontinuous state",
      (report: PreflightReportInput) => {
        const continuity = availableSimulation(report).stateContinuity;
        if (continuity.availability !== "AVAILABLE") {
          throw new Error("synthetic report must have state continuity");
        }
        continuity.continuous = false;
      },
    ],
    [
      "a failed critical alignment check",
      (report: PreflightReportInput) => {
        const check = report.alignment.checks[0];
        if (check === undefined) {
          throw new Error("synthetic report must have a check");
        }
        check.status = "FAIL";
      },
    ],
    [
      "no explicit selection",
      (report: PreflightReportInput) => {
        report.selection = {
          status: "NOT_SELECTED",
          reason: {
            code: "SYNTHETIC_NOT_SELECTED",
            sourceReferences: ["/quotes/0"],
          },
        };
      },
    ],
  ])("rejects MANUAL_REVIEW with %s", (_name, mutate) => {
    const report = buildManualReviewReport();
    mutate(report);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it.each([
    ["a forbidden derived path", "/alignment/checks/0"],
    ["an unresolved path", "/quotes/9"],
    ["a fragment", "/intent#synthetic"],
    ["a percent-encoded path", "/intent%2Faccount"],
  ])("rejects source references with %s", (_name, sourceReference) => {
    const report = buildManualReviewReport();
    if (report.selection.status !== "SELECTED") {
      throw new Error("synthetic report must select its quote");
    }
    report.selection.reason.sourceReferences = [sourceReference];

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects duplicate source references", () => {
    const report = buildManualReviewReport();
    if (report.selection.status !== "SELECTED") {
      throw new Error("synthetic report must select its quote");
    }
    report.selection.reason.sourceReferences = ["/quotes/0", "/quotes/0"];

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("requires structured STOP reasons and does not let limitations replace them", () => {
    const report = buildStopReport();
    if (report.decision.status !== "STOP") {
      throw new Error("synthetic STOP report must stop");
    }
    report.decision.reasons = [];

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("requires STOP reasons to reference the triggering evidence", () => {
    const report = buildStopReport();
    if (report.decision.status !== "STOP") {
      throw new Error("synthetic STOP report must stop");
    }
    report.decision.reasons = [
      {
        code: "SYNTHETIC_UNRELATED_REASON",
        sourceReferences: ["/intent"],
      },
    ];

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });
});
