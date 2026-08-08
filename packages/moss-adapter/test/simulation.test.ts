import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createFakeMossPort,
  MOSS_BUILD_INFO,
  MossAdapterError,
  type MossRpcRequestV0_1,
  type MossSimulationRpcClientV0_1,
  type MossSourceBindings,
  type RawCapability,
} from "../src/index.js";
import { createRecordingSimulationRpcSessionV0_1 } from "../src/simulation.js";
import {
  approvalSwapCapability,
  approvalSwapSimulation,
  SYNTHETIC_BLOCK,
  SYNTHETIC_BLOCK_HASH,
  SYNTHETIC_OTHER_BLOCK_HASH,
  singleSuccessSimulation,
  singleTransactionCapability,
  successfulRawRpcClient,
} from "./fixtures/simulation.js";

function operation() {
  const riskLabels = ["SYNTHETIC_SIMULATION"];
  return {
    protocolId: "synthetic-protocol",
    method: "swap",
    operationKind: "CAPABILITY" as const,
    stub: {
      protocol: "synthetic-protocol",
      method: "swap",
      kind: "capability",
      risk: riskLabels,
    },
    riskLabels,
  };
}

function bindings(
  options: {
    capability?: RawCapability;
    simulation?: unknown;
    rawClient?: MossSimulationRpcClientV0_1;
    run?: MossSourceBindings["simulate"];
  } = {},
) {
  const capability = options.capability ?? singleTransactionCapability();
  const simulation = options.simulation ?? singleSuccessSimulation();
  const rpc =
    options.rawClient === undefined ? successfulRawRpcClient() : undefined;
  const rawClient = options.rawClient ?? rpc?.client;
  if (rawClient === undefined) {
    throw new Error("synthetic raw RPC client is required");
  }
  const seen = {
    actionCapability: capability,
    simulatorCapability: undefined as RawCapability | undefined,
    simulatorClient: undefined as MossSimulationRpcClientV0_1 | undefined,
  };
  const loaded = operation();
  const sourceBindings = {
    chainId: 143,
    simulationRpcClient: rawClient,
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => loaded,
    quote: async () => ({ operation: loaded, quote: { amountOut: "42" } }),
    action: async () => ({ operation: loaded, capability }),
    simulate:
      options.run ??
      (async (input, client) => {
        seen.simulatorCapability = input;
        seen.simulatorClient = client;
        const block = await client.request({ method: "eth_blockNumber" });
        await client.request({
          method: "debug_traceCall",
          params: [{ to: "0xsynthetic" }, block, { tracer: "callTracer" }],
        });
        await client.request({
          method: "eth_estimateGas",
          params: [{ to: "0xsynthetic" }, block],
        });
        return {
          protocolId: "synthetic-protocol",
          method: "swap",
          simulation: simulation as never,
        };
      }),
  } satisfies MossSourceBindings;
  return { sourceBindings, capability, simulation, seen, rpc };
}

async function acquiredCapability(sourceBindings: MossSourceBindings) {
  const port = createFakeMossPort(sourceBindings);
  const action = await port.action("synthetic-protocol", {
    method: "swap",
    account: "synthetic-account",
    params: {},
  });
  return { port, action };
}

describe("recording simulation RPC session", () => {
  it("forwards exact requests and responses while isolating hash queries", async () => {
    const blockRequest = { method: "eth_blockNumber" } as const;
    const traceRequest = {
      method: "debug_traceCall",
      params: [{ data: "0x1234" }, SYNTHETIC_BLOCK, { tracer: "callTracer" }],
    } as const;
    const estimateRequest = {
      method: "eth_estimateGas",
      params: [{ data: "0x1234" }, SYNTHETIC_BLOCK],
    } as const;
    const traceResponse = { type: "CALL", syntheticIdentity: true };
    const estimateResponse = "0x5208";
    const calls: MossRpcRequestV0_1[] = [];
    let hashReads = 0;
    const rawClient = {
      async request(request: MossRpcRequestV0_1): Promise<unknown> {
        calls.push(request);
        if (request === blockRequest) return SYNTHETIC_BLOCK;
        if (request.method === "eth_getBlockByNumber") {
          hashReads += 1;
          return { hash: SYNTHETIC_BLOCK_HASH };
        }
        if (request === traceRequest) return traceResponse;
        if (request === estimateRequest) return estimateResponse;
        throw new Error("unexpected request identity");
      },
    };
    const session = createRecordingSimulationRpcSessionV0_1(rawClient);
    const before = structuredClone({ traceRequest, estimateRequest });

    expect(await session.client.request(blockRequest)).toBe(SYNTHETIC_BLOCK);
    expect(await session.client.request(traceRequest)).toBe(traceResponse);
    expect(await session.client.request(estimateRequest)).toBe(
      estimateResponse,
    );
    const observation = await session.finish();

    expect(calls[0]).toBe(blockRequest);
    expect(calls[2]).toBe(traceRequest);
    expect(calls[3]).toBe(estimateRequest);
    expect(calls.map(({ method }) => method)).toEqual([
      "eth_blockNumber",
      "eth_getBlockByNumber",
      "debug_traceCall",
      "eth_estimateGas",
      "eth_getBlockByNumber",
    ]);
    expect(calls[1]?.params).toEqual([SYNTHETIC_BLOCK, false]);
    expect(calls[4]?.params).toEqual([SYNTHETIC_BLOCK, false]);
    expect(hashReads).toBe(2);
    expect(observation).toEqual({
      blockNumberResponses: [SYNTHETIC_BLOCK],
      preBlockHashes: [SYNTHETIC_BLOCK_HASH],
      postBlockHash: SYNTHETIC_BLOCK_HASH,
      requestBlocks: [
        { method: "debug_traceCall", blockParameter: SYNTHETIC_BLOCK },
        { method: "eth_estimateGas", blockParameter: SYNTHETIC_BLOCK },
      ],
      failures: [],
    });
    expect({ traceRequest, estimateRequest }).toEqual(before);
  });

  it("preserves the exact raw rejection", async () => {
    const rejection = new Error("synthetic raw rejection");
    const request = {
      method: "debug_traceCall",
      params: [{}, SYNTHETIC_BLOCK, {}],
    } as const;
    const rawClient = {
      request: vi.fn(async (_request: MossRpcRequestV0_1) => {
        throw rejection;
      }),
    };
    const session = createRecordingSimulationRpcSessionV0_1(rawClient);

    await expect(session.client.request(request)).rejects.toBe(rejection);
    expect(rawClient.request).toHaveBeenCalledOnce();
    expect(rawClient.request.mock.calls[0]?.[0]).toBe(request);
  });

  it("returns the same immutable observation from repeated finish calls", async () => {
    const { client } = successfulRawRpcClient();
    const session = createRecordingSimulationRpcSessionV0_1(client);
    await session.client.request({ method: "eth_blockNumber" });
    const first = await session.finish();
    const second = await session.finish();
    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.blockNumberResponses)).toBe(true);
  });
});

describe("MossPort simulation evidence", () => {
  it("passes the exact action-return Capability and maps a proven simulation", async () => {
    const environment = bindings();
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );
    const evidence = await port.simulate(action.mossOriginal.value);

    expect(action.mossOriginal.value).toBe(environment.capability);
    expect(environment.seen.simulatorCapability).toBe(environment.capability);
    expect(environment.seen.simulatorClient).not.toBe(
      environment.sourceBindings.simulationRpcClient,
    );
    expect(evidence.mossOriginal.capability).toBe(environment.capability);
    expect(evidence.mossOriginal.simulation).toBe(environment.simulation);
    expect(evidence.miniDemoDerived).toMatchObject({
      capabilityIntegrity: "PROVEN",
      receiptCoverage: "PROVEN",
      ordering: "PROVEN",
      stateContinuity: "NOT_APPLICABLE",
      simulationBlock: { status: "PROVEN" },
    });
  });

  it("proves an Approval + Swap run uses one block and continuous state", async () => {
    const environment = bindings({
      capability: approvalSwapCapability(),
      simulation: approvalSwapSimulation(),
      run: async (_capability, client) => {
        const block = await client.request({ method: "eth_blockNumber" });
        for (const method of [
          "debug_traceCall",
          "eth_estimateGas",
          "debug_traceCall",
          "debug_traceCall",
          "eth_estimateGas",
        ] as const) {
          await client.request({ method, params: [{}, block, {}] });
        }
        return {
          protocolId: "synthetic-protocol",
          method: "swap",
          simulation: approvalSwapSimulation(),
        };
      },
    });
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );

    const evidence = await port.simulate(action.mossOriginal.value);
    const block = evidence.miniDemoDerived.simulationBlock;
    expect(block.status).toBe("PROVEN");
    expect(block.observation.requestBlocks).toHaveLength(5);
    expect(
      block.observation.requestBlocks.every(
        ({ blockParameter }) => blockParameter === SYNTHETIC_BLOCK,
      ),
    ).toBe(true);
    expect(evidence.miniDemoDerived.stateContinuity).toBe("PROVEN");
  });

  it("detects a valid simulator mutation through pre/post digests", async () => {
    const capability = singleTransactionCapability();
    const environment = bindings({
      capability,
      run: async (input, client) => {
        const block = await client.request({ method: "eth_blockNumber" });
        await client.request({
          method: "debug_traceCall",
          params: [{}, block, {}],
        });
        (input.params as { amountIn: string }).amountIn = "2";
        return {
          protocolId: "synthetic-protocol",
          method: "swap",
          simulation: singleSuccessSimulation(),
        };
      },
    });
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );

    const evidence = await port.simulate(action.mossOriginal.value);
    expect(evidence.miniDemoDerived.capabilityIntegrity).toBe("FAILED");
    expect(evidence.miniDemoDerived.capabilityDigests.preSimulation).not.toBe(
      evidence.miniDemoDerived.capabilityDigests.postSimulation,
    );
    expect(
      (evidence.mossOriginal.retained.capability.params as { amountIn: string })
        .amountIn,
    ).toBe("1");
  });

  it("marks a simulator-created non-JSON mutation UNPROVABLE", async () => {
    const environment = bindings({
      run: async (input, client) => {
        const block = await client.request({ method: "eth_blockNumber" });
        await client.request({
          method: "debug_traceCall",
          params: [{}, block, {}],
        });
        Object.defineProperty(input, "syntheticHiddenMutation", {
          configurable: true,
          enumerable: false,
          value: "synthetic",
        });
        return {
          protocolId: "synthetic-protocol",
          method: "swap",
          simulation: singleSuccessSimulation(),
        };
      },
    });
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );

    const evidence = await port.simulate(action.mossOriginal.value);
    expect(evidence.miniDemoDerived.capabilityIntegrity).toBe("UNPROVABLE");
    expect(evidence.miniDemoDerived.capabilityDigests).toMatchObject({
      preSimulation: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      postSimulation: null,
    });
    expect(evidence.mossOriginal.retained.capability).not.toHaveProperty(
      "syntheticHiddenMutation",
    );
  });

  it("marks inconsistent simulator blocks UNPROVABLE", async () => {
    const environment = bindings({
      run: async (_capability, client) => {
        await client.request({ method: "eth_blockNumber" });
        await client.request({
          method: "debug_traceCall",
          params: [{}, "0x1235", {}],
        });
        return {
          protocolId: "synthetic-protocol",
          method: "swap",
          simulation: singleSuccessSimulation(),
        };
      },
    });
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );
    const evidence = await port.simulate(action.mossOriginal.value);

    expect(evidence.miniDemoDerived.simulationBlock).toMatchObject({
      status: "UNPROVABLE",
      reasons: expect.arrayContaining(["BLOCK_PARAMETER_INCONSISTENT"]),
    });
  });

  it("marks absent and multiple block-number observations UNPROVABLE", async () => {
    const absent = bindings({
      run: async () => ({
        protocolId: "synthetic-protocol",
        method: "swap",
        simulation: singleSuccessSimulation(),
      }),
    });
    const absentPort = await acquiredCapability(absent.sourceBindings);
    expect(
      (await absentPort.port.simulate(absentPort.action.mossOriginal.value))
        .miniDemoDerived.simulationBlock,
    ).toMatchObject({
      status: "UNPROVABLE",
      reasons: expect.arrayContaining(["BLOCK_NUMBER_UNOBSERVABLE"]),
    });

    const multiple = bindings({
      run: async (_capability, client) => {
        await client.request({ method: "eth_blockNumber" });
        await client.request({ method: "eth_blockNumber" });
        return {
          protocolId: "synthetic-protocol",
          method: "swap",
          simulation: singleSuccessSimulation(),
        };
      },
    });
    const multiplePort = await acquiredCapability(multiple.sourceBindings);
    expect(
      (await multiplePort.port.simulate(multiplePort.action.mossOriginal.value))
        .miniDemoDerived.simulationBlock,
    ).toMatchObject({
      status: "UNPROVABLE",
      reasons: expect.arrayContaining(["BLOCK_NUMBER_INCONSISTENT"]),
    });
  });

  it.each([
    ["pre-hash", 1],
    ["post-hash", 2],
  ] as const)(
    "marks %s acquisition failure UNPROVABLE",
    async (_name, failAt) => {
      let hashReads = 0;
      const rawClient = {
        async request(request: MossRpcRequestV0_1): Promise<unknown> {
          if (request.method === "eth_blockNumber") return SYNTHETIC_BLOCK;
          if (request.method === "eth_getBlockByNumber") {
            hashReads += 1;
            if (hashReads === failAt) throw new Error("synthetic hash failure");
            return { hash: SYNTHETIC_BLOCK_HASH };
          }
          return {};
        },
      };
      const environment = bindings({ rawClient });
      const { port, action } = await acquiredCapability(
        environment.sourceBindings,
      );
      const evidence = await port.simulate(action.mossOriginal.value);
      expect(evidence.miniDemoDerived.simulationBlock).toMatchObject({
        status: "UNPROVABLE",
        reasons: expect.arrayContaining(["BLOCK_HASH_UNOBSERVABLE"]),
      });
    },
  );

  it("marks a pre/post hash change UNPROVABLE", async () => {
    const rpc = successfulRawRpcClient({
      preHash: SYNTHETIC_BLOCK_HASH,
      postHash: SYNTHETIC_OTHER_BLOCK_HASH,
    });
    const environment = bindings({ rawClient: rpc.client });
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );
    const evidence = await port.simulate(action.mossOriginal.value);
    expect(evidence.miniDemoDerived.simulationBlock).toMatchObject({
      status: "UNPROVABLE",
      reasons: expect.arrayContaining(["BLOCK_HASH_CHANGED"]),
    });
  });

  it("does not leak recording state across simulate calls", async () => {
    const environment = bindings();
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );
    const first = await port.simulate(action.mossOriginal.value);
    const second = await port.simulate(action.mossOriginal.value);
    expect(
      first.miniDemoDerived.simulationBlock.observation.requestBlocks,
    ).toHaveLength(2);
    expect(
      second.miniDemoDerived.simulationBlock.observation.requestBlocks,
    ).toHaveLength(2);
  });

  it("keeps acquisition failures structured and secret-safe", async () => {
    const secret =
      "PRIVATE_KEY=https://rpc.invalid/?key=synthetic headers params calldata";
    const environment = bindings({
      run: async () => {
        throw new Error(secret);
      },
    });
    const { port, action } = await acquiredCapability(
      environment.sourceBindings,
    );
    let caught: unknown;
    try {
      await port.simulate(action.mossOriginal.value);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MossAdapterError);
    expect(caught).toMatchObject({
      code: "SIMULATION_FAILED",
      operation: "simulate",
    });
    expect(caught).not.toHaveProperty("cause");
    expect(`${String(caught)}${JSON.stringify(caught)}`).not.toContain(secret);
  });

  it("fails before simulator delegation when the raw client is absent", async () => {
    const environment = bindings();
    let calls = 0;
    const port = createFakeMossPort({
      ...environment.sourceBindings,
      simulationRpcClient: undefined as never,
      simulate: async (...args) => {
        calls += 1;
        return environment.sourceBindings.simulate(...args);
      },
    });
    const action = await port.action("synthetic-protocol", {
      method: "swap",
      account: "synthetic-account",
      params: {},
    });

    await expect(
      port.simulate(action.mossOriginal.value),
    ).rejects.toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "simulate",
    });
    expect(calls).toBe(0);
  });
});
