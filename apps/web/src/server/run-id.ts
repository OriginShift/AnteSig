import "server-only";

import { randomUUID } from "node:crypto";
import { RunIdSchema, type RunId } from "../contracts/preflight";

export function createRunId(): RunId {
  return RunIdSchema.parse(`run_${randomUUID()}`);
}
