import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyClear402CredentialV0_1 } from "@moss-mini-demo/clear402-profile";
import {
  PreflightReportSchema,
  type PreflightReport,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import { GET as getHealth } from "../app/api/health/route";
import { POST as postPreflight } from "../app/api/preflight/route";
import { HealthResponseSchema } from "../src/contracts/health";
import { Clear402EnabledPreflightSuccessResponseSchema } from "../src/contracts/clear402";
import {
  MAX_PREFLIGHT_REQUEST_BYTES,
  MAX_PREFLIGHT_RESPONSE_BYTES,
  PreflightErrorResponseSchema,
  PreflightResponseSchema,
  RunIdSchema,
} from "../src/contracts/preflight";
import { FakePreflightService } from "../src/server/fake-preflight-service";
import {
  type CredentialService,
  OfflineCredentialService,
} from "../src/server/credential-service";
import { createPreflightHandler } from "../src/server/preflight-handler";
import type { PreflightService } from "../src/server/preflight-service";

vi.mock("server-only", () => ({}));

const RUN_ID = RunIdSchema.parse("run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e");

function readManualReviewFixture(): PreflightReport {
  return PreflightReportSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "packages/report-schema/fixtures/manual-review-success.v0.1.json",
        ),
        "utf8",
      ),
    ),
  );
}

function jsonRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/preflight", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

function createFakeHandler(
  generateRunId = vi.fn(() => RUN_ID),
  credentialService?: CredentialService,
) {
  return {
    generateRunId,
    handler: createPreflightHandler({
      service: new FakePreflightService(),
      generateRunId,
      credentialService,
    }),
  };
}

async function expectError(
  response: Response,
  status: number,
  code: string,
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toBe(
    "application/json; charset=utf-8",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(PreflightErrorResponseSchema.safeParse(body).success).toBe(true);
  expect(body).toMatchObject({
    contractVersion: "0.1",
    ok: false,
    runId: RUN_ID,
    error: { code },
  });
  expect(body).not.toHaveProperty("report");
  return body as Record<string, unknown>;
}

describe("GET /api/health", () => {
  it("returns the exact non-sensitive health contract", async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = await response.json();
    expect(HealthResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      contractVersion: "0.1",
      status: "ok",
      app: {
        name: "antesig",
        version: "0.0.0",
        runtime: "nodejs",
        nodeVersion: "22.23.1",
      },
      moss: {
        sourceMode: "INTEGRATION_FORK",
        upstreamCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
        integrationCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
        officialRelease: false,
        packages: {
          "@themoss/core": "0.1.0",
          "@themoss/simulator": "0.1.0",
          "@themoss/protocol-kuru": "0.1.0",
          "@themoss/protocol-pancakeswap": "0.1.0",
        },
      },
      network: { configured: false, id: null },
      clear402: { enabled: false },
    });
    expect(JSON.stringify(body)).not.toMatch(
      /rpc_url|private_key|credential|hostname|filesystem|secret/i,
    );
  });
});

describe("POST /api/preflight", () => {
  it("returns a validated FIXTURE report with one server runId", async () => {
    const generateRunId = vi.fn(() => RUN_ID);
    const { handler } = createFakeHandler(generateRunId);
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario: "manual-review-success",
        }),
        { "content-type": "application/json; charset=utf-8" },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(PreflightResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      contractVersion: "0.1",
      ok: true,
      runId: RUN_ID,
      mode: "FIXTURE",
      scenario: "manual-review-success",
      report: { provenance: "FIXTURE" },
      presentation: {
        schemaVersion: "0.1",
        decision: { status: "MANUAL_REVIEW" },
      },
    });
    expect(body.presentation.reportId).toBe(body.report.reportId);
    expect(body).not.toHaveProperty("clear402");
    expect(generateRunId).toHaveBeenCalledTimes(1);
  });

  it("adds a valid credential only after a valid report when enabled", async () => {
    const service = new OfflineCredentialService();
    const generate = vi.spyOn(service, "generate");
    const { handler } = createFakeHandler(
      vi.fn(() => RUN_ID),
      service,
    );
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario: "manual-review-success",
        }),
      ),
    );
    const body = Clear402EnabledPreflightSuccessResponseSchema.parse(
      await response.json(),
    );

    expect(response.status).toBe(200);
    expect(body.clear402.status).toBe("AVAILABLE");
    if (body.clear402.status !== "AVAILABLE") {
      throw new Error("Expected generated Clear402 credential");
    }
    expect(
      verifyClear402CredentialV0_1(body.clear402.credential),
    ).toMatchObject({ valid: true, integrity: "VALID" });
    expect(body.clear402.credential.report).toEqual(body.report);
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(body.report);
  });

  it("keeps the original report Decision when credential generation fails", async () => {
    const logger = { error: vi.fn() };
    const credentialService: CredentialService = {
      generate: () => {
        throw new Error("private generation detail");
      },
    };
    const handler = createPreflightHandler({
      service: new FakePreflightService(),
      generateRunId: () => RUN_ID,
      credentialService,
      logger,
    });
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario: "amount-in-mismatch",
        }),
      ),
    );
    const text = await response.text();
    const body = Clear402EnabledPreflightSuccessResponseSchema.parse(
      JSON.parse(text),
    );

    expect(response.status).toBe(200);
    expect(body.report.decision.status).toBe("STOP");
    expect(body.presentation.decision.status).toBe("STOP");
    expect(body.clear402).toEqual({
      status: "ERROR",
      error: {
        code: "CREDENTIAL_GENERATION_FAILED",
        message: "The Clear402 credential could not be generated.",
      },
    });
    expect(text).not.toContain("private generation detail");
    expect(logger.error).toHaveBeenCalledWith({
      event: "CLEAR402_GENERATION_ERROR",
      runId: RUN_ID,
      code: "CREDENTIAL_GENERATION_FAILED",
    });
  });

  it("returns LIVE_UNAVAILABLE and never falls back to Fixture", async () => {
    const fixture = readManualReviewFixture();
    const { handler, generateRunId } = createFakeHandler();
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "LIVE",
          intent: fixture.intent,
        }),
      ),
    );
    await expectError(response, 503, "LIVE_UNAVAILABLE");
    expect(generateRunId).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported media types before reading", async () => {
    const { handler } = createFakeHandler();
    const request = new Request("http://localhost/api/preflight", {
      method: "POST",
      body: "{}",
    });
    await expectError(await handler(request), 415, "UNSUPPORTED_MEDIA_TYPE");
  });

  it.each(["", "{"])("rejects invalid JSON %#", async (body) => {
    const { handler } = createFakeHandler();
    await expectError(await handler(jsonRequest(body)), 400, "INVALID_JSON");
  });

  it("rejects strict-schema violations without echoing input", async () => {
    const secretMarker = "do-not-echo-this-sensitive-value";
    const { handler } = createFakeHandler();
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario: "manual-review-success",
          credential: secretMarker,
        }),
      ),
    );
    const body = await expectError(response, 400, "INVALID_REQUEST");
    expect(JSON.stringify(body)).not.toContain(secretMarker);
  });

  it("rejects declared request overflow before reading", async () => {
    const { handler } = createFakeHandler();
    await expectError(
      await handler(
        jsonRequest("{}", {
          "content-length": String(MAX_PREFLIGHT_REQUEST_BYTES + 1),
        }),
      ),
      413,
      "REQUEST_TOO_LARGE",
    );
  });

  it("rejects observed overflow despite a false-small length", async () => {
    const { handler } = createFakeHandler();
    const oversized = JSON.stringify({
      padding: "x".repeat(MAX_PREFLIGHT_REQUEST_BYTES),
    });
    await expectError(
      await handler(jsonRequest(oversized, { "content-length": "1" })),
      413,
      "REQUEST_TOO_LARGE",
    );
  });

  it("accepts exactly 65,536 bytes for parsing instead of returning 413", async () => {
    const { handler } = createFakeHandler();
    const exactBoundary = `${" ".repeat(MAX_PREFLIGHT_REQUEST_BYTES - 2)}{}`;
    expect(new TextEncoder().encode(exactBoundary)).toHaveLength(
      MAX_PREFLIGHT_REQUEST_BYTES,
    );
    await expectError(
      await handler(
        jsonRequest(exactBoundary, {
          "content-length": String(MAX_PREFLIGHT_REQUEST_BYTES),
        }),
      ),
      400,
      "INVALID_REQUEST",
    );
  });

  it("replaces an oversized valid service response with a small error", async () => {
    const report = structuredClone(readManualReviewFixture());
    if (report.capability.availability !== "AVAILABLE") {
      throw new Error("test Fixture must provide Capability evidence");
    }
    report.capability.raw = {
      synthetic: "x".repeat(MAX_PREFLIGHT_RESPONSE_BYTES),
    };
    const service: PreflightService = {
      run: () => Promise.resolve({ status: "SUCCESS", report }),
    };
    const handler = createPreflightHandler({
      service,
      generateRunId: () => RUN_ID,
    });
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario: "manual-review-success",
        }),
      ),
    );
    const body = await expectError(response, 500, "RESPONSE_TOO_LARGE");
    expect(
      new TextEncoder().encode(JSON.stringify(body)).byteLength,
    ).toBeLessThan(MAX_PREFLIGHT_RESPONSE_BYTES);
  });

  it("redacts unexpected service failures", async () => {
    const logger = { error: vi.fn() };
    const service: PreflightService = {
      run: () => Promise.reject(new Error("private stack and environment")),
    };
    const handler = createPreflightHandler({
      service,
      generateRunId: () => RUN_ID,
      logger,
    });
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario: "manual-review-success",
        }),
      ),
    );
    const body = await expectError(response, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/private|stack|environment/i);
    expect(logger.error).toHaveBeenCalledWith({
      event: "PREFLIGHT_INTERNAL_ERROR",
      runId: RUN_ID,
      code: "INTERNAL_ERROR",
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(
      /private|stack|environment/i,
    );
  });

  it("returns a structured 504 with no Decision on hard timeout", async () => {
    const service: PreflightService = {
      run: () =>
        Promise.resolve({
          status: "TIMEOUT",
          code: "PREFLIGHT_TIMEOUT",
          message: "untrusted timeout detail",
        }),
    };
    const handler = createPreflightHandler({
      service,
      generateRunId: () => RUN_ID,
    });
    const fixture = readManualReviewFixture();
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "LIVE",
          intent: fixture.intent,
        }),
      ),
    );
    const body = await expectError(response, 504, "PREFLIGHT_TIMEOUT");
    expect(body).not.toHaveProperty("decision");
    expect(JSON.stringify(body)).not.toContain("untrusted timeout detail");
  });

  it("rejects credential-shaped raw evidence instead of returning it", async () => {
    const report = structuredClone(readManualReviewFixture());
    if (report.capability.availability !== "AVAILABLE") {
      throw new Error("test Fixture must provide Capability evidence");
    }
    report.capability.raw = {
      original: report.capability.raw,
      privateKey: "do-not-return-this",
    };
    const logger = { error: vi.fn() };
    const handler = createPreflightHandler({
      service: { run: () => Promise.resolve({ status: "SUCCESS", report }) },
      generateRunId: () => RUN_ID,
      logger,
    });
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "FIXTURE",
          scenario: "manual-review-success",
        }),
      ),
    );
    const body = await expectError(response, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("do-not-return-this");
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      "do-not-return-this",
    );
  });

  it("ignores an unavailable service's untrusted message", async () => {
    const fixture = readManualReviewFixture();
    const service: PreflightService = {
      run: () =>
        Promise.resolve({
          status: "UNAVAILABLE",
          code: "LIVE_UNAVAILABLE",
          message: "secret backend detail",
        }),
    };
    const handler = createPreflightHandler({
      service,
      generateRunId: () => RUN_ID,
    });
    const response = await handler(
      jsonRequest(
        JSON.stringify({
          contractVersion: "0.1",
          mode: "LIVE",
          intent: fixture.intent,
        }),
      ),
    );
    const body = await expectError(response, 503, "LIVE_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("secret backend detail");
  });

  it("composes the production route with a valid generated runId", async () => {
    const previous = process.env.CLEAR402_ENABLED;
    try {
      process.env.CLEAR402_ENABLED = "false";
      const response = await postPreflight(
        jsonRequest(
          JSON.stringify({
            contractVersion: "0.1",
            mode: "FIXTURE",
            scenario: "manual-review-success",
          }),
        ),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(RunIdSchema.safeParse(body.runId).success).toBe(true);
      expect(PreflightResponseSchema.safeParse(body).success).toBe(true);
      expect(body).not.toHaveProperty("clear402");
    } finally {
      if (previous === undefined) {
        delete process.env.CLEAR402_ENABLED;
      } else {
        process.env.CLEAR402_ENABLED = previous;
      }
    }
  });

  it("composes the production route with Clear402 when exactly enabled", async () => {
    const previous = process.env.CLEAR402_ENABLED;
    try {
      process.env.CLEAR402_ENABLED = "true";
      const response = await postPreflight(
        jsonRequest(
          JSON.stringify({
            contractVersion: "0.1",
            mode: "FIXTURE",
            scenario: "manual-review-success",
          }),
        ),
      );
      const body = Clear402EnabledPreflightSuccessResponseSchema.parse(
        await response.json(),
      );
      expect(response.status).toBe(200);
      expect(RunIdSchema.safeParse(body.runId).success).toBe(true);
      expect(body.clear402.status).toBe("AVAILABLE");
    } finally {
      if (previous === undefined) {
        delete process.env.CLEAR402_ENABLED;
      } else {
        process.env.CLEAR402_ENABLED = previous;
      }
    }
  });
});
