import {
  EvmAddressSchema,
  IntentSchema,
  MaxSlippageBpsSchema,
  PositiveAmountSchema,
} from "@moss-mini-demo/report-schema";
import type { PreflightRequest } from "../contracts/preflight";

export const LIVE_PROTOCOLS = [
  { id: "pancakeswap-v2", label: "PancakeSwap v2" },
] as const;

export type IntentDraft = Readonly<{
  account: string;
  outputAddress: string;
  inputAmount: string;
  maxSlippageBps: string;
  allowedProtocols: readonly string[];
  recipient: string;
}>;

export type IntentField = keyof IntentDraft;
export type IntentErrors = Partial<Record<IntentField, string>>;

export const EMPTY_INTENT_DRAFT: IntentDraft = {
  account: "",
  outputAddress: "",
  inputAmount: "",
  maxSlippageBps: "50",
  allowedProtocols: [LIVE_PROTOCOLS[0].id],
  recipient: "",
};

export type IntentValidation =
  | Readonly<{ ok: true; request: PreflightRequest }>
  | Readonly<{ ok: false; errors: IntentErrors }>;

const CANONICAL_UNSIGNED_INTEGER = /^(?:0|[1-9][0-9]*)$/;

function addressError(value: string, label: string): string | undefined {
  if (value.length === 0) return `${label} is required.`;
  const parsed = EvmAddressSchema.safeParse(value);
  return parsed.success
    ? undefined
    : (parsed.error.issues[0]?.message ?? "Invalid address.");
}

export function validateIntentDraft(draft: IntentDraft): IntentValidation {
  const errors: IntentErrors = {};
  const accountError = addressError(draft.account, "Account");
  const outputAddressError = addressError(
    draft.outputAddress,
    "Output token address",
  );
  if (accountError) errors.account = accountError;
  if (outputAddressError) errors.outputAddress = outputAddressError;

  if (!PositiveAmountSchema.safeParse(draft.inputAmount).success) {
    errors.inputAmount =
      "Amount must be a positive base-unit integer with no decimal or exponent.";
  }

  if (!CANONICAL_UNSIGNED_INTEGER.test(draft.maxSlippageBps)) {
    errors.maxSlippageBps =
      "Slippage must be an integer from 0 through 10000 basis points.";
  } else if (
    !MaxSlippageBpsSchema.safeParse(Number(draft.maxSlippageBps)).success
  ) {
    errors.maxSlippageBps =
      "Slippage must be an integer from 0 through 10000 basis points.";
  }

  const approvedProtocolIds = new Set<string>(
    LIVE_PROTOCOLS.map((protocol) => protocol.id),
  );
  if (
    draft.allowedProtocols.length === 0 ||
    new Set(draft.allowedProtocols).size !== draft.allowedProtocols.length ||
    draft.allowedProtocols.some(
      (protocol) => !approvedProtocolIds.has(protocol),
    )
  ) {
    errors.allowedProtocols = "Select at least one listed protocol.";
  }

  if (draft.recipient.length > 0) {
    const recipientError = addressError(draft.recipient, "Recipient");
    if (recipientError) errors.recipient = recipientError;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const intent = IntentSchema.safeParse({
    account: draft.account,
    inputAsset: { kind: "NATIVE" },
    outputAsset: { kind: "ERC20", address: draft.outputAddress },
    inputAmount: draft.inputAmount,
    maxSlippageBps: Number(draft.maxSlippageBps),
    allowedProtocols: [...draft.allowedProtocols],
    ...(draft.recipient.length === 0 ? {} : { recipient: draft.recipient }),
  });
  if (!intent.success) {
    return {
      ok: false,
      errors: { account: "Intent does not satisfy the preflight contract." },
    };
  }

  return {
    ok: true,
    request: { contractVersion: "0.1", mode: "LIVE", intent: intent.data },
  };
}
