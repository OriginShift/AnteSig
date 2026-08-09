import { describe, expect, it, vi } from "vitest";
import {
  MAX_PREFLIGHT_REQUEST_BYTES,
  MAX_PREFLIGHT_RESPONSE_BYTES,
} from "../../apps/web/src/contracts/preflight";
import { MAX_CLEAR402_VERIFY_REQUEST_BYTES } from "../../apps/web/src/contracts/clear402";

vi.mock("server-only", () => ({}));
vi.mock("../../apps/web/node_modules/server-only", () => ({}));

describe("performance release guards", () => {
  it("keeps timeout budgets below the hard-fail thresholds", async () => {
    const { PREFLIGHT_QUOTE_TIMEOUT_MS, PREFLIGHT_TOTAL_TIMEOUT_MS } =
      await import("../../apps/web/src/server/preflight-orchestrator");
    expect(PREFLIGHT_QUOTE_TIMEOUT_MS).toBeLessThanOrEqual(12_000);
    expect(PREFLIGHT_TOTAL_TIMEOUT_MS).toBeLessThanOrEqual(25_000);
  });

  it("keeps request, response, and verification bounds deterministic", () => {
    expect(MAX_PREFLIGHT_REQUEST_BYTES).toBe(65_536);
    expect(MAX_PREFLIGHT_RESPONSE_BYTES).toBe(2_097_152);
    expect(MAX_CLEAR402_VERIFY_REQUEST_BYTES).toBe(2_097_152);
    expect(MAX_PREFLIGHT_RESPONSE_BYTES).toBeLessThanOrEqual(5_000_000);
    expect(MAX_CLEAR402_VERIFY_REQUEST_BYTES).toBeLessThanOrEqual(5_000_000);
  });
});
