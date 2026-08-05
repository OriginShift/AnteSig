import "server-only";

import {
  MAX_PREFLIGHT_RESPONSE_BYTES,
  PREFLIGHT_CONTRACT_VERSION,
  PreflightErrorResponseSchema,
  type PreflightErrorCode,
  PreflightRequestSchema,
  PreflightSuccessResponseSchema,
  type RunId,
} from "../contracts/preflight";
import {
  acceptsJsonContentType,
  createJsonResponse,
  declaredBodyIsTooLarge,
  readBoundedJsonBody,
  RequestTooLargeError,
  utf8ByteLength,
} from "./http-json";
import type { PreflightService } from "./preflight-service";

const ERROR_RESPONSES = {
  INVALID_JSON: {
    status: 400,
    message: "Request body must be valid JSON.",
  },
  INVALID_REQUEST: {
    status: 400,
    message: "Request does not match the preflight contract.",
  },
  REQUEST_TOO_LARGE: {
    status: 413,
    message: "Request body exceeds the maximum size.",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: "Content-Type must be application/json.",
  },
  LIVE_UNAVAILABLE: {
    status: 503,
    message: "Live preflight is unavailable in this baseline.",
  },
  RESPONSE_TOO_LARGE: {
    status: 500,
    message: "Response exceeds the maximum size.",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "The preflight request could not be completed.",
  },
} as const satisfies Record<
  PreflightErrorCode,
  Readonly<{ status: number; message: string }>
>;

type PreflightHandlerDependencies = Readonly<{
  service: PreflightService;
  generateRunId: () => RunId;
}>;

function errorResponse(runId: RunId, code: PreflightErrorCode): Response {
  const definition = ERROR_RESPONSES[code];
  const body = PreflightErrorResponseSchema.parse({
    contractVersion: PREFLIGHT_CONTRACT_VERSION,
    ok: false,
    runId,
    error: { code, message: definition.message },
  });
  return createJsonResponse(JSON.stringify(body), definition.status);
}

export function createPreflightHandler({
  service,
  generateRunId,
}: PreflightHandlerDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    const runId = generateRunId();

    if (!acceptsJsonContentType(request.headers.get("content-type"))) {
      return errorResponse(runId, "UNSUPPORTED_MEDIA_TYPE");
    }
    if (declaredBodyIsTooLarge(request)) {
      return errorResponse(runId, "REQUEST_TOO_LARGE");
    }

    let requestBody: unknown;
    try {
      requestBody = await readBoundedJsonBody(request);
    } catch (error) {
      return errorResponse(
        runId,
        error instanceof RequestTooLargeError
          ? "REQUEST_TOO_LARGE"
          : "INVALID_JSON",
      );
    }

    const parsedRequest = PreflightRequestSchema.safeParse(requestBody);
    if (!parsedRequest.success) {
      return errorResponse(runId, "INVALID_REQUEST");
    }

    try {
      const result = await service.run({
        runId,
        request: parsedRequest.data,
      });
      if (result.status === "UNAVAILABLE") {
        return errorResponse(runId, "LIVE_UNAVAILABLE");
      }

      const success =
        parsedRequest.data.mode === "FIXTURE"
          ? {
              contractVersion: PREFLIGHT_CONTRACT_VERSION,
              ok: true,
              runId,
              mode: "FIXTURE",
              scenario: parsedRequest.data.scenario,
              report: result.report,
            }
          : {
              contractVersion: PREFLIGHT_CONTRACT_VERSION,
              ok: true,
              runId,
              mode: "LIVE",
              report: result.report,
            };
      const parsedResponse = PreflightSuccessResponseSchema.safeParse(success);
      if (!parsedResponse.success) {
        return errorResponse(runId, "INTERNAL_ERROR");
      }

      const serializedResponse = JSON.stringify(parsedResponse.data);
      if (utf8ByteLength(serializedResponse) > MAX_PREFLIGHT_RESPONSE_BYTES) {
        return errorResponse(runId, "RESPONSE_TOO_LARGE");
      }
      return createJsonResponse(serializedResponse, 200);
    } catch {
      return errorResponse(runId, "INTERNAL_ERROR");
    }
  };
}
