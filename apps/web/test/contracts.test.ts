import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type PreflightReport,
  PreflightReportSchema,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "../src/contracts/health";
import {
  FIXTURE_SCENARIOS,
  FixturePreflightSuccessSchema,
  MAX_PREFLIGHT_REQUEST_BYTES,
  MAX_PREFLIGHT_RESPONSE_BYTES,
  PreflightErrorResponseSchema,
  PreflightRequestSchema,
  PreflightResponseSchema,
  RunIdSchema,
} from "../src/contracts/preflight";

const RUN_ID = "run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e";

function readManualReviewFixture(): PreflightReport {
  return PreflightReportSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "packages/report-schema/fixtures/manual-review-success.v0.1.json",
        ),
        "utf8",
      ),
    ),
  );
}

function presentation(report: PreflightReport) {
  const decision =
    report.decision.status === "MANUAL_REVIEW"
      ? { status: "MANUAL_REVIEW" }
      : {
          status: "STOP",
          heading: "STOP",
          actionBoundary: "DO_NOT_PROCEED_TO_SIGNER",
          reasons: report.decision.reasons.map((reason) => ({
            code: reason.code,
            explanation: "Contract-test explanation.",
            sourceReferences: reason.sourceReferences,
          })),
        };
  return {
    schemaVersion: "0.1",
    reportId: report.reportId,
    decision,
    sourceContextReferences: [],
    limitationReferences: report.limitations.map(
      (_limitation, index) => `/limitations/${index}`,
    ),
  };
}

describe("preflight contracts", () => {
  const fixture = readManualReviewFixture();
  const intent = fixture.intent;

  it("accepts only strict LIVE and allowlisted FIXTURE requests", () => {
    expect(
      PreflightRequestSchema.safeParse({
        contractVersion: "0.1",
        mode: "LIVE",
        intent,
      }).success,
    ).toBe(true);

    for (const scenario of FIXTURE_SCENARIOS) {
      expect(
        PreflightRequestSchema.safeParse({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario,
        }).success,
      ).toBe(true);
    }
  });

  it.each([
    ["lowercase mode", { contractVersion: "0.1", mode: "live", intent }],
    [
      "unknown fixture path",
      {
        contractVersion: "0.1",
        mode: "FIXTURE",
        scenario: "../../private.json",
      },
    ],
    [
      "extra key",
      {
        contractVersion: "0.1",
        mode: "FIXTURE",
        scenario: "manual-review-success",
        extra: true,
      },
    ],
    [
      "caller runId",
      {
        contractVersion: "0.1",
        mode: "FIXTURE",
        scenario: "manual-review-success",
        runId: RUN_ID,
      },
    ],
    [
      "scenario on LIVE",
      {
        contractVersion: "0.1",
        mode: "LIVE",
        intent,
        scenario: "manual-review-success",
      },
    ],
    [
      "intent on FIXTURE",
      {
        contractVersion: "0.1",
        mode: "FIXTURE",
        scenario: "manual-review-success",
        intent,
      },
    ],
    ["array body", []],
    ["invalid intent", { contractVersion: "0.1", mode: "LIVE", intent: {} }],
    [
      "prototype-sensitive key",
      JSON.parse(
        '{"contractVersion":"0.1","mode":"FIXTURE","scenario":"manual-review-success","__proto__":{}}',
      ),
    ],
  ])("rejects %s", (_name, value) => {
    expect(PreflightRequestSchema.safeParse(value).success).toBe(false);
  });

  it("enforces the runId UUID v4 format", () => {
    expect(RunIdSchema.safeParse(RUN_ID).success).toBe(true);
    expect(
      RunIdSchema.safeParse("run_018f4ca2-7a44-3b81-9d7d-a6d4508cf21e").success,
    ).toBe(false);
    expect(
      RunIdSchema.safeParse("018f4ca2-7a44-4b81-9d7d-a6d4508cf21e").success,
    ).toBe(false);
  });

  it("correlates FIXTURE success with FIXTURE provenance", () => {
    const response = {
      contractVersion: "0.1",
      ok: true,
      runId: RUN_ID,
      mode: "FIXTURE",
      scenario: "manual-review-success",
      report: fixture,
      presentation: presentation(fixture),
    };
    expect(FixturePreflightSuccessSchema.safeParse(response).success).toBe(
      true,
    );
    expect(
      FixturePreflightSuccessSchema.safeParse({
        ...response,
        report: { ...fixture, provenance: "LOCAL_FORK" },
      }).success,
    ).toBe(false);
  });

  it("accepts LIVE success only for live-source or local-fork provenance", () => {
    const base = {
      contractVersion: "0.1",
      ok: true,
      runId: RUN_ID,
      mode: "LIVE",
      presentation: presentation(fixture),
    };
    for (const provenance of ["LIVE_SOURCE", "LOCAL_FORK"]) {
      expect(
        PreflightResponseSchema.safeParse({
          ...base,
          report: { ...fixture, provenance },
        }).success,
      ).toBe(true);
    }
    expect(
      PreflightResponseSchema.safeParse({ ...base, report: fixture }).success,
    ).toBe(false);
  });

  it("keeps structured errors strict and bounded", () => {
    const error = {
      contractVersion: "0.1",
      ok: false,
      runId: RUN_ID,
      error: {
        code: "INVALID_REQUEST",
        message: "Request does not match the preflight contract.",
      },
    };
    expect(PreflightErrorResponseSchema.safeParse(error).success).toBe(true);
    expect(
      PreflightErrorResponseSchema.safeParse({ ...error, report: fixture })
        .success,
    ).toBe(false);
    expect(
      PreflightErrorResponseSchema.safeParse({
        ...error,
        error: { ...error.error, message: "x".repeat(257) },
      }).success,
    ).toBe(false);
    expect(
      PreflightErrorResponseSchema.safeParse({
        ...error,
        error: {
          code: "PREFLIGHT_TIMEOUT",
          message: "The preflight request exceeded its hard deadline.",
        },
      }).success,
    ).toBe(true);
  });

  it("requires a strict presentation correlated to its report", () => {
    const response = {
      contractVersion: "0.1",
      ok: true,
      runId: RUN_ID,
      mode: "FIXTURE",
      scenario: "manual-review-success",
      report: fixture,
      presentation: presentation(fixture),
    };
    expect(PreflightResponseSchema.safeParse(response).success).toBe(true);
    expect(
      PreflightResponseSchema.safeParse({
        ...response,
        presentation: {
          ...response.presentation,
          reportId: "88888888-8888-4888-8888-888888888888",
        },
      }).success,
    ).toBe(false);
    expect(
      PreflightResponseSchema.safeParse({
        ...response,
        presentation: { ...response.presentation, extra: true },
      }).success,
    ).toBe(false);
  });

  it("freezes the UTF-8 byte limits", () => {
    expect(MAX_PREFLIGHT_REQUEST_BYTES).toBe(65_536);
    expect(MAX_PREFLIGHT_RESPONSE_BYTES).toBe(2_097_152);
  });
});

describe("health contract", () => {
  it("accepts exactly the frozen health object", () => {
    const health = {
      contractVersion: "0.1",
      status: "ok",
      app: {
        name: "antesig",
        version: "0.0.0",
        runtime: "nodejs",
        nodeVersion: "22.23.1",
      },
      moss: {
        sourceMode: "INTEGRATION_FORK",
        upstreamCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
        integrationCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
        officialRelease: false,
        packages: {
          "@themoss/core": "0.1.0",
          "@themoss/simulator": "0.1.0",
          "@themoss/protocol-kuru": "0.1.0",
          "@themoss/protocol-pancakeswap": "0.1.0",
        },
      },
      network: { configured: false, id: null },
      clear402: { enabled: false },
    };

    const parsed = HealthResponseSchema.parse(health);
    expect(Object.keys(parsed)).toEqual([
      "contractVersion",
      "status",
      "app",
      "moss",
      "network",
      "clear402",
    ]);
    expect(
      HealthResponseSchema.safeParse({ ...health, timestamp: "now" }).success,
    ).toBe(false);
  });
});
