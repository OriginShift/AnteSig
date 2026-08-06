import canonicalize from "canonicalize";
import { AssetSchema } from "@moss-mini-demo/report-schema";
import { MossAdapterError } from "./errors.js";
import type {
  AssetCatalogEntryV0_1,
  AssetCatalogSnapshotV0_1,
  AssetCatalogV0_1,
  DecimalsRecordV0_1,
  JsonValue,
  QuoteAssetV0_1,
} from "./types.js";

const CHAIN_ID = 143;
const CATALOG_KEYS = [
  "schemaVersion",
  "catalogId",
  "sourceVersion",
  "provenance",
  "sourceReference",
  "chainId",
  "validFrom",
  "validUntil",
  "entries",
] as const;
const ENTRY_KEYS = ["asset", "decimals"] as const;
const DECIMALS_KNOWN_KEYS = ["status", "value"] as const;
const DECIMALS_UNKNOWN_KEYS = ["status"] as const;
const CATALOG_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SOURCE_VERSION =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const SOURCE_REFERENCE = /^[a-z0-9][a-z0-9._:/@-]{0,127}$/;
const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

type NodeHash = {
  update(value: string, encoding: "utf8"): NodeHash;
  digest(encoding: "hex"): string;
};

type NodeProcess = {
  getBuiltinModule(specifier: "node:crypto"): {
    createHash(algorithm: "sha256"): NodeHash;
  };
};

function keysMatch(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
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

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function invalidCatalog(): never {
  throw new MossAdapterError("INVALID_INPUT", "quote");
}

function compareUtf8(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return leftBytes.length - rightBytes.length;
}

export function assetKey(asset: QuoteAssetV0_1): string {
  return asset.kind === "NATIVE" ? "NATIVE" : `ERC20:${asset.address}`;
}

export function compareAssetKeys(
  left: QuoteAssetV0_1,
  right: QuoteAssetV0_1,
): number {
  return compareUtf8(assetKey(left), assetKey(right));
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function validKnownDecimals(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 255
  );
}

function parseAsset(value: unknown): QuoteAssetV0_1 {
  try {
    const parsed = AssetSchema.safeParse(value);
    if (!parsed.success) {
      return invalidCatalog();
    }
    return parsed.data;
  } catch {
    return invalidCatalog();
  }
}

function parseDecimals(value: unknown): DecimalsRecordV0_1 {
  if (!isPlainRecord(value) || typeof value.status !== "string") {
    return invalidCatalog();
  }
  if (value.status === "UNKNOWN" && keysMatch(value, DECIMALS_UNKNOWN_KEYS)) {
    return Object.freeze({ status: "UNKNOWN" });
  }
  if (
    value.status === "KNOWN" &&
    keysMatch(value, DECIMALS_KNOWN_KEYS) &&
    validKnownDecimals(value.value)
  ) {
    return Object.freeze({ status: "KNOWN", value: value.value });
  }
  return invalidCatalog();
}

function cloneCatalog(value: unknown): Record<string, unknown> {
  try {
    const cloned = structuredClone(value);
    if (!isPlainRecord(cloned) || !isJsonValue(cloned)) {
      return invalidCatalog();
    }
    return cloned;
  } catch {
    return invalidCatalog();
  }
}

function parseCatalogEntry(value: unknown): AssetCatalogEntryV0_1 {
  if (!isPlainRecord(value) || !keysMatch(value, ENTRY_KEYS)) {
    return invalidCatalog();
  }
  const asset = parseAsset(value.asset);
  const decimals = parseDecimals(value.decimals);
  return Object.freeze({ asset, decimals });
}

function catalogPayload(
  catalog: AssetCatalogV0_1,
  entries: readonly AssetCatalogEntryV0_1[],
) {
  return {
    schemaVersion: "moss-mini-demo/asset-catalog/0.1",
    catalogId: catalog.catalogId,
    sourceVersion: catalog.sourceVersion,
    provenance: catalog.provenance,
    sourceReference: catalog.sourceReference,
    chainId: catalog.chainId,
    validFrom: catalog.validFrom,
    validUntil: catalog.validUntil,
    entries,
  } satisfies JsonValue;
}

export function sha256CanonicalText(value: string): `sha256:${string}` {
  const nodeProcess = (globalThis as unknown as { process: NodeProcess })
    .process;
  const hash = nodeProcess
    .getBuiltinModule("node:crypto")
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
  return `sha256:${hash}`;
}

function digestPayload(value: JsonValue): `sha256:${string}` {
  const canonical = canonicalize(value);
  if (canonical === undefined) {
    return invalidCatalog();
  }
  return sha256CanonicalText(canonical);
}

export function createAssetCatalogSnapshot(
  value: unknown,
  now = Date.now(),
): AssetCatalogSnapshotV0_1 {
  const cloned = cloneCatalog(value);
  if (!keysMatch(cloned, CATALOG_KEYS)) {
    return invalidCatalog();
  }
  if (
    cloned.schemaVersion !== "0.1" ||
    typeof cloned.catalogId !== "string" ||
    cloned.catalogId.length < 1 ||
    cloned.catalogId.length > 64 ||
    !CATALOG_ID.test(cloned.catalogId) ||
    typeof cloned.sourceVersion !== "string" ||
    cloned.sourceVersion.length < 5 ||
    cloned.sourceVersion.length > 32 ||
    !SOURCE_VERSION.test(cloned.sourceVersion) ||
    (cloned.provenance !== "SERVER_CONFIGURED" &&
      cloned.provenance !== "SYNTHETIC_TEST") ||
    typeof cloned.sourceReference !== "string" ||
    cloned.sourceReference.length < 1 ||
    cloned.sourceReference.length > 128 ||
    !SOURCE_REFERENCE.test(cloned.sourceReference) ||
    cloned.chainId !== CHAIN_ID ||
    !validTimestamp(cloned.validFrom) ||
    !validTimestamp(cloned.validUntil) ||
    new Date(cloned.validFrom).valueOf() >=
      new Date(cloned.validUntil).valueOf() ||
    new Date(cloned.validFrom).valueOf() > now ||
    now >= new Date(cloned.validUntil).valueOf() ||
    !Array.isArray(cloned.entries) ||
    cloned.entries.length === 0
  ) {
    return invalidCatalog();
  }

  const entries = cloned.entries.map(parseCatalogEntry);
  const identities = new Set(entries.map((entry) => assetKey(entry.asset)));
  if (identities.size !== entries.length) {
    return invalidCatalog();
  }
  const sortedEntries = Object.freeze(
    [...entries].sort((left, right) =>
      compareAssetKeys(left.asset, right.asset),
    ),
  );
  const catalog = {
    schemaVersion: "0.1" as const,
    catalogId: cloned.catalogId,
    sourceVersion: cloned.sourceVersion,
    provenance: cloned.provenance,
    sourceReference: cloned.sourceReference,
    chainId: CHAIN_ID,
    validFrom: cloned.validFrom,
    validUntil: cloned.validUntil,
    entries: sortedEntries,
  } satisfies AssetCatalogV0_1;
  const digest = digestPayload(catalogPayload(catalog, sortedEntries));
  return deepFreeze({ ...catalog, digest });
}

export function findCatalogEntry(
  catalog: AssetCatalogSnapshotV0_1,
  asset: QuoteAssetV0_1,
): AssetCatalogEntryV0_1 | undefined {
  const key = assetKey(asset);
  return catalog.entries.find((entry) => assetKey(entry.asset) === key);
}

export function compareProtocolIds(left: string, right: string): number {
  return compareUtf8(left, right);
}
