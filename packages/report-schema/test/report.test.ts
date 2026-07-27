import { describe, expect, it } from "vitest";
import { PreflightReportSchema } from "../src/index.js";
import { buildManualReviewReport, buildStopReport } from "./synthetic.js";

describe("PreflightReport v0.1 envelope", () => {
  it("accepts a complete synthetic MANUAL_REVIEW report", () => {
    const report = buildManualReviewReport();

    expect(PreflightReportSchema.parse(report)).toEqual(report);
  });

  it("accepts a synthetic STOP report with structured reasons", () => {
    const report = buildStopReport();

    expect(PreflightReportSchema.parse(report)).toEqual(report);
  });

  it("rejects unknown top-level and nested fields", () => {
    const topLevel = { ...buildManualReviewReport(), extension: true };
    const report = buildManualReviewReport();
    const nested = {
      ...report,
      intent: { ...report.intent, extension: true },
    };

    expect(PreflightReportSchema.safeParse(topLevel).success).toBe(false);
    expect(PreflightReportSchema.safeParse(nested).success).toBe(false);
  });

  it("does not normalize or discard raw evidence", () => {
    const report = buildManualReviewReport();
    const raw = {
      nested: { order: ["first", "second"] },
      explicitNull: null,
    };
    report.capability = { availability: "AVAILABLE", raw };

    const parsed = PreflightReportSchema.parse(report);

    expect(parsed.capability).toEqual({ availability: "AVAILABLE", raw });
  });

  it("rejects incomplete report envelopes", () => {
    const report = buildManualReviewReport();
    const { capability: _capability, ...withoutCapability } = report;

    expect(PreflightReportSchema.safeParse(withoutCapability).success).toBe(
      false,
    );
  });

  it("rejects duplicate quote and alignment identifiers", () => {
    const duplicateQuote = buildManualReviewReport();
    const quote = duplicateQuote.quotes[0];
    if (quote === undefined) {
      throw new Error("synthetic report must include a quote");
    }
    duplicateQuote.quotes.push(structuredClone(quote));

    const duplicateCheck = buildManualReviewReport();
    const check = duplicateCheck.alignment.checks[0];
    if (check === undefined) {
      throw new Error("synthetic report must include an alignment check");
    }
    duplicateCheck.alignment.checks.push(structuredClone(check));

    expect(PreflightReportSchema.safeParse(duplicateQuote).success).toBe(false);
    expect(PreflightReportSchema.safeParse(duplicateCheck).success).toBe(false);
  });
});
