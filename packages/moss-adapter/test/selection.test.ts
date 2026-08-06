import {
  AssetSchema,
  EvmAddressSchema,
  ProtocolIdSchema,
} from "@moss-mini-demo/report-schema";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  collectAndSelectQuotesV0_1,
  MOSS_BUILD_INFO,
  MossAdapterError,
  type AssetCatalogV0_1,
  type MossPort,
  type QuoteCollectionRequestV0_1,
  type QuoteCollectionResultV0_1,
  type RawQuote,
} from "../src/index.js";

const INPUT_ASSET = AssetSchema.parse({ kind: "NATIVE" });
const OUTPUT_ASSET = AssetSchema.parse({
  kind: "ERC20",
  address: "0x2222222222222222222222222222222222222222",
});
const UNKNOWN_ASSET = AssetSchema.parse({
  kind: "ERC20",
  address: "0x3333333333333333333333333333333333333333",
});
const ACCOUNT = EvmAddressSchema.parse(
  "0x1111111111111111111111111111111111111111",
);
const ALPHA = ProtocolIdSchema.parse("alpha-protocol");
const BETA = ProtocolIdSchema.parse("beta-protocol");
const GAMMA = ProtocolIdSchema.parse("gamma-protocol");
const UINT256_MAX =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function catalog(
  entries: AssetCatalogV0_1["entries"] = [
    { asset: INPUT_ASSET, decimals: { status: "KNOWN", value: 18 } },
    { asset: OUTPUT_ASSET, decimals: { status: "KNOWN", value: 6 } },
  ],
): AssetCatalogV0_1 {
  return {
    schemaVersion: "0.1",
    catalogId: "selection-assets",
    sourceVersion: "1.0.0",
    provenance: "SYNTHETIC_TEST",
    sourceReference: "test/selection-assets-v1",
    chainId: 143,
    validFrom: "2020-01-01T00:00:00.000Z",
    validUntil: "2099-01-01T00:00:00.000Z",
    entries,
  };
}

function request(
  candidateProtocols = [ALPHA, BETA],
  allowedProtocols = candidateProtocols,
  overrides: Partial<QuoteCollectionRequestV0_1> = {},
): QuoteCollectionRequestV0_1 {
  return {
    chainId: 143,
    candidateProtocols,
    allowedProtocols,
    quoteInput: {
      method: "swap",
      account: ACCOUNT,
      params: {
        inputAsset: INPUT_ASSET,
        outputAsset: OUTPUT_ASSET,
        amountIn: "1000000000000000000",
      },
    },
    inputAsset: INPUT_ASSET,
    outputAsset: OUTPUT_ASSET,
    amountIn: "1000000000000000000",
    ...overrides,
  };
}

function rawQuote(
  protocolId: string,
  amountOut: string,
  rawOverrides: Record<string, unknown> = {},
): RawQuote {
  const source = {
    layer: "MOSS_ORIGINAL" as const,
    provenance: "SYNTHETIC_FAKE" as const,
    buildInfo: MOSS_BUILD_INFO,
  };
  return {
    operation: {
      chainId: 143,
      protocolId,
      method: "swap",
      buildInfo: MOSS_BUILD_INFO,
      mossOriginal: {
        source,
        protocolId,
        method: "swap",
        stub: {},
        riskLabels: [],
      },
      miniDemoDerived: {
        source: {
          layer: "MINI_DEMO_DERIVED",
          ruleVersion: "moss-adapter-boundary-v0.1",
        },
        protocolId,
        method: "swap",
        operationKind: "CAPABILITY",
        riskLabels: [],
      },
    },
    mossOriginal: {
      source,
      value: {
        chainId: 143,
        inputAsset: INPUT_ASSET,
        outputAsset: OUTPUT_ASSET,
        amountIn: "1000000000000000000",
        amountOut,
        observableBlockWindow: { fromBlock: "100", toBlock: "101" },
        synthetic: true,
        ...rawOverrides,
      } as RawQuote["mossOriginal"]["value"],
    },
    miniDemoDerived: {
      source: {
        layer: "MINI_DEMO_DERIVED",
        ruleVersion: "moss-adapter-boundary-v0.1",
      },
      normalizationStatus: "NOT_NORMALIZED",
      reason: "DEFERRED_TO_M2_05",
    },
  };
}

function quotePort(handler: MossPort["quote"]): {
  port: MossPort;
  quote: ReturnType<typeof vi.fn<MossPort["quote"]>>;
} {
  const quote = vi.fn<MossPort["quote"]>(handler);
  const unavailable = () =>
    Promise.reject(new Error("Synthetic method unavailable"));
  return {
    port: {
      quote,
      describe: unavailable,
      action: unavailable,
      simulate: unavailable,
      buildInfo: () => MOSS_BUILD_INFO,
    },
    quote,
  };
}

function selected(result: QuoteCollectionResultV0_1) {
  if (result.status !== "SELECTED") {
    throw new Error("Expected selected synthetic result");
  }
  return result;
}

function outcomeSummary(result: QuoteCollectionResultV0_1) {
  return result.outcomes.map((outcome) => ({
    protocolId: outcome.protocolId,
    status: outcome.status,
    code: "failure" in outcome ? outcome.failure.code : null,
    rawStatus: "raw" in outcome ? outcome.raw.status : null,
    amount:
      outcome.status === "ELIGIBLE"
        ? outcome.normalized.normalizedAmountOut
        : null,
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("deterministic Quote collection and selection", () => {
  it.each([
    ["first higher", { [ALPHA]: "20", [BETA]: "10" }, ALPHA],
    ["second higher", { [ALPHA]: "10", [BETA]: "20" }, BETA],
    ["exact tie", { [ALPHA]: "20", [BETA]: "20" }, ALPHA],
  ] as const)(
    "selects by BigInt amount and byte tie-break: %s",
    async (_name, amounts, winner) => {
      const { port } = quotePort(async (protocolId) =>
        rawQuote(protocolId, amounts[protocolId as keyof typeof amounts]),
      );

      const result = selected(
        await collectAndSelectQuotesV0_1(port, catalog(), request()),
      );

      expect(result.selected.protocolId).toBe(winner);
      expect(result.method).toBe("DETERMINISTIC_CANDIDATE_SELECTION_V0_1");
      expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
        "ELIGIBLE",
        "ELIGIBLE",
      ]);
    },
  );

  it("is independent of candidate and settlement order", async () => {
    const forwardAlpha = deferred<RawQuote>();
    const forwardBeta = deferred<RawQuote>();
    const forwardPort = quotePort((protocolId) =>
      protocolId === ALPHA ? forwardAlpha.promise : forwardBeta.promise,
    ).port;
    const forwardPending = collectAndSelectQuotesV0_1(
      forwardPort,
      catalog(),
      request([ALPHA, BETA]),
    );
    forwardBeta.resolve(rawQuote(BETA, "41"));
    forwardAlpha.resolve(rawQuote(ALPHA, "42"));
    const forward = selected(await forwardPending);

    const reverseAlpha = deferred<RawQuote>();
    const reverseBeta = deferred<RawQuote>();
    const reversePort = quotePort((protocolId) =>
      protocolId === ALPHA ? reverseAlpha.promise : reverseBeta.promise,
    ).port;
    const reversePending = collectAndSelectQuotesV0_1(
      reversePort,
      catalog(),
      request([BETA, ALPHA]),
    );
    reverseAlpha.resolve(rawQuote(ALPHA, "42"));
    reverseBeta.resolve(rawQuote(BETA, "41"));
    const reverse = selected(await reversePending);

    expect(outcomeSummary(forward)).toEqual(outcomeSummary(reverse));
    expect(forward.outcomes.map((outcome) => outcome.protocolId)).toEqual([
      ALPHA,
      BETA,
    ]);
    expect(reverse.selected.protocolId).toBe(forward.selected.protocolId);
    expect(reverse.catalog.digest).toBe(forward.catalog.digest);
    expect(reverse.selected.digest).toEqual(forward.selected.digest);
  });

  it("skips a disallowed protocol before catalog and Quote work", async () => {
    const { port, quote } = quotePort(async (protocolId) =>
      rawQuote(protocolId, "42"),
    );

    const result = selected(
      await collectAndSelectQuotesV0_1(
        port,
        catalog(),
        request([ALPHA, BETA], [BETA]),
      ),
    );

    expect(result.outcomes[0]).toMatchObject({
      protocolId: ALPHA,
      status: "SKIPPED",
      failure: { code: "PROTOCOL_NOT_ALLOWED" },
    });
    expect(quote).toHaveBeenCalledOnce();
    expect(quote.mock.calls[0]?.[0]).toBe(BETA);
  });

  it.each([
    [
      "UNKNOWN_ASSET",
      [{ asset: INPUT_ASSET, decimals: { status: "KNOWN", value: 18 } }],
    ],
    [
      "UNKNOWN_DECIMALS",
      [
        { asset: INPUT_ASSET, decimals: { status: "KNOWN", value: 18 } },
        { asset: OUTPUT_ASSET, decimals: { status: "UNKNOWN" } },
      ],
    ],
  ] as const)("skips every allowed protocol on %s", async (code, entries) => {
    const { port, quote } = quotePort(async (protocolId) =>
      rawQuote(protocolId, "42"),
    );
    const result = await collectAndSelectQuotesV0_1(
      port,
      catalog(entries),
      request(),
    );

    expect(result.status).toBe("NOT_SELECTED");
    expect(result.outcomes).toHaveLength(2);
    expect(
      result.outcomes.every(
        (outcome) =>
          outcome.status === "SKIPPED" && outcome.failure.code === code,
      ),
    ).toBe(true);
    expect(quote).not.toHaveBeenCalled();
  });

  it("forwards the exact signal and records a cooperative timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-06-01T00:00:00.000Z");
    let observedSignal: AbortSignal | undefined;
    const { port } = quotePort(
      (_protocolId, _input, options) =>
        new Promise<RawQuote>((_resolve, reject) => {
          observedSignal = options?.signal;
          observedSignal?.addEventListener("abort", () => {
            reject(new Error("cooperative synthetic abort"));
          });
        }),
    );

    const pending = collectAndSelectQuotesV0_1(
      port,
      catalog(),
      request([ALPHA], [ALPHA]),
    );
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;

    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toBe("MOSS_MINI_DEMO_QUOTE_TIMEOUT_V0_1");
    expect(result.outcomes[0]).toMatchObject({
      status: "ACQUISITION_FAILED",
      failure: { code: "QUOTE_TIMEOUT" },
    });
    expect(Object.isFrozen(result.outcomes[0])).toBe(true);
  });

  it("drains late fulfillment without result or selection pollution", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-06-01T00:00:00.000Z");
    const late = deferred<RawQuote>();
    const { port } = quotePort(() => late.promise);
    const pending = collectAndSelectQuotesV0_1(
      port,
      catalog(),
      request([ALPHA], [ALPHA]),
    );

    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    const before = outcomeSummary(result);
    late.resolve(rawQuote(ALPHA, "999999999999999999999"));
    await Promise.resolve();

    expect(result.status).toBe("NOT_SELECTED");
    expect(outcomeSummary(result)).toEqual(before);
    expect(result.outcomes[0]).toMatchObject({
      status: "ACQUISITION_FAILED",
      failure: { code: "QUOTE_TIMEOUT" },
    });
  });

  it("drains late rejection without changing the timeout outcome", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-06-01T00:00:00.000Z");
    const late = deferred<RawQuote>();
    const { port } = quotePort(() => late.promise);
    const pending = collectAndSelectQuotesV0_1(
      port,
      catalog(),
      request([ALPHA], [ALPHA]),
    );

    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    late.reject(new Error("synthetic late rejection"));
    await Promise.resolve();

    expect(result.outcomes[0]).toMatchObject({
      status: "ACQUISITION_FAILED",
      failure: { code: "QUOTE_TIMEOUT" },
    });
  });

  it("retains one timeout and selects the eligible candidate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-06-01T00:00:00.000Z");
    const late = deferred<RawQuote>();
    const { port } = quotePort((protocolId) =>
      protocolId === ALPHA
        ? late.promise
        : Promise.resolve(rawQuote(BETA, "42")),
    );
    const pending = collectAndSelectQuotesV0_1(port, catalog(), request());

    await vi.advanceTimersByTimeAsync(8_000);
    const result = selected(await pending);

    expect(result.selected.protocolId).toBe(BETA);
    expect(result.outcomes[0]).toMatchObject({
      protocolId: ALPHA,
      failure: { code: "QUOTE_TIMEOUT" },
    });
  });

  it("retains sanitized source rejection and selects another candidate", async () => {
    const { port } = quotePort(async (protocolId) => {
      if (protocolId === ALPHA) {
        throw new MossAdapterError("QUOTE_FAILED", "quote");
      }
      return rawQuote(protocolId, "42");
    });
    const result = selected(
      await collectAndSelectQuotesV0_1(port, catalog(), request()),
    );

    expect(result.selected.protocolId).toBe(BETA);
    expect(result.outcomes[0]).toMatchObject({
      status: "ACQUISITION_FAILED",
      failure: {
        code: "QUOTE_ACQUISITION_FAILED",
        sourceErrorCode: "QUOTE_FAILED",
      },
    });
    expect(result.outcomes[0]).not.toHaveProperty("cause");
  });

  it("uses null for hostile source errors without retaining sensitive text", async () => {
    const secret =
      "PRIVATE_KEY=https://synthetic.invalid headers account params";
    const hostileError = new Proxy(new Error(secret), {
      getPrototypeOf() {
        throw new Error(secret);
      },
    });
    const { port } = quotePort(async () => {
      throw hostileError;
    });
    const result = await collectAndSelectQuotesV0_1(
      port,
      catalog(),
      request([ALPHA], [ALPHA]),
    );

    expect(result.outcomes[0]).toMatchObject({
      status: "ACQUISITION_FAILED",
      failure: {
        code: "QUOTE_ACQUISITION_FAILED",
        sourceErrorCode: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("retains malformed plus eligible candidates under one code each", async () => {
    const { port } = quotePort(async (protocolId) =>
      protocolId === ALPHA
        ? rawQuote(protocolId, "0")
        : rawQuote(protocolId, "42"),
    );
    const result = selected(
      await collectAndSelectQuotesV0_1(port, catalog(), request()),
    );

    expect(result.outcomes[0]).toMatchObject({
      status: "INELIGIBLE",
      raw: { status: "SNAPSHOTTED" },
      failure: { code: "MALFORMED_QUOTE" },
    });
    expect(result.outcomes[1]?.status).toBe("ELIGIBLE");
    expect(result.selected.protocolId).toBe(BETA);
  });

  it("retains only source identity for unsnapshottable malformed raw", async () => {
    const source = rawQuote(ALPHA, "42") as RawQuote;
    const hostile = Object.defineProperty({ ...source }, "mossOriginal", {
      enumerable: true,
      get() {
        throw new Error("PRIVATE_KEY=synthetic-raw-secret");
      },
    }) as RawQuote;
    const { port } = quotePort(async () => hostile);
    const result = await collectAndSelectQuotesV0_1(
      port,
      catalog(),
      request([ALPHA], [ALPHA]),
    );
    const outcome = result.outcomes[0];

    expect(outcome).toMatchObject({
      status: "INELIGIBLE",
      raw: { status: "UNSNAPSHOTTABLE" },
      failure: { code: "MALFORMED_QUOTE" },
    });
    if (outcome?.status !== "INELIGIBLE") {
      throw new Error("Expected ineligible synthetic Quote");
    }
    expect(outcome.raw.source).toBe(hostile);
    expect(outcome.raw).not.toHaveProperty("snapshot");
  });

  it.each([
    ["ASSET_DIRECTION_MISMATCH", { outputAsset: UNKNOWN_ASSET }],
    ["AMOUNT_BASIS_MISMATCH", { amountIn: "999" }],
  ] as const)(
    "keeps %s correlated with snapshotted raw",
    async (code, rawOverrides) => {
      const { port } = quotePort(async (protocolId) =>
        rawQuote(protocolId, "42", rawOverrides),
      );
      const result = await collectAndSelectQuotesV0_1(
        port,
        catalog(),
        request([ALPHA], [ALPHA]),
      );

      expect(result.outcomes[0]).toMatchObject({
        status: "INELIGIBLE",
        raw: { status: "SNAPSHOTTED" },
        failure: { code },
      });
    },
  );

  it("retains all failures and returns NOT_SELECTED", async () => {
    const { port } = quotePort(async (protocolId) => {
      if (protocolId === ALPHA) {
        throw new Error("synthetic source failure");
      }
      return rawQuote(protocolId, "0");
    });
    const result = await collectAndSelectQuotesV0_1(
      port,
      catalog(),
      request([ALPHA, BETA, GAMMA], [ALPHA, BETA]),
    );

    expect(result).toMatchObject({
      status: "NOT_SELECTED",
      code: "NO_ELIGIBLE_QUOTE",
    });
    expect(outcomeSummary(result)).toEqual([
      {
        protocolId: ALPHA,
        status: "ACQUISITION_FAILED",
        code: "QUOTE_ACQUISITION_FAILED",
        rawStatus: null,
        amount: null,
      },
      {
        protocolId: BETA,
        status: "INELIGIBLE",
        code: "MALFORMED_QUOTE",
        rawStatus: "SNAPSHOTTED",
        amount: null,
      },
      {
        protocolId: GAMMA,
        status: "SKIPPED",
        code: "PROTOCOL_NOT_ALLOWED",
        rawStatus: null,
        amount: null,
      },
    ]);
  });

  it("retains every candidate when all acquisitions fail", async () => {
    const { port } = quotePort(async (protocolId) => {
      throw new Error(`synthetic failure for ${protocolId}`);
    });
    const result = await collectAndSelectQuotesV0_1(port, catalog(), request());

    expect(result).toMatchObject({
      status: "NOT_SELECTED",
      code: "NO_ELIGIBLE_QUOTE",
    });
    expect(result.outcomes).toHaveLength(2);
    expect(
      result.outcomes.every(
        (outcome) =>
          outcome.status === "ACQUISITION_FAILED" &&
          outcome.failure.code === "QUOTE_ACQUISITION_FAILED",
      ),
    ).toBe(true);
  });

  it("accepts and ranks the uint256 maximum using BigInt", async () => {
    const { port } = quotePort(async (protocolId) =>
      rawQuote(
        protocolId,
        protocolId === ALPHA ? `${BigInt(UINT256_MAX) - 1n}` : UINT256_MAX,
      ),
    );
    const result = selected(
      await collectAndSelectQuotesV0_1(port, catalog(), request()),
    );
    expect(result.selected.protocolId).toBe(BETA);
  });

  it("is repeatable, keeps inputs unchanged, and excludes timing from digests", async () => {
    const catalogInput = catalog();
    const requestInput = request();
    const catalogBefore = structuredClone(catalogInput);
    const requestBefore = structuredClone(requestInput);
    const sourceByProtocol = new Map([
      [ALPHA, rawQuote(ALPHA, "42")],
      [BETA, rawQuote(BETA, "41")],
    ]);
    const sourceBefore = structuredClone([...sourceByProtocol.values()]);
    const { port } = quotePort(async (protocolId) => {
      const source = sourceByProtocol.get(protocolId as typeof ALPHA);
      if (source === undefined) {
        throw new Error("Unexpected synthetic protocol");
      }
      return source;
    });

    const first = selected(
      await collectAndSelectQuotesV0_1(port, catalogInput, requestInput),
    );
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = selected(
      await collectAndSelectQuotesV0_1(port, catalogInput, requestInput),
    );

    expect(second.selected).toEqual(first.selected);
    expect(second.catalog.digest).toBe(first.catalog.digest);
    expect(outcomeSummary(second)).toEqual(outcomeSummary(first));
    expect(catalogInput).toEqual(catalogBefore);
    expect(requestInput).toEqual(requestBefore);
    expect([...sourceByProtocol.values()]).toEqual(sourceBefore);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.outcomes)).toBe(true);
  });
});
