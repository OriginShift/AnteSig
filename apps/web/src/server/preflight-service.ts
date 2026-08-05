import "server-only";

import type { PreflightReport } from "@moss-mini-demo/report-schema";
import type { PreflightRequest, RunId } from "../contracts/preflight";

export type PreflightServiceInput = Readonly<{
  runId: RunId;
  request: PreflightRequest;
}>;

export type PreflightServiceResult =
  | Readonly<{ status: "SUCCESS"; report: PreflightReport }>
  | Readonly<{
      status: "UNAVAILABLE";
      code: "LIVE_UNAVAILABLE";
      message: string;
    }>;

export interface PreflightService {
  run(input: PreflightServiceInput): Promise<PreflightServiceResult>;
}
