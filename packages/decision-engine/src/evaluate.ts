import type {
  Decision as DecisionV0_1,
  DecisionInputV0_1,
  StopReasonCodeV0_1,
  StopReasonV0_1,
} from "@moss-mini-demo/report-schema";
import { parseDecisionInputV0_1 } from "./input-boundary.js";

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

const CAPABILITY_CODE_BY_AVAILABILITY = {
  FAILED: "CAPABILITY_FAILED",
  MISSING: "CAPABILITY_MISSING",
  UNPROVABLE: "CAPABILITY_UNPROVABLE",
} as const satisfies Readonly<
  Record<"FAILED" | "MISSING" | "UNPROVABLE", StopReasonCodeV0_1>
>;

const SIMULATION_CODE_BY_AVAILABILITY = {
  FAILED: "SIMULATION_ACQUISITION_FAILED",
  MISSING: "SIMULATION_MISSING",
  UNPROVABLE: "SIMULATION_UNPROVABLE",
} as const satisfies Readonly<
  Record<"FAILED" | "MISSING" | "UNPROVABLE", StopReasonCodeV0_1>
>;

const REQUIRED_EVIDENCE_CODE_BY_AVAILABILITY = {
  FAILED: "REQUIRED_EVIDENCE_FAILED",
  MISSING: "REQUIRED_EVIDENCE_MISSING",
  UNPROVABLE: "REQUIRED_EVIDENCE_UNPROVABLE",
} as const satisfies Readonly<
  Record<"FAILED" | "MISSING" | "UNPROVABLE", StopReasonCodeV0_1>
>;

type StopReasons = Map<StopReasonCodeV0_1, Set<string>>;

function addReason(
  reasons: StopReasons,
  code: StopReasonCodeV0_1,
  references: readonly string[],
): void {
  const aggregate = reasons.get(code) ?? new Set<string>();
  for (const reference of references) {
    aggregate.add(reference);
  }
  reasons.set(code, aggregate);
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const sharedLength = Math.min(leftBytes.length, rightBytes.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return leftBytes.length - rightBytes.length;
}

function collectReasons(input: DecisionInputV0_1): StopReasons {
  const reasons: StopReasons = new Map();

  if (input.selection.status === "NOT_SELECTED") {
    addReason(reasons, "NO_VALID_SELECTION", ["/selection/status"]);
  }

  if (input.capability.availability !== "AVAILABLE") {
    addReason(
      reasons,
      CAPABILITY_CODE_BY_AVAILABILITY[input.capability.availability],
      ["/capability/availability"],
    );
  }

  if (input.simulation.availability !== "AVAILABLE") {
    addReason(
      reasons,
      SIMULATION_CODE_BY_AVAILABILITY[input.simulation.availability],
      ["/simulation/availability"],
    );
  } else {
    const simulation = input.simulation;

    if (simulation.executionStatus === "FAILED") {
      addReason(reasons, "SIMULATION_EXECUTION_FAILED", [
        "/simulation/executionStatus",
      ]);
    }
    if (simulation.executionStatus === "INTERRUPTED") {
      addReason(reasons, "SIMULATION_INTERRUPTED", [
        "/simulation/executionStatus",
      ]);
    }

    const components = [
      ["warnings", simulation.warnings],
      ["receipts", simulation.receipts],
      ["outcomes", simulation.outcomes],
      ["coverage", simulation.coverage],
      ["ordering", simulation.ordering],
      ["stateContinuity", simulation.stateContinuity],
    ] as const;

    for (const [name, evidence] of components) {
      if (evidence.availability !== "AVAILABLE") {
        addReason(
          reasons,
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
        addReason(reasons, "WARNING_PRESENT", references);
      }
    }

    if (simulation.receipts.availability === "AVAILABLE") {
      if (simulation.receipts.items.length === 0) {
        addReason(reasons, "RECEIPT_SET_INCOMPLETE", [
          "/simulation/receipts/items",
        ]);
      }
      const references = simulation.receipts.items.flatMap((receipt, index) =>
        receipt.status === "FAILED"
          ? [`/simulation/receipts/items/${index}`]
          : [],
      );
      if (references.length > 0) {
        addReason(reasons, "RECEIPT_FAILED", references);
      }
    }

    if (simulation.outcomes.availability === "AVAILABLE") {
      if (simulation.outcomes.items.length === 0) {
        addReason(reasons, "OUTCOME_SET_INCOMPLETE", [
          "/simulation/outcomes/items",
        ]);
      }
      const references = simulation.outcomes.items.flatMap((outcome, index) =>
        outcome.status === "FAILED"
          ? [`/simulation/outcomes/items/${index}`]
          : [],
      );
      if (references.length > 0) {
        addReason(reasons, "OUTCOME_FAILED", references);
      }
    }

    if (
      simulation.coverage.availability === "AVAILABLE" &&
      !simulation.coverage.complete
    ) {
      addReason(reasons, "COVERAGE_INCOMPLETE", ["/simulation/coverage"]);
    }

    if (
      simulation.ordering.availability === "AVAILABLE" &&
      !simulation.ordering.valid
    ) {
      addReason(reasons, "ORDERING_INVALID", ["/simulation/ordering"]);
    }

    if (
      simulation.stateContinuity.availability === "AVAILABLE" &&
      !simulation.stateContinuity.continuous
    ) {
      addReason(reasons, "STATE_CONTINUITY_INTERRUPTED", [
        "/simulation/stateContinuity",
      ]);
    }
  }

  for (const check of input.alignment.checks) {
    if (!check.critical || check.status === "PASS") {
      continue;
    }
    addReason(
      reasons,
      check.status === "FAIL"
        ? "CRITICAL_ALIGNMENT_FAIL"
        : "CRITICAL_ALIGNMENT_REVIEW",
      check.sourceReferences,
    );
  }

  return reasons;
}

function buildDecision(reasons: StopReasons): DecisionV0_1 {
  if (reasons.size === 0) {
    return { status: "MANUAL_REVIEW" };
  }

  const canonicalReasons: StopReasonV0_1[] = [...reasons].map(
    ([code, references]) => ({
      code,
      sourceReferences: [...references].sort(
        compareUtf8,
      ) as StopReasonV0_1["sourceReferences"],
    }),
  );
  canonicalReasons.sort(
    (left, right) => STOP_REASON_RANK[left.code] - STOP_REASON_RANK[right.code],
  );

  return { status: "STOP", reasons: canonicalReasons };
}

export function evaluateDecisionV0_1(input: unknown): DecisionV0_1 {
  return buildDecision(collectReasons(parseDecisionInputV0_1(input)));
}
