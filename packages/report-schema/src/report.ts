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
import { decodeJsonPointer, type JsonPointerSyntax } from "./references.js";
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

function collectReferenceOccurrences(
  report: ReportBase,
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

  for (const [index, quote] of report.quotes.entries()) {
    if (quote.status === "FAILED") {
      collect(quote.failure.sourceReferences, ["quotes", index, "failure"]);
    }
  }
  collect(report.selection.reason.sourceReferences, ["selection", "reason"]);

  if (report.capability.availability !== "AVAILABLE") {
    collect(report.capability.failure.sourceReferences, [
      "capability",
      "failure",
    ]);
  }

  if (report.simulation.availability !== "AVAILABLE") {
    collect(report.simulation.failure.sourceReferences, [
      "simulation",
      "failure",
    ]);
  } else {
    const evidence = {
      receipts: report.simulation.receipts,
      outcomes: report.simulation.outcomes,
      warnings: report.simulation.warnings,
      coverage: report.simulation.coverage,
      ordering: report.simulation.ordering,
      stateContinuity: report.simulation.stateContinuity,
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

  for (const [index, check] of report.alignment.checks.entries()) {
    collect(check.sourceReferences, ["alignment", "checks", index]);
  }
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

interface StopTrigger {
  description: string;
  matches: (targetPath: readonly string[]) => boolean;
}

function pathIsAtOrBelow(
  targetPath: readonly string[],
  sourcePath: readonly string[],
): boolean {
  return (
    sourcePath.length <= targetPath.length &&
    sourcePath.every((segment, index) => targetPath[index] === segment)
  );
}

function pathEquals(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => right[index] === segment)
  );
}

function sourceRecordTrigger(
  description: string,
  sourcePath: readonly string[],
): StopTrigger {
  return {
    description,
    matches: (targetPath) => pathIsAtOrBelow(targetPath, sourcePath),
  };
}

function collectStopTriggers(report: ReportBase): StopTrigger[] {
  const triggers: StopTrigger[] = [];

  if (report.selection.status === "NOT_SELECTED") {
    triggers.push(
      sourceRecordTrigger("the no-selection record", ["selection"]),
    );
  }
  if (report.capability.availability !== "AVAILABLE") {
    triggers.push(
      sourceRecordTrigger("the unavailable Capability evidence", [
        "capability",
      ]),
    );
  }

  if (report.simulation.availability !== "AVAILABLE") {
    triggers.push(
      sourceRecordTrigger("the unavailable simulation evidence", [
        "simulation",
      ]),
    );
  } else {
    const simulation = report.simulation;
    if (simulation.executionStatus !== "SUCCESS") {
      triggers.push({
        description: "the non-successful simulation execution",
        matches: (targetPath) =>
          pathEquals(targetPath, ["simulation"]) ||
          pathIsAtOrBelow(targetPath, ["simulation", "executionStatus"]) ||
          pathIsAtOrBelow(targetPath, ["simulation", "raw"]),
      });
    }

    const components = {
      receipts: simulation.receipts,
      outcomes: simulation.outcomes,
      warnings: simulation.warnings,
      coverage: simulation.coverage,
      ordering: simulation.ordering,
      stateContinuity: simulation.stateContinuity,
    };
    for (const [name, value] of Object.entries(components)) {
      if (value.availability !== "AVAILABLE") {
        triggers.push(
          sourceRecordTrigger(`the unavailable ${name} evidence`, [
            "simulation",
            name,
          ]),
        );
      }
    }

    if (simulation.warnings.availability === "AVAILABLE") {
      for (const [index] of simulation.warnings.items.entries()) {
        triggers.push(
          sourceRecordTrigger("an original Warning record", [
            "simulation",
            "warnings",
            "items",
            String(index),
          ]),
        );
      }
    }
    if (simulation.receipts.availability === "AVAILABLE") {
      if (simulation.receipts.items.length === 0) {
        triggers.push(
          sourceRecordTrigger("the empty Receipt collection", [
            "simulation",
            "receipts",
          ]),
        );
      }
      for (const [index, receipt] of simulation.receipts.items.entries()) {
        if (receipt.status === "FAILED") {
          triggers.push(
            sourceRecordTrigger("the failed Receipt record", [
              "simulation",
              "receipts",
              "items",
              String(index),
            ]),
          );
        }
      }
    }
    if (simulation.outcomes.availability === "AVAILABLE") {
      if (simulation.outcomes.items.length === 0) {
        triggers.push(
          sourceRecordTrigger("the empty Outcome collection", [
            "simulation",
            "outcomes",
          ]),
        );
      }
      for (const [index, outcome] of simulation.outcomes.items.entries()) {
        if (outcome.status === "FAILED") {
          triggers.push(
            sourceRecordTrigger("the failed Outcome record", [
              "simulation",
              "outcomes",
              "items",
              String(index),
            ]),
          );
        }
      }
    }
    if (
      simulation.coverage.availability === "AVAILABLE" &&
      !simulation.coverage.complete
    ) {
      triggers.push(
        sourceRecordTrigger("the incomplete coverage record", [
          "simulation",
          "coverage",
        ]),
      );
    }
    if (
      simulation.ordering.availability === "AVAILABLE" &&
      !simulation.ordering.valid
    ) {
      triggers.push(
        sourceRecordTrigger("the invalid ordering record", [
          "simulation",
          "ordering",
        ]),
      );
    }
    if (
      simulation.stateContinuity.availability === "AVAILABLE" &&
      !simulation.stateContinuity.continuous
    ) {
      triggers.push(
        sourceRecordTrigger("the interrupted state-continuity record", [
          "simulation",
          "stateContinuity",
        ]),
      );
    }
  }

  for (const check of report.alignment.checks) {
    if (check.critical && check.status !== "PASS") {
      for (const sourceReference of check.sourceReferences) {
        const sourcePath = decodeJsonPointer(sourceReference);
        triggers.push({
          description:
            "each source record underlying a critical alignment failure",
          matches: (targetPath) => pathIsAtOrBelow(targetPath, sourcePath),
        });
      }
    }
  }

  return triggers;
}

function validateStopReasonReferences(
  report: ReportBase,
  context: z.RefinementCtx,
): void {
  if (report.decision.status !== "STOP") {
    return;
  }

  const triggers = collectStopTriggers(report);
  const references = report.decision.reasons.flatMap((reason, reasonIndex) =>
    reason.sourceReferences.map((pointer, referenceIndex) => ({
      pointer,
      targetPath: decodeJsonPointer(pointer),
      path: [
        "decision",
        "reasons",
        reasonIndex,
        "sourceReferences",
        referenceIndex,
      ],
    })),
  );

  for (const trigger of triggers) {
    if (!references.some(({ targetPath }) => trigger.matches(targetPath))) {
      addIssue(context, `STOP reason must reference ${trigger.description}`, [
        "decision",
        "reasons",
      ]);
    }
  }
  for (const reference of references) {
    if (!triggers.some((trigger) => trigger.matches(reference.targetPath))) {
      addIssue(
        context,
        "STOP source reference is unrelated to every actual STOP trigger",
        reference.path,
      );
    }
  }
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

    const occurrences = collectReferenceOccurrences(report);
    for (const issue of validateContextualSourceReferences(
      report,
      occurrences,
    )) {
      addIssue(context, issue.message, issue.path);
    }
  },
);

export type Intent = z.infer<typeof IntentSchema>;
export type Alignment = z.infer<typeof AlignmentSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type PreflightReport = z.infer<typeof PreflightReportSchema>;
export type PreflightReportInput = z.input<typeof PreflightReportSchema>;
