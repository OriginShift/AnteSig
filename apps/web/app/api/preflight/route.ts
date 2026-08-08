import { FakePreflightService } from "../../../src/server/fake-preflight-service";
import { createPreflightHandler } from "../../../src/server/preflight-handler";
import { PreflightOrchestrator } from "../../../src/server/preflight-orchestrator";
import { createRunId } from "../../../src/server/run-id";
import { resolveCredentialService } from "../../../src/server/credential-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new PreflightOrchestrator({
  fixtureService: new FakePreflightService(),
  resolveLiveSession: () => undefined,
});

export async function POST(request: Request): Promise<Response> {
  const handlePreflight = createPreflightHandler({
    service,
    generateRunId: createRunId,
    credentialService: resolveCredentialService(),
  });
  return handlePreflight(request);
}
