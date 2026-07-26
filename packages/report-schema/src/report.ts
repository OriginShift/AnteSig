import { z } from "zod";
import {
  AlignmentCheckSchema,
  AssetSchema,
  CapabilitySchema,
  DecisionSchema,
  LimitationSchema,
  QuoteSchema,
  SelectionSchema,
  SimulationSchema,
} from "./evidence.js";
import {
  isAllowedSourceReference,
  resolvesJsonPointer,
  type SourceReferencesSchema,
} from "./references.js";
import {
  EvmAddressSchema,
  GeneratedAtSchema,
  MaxSlippageBpsSchema,
  NetworkSchema,
  PositiveAmountSchema,
  ProtocolIdSchema,
  ReportIdSchema,
} from "./scalars.js";

export const IntentSchema = z
  .strictObject({
    account: EvmAddressSchema,
    inputAsset: AssetSchema,
    outputAsset: AssetSchema,
    inputAmount: PositiveAmountSchema,
    maxSlippageBps: MaxSlippageBpsSchema,
    allowedProtocols: z.array(ProtocolIdSchema).min(1),
    recipient: EvmAddressSchema.optional(),
  })
  .superRefine((intent, context) => {
    if (
      new Set(intent.allowedProtocols).size !== intent.allowedProtocols.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Allowed protocols must be unique",
        path: ["allowedProtocols"],
      });
    }
  });

export const AlignmentSchema = z.strictObject({
  checks: z.array(AlignmentCheckSchema).min(1),
});

export const ProvenanceSchema = z.enum([
  "FIXTURE",
  "LOCAL_FORK",
  "LIVE_SOURCE",
]);

const PreflightReportBaseSchema = z.strictObject({
  schemaVersion: z.literal("0.1"),
  reportId: ReportIdSchema,
  generatedAt: GeneratedAtSchema,
  network: NetworkSchema,
  provenance: ProvenanceSchema,
  intent: IntentSchema,
  quotes: z.array(QuoteSchema).min(1),
  selection: SelectionSchema,
  capability: CapabilitySchema,
  simulation: SimulationSchema,
  alignment: AlignmentSchema,
  decision: DecisionSchema,
  limitations: z.array(LimitationSchema),
});

type ReportBase = z.infer<typeof PreflightReportBaseSchema>;
type ReferenceList = z.infer<typeof SourceReferencesSchema>;

function assetsEqual(
  left: ReportBase["intent"]["inputAsset"],
  right: unknown,
): boolean {
  if (typeof right !== "object" || right === null || !("kind" in right)) {
    return false;
  }
  if (left.kind !== right.kind) {
    return false;
  }
  return (
    left.kind === "NATIVE" ||
    (!("address" in right) ? false : left.address === right.address)
  );
}

function collectReferenceLists(report: ReportBase): ReferenceList[] {
  const references: ReferenceList[] = [];

  for (const quote of report.quotes) {
    if (quote.status === "FAILED") {
      references.push(quote.failure.sourceReferences);
    }
  }
  references.push(report.selection.reason.sourceReferences);

  if (report.capability.availability !== "AVAILABLE") {
    references.push(report.capability.failure.sourceReferences);
  }

  if (report.simulation.availability !== "AVAILABLE") {
    references.push(report.simulation.failure.sourceReferences);
  } else {
    for (const evidence of [
      report.simulation.receipts,
      report.simulation.outcomes,
      report.simulation.warnings,
      report.simulation.coverage,
      report.simulation.ordering,
      report.simulation.stateContinuity,
    ]) {
      if (evidence.availability !== "AVAILABLE") {
        references.push(evidence.failure.sourceReferences);
      }
    }
  }

  for (const check of report.alignment.checks) {
    references.push(check.sourceReferences);
  }
  if (report.decision.status === "STOP") {
    for (const reason of report.decision.reasons) {
      references.push(reason.sourceReferences);
    }
  }
  for (const limitation of report.limitations) {
    references.push(limitation.sourceReferences);
  }

  return references;
}

function addIssue(
  context: z.RefinementCtx,
  message: string,
  path: PropertyKey[],
): void {
  context.addIssue({ code: "custom", message, path });
}

function validateSelection(report: ReportBase, context: z.RefinementCtx): void {
  const selection = report.selection;
  if (selection.status !== "SELECTED") {
    return;
  }

  if (!report.intent.allowedProtocols.includes(selection.protocolId)) {
    addIssue(context, "Selected protocol is not allowed by intent", [
      "selection",
      "protocolId",
    ]);
  }

  const quote = report.quotes.find(
    (candidate) => candidate.quoteId === selection.quoteId,
  );
  if (
    quote?.status !== "SUCCESS" ||
    quote.protocolId !== selection.protocolId ||
    quote.inputAmount !== report.intent.inputAmount ||
    !assetsEqual(report.intent.inputAsset, quote.inputAsset) ||
    !assetsEqual(report.intent.outputAsset, quote.outputAsset)
  ) {
    addIssue(context, "Selection must reference a matching successful quote", [
      "selection",
    ]);
  }
}

function validateManualReview(
  report: ReportBase,
  context: z.RefinementCtx,
): void {
  if (report.decision.status !== "MANUAL_REVIEW") {
    return;
  }

  if (report.selection.status !== "SELECTED") {
    addIssue(context, "MANUAL_REVIEW requires an explicit selection", [
      "decision",
    ]);
  }
  if (report.capability.availability !== "AVAILABLE") {
    addIssue(context, "MANUAL_REVIEW requires available Capability evidence", [
      "capability",
    ]);
  }
  if (report.simulation.availability !== "AVAILABLE") {
    addIssue(context, "MANUAL_REVIEW requires available simulation evidence", [
      "simulation",
    ]);
    return;
  }

  const simulation = report.simulation;
  if (simulation.executionStatus !== "SUCCESS") {
    addIssue(
      context,
      "MANUAL_REVIEW requires successful simulation execution",
      ["simulation", "executionStatus"],
    );
  }

  for (const [name, evidence] of Object.entries({
    receipts: simulation.receipts,
    outcomes: simulation.outcomes,
    warnings: simulation.warnings,
    coverage: simulation.coverage,
    ordering: simulation.ordering,
    stateContinuity: simulation.stateContinuity,
  })) {
    if (evidence.availability !== "AVAILABLE") {
      addIssue(context, `MANUAL_REVIEW requires available ${name} evidence`, [
        "simulation",
        name,
      ]);
    }
  }

  if (
    simulation.warnings.availability === "AVAILABLE" &&
    simulation.warnings.items.length > 0
  ) {
    addIssue(
      context,
      "MANUAL_REVIEW requires a proven empty Warning collection",
      ["simulation", "warnings"],
    );
  }
  if (
    simulation.receipts.availability === "AVAILABLE" &&
    (simulation.receipts.items.length === 0 ||
      simulation.receipts.items.some((receipt) => receipt.status === "FAILED"))
  ) {
    addIssue(context, "MANUAL_REVIEW requires non-empty successful Receipts", [
      "simulation",
      "receipts",
    ]);
  }
  if (
    simulation.outcomes.availability === "AVAILABLE" &&
    (simulation.outcomes.items.length === 0 ||
      simulation.outcomes.items.some((outcome) => outcome.status === "FAILED"))
  ) {
    addIssue(context, "MANUAL_REVIEW requires non-empty successful Outcomes", [
      "simulation",
      "outcomes",
    ]);
  }
  if (
    simulation.coverage.availability === "AVAILABLE" &&
    !simulation.coverage.complete
  ) {
    addIssue(context, "MANUAL_REVIEW requires complete coverage", [
      "simulation",
      "coverage",
    ]);
  }
  if (
    simulation.ordering.availability === "AVAILABLE" &&
    !simulation.ordering.valid
  ) {
    addIssue(context, "MANUAL_REVIEW requires valid ordering", [
      "simulation",
      "ordering",
    ]);
  }
  if (
    simulation.stateContinuity.availability === "AVAILABLE" &&
    !simulation.stateContinuity.continuous
  ) {
    addIssue(context, "MANUAL_REVIEW requires continuous state", [
      "simulation",
      "stateContinuity",
    ]);
  }

  const criticalChecks = report.alignment.checks.filter(
    (check) => check.critical,
  );
  if (
    criticalChecks.length === 0 ||
    criticalChecks.some((check) => check.status !== "PASS")
  ) {
    addIssue(
      context,
      "MANUAL_REVIEW requires PASS for every critical alignment check",
      ["alignment", "checks"],
    );
  }
}

function isReferenceTo(reference: string, sourcePath: string): boolean {
  return reference === sourcePath || reference.startsWith(`${sourcePath}/`);
}

function validateCriticalAlignmentStopReasons(
  report: ReportBase,
  references: readonly string[],
  context: z.RefinementCtx,
): void {
  for (const check of report.alignment.checks) {
    if (check.critical && check.status !== "PASS") {
      const hasUnderlyingSource = check.sourceReferences.some(
        (sourceReference) =>
          references.some((reference) =>
            isReferenceTo(reference, sourceReference),
          ),
      );
      if (!hasUnderlyingSource) {
        addIssue(
          context,
          "STOP reason must reference evidence underlying a critical alignment failure",
          ["decision", "reasons"],
        );
      }
    }
  }
}

function validateStopReasonReferences(
  report: ReportBase,
  context: z.RefinementCtx,
): void {
  if (report.decision.status !== "STOP") {
    return;
  }

  const references = report.decision.reasons.flatMap(
    (reason) => reason.sourceReferences,
  );
  const requiresReference = (sourcePath: string, description: string): void => {
    if (!references.some((reference) => isReferenceTo(reference, sourcePath))) {
      addIssue(context, `STOP reason must reference ${description}`, [
        "decision",
        "reasons",
      ]);
    }
  };

  if (report.selection.status === "NOT_SELECTED") {
    requiresReference("/selection", "the no-selection record");
  }
  if (report.capability.availability !== "AVAILABLE") {
    requiresReference("/capability", "the unavailable Capability evidence");
  }
  if (report.simulation.availability !== "AVAILABLE") {
    requiresReference("/simulation", "the unavailable simulation evidence");
    validateCriticalAlignmentStopReasons(report, references, context);
    return;
  }

  const simulation = report.simulation;
  if (simulation.executionStatus !== "SUCCESS") {
    requiresReference("/simulation", "the non-successful simulation evidence");
  }

  const evidence = [
    ["receipts", simulation.receipts],
    ["outcomes", simulation.outcomes],
    ["warnings", simulation.warnings],
    ["coverage", simulation.coverage],
    ["ordering", simulation.ordering],
    ["stateContinuity", simulation.stateContinuity],
  ] as const;
  for (const [name, value] of evidence) {
    if (value.availability !== "AVAILABLE") {
      requiresReference(
        `/simulation/${name}`,
        `the unavailable simulation ${name} evidence`,
      );
    }
  }

  if (simulation.warnings.availability === "AVAILABLE") {
    const warningItemPrefix = "/simulation/warnings/items/";
    if (
      simulation.warnings.items.length > 0 &&
      !references.some((reference) => reference.startsWith(warningItemPrefix))
    ) {
      addIssue(
        context,
        "STOP reason must reference an original Warning record",
        ["decision", "reasons"],
      );
    }
  }
  if (simulation.receipts.availability === "AVAILABLE") {
    for (const [index, receipt] of simulation.receipts.items.entries()) {
      if (receipt.status === "FAILED") {
        requiresReference(
          `/simulation/receipts/items/${index}`,
          "the failed Receipt record",
        );
      }
    }
  }
  if (simulation.outcomes.availability === "AVAILABLE") {
    for (const [index, outcome] of simulation.outcomes.items.entries()) {
      if (outcome.status === "FAILED") {
        requiresReference(
          `/simulation/outcomes/items/${index}`,
          "the failed Outcome record",
        );
      }
    }
  }
  if (
    simulation.coverage.availability === "AVAILABLE" &&
    !simulation.coverage.complete
  ) {
    requiresReference("/simulation/coverage", "the incomplete coverage record");
  }
  if (
    simulation.ordering.availability === "AVAILABLE" &&
    !simulation.ordering.valid
  ) {
    requiresReference("/simulation/ordering", "the invalid ordering record");
  }
  if (
    simulation.stateContinuity.availability === "AVAILABLE" &&
    !simulation.stateContinuity.continuous
  ) {
    requiresReference(
      "/simulation/stateContinuity",
      "the interrupted state-continuity record",
    );
  }

  validateCriticalAlignmentStopReasons(report, references, context);
}

export const PreflightReportSchema = PreflightReportBaseSchema.superRefine(
  (report, context) => {
    const quoteIds = report.quotes.map((quote) => quote.quoteId);
    if (new Set(quoteIds).size !== quoteIds.length) {
      addIssue(context, "Quote identifiers must be unique", ["quotes"]);
    }

    const checkIds = report.alignment.checks.map((check) => check.checkId);
    if (new Set(checkIds).size !== checkIds.length) {
      addIssue(context, "Alignment check identifiers must be unique", [
        "alignment",
        "checks",
      ]);
    }

    validateSelection(report, context);
    validateManualReview(report, context);
    validateStopReasonReferences(report, context);

    for (const references of collectReferenceLists(report)) {
      for (const reference of references) {
        if (!isAllowedSourceReference(reference)) {
          addIssue(
            context,
            "Source reference targets a forbidden or derived report location",
            [],
          );
        } else if (!resolvesJsonPointer(report, reference)) {
          addIssue(
            context,
            "Source reference does not resolve within the report",
            [],
          );
        }
      }
    }
  },
);

export type Intent = z.infer<typeof IntentSchema>;
export type Alignment = z.infer<typeof AlignmentSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type PreflightReport = z.infer<typeof PreflightReportSchema>;
export type PreflightReportInput = z.input<typeof PreflightReportSchema>;
