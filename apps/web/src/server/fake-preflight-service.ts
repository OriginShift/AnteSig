import "server-only";

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import type { FixtureScenario } from "../contracts/preflight";
import type {
  PreflightService,
  PreflightServiceInput,
  PreflightServiceResult,
} from "./preflight-service";

const FIXTURE_FILES = {
  "manual-review-success": "manual-review-success.v0.1.json",
  "token-out-mismatch": "token-out-mismatch.v0.1.json",
  "amount-in-mismatch": "amount-in-mismatch.v0.1.json",
} as const satisfies Record<FixtureScenario, string>;

function repositoryRoot(): string {
  const currentDirectory = process.cwd();
  return basename(currentDirectory) === "web" &&
    basename(dirname(currentDirectory)) === "apps"
    ? resolve(currentDirectory, "../..")
    : currentDirectory;
}

function readFixture(scenario: FixtureScenario) {
  const fixturePath = resolve(
    repositoryRoot(),
    "packages/report-schema/fixtures",
    FIXTURE_FILES[scenario],
  );
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  return PreflightReportSchema.parse(fixture);
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
