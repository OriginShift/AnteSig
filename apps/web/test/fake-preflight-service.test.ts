import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import {
  FIXTURE_SCENARIOS,
  type FixtureScenario,
  RunIdSchema,
} from "../src/contracts/preflight";
import { FakePreflightService } from "../src/server/fake-preflight-service";

vi.mock("server-only", () => ({}));

const RUN_ID = RunIdSchema.parse("run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e");
const FIXTURE_FILES = {
  "manual-review-success": "manual-review-success.v0.1.json",
  "token-out-mismatch": "token-out-mismatch.v0.1.json",
  "amount-in-mismatch": "amount-in-mismatch.v0.1.json",
} as const satisfies Record<FixtureScenario, string>;

function readFixture(scenario: FixtureScenario): unknown {
  return JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        "packages/report-schema/fixtures",
        FIXTURE_FILES[scenario],
      ),
      "utf8",
    ),
  );
}

describe("FakePreflightService", () => {
  it.each(FIXTURE_SCENARIOS)(
    "returns the validated %s synthetic Fixture without changing its Decision",
    async (scenario) => {
      const service = new FakePreflightService();
      const request = {
        contractVersion: "0.1" as const,
        mode: "FIXTURE" as const,
        scenario,
      };
      const requestBefore = structuredClone(request);
      const rawFixture = readFixture(scenario);
      const expected = PreflightReportSchema.parse(rawFixture);

      const result = await service.run({ runId: RUN_ID, request });

      expect(result.status).toBe("SUCCESS");
      if (result.status !== "SUCCESS") {
        throw new Error("Fake Fixture scenario must succeed");
      }
      expect(PreflightReportSchema.safeParse(result.report).success).toBe(true);
      expect(result.report.provenance).toBe("FIXTURE");
      expect(result.report.decision).toEqual(expected.decision);
      expect(result.report).toEqual(expected);
      expect(request).toEqual(requestBefore);
      expect(result).not.toHaveProperty("runId");
    },
  );

  it("returns LIVE_UNAVAILABLE without a Fixture fallback", async () => {
    const service = new FakePreflightService();
    const fixture = PreflightReportSchema.parse(
      readFixture("manual-review-success"),
    );
    const request = {
      contractVersion: "0.1" as const,
      mode: "LIVE" as const,
      intent: fixture.intent,
    };
    const snapshot = structuredClone(request);

    const result = await service.run({ runId: RUN_ID, request });

    expect(result).toEqual({
      status: "UNAVAILABLE",
      code: "LIVE_UNAVAILABLE",
      message: "Live preflight is unavailable in this baseline.",
    });
    expect(result).not.toHaveProperty("report");
    expect(request).toEqual(snapshot);
  });

  it("returns independent report values across repeated calls", async () => {
    const service = new FakePreflightService();
    const input = {
      runId: RUN_ID,
      request: {
        contractVersion: "0.1" as const,
        mode: "FIXTURE" as const,
        scenario: "manual-review-success" as const,
      },
    };

    const first = await service.run(input);
    const second = await service.run(input);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    if (first.status === "SUCCESS" && second.status === "SUCCESS") {
      expect(first.report).not.toBe(second.report);
    }
  });
});
