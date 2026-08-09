import {
  CLEAR402_ASSURANCE_KIND_V0_1,
  CLEAR402_ASSURANCE_STATEMENT_V0_1,
  CLEAR402_CREDENTIAL_TYPE_V0_1,
  CLEAR402_CREDENTIAL_VERSION_V0_1,
  CLEAR402_PROFILE_V0_1,
  type Clear402MonadActionCredentialV0_1,
  Clear402MonadActionCredentialV0_1Schema,
  digestClear402ReportV0_1,
  verifyClear402CredentialV0_1,
} from "@moss-mini-demo/clear402-profile";
import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import manualReviewReport from "../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import {
  credentialCopy,
  credentialExport,
  credentialVerificationLabel,
  tamperProtectedReportCopy,
} from "../src/client/credential-actions";
import { requestCredentialVerification } from "../src/client/verify-client";

function credential(): Clear402MonadActionCredentialV0_1 {
  const report = PreflightReportSchema.parse(manualReviewReport);
  return Clear402MonadActionCredentialV0_1Schema.parse({
    credentialVersion: CLEAR402_CREDENTIAL_VERSION_V0_1,
    credentialType: CLEAR402_CREDENTIAL_TYPE_V0_1,
    profile: CLEAR402_PROFILE_V0_1,
    report,
    integrity: {
      canonicalization: "RFC8785",
      digestAlgorithm: "sha256",
      reportDigest: digestClear402ReportV0_1(report),
    },
    assurance: {
      kind: CLEAR402_ASSURANCE_KIND_V0_1,
      statement: CLEAR402_ASSURANCE_STATEMENT_V0_1,
    },
  });
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Credential actions", () => {
  it("creates a deterministic versioned export with exact credential data", () => {
    const original = credential();
    const before = structuredClone(original);
    const artifact = credentialExport(original);

    expect(artifact.filename).toBe(
      `antesig-clear402-v0.1-${original.report.reportId}.json`,
    );
    expect(artifact.mediaType).toBe("application/json");
    expect(JSON.parse(artifact.text)).toEqual(original);
    expect(artifact.text.endsWith("\n")).toBe(true);
    expect(original).toEqual(before);
  });

  it("tampers only a deep copy and produces digest INVALID", () => {
    const original = credential();
    const before = structuredClone(original);
    const copy = credentialCopy(original);
    const tampered = tamperProtectedReportCopy(original);

    expect(copy).not.toBe(original);
    expect(copy.report).not.toBe(original.report);
    expect(tampered.report.generatedAt).not.toBe(original.report.generatedAt);
    expect(tampered.integrity.reportDigest).toBe(
      original.integrity.reportDigest,
    );
    expect(verifyClear402CredentialV0_1(tampered)).toEqual({
      valid: false,
      integrity: "INVALID",
      error: { code: "DIGEST_INVALID" },
    });
    expect(original).toEqual(before);
  });

  it("parses structured integrity VALID and digest INVALID responses", async () => {
    const valid = await requestCredentialVerification(credential(), () =>
      Promise.resolve(jsonResponse({ ok: true, integrity: "VALID" })),
    );
    expect(valid).toEqual({ ok: true, integrity: "VALID" });

    const invalid = await requestCredentialVerification(credential(), () =>
      Promise.resolve(
        jsonResponse(
          {
            ok: false,
            integrity: "INVALID",
            error: {
              code: "DIGEST_INVALID",
              message: "Credential digest does not match the protected report.",
            },
          },
          422,
        ),
      ),
    );
    expect(invalid).toMatchObject({
      ok: false,
      integrity: "INVALID",
      error: { code: "DIGEST_INVALID" },
    });
  });

  it("labels integrity, digest and schema verification outcomes distinctly", () => {
    expect(credentialVerificationLabel({ ok: true, integrity: "VALID" })).toBe(
      "Integrity VALID",
    );
    expect(
      credentialVerificationLabel({
        ok: false,
        integrity: "INVALID",
        error: { code: "DIGEST_INVALID", message: "Digest mismatch." },
      }),
    ).toBe("Digest INVALID");
    expect(
      credentialVerificationLabel({
        ok: false,
        integrity: "INVALID",
        error: { code: "SCHEMA_INVALID", message: "Schema mismatch." },
      }),
    ).toBe("Schema INVALID");
  });
});
