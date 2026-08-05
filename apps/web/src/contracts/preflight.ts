import {
  IntentSchema,
  PreflightReportSchema,
} from "@moss-mini-demo/report-schema";
import { z } from "zod";

export const PREFLIGHT_CONTRACT_VERSION = "0.1" as const;
export const MAX_PREFLIGHT_REQUEST_BYTES = 65_536;
export const MAX_PREFLIGHT_RESPONSE_BYTES = 2_097_152;

export const FIXTURE_SCENARIOS = [
  "manual-review-success",
  "token-out-mismatch",
  "amount-in-mismatch",
] as const;

export const FixtureScenarioSchema = z.enum(FIXTURE_SCENARIOS);
export const RunIdSchema = z
  .string()
  .regex(
    /^run_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );

export const LivePreflightRequestSchema = z.strictObject({
  contractVersion: z.literal(PREFLIGHT_CONTRACT_VERSION),
  mode: z.literal("LIVE"),
  intent: IntentSchema,
});

export const FixturePreflightRequestSchema = z.strictObject({
  contractVersion: z.literal(PREFLIGHT_CONTRACT_VERSION),
  mode: z.literal("FIXTURE"),
  scenario: FixtureScenarioSchema,
});

const StrictPreflightRequestSchema = z.discriminatedUnion("mode", [
  LivePreflightRequestSchema,
  FixturePreflightRequestSchema,
]);

function containsPrototypeSensitiveKey(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(containsPrototypeSensitiveKey);
  }
  const entries = Object.entries(value);
  return (
    entries.some(([key]) =>
      ["__proto__", "constructor", "prototype"].includes(key),
    ) || entries.some(([, nested]) => containsPrototypeSensitiveKey(nested))
  );
}

export const PreflightRequestSchema = z
  .unknown()
  .refine(
    (value) => !containsPrototypeSensitiveKey(value),
    "Prototype-sensitive keys are forbidden",
  )
  .pipe(StrictPreflightRequestSchema);

const LiveReportSchema = PreflightReportSchema.refine(
  (report) => report.provenance !== "FIXTURE",
  "LIVE responses require LIVE_SOURCE or LOCAL_FORK provenance",
);
const FixtureReportSchema = PreflightReportSchema.refine(
  (report) => report.provenance === "FIXTURE",
  "FIXTURE responses require FIXTURE provenance",
);

export const LivePreflightSuccessSchema = z.strictObject({
  contractVersion: z.literal(PREFLIGHT_CONTRACT_VERSION),
  ok: z.literal(true),
  runId: RunIdSchema,
  mode: z.literal("LIVE"),
  report: LiveReportSchema,
});

export const FixturePreflightSuccessSchema = z.strictObject({
  contractVersion: z.literal(PREFLIGHT_CONTRACT_VERSION),
  ok: z.literal(true),
  runId: RunIdSchema,
  mode: z.literal("FIXTURE"),
  scenario: FixtureScenarioSchema,
  report: FixtureReportSchema,
});

export const PreflightSuccessResponseSchema = z.discriminatedUnion("mode", [
  LivePreflightSuccessSchema,
  FixturePreflightSuccessSchema,
]);

export const PREFLIGHT_ERROR_CODES = [
  "INVALID_JSON",
  "INVALID_REQUEST",
  "REQUEST_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "LIVE_UNAVAILABLE",
  "RESPONSE_TOO_LARGE",
  "INTERNAL_ERROR",
] as const;

export const PreflightErrorCodeSchema = z.enum(PREFLIGHT_ERROR_CODES);
export const PreflightErrorResponseSchema = z.strictObject({
  contractVersion: z.literal(PREFLIGHT_CONTRACT_VERSION),
  ok: z.literal(false),
  runId: RunIdSchema,
  error: z.strictObject({
    code: PreflightErrorCodeSchema,
    message: z.string().min(1).max(256),
  }),
});

export const PreflightResponseSchema = z.union([
  PreflightSuccessResponseSchema,
  PreflightErrorResponseSchema,
]);

export type FixtureScenario = z.infer<typeof FixtureScenarioSchema>;
export type RunId = z.infer<typeof RunIdSchema>;
export type PreflightRequest = z.infer<typeof PreflightRequestSchema>;
export type PreflightSuccessResponse = z.infer<
  typeof PreflightSuccessResponseSchema
>;
export type PreflightErrorCode = z.infer<typeof PreflightErrorCodeSchema>;
export type PreflightErrorResponse = z.infer<
  typeof PreflightErrorResponseSchema
>;
export type PreflightResponse = z.infer<typeof PreflightResponseSchema>;
