import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MOSS_BUILD_INFO,
  MossAdapterError,
  createProductionMossPort,
  type MossBuildInfo,
  type MossSourceBindings,
} from "../src/index.js";

function trackedBindings() {
  const calls = { describe: 0, quote: 0, action: 0, simulate: 0 };
  const riskLabels = ["SYNTHETIC_RISK"];
  const operation = {
    protocolId: "synthetic-protocol",
    method: "swap",
    operationKind: "CAPABILITY" as const,
    stub: {
      protocol: "synthetic-protocol",
      method: "swap",
      kind: "capability",
      risk: riskLabels,
      source: "synthetic-inline",
    },
    riskLabels,
  };
  const bindings = {
    chainId: 143,
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => {
      calls.describe += 1;
      return operation;
    },
    quote: async () => {
      calls.quote += 1;
      return { operation, quote: { amountOut: "42" } };
    },
    action: async () => {
      calls.action += 1;
      return {
        operation,
        capability: { kind: "capability", children: [] },
      };
    },
    simulate: async () => {
      calls.simulate += 1;
      return {
        protocolId: "synthetic-protocol",
        method: "swap",
        simulation: { status: "synthetic-success" },
      };
    },
  } satisfies MossSourceBindings;
  return { bindings, calls };
}

describe("ProductionMossPort", () => {
  it("implements all five methods and delegates each async operation once", async () => {
    const { bindings, calls } = trackedBindings();
    const port = createProductionMossPort(bindings);
    const quoteInput = {
      method: "swap",
      account: "synthetic-account",
      params: { amountIn: "100" },
    } as const;
    const actionInput = structuredClone(quoteInput);
    const capability = { kind: "capability", children: [] } as const;
    const before = JSON.stringify({ quoteInput, actionInput, capability });

    await port.describe("synthetic-protocol", "swap");
    await port.quote("synthetic-protocol", quoteInput);
    await port.action("synthetic-protocol", actionInput);
    await port.simulate(capability);
    expect(port.buildInfo()).toBe(MOSS_BUILD_INFO);

    expect(calls).toEqual({ describe: 1, quote: 1, action: 1, simulate: 1 });
    expect(JSON.stringify({ quoteInput, actionInput, capability })).toBe(
      before,
    );
  });

  it("fails closed before delegation when chain id is not 143", () => {
    const { bindings, calls } = trackedBindings();

    expect(() =>
      createProductionMossPort({ ...bindings, chainId: 144 }),
    ).toThrowError(
      expect.objectContaining({
        code: "CHAIN_ID_MISMATCH",
        operation: "buildInfo",
      }),
    );
    expect(calls).toEqual({ describe: 0, quote: 0, action: 0, simulate: 0 });
  });

  it("rejects source identity drift", () => {
    const { bindings } = trackedBindings();
    const driftedBuildInfo = {
      ...MOSS_BUILD_INFO,
      integrationCommit: "0000000000000000000000000000000000000000",
    } as MossBuildInfo;

    expect(() =>
      createProductionMossPort({
        ...bindings,
        buildInfo: () => driftedBuildInfo,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "SOURCE_CONTRACT_VIOLATION",
        operation: "buildInfo",
      }),
    );
  });

  it("rejects risk labels detached from the exact loaded Stub", async () => {
    const { bindings } = trackedBindings();
    const loaded = await bindings.describe();
    const detachedRiskLabels = [...loaded.riskLabels];
    const port = createProductionMossPort({
      ...bindings,
      describe: async () => ({
        ...loaded,
        riskLabels: detachedRiskLabels,
      }),
    });

    await expect(
      port.describe("synthetic-protocol", "swap"),
    ).rejects.toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "describe",
    });
  });

  it("rejects invalid caller and source values without delegation drift", async () => {
    const { bindings, calls } = trackedBindings();
    const port = createProductionMossPort(bindings);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    await expect(port.describe("../unsafe", "swap")).rejects.toMatchObject({
      code: "INVALID_INPUT",
      operation: "describe",
    });
    await expect(
      port.quote("synthetic-protocol", {
        method: "swap",
        account: "synthetic-account",
        params: cyclic as never,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "quote" });
    expect(calls).toEqual({ describe: 0, quote: 0, action: 0, simulate: 0 });

    const mismatched = {
      ...bindings,
      describe: async () => ({
        protocolId: "different-protocol",
        method: "swap",
        operationKind: "CAPABILITY" as const,
        stub: {
          protocol: "different-protocol",
          method: "swap",
          kind: "capability",
          risk: [],
        },
        riskLabels: [],
      }),
    } satisfies MossSourceBindings;
    await expect(
      createProductionMossPort(mismatched).describe(
        "synthetic-protocol",
        "swap",
      ),
    ).rejects.toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "describe",
    });
  });

  it("converts source exceptions without leaking their secret message", async () => {
    const secret = "PRIVATE_KEY=synthetic-secret";
    const { bindings } = trackedBindings();
    const port = createProductionMossPort({
      ...bindings,
      quote: async () => {
        throw new Error(secret);
      },
    });

    let caught: unknown;
    try {
      await port.quote("synthetic-protocol", {
        method: "swap",
        account: "synthetic-account",
        params: {},
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MossAdapterError);
    expect(caught).toMatchObject({ code: "QUOTE_FAILED", operation: "quote" });
    expect(JSON.stringify(caught)).not.toContain(secret);
    expect(caught).not.toHaveProperty("cause");
  });
});
