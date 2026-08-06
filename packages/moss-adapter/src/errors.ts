export type MossAdapterErrorCode =
  | "INVALID_INPUT"
  | "CHAIN_ID_MISMATCH"
  | "SOURCE_CONTRACT_VIOLATION"
  | "UNSUPPORTED_PROTOCOL"
  | "UNSUPPORTED_METHOD"
  | "DESCRIBE_FAILED"
  | "QUOTE_FAILED"
  | "ACTION_FAILED"
  | "SIMULATION_FAILED";

export type MossAdapterOperation =
  | "describe"
  | "quote"
  | "action"
  | "simulate"
  | "buildInfo";

const ERROR_MESSAGES = {
  INVALID_INPUT: "Moss adapter input is invalid",
  CHAIN_ID_MISMATCH: "Moss adapter requires chain id 143",
  SOURCE_CONTRACT_VIOLATION: "Moss source contract is invalid",
  UNSUPPORTED_PROTOCOL: "Moss protocol is unsupported",
  UNSUPPORTED_METHOD: "Moss method is unsupported",
  DESCRIBE_FAILED: "Moss describe operation failed",
  QUOTE_FAILED: "Moss quote operation failed",
  ACTION_FAILED: "Moss action operation failed",
  SIMULATION_FAILED: "Moss simulation operation failed",
} as const satisfies Record<MossAdapterErrorCode, string>;

const SAFE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;

type SafeErrorContext = Readonly<{
  protocolId?: unknown;
  method?: unknown;
}>;

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_IDENTIFIER.test(value)
    ? value
    : undefined;
}

export class MossAdapterError extends Error {
  readonly code: MossAdapterErrorCode;
  readonly operation: MossAdapterOperation;
  readonly retryable: boolean;
  readonly protocolId?: string;
  readonly method?: string;

  constructor(
    code: MossAdapterErrorCode,
    operation: MossAdapterOperation,
    context: SafeErrorContext = {},
  ) {
    super(ERROR_MESSAGES[code]);
    Object.defineProperty(this, "name", { value: "MossAdapterError" });
    this.code = code;
    this.operation = operation;
    this.retryable = false;

    const protocolId = safeIdentifier(context.protocolId);
    const method = safeIdentifier(context.method);
    if (protocolId !== undefined) {
      this.protocolId = protocolId;
    }
    if (method !== undefined) {
      this.method = method;
    }
  }

  toJSON(): Readonly<Record<string, boolean | string>> {
    return {
      name: this.name,
      code: this.code,
      operation: this.operation,
      retryable: this.retryable,
      ...(this.protocolId === undefined ? {} : { protocolId: this.protocolId }),
      ...(this.method === undefined ? {} : { method: this.method }),
      message: this.message,
    };
  }
}
