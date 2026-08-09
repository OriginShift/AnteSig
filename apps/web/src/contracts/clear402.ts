import { Clear402MonadActionCredentialV0_1Schema } from "@moss-mini-demo/clear402-profile";
import { z } from "zod";
import {
  FixturePreflightSuccessSchema,
  LivePreflightSuccessSchema,
  PreflightSuccessResponseSchema,
} from "./preflight";

export const CLEAR402_GENERATION_ERROR_CODE =
  "CREDENTIAL_GENERATION_FAILED" as const;
export const CLEAR402_GENERATION_ERROR_MESSAGE =
  "The Clear402 credential could not be generated." as const;

const Clear402AvailableExtensionSchema = z.strictObject({
  status: z.literal("AVAILABLE"),
  credential: Clear402MonadActionCredentialV0_1Schema,
});

const Clear402ErrorExtensionSchema = z.strictObject({
  status: z.literal("ERROR"),
  error: z.strictObject({
    code: z.literal(CLEAR402_GENERATION_ERROR_CODE),
    message: z.literal(CLEAR402_GENERATION_ERROR_MESSAGE),
  }),
});

export const Clear402PreflightExtensionSchema = z.discriminatedUnion("status", [
  Clear402AvailableExtensionSchema,
  Clear402ErrorExtensionSchema,
]);

const Clear402EnabledPreflightSuccessBaseSchema = z.discriminatedUnion("mode", [
  LivePreflightSuccessSchema.extend({
    clear402: Clear402PreflightExtensionSchema,
  }),
  FixturePreflightSuccessSchema.extend({
    clear402: Clear402PreflightExtensionSchema,
  }),
]);

export const Clear402EnabledPreflightSuccessResponseSchema =
  Clear402EnabledPreflightSuccessBaseSchema.superRefine((response, context) => {
    const { clear402: _clear402, ...baseline } = response;
    if (!PreflightSuccessResponseSchema.safeParse(baseline).success) {
      context.addIssue({
        code: "custom",
        message:
          "Clear402 response must preserve the baseline response contract",
      });
    }
    if (
      response.clear402.status === "AVAILABLE" &&
      JSON.stringify(response.clear402.credential.report) !==
        JSON.stringify(response.report)
    ) {
      context.addIssue({
        code: "custom",
        message: "Clear402 export report must match the displayed report",
        path: ["clear402", "credential", "report"],
      });
    }
  });

export type Clear402PreflightExtension = z.infer<
  typeof Clear402PreflightExtensionSchema
>;
export type Clear402EnabledPreflightSuccessResponse = z.infer<
  typeof Clear402EnabledPreflightSuccessResponseSchema
>;

export const MAX_CLEAR402_VERIFY_REQUEST_BYTES = 2_097_152;

export const Clear402VerifyDisabledResponseSchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({
    code: z.literal("CLEAR402_DISABLED"),
    message: z.literal("Clear402 credential verification is disabled."),
  }),
});

export const Clear402VerifyValidResponseSchema = z.strictObject({
  ok: z.literal(true),
  integrity: z.literal("VALID"),
});

export const Clear402VerifyInvalidResponseSchema = z.strictObject({
  ok: z.literal(false),
  integrity: z.literal("INVALID"),
  error: z.strictObject({
    code: z.enum(["SCHEMA_INVALID", "DIGEST_INVALID"]),
    message: z.string().min(1).max(256),
  }),
});

export const Clear402VerifyRequestErrorResponseSchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({
    code: z.enum([
      "INVALID_JSON",
      "REQUEST_TOO_LARGE",
      "UNSUPPORTED_MEDIA_TYPE",
      "INTERNAL_ERROR",
    ]),
    message: z.string().min(1).max(256),
  }),
});

export const Clear402VerifyResponseSchema = z.union([
  Clear402VerifyDisabledResponseSchema,
  Clear402VerifyValidResponseSchema,
  Clear402VerifyInvalidResponseSchema,
  Clear402VerifyRequestErrorResponseSchema,
]);

export type Clear402VerifyResponse = z.infer<
  typeof Clear402VerifyResponseSchema
>;
