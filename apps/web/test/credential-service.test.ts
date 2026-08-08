import { verifyClear402CredentialV0_1 } from "@moss-mini-demo/clear402-profile";
import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import manualReviewReport from "../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import { isClear402Enabled } from "../src/server/clear402-config";
import {
  OfflineCredentialService,
  resolveCredentialService,
} from "../src/server/credential-service";

vi.mock("server-only", () => ({}));

describe("Clear402 optional credential service", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["true", true],
  ])("treats CLEAR402_ENABLED=%s as enabled=%s", (value, expected) => {
    const environment = value === undefined ? {} : { CLEAR402_ENABLED: value };
    expect(isClear402Enabled(environment)).toBe(expected);
    expect(resolveCredentialService(environment) !== undefined).toBe(expected);
  });

  it("generates a valid credential from a parsed report without mutation or network", () => {
    const fetchProbe = vi.fn(() => {
      throw new Error("network access is forbidden");
    });
    vi.stubGlobal("fetch", fetchProbe);
    const report = PreflightReportSchema.parse(manualReviewReport);
    const before = structuredClone(report);

    const credential = new OfflineCredentialService().generate(report);

    expect(verifyClear402CredentialV0_1(credential)).toMatchObject({
      valid: true,
      integrity: "VALID",
    });
    expect(credential.report).toEqual(report);
    expect(report).toEqual(before);
    expect(fetchProbe).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rejects a report before constructing a credential", () => {
    const report = {
      ...PreflightReportSchema.parse(manualReviewReport),
      schemaVersion: "0.2",
    };
    expect(() =>
      new OfflineCredentialService().generate(
        report as Parameters<OfflineCredentialService["generate"]>[0],
      ),
    ).toThrow();
  });
});
