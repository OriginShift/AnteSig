import { describe, expect, it } from "vitest";
import {
  canonicalizeClear402ReportV0_1,
  clear402ReportProtectedBytesV0_1,
  digestClear402ReportV0_1,
} from "../src/index.js";
import { reportFixture, type JsonObject } from "./fixtures.js";

describe("Clear402 RFC 8785 protected report bytes", () => {
  it("matches the frozen report canonicalization and SHA-256 vector", () => {
    const report = reportFixture();
    const canonical = canonicalizeClear402ReportV0_1(report);
    const bytes = clear402ReportProtectedBytesV0_1(report);

    expect(new TextDecoder().decode(bytes)).toBe(canonical);
    expect(bytes).toEqual(new TextEncoder().encode(canonical));
    expect(canonical.startsWith('{"alignment":')).toBe(true);
    expect(canonical).toContain(
      '"capability":{"availability":"AVAILABLE","raw":{"capabilityEvidence":"not-a-moss-capability","origin":"synthetic-development-fixture"}}',
    );
    expect(canonical).toContain(
      '"reportId":"77777777-7777-4777-8777-777777777777","schemaVersion":"0.1","selection":',
    );
    expect(digestClear402ReportV0_1(report)).toBe(
      "sha256:8d0559bc8372167a99dec943ab8f7b60c01dfe1646a0f3cbe64423c34216123e",
    );
  });

  it("uses RFC 8785 number, Unicode, escaping, and property order rules", () => {
    const report = reportFixture();
    report.capability = {
      availability: "AVAILABLE",
      raw: {
        z: "last",
        a: "first",
        "\u00e4": "unicode",
        numbers: JSON.parse(
          "[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001]",
        ) as number[],
        string: "\u20ac$\u000f\nA'B\"\\/",
      },
    };

    const canonical = canonicalizeClear402ReportV0_1(report);

    expect(canonical).toContain(
      '"raw":{"a":"first","numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"\u20ac$\\u000f\\nA\'B\\"\\\\/","z":"last","\u00e4":"unicode"}',
    );
    expect(canonical).not.toContain("\n");
  });

  it("is independent of object insertion order", () => {
    const first = reportFixture();
    const second = Object.fromEntries(
      Object.entries(structuredClone(first)).reverse(),
    );
    const firstCapability = first.capability as JsonObject;
    const secondCapability = second.capability as JsonObject;
    firstCapability.raw = { z: 1, a: 2 };
    secondCapability.raw = { a: 2, z: 1 };

    expect(canonicalizeClear402ReportV0_1(first)).toBe(
      canonicalizeClear402ReportV0_1(second),
    );
    expect(digestClear402ReportV0_1(first)).toBe(
      digestClear402ReportV0_1(second),
    );
  });

  it("validates first and does not mutate the report", () => {
    const report = reportFixture();
    const before = structuredClone(report);

    expect(digestClear402ReportV0_1(report)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(report).toEqual(before);
    expect(() =>
      canonicalizeClear402ReportV0_1({
        ...report,
        schemaVersion: "0.2",
      }),
    ).toThrow();
  });
});
