import { describe, expect, it, vi } from "vitest";
import {
  CLEAR402_ASSURANCE_STATEMENT_V0_1,
  verifyClear402CredentialV0_1,
} from "../src/index.js";
import {
  reportFixture,
  type JsonObject,
  validCredentialFixture,
} from "./fixtures.js";

describe("Clear402 offline credential verifier", () => {
  it("verifies exact unsigned integrity evidence", () => {
    const credential = validCredentialFixture();
    const result = verifyClear402CredentialV0_1(credential);

    expect(result).toEqual({
      valid: true,
      integrity: "VALID",
      credential,
    });
    expect(credential.report).toEqual(reportFixture());
    expect(credential.assurance.statement).toBe(
      CLEAR402_ASSURANCE_STATEMENT_V0_1,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /"(safe|authenticated|signed|authorized)"\s*:/i,
    );
  });

  it.each([
    [
      "generatedAt",
      (report: JsonObject) => ({
        ...report,
        generatedAt: "2031-03-04T05:06:08.000Z",
      }),
    ],
    [
      "limitation",
      (report: JsonObject) => ({
        ...report,
        limitations: [
          {
            ...((report.limitations as JsonObject[])[0] as JsonObject),
            description: "A different but schema-valid limitation.",
          },
        ],
      }),
    ],
  ])(
    "returns DIGEST_INVALID for schema-valid %s tampering",
    (_name, tamper) => {
      const credential = validCredentialFixture();
      const tampered = {
        ...credential,
        report: tamper(credential.report as JsonObject),
      };

      expect(verifyClear402CredentialV0_1(tampered)).toEqual({
        valid: false,
        integrity: "INVALID",
        error: { code: "DIGEST_INVALID" },
      });
    },
  );

  it("returns DIGEST_INVALID for stored digest tampering", () => {
    const credential = validCredentialFixture();
    const tampered = {
      ...credential,
      integrity: {
        ...credential.integrity,
        reportDigest: `sha256:${"0".repeat(64)}`,
      },
    };

    expect(verifyClear402CredentialV0_1(tampered)).toEqual({
      valid: false,
      integrity: "INVALID",
      error: { code: "DIGEST_INVALID" },
    });
  });

  it.each([
    [
      "amount",
      (report: JsonObject) => ({
        ...report,
        intent: {
          ...(report.intent as JsonObject),
          inputAmount: "1000000000000001",
        },
      }),
    ],
    [
      "decision",
      (report: JsonObject) => ({
        ...report,
        decision: {
          status: "STOP",
          reasons: [
            {
              code: "NO_VALID_SELECTION",
              sourceReferences: ["/selection/status"],
            },
          ],
        },
      }),
    ],
  ])("rejects %s tampering", (_name, tamper) => {
    const credential = validCredentialFixture();
    const tampered = {
      ...credential,
      report: tamper(credential.report as JsonObject),
    };

    expect(verifyClear402CredentialV0_1(tampered)).toMatchObject({
      valid: false,
      integrity: "INVALID",
    });
  });

  it.each([
    [
      "version",
      (value: JsonObject) => ({
        ...value,
        credentialVersion: "0.2",
      }),
    ],
    [
      "type",
      (value: JsonObject) => ({
        ...value,
        credentialType: "clear402.monad-action.other",
      }),
    ],
    ["unknown field", (value: JsonObject) => ({ ...value, signed: true })],
    [
      "report",
      (value: JsonObject) => ({
        ...value,
        report: { ...(value.report as JsonObject), schemaVersion: "0.2" },
      }),
    ],
  ])("returns SCHEMA_INVALID for an invalid %s", (_name, tamper) => {
    const credential = validCredentialFixture();

    expect(
      verifyClear402CredentialV0_1(tamper(credential as JsonObject)),
    ).toEqual({
      valid: false,
      integrity: "INVALID",
      error: { code: "SCHEMA_INVALID" },
    });
  });

  it("does not mutate inputs or make a network call", () => {
    const fetchProbe = vi.fn(() => {
      throw new Error("network access is forbidden");
    });
    vi.stubGlobal("fetch", fetchProbe);
    const report = reportFixture();
    const reportBefore = structuredClone(report);
    const credential = validCredentialFixture(report);
    const credentialBefore = structuredClone(credential);

    expect(verifyClear402CredentialV0_1(credential).valid).toBe(true);
    expect(report).toEqual(reportBefore);
    expect(credential).toEqual(credentialBefore);
    expect(fetchProbe).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("converts hostile parser failures into SCHEMA_INVALID", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("hostile input");
        },
      },
    );

    expect(verifyClear402CredentialV0_1(hostile)).toEqual({
      valid: false,
      integrity: "INVALID",
      error: { code: "SCHEMA_INVALID" },
    });
  });
});
