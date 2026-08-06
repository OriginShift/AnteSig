import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MOSS_BUILD_INFO,
  MossAdapterError,
  createProductionMossPort,
  type MossAdapterErrorCode,
  type MossBuildInfo,
  type MossSourceBindings,
} from "../src/index.js";

const ERROR_CODES = [
  "INVALID_INPUT",
  "CHAIN_ID_MISMATCH",
  "SOURCE_CONTRACT_VIOLATION",
  "UNSUPPORTED_PROTOCOL",
  "UNSUPPORTED_METHOD",
  "DESCRIBE_FAILED",
  "QUOTE_FAILED",
  "ACTION_FAILED",
  "SIMULATION_FAILED",
] as const satisfies readonly MossAdapterErrorCode[];

type SourceOperation =
  | "buildInfo"
  | "describe"
  | "quote"
  | "action"
  | "simulate";

function syntheticBindings() {
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
    },
    riskLabels,
  };
  const bindings = {
    chainId: 143,
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => operation,
    quote: async () => ({ operation, quote: { amountOut: "42" } }),
    action: async () => ({
      operation,
      capability: { kind: "capability", children: [] },
    }),
    simulate: async () => ({
      protocolId: "synthetic-protocol",
      method: "swap",
      simulation: { status: "synthetic-success" },
    }),
  } satisfies MossSourceBindings;
  return { bindings, operation };
}

function expectSanitizedSourceError(
  error: unknown,
  operation: SourceOperation,
  secret: string,
): void {
  expect(error).toBeInstanceOf(MossAdapterError);
  expect(error).toMatchObject({
    code: "SOURCE_CONTRACT_VIOLATION",
    operation,
  });
  expect(error).not.toHaveProperty("cause");

  const exposed = `${String(error)}\n${JSON.stringify(error)}`;
  expect(exposed).not.toContain(secret);
  expect(exposed).not.toContain("PRIVATE_KEY");
  expect(exposed).not.toContain("https://");
  expect(exposed).not.toContain("headers");
  expect(exposed).not.toContain("account");
  expect(exposed).not.toContain("params");
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected source boundary rejection");
}

describe("MossAdapterError", () => {
  it.each(ERROR_CODES)("serializes %s with the closed safe shape", (code) => {
    const error = new MossAdapterError(code, "describe", {
      protocolId: "synthetic-protocol",
      method: "swap",
    });

    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "MossAdapterError",
      code,
      operation: "describe",
      retryable: false,
      protocolId: "synthetic-protocol",
      method: "swap",
      message: error.message,
    });
    expect(error).not.toHaveProperty("cause");
  });

  it("drops unsafe context and never serializes secret-looking input", () => {
    const secret = "PRIVATE_KEY=https://rpc.invalid/?apiKey=synthetic-secret";
    const error = new MossAdapterError("INVALID_INPUT", "action", {
      protocolId: secret,
      method: secret,
    });
    const serialized = JSON.stringify(error);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(error.protocolId).toBeUndefined();
    expect(error.method).toBeUndefined();
  });
});

describe("source-owned value sanitization", () => {
  it("sanitizes a secret-bearing buildInfo Proxy", () => {
    const secret =
      "PRIVATE_KEY=https://build.invalid headers account params source-secret";
    const { bindings } = syntheticBindings();
    const buildInfo = new Proxy(MOSS_BUILD_INFO, {
      get(target, property, receiver) {
        if (property === "sourceMode") {
          throw new Error(secret);
        }
        return Reflect.get(target, property, receiver);
      },
    }) as MossBuildInfo;

    let caught: unknown;
    try {
      createProductionMossPort({
        ...bindings,
        buildInfo: () => buildInfo,
      });
    } catch (error) {
      caught = error;
    }

    expectSanitizedSourceError(caught, "buildInfo", secret);
  });

  it("sanitizes a secret-bearing describe result Proxy", async () => {
    const secret =
      "PRIVATE_KEY=https://describe.invalid headers account params source-secret";
    const { bindings, operation } = syntheticBindings();
    const result = new Proxy(operation, {
      get(target, property, receiver) {
        if (property === "protocolId") {
          throw new Error(secret);
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const port = createProductionMossPort({
      ...bindings,
      describe: async () => result,
    });

    const caught = await captureRejection(
      port.describe("synthetic-protocol", "swap"),
    );

    expectSanitizedSourceError(caught, "describe", secret);
  });

  it("sanitizes a secret-bearing quote getter", async () => {
    const secret =
      "PRIVATE_KEY=https://quote.invalid headers account params source-secret";
    const { bindings, operation } = syntheticBindings();
    const result = Object.defineProperty({ operation }, "quote", {
      enumerable: true,
      get() {
        throw new Error(secret);
      },
    }) as unknown as Awaited<ReturnType<MossSourceBindings["quote"]>>;
    const port = createProductionMossPort({
      ...bindings,
      quote: async () => result,
    });

    const caught = await captureRejection(
      port.quote("synthetic-protocol", {
        method: "swap",
        account: "synthetic-account",
        params: { amountIn: "100" },
      }),
    );

    expectSanitizedSourceError(caught, "quote", secret);
  });

  it("sanitizes a secret-bearing action getter", async () => {
    const secret =
      "PRIVATE_KEY=https://action.invalid headers account params source-secret";
    const { bindings, operation } = syntheticBindings();
    const result = Object.defineProperty({ operation }, "capability", {
      enumerable: true,
      get() {
        throw new Error(secret);
      },
    }) as unknown as Awaited<ReturnType<MossSourceBindings["action"]>>;
    const port = createProductionMossPort({
      ...bindings,
      action: async () => result,
    });

    const caught = await captureRejection(
      port.action("synthetic-protocol", {
        method: "swap",
        account: "synthetic-account",
        params: { amountIn: "100" },
      }),
    );

    expectSanitizedSourceError(caught, "action", secret);
  });

  it("sanitizes a secret-bearing simulation result Proxy", async () => {
    const secret =
      "PRIVATE_KEY=https://simulate.invalid headers account params source-secret";
    const { bindings } = syntheticBindings();
    const simulation = {
      protocolId: "synthetic-protocol",
      method: "swap",
      simulation: { status: "synthetic-success" },
    };
    const result = new Proxy(simulation, {
      get(target, property, receiver) {
        if (property === "protocolId") {
          throw new Error(secret);
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const port = createProductionMossPort({
      ...bindings,
      simulate: async () => result,
    });

    const caught = await captureRejection(
      port.simulate({ kind: "capability", children: [] }),
    );

    expectSanitizedSourceError(caught, "simulate", secret);
  });
});
