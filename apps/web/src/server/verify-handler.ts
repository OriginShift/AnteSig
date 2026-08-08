import "server-only";

import {
  type Clear402VerificationResultV0_1,
  verifyClear402CredentialV0_1,
} from "@moss-mini-demo/clear402-profile";
import {
  Clear402VerifyResponseSchema,
  MAX_CLEAR402_VERIFY_REQUEST_BYTES,
} from "../contracts/clear402";
import {
  acceptsJsonContentType,
  createJsonResponse,
  declaredBodyIsTooLarge,
  readBoundedJsonBody,
  RequestTooLargeError,
} from "./http-json";

type VerifyCredential = (value: unknown) => Clear402VerificationResultV0_1;

type VerifyHandlerDependencies = Readonly<{
  verify?: VerifyCredential;
  logger?: VerifyHandlerLogger;
}>;

export type VerifyHandlerLogEvent = Readonly<{
  event: "CLEAR402_VERIFY_INTERNAL_ERROR";
  code: "INTERNAL_ERROR";
}>;

export interface VerifyHandlerLogger {
  error(event: VerifyHandlerLogEvent): void;
}

const REQUEST_ERRORS = {
  INVALID_JSON: {
    status: 400,
    message: "Request body must be valid JSON.",
  },
  REQUEST_TOO_LARGE: {
    status: 413,
    message: "Request body exceeds the maximum size.",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: "Content-Type must be application/json.",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "The credential could not be verified.",
  },
} as const;

function jsonResponse(value: unknown, status: number): Response {
  const body = Clear402VerifyResponseSchema.parse(value);
  return createJsonResponse(JSON.stringify(body), status);
}

function disabledResponse(): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: "CLEAR402_DISABLED",
        message: "Clear402 credential verification is disabled.",
      },
    },
    404,
  );
}

function requestError(code: keyof typeof REQUEST_ERRORS): Response {
  const definition = REQUEST_ERRORS[code];
  return jsonResponse(
    { ok: false, error: { code, message: definition.message } },
    definition.status,
  );
}

export function createVerifyHandler({
  verify,
  logger,
}: VerifyHandlerDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (verify === undefined) {
      return disabledResponse();
    }
    if (!acceptsJsonContentType(request.headers.get("content-type"))) {
      return requestError("UNSUPPORTED_MEDIA_TYPE");
    }
    if (declaredBodyIsTooLarge(request, MAX_CLEAR402_VERIFY_REQUEST_BYTES)) {
      return requestError("REQUEST_TOO_LARGE");
    }

    let value: unknown;
    try {
      value = await readBoundedJsonBody(
        request,
        MAX_CLEAR402_VERIFY_REQUEST_BYTES,
      );
    } catch (error) {
      return requestError(
        error instanceof RequestTooLargeError
          ? "REQUEST_TOO_LARGE"
          : "INVALID_JSON",
      );
    }

    try {
      const result = verify(value);
      if (result.valid) {
        return jsonResponse({ ok: true, integrity: "VALID" }, 200);
      }
      const message =
        result.error.code === "SCHEMA_INVALID"
          ? "Credential schema is invalid or unsupported."
          : "Credential digest does not match the protected report.";
      return jsonResponse(
        {
          ok: false,
          integrity: "INVALID",
          error: { code: result.error.code, message },
        },
        422,
      );
    } catch {
      logger?.error({
        event: "CLEAR402_VERIFY_INTERNAL_ERROR",
        code: "INTERNAL_ERROR",
      });
      return requestError("INTERNAL_ERROR");
    }
  };
}

export function resolveVerifyCredential(
  enabled: boolean,
): VerifyCredential | undefined {
  return enabled ? verifyClear402CredentialV0_1 : undefined;
}
