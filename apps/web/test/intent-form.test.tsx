import { describe, expect, it } from "vitest";
import {
  type IntentDraft,
  validateIntentDraft,
} from "../src/client/intent-form";
import { createFixtureRequest } from "../src/client/run-controls";

const VALID_DRAFT: IntentDraft = {
  account: "0x47833B74E85e2847125e5c3F20B59f6eD063985A",
  outputAddress: "0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC",
  inputAmount: "1000000000000000",
  maxSlippageBps: "50",
  allowedProtocols: ["pancakeswap-v2"],
  recipient: "0xD468b6928b92D983F6C6CB9382B438E13D999e3d",
};

function errorsFor(patch: Partial<IntentDraft>) {
  const result = validateIntentDraft({ ...VALID_DRAFT, ...patch });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected invalid intent draft");
  return result.errors;
}

describe("intent form contract", () => {
  it("builds a strict LIVE request without converting the amount through float", () => {
    const result = validateIntentDraft(VALID_DRAFT);
    expect(result.ok).toBe(true);
    if (!result.ok || result.request.mode !== "LIVE") {
      throw new Error("Expected LIVE request");
    }
    expect(result.request.intent).toEqual({
      account: VALID_DRAFT.account,
      inputAsset: { kind: "NATIVE" },
      outputAsset: { kind: "ERC20", address: VALID_DRAFT.outputAddress },
      inputAmount: "1000000000000000",
      maxSlippageBps: 50,
      allowedProtocols: ["pancakeswap-v2"],
      recipient: VALID_DRAFT.recipient,
    });
  });

  it("reports address failures on the specific account, output and recipient fields", () => {
    expect(
      errorsFor({ account: VALID_DRAFT.account.toLowerCase() }),
    ).toHaveProperty("account");
    expect(errorsFor({ outputAddress: "0x1234" })).toHaveProperty(
      "outputAddress",
    );
    expect(
      errorsFor({ recipient: "0x0000000000000000000000000000000000000000" }),
    ).toHaveProperty("recipient");
  });

  it.each(["0", "1.1", "01", "1e3", "-1"])(
    "rejects non-contract amount %s",
    (inputAmount) => {
      expect(errorsFor({ inputAmount })).toHaveProperty("inputAmount");
    },
  );

  it.each(["-1", "1.5", "01", "10001"])(
    "rejects out-of-contract slippage %s",
    (maxSlippageBps) => {
      expect(errorsFor({ maxSlippageBps })).toHaveProperty("maxSlippageBps");
    },
  );

  it("requires the listed protocol allowlist", () => {
    expect(errorsFor({ allowedProtocols: [] })).toHaveProperty(
      "allowedProtocols",
    );
    expect(
      errorsFor({ allowedProtocols: ["unlisted-protocol"] }),
    ).toHaveProperty("allowedProtocols");
  });

  it("creates only explicitly offered fixture requests", () => {
    expect(createFixtureRequest("manual-review-success")).toEqual({
      contractVersion: "0.1",
      mode: "FIXTURE",
      scenario: "manual-review-success",
    });
    expect(createFixtureRequest("amount-in-mismatch")).toEqual({
      contractVersion: "0.1",
      mode: "FIXTURE",
      scenario: "amount-in-mismatch",
    });
    expect(createFixtureRequest("token-out-mismatch")).toBeUndefined();
    expect(
      createFixtureRequest({
        scenario: "manual-review-success",
        mutation: { inputAmount: "2" },
      }),
    ).toBeUndefined();
  });
});
