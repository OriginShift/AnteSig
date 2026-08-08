import {
  JsonPointerSyntaxListSchema,
  JsonPointerSyntaxSchema,
  IntentSchema,
  PreflightReportSchema,
  ReportIdSchema,
  StopReasonCodeV0_1Schema,
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

const PreflightPresentationReasonSchema = z.strictObject({
  code: StopReasonCodeV0_1Schema,
  explanation: z.string().min(1).max(512),
  sourceReferences: JsonPointerSyntaxListSchema,
});

const PreflightPresentationDecisionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("MANUAL_REVIEW") }),
  z.strictObject({
    status: z.literal("STOP"),
    heading: z.literal("STOP"),
    actionBoundary: z.literal("DO_NOT_PROCEED_TO_SIGNER"),
    reasons: z.array(PreflightPresentationReasonSchema).min(1),
  }),
]);

export const PreflightPresentationSchema = z.strictObject({
  schemaVersion: z.literal("0.1"),
  reportId: ReportIdSchema,
  decision: PreflightPresentationDecisionSchema,
  sourceContextReferences: z.array(JsonPointerSyntaxSchema),
  limitationReferences: z.array(JsonPointerSyntaxSchema),
});

export const LivePreflightSuccessSchema = z.strictObject({
  contractVersion: z.literal(PREFLIGHT_CONTRACT_VERSION),
  ok: z.literal(true),
  runId: RunIdSchema,
  mode: z.literal("LIVE"),
  report: LiveReportSchema,
  presentation: PreflightPresentationSchema,
});

export const FixturePreflightSuccessSchema = z.strictObject({
  contractVersion: z.literal(PREFLIGHT_CONTRACT_VERSION),
  ok: z.literal(true),
  runId: RunIdSchema,
  mode: z.literal("FIXTURE"),
  scenario: FixtureScenarioSchema,
  report: FixtureReportSchema,
  presentation: PreflightPresentationSchema,
});

const PreflightSuccessResponseBaseSchema = z.discriminatedUnion("mode", [
  LivePreflightSuccessSchema,
  FixturePreflightSuccessSchema,
]);

function expectedSourceContextReferences(
  report: z.infer<typeof PreflightReportSchema>,
): string[] {
  if (
    report.simulation.availability !== "AVAILABLE" ||
    typeof report.simulation.raw !== "object" ||
    report.simulation.raw === null ||
    Array.isArray(report.simulation.raw)
  ) {
    return [];
  }
  const context = report.simulation.raw.context;
  if (
    typeof context !== "object" ||
    context === null ||
    Array.isArray(context)
  ) {
    return [];
  }
  return [
    ...(Object.hasOwn(context, "block")
      ? ["/simulation/raw/context/block"]
      : []),
    ...(Object.hasOwn(context, "moss") ? ["/simulation/raw/context/moss"] : []),
  ];
}

export const PreflightSuccessResponseSchema =
  PreflightSuccessResponseBaseSchema.superRefine((response, context) => {
    const presentation = response.presentation;
    if (presentation.reportId !== response.report.reportId) {
      context.addIssue({
        code: "custom",
        message: "Presentation reportId must match report",
        path: ["presentation", "reportId"],
      });
    }
    if (presentation.decision.status !== response.report.decision.status) {
      context.addIssue({
        code: "custom",
        message: "Presentation Decision must match report",
        path: ["presentation", "decision"],
      });
    } else if (
      presentation.decision.status === "STOP" &&
      response.report.decision.status === "STOP"
    ) {
      const presented = presentation.decision.reasons.map((reason) => ({
        code: reason.code,
        sourceReferences: reason.sourceReferences,
      }));
      if (
        JSON.stringify(presented) !==
        JSON.stringify(response.report.decision.reasons)
      ) {
        context.addIssue({
          code: "custom",
          message: "Presentation STOP reasons must match report",
          path: ["presentation", "decision", "reasons"],
        });
      }
    }

    const limitationReferences = response.report.limitations.map(
      (_limitation, index) => `/limitations/${index}`,
    );
    if (
      JSON.stringify(presentation.limitationReferences) !==
      JSON.stringify(limitationReferences)
    ) {
      context.addIssue({
        code: "custom",
        message: "Presentation limitation references must match report",
        path: ["presentation", "limitationReferences"],
      });
    }
    if (
      JSON.stringify(presentation.sourceContextReferences) !==
      JSON.stringify(expectedSourceContextReferences(response.report))
    ) {
      context.addIssue({
        code: "custom",
        message: "Presentation source context must match report",
        path: ["presentation", "sourceContextReferences"],
      });
    }
  });

export const PREFLIGHT_ERROR_CODES = [
  "INVALID_JSON",
  "INVALID_REQUEST",
  "REQUEST_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "LIVE_UNAVAILABLE",
  "PREFLIGHT_TIMEOUT",
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
export type PreflightPresentation = z.infer<typeof PreflightPresentationSchema>;
export type PreflightErrorCode = z.infer<typeof PreflightErrorCodeSchema>;
export type PreflightErrorResponse = z.infer<
  typeof PreflightErrorResponseSchema
>;
export type PreflightResponse = z.infer<typeof PreflightResponseSchema>;
