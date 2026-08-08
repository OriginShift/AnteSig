import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MossAdapterError,
  type CapabilityConstructionPolicyV0_1,
} from "@moss-mini-demo/moss-adapter";
import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PreflightRequestSchema,
  RunIdSchema,
} from "../../src/contracts/preflight";
import {
  PreflightOrchestrator,
  PREFLIGHT_QUOTE_TIMEOUT_MS,
  PREFLIGHT_TOTAL_TIMEOUT_MS,
  type PreflightLiveSession,
  type ResolveLiveSession,
} from "../../src/server/preflight-orchestrator";
import type {
  PreflightService,
  PreflightServiceInput,
} from "../../src/server/preflight-service";
import {
  createFakeMossEnvironment,
  TEST_ACCOUNT,
  TEST_INPUT_ASSET,
  TEST_OUTPUT_ASSET,
  TEST_PROTOCOL,
} from "./fake-moss";

const RUN_ID = RunIdSchema.parse("run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e");
const LIVE_INPUT = {
  runId: RUN_ID,
  request: PreflightRequestSchema.parse({
    contractVersion: "0.1" as const,
    mode: "LIVE" as const,
    intent: {
      account: TEST_ACCOUNT,
      inputAsset: TEST_INPUT_ASSET,
      outputAsset: TEST_OUTPUT_ASSET,
      inputAmount: "1000000000000000000",
      maxSlippageBps: 50,
      allowedProtocols: [TEST_PROTOCOL],
    },
  }),
} satisfies PreflightServiceInput;

function fixtureService(): PreflightService {
  return {
    run: vi.fn(() =>
      Promise.resolve({
        status: "UNAVAILABLE" as const,
        code: "LIVE_UNAVAILABLE" as const,
        message: "fixture sentinel",
      }),
    ),
  };
}

function orchestrator(
  session: PreflightLiveSession | undefined,
  options: Readonly<{
    totalTimeoutMs?: number;
    quoteTimeoutMs?: number;
    reportReserveMs?: number;
    fixture?: PreflightService;
    resolver?: ResolveLiveSession;
  }> = {},
) {
  const resolver: ResolveLiveSession =
    options.resolver ?? vi.fn<ResolveLiveSession>(() => session);
  const fixture = options.fixture ?? fixtureService();
  return {
    fixture,
    resolver,
    service: new PreflightOrchestrator({
      fixtureService: fixture,
      resolveLiveSession: resolver,
      totalTimeoutMs: options.totalTimeoutMs,
      quoteTimeoutMs: options.quoteTimeoutMs,
      reportReserveMs: options.reportReserveMs,
    }),
  };
}

function expectStop(result: Awaited<ReturnType<PreflightService["run"]>>) {
  expect(result.status).toBe("SUCCESS");
  if (result.status !== "SUCCESS") {
    throw new Error("Expected a legal STOP report");
  }
  expect(PreflightReportSchema.safeParse(result.report).success).toBe(true);
  expect(result.report.decision.status).toBe("STOP");
  return result.report;
}

describe("PreflightOrchestrator", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("freezes the 25 second total and 8 second quote deadlines", () => {
    expect(PREFLIGHT_TOTAL_TIMEOUT_MS).toBe(25_000);
    expect(PREFLIGHT_QUOTE_TIMEOUT_MS).toBe(8_000);
  });

  it("runs public FakeMossPort stages once and in order", async () => {
    const environment = createFakeMossEnvironment();
    const { service, fixture, resolver } = orchestrator(environment.session);

    const result = await service.run(LIVE_INPUT);

    expect(result.status).toBe("SUCCESS");
    if (result.status !== "SUCCESS") {
      throw new Error("Expected successful preflight orchestration");
    }
    expect(PreflightReportSchema.safeParse(result.report).success).toBe(true);
    expect(result.report.network).toBe("eip155:143");
    expect(result.report.provenance).toBe("LOCAL_FORK");
    expect(result.report.decision).toEqual({ status: "MANUAL_REVIEW" });
    expect(result.report.alignment.checks).toHaveLength(18);
    expect(
      result.report.alignment.checks.every((check) => check.status === "PASS"),
    ).toBe(true);
    expect(environment.events).toEqual(["quote", "action", "simulate"]);
    expect(resolver).toHaveBeenCalledOnce();
    expect(fixture.run).not.toHaveBeenCalled();
  });

  it("turns quote acquisition failure into failed evidence and STOP", async () => {
    const environment = createFakeMossEnvironment({ quote: "FAIL" });
    const report = expectStop(
      await orchestrator(environment.session).service.run(LIVE_INPUT),
    );

    expect(report.selection.status).toBe("NOT_SELECTED");
    expect(report.quotes[0]?.status).toBe("FAILED");
    expect(environment.events).toEqual(["quote"]);
    expect(
      report.decision.status === "STOP" &&
        report.decision.reasons.map(({ code }) => code),
    ).toContain("NO_VALID_SELECTION");
  });

  it("turns action acquisition failure into Capability FAILED and STOP", async () => {
    const environment = createFakeMossEnvironment({ action: "FAIL" });
    const report = expectStop(
      await orchestrator(environment.session).service.run(LIVE_INPUT),
    );

    expect(report.capability.availability).toBe("FAILED");
    expect(report.simulation.availability).toBe("MISSING");
    expect(environment.events).toEqual(["quote", "action"]);
    expect(
      report.decision.status === "STOP" &&
        report.decision.reasons.map(({ code }) => code),
    ).toContain("CAPABILITY_FAILED");
  });

  it("turns simulation acquisition failure into Simulation FAILED and STOP", async () => {
    const environment = createFakeMossEnvironment({ simulation: "FAIL" });
    const report = expectStop(
      await orchestrator(environment.session).service.run(LIVE_INPUT),
    );

    expect(report.capability.availability).toBe("AVAILABLE");
    expect(report.simulation.availability).toBe("FAILED");
    expect(environment.events).toEqual(["quote", "action", "simulate"]);
    expect(
      report.decision.status === "STOP" &&
        report.decision.reasons.map(({ code }) => code),
    ).toContain("SIMULATION_ACQUISITION_FAILED");
  });

  it("preserves a Warning as evidence and returns STOP", async () => {
    const environment = createFakeMossEnvironment({ warning: true });
    const report = expectStop(
      await orchestrator(environment.session).service.run(LIVE_INPUT),
    );

    expect(
      report.simulation.availability === "AVAILABLE" &&
        report.simulation.warnings.availability === "AVAILABLE" &&
        report.simulation.warnings.items,
    ).toHaveLength(1);
    expect(
      report.decision.status === "STOP" &&
        report.decision.reasons.map(({ code }) => code),
    ).toContain("WARNING_PRESENT");
  });

  it("aborts a quote stage deadline and never starts late stages", async () => {
    const environment = createFakeMossEnvironment({ quote: "PENDING" });
    const result = await orchestrator(environment.session, {
      totalTimeoutMs: 200,
      quoteTimeoutMs: 20,
      reportReserveMs: 20,
    }).service.run(LIVE_INPUT);
    const report = expectStop(result);

    expect(environment.pending.quoteAborted()).toBe(true);
    expect(environment.quoteSignals).toHaveLength(1);
    expect(environment.quoteSignals[0]?.aborted).toBe(true);
    expect(environment.events).toEqual(["quote"]);
    expect(report.selection.status).toBe("NOT_SELECTED");
  });

  it("returns the hard timeout when the quote consumes the total deadline", async () => {
    const environment = createFakeMossEnvironment({ quote: "PENDING" });
    const result = await orchestrator(environment.session, {
      totalTimeoutMs: 20,
      quoteTimeoutMs: 100,
      reportReserveMs: 0,
    }).service.run(LIVE_INPUT);

    expect(result).toMatchObject({
      status: "TIMEOUT",
      code: "PREFLIGHT_TIMEOUT",
    });
    expect(environment.pending.quoteAborted()).toBe(true);
    expect(environment.events).toEqual(["quote"]);
  });

  it("starts the hard deadline before resolving the LIVE session", async () => {
    const environment = createFakeMossEnvironment();
    let now = 1_000;
    const clock = {
      now: () => now,
      setTimeout: (callback: () => void, delay: number) =>
        setTimeout(callback, delay),
      clearTimeout: (timer: ReturnType<typeof setTimeout>) =>
        clearTimeout(timer),
    };
    const service = new PreflightOrchestrator({
      fixtureService: fixtureService(),
      resolveLiveSession: () => {
        now += 25;
        return environment.session;
      },
      totalTimeoutMs: 25,
      quoteTimeoutMs: 20,
      reportReserveMs: 0,
      clock,
    });

    await expect(service.run(LIVE_INPUT)).resolves.toMatchObject({
      status: "TIMEOUT",
      code: "PREFLIGHT_TIMEOUT",
    });
    expect(environment.events).toEqual([]);
  });

  it("ignores a late action result and never starts simulation", async () => {
    const environment = createFakeMossEnvironment({
      action: "DELAYED",
      delayedStageMs: 60,
    });
    const report = expectStop(
      await orchestrator(environment.session, {
        totalTimeoutMs: 80,
        quoteTimeoutMs: 20,
        reportReserveMs: 50,
      }).service.run(LIVE_INPUT),
    );
    const frozenResult = structuredClone(report);

    expect(report.capability.availability).toBe("FAILED");
    expect(environment.events).toEqual(["quote", "action"]);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(environment.events).toEqual(["quote", "action"]);
    expect(report).toEqual(frozenResult);
  });

  it("ignores a late simulation result after returning STOP", async () => {
    const environment = createFakeMossEnvironment({
      simulation: "DELAYED",
      delayedStageMs: 60,
    });
    const report = expectStop(
      await orchestrator(environment.session, {
        totalTimeoutMs: 80,
        quoteTimeoutMs: 20,
        reportReserveMs: 50,
      }).service.run(LIVE_INPUT),
    );
    const frozenResult = structuredClone(report);

    expect(report.simulation.availability).toBe("FAILED");
    expect(environment.events).toEqual(["quote", "action", "simulate"]);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(environment.events).toEqual(["quote", "action", "simulate"]);
    expect(report).toEqual(frozenResult);
  });

  it("delegates only explicit FIXTURE and never resolves a LIVE session", async () => {
    const fixture = fixtureService();
    const resolver = vi.fn(() => undefined);
    const { service } = orchestrator(undefined, { fixture, resolver });
    const result = await service.run({
      runId: RUN_ID,
      request: {
        contractVersion: "0.1",
        mode: "FIXTURE",
        scenario: "manual-review-success",
      },
    });

    expect(result.status).toBe("UNAVAILABLE");
    expect(fixture.run).toHaveBeenCalledOnce();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("returns LIVE_UNAVAILABLE without touching Fixture when no session exists", async () => {
    const { service, fixture, resolver } = orchestrator(undefined);
    const result = await service.run(LIVE_INPUT);

    expect(result).toMatchObject({
      status: "UNAVAILABLE",
      code: "LIVE_UNAVAILABLE",
    });
    expect(resolver).toHaveBeenCalledOnce();
    expect(fixture.run).not.toHaveBeenCalled();
  });

  it("does not convert adapter invariant failures into STOP", async () => {
    const environment = createFakeMossEnvironment();
    const invalidSession: PreflightLiveSession = {
      ...environment.session,
      createCapabilityPolicy: ({ selection, request }) =>
        ({
          ...environment.session.createCapabilityPolicy({ selection, request }),
          catalogDigest: `sha256:${"0".repeat(64)}`,
        }) as CapabilityConstructionPolicyV0_1,
    };

    await expect(
      orchestrator(invalidSession).service.run(LIVE_INPUT),
    ).rejects.toBeInstanceOf(MossAdapterError);
    expect(environment.events).toEqual(["quote"]);
  });

  it("contains no Clear402 import in the orchestration boundary", () => {
    for (const path of [
      "apps/web/src/server/preflight-orchestrator.ts",
      "apps/web/src/server/preflight-projection.ts",
      "apps/web/app/api/preflight/route.ts",
    ]) {
      expect(readFileSync(resolve(process.cwd(), path), "utf8")).not.toMatch(
        /clear402-profile|@clear402\//i,
      );
    }
  });
});
