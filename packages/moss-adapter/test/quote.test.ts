import canonicalize from "canonicalize";
import {
  AssetSchema,
  EvmAddressSchema,
  ProtocolIdSchema,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  collectAndSelectQuotesV0_1,
  MOSS_BUILD_INFO,
  MossAdapterError,
  type AssetCatalogEntryV0_1,
  type AssetCatalogV0_1,
  type MossPort,
  type QuoteCollectionRequestV0_1,
  type RawQuote,
} from "../src/index.js";
import {
  createAssetCatalogSnapshot,
  findCatalogEntry,
  sha256CanonicalText,
} from "../src/asset-catalog.js";
import {
  classifyAcquiredQuote,
  createSelectedQuoteDigest,
  validateQuoteCollectionRequest,
} from "../src/quote.js";

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
const UINT256_MAX =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

function catalog(
  entries: AssetCatalogV0_1["entries"] = [
    { asset: OUTPUT_ASSET, decimals: { status: "KNOWN", value: 6 } },
    { asset: INPUT_ASSET, decimals: { status: "KNOWN", value: 18 } },
  ],
): AssetCatalogV0_1 {
  return {
    schemaVersion: "0.1",
    catalogId: "synthetic-assets",
    sourceVersion: "1.0.0",
    provenance: "SYNTHETIC_TEST",
    sourceReference: "test/asset-catalog-v1",
    chainId: 143,
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2027-01-01T00:00:00.000Z",
    entries,
  };
}

function request(
  overrides: Partial<QuoteCollectionRequestV0_1> = {},
): QuoteCollectionRequestV0_1 {
  return {
    chainId: 143,
    candidateProtocols: [ALPHA],
    allowedProtocols: [ALPHA],
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
  protocolId = ALPHA,
  rawValue: RawQuote["mossOriginal"]["value"] = {
    chainId: 143,
    inputAsset: INPUT_ASSET,
    outputAsset: OUTPUT_ASSET,
    amountIn: "1000000000000000000",
    amountOut: "42000000",
    observableBlockWindow: { fromBlock: "100", toBlock: "101" },
    synthetic: true,
  },
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
    mossOriginal: { source, value: rawValue },
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

function quoteOnlyPort(quote: MossPort["quote"]): MossPort {
  return { quote } as MossPort;
}

function knownEntry(
  entry: AssetCatalogEntryV0_1 | undefined,
): AssetCatalogEntryV0_1 & { decimals: { status: "KNOWN"; value: number } } {
  if (entry?.decimals.status !== "KNOWN") {
    throw new Error("Expected known synthetic catalog entry");
  }
  return entry as AssetCatalogEntryV0_1 & {
    decimals: { status: "KNOWN"; value: number };
  };
}

describe("Quote validation, evidence separation, and digests", () => {
  it("matches the frozen RFC 8785 text, bytes, and SHA-256 vector", () => {
    const referenceInputText = String.raw`{
  "numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
  "string": "\u20ac$\u000f\u000aA'\u0042\u0022\u005c\\\"\/",
  "literals": [null, true, false]
}`;
    const expectedCanonicalText = String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`;
    const expectedHex =
      "7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d32375d2c22737472696e67223a22e282ac245c75303030665c6e4127425c225c5c5c5c5c222f227d";
    const parsedReference = JSON.parse(referenceInputText) as {
      string: string;
    };
    const parsedExpected = JSON.parse(expectedCanonicalText) as {
      string: string;
    };
    const bytes = new TextEncoder().encode(expectedCanonicalText);
    const actualHex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    expect(parsedReference.string).toContain("\u000f");
    expect(parsedExpected.string).toContain("\u000f");
    expect(bytes).toHaveLength(118);
    expect(actualHex).toContain("5c7530303066");
    expect(actualHex).toBe(expectedHex);
    expect(sha256CanonicalText(expectedCanonicalText)).toBe(
      "sha256:2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb",
    );
    expect(canonicalize(parsedReference)).toBe(expectedCanonicalText);
  });

  it("validates, sorts, freezes, and hashes the synthetic catalog without mutation", () => {
    const source = catalog();
    const before = structuredClone(source);
    const snapshot = createAssetCatalogSnapshot(
      source,
      Date.parse("2026-06-01T00:00:00.000Z"),
    );
    const expectedCanonicalText =
      '{"catalogId":"synthetic-assets","chainId":143,"entries":[{"asset":{"address":"0x2222222222222222222222222222222222222222","kind":"ERC20"},"decimals":{"status":"KNOWN","value":6}},{"asset":{"kind":"NATIVE"},"decimals":{"status":"KNOWN","value":18}}],"provenance":"SYNTHETIC_TEST","schemaVersion":"moss-mini-demo/asset-catalog/0.1","sourceReference":"test/asset-catalog-v1","sourceVersion":"1.0.0","validFrom":"2026-01-01T00:00:00.000Z","validUntil":"2027-01-01T00:00:00.000Z"}';

    expect(source).toEqual(before);
    expect(snapshot.entries.map((entry) => entry.asset.kind)).toEqual([
      "ERC20",
      "NATIVE",
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.entries)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0])).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]?.asset)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]?.decimals)).toBe(true);
    expect(snapshot.provenance).toBe("SYNTHETIC_TEST");
    expect(snapshot.digest).toBe(
      "sha256:9f09d6a5e86f4ab1e459a7e0db1fd981afcbafe8cdc880e4e6b8e295dfc9a75e",
    );
    expect(sha256CanonicalText(expectedCanonicalText)).toBe(snapshot.digest);
    expect(
      canonicalize({
        schemaVersion: "moss-mini-demo/asset-catalog/0.1",
        catalogId: source.catalogId,
        sourceVersion: source.sourceVersion,
        provenance: source.provenance,
        sourceReference: source.sourceReference,
        chainId: source.chainId,
        validFrom: source.validFrom,
        validUntil: source.validUntil,
        entries: snapshot.entries,
      }),
    ).toBe(expectedCanonicalText);
  });

  it.each([
    ["wrong chain", { chainId: 1 }],
    ["untrusted approval field", { maintainerApproved: true }],
    [
      "duplicate catalog asset",
      { entries: [...catalog().entries, catalog().entries[0]] },
    ],
    ["empty catalog", { entries: [] }],
    ["not yet valid", { validFrom: "2026-07-01T00:00:00.000Z" }],
    ["expired", { validUntil: "2026-05-01T00:00:00.000Z" }],
  ])(
    "rejects a %s catalog before Quote delegation",
    async (_name, override) => {
      const quote = vi.fn(async () => rawQuote());
      vi.spyOn(Date, "now").mockReturnValue(
        Date.parse("2026-06-01T00:00:00.000Z"),
      );

      await expect(
        collectAndSelectQuotesV0_1(
          quoteOnlyPort(quote),
          { ...catalog(), ...override } as AssetCatalogV0_1,
          request(),
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "quote" });
      expect(quote).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    },
  );

  it.each([
    ["empty candidates", { candidateProtocols: [] }],
    ["empty allowlist", { allowedProtocols: [] }],
    ["invalid protocol", { candidateProtocols: ["Alpha Protocol"] }],
    ["duplicate protocol", { candidateProtocols: [ALPHA, ALPHA] }],
    ["wrong chain", { chainId: 1 }],
    [
      "invalid account",
      {
        quoteInput: {
          ...request().quoteInput,
          account: "0x0000000000000000000000000000000000000000",
        },
      },
    ],
    ["inconsistent amount basis", { amountIn: "2" }],
    ["number amount", { amountIn: 1 }],
    ["zero amount", { amountIn: "0" }],
    ["leading-zero amount", { amountIn: "01" }],
    ["float amount", { amountIn: "1.1" }],
    ["exponent amount", { amountIn: "1e3" }],
    ["negative amount", { amountIn: "-1" }],
    ["uint256 overflow", { amountIn: `${BigInt(UINT256_MAX) + 1n}` }],
  ])("rejects %s request data without repair", (_name, override) => {
    expect(() =>
      validateQuoteCollectionRequest({ ...request(), ...override }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", operation: "quote" }),
    );
  });

  it("sanitizes hostile request and catalog objects with zero delegations", async () => {
    const secret = "PRIVATE_KEY=https://synthetic.invalid headers account";
    const quote = vi.fn(async () => rawQuote());
    const hostileRequest = new Proxy(request(), {
      ownKeys() {
        throw new Error(secret);
      },
    });
    const revokedCatalog = Proxy.revocable(catalog(), {});
    revokedCatalog.revoke();

    for (const [catalogValue, requestValue] of [
      [catalog(), hostileRequest],
      [revokedCatalog.proxy, request()],
    ] as const) {
      let caught: unknown;
      try {
        await collectAndSelectQuotesV0_1(
          quoteOnlyPort(quote),
          catalogValue,
          requestValue,
        );
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(MossAdapterError);
      expect(caught).toMatchObject({
        code: "INVALID_INPUT",
        operation: "quote",
      });
      expect(caught).not.toHaveProperty("cause");
      expect(`${String(caught)}${JSON.stringify(caught)}`).not.toContain(
        secret,
      );
    }
    expect(quote).not.toHaveBeenCalled();
  });

  it.each([
    [
      "UNKNOWN_ASSET",
      [
        {
          asset: INPUT_ASSET,
          decimals: { status: "KNOWN", value: 18 } as const,
        },
      ],
    ],
    [
      "UNKNOWN_DECIMALS",
      [
        {
          asset: INPUT_ASSET,
          decimals: { status: "KNOWN", value: 18 } as const,
        },
        { asset: OUTPUT_ASSET, decimals: { status: "UNKNOWN" } as const },
      ],
    ],
  ] as const)("returns %s without calling Quote", async (code, entries) => {
    const quote = vi.fn(async () => rawQuote());
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-06-01T00:00:00.000Z"),
    );

    const result = await collectAndSelectQuotesV0_1(
      quoteOnlyPort(quote),
      catalog(entries),
      request(),
    );

    expect(result.status).toBe("NOT_SELECTED");
    expect(result.outcomes[0]).toMatchObject({
      status: "SKIPPED",
      failure: { code },
    });
    expect(quote).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("retains raw identity, owns a frozen snapshot, and matches the selected digest vector", () => {
    const snapshot = createAssetCatalogSnapshot(
      catalog(),
      Date.parse("2026-06-01T00:00:00.000Z"),
    );
    const inputEntry = knownEntry(findCatalogEntry(snapshot, INPUT_ASSET));
    const outputEntry = knownEntry(findCatalogEntry(snapshot, OUTPUT_ASSET));
    const source = rawQuote();
    const before = structuredClone(source);
    const outcome = classifyAcquiredQuote(
      ALPHA,
      source,
      validateQuoteCollectionRequest(request()),
      snapshot,
      inputEntry,
      outputEntry,
    );

    expect(outcome.status).toBe("ELIGIBLE");
    if (outcome.status !== "ELIGIBLE") {
      throw new Error("Expected eligible synthetic Quote");
    }
    expect(outcome.raw.source).toBe(source);
    expect(outcome.raw.snapshot).toEqual(source.mossOriginal.value);
    expect(outcome.raw.snapshot).not.toBe(source.mossOriginal.value);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(outcome.raw.snapshot)).toBe(true);
    expect(source).toEqual(before);
    expect(outcome.normalized).toMatchObject({
      inputAmount: "1000000000000000000",
      outputAmount: "42000000",
      normalizedAmountOut: "42000000",
      inputDecimals: 18,
      outputDecimals: 6,
    });
    expect(outcome.acquiredTiming).toMatchObject({
      clock: "NODE_PROCESS_HRTIME_V0_1",
    });
    expect(outcome.acquiredTiming.observedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(outcome.acquiredTiming.monotonicNs).toMatch(/^(?:0|[1-9]\d*)$/);

    const digest = createSelectedQuoteDigest(outcome);
    const expectedCanonicalText =
      '{"account":"0x1111111111111111111111111111111111111111","catalog":{"catalogId":"synthetic-assets","digest":"sha256:9f09d6a5e86f4ab1e459a7e0db1fd981afcbafe8cdc880e4e6b8e295dfc9a75e","provenance":"SYNTHETIC_TEST","sourceReference":"test/asset-catalog-v1","sourceVersion":"1.0.0"},"chainId":143,"inputAmount":"1000000000000000000","inputAsset":{"kind":"NATIVE"},"inputDecimals":18,"method":"swap","mossSource":{"integrationCommit":"1ae6b6322d51fae9104f047efb94e601050b967f","patchsetDigest":"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","provenance":"SYNTHETIC_FAKE","upstreamCommit":"1ae6b6322d51fae9104f047efb94e601050b967f"},"observableBlockWindow":{"fromBlock":"100","toBlock":"101"},"outputAmount":"42000000","outputAsset":{"address":"0x2222222222222222222222222222222222222222","kind":"ERC20"},"outputDecimals":6,"protocolId":"alpha-protocol","rawQuote":{"amountIn":"1000000000000000000","amountOut":"42000000","chainId":143,"inputAsset":{"kind":"NATIVE"},"observableBlockWindow":{"fromBlock":"100","toBlock":"101"},"outputAsset":{"address":"0x2222222222222222222222222222222222222222","kind":"ERC20"},"synthetic":true},"schemaVersion":"moss-mini-demo/selected-quote-digest/0.1"}';
    expect(canonicalize(digest.payload)).toBe(expectedCanonicalText);
    expect(digest.value).toBe(
      "sha256:b9ee24d4c1566c35b3282f4b15fc4d98551f4c2d199ea8221926bf09c8f37594",
    );
  });

  it.each([
    ["number", { amountOut: 1 }],
    ["zero", { amountOut: "0" }],
    ["leading zero", { amountOut: "01" }],
    ["float", { amountOut: "1.1" }],
    ["exponent", { amountOut: "1e3" }],
    ["negative", { amountOut: "-1" }],
    ["missing amount", { amountOut: undefined }],
    ["over uint256", { amountOut: `${BigInt(UINT256_MAX) + 1n}` }],
    ["lone surrogate", { note: "\uD800" }],
    ["missing block window", { observableBlockWindow: undefined }],
    [
      "invalid block number",
      { observableBlockWindow: { fromBlock: "-1", toBlock: "1" } },
    ],
    [
      "reversed block window",
      { observableBlockWindow: { fromBlock: "2", toBlock: "1" } },
    ],
  ])("classifies malformed raw %s", (_name, override) => {
    const snapshot = createAssetCatalogSnapshot(
      catalog(),
      Date.parse("2026-06-01T00:00:00.000Z"),
    );
    const value = {
      ...(rawQuote().mossOriginal.value as Record<string, unknown>),
      ...override,
    } as RawQuote["mossOriginal"]["value"];
    const outcome = classifyAcquiredQuote(
      ALPHA,
      rawQuote(ALPHA, value),
      validateQuoteCollectionRequest(request()),
      snapshot,
      knownEntry(findCatalogEntry(snapshot, INPUT_ASSET)),
      knownEntry(findCatalogEntry(snapshot, OUTPUT_ASSET)),
    );
    expect(outcome).toMatchObject({
      status: "INELIGIBLE",
      failure: { code: "MALFORMED_QUOTE" },
    });
  });

  it("accepts the exact uint256 maximum without Number conversion", () => {
    const value = request({
      amountIn: UINT256_MAX,
      quoteInput: {
        ...request().quoteInput,
        params: { ...request().quoteInput.params, amountIn: UINT256_MAX },
      },
    });
    expect(validateQuoteCollectionRequest(value).amountIn).toBe(UINT256_MAX);
  });

  it("matches assets only by native/address identity, never by labels", () => {
    expect(() =>
      validateQuoteCollectionRequest({
        ...request(),
        inputAsset: UNKNOWN_ASSET,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
});
