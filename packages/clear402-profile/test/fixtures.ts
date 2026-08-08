import {
  CLEAR402_ASSURANCE_KIND_V0_1,
  CLEAR402_ASSURANCE_STATEMENT_V0_1,
  CLEAR402_CREDENTIAL_TYPE_V0_1,
  CLEAR402_CREDENTIAL_VERSION_V0_1,
  CLEAR402_PROFILE_V0_1,
  type Clear402MonadActionCredentialV0_1,
  Clear402MonadActionCredentialV0_1Schema,
  digestClear402ReportV0_1,
} from "../src/index.js";

const reportFixtureTexts = (
  import.meta as unknown as {
    glob(
      pattern: string,
      options: { eager: true; query: "?raw"; import: "default" },
    ): Record<string, string>;
  }
).glob("../../report-schema/fixtures/manual-review-success.v0.1.json", {
  query: "?raw",
  import: "default",
  eager: true,
});
const reportFixtureText =
  reportFixtureTexts[
    "../../report-schema/fixtures/manual-review-success.v0.1.json"
  ];
if (reportFixtureText === undefined) {
  throw new Error("manual-review report fixture was not loaded");
}

export type JsonObject = Record<string, unknown>;

export function reportFixture(): JsonObject {
  return JSON.parse(reportFixtureText) as JsonObject;
}

export function credentialFixture(): JsonObject {
  return {
    credentialVersion: CLEAR402_CREDENTIAL_VERSION_V0_1,
    credentialType: CLEAR402_CREDENTIAL_TYPE_V0_1,
    profile: CLEAR402_PROFILE_V0_1,
    report: reportFixture(),
    integrity: {
      canonicalization: "RFC8785",
      digestAlgorithm: "sha256",
      reportDigest: `sha256:${"0".repeat(64)}`,
    },
    assurance: {
      kind: CLEAR402_ASSURANCE_KIND_V0_1,
      statement: CLEAR402_ASSURANCE_STATEMENT_V0_1,
    },
  };
}

export function validCredentialFixture(
  report: JsonObject = reportFixture(),
): Clear402MonadActionCredentialV0_1 {
  const credential = credentialFixture();
  return Clear402MonadActionCredentialV0_1Schema.parse({
    ...credential,
    report,
    integrity: {
      ...(credential.integrity as JsonObject),
      reportDigest: digestClear402ReportV0_1(report),
    },
  });
}
