import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createProductionMossPort,
  MOSS_BUILD_INFO,
  MossAdapterError,
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

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected input boundary rejection");
}

function expectSanitizedInputError(
  error: unknown,
  operation: "quote" | "action" | "simulate",
  secret: string,
): void {
  expect(error).toBeInstanceOf(MossAdapterError);
  expect(error).toMatchObject({ code: "INVALID_INPUT", operation });
  expect(error).not.toHaveProperty("cause");

  const exposed = `${String(error)}\n${JSON.stringify(error)}`;
  expect(exposed).not.toContain(secret);
  expect(exposed).not.toContain("PRIVATE_KEY");
  expect(exposed).not.toContain("https://");
  expect(exposed).not.toContain("headers");
  expect(exposed).not.toContain("account");
  expect(exposed).not.toContain("params");
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

  it("sanitizes a quote method throwing getter before delegation", async () => {
    const secret =
      "PRIVATE_KEY=https://quote-input.invalid headers account params input-secret";
    const { bindings, calls } = trackedBindings();
    const input = Object.defineProperty(
      {
        account: "synthetic-account",
        params: { amountIn: "100" },
      },
      "method",
      {
        enumerable: true,
        get() {
          throw new Error(secret);
        },
      },
    );
    const port = createProductionMossPort(bindings);

    const caught = await captureRejection(
      port.quote("synthetic-protocol", input as never),
    );

    expectSanitizedInputError(caught, "quote", secret);
    expect(calls).toEqual({ describe: 0, quote: 0, action: 0, simulate: 0 });
  });

  it("sanitizes a quote hostile Proxy before delegation", async () => {
    const secret =
      "PRIVATE_KEY=https://quote-proxy.invalid headers account params input-secret";
    const { bindings, calls } = trackedBindings();
    const input = new Proxy(
      {
        method: "swap",
        account: "synthetic-account",
        params: { amountIn: "100", source: secret },
      },
      {
        ownKeys() {
          throw new Error(secret);
        },
      },
    );
    const port = createProductionMossPort(bindings);

    const caught = await captureRejection(
      port.quote("synthetic-protocol", input),
    );

    expectSanitizedInputError(caught, "quote", secret);
    expect(calls).toEqual({ describe: 0, quote: 0, action: 0, simulate: 0 });
  });

  it("sanitizes an action account throwing getter before delegation", async () => {
    const secret =
      "PRIVATE_KEY=https://action-input.invalid headers account params input-secret";
    const { bindings, calls } = trackedBindings();
    const input = Object.defineProperty(
      {
        method: "swap",
        params: { amountIn: "100" },
      },
      "account",
      {
        enumerable: true,
        get() {
          throw new Error(secret);
        },
      },
    );
    const port = createProductionMossPort(bindings);

    const caught = await captureRejection(
      port.action("synthetic-protocol", input as never),
    );

    expectSanitizedInputError(caught, "action", secret);
    expect(calls).toEqual({ describe: 0, quote: 0, action: 0, simulate: 0 });
  });

  it("sanitizes an action revoked Proxy before delegation", async () => {
    const secret =
      "PRIVATE_KEY=https://action-proxy.invalid headers account params input-secret";
    const { bindings, calls } = trackedBindings();
    const revocable = Proxy.revocable(
      {
        method: "swap",
        account: "synthetic-account",
        params: { amountIn: "100", source: secret },
      },
      {},
    );
    revocable.revoke();
    const port = createProductionMossPort(bindings);

    const caught = await captureRejection(
      port.action("synthetic-protocol", revocable.proxy),
    );

    expectSanitizedInputError(caught, "action", secret);
    expect(calls).toEqual({ describe: 0, quote: 0, action: 0, simulate: 0 });
  });

  it("sanitizes a simulate revoked Proxy before delegation", async () => {
    const secret =
      "PRIVATE_KEY=https://simulate-proxy.invalid headers account params input-secret";
    const { bindings, calls } = trackedBindings();
    const revocable = Proxy.revocable(
      { kind: "capability", children: [], source: secret },
      {},
    );
    revocable.revoke();
    const port = createProductionMossPort(bindings);

    const caught = await captureRejection(
      port.simulate(revocable.proxy as never),
    );

    expectSanitizedInputError(caught, "simulate", secret);
    expect(calls).toEqual({ describe: 0, quote: 0, action: 0, simulate: 0 });
  });

  it("reads a valid caller method getter once and delegates an owned snapshot", async () => {
    const { bindings, calls } = trackedBindings();
    let methodReads = 0;
    const quoteBinding = vi.fn(bindings.quote as MossSourceBindings["quote"]);
    const port = createProductionMossPort({
      ...bindings,
      quote: quoteBinding,
    });
    const input = Object.defineProperty(
      {
        account: "synthetic-account",
        params: { amountIn: "100" },
      },
      "method",
      {
        enumerable: true,
        get() {
          methodReads += 1;
          if (methodReads > 1) {
            throw new Error("method was read more than once");
          }
          return "swap";
        },
      },
    );

    await port.quote("synthetic-protocol", input as never);

    const delegatedInput = quoteBinding.mock.calls[0]?.[1];
    expect(methodReads).toBe(1);
    expect(quoteBinding).toHaveBeenCalledTimes(1);
    expect(Object.is(delegatedInput, input)).toBe(false);
    expect(delegatedInput).toEqual({
      method: "swap",
      account: "synthetic-account",
      params: { amountIn: "100" },
    });
    expect(Object.isFrozen(delegatedInput)).toBe(true);
    expect(calls.quote).toBe(1);
  });

  it("converts source exceptions without leaking their secret message", async () => {
    const secret = "PRIVATE_KEY=synthetic-secret";
    const { bindings } = trackedBindings();
    const hostileError = new Proxy(new Error(secret), {
      getPrototypeOf() {
        throw new Error(secret);
      },
    });
    const port = createProductionMossPort({
      ...bindings,
      quote: async () => {
        throw hostileError;
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
