import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Clear402EnabledPreflightSuccessResponseSchema } from "../../apps/web/src/contracts/clear402";
import { GET as getHealth } from "../../apps/web/app/api/health/route";
import { HealthResponseSchema } from "../../apps/web/src/contracts/health";
import {
  PreflightErrorResponseSchema,
  PreflightResponseSchema,
  RunIdSchema,
} from "../../apps/web/src/contracts/preflight";
import {
  type CredentialService,
  OfflineCredentialService,
} from "../../apps/web/src/server/credential-service";
import {
  createPreflightHandler,
  type PreflightHandlerLogger,
} from "../../apps/web/src/server/preflight-handler";
import { PreflightOrchestrator } from "../../apps/web/src/server/preflight-orchestrator";
import type { PreflightService } from "../../apps/web/src/server/preflight-service";
import { createFakeMossEnvironment } from "../../apps/web/test/api/fake-moss";
import amountMismatchRequest from "../../fixtures/requests/amount-mismatch.json";
import happyRequest from "../../fixtures/requests/happy.json";
import malformedRequest from "../../fixtures/requests/malformed.json";
import programmingErrorRequest from "../../fixtures/requests/programming-error.json";
import rpcFailureRequest from "../../fixtures/requests/rpc-failure.json";
import tokenOutMismatchRequest from "../../fixtures/requests/token-out-mismatch.json";
import warningRequest from "../../fixtures/requests/warning.json";
import amountMismatchReport from "../../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json";
import manualReviewReport from "../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import tokenOutMismatchReport from "../../packages/report-schema/fixtures/token-out-mismatch.v0.1.json";
import { PreflightReportSchema } from "../../packages/report-schema/src/index.js";

vi.mock("../../apps/web/node_modules/server-only", () => ({}));
vi.mock("server-only", () => ({}));

const RUN_ID = RunIdSchema.parse("run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e");
const SENSITIVE_KEY =
  /"(?:authorization|cookie|credential|credentials|api[_-]?key|password|private[_-]?key|rpc[_-]?url|secret)"\s*:/i;
const CLEAR402_RUNTIME = /clear402-profile|@clear402\//i;

type RequestFixture =
  | "amount-mismatch.json"
  | "happy.json"
  | "malformed.json"
  | "programming-error.json"
  | "rpc-failure.json"
  | "token-out-mismatch.json"
  | "warning.json";

const REQUESTS = {
  "amount-mismatch.json": amountMismatchRequest,
  "happy.json": happyRequest,
  "malformed.json": malformedRequest,
  "programming-error.json": programmingErrorRequest,
  "rpc-failure.json": rpcFailureRequest,
  "token-out-mismatch.json": tokenOutMismatchRequest,
  "warning.json": warningRequest,
} as const satisfies Record<RequestFixture, unknown>;

const REPORTS = {
  "amount-in-mismatch": PreflightReportSchema.parse(amountMismatchReport),
  "manual-review-success": PreflightReportSchema.parse(manualReviewReport),
  "token-out-mismatch": PreflightReportSchema.parse(tokenOutMismatchReport),
} as const;

const fixtureService: PreflightService = {
  async run(input) {
    if (input.request.mode === "LIVE") {
      return {
        status: "UNAVAILABLE",
        code: "LIVE_UNAVAILABLE",
        message: "Test Fixture service is unavailable for LIVE requests.",
      };
    }

    return {
      status: "SUCCESS",
      report: structuredClone(REPORTS[input.request.scenario]),
    };
  },
};

const testEnvironment = (
  globalThis as typeof globalThis & {
    process: { env: Record<string, string | undefined> };
  }
).process.env;

function fixtureText(name: RequestFixture): string {
  return `${JSON.stringify(REQUESTS[name], null, 2)}\n`;
}

function requestFrom(name: RequestFixture): Request {
  return new Request("http://localhost/api/preflight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: fixtureText(name),
  });
}

function handlerFor(
  service: PreflightService,
  logger?: PreflightHandlerLogger,
  credentialService?: CredentialService,
) {
  return createPreflightHandler({
    service,
    generateRunId: () => RUN_ID,
    logger,
    credentialService,
  });
}

function fixtureHandler() {
  return handlerFor(fixtureService);
}

function liveHandler(scenario: { simulation?: "FAIL"; warning?: boolean }) {
  const environment = createFakeMossEnvironment(scenario);
  const service = new PreflightOrchestrator({
    fixtureService,
    resolveLiveSession: () => environment.session,
  });
  return { environment, handler: handlerFor(service) };
}

async function successfulBody(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const text = await response.text();
  expect(text).not.toMatch(SENSITIVE_KEY);
  expect(text).not.toMatch(CLEAR402_RUNTIME);
  const body = PreflightResponseSchema.parse(JSON.parse(text));
  expect(body.ok).toBe(true);
  if (!body.ok) throw new Error("Expected a successful response");
  expect(body.presentation.reportId).toBe(body.report.reportId);
  expect(body.presentation.decision.status).toBe(body.report.decision.status);
  return body;
}

async function errorBody(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const text = await response.text();
  expect(text).not.toMatch(SENSITIVE_KEY);
  expect(text).not.toMatch(CLEAR402_RUNTIME);
  const body = PreflightErrorResponseSchema.parse(JSON.parse(text));
  expect(body.error.code).toBe(code);
  expect(body).not.toHaveProperty("report");
  expect(body).not.toHaveProperty("presentation");
  expect(body).not.toHaveProperty("decision");
  return { body, text };
}

for (const clear402Mode of ["ABSENT", "FALSE"] as const) {
  describe(`non-UI gate with CLEAR402_ENABLED ${clear402Mode.toLowerCase()}`, () => {
    let hadPreviousValue: boolean;
    let previousValue: string | undefined;

    beforeEach(() => {
      hadPreviousValue = Object.hasOwn(testEnvironment, "CLEAR402_ENABLED");
      previousValue = testEnvironment.CLEAR402_ENABLED;
      if (clear402Mode === "ABSENT") {
        delete testEnvironment.CLEAR402_ENABLED;
      } else {
        testEnvironment.CLEAR402_ENABLED = "false";
      }
    });

    afterEach(() => {
      if (hadPreviousValue) {
        testEnvironment.CLEAR402_ENABLED = previousValue;
      } else {
        delete testEnvironment.CLEAR402_ENABLED;
      }
    });

    it("returns the strict health contract with Clear402 disabled", async () => {
      const response = await getHealth();
      expect(response.status).toBe(200);
      const body = HealthResponseSchema.parse(await response.json());
      expect(body.status).toBe("ok");
      expect(body.clear402).toEqual({ enabled: false });
      expect(body.network).toEqual({ configured: false, id: null });
    });

    it("maps the happy request to correlated MANUAL_REVIEW", async () => {
      const requestBefore = fixtureText("happy.json");
      const body = await successfulBody(
        await fixtureHandler()(requestFrom("happy.json")),
      );

      expect(body).toMatchObject({
        mode: "FIXTURE",
        scenario: "manual-review-success",
        report: {
          provenance: "FIXTURE",
          decision: { status: "MANUAL_REVIEW" },
        },
      });
      expect(fixtureText("happy.json")).toBe(requestBefore);
    });

    it("maps amount mismatch to explicit STOP", async () => {
      const body = await successfulBody(
        await fixtureHandler()(requestFrom("amount-mismatch.json")),
      );

      expect(body.report.decision.status).toBe("STOP");
      if (body.report.decision.status !== "STOP") {
        throw new Error("Amount mismatch must STOP");
      }
      expect(body.report.decision.reasons).toContainEqual({
        code: "CRITICAL_ALIGNMENT_FAIL",
        sourceReferences: [
          "/capability/raw/amountIn",
          "/intent/inputAmount",
          "/simulation/outcomes/items/0/raw/amountIn",
        ],
      });
    });

    it("maps tokenOut mismatch to explicit STOP", async () => {
      const body = await successfulBody(
        await fixtureHandler()(requestFrom("token-out-mismatch.json")),
      );

      expect(body.report.decision.status).toBe("STOP");
      if (body.report.decision.status !== "STOP") {
        throw new Error("tokenOut mismatch must STOP");
      }
      expect(body.report.decision.reasons).toContainEqual({
        code: "CRITICAL_ALIGNMENT_FAIL",
        sourceReferences: [
          "/intent/outputAsset/address",
          "/simulation/outcomes/items/0/raw/tokenOut/address",
        ],
      });
    });

    it("maps synthetic RPC acquisition failure to failed evidence and STOP", async () => {
      const { environment, handler } = liveHandler({ simulation: "FAIL" });
      const body = await successfulBody(
        await handler(requestFrom("rpc-failure.json")),
      );

      expect(body.mode).toBe("LIVE");
      expect(body.report.provenance).toBe("LOCAL_FORK");
      expect(body.report.simulation.availability).toBe("FAILED");
      expect(body.report.decision.status).toBe("STOP");
      expect(
        body.report.decision.status === "STOP" &&
          body.report.decision.reasons.map(({ code }) => code),
      ).toContain("SIMULATION_ACQUISITION_FAILED");
      expect(environment.events).toEqual(["quote", "action", "simulate"]);
    });

    it("retains a synthetic warning and returns STOP", async () => {
      const { environment, handler } = liveHandler({ warning: true });
      const body = await successfulBody(
        await handler(requestFrom("warning.json")),
      );

      expect(body.mode).toBe("LIVE");
      expect(body.report.provenance).toBe("LOCAL_FORK");
      expect(body.report.simulation.availability).toBe("AVAILABLE");
      expect(
        body.report.simulation.availability === "AVAILABLE" &&
          body.report.simulation.warnings.availability === "AVAILABLE" &&
          body.report.simulation.warnings.items,
      ).toHaveLength(1);
      expect(
        body.report.decision.status === "STOP" &&
          body.report.decision.reasons.map(({ code }) => code),
      ).toContain("WARNING_PRESENT");
      expect(environment.events).toEqual(["quote", "action", "simulate"]);
    });

    it("returns 4xx with no Decision for a malformed request", async () => {
      const { body } = await errorBody(
        await fixtureHandler()(requestFrom("malformed.json")),
        400,
        "INVALID_REQUEST",
      );
      expect(body.ok).toBe(false);
    });

    it("returns redacted 5xx with no fake STOP for a programming error", async () => {
      const logger = { error: vi.fn() } satisfies PreflightHandlerLogger;
      const service: PreflightService = {
        run: () => Promise.reject(new Error("gate-programming-sentinel")),
      };
      const { body, text } = await errorBody(
        await handlerFor(
          service,
          logger,
        )(requestFrom("programming-error.json")),
        500,
        "INTERNAL_ERROR",
      );

      expect(body.ok).toBe(false);
      expect(text).not.toContain("gate-programming-sentinel");
      expect(logger.error).toHaveBeenCalledWith({
        event: "PREFLIGHT_INTERNAL_ERROR",
        runId: RUN_ID,
        code: "INTERNAL_ERROR",
      });
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
        "gate-programming-sentinel",
      );
    });

    it("maps a service deadline to strict 504 with no fake Decision", async () => {
      const service: PreflightService = {
        run: () =>
          Promise.resolve({
            status: "TIMEOUT",
            code: "PREFLIGHT_TIMEOUT",
            message: "integration timeout sentinel",
          }),
      };
      const { body, text } = await errorBody(
        await handlerFor(service)(requestFrom("happy.json")),
        504,
        "PREFLIGHT_TIMEOUT",
      );

      expect(body.runId).toBe(RUN_ID);
      expect(text).toContain(
        "The preflight request exceeded its hard deadline.",
      );
      expect(text).not.toContain("integration timeout sentinel");
    });
  });
}

describe("non-UI gate with CLEAR402_ENABLED true", () => {
  let hadPreviousValue: boolean;
  let previousValue: string | undefined;

  beforeEach(() => {
    hadPreviousValue = Object.hasOwn(testEnvironment, "CLEAR402_ENABLED");
    previousValue = testEnvironment.CLEAR402_ENABLED;
    testEnvironment.CLEAR402_ENABLED = "true";
  });

  afterEach(() => {
    if (hadPreviousValue) {
      testEnvironment.CLEAR402_ENABLED = previousValue;
    } else {
      delete testEnvironment.CLEAR402_ENABLED;
    }
  });

  it("reports the enabled mode without exposing configuration", async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);
    const body = HealthResponseSchema.parse(await response.json());
    expect(body.clear402).toEqual({ enabled: true });
    expect(JSON.stringify(body)).not.toMatch(
      /credential|digest|rpc_url|secret/i,
    );
  });

  it("appends a verifiable credential after the unchanged Fixture report", async () => {
    const baselineResponse = await fixtureHandler()(requestFrom("happy.json"));
    const baseline = await successfulBody(baselineResponse);
    const response = await handlerFor(
      fixtureService,
      undefined,
      new OfflineCredentialService(),
    )(requestFrom("happy.json"));
    const body = Clear402EnabledPreflightSuccessResponseSchema.parse(
      await response.json(),
    );

    expect(response.status).toBe(200);
    expect(body.report).toEqual(baseline.report);
    expect(body.presentation).toEqual(baseline.presentation);
    expect(body.clear402.status).toBe("AVAILABLE");
    if (body.clear402.status !== "AVAILABLE") {
      throw new Error("Expected an available Clear402 credential");
    }
    expect(body.clear402.credential.report).toEqual(body.report);

    const mixedProvenance = {
      ...body,
      clear402: {
        ...body.clear402,
        credential: {
          ...body.clear402.credential,
          report: {
            ...body.clear402.credential.report,
            provenance: "LOCAL_FORK" as const,
          },
        },
      },
    };
    expect(
      Clear402EnabledPreflightSuccessResponseSchema.safeParse(mixedProvenance)
        .success,
    ).toBe(false);
  });

  it("surfaces generation failure without rewriting the original Decision", async () => {
    const logger = { error: vi.fn() } satisfies PreflightHandlerLogger;
    const failingCredentialService: CredentialService = {
      generate: () => {
        throw new Error("integration credential sentinel");
      },
    };
    const response = await handlerFor(
      fixtureService,
      logger,
      failingCredentialService,
    )(requestFrom("amount-mismatch.json"));
    const text = await response.text();
    const body = Clear402EnabledPreflightSuccessResponseSchema.parse(
      JSON.parse(text),
    );

    expect(response.status).toBe(200);
    expect(body.report.decision.status).toBe("STOP");
    expect(body.presentation.decision.status).toBe("STOP");
    expect(body.clear402).toMatchObject({
      status: "ERROR",
      error: { code: "CREDENTIAL_GENERATION_FAILED" },
    });
    expect(text).not.toContain("integration credential sentinel");
  });
});
