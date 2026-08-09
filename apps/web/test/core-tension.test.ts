import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import amountMismatchReport from "../../../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json";
import manualReviewReport from "../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import {
  coreTensionModel,
  formatNativeAmount,
  ratioLabel,
  tensionProvenanceLabel,
} from "../src/client/core-tension";

function input(report: ReturnType<typeof PreflightReportSchema.parse>) {
  return {
    capability: report.capability,
    intent: report.intent,
    quotes: report.quotes,
    selection: report.selection,
    simulation: report.simulation,
  };
}

describe("Core tension", () => {
  it("retains exact mismatch amounts and derives the provenance label", () => {
    const report = PreflightReportSchema.parse(amountMismatchReport);
    expect(coreTensionModel(input(report))).toEqual({
      requested: "1000000000000000000",
      prepared: "10000000000000000000",
      observed: "10000000000000000000",
    });
    expect(formatNativeAmount("1000000000000000")).toBe("0.001 NATIVE");
    expect(ratioLabel("1000000000000000000", "10000000000000000000")).toBe(
      "10x",
    );
    expect(tensionProvenanceLabel("LIVE_SOURCE")).toBe(
      "LIVE_SOURCE / SOURCE-BOUND",
    );
  });

  it("stays absent when the source-bound amounts align", () => {
    const report = PreflightReportSchema.parse(manualReviewReport);
    expect(coreTensionModel(input(report))).toBeUndefined();
  });
});
