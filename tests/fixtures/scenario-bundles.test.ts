import {
  CLEAR402_ASSURANCE_KIND_V0_1,
  CLEAR402_ASSURANCE_STATEMENT_V0_1,
  CLEAR402_CREDENTIAL_TYPE_V0_1,
  CLEAR402_CREDENTIAL_VERSION_V0_1,
  CLEAR402_PROFILE_V0_1,
  Clear402MonadActionCredentialV0_1Schema,
  digestClear402ReportV0_1,
  verifyClear402CredentialV0_1,
} from "../../packages/clear402-profile/src/index.js";
import { evaluateDecisionV0_1 } from "../../packages/decision-engine/src/index.js";
import {
  createFakeMossPort,
  MOSS_BUILD_INFO,
  type MossRpcRequestV0_1,
  type MossSourceBindings,
  type RawCapability,
} from "../../packages/moss-adapter/src/index.js";
import {
  IntentSchema,
  type PreflightReport,
  PreflightReportSchema,
} from "../../packages/report-schema/src/index.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("../../packages/moss-adapter/node_modules/server-only", () => ({}));

const SCENARIOS = [
  "happy-path",
  "amount-mismatch",
  "rpc-failure",
  "receipt-warning",
] as const;
type Scenario = (typeof SCENARIOS)[number];

const FIXTURE_TEXTS = (
  import.meta as unknown as {
    glob(
      pattern: string[],
      options: { eager: true; query: "?raw"; import: "default" },
    ): Record<string, string>;
  }
).glob(
  [
    "../../fixtures/happy-path/*",
    "../../fixtures/amount-mismatch/*",
    "../../fixtures/rpc-failure/*",
    "../../fixtures/receipt-warning/*",
  ],
  { query: "?raw", import: "default", eager: true },
);

const FixtureRequestSchema = z.strictObject({
  bundleVersion: z.literal("0.1"),
  sourceBoundary: z.literal("FIXTURE"),
  scenario: z.enum(SCENARIOS),
  intent: IntentSchema,
});

const RawBundleSchema = z.strictObject({
  fixtureVersion: z.literal("0.1"),
  sourceBoundary: z.literal("FIXTURE"),
  scenario: z.enum(SCENARIOS),
  operation: z.strictObject({
    protocol: z.string().min(1),
    method: z.literal("swap"),
  }),
  capability: z.record(z.string(), z.unknown()),
  simulation: z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("AVAILABLE"),
      result: z
        .json()
        .refine(
          (value) =>
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            Array.isArray(value.results) &&
            value.results.length > 0,
          "Raw simulation must contain at least one result",
        ),
    }),
    z.strictObject({
      status: z.literal("FAILED"),
      error: z.strictObject({
        code: z.literal("SIMULATION_ACQUISITION_FAILED"),
        message: z.string().min(1),
      }),
    }),
  ]),
});

const CredentialInvariantsSchema = z.strictObject({
  credentialVersion: z.literal(CLEAR402_CREDENTIAL_VERSION_V0_1),
  credentialType: z.literal(CLEAR402_CREDENTIAL_TYPE_V0_1),
  profile: z.literal(CLEAR402_PROFILE_V0_1),
  protectedObject: z.literal("report"),
  canonicalization: z.literal("RFC8785"),
  digestAlgorithm: z.literal("sha256"),
  reportDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  assuranceKind: z.literal(CLEAR402_ASSURANCE_KIND_V0_1),
  assuranceStatement: z.literal(CLEAR402_ASSURANCE_STATEMENT_V0_1),
});

type LoadedBundle = Awaited<ReturnType<typeof loadBundle>>;

function readText(scenario: Scenario, filename: string): string {
  const path = `../../fixtures/${scenario}/${filename}`;
  const text = FIXTURE_TEXTS[path];
  if (text === undefined) {
    throw new Error(`Missing fixture artifact: ${path}`);
  }
  return text;
}

function readJson(scenario: Scenario, filename: string): unknown {
  return JSON.parse(readText(scenario, filename));
}

async function loadBundle(scenario: Scenario) {
  const request = FixtureRequestSchema.parse(
    readJson(scenario, "request.json"),
  );
  const raw = RawBundleSchema.parse(readJson(scenario, "raw-moss-result.json"));
  const report = PreflightReportSchema.parse(
    readJson(scenario, "expected-report.json"),
  );
  const decision = readJson(scenario, "expected-decision.json");
  const credential = CredentialInvariantsSchema.parse(
    readJson(scenario, "expected-credential-invariants.json"),
  );
  const readme = readText(scenario, "README.md");
  return { credential, decision, raw, readme, report, request };
}

function decisionInput(report: PreflightReport) {
  const { decision: _decision, limitations: _limitations, ...input } = report;
  return input;
}

function operation(raw: LoadedBundle["raw"]) {
  const riskLabels = ["SYNTHETIC_FIXTURE"];
  return {
    protocolId: raw.operation.protocol,
    method: raw.operation.method,
    operationKind: "CAPABILITY" as const,
    stub: {
      protocol: raw.operation.protocol,
      method: raw.operation.method,
      kind: "capability",
      risk: riskLabels,
    },
    riskLabels,
  };
}

function syntheticRpcResponse(request: MossRpcRequestV0_1): unknown {
  if (request.method === "eth_blockNumber") return "0x1234";
  if (request.method === "eth_getBlockByNumber") {
    return { hash: `0x${"12".repeat(32)}` };
  }
  if (request.method === "debug_traceCall") return { type: "CALL" };
  if (request.method === "eth_estimateGas") return "0x5208";
  throw new Error("Unexpected synthetic RPC method");
}

async function mapAvailableRaw(raw: LoadedBundle["raw"]) {
  const simulation = raw.simulation;
  if (simulation.status !== "AVAILABLE") {
    throw new Error("Expected available raw simulation");
  }
  const loadedOperation = operation(raw);
  const bindings = {
    chainId: 143,
    simulationRpcClient: {
      request: async (request: MossRpcRequestV0_1) =>
        syntheticRpcResponse(request),
    },
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => loadedOperation,
    quote: async () => ({
      operation: loadedOperation,
      quote: { synthetic: true },
    }),
    action: async () => ({
      operation: loadedOperation,
      capability: raw.capability as RawCapability,
    }),
    simulate: async (
      _capability: RawCapability,
      client: Parameters<MossSourceBindings["simulate"]>[1],
    ) => {
      const block = await client.request({ method: "eth_blockNumber" });
      await client.request({
        method: "debug_traceCall",
        params: [{}, block, { tracer: "callTracer" }],
      });
      await client.request({
        method: "eth_estimateGas",
        params: [{}, block],
      });
      return {
        protocolId: raw.operation.protocol,
        method: raw.operation.method,
        simulation: simulation.result,
      };
    },
  } satisfies MossSourceBindings;
  return createFakeMossPort(bindings).simulate(raw.capability as RawCapability);
}

function credentialFor(report: PreflightReport) {
  return Clear402MonadActionCredentialV0_1Schema.parse({
    credentialVersion: CLEAR402_CREDENTIAL_VERSION_V0_1,
    credentialType: CLEAR402_CREDENTIAL_TYPE_V0_1,
    profile: CLEAR402_PROFILE_V0_1,
    report,
    integrity: {
      canonicalization: "RFC8785",
      digestAlgorithm: "sha256",
      reportDigest: digestClear402ReportV0_1(report),
    },
    assurance: {
      kind: CLEAR402_ASSURANCE_KIND_V0_1,
      statement: CLEAR402_ASSURANCE_STATEMENT_V0_1,
    },
  });
}

describe("M5 deterministic scenario bundles", () => {
  it.each(SCENARIOS)(
    "validates complete FIXTURE boundary for %s",
    async (scenario) => {
      const bundle = await loadBundle(scenario);
      const serialized = JSON.stringify(bundle);

      expect(bundle.request.scenario).toBe(scenario);
      expect(bundle.raw.scenario).toBe(scenario);
      expect(bundle.request.intent).toEqual(bundle.report.intent);
      expect(bundle.report.provenance).toBe("FIXTURE");
      expect(bundle.decision).toEqual(bundle.report.decision);
      expect(bundle.readme).toContain("Offline synthetic reliability bundle");
      expect(serialized).not.toContain("LIVE_SOURCE");
    },
  );

  it.each(["happy-path", "amount-mismatch", "receipt-warning"] as const)(
    "maps %s raw simulation through the Moss Adapter contract",
    async (scenario) => {
      const bundle = await loadBundle(scenario);
      const evidence = await mapAvailableRaw(bundle.raw);

      expect(evidence.mossOriginal.simulation).toEqual(
        bundle.raw.simulation.status === "AVAILABLE"
          ? bundle.raw.simulation.result
          : undefined,
      );
      expect(evidence.mossOriginal.receipts).toHaveLength(1);
      expect(evidence.mossOriginal.outcomes).toHaveLength(1);
      if (bundle.report.simulation.availability !== "AVAILABLE") {
        throw new Error("Expected available report simulation");
      }
      if (bundle.report.simulation.outcomes.availability !== "AVAILABLE") {
        throw new Error("Expected available report outcomes");
      }
      expect(evidence.mossOriginal.outcomes[0]?.value).toMatchObject({
        status: bundle.report.simulation.outcomes.items[0]?.status,
      });
      const expectedWarnings =
        bundle.report.simulation.warnings.availability === "AVAILABLE"
          ? bundle.report.simulation.warnings.items
          : [];
      expect(evidence.mossOriginal.warnings.map(({ value }) => value)).toEqual(
        expectedWarnings,
      );
      if (scenario === "amount-mismatch") {
        expect(bundle.raw.capability).toMatchObject({
          params: { amountIn: "10000000000000000000" },
        });
        expect(evidence.mossOriginal.outcomes[0]?.value).toMatchObject({
          amountIn: "10000000000000000000",
        });
        expect(bundle.report.simulation.outcomes.items[0]?.raw).toMatchObject({
          amountIn: "10000000000000000000",
        });
      }
    },
  );

  it("represents RPC acquisition failure without inventing a raw result", async () => {
    const bundle = await loadBundle("rpc-failure");
    expect(bundle.raw.simulation).toMatchObject({
      status: "FAILED",
      error: { code: "SIMULATION_ACQUISITION_FAILED" },
    });
    expect(bundle.report.simulation).toMatchObject({
      availability: "FAILED",
      failure: { code: "SIMULATION_ACQUISITION_FAILED" },
    });
  });

  it.each(SCENARIOS)("recomputes exact Decision for %s", async (scenario) => {
    const bundle = await loadBundle(scenario);
    expect(evaluateDecisionV0_1(decisionInput(bundle.report))).toEqual(
      bundle.report.decision,
    );
  });

  it("pins the four expected scenario outcomes", async () => {
    expect((await loadBundle("happy-path")).report.decision).toEqual({
      status: "MANUAL_REVIEW",
    });
    expect((await loadBundle("amount-mismatch")).report.decision).toMatchObject(
      {
        status: "STOP",
        reasons: [{ code: "CRITICAL_ALIGNMENT_FAIL" }],
      },
    );
    expect((await loadBundle("rpc-failure")).report.decision).toMatchObject({
      status: "STOP",
      reasons: [{ code: "SIMULATION_ACQUISITION_FAILED" }],
    });
    expect((await loadBundle("receipt-warning")).report.decision).toMatchObject(
      {
        status: "STOP",
        reasons: [{ code: "WARNING_PRESENT" }],
      },
    );
  });

  it.each(SCENARIOS)(
    "recomputes a valid unsigned Credential for %s",
    async (scenario) => {
      const bundle = await loadBundle(scenario);
      const credential = credentialFor(bundle.report);
      expect(verifyClear402CredentialV0_1(credential)).toMatchObject({
        valid: true,
        integrity: "VALID",
      });
      expect(bundle.credential).toEqual({
        credentialVersion: credential.credentialVersion,
        credentialType: credential.credentialType,
        profile: credential.profile,
        protectedObject: "report",
        canonicalization: credential.integrity.canonicalization,
        digestAlgorithm: credential.integrity.digestAlgorithm,
        reportDigest: credential.integrity.reportDigest,
        assuranceKind: credential.assurance.kind,
        assuranceStatement: credential.assurance.statement,
      });
    },
  );
});
