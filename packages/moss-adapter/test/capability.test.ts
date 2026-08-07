import {
  AssetSchema,
  EvmAddressSchema,
  ProtocolIdSchema,
} from "@moss-mini-demo/report-schema";
import canonicalize from "canonicalize";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  collectAndSelectQuotesV0_1,
  constructCapabilityV0_1,
  createFakeMossPort,
  MOSS_BUILD_INFO,
  type ActionInput,
  type AssetCatalogV0_1,
  type CapabilityConstructionPolicyV0_1,
  type MossPort,
  type MossSourceBindings,
  type QuoteCollectionRequestV0_1,
  type QuoteCollectionResultV0_1,
  type RawCapability,
} from "../src/index.js";
import {
  CAPABILITY_DIGEST_DOMAIN,
  capabilityDigestFromSnapshot,
} from "../src/integrity.js";
import { createSelectedQuoteDigest } from "../src/quote.js";

const INPUT_ASSET = AssetSchema.parse({ kind: "NATIVE" });
const OUTPUT_ASSET = AssetSchema.parse({
  kind: "ERC20",
  address: "0x2222222222222222222222222222222222222222",
});
const ACCOUNT = EvmAddressSchema.parse(
  "0x1111111111111111111111111111111111111111",
);
const TARGET = EvmAddressSchema.parse(
  "0x2222222222222222222222222222222222222222",
);
const OTHER_TARGET = EvmAddressSchema.parse(
  "0x3333333333333333333333333333333333333333",
);
const PROTOCOL = ProtocolIdSchema.parse("synthetic-protocol");
const GOLDEN_DIGEST =
  "sha256:0d251a152143187d0a50d9481330aef30fbf5ee03a011be2f936e5805ee9ad89";

function catalog(
  provenance: AssetCatalogV0_1["provenance"] = "SYNTHETIC_TEST",
  overrides: Partial<AssetCatalogV0_1> = {},
): AssetCatalogV0_1 {
  return {
    schemaVersion: "0.1",
    catalogId: "capability-assets",
    sourceVersion: "1.0.0",
    provenance,
    sourceReference: "test/capability-assets-v1",
    chainId: 143,
    validFrom: "2020-01-01T00:00:00.000Z",
    validUntil: "2099-01-01T00:00:00.000Z",
    entries: [
      { asset: INPUT_ASSET, decimals: { status: "KNOWN", value: 18 } },
      { asset: OUTPUT_ASSET, decimals: { status: "KNOWN", value: 6 } },
    ],
    ...overrides,
  };
}

function request(): QuoteCollectionRequestV0_1 {
  return {
    chainId: 143,
    candidateProtocols: [PROTOCOL],
    allowedProtocols: [PROTOCOL],
    quoteInput: {
      method: "swap",
      account: ACCOUNT,
      params: {
        inputAsset: structuredClone(INPUT_ASSET),
        outputAsset: structuredClone(OUTPUT_ASSET),
        amountIn: "1000000000000000000",
        slippageBps: "50",
      },
    },
    inputAsset: structuredClone(INPUT_ASSET),
    outputAsset: structuredClone(OUTPUT_ASSET),
    amountIn: "1000000000000000000",
  };
}

function goldenCapability(): RawCapability {
  return {
    kind: "capability",
    protocol: PROTOCOL,
    method: "swap",
    params: {
      amountIn: "1",
      inputAsset: { kind: "NATIVE" },
    },
    children: [
      {
        kind: "transaction",
        transaction: {
          from: ACCOUNT,
          to: TARGET,
          data: "0x",
          value: "0x0",
        },
      },
    ],
  };
}

function trackedBindings(capability: RawCapability = goldenCapability()) {
  const calls = { quote: 0, action: 0, simulate: 0 };
  const delegatedActionInputs: ActionInput[] = [];
  const delegatedSimulationInputs: RawCapability[] = [];
  const riskLabels = ["SYNTHETIC_CAPABILITY"];
  const operation = {
    protocolId: PROTOCOL,
    method: "swap",
    operationKind: "CAPABILITY" as const,
    stub: {
      protocol: PROTOCOL,
      method: "swap",
      kind: "capability",
      risk: riskLabels,
    },
    riskLabels,
  };
  const bindings = {
    chainId: 143,
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => operation,
    quote: async () => {
      calls.quote += 1;
      return {
        operation,
        quote: {
          chainId: 143,
          inputAsset: INPUT_ASSET,
          outputAsset: OUTPUT_ASSET,
          amountIn: "1000000000000000000",
          amountOut: "42000000",
          observableBlockWindow: { fromBlock: "100", toBlock: "101" },
          synthetic: true,
        },
      };
    },
    action: async (_protocolId: string, input: ActionInput) => {
      calls.action += 1;
      delegatedActionInputs.push(input);
      return { operation, capability };
    },
    simulate: async (input: RawCapability) => {
      calls.simulate += 1;
      delegatedSimulationInputs.push(input);
      return {
        protocolId: PROTOCOL,
        method: "swap",
        simulation: { status: "synthetic-success" },
      };
    },
  } satisfies MossSourceBindings;
  return {
    bindings,
    calls,
    capability,
    delegatedActionInputs,
    delegatedSimulationInputs,
  };
}

function selected(result: QuoteCollectionResultV0_1) {
  if (result.status !== "SELECTED") {
    throw new Error("Expected selected synthetic Quote");
  }
  return result;
}

function policy(
  result: Extract<QuoteCollectionResultV0_1, { status: "SELECTED" }>,
  overrides: Partial<CapabilityConstructionPolicyV0_1> = {},
): CapabilityConstructionPolicyV0_1 {
  return {
    schemaVersion: "0.1",
    policyId: "synthetic-capability",
    sourceVersion: "1.0.0",
    provenance: "SYNTHETIC_TEST",
    sourceReference: "test/capability-policy-v1",
    chainId: 143,
    catalogDigest: result.catalog.digest,
    protocolId: PROTOCOL,
    inputAsset: structuredClone(INPUT_ASSET),
    outputAsset: structuredClone(OUTPUT_ASSET),
    expectedNodeCount: {
      capabilityNodes: 1,
      transactionNodes: 1,
      totalNodes: 2,
    },
    expectedTransactionTargets: [{ address: TARGET, role: "PROTOCOL" }],
    ...overrides,
  };
}

async function setup(
  capability = goldenCapability(),
  catalogValue: AssetCatalogV0_1 = catalog(),
) {
  const tracked = trackedBindings(capability);
  const port = createFakeMossPort(tracked.bindings);
  const quoteRequest = request();
  const selection = selected(
    await collectAndSelectQuotesV0_1(port, catalogValue, quoteRequest),
  );
  return { ...tracked, port, quoteRequest, selection };
}

async function construct(capability = goldenCapability()) {
  const environment = await setup(capability);
  const result = await constructCapabilityV0_1(
    environment.port,
    environment.selection,
    environment.quoteRequest,
    policy(environment.selection),
  );
  return { ...environment, result };
}

describe("synthetic Capability construction and integrity", () => {
  it("matches the independent RFC 8785 capability byte vector", () => {
    const expectedCanonicalText =
      '{"children":[{"kind":"transaction","transaction":{"data":"0x","from":"0x1111111111111111111111111111111111111111","to":"0x2222222222222222222222222222222222222222","value":"0x0"}}],"kind":"capability","method":"swap","params":{"amountIn":"1","inputAsset":{"kind":"NATIVE"}},"protocol":"synthetic-protocol"}';
    const canonical = canonicalize(goldenCapability());
    expect(canonical).toBe(expectedCanonicalText);
    expect(new TextEncoder().encode(CAPABILITY_DIGEST_DOMAIN)).toHaveLength(31);
    expect(new TextEncoder().encode(canonical ?? "")).toHaveLength(306);
    expect(
      new TextEncoder().encode(`${CAPABILITY_DIGEST_DOMAIN}${canonical}`),
    ).toHaveLength(337);
    expect(capabilityDigestFromSnapshot(goldenCapability())).toBe(
      GOLDEN_DIGEST,
    );
  });

  it("constructs deterministically across catalog validity clock changes", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
      const environment = await setup(
        goldenCapability(),
        catalog("SYNTHETIC_TEST", {
          validFrom: "2026-08-06T00:00:00.000Z",
          validUntil: "2026-08-08T00:00:00.000Z",
        }),
      );
      const first = await constructCapabilityV0_1(
        environment.port,
        environment.selection,
        environment.quoteRequest,
        policy(environment.selection),
      );

      vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
      const second = await constructCapabilityV0_1(
        environment.port,
        environment.selection,
        environment.quoteRequest,
        policy(environment.selection),
      );
      expect(second.actionInput).toEqual(first.actionInput);
      expect(second.miniDemoDerived).toEqual(first.miniDemoDerived);
      expect(environment.calls.action).toBe(2);

      const malformedSelection = structuredClone(environment.selection) as {
        catalog: { validUntil: string };
      };
      malformedSelection.catalog.validUntil = "2026-08-06T00:00:00.000Z";
      await expect(
        constructCapabilityV0_1(
          environment.port,
          malformedSelection as never,
          environment.quoteRequest,
          policy(environment.selection),
        ),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
        operation: "action",
      });
      expect(environment.calls.action).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("converts amount, preserves exact identity, and matches the frozen digest", async () => {
    const sourceRequest = request();
    const requestBefore = structuredClone(sourceRequest);
    const environment = await setup();
    const selectionBefore = structuredClone(environment.selection);

    const result = await constructCapabilityV0_1(
      environment.port,
      environment.selection,
      sourceRequest,
      policy(environment.selection),
    );

    expect(environment.calls.action).toBe(1);
    expect(environment.delegatedActionInputs[0]).toEqual({
      method: "swap",
      account: ACCOUNT,
      params: {
        inputAsset: INPUT_ASSET,
        outputAsset: OUTPUT_ASSET,
        amountIn: "1",
        slippageBps: "50",
      },
    });
    expect(result.status).toBe("CONSTRUCTED_SYNTHETIC");
    expect(result.mossOriginal.value).toBe(environment.capability);
    expect(result.simulatorInput).toBe(environment.capability);
    expect(result.miniDemoDerived.snapshot).not.toBe(environment.capability);
    expect(result.miniDemoDerived.snapshot).toEqual(environment.capability);
    expect(Object.isFrozen(environment.capability)).toBe(false);
    expect(Object.isFrozen(environment.capability.children)).toBe(false);
    expect(Object.isFrozen(result.miniDemoDerived.snapshot)).toBe(true);
    expect(Object.isFrozen(result.miniDemoDerived.snapshot.children)).toBe(
      true,
    );
    expect(result.miniDemoDerived.amount).toEqual({
      smallestUnit: "1000000000000000000",
      humanDecimal: "1",
      decimals: 18,
      conversion: "VIEM_PARSE_FORMAT_UNITS_V0_1",
    });
    expect(result.miniDemoDerived.integrity).toEqual({
      algorithm: "RFC8785-SHA256",
      domain: "moss-mini-demo:capability:v0.1\n",
      digest: GOLDEN_DIGEST,
    });
    expect(result.miniDemoDerived.nodeCount).toMatchObject({
      status: "EXPECTED",
      actual: { capabilityNodes: 1, transactionNodes: 1, totalNodes: 2 },
    });
    expect(result.miniDemoDerived.transactionTargets).toMatchObject({
      status: "EXPECTED",
      observed: [TARGET],
      unexpected: [],
    });
    expect(result.verifyCurrentIntegrity()).toEqual({
      status: "MATCH",
      expectedDigest: GOLDEN_DIGEST,
      actualDigest: GOLDEN_DIGEST,
    });
    expect(sourceRequest).toEqual(requestBefore);
    expect(environment.selection).toEqual(selectionBefore);
  });

  it("reuses the source-boundary snapshot by identity", async () => {
    const environment = await setup();
    let acquiredSnapshot: RawCapability | undefined;
    const wrappedPort = {
      ...environment.port,
      action: async (...args: Parameters<MossPort["action"]>) => {
        const evidence = await environment.port.action(...args);
        acquiredSnapshot = evidence.miniDemoDerived.snapshot;
        return evidence;
      },
    } satisfies MossPort;

    const result = await constructCapabilityV0_1(
      wrappedPort,
      environment.selection,
      environment.quoteRequest,
      policy(environment.selection),
    );

    expect(result.miniDemoDerived.snapshot).toBe(acquiredSnapshot);
  });

  it.each([
    ["upstreamCommit", "f".repeat(40)],
    ["integrationCommit", "e".repeat(40)],
    ["patchsetDigest", `sha256:${"0".repeat(64)}`],
  ] as const)(
    "rejects action %s build identity mismatch",
    async (field, replacement) => {
      const environment = await setup();
      const action = vi.fn(async (...args: Parameters<MossPort["action"]>) => {
        const evidence = await environment.port.action(...args);
        const changedBuildInfo = {
          ...MOSS_BUILD_INFO,
          [field]: replacement,
        } as typeof MOSS_BUILD_INFO;
        return {
          ...evidence,
          mossOriginal: {
            ...evidence.mossOriginal,
            source: {
              ...evidence.mossOriginal.source,
              buildInfo: changedBuildInfo,
            },
          },
        };
      });
      const mismatchedPort = { ...environment.port, action } satisfies MossPort;

      await expect(
        constructCapabilityV0_1(
          mismatchedPort,
          environment.selection,
          environment.quoteRequest,
          policy(environment.selection),
        ),
      ).rejects.toMatchObject({
        code: "SOURCE_CONTRACT_VIOLATION",
        operation: "action",
      });
      expect(action).toHaveBeenCalledOnce();
    },
  );

  it("rejects a shallow-frozen forged snapshot before returning evidence", async () => {
    const environment = await setup();
    const evidence = await environment.port.action(PROTOCOL, {
      method: "swap",
      account: ACCOUNT,
      params: {},
    });
    const shallowSnapshot = structuredClone(evidence.miniDemoDerived.snapshot);
    Object.freeze(shallowSnapshot);
    expect(Object.isFrozen(shallowSnapshot)).toBe(true);
    expect(Object.isFrozen(shallowSnapshot.params)).toBe(false);
    const action = vi.fn(async () => ({
      ...evidence,
      miniDemoDerived: {
        ...evidence.miniDemoDerived,
        snapshot: shallowSnapshot,
      },
    }));
    const forgedPort = { ...environment.port, action } satisfies MossPort;

    await expect(
      constructCapabilityV0_1(
        forgedPort,
        environment.selection,
        environment.quoteRequest,
        policy(environment.selection),
      ),
    ).rejects.toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "action",
    });
    expect(action).toHaveBeenCalledOnce();
  });

  it("forwards the registered action return by exact identity without mapping simulation", async () => {
    const { port, result, capability, calls, delegatedSimulationInputs } =
      await construct();

    const simulation = await port.simulate(result.simulatorInput);

    expect(calls.simulate).toBe(1);
    expect(delegatedSimulationInputs[0]).toBe(capability);
    expect(simulation.miniDemoDerived).toEqual({
      source: {
        layer: "MINI_DEMO_DERIVED",
        ruleVersion: "moss-adapter-boundary-v0.1",
      },
      mappingStatus: "NOT_MAPPED",
      reason: "DEFERRED_TO_M2_07",
    });
    expect(result.verifyCurrentIntegrity().status).toBe("MATCH");
  });

  it("reports valid raw mutation as MISMATCH without changing recorded evidence", async () => {
    const { result } = await construct();
    const snapshotBefore = structuredClone(result.miniDemoDerived.snapshot);
    const raw = result.simulatorInput as unknown as {
      params: { amountIn: string };
    };

    raw.params.amountIn = "2";

    expect(result.verifyCurrentIntegrity()).toMatchObject({
      status: "MISMATCH",
      expectedDigest: GOLDEN_DIGEST,
    });
    expect(result.miniDemoDerived.snapshot).toEqual(snapshotBefore);
    expect(result.miniDemoDerived.integrity.digest).toBe(GOLDEN_DIGEST);
  });

  it("rejects a caller-controlled repeated alias inside selection", async () => {
    const environment = await setup();
    const changed = structuredClone(environment.selection) as unknown as {
      outcomes: Array<{
        status: string;
        protocolId: string;
        raw?: { snapshot: Record<string, unknown> };
      }>;
      selected: { digest: unknown };
    };
    const eligible = changed.outcomes.find(
      (outcome) =>
        outcome.status === "ELIGIBLE" && outcome.protocolId === PROTOCOL,
    );
    if (eligible?.raw === undefined) {
      throw new Error("Expected eligible synthetic outcome");
    }
    const shared = { marker: "caller-alias" };
    eligible.raw.snapshot.left = shared;
    eligible.raw.snapshot.right = shared;
    changed.selected.digest = createSelectedQuoteDigest(eligible as never);

    await expect(
      constructCapabilityV0_1(
        environment.port,
        changed as never,
        environment.quoteRequest,
        policy(environment.selection),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "action" });
    expect(environment.calls.action).toBe(0);
  });

  it("rejects a caller-controlled repeated alias inside the request", async () => {
    const environment = await setup();
    const changed = structuredClone(environment.quoteRequest) as {
      quoteInput: { params: Record<string, unknown> };
    };
    const shared = { marker: "caller-alias" };
    changed.quoteInput.params.left = shared;
    changed.quoteInput.params.right = shared;

    await expect(
      constructCapabilityV0_1(
        environment.port,
        environment.selection,
        changed as never,
        policy(environment.selection),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "action" });
    expect(environment.calls.action).toBe(0);
  });

  it("rejects a policy alias crossing the untrusted argument boundary", async () => {
    const environment = await setup();
    const changed = policy(environment.selection) as unknown as {
      inputAsset: typeof environment.quoteRequest.inputAsset;
    };
    changed.inputAsset = environment.quoteRequest.inputAsset;

    await expect(
      constructCapabilityV0_1(
        environment.port,
        environment.selection,
        environment.quoteRequest,
        changed as never,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "action" });
    expect(environment.calls.action).toBe(0);
  });

  it("records unexpected synthetic node counts and targets without a Decision", async () => {
    const environment = await setup();
    const result = await constructCapabilityV0_1(
      environment.port,
      environment.selection,
      environment.quoteRequest,
      policy(environment.selection, {
        expectedNodeCount: {
          capabilityNodes: 2,
          transactionNodes: 1,
          totalNodes: 3,
        },
        expectedTransactionTargets: [
          { address: OTHER_TARGET, role: "PROTOCOL" },
        ],
      }),
    );

    expect(result.miniDemoDerived.nodeCount.status).toBe("UNEXPECTED");
    expect(result.miniDemoDerived.transactionTargets).toMatchObject({
      status: "UNEXPECTED",
      observed: [TARGET],
      unexpected: [TARGET],
    });
    expect(result).not.toHaveProperty("decision");
    expect(result).not.toHaveProperty("simulation");
  });

  it("fails closed when current raw differs from the source-boundary snapshot", async () => {
    const environment = await setup();
    const evidence = await environment.port.action(PROTOCOL, {
      method: "swap",
      account: ACCOUNT,
      params: {},
    });
    const raw = evidence.mossOriginal.value as unknown as {
      params: { amountIn: string };
    };
    raw.params.amountIn = "2";
    const action = vi.fn(async () => evidence);
    const changedPort = { action } as unknown as MossPort;

    await expect(
      constructCapabilityV0_1(
        changedPort,
        environment.selection,
        environment.quoteRequest,
        policy(environment.selection),
      ),
    ).rejects.toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "action",
    });
    expect(action).toHaveBeenCalledOnce();
  });

  it("rejects a changed selected digest before action delegation", async () => {
    const environment = await setup();
    const changed = structuredClone(environment.selection);
    (changed.selected.digest as { value: string }).value =
      `sha256:${"0".repeat(64)}`;

    await expect(
      constructCapabilityV0_1(
        environment.port,
        changed,
        environment.quoteRequest,
        policy(environment.selection),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "action" });
    expect(environment.calls.action).toBe(0);
  });

  it.each([
    [
      "non-enumerable property",
      (raw: Record<PropertyKey, unknown>) => {
        Object.defineProperty(raw, "hidden", {
          value: "synthetic-hidden",
          enumerable: false,
          configurable: true,
        });
      },
    ],
    [
      "Symbol key",
      (raw: Record<PropertyKey, unknown>) => {
        Object.defineProperty(raw, Symbol("synthetic-hidden"), {
          value: "synthetic-hidden",
          enumerable: true,
          configurable: true,
        });
      },
    ],
    [
      "sparse array",
      (raw: Record<PropertyKey, unknown>) => {
        raw.children = new Array(1);
      },
    ],
    [
      "extra array property",
      (raw: Record<PropertyKey, unknown>) => {
        const children = raw.children as unknown[] & { extra?: string };
        children.extra = "synthetic-extra";
      },
    ],
  ] as const)(
    "rejects registered current input with %s before simulator delegation",
    async (_name, mutate) => {
      const { port, result, calls } = await construct();
      const raw = result.simulatorInput as unknown as Record<
        PropertyKey,
        unknown
      >;
      mutate(raw);

      expect(result.verifyCurrentIntegrity()).toEqual({
        status: "UNPROVABLE",
        expectedDigest: GOLDEN_DIGEST,
        actualDigest: null,
      });
      await expect(port.simulate(result.simulatorInput)).rejects.toMatchObject({
        code: "INVALID_INPUT",
        operation: "simulate",
      });
      expect(calls.simulate).toBe(0);
    },
  );

  it("rejects every caller-asserted production policy before action", async () => {
    const environment = await setup();
    const asserted = {
      ...policy(environment.selection),
      provenance: "MAINTAINER_APPROVED",
      approval: "caller-asserted",
    };

    await expect(
      constructCapabilityV0_1(
        environment.port,
        environment.selection,
        environment.quoteRequest,
        asserted as never,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "action" });
    expect(environment.calls.action).toBe(0);
  });

  it("rejects a pinned-submodule action source in this synthetic-only release", async () => {
    const environment = await setup();
    const production = {
      ...environment.port,
      action: async (...args: Parameters<MossPort["action"]>) => {
        const evidence = await environment.port.action(...args);
        return {
          ...evidence,
          mossOriginal: {
            ...evidence.mossOriginal,
            source: {
              ...evidence.mossOriginal.source,
              provenance: "PINNED_SUBMODULE" as const,
            },
          },
        };
      },
    } satisfies MossPort;

    await expect(
      constructCapabilityV0_1(
        production,
        environment.selection,
        environment.quoteRequest,
        policy(environment.selection),
      ),
    ).rejects.toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "action",
    });
  });

  it("rejects malformed Capability trees instead of presenting evidence", async () => {
    const environment = await setup({
      kind: "capability",
      protocol: PROTOCOL,
      method: "swap",
      params: {},
      children: [{ kind: "unknown" }],
    });

    await expect(
      constructCapabilityV0_1(
        environment.port,
        environment.selection,
        environment.quoteRequest,
        policy(environment.selection),
      ),
    ).rejects.toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "action",
    });
  });
});
