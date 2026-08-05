import "server-only";

import { MAX_PREFLIGHT_REQUEST_BYTES } from "../contracts/preflight";

const JSON_CONTENT_TYPE =
  /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i;

export class InvalidJsonError extends Error {}
export class RequestTooLargeError extends Error {}

export function acceptsJsonContentType(value: string | null): boolean {
  return value !== null && JSON_CONTENT_TYPE.test(value);
}

export function declaredBodyIsTooLarge(request: Request): boolean {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength === null || !/^[0-9]+$/.test(declaredLength)) {
    return false;
  }
  return BigInt(declaredLength) > BigInt(MAX_PREFLIGHT_REQUEST_BYTES);
}

export async function readBoundedJsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (reader === undefined) {
    throw new InvalidJsonError();
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PREFLIGHT_REQUEST_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes);
  } catch {
    throw new InvalidJsonError();
  }
  if (text.trim().length === 0) {
    throw new InvalidJsonError();
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function createJsonResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
