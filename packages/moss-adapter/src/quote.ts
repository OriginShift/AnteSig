import canonicalize from "canonicalize";
import {
  AssetSchema,
  EvmAddressSchema,
  PositiveAmountSchema,
  ProtocolIdSchema,
  UnsignedAmountSchema,
} from "@moss-mini-demo/report-schema";
import { assetKey, sha256CanonicalText } from "./asset-catalog.js";
import { MossAdapterError, type MossAdapterErrorCode } from "./errors.js";
import type {
  AssetCatalogEntryV0_1,
  AssetCatalogSnapshotV0_1,
  JsonValue,
  MossPort,
  NormalizedQuoteV0_1,
  QuoteAssetV0_1,
  QuoteCandidateOutcomeV0_1,
  QuoteCollectionRequestV0_1,
  QuoteRawProjectionV0_1,
  QuoteTimingV0_1,
  RawQuote,
  RawQuoteRetentionV0_1,
  SelectedQuoteDigestV0_1,
} from "./types.js";

const UINT256_MAX = (1n << 256n) - 1n;
const METHOD = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const REQUEST_KEYS = [
  "chainId",
  "candidateProtocols",
  "allowedProtocols",
  "quoteInput",
  "inputAsset",
  "outputAsset",
  "amountIn",
] as const;
const QUOTE_INPUT_KEYS = ["method", "account", "params"] as const;
const REQUIRED_PARAM_KEYS = ["inputAsset", "outputAsset", "amountIn"] as const;
const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;

type EligibleOutcome = Extract<
  QuoteCandidateOutcomeV0_1,
  { status: "ELIGIBLE" }
>;
type KnownCatalogEntry = AssetCatalogEntryV0_1 & {
  readonly decimals: Readonly<{ status: "KNOWN"; value: number }>;
};

function invalidInput(): never {
  throw new MossAdapterError("INVALID_INPUT", "quote");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function isJsonValue(
  value: unknown,
  seen = new WeakSet<object>(),
): value is JsonValue {
  if (value === null || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "string") {
    return !hasLoneSurrogate(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object" || seen.has(value)) {
    return false;
  }
  seen.add(value);
  let valid = true;
  if (Array.isArray(value)) {
    valid = value.every((item) => isJsonValue(item, seen));
  } else if (isPlainRecord(value)) {
    valid = Object.entries(value).every(
      ([key, item]) => !hasLoneSurrogate(key) && isJsonValue(item, seen),
    );
  } else {
    valid = false;
  }
  seen.delete(value);
  return valid;
}

export function freezeOwned<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    freezeOwned(child);
  }
  return Object.freeze(value);
}

function keysEqual(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function parseWith<T>(
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  value: unknown,
): T {
  try {
    const result = schema.safeParse(value);
    if (!result.success || result.data === undefined) {
      return invalidInput();
    }
    return result.data;
  } catch {
    return invalidInput();
  }
}

function positiveUint256(value: unknown): string {
  const amount = parseWith<string>(PositiveAmountSchema, value);
  if (BigInt(amount) > UINT256_MAX) {
    return invalidInput();
  }
  return amount;
}

function cloneRequest(value: unknown): Record<string, unknown> {
  try {
    const cloned = structuredClone(value);
    if (!isPlainRecord(cloned) || !isJsonValue(cloned)) {
      return invalidInput();
    }
    return cloned;
  } catch {
    return invalidInput();
  }
}

function parseProtocolList(
  value: unknown,
): QuoteCollectionRequestV0_1["candidateProtocols"] {
  if (!Array.isArray(value) || value.length === 0) {
    return invalidInput();
  }
  const protocols = value.map((protocolId) =>
    parseWith(ProtocolIdSchema, protocolId),
  );
  if (new Set(protocols).size !== protocols.length) {
    return invalidInput();
  }
  return Object.freeze(protocols);
}

function parseAsset(value: unknown): QuoteAssetV0_1 {
  return freezeOwned(parseWith(AssetSchema, value));
}

function assetsEqual(left: QuoteAssetV0_1, right: QuoteAssetV0_1): boolean {
  return assetKey(left) === assetKey(right);
}

export function validateQuoteCollectionRequest(
  value: unknown,
): QuoteCollectionRequestV0_1 {
  const cloned = cloneRequest(value);
  if (!keysEqual(cloned, REQUEST_KEYS) || cloned.chainId !== 143) {
    return invalidInput();
  }
  const candidateProtocols = parseProtocolList(cloned.candidateProtocols);
  const allowedProtocols = parseProtocolList(cloned.allowedProtocols);
  const inputAsset = parseAsset(cloned.inputAsset);
  const outputAsset = parseAsset(cloned.outputAsset);
  const amountIn = positiveUint256(cloned.amountIn);

  if (
    !isPlainRecord(cloned.quoteInput) ||
    !keysEqual(cloned.quoteInput, QUOTE_INPUT_KEYS)
  ) {
    return invalidInput();
  }
  const method = cloned.quoteInput.method;
  if (typeof method !== "string" || !METHOD.test(method)) {
    return invalidInput();
  }
  const account = parseWith(EvmAddressSchema, cloned.quoteInput.account);
  const params = cloned.quoteInput.params;
  if (
    !isPlainRecord(params) ||
    !REQUIRED_PARAM_KEYS.every((key) => key in params)
  ) {
    return invalidInput();
  }
  const paramsInputAsset = parseAsset(params.inputAsset);
  const paramsOutputAsset = parseAsset(params.outputAsset);
  const paramsAmountIn = positiveUint256(params.amountIn);
  if (
    !assetsEqual(paramsInputAsset, inputAsset) ||
    !assetsEqual(paramsOutputAsset, outputAsset) ||
    paramsAmountIn !== amountIn
  ) {
    return invalidInput();
  }

  return freezeOwned({
    chainId: 143 as const,
    candidateProtocols,
    allowedProtocols,
    quoteInput: {
      method,
      account,
      params: {
        ...params,
        inputAsset: paramsInputAsset,
        outputAsset: paramsOutputAsset,
        amountIn: paramsAmountIn,
      },
    },
    inputAsset,
    outputAsset,
    amountIn,
  });
}

export function quoteTiming(): QuoteTimingV0_1 {
  const nodeProcess = (
    globalThis as unknown as {
      process: { hrtime: { bigint(): bigint } };
    }
  ).process;
  return Object.freeze({
    observedAt: new Date(Date.now()).toISOString(),
    monotonicNs: nodeProcess.hrtime.bigint().toString(10),
    clock: "NODE_PROCESS_HRTIME_V0_1",
  });
}

export function safeSourceErrorCode(
  error: unknown,
): MossAdapterErrorCode | null {
  try {
    return error instanceof MossAdapterError ? error.code : null;
  } catch {
    return null;
  }
}

function malformed(
  protocolId: QuoteCandidateOutcomeV0_1["protocolId"],
  source: RawQuote,
  acquiredTiming: QuoteTimingV0_1,
  raw?: RawQuoteRetentionV0_1,
): QuoteCandidateOutcomeV0_1 {
  return Object.freeze({
    status: "INELIGIBLE",
    protocolId,
    acquiredTiming,
    raw: raw ?? Object.freeze({ status: "UNSNAPSHOTTABLE", source }),
    failure: Object.freeze({ code: "MALFORMED_QUOTE" }),
  });
}

function parseRawProjection(
  value: unknown,
): QuoteRawProjectionV0_1 | undefined {
  try {
    if (!isPlainRecord(value)) {
      return undefined;
    }
    const chainId = value.chainId;
    const inputAsset = AssetSchema.safeParse(value.inputAsset);
    const outputAsset = AssetSchema.safeParse(value.outputAsset);
    const amountIn = PositiveAmountSchema.safeParse(value.amountIn);
    const amountOut = PositiveAmountSchema.safeParse(value.amountOut);
    const blockWindow = value.observableBlockWindow;
    if (
      chainId !== 143 ||
      !inputAsset.success ||
      !outputAsset.success ||
      !amountIn.success ||
      !amountOut.success ||
      BigInt(amountIn.data) > UINT256_MAX ||
      BigInt(amountOut.data) > UINT256_MAX ||
      !isPlainRecord(blockWindow)
    ) {
      return undefined;
    }
    const fromBlock = UnsignedAmountSchema.safeParse(blockWindow.fromBlock);
    const toBlock = UnsignedAmountSchema.safeParse(blockWindow.toBlock);
    if (
      !fromBlock.success ||
      !toBlock.success ||
      BigInt(fromBlock.data) > BigInt(toBlock.data)
    ) {
      return undefined;
    }
    return freezeOwned({
      chainId: 143 as const,
      inputAsset: inputAsset.data,
      outputAsset: outputAsset.data,
      amountIn: amountIn.data,
      amountOut: amountOut.data,
      observableBlockWindow: {
        fromBlock: fromBlock.data,
        toBlock: toBlock.data,
      },
    });
  } catch {
    return undefined;
  }
}

function sourceContext(
  quote: RawQuote,
  protocolId: string,
  method: string,
): NormalizedQuoteV0_1["mossSource"] | undefined {
  try {
    if (
      quote.operation.chainId !== 143 ||
      quote.operation.protocolId !== protocolId ||
      quote.operation.method !== method
    ) {
      return undefined;
    }
    const source = quote.mossOriginal.source;
    const buildInfo = source.buildInfo;
    if (
      (source.provenance !== "PINNED_SUBMODULE" &&
        source.provenance !== "SYNTHETIC_FAKE") ||
      typeof buildInfo.upstreamCommit !== "string" ||
      !COMMIT.test(buildInfo.upstreamCommit) ||
      (buildInfo.integrationCommit !== undefined &&
        (typeof buildInfo.integrationCommit !== "string" ||
          !COMMIT.test(buildInfo.integrationCommit))) ||
      (buildInfo.patchsetDigest !== undefined &&
        (typeof buildInfo.patchsetDigest !== "string" ||
          !SHA256.test(buildInfo.patchsetDigest)))
    ) {
      return undefined;
    }
    return Object.freeze({
      provenance: source.provenance,
      upstreamCommit: buildInfo.upstreamCommit,
      integrationCommit: buildInfo.integrationCommit ?? null,
      patchsetDigest: buildInfo.patchsetDigest ?? null,
    });
  } catch {
    return undefined;
  }
}

export function classifyAcquiredQuote(
  protocolId: QuoteCandidateOutcomeV0_1["protocolId"],
  quote: RawQuote,
  request: QuoteCollectionRequestV0_1,
  catalog: AssetCatalogSnapshotV0_1,
  inputEntry: KnownCatalogEntry,
  outputEntry: KnownCatalogEntry,
): QuoteCandidateOutcomeV0_1 {
  const acquiredTiming = quoteTiming();
  let snapshot: JsonValue;
  try {
    const rawValue = quote.mossOriginal.value;
    snapshot = structuredClone(rawValue);
    if (!isJsonValue(snapshot)) {
      return malformed(protocolId, quote, acquiredTiming);
    }
    freezeOwned(snapshot);
  } catch {
    return malformed(protocolId, quote, acquiredTiming);
  }

  const raw = Object.freeze({
    status: "SNAPSHOTTED" as const,
    source: quote,
    snapshot,
  });
  const projection = parseRawProjection(snapshot);
  const mossSource = sourceContext(
    quote,
    protocolId,
    request.quoteInput.method,
  );
  if (projection === undefined || mossSource === undefined) {
    return malformed(protocolId, quote, acquiredTiming, raw);
  }
  if (
    !assetsEqual(projection.inputAsset, request.inputAsset) ||
    !assetsEqual(projection.outputAsset, request.outputAsset)
  ) {
    return Object.freeze({
      status: "INELIGIBLE",
      protocolId,
      acquiredTiming,
      raw,
      failure: Object.freeze({ code: "ASSET_DIRECTION_MISMATCH" }),
    });
  }
  if (projection.amountIn !== request.amountIn) {
    return Object.freeze({
      status: "INELIGIBLE",
      protocolId,
      acquiredTiming,
      raw,
      failure: Object.freeze({ code: "AMOUNT_BASIS_MISMATCH" }),
    });
  }

  const normalized = freezeOwned({
    chainId: 143 as const,
    protocolId,
    method: request.quoteInput.method,
    account: request.quoteInput.account,
    inputAsset: request.inputAsset,
    outputAsset: request.outputAsset,
    inputAmount: request.amountIn,
    outputAmount: projection.amountOut,
    normalizedAmountOut: projection.amountOut,
    inputDecimals: inputEntry.decimals.value,
    outputDecimals: outputEntry.decimals.value,
    catalog: {
      catalogId: catalog.catalogId,
      sourceVersion: catalog.sourceVersion,
      provenance: catalog.provenance,
      sourceReference: catalog.sourceReference,
      digest: catalog.digest,
    },
    observableBlockWindow: projection.observableBlockWindow,
    mossSource,
  } satisfies NormalizedQuoteV0_1);

  return Object.freeze({
    status: "ELIGIBLE",
    protocolId,
    acquiredTiming,
    raw,
    normalized,
  });
}

export function createSelectedQuoteDigest(
  outcome: EligibleOutcome,
): SelectedQuoteDigestV0_1 {
  const normalized = outcome.normalized;
  const payload = freezeOwned({
    schemaVersion: "moss-mini-demo/selected-quote-digest/0.1",
    chainId: normalized.chainId,
    protocolId: normalized.protocolId,
    method: normalized.method,
    account: normalized.account,
    inputAsset: normalized.inputAsset,
    outputAsset: normalized.outputAsset,
    inputAmount: normalized.inputAmount,
    outputAmount: normalized.outputAmount,
    catalog: normalized.catalog,
    inputDecimals: normalized.inputDecimals,
    outputDecimals: normalized.outputDecimals,
    observableBlockWindow: normalized.observableBlockWindow,
    mossSource: normalized.mossSource,
    rawQuote: outcome.raw.snapshot,
  } satisfies Record<string, JsonValue>);
  const canonical = canonicalize(payload);
  if (canonical === undefined) {
    throw new MossAdapterError("SOURCE_CONTRACT_VIOLATION", "quote");
  }
  return Object.freeze({
    algorithm: "RFC8785-SHA256",
    value: sha256CanonicalText(canonical),
    payload,
  });
}

export type QuotePort = Pick<MossPort, "quote">;
