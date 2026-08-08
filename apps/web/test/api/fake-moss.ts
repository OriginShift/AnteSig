import {
  createFakeMossPort,
  MOSS_BUILD_INFO,
  type MossRpcRequestV0_1,
  type MossSourceBindings,
  type QuoteRequestOptionsV0_1,
  type RawCapability,
} from "@moss-mini-demo/moss-adapter";
import {
  AssetSchema,
  EvmAddressSchema,
  ProtocolIdSchema,
} from "@moss-mini-demo/report-schema";
import type { PreflightLiveSession } from "../../src/server/preflight-orchestrator";

export const TEST_ACCOUNT = EvmAddressSchema.parse(
  "0x1111111111111111111111111111111111111111",
);
export const TEST_TOKEN = EvmAddressSchema.parse(
  "0x2222222222222222222222222222222222222222",
);
export const TEST_TARGET = EvmAddressSchema.parse(
  "0x4444444444444444444444444444444444444444",
);
export const TEST_PROTOCOL = ProtocolIdSchema.parse("synthetic-protocol");
export const TEST_INPUT_ASSET = AssetSchema.parse({ kind: "NATIVE" });
export const TEST_OUTPUT_ASSET = AssetSchema.parse({
  kind: "ERC20",
  address: TEST_TOKEN,
});

const BLOCK = "0x1234";
const BLOCK_HASH = `0x${"12".repeat(32)}`;

export type FakeMossScenario = Readonly<{
  quote?: "SUCCESS" | "FAIL" | "PENDING";
  action?: "SUCCESS" | "FAIL" | "PENDING" | "DELAYED";
  simulation?: "SUCCESS" | "FAIL" | "PENDING" | "DELAYED";
  delayedStageMs?: number;
  warning?: boolean;
}>;

export type FakeMossEnvironment = Readonly<{
  session: PreflightLiveSession;
  events: string[];
  quoteSignals: AbortSignal[];
  pending: Readonly<{
    quoteAborted(): boolean;
  }>;
}>;

function operation() {
  const riskLabels = ["SYNTHETIC_PREFLIGHT"];
  return {
    protocolId: TEST_PROTOCOL,
    method: "swap",
    operationKind: "CAPABILITY" as const,
    stub: {
      protocol: TEST_PROTOCOL,
      method: "swap",
      kind: "capability",
      risk: riskLabels,
    },
    riskLabels,
  };
}

function capability(): RawCapability {
  return {
    kind: "capability",
    protocol: TEST_PROTOCOL,
    method: "swap",
    params: { amountIn: "1", inputAsset: TEST_INPUT_ASSET },
    children: [
      {
        kind: "transaction",
        transaction: {
          from: TEST_ACCOUNT,
          to: TEST_TARGET,
          data: "0x1234",
          value: "0x0",
        },
      },
    ],
  };
}

function successfulSimulation(warning: boolean) {
  const warnings = warning
    ? [
        {
          code: "TRACE_FAILED",
          message: "Synthetic warning",
          detail: "offline-test-only",
        },
      ]
    : [];
  const receipt = {
    kind: "receipt",
    protocol: TEST_PROTOCOL,
    outcome: { status: "SUCCESS", amountOut: "42000000" },
    text: "Synthetic swap receipt",
    changes: [],
  };
  return {
    results: [
      {
        protocol: TEST_PROTOCOL,
        method: "swap",
        transaction: {
          from: TEST_ACCOUNT,
          to: TEST_TARGET,
          data: "0x1234",
          value: "0x0",
        },
        reverted: false,
        receipt,
        changes: [],
        warnings,
        gas: "21000",
      },
    ],
  };
}

function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createFakeMossEnvironment(
  scenario: FakeMossScenario = {},
): FakeMossEnvironment {
  const events: string[] = [];
  const quoteSignals: AbortSignal[] = [];
  let quoteAborted = false;
  const loaded = operation();
  const rawCapability = capability();
  const bindings = {
    chainId: 143,
    simulationRpcClient: {
      async request(request: MossRpcRequestV0_1): Promise<unknown> {
        if (request.method === "eth_blockNumber") {
          return BLOCK;
        }
        if (request.method === "eth_getBlockByNumber") {
          return { hash: BLOCK_HASH };
        }
        if (request.method === "debug_traceCall") {
          return { type: "CALL", from: TEST_ACCOUNT, to: TEST_TARGET };
        }
        if (request.method === "eth_estimateGas") {
          return "0x5208";
        }
        throw new Error("Unexpected synthetic RPC request");
      },
    },
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => loaded,
    quote: async (
      _protocolId: string,
      _input: Parameters<MossSourceBindings["quote"]>[1],
      options?: QuoteRequestOptionsV0_1,
    ) => {
      events.push("quote");
      if (options?.signal !== undefined) {
        quoteSignals.push(options.signal);
        options.signal.addEventListener(
          "abort",
          () => {
            quoteAborted = true;
          },
          { once: true },
        );
      }
      if (scenario.quote === "PENDING") {
        return never<Awaited<ReturnType<MossSourceBindings["quote"]>>>();
      }
      if (scenario.quote === "FAIL") {
        throw new Error("synthetic quote acquisition failure");
      }
      return {
        operation: loaded,
        quote: {
          chainId: 143,
          inputAsset: TEST_INPUT_ASSET,
          outputAsset: TEST_OUTPUT_ASSET,
          amountIn: "1000000000000000000",
          amountOut: "42000000",
          observableBlockWindow: { fromBlock: "100", toBlock: "101" },
          synthetic: true,
        },
      };
    },
    action: async () => {
      events.push("action");
      if (scenario.action === "PENDING") {
        return never<Awaited<ReturnType<MossSourceBindings["action"]>>>();
      }
      if (scenario.action === "DELAYED") {
        await delay(scenario.delayedStageMs ?? 100);
      }
      if (scenario.action === "FAIL") {
        throw new Error("synthetic action acquisition failure");
      }
      return { operation: loaded, capability: rawCapability };
    },
    simulate: async (
      _capability: RawCapability,
      client: Parameters<MossSourceBindings["simulate"]>[1],
    ) => {
      events.push("simulate");
      if (scenario.simulation === "PENDING") {
        return never<Awaited<ReturnType<MossSourceBindings["simulate"]>>>();
      }
      if (scenario.simulation === "DELAYED") {
        await delay(scenario.delayedStageMs ?? 100);
      }
      if (scenario.simulation === "FAIL") {
        throw new Error("synthetic simulation acquisition failure");
      }
      const block = await client.request({ method: "eth_blockNumber" });
      await client.request({
        method: "debug_traceCall",
        params: [{ to: TEST_TARGET }, block, { tracer: "callTracer" }],
      });
      await client.request({
        method: "eth_estimateGas",
        params: [{ to: TEST_TARGET }, block],
      });
      return {
        protocolId: TEST_PROTOCOL,
        method: "swap",
        simulation: successfulSimulation(scenario.warning === true),
      };
    },
  } satisfies MossSourceBindings;
  const port = createFakeMossPort(bindings);

  const session: PreflightLiveSession = {
    port,
    catalog: {
      schemaVersion: "0.1",
      catalogId: "web-api-test-assets",
      sourceVersion: "1.0.0",
      provenance: "SYNTHETIC_TEST",
      sourceReference: "test/web-api-assets-v1",
      chainId: 143,
      validFrom: "2020-01-01T00:00:00.000Z",
      validUntil: "2099-01-01T00:00:00.000Z",
      entries: [
        {
          asset: TEST_INPUT_ASSET,
          decimals: { status: "KNOWN", value: 18 },
        },
        {
          asset: TEST_OUTPUT_ASSET,
          decimals: { status: "KNOWN", value: 6 },
        },
      ],
    },
    candidateProtocols: [TEST_PROTOCOL],
    createCapabilityPolicy: ({ selection }) => ({
      schemaVersion: "0.1",
      policyId: "web-api-test-capability",
      sourceVersion: "1.0.0",
      provenance: "SYNTHETIC_TEST",
      sourceReference: "test/web-api-capability-v1",
      chainId: 143,
      catalogDigest: selection.catalog.digest,
      protocolId: TEST_PROTOCOL,
      inputAsset: structuredClone(TEST_INPUT_ASSET),
      outputAsset: structuredClone(TEST_OUTPUT_ASSET),
      expectedNodeCount: {
        capabilityNodes: 1,
        transactionNodes: 1,
        totalNodes: 2,
      },
      expectedTransactionTargets: [{ address: TEST_TARGET, role: "PROTOCOL" }],
    }),
    network: "eip155:143" as PreflightLiveSession["network"],
    provenance: "LOCAL_FORK",
    limitations: [],
  };

  return {
    session,
    events,
    quoteSignals,
    pending: { quoteAborted: () => quoteAborted },
  };
}
