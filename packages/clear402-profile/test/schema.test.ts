import { describe, expect, it } from "vitest";
import { Clear402MonadActionCredentialV0_1Schema } from "../src/index.js";
import { credentialFixture, type JsonObject } from "./fixtures.js";

const packageManifestTexts = (
  import.meta as unknown as {
    glob(
      pattern: string[],
      options: { eager: true; query: "?raw"; import: "default" },
    ): Record<string, string>;
  }
).glob(
  [
    "../package.json",
    "../../report-schema/package.json",
    "../../decision-engine/package.json",
    "../../moss-adapter/package.json",
    "../../preflight-core/package.json",
  ],
  { query: "?raw", import: "default", eager: true },
);

function parseManifest(path: string): {
  dependencies?: Record<string, string>;
} {
  const manifest = packageManifestTexts[path];
  if (manifest === undefined) {
    throw new Error(`package manifest was not loaded: ${path}`);
  }
  return JSON.parse(manifest) as {
    dependencies?: Record<string, string>;
  };
}

describe("Clear402 Monad Action Credential v0.1 schema", () => {
  it("accepts only the exact strict envelope", () => {
    const credential = credentialFixture();

    expect(Clear402MonadActionCredentialV0_1Schema.parse(credential)).toEqual(
      credential,
    );
  });

  it.each([
    ["top-level", (value: JsonObject) => ({ ...value, extension: true })],
    [
      "integrity",
      (value: JsonObject) => ({
        ...value,
        integrity: { ...(value.integrity as JsonObject), extension: true },
      }),
    ],
    [
      "assurance",
      (value: JsonObject) => ({
        ...value,
        assurance: { ...(value.assurance as JsonObject), extension: true },
      }),
    ],
    [
      "report",
      (value: JsonObject) => ({
        ...value,
        report: { ...(value.report as JsonObject), credential: true },
      }),
    ],
  ])("rejects an unknown %s field", (_name, mutate) => {
    expect(
      Clear402MonadActionCredentialV0_1Schema.safeParse(
        mutate(credentialFixture()),
      ).success,
    ).toBe(false);
  });

  it.each([
    ["credentialVersion", "0.2"],
    ["credentialType", "clear402.monad-action.other"],
    ["profile", "clear402.monad-action.v0.2"],
  ])("rejects the wrong %s discriminator", (field, value) => {
    expect(
      Clear402MonadActionCredentialV0_1Schema.safeParse({
        ...credentialFixture(),
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["canonicalization", "JSON.stringify"],
    ["digestAlgorithm", "SHA-256"],
  ])("rejects the wrong integrity %s", (field, value) => {
    const credential = credentialFixture();
    expect(
      Clear402MonadActionCredentialV0_1Schema.safeParse({
        ...credential,
        integrity: {
          ...(credential.integrity as JsonObject),
          [field]: value,
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    "sha256:",
    `sha256:${"0".repeat(63)}`,
    `sha256:${"0".repeat(65)}`,
    `sha256:${"A".repeat(64)}`,
    `SHA256:${"0".repeat(64)}`,
    "not-a-digest",
  ])("rejects malformed report digest %s", (reportDigest) => {
    const credential = credentialFixture();
    expect(
      Clear402MonadActionCredentialV0_1Schema.safeParse({
        ...credential,
        integrity: {
          ...(credential.integrity as JsonObject),
          reportDigest,
        },
      }).success,
    ).toBe(false);
  });

  it("requires the exact unsigned assurance limitation", () => {
    const credential = credentialFixture();
    const assurance = credential.assurance as JsonObject;

    for (const invalidAssurance of [
      { ...assurance, kind: "SIGNED_EVIDENCE" },
      { ...assurance, statement: "Integrity valid and safe." },
    ]) {
      expect(
        Clear402MonadActionCredentialV0_1Schema.safeParse({
          ...credential,
          assurance: invalidAssurance,
        }).success,
      ).toBe(false);
    }
  });

  it("validates the enclosed report at the first package boundary", () => {
    const credential = credentialFixture();
    const report = credential.report as JsonObject;

    expect(
      Clear402MonadActionCredentialV0_1Schema.safeParse({
        ...credential,
        report: { ...report, schemaVersion: "0.2" },
      }).success,
    ).toBe(false);

    const { decision: _decision, ...incompleteReport } = report;
    expect(
      Clear402MonadActionCredentialV0_1Schema.safeParse({
        ...credential,
        report: incompleteReport,
      }).success,
    ).toBe(false);
  });

  it("does not modify the supplied report object", () => {
    const credential = credentialFixture();
    const original = structuredClone(credential);

    const parsed = Clear402MonadActionCredentialV0_1Schema.parse(credential);

    expect(credential).toEqual(original);
    expect(parsed.report).toEqual(original.report);
  });

  it("keeps the package dependency boundary report-only and offline", () => {
    expect(parseManifest("../package.json").dependencies).toEqual({
      "@moss-mini-demo/report-schema": "workspace:*",
      "@noble/hashes": "2.2.0",
      canonicalize: "3.0.0",
      zod: "4.4.3",
    });

    for (const manifestPath of [
      "../../report-schema/package.json",
      "../../decision-engine/package.json",
      "../../moss-adapter/package.json",
      "../../preflight-core/package.json",
    ]) {
      expect(parseManifest(manifestPath).dependencies).not.toHaveProperty(
        "@moss-mini-demo/clear402-profile",
      );
    }
  });
});
