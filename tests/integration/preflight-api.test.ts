import { describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/node_modules/server-only", () => ({}));

describe("POST /api/preflight offline integration", () => {
  it("runs the public Moss pipeline and returns a correlated safe response", async () => {
    vi.doMock("server-only", () => ({}));
    const [
      { PreflightResponseSchema, RunIdSchema },
      { createPreflightHandler },
      { PreflightOrchestrator },
      fakeMoss,
    ] = await Promise.all([
      import("../../apps/web/src/contracts/preflight"),
      import("../../apps/web/src/server/preflight-handler"),
      import("../../apps/web/src/server/preflight-orchestrator"),
      import("../../apps/web/test/api/fake-moss"),
    ]);
    const {
      createFakeMossEnvironment,
      TEST_ACCOUNT,
      TEST_INPUT_ASSET,
      TEST_OUTPUT_ASSET,
      TEST_PROTOCOL,
    } = fakeMoss;
    const runId = RunIdSchema.parse("run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e");
    const environment = createFakeMossEnvironment();
    const handler = createPreflightHandler({
      service: new PreflightOrchestrator({
        fixtureService: {
          run: async () => ({
            status: "UNAVAILABLE" as const,
            code: "LIVE_UNAVAILABLE" as const,
            message: "Fixture sentinel must not run.",
          }),
        },
        resolveLiveSession: () => environment.session,
      }),
      generateRunId: () => runId,
    });
    const response = await handler(
      new Request("http://localhost/api/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractVersion: "0.1",
          mode: "LIVE",
          intent: {
            account: TEST_ACCOUNT,
            inputAsset: TEST_INPUT_ASSET,
            outputAsset: TEST_OUTPUT_ASSET,
            inputAmount: "1000000000000000000",
            maxSlippageBps: 50,
            allowedProtocols: [TEST_PROTOCOL],
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const rawBody = await response.text();
    const parsed = PreflightResponseSchema.parse(JSON.parse(rawBody));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("Expected a successful LIVE preflight response");
    }
    expect(parsed.mode).toBe("LIVE");
    expect(parsed.report.provenance).toBe("LOCAL_FORK");
    expect(parsed.report.decision).toEqual({ status: "MANUAL_REVIEW" });
    expect(parsed.presentation.reportId).toBe(parsed.report.reportId);
    expect(parsed.presentation.decision.status).toBe(
      parsed.report.decision.status,
    );
    expect(environment.events).toEqual(["quote", "action", "simulate"]);
    expect(rawBody).not.toMatch(
      /authorization|cookie|credential|api[_-]?key|password|private[_-]?key|rpc[_-]?url|secret/i,
    );
    expect(rawBody).not.toMatch(/clear402|@clear402\//i);
  });
});
