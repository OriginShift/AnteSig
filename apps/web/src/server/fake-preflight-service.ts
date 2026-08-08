import "server-only";

import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import amountInMismatch from "../../../../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json";
import manualReviewSuccess from "../../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import tokenOutMismatch from "../../../../packages/report-schema/fixtures/token-out-mismatch.v0.1.json";
import type { FixtureScenario } from "../contracts/preflight";
import type {
  PreflightService,
  PreflightServiceInput,
  PreflightServiceResult,
} from "./preflight-service";

const FIXTURES = {
  "manual-review-success": manualReviewSuccess,
  "token-out-mismatch": tokenOutMismatch,
  "amount-in-mismatch": amountInMismatch,
} as const satisfies Record<FixtureScenario, unknown>;

function readFixture(scenario: FixtureScenario) {
  return PreflightReportSchema.parse(FIXTURES[scenario]);
}

export class FakePreflightService implements PreflightService {
  async run(input: PreflightServiceInput): Promise<PreflightServiceResult> {
    if (input.request.mode === "LIVE") {
      return {
        status: "UNAVAILABLE",
        code: "LIVE_UNAVAILABLE",
        message: "Live preflight is unavailable in this baseline.",
      };
    }

    return {
      status: "SUCCESS",
      report: structuredClone(readFixture(input.request.scenario)),
    };
  }
}
