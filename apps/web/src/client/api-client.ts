import {
  MAX_PREFLIGHT_RESPONSE_BYTES,
  type PreflightRequest,
  type PreflightResponse,
  PreflightResponseSchema,
} from "../contracts/preflight";

export type PreflightClientErrorKind =
  | "ABORTED"
  | "INVALID_RESPONSE"
  | "NETWORK"
  | "TIMEOUT";

export class PreflightClientError extends Error {
  readonly kind: PreflightClientErrorKind;

  constructor(kind: PreflightClientErrorKind, message: string) {
    super(message);
    this.name = "PreflightClientError";
    this.kind = kind;
  }
}

export type PreflightFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type PreflightClientOptions = {
  fetcher?: PreflightFetch;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const INVALID_RESPONSE_MESSAGE =
  "The preflight service returned an invalid response.";

function invalidResponse(): PreflightClientError {
  return new PreflightClientError("INVALID_RESPONSE", INVALID_RESPONSE_MESSAGE);
}

function declaredResponseTooLarge(response: Response): boolean {
  const header = response.headers.get("content-length");
  if (header === null) return false;
  const length = Number(header);
  return Number.isFinite(length) && length > MAX_PREFLIGHT_RESPONSE_BYTES;
}

export async function requestPreflight(
  request: PreflightRequest,
  options: PreflightClientOptions = {},
): Promise<PreflightResponse> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutController = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetcher("/api/preflight", {
      body: JSON.stringify(request),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });

    if (
      declaredResponseTooLarge(response) ||
      !response.headers.get("content-type")?.includes("application/json")
    ) {
      throw invalidResponse();
    }

    const text = await response.text();
    if (
      new TextEncoder().encode(text).byteLength > MAX_PREFLIGHT_RESPONSE_BYTES
    ) {
      throw invalidResponse();
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw invalidResponse();
    }

    const parsed = PreflightResponseSchema.safeParse(json);
    if (!parsed.success || response.ok !== parsed.data.ok) {
      throw invalidResponse();
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof PreflightClientError) throw error;
    if (options.signal?.aborted) {
      throw new PreflightClientError(
        "ABORTED",
        "The preflight request was cancelled.",
      );
    }
    if (timeoutController.signal.aborted) {
      throw new PreflightClientError(
        "TIMEOUT",
        "The preflight request timed out.",
      );
    }
    throw new PreflightClientError(
      "NETWORK",
      "The preflight service could not be reached.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
