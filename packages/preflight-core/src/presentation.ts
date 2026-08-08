import {
  type JsonPointerSyntax,
  PreflightReportSchema,
  type ReportId,
  type StopReasonCodeV0_1,
} from "@moss-mini-demo/report-schema";
import {
  cloneDescriptorClosedJsonV0_1,
  PreflightAssemblyErrorV0_1,
} from "./assembler.js";

const STOP_EXPLANATIONS = {
  NO_VALID_SELECTION: "No protocol was selected; review stopped.",
  CAPABILITY_FAILED: "Capability evidence failed to be established.",
  CAPABILITY_MISSING: "Required Capability evidence is missing.",
  CAPABILITY_UNPROVABLE: "Capability evidence cannot be proven.",
  SIMULATION_ACQUISITION_FAILED:
    "Simulation evidence failed to be established.",
  SIMULATION_MISSING: "Required simulation evidence is missing.",
  SIMULATION_UNPROVABLE: "Simulation evidence cannot be proven.",
  SIMULATION_EXECUTION_FAILED: "The available simulation records failure.",
  SIMULATION_INTERRUPTED: "The available simulation was interrupted.",
  WARNING_PRESENT: "The available simulation contains a Warning.",
  RECEIPT_FAILED: "An available Receipt records failure.",
  RECEIPT_SET_INCOMPLETE: "The available Receipt collection is empty.",
  OUTCOME_FAILED: "An available Outcome records failure.",
  OUTCOME_SET_INCOMPLETE: "The available Outcome collection is empty.",
  COVERAGE_INCOMPLETE: "The available coverage evidence is incomplete.",
  ORDERING_INVALID: "The available ordering evidence is invalid.",
  STATE_CONTINUITY_INTERRUPTED:
    "The available state-continuity evidence is interrupted.",
  CRITICAL_ALIGNMENT_FAIL: "A critical alignment check records failure.",
  CRITICAL_ALIGNMENT_REVIEW:
    "A critical alignment check could not be established.",
  REQUIRED_EVIDENCE_FAILED:
    "A decision-critical evidence component failed to be established.",
  REQUIRED_EVIDENCE_MISSING:
    "A decision-critical evidence component is missing.",
  REQUIRED_EVIDENCE_UNPROVABLE:
    "A decision-critical evidence component cannot be proven.",
} as const satisfies Readonly<Record<StopReasonCodeV0_1, string>>;

const BLOCK_CONTEXT_REFERENCE =
  "/simulation/raw/context/block" as JsonPointerSyntax;
const MOSS_CONTEXT_REFERENCE =
  "/simulation/raw/context/moss" as JsonPointerSyntax;

export type PreflightPresentationReasonV0_1 = Readonly<{
  code: StopReasonCodeV0_1;
  explanation: string;
  sourceReferences: readonly JsonPointerSyntax[];
}>;

export type PreflightPresentationDecisionV0_1 =
  | Readonly<{ status: "MANUAL_REVIEW" }>
  | Readonly<{
      status: "STOP";
      heading: "STOP";
      actionBoundary: "DO_NOT_PROCEED_TO_SIGNER";
      reasons: readonly PreflightPresentationReasonV0_1[];
    }>;

export type PreflightPresentationV0_1 = Readonly<{
  schemaVersion: "0.1";
  reportId: ReportId;
  decision: PreflightPresentationDecisionV0_1;
  sourceContextReferences: readonly JsonPointerSyntax[];
  limitationReferences: readonly JsonPointerSyntax[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceContextReferences(report: {
  simulation:
    | Readonly<{ availability: "AVAILABLE"; raw: unknown }>
    | Readonly<{ availability: "FAILED" | "MISSING" | "UNPROVABLE" }>;
}): JsonPointerSyntax[] {
  if (report.simulation.availability !== "AVAILABLE") {
    return [];
  }
  const raw = report.simulation.raw;
  const context = isRecord(raw) ? raw.context : undefined;
  if (!isRecord(context)) {
    return [];
  }
  const references: JsonPointerSyntax[] = [];
  if (Object.hasOwn(context, "block")) {
    references.push(BLOCK_CONTEXT_REFERENCE);
  }
  if (Object.hasOwn(context, "moss")) {
    references.push(MOSS_CONTEXT_REFERENCE);
  }
  return references;
}

export function derivePreflightPresentationV0_1(
  reportInput: unknown,
): PreflightPresentationV0_1 {
  const cloned = cloneDescriptorClosedJsonV0_1(reportInput);
  if (!cloned.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_PREFLIGHT_REPORT");
  }
  const parsed = PreflightReportSchema.safeParse(cloned.value);
  if (!parsed.success) {
    throw new PreflightAssemblyErrorV0_1("INVALID_PREFLIGHT_REPORT");
  }
  const report = parsed.data;
  const limitationReferences = report.limitations.map(
    (_limitation, index) => `/limitations/${index}` as JsonPointerSyntax,
  );
  const decision: PreflightPresentationDecisionV0_1 =
    report.decision.status === "MANUAL_REVIEW"
      ? { status: "MANUAL_REVIEW" }
      : {
          status: "STOP",
          heading: "STOP",
          actionBoundary: "DO_NOT_PROCEED_TO_SIGNER",
          reasons: report.decision.reasons.map((reason) => ({
            code: reason.code,
            explanation: STOP_EXPLANATIONS[reason.code],
            sourceReferences: [...reason.sourceReferences],
          })),
        };

  return {
    schemaVersion: "0.1",
    reportId: report.reportId,
    decision,
    sourceContextReferences: sourceContextReferences(report),
    limitationReferences,
  };
}
