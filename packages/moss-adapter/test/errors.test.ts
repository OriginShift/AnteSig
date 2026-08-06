import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MossAdapterError, type MossAdapterErrorCode } from "../src/index.js";

const ERROR_CODES = [
  "INVALID_INPUT",
  "CHAIN_ID_MISMATCH",
  "SOURCE_CONTRACT_VIOLATION",
  "UNSUPPORTED_PROTOCOL",
  "UNSUPPORTED_METHOD",
  "DESCRIBE_FAILED",
  "QUOTE_FAILED",
  "ACTION_FAILED",
  "SIMULATION_FAILED",
] as const satisfies readonly MossAdapterErrorCode[];

describe("MossAdapterError", () => {
  it.each(ERROR_CODES)("serializes %s with the closed safe shape", (code) => {
    const error = new MossAdapterError(code, "describe", {
      protocolId: "synthetic-protocol",
      method: "swap",
    });

    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "MossAdapterError",
      code,
      operation: "describe",
      retryable: false,
      protocolId: "synthetic-protocol",
      method: "swap",
      message: error.message,
    });
    expect(error).not.toHaveProperty("cause");
  });

  it("drops unsafe context and never serializes secret-looking input", () => {
    const secret = "PRIVATE_KEY=https://rpc.invalid/?apiKey=synthetic-secret";
    const error = new MossAdapterError("INVALID_INPUT", "action", {
      protocolId: secret,
      method: secret,
    });
    const serialized = JSON.stringify(error);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(error.protocolId).toBeUndefined();
    expect(error.method).toBeUndefined();
  });
});
