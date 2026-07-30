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
  type StopReasonCodeV0_1,
} from "./evidence.js";
import type { JsonPointerSyntax } from "./references.js";
import {
  EvmAddressSchema,
  GeneratedAtSchema,
  MaxSlippageBpsSchema,
  NetworkSchema,
  PositiveAmountSchema,
  ProtocolIdSchema,
  ReportIdSchema,
} from "./scalars.js";
import {
  validateContextualSourceReferences,
  type SourceReferenceOccurrence,
} from "./source-reference-context.js";

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

const SourceReportShape = {
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
};

const DecisionInputBaseSchema = z.strictObject(SourceReportShape);
const PreflightReportBaseSchema = z.strictObject({
  ...SourceReportShape,
  decision: DecisionSchema,
  limitations: z.array(LimitationSchema),
});

type DecisionInputBase = z.infer<typeof DecisionInputBaseSchema>;
type ReportBase = z.infer<typeof PreflightReportBaseSchema>;

function assetsEqual(
  left: DecisionInputBase["intent"]["inputAsset"],
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

function addIssue(
  context: z.RefinementCtx,
  message: string,
  path: PropertyKey[],
): void {
  context.addIssue({ code: "custom", message, path });
}

function collectInputReferenceOccurrences(
  input: DecisionInputBase,
): SourceReferenceOccurrence[] {
  const occurrences: SourceReferenceOccurrence[] = [];
  const collect = (
    sourceReferences: readonly JsonPointerSyntax[],
    ownerPath: readonly (string | number)[],
  ): void => {
    for (const [index, pointer] of sourceReferences.entries()) {
      occurrences.push({
        pointer,
        ownerPath,
        metadataPath: [...ownerPath, "sourceReferences", index],
      });
    }
  };

  for (const [index, quote] of input.quotes.entries()) {
    if (quote.status === "FAILED") {
      collect(quote.failure.sourceReferences, ["quotes", index, "failure"]);
    }
  }
  collect(input.selection.reason.sourceReferences, ["selection", "reason"]);

  if (input.capability.availability !== "AVAILABLE") {
    collect(input.capability.failure.sourceReferences, [
      "capability",
      "failure",
    ]);
  }

  if (input.simulation.availability !== "AVAILABLE") {
    collect(input.simulation.failure.sourceReferences, [
      "simulation",
      "failure",
    ]);
  } else {
    const evidence = {
      receipts: input.simulation.receipts,
      outcomes: input.simulation.outcomes,
      warnings: input.simulation.warnings,
      coverage: input.simulation.coverage,
      ordering: input.simulation.ordering,
      stateContinuity: input.simulation.stateContinuity,
    };
    for (const [name, value] of Object.entries(evidence)) {
      if (value.availability !== "AVAILABLE") {
        collect(value.failure.sourceReferences, [
          "simulation",
          name,
          "failure",
        ]);
      }
    }
  }

  for (const [index, check] of input.alignment.checks.entries()) {
    collect(check.sourceReferences, ["alignment", "checks", index]);
  }

  return occurrences;
}

function collectReportReferenceOccurrences(
  report: ReportBase,
): SourceReferenceOccurrence[] {
  const occurrences = collectInputReferenceOccurrences(report);
  const collect = (
    sourceReferences: readonly JsonPointerSyntax[],
    ownerPath: readonly (string | number)[],
  ): void => {
    for (const [index, pointer] of sourceReferences.entries()) {
      occurrences.push({
        pointer,
        ownerPath,
        metadataPath: [...ownerPath, "sourceReferences", index],
      });
    }
  };

  if (report.decision.status === "STOP") {
    for (const [index, reason] of report.decision.reasons.entries()) {
      collect(reason.sourceReferences, ["decision", "reasons", index]);
    }
  }
  for (const [index, limitation] of report.limitations.entries()) {
    collect(limitation.sourceReferences, ["limitations", index]);
  }

  return occurrences;
}

function validateSelection(
  input: DecisionInputBase,
  context: z.RefinementCtx,
): void {
  const selection = input.selection;
  if (selection.status !== "SELECTED") {
    return;
  }

  if (!input.intent.allowedProtocols.includes(selection.protocolId)) {
    addIssue(context, "Selected protocol is not allowed by intent", [
      "selection",
      "protocolId",
    ]);
  }

  const quote = input.quotes.find(
    (candidate) => candidate.quoteId === selection.quoteId,
  );
  if (
    quote?.status !== "SUCCESS" ||
    quote.protocolId !== selection.protocolId ||
    quote.inputAmount !== input.intent.inputAmount ||
    !assetsEqual(input.intent.inputAsset, quote.inputAsset) ||
    !assetsEqual(input.intent.outputAsset, quote.outputAsset)
  ) {
    addIssue(context, "Selection must reference a matching successful quote", [
      "selection",
    ]);
  }
}

function validateInputInvariants(
  input: DecisionInputBase,
  context: z.RefinementCtx,
): void {
  const quoteIds = input.quotes.map((quote) => quote.quoteId);
  if (new Set(quoteIds).size !== quoteIds.length) {
    addIssue(context, "Quote identifiers must be unique", ["quotes"]);
  }

  const checkIds = input.alignment.checks.map((check) => check.checkId);
  if (new Set(checkIds).size !== checkIds.length) {
    addIssue(context, "Alignment check identifiers must be unique", [
      "alignment",
      "checks",
    ]);
  }

  validateSelection(input, context);
  for (const issue of validateContextualSourceReferences(
    input,
    collectInputReferenceOccurrences(input),
  )) {
    addIssue(context, issue.message, issue.path);
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

const STOP_REASON_RANK: Readonly<Record<StopReasonCodeV0_1, number>> = {
  NO_VALID_SELECTION: 10,
  CAPABILITY_FAILED: 20,
  CAPABILITY_MISSING: 21,
  CAPABILITY_UNPROVABLE: 22,
  SIMULATION_ACQUISITION_FAILED: 30,
  SIMULATION_MISSING: 31,
  SIMULATION_UNPROVABLE: 32,
  SIMULATION_EXECUTION_FAILED: 40,
  SIMULATION_INTERRUPTED: 41,
  WARNING_PRESENT: 50,
  RECEIPT_FAILED: 60,
  RECEIPT_SET_INCOMPLETE: 61,
  OUTCOME_FAILED: 70,
  OUTCOME_SET_INCOMPLETE: 71,
  COVERAGE_INCOMPLETE: 80,
  ORDERING_INVALID: 90,
  STATE_CONTINUITY_INTERRUPTED: 100,
  CRITICAL_ALIGNMENT_FAIL: 110,
  CRITICAL_ALIGNMENT_REVIEW: 111,
  REQUIRED_EVIDENCE_FAILED: 120,
  REQUIRED_EVIDENCE_MISSING: 121,
  REQUIRED_EVIDENCE_UNPROVABLE: 122,
};

const CAPABILITY_CODE_BY_AVAILABILITY: Readonly<
  Record<"FAILED" | "MISSING" | "UNPROVABLE", StopReasonCodeV0_1>
> = {
  FAILED: "CAPABILITY_FAILED",
  MISSING: "CAPABILITY_MISSING",
  UNPROVABLE: "CAPABILITY_UNPROVABLE",
};
const SIMULATION_CODE_BY_AVAILABILITY: Readonly<
  Record<"FAILED" | "MISSING" | "UNPROVABLE", StopReasonCodeV0_1>
> = {
  FAILED: "SIMULATION_ACQUISITION_FAILED",
  MISSING: "SIMULATION_MISSING",
  UNPROVABLE: "SIMULATION_UNPROVABLE",
};
const REQUIRED_EVIDENCE_CODE_BY_AVAILABILITY: Readonly<
  Record<"FAILED" | "MISSING" | "UNPROVABLE", StopReasonCodeV0_1>
> = {
  FAILED: "REQUIRED_EVIDENCE_FAILED",
  MISSING: "REQUIRED_EVIDENCE_MISSING",
  UNPROVABLE: "REQUIRED_EVIDENCE_UNPROVABLE",
};

type StopExpectations = Map<StopReasonCodeV0_1, Set<string>>;

function addStopExpectation(
  expectations: StopExpectations,
  code: StopReasonCodeV0_1,
  references: readonly string[],
): void {
  const existing = expectations.get(code) ?? new Set<string>();
  for (const reference of references) {
    existing.add(reference);
  }
  expectations.set(code, existing);
}

function collectStopExpectations(report: ReportBase): StopExpectations {
  const expectations: StopExpectations = new Map();

  if (report.selection.status === "NOT_SELECTED") {
    addStopExpectation(expectations, "NO_VALID_SELECTION", [
      "/selection/status",
    ]);
  }

  if (report.capability.availability !== "AVAILABLE") {
    addStopExpectation(
      expectations,
      CAPABILITY_CODE_BY_AVAILABILITY[report.capability.availability],
      ["/capability/availability"],
    );
  }

  if (report.simulation.availability !== "AVAILABLE") {
    addStopExpectation(
      expectations,
      SIMULATION_CODE_BY_AVAILABILITY[report.simulation.availability],
      ["/simulation/availability"],
    );
  } else {
    const simulation = report.simulation;
    if (simulation.executionStatus === "FAILED") {
      addStopExpectation(expectations, "SIMULATION_EXECUTION_FAILED", [
        "/simulation/executionStatus",
      ]);
    }
    if (simulation.executionStatus === "INTERRUPTED") {
      addStopExpectation(expectations, "SIMULATION_INTERRUPTED", [
        "/simulation/executionStatus",
      ]);
    }

    const components = {
      receipts: simulation.receipts,
      outcomes: simulation.outcomes,
      warnings: simulation.warnings,
      coverage: simulation.coverage,
      ordering: simulation.ordering,
      stateContinuity: simulation.stateContinuity,
    };
    for (const [name, evidence] of Object.entries(components)) {
      if (evidence.availability !== "AVAILABLE") {
        addStopExpectation(
          expectations,
          REQUIRED_EVIDENCE_CODE_BY_AVAILABILITY[evidence.availability],
          [`/simulation/${name}/availability`],
        );
      }
    }

    if (simulation.warnings.availability === "AVAILABLE") {
      const references = simulation.warnings.items.map(
        (_warning, index) => `/simulation/warnings/items/${index}`,
      );
      if (references.length > 0) {
        addStopExpectation(expectations, "WARNING_PRESENT", references);
      }
    }
    if (simulation.receipts.availability === "AVAILABLE") {
      if (simulation.receipts.items.length === 0) {
        addStopExpectation(expectations, "RECEIPT_SET_INCOMPLETE", [
          "/simulation/receipts/items",
        ]);
      }
      const references = simulation.receipts.items.flatMap((receipt, index) =>
        receipt.status === "FAILED"
          ? [`/simulation/receipts/items/${index}`]
          : [],
      );
      if (references.length > 0) {
        addStopExpectation(expectations, "RECEIPT_FAILED", references);
      }
    }
    if (simulation.outcomes.availability === "AVAILABLE") {
      if (simulation.outcomes.items.length === 0) {
        addStopExpectation(expectations, "OUTCOME_SET_INCOMPLETE", [
          "/simulation/outcomes/items",
        ]);
      }
      const references = simulation.outcomes.items.flatMap((outcome, index) =>
        outcome.status === "FAILED"
          ? [`/simulation/outcomes/items/${index}`]
          : [],
      );
      if (references.length > 0) {
        addStopExpectation(expectations, "OUTCOME_FAILED", references);
      }
    }
    if (
      simulation.coverage.availability === "AVAILABLE" &&
      !simulation.coverage.complete
    ) {
      addStopExpectation(expectations, "COVERAGE_INCOMPLETE", [
        "/simulation/coverage",
      ]);
    }
    if (
      simulation.ordering.availability === "AVAILABLE" &&
      !simulation.ordering.valid
    ) {
      addStopExpectation(expectations, "ORDERING_INVALID", [
        "/simulation/ordering",
      ]);
    }
    if (
      simulation.stateContinuity.availability === "AVAILABLE" &&
      !simulation.stateContinuity.continuous
    ) {
      addStopExpectation(expectations, "STATE_CONTINUITY_INTERRUPTED", [
        "/simulation/stateContinuity",
      ]);
    }
  }

  for (const check of report.alignment.checks) {
    if (!check.critical || check.status === "PASS") {
      continue;
    }
    addStopExpectation(
      expectations,
      check.status === "FAIL"
        ? "CRITICAL_ALIGNMENT_FAIL"
        : "CRITICAL_ALIGNMENT_REVIEW",
      check.sourceReferences,
    );
  }

  return expectations;
}

function validateStopReasonReferences(
  report: ReportBase,
  context: z.RefinementCtx,
): void {
  if (report.decision.status !== "STOP") {
    return;
  }

  const expectations = collectStopExpectations(report);
  const actual = new Map<StopReasonCodeV0_1, number>();
  let previousRank = -1;

  for (const [index, reason] of report.decision.reasons.entries()) {
    const rank = STOP_REASON_RANK[reason.code];
    if (rank <= previousRank) {
      addIssue(context, "STOP reasons must use canonical rank order", [
        "decision",
        "reasons",
        index,
        "code",
      ]);
    }
    previousRank = rank;

    if (actual.has(reason.code)) {
      addIssue(context, "A STOP reason code may appear only once", [
        "decision",
        "reasons",
        index,
        "code",
      ]);
      continue;
    }
    actual.set(reason.code, index);

    const expectedReferences = expectations.get(reason.code);
    if (expectedReferences === undefined) {
      addIssue(context, "STOP reason code has no matching trigger", [
        "decision",
        "reasons",
        index,
        "code",
      ]);
      continue;
    }
    for (const [
      referenceIndex,
      reference,
    ] of reason.sourceReferences.entries()) {
      if (!expectedReferences.has(reference)) {
        addIssue(
          context,
          "STOP source reference is not evidence for its owning reason code",
          ["decision", "reasons", index, "sourceReferences", referenceIndex],
        );
      }
    }
    const actualReferences = new Set<string>(reason.sourceReferences);
    for (const reference of expectedReferences) {
      if (!actualReferences.has(reference)) {
        addIssue(context, "STOP reason omits triggering evidence", [
          "decision",
          "reasons",
          index,
          "sourceReferences",
        ]);
      }
    }
  }

  for (const code of expectations.keys()) {
    if (!actual.has(code)) {
      addIssue(context, "STOP decision omits a triggered reason code", [
        "decision",
        "reasons",
      ]);
    }
  }
}

export const DecisionInputV0_1Schema = DecisionInputBaseSchema.superRefine(
  (input, context) => {
    validateInputInvariants(input, context);
  },
);

export const PreflightReportSchema = PreflightReportBaseSchema.superRefine(
  (report, context) => {
    validateInputInvariants(report, context);
    validateManualReview(report, context);
    validateStopReasonReferences(report, context);

    for (const issue of validateContextualSourceReferences(
      report,
      collectReportReferenceOccurrences(report),
    )) {
      addIssue(context, issue.message, issue.path);
    }
  },
);

export type Intent = z.infer<typeof IntentSchema>;
export type Alignment = z.infer<typeof AlignmentSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type DecisionInputV0_1 = z.infer<typeof DecisionInputV0_1Schema>;
export type PreflightReport = z.infer<typeof PreflightReportSchema>;
export type PreflightReportInput = z.input<typeof PreflightReportSchema>;
