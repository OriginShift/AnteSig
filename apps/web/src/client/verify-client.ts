import type { Clear402MonadActionCredentialV0_1 } from "@moss-mini-demo/clear402-profile";
import {
  type Clear402VerifyResponse,
  Clear402VerifyResponseSchema,
} from "../contracts/clear402";

export type CredentialVerifyFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class CredentialVerifyClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialVerifyClientError";
  }
}

const MAX_VERIFY_RESPONSE_BYTES = 16_384;
const INVALID_VERIFY_RESPONSE =
  "The credential verifier returned an invalid response.";

export async function requestCredentialVerification(
  credential: Clear402MonadActionCredentialV0_1,
  fetcher: CredentialVerifyFetch = fetch,
): Promise<Clear402VerifyResponse> {
  try {
    const response = await fetcher("/api/verify", {
      body: JSON.stringify(credential),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new CredentialVerifyClientError(INVALID_VERIFY_RESPONSE);
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_VERIFY_RESPONSE_BYTES) {
      throw new CredentialVerifyClientError(INVALID_VERIFY_RESPONSE);
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new CredentialVerifyClientError(INVALID_VERIFY_RESPONSE);
    }
    const parsed = Clear402VerifyResponseSchema.safeParse(value);
    if (!parsed.success || response.ok !== parsed.data.ok) {
      throw new CredentialVerifyClientError(INVALID_VERIFY_RESPONSE);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof CredentialVerifyClientError) {
      throw error;
    }
    throw new CredentialVerifyClientError(
      "The credential verifier could not be reached.",
    );
  }
}
