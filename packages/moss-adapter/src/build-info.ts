import type { MossBuildInfo } from "./types.js";

const MOSS_PACKAGES = Object.freeze({
  "@themoss/core": "0.1.0",
  "@themoss/simulator": "0.1.0",
  "@themoss/protocol-kuru": "0.1.0",
  "@themoss/protocol-pancakeswap": "0.1.0",
});

export const MOSS_BUILD_INFO = Object.freeze({
  sourceMode: "INTEGRATION_FORK",
  upstreamRepository: "https://github.com/nishuzumi/moss",
  upstreamCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
  integrationRepository: "https://github.com/Moss-Mini-Demo/moss",
  integrationCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
  patchsetDigest:
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  packages: MOSS_PACKAGES,
  officialRelease: false,
} as const satisfies MossBuildInfo);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  return (
    Object.keys(value).sort().join("\0") === [...expectedKeys].sort().join("\0")
  );
}

export function matchesMossBuildInfo(value: unknown): value is MossBuildInfo {
  const packages = isRecord(value) ? value.packages : undefined;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "sourceMode",
      "upstreamRepository",
      "upstreamCommit",
      "integrationRepository",
      "integrationCommit",
      "patchsetDigest",
      "packages",
      "officialRelease",
    ]) ||
    !isRecord(packages) ||
    !hasExactKeys(packages, Object.keys(MOSS_PACKAGES))
  ) {
    return false;
  }

  return (
    value.sourceMode === MOSS_BUILD_INFO.sourceMode &&
    value.upstreamRepository === MOSS_BUILD_INFO.upstreamRepository &&
    value.upstreamCommit === MOSS_BUILD_INFO.upstreamCommit &&
    value.integrationRepository === MOSS_BUILD_INFO.integrationRepository &&
    value.integrationCommit === MOSS_BUILD_INFO.integrationCommit &&
    value.patchsetDigest === MOSS_BUILD_INFO.patchsetDigest &&
    value.officialRelease === MOSS_BUILD_INFO.officialRelease &&
    Object.entries(MOSS_PACKAGES).every(
      ([name, version]) => packages[name] === version,
    )
  );
}
