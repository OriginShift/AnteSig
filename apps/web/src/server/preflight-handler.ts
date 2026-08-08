import "server-only";

import { derivePreflightPresentationV0_1 } from "@moss-mini-demo/preflight-core";
import {
  CLEAR402_GENERATION_ERROR_CODE,
  CLEAR402_GENERATION_ERROR_MESSAGE,
  Clear402EnabledPreflightSuccessResponseSchema,
  type Clear402PreflightExtension,
} from "../contracts/clear402";
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
import type { CredentialService } from "./credential-service";

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
  PREFLIGHT_TIMEOUT: {
    status: 504,
    message: "The preflight request exceeded its hard deadline.",
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
  credentialService?: CredentialService;
  logger?: PreflightHandlerLogger;
}>;

export type PreflightHandlerLogEvent =
  | Readonly<{
      event: "PREFLIGHT_INTERNAL_ERROR";
      runId: RunId;
      code: "INTERNAL_ERROR" | "RESPONSE_TOO_LARGE";
    }>
  | Readonly<{
      event: "CLEAR402_GENERATION_ERROR";
      runId: RunId;
      code: typeof CLEAR402_GENERATION_ERROR_CODE;
    }>;

export interface PreflightHandlerLogger {
  error(event: PreflightHandlerLogEvent): void;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "credential",
  "credentials",
  "apikey",
  "password",
  "privatekey",
  "rpcurl",
  "secret",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function containsSensitiveMaterial(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSensitiveMaterial);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.entries(value).some(
    ([key, child]) =>
      SENSITIVE_KEYS.has(normalizedKey(key)) ||
      containsSensitiveMaterial(child),
  );
}

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
  credentialService,
  logger,
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
      if (result.status === "TIMEOUT") {
        return errorResponse(runId, "PREFLIGHT_TIMEOUT");
      }

      const presentation = derivePreflightPresentationV0_1(result.report);

      const success =
        parsedRequest.data.mode === "FIXTURE"
          ? {
              contractVersion: PREFLIGHT_CONTRACT_VERSION,
              ok: true,
              runId,
              mode: "FIXTURE",
              scenario: parsedRequest.data.scenario,
              report: result.report,
              presentation,
            }
          : {
              contractVersion: PREFLIGHT_CONTRACT_VERSION,
              ok: true,
              runId,
              mode: "LIVE",
              report: result.report,
              presentation,
            };
      const parsedResponse = PreflightSuccessResponseSchema.safeParse(success);
      if (!parsedResponse.success) {
        logger?.error({
          event: "PREFLIGHT_INTERNAL_ERROR",
          runId,
          code: "INTERNAL_ERROR",
        });
        return errorResponse(runId, "INTERNAL_ERROR");
      }

      if (containsSensitiveMaterial(parsedResponse.data)) {
        logger?.error({
          event: "PREFLIGHT_INTERNAL_ERROR",
          runId,
          code: "INTERNAL_ERROR",
        });
        return errorResponse(runId, "INTERNAL_ERROR");
      }

      let response: unknown = parsedResponse.data;
      if (credentialService !== undefined) {
        let clear402: Clear402PreflightExtension;
        try {
          clear402 = {
            status: "AVAILABLE",
            credential: credentialService.generate(parsedResponse.data.report),
          };
        } catch {
          logger?.error({
            event: "CLEAR402_GENERATION_ERROR",
            runId,
            code: CLEAR402_GENERATION_ERROR_CODE,
          });
          clear402 = {
            status: "ERROR",
            error: {
              code: CLEAR402_GENERATION_ERROR_CODE,
              message: CLEAR402_GENERATION_ERROR_MESSAGE,
            },
          };
        }
        response = Clear402EnabledPreflightSuccessResponseSchema.parse({
          ...parsedResponse.data,
          clear402,
        });
      }

      const serializedResponse = JSON.stringify(response);
      if (utf8ByteLength(serializedResponse) > MAX_PREFLIGHT_RESPONSE_BYTES) {
        logger?.error({
          event: "PREFLIGHT_INTERNAL_ERROR",
          runId,
          code: "RESPONSE_TOO_LARGE",
        });
        return errorResponse(runId, "RESPONSE_TOO_LARGE");
      }
      return createJsonResponse(serializedResponse, 200);
    } catch {
      logger?.error({
        event: "PREFLIGHT_INTERNAL_ERROR",
        runId,
        code: "INTERNAL_ERROR",
      });
      return errorResponse(runId, "INTERNAL_ERROR");
    }
  };
}
