import { FakePreflightService } from "../../../src/server/fake-preflight-service";
import { createPreflightHandler } from "../../../src/server/preflight-handler";
import { createRunId } from "../../../src/server/run-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlePreflight = createPreflightHandler({
  service: new FakePreflightService(),
  generateRunId: createRunId,
});

export async function POST(request: Request): Promise<Response> {
  return handlePreflight(request);
}
