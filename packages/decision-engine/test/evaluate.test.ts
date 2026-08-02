import type {
  DecisionInputV0_1,
  StopReasonCodeV0_1,
} from "@moss-mini-demo/report-schema";
import { RecordIdSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import { DecisionInputErrorV0_1, evaluateDecisionV0_1 } from "../src/index.js";
import {
  availableSimulation,
  buildManualReviewInput,
  pointer,
  unavailable,
} from "./synthetic.js";

function firstAlignment(input: DecisionInputV0_1) {
  const [check] = input.alignment.checks;
  if (check === undefined) {
    throw new Error("synthetic critical Alignment is missing");
  }
  return check;
}

function expectSingleStop(
  input: DecisionInputV0_1,
  code: StopReasonCodeV0_1,
): void {
  const decision = evaluateDecisionV0_1(input);
  expect(decision.status).toBe("STOP");
  if (decision.status !== "STOP") {
    throw new Error("expected a STOP Decision");
  }
  expect(decision.reasons.map((reason) => reason.code)).toEqual([code]);
}

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  Object.freeze(value);
}

describe("MANUAL_REVIEW boundary", () => {
  it("returns the exact no-reasons shape", () => {
    expect(evaluateDecisionV0_1(buildManualReviewInput())).toEqual({
      status: "MANUAL_REVIEW",
    });
    expect(Object.keys(evaluateDecisionV0_1(buildManualReviewInput()))).toEqual(
      ["status"],
    );
  });

  it("requires a selected protocol", () => {
    const input = buildManualReviewInput();
    input.selection = {
      status: "NOT_SELECTED",
      reason: {
        code: input.selection.reason.code,
        sourceReferences: [pointer("/quotes/0")],
      },
    };
    expectSingleStop(input, "NO_VALID_SELECTION");
  });

  it("requires available Capability evidence", () => {
    const input = buildManualReviewInput();
    input.capability = unavailable("MISSING", [pointer("/intent")]);
    expectSingleStop(input, "CAPABILITY_MISSING");
  });

  it("requires available simulation evidence", () => {
    const input = buildManualReviewInput();
    input.simulation = unavailable("MISSING", [pointer("/capability")]);
    expectSingleStop(input, "SIMULATION_MISSING");
  });

  it("requires successful simulation execution", () => {
    const input = buildManualReviewInput();
    availableSimulation(input).executionStatus = "FAILED";
    expectSingleStop(input, "SIMULATION_EXECUTION_FAILED");
  });

  it("requires an empty available Warning collection", () => {
    const input = buildManualReviewInput();
    const warnings = availableSimulation(input).warnings;
    if (warnings.availability !== "AVAILABLE") {
      throw new Error("synthetic Warnings are unavailable");
    }
    warnings.items = [{ source: "synthetic-warning" }];
    expectSingleStop(input, "WARNING_PRESENT");
  });

  it.each(["receipts", "outcomes"] as const)(
    "requires non-empty %s",
    (component) => {
      const input = buildManualReviewInput();
      const evidence = availableSimulation(input)[component];
      if (evidence.availability !== "AVAILABLE") {
        throw new Error(`synthetic ${component} are unavailable`);
      }
      evidence.items = [];
      expectSingleStop(
        input,
        component === "receipts"
          ? "RECEIPT_SET_INCOMPLETE"
          : "OUTCOME_SET_INCOMPLETE",
      );
    },
  );

  it.each(["receipts", "outcomes"] as const)(
    "requires successful %s records",
    (component) => {
      const input = buildManualReviewInput();
      const evidence = availableSimulation(input)[component];
      if (evidence.availability !== "AVAILABLE") {
        throw new Error(`synthetic ${component} are unavailable`);
      }
      evidence.items[0] = {
        status: "FAILED",
        raw: { source: `synthetic-failed-${component}` },
      };
      expectSingleStop(
        input,
        component === "receipts" ? "RECEIPT_FAILED" : "OUTCOME_FAILED",
      );
    },
  );

  it.each([
    ["coverage", "complete", "COVERAGE_INCOMPLETE"],
    ["ordering", "valid", "ORDERING_INVALID"],
    ["stateContinuity", "continuous", "STATE_CONTINUITY_INTERRUPTED"],
  ] as const)("requires favorable %s evidence", (component, field, code) => {
    const input = buildManualReviewInput();
    const evidence = availableSimulation(input)[component];
    if (evidence.availability !== "AVAILABLE") {
      throw new Error(`synthetic ${component} is unavailable`);
    }
    (evidence as unknown as Record<string, boolean>)[field] = false;
    expectSingleStop(input, code);
  });

  it.each(["FAIL", "REVIEW"] as const)(
    "requires PASS for critical Alignment, not %s",
    (status) => {
      const input = buildManualReviewInput();
      firstAlignment(input).status = status;
      expectSingleStop(
        input,
        status === "FAIL"
          ? "CRITICAL_ALIGNMENT_FAIL"
          : "CRITICAL_ALIGNMENT_REVIEW",
      );
    },
  );

  it("rejects the absence of any critical Alignment check", () => {
    const input = buildManualReviewInput();
    firstAlignment(input).critical = false;

    expect(() => evaluateDecisionV0_1(input)).toThrowError(
      expect.objectContaining({
        code: "INVALID_DECISION_INPUT",
      }),
    );
  });

  it("does not promote non-critical FAIL or REVIEW into STOP", () => {
    for (const status of ["FAIL", "REVIEW"] as const) {
      const input = buildManualReviewInput();
      input.alignment.checks.push({
        ...firstAlignment(input),
        checkId: RecordIdSchema.parse(`synthetic-non-critical-${status}`),
        critical: false,
        status,
      });
      expect(evaluateDecisionV0_1(input)).toEqual({
        status: "MANUAL_REVIEW",
      });
    }
  });
});

describe("canonical STOP output", () => {
  it("evaluates all rules and sorts multiple reasons by ADR rank", () => {
    const input = buildManualReviewInput();
    input.selection = {
      status: "NOT_SELECTED",
      reason: {
        code: input.selection.reason.code,
        sourceReferences: [pointer("/quotes/0")],
      },
    };
    input.capability = unavailable("MISSING", [pointer("/intent")]);
    const simulation = availableSimulation(input);
    simulation.executionStatus = "FAILED";
    if (
      simulation.warnings.availability !== "AVAILABLE" ||
      simulation.receipts.availability !== "AVAILABLE" ||
      simulation.coverage.availability !== "AVAILABLE" ||
      simulation.ordering.availability !== "AVAILABLE" ||
      simulation.stateContinuity.availability !== "AVAILABLE"
    ) {
      throw new Error("synthetic evidence is unavailable");
    }
    simulation.warnings.items = [{ source: "synthetic-warning" }];
    simulation.receipts.items[0] = {
      status: "FAILED",
      raw: { source: "synthetic-failed-receipt" },
    };
    simulation.outcomes = unavailable("MISSING", [pointer("/simulation/raw")]);
    simulation.coverage.complete = false;
    simulation.ordering.valid = false;
    simulation.stateContinuity.continuous = false;
    firstAlignment(input).status = "FAIL";

    const decision = evaluateDecisionV0_1(input);
    expect(decision.status).toBe("STOP");
    if (decision.status !== "STOP") {
      throw new Error("expected a STOP Decision");
    }
    expect(decision.reasons.map((reason) => reason.code)).toEqual([
      "NO_VALID_SELECTION",
      "CAPABILITY_MISSING",
      "SIMULATION_EXECUTION_FAILED",
      "WARNING_PRESENT",
      "RECEIPT_FAILED",
      "COVERAGE_INCOMPLETE",
      "ORDERING_INVALID",
      "STATE_CONTINUITY_INTERRUPTED",
      "CRITICAL_ALIGNMENT_FAIL",
      "REQUIRED_EVIDENCE_MISSING",
    ]);
  });

  it("lets one mandatory STOP override otherwise favorable evidence", () => {
    const input = buildManualReviewInput();
    firstAlignment(input).status = "FAIL";
    expectSingleStop(input, "CRITICAL_ALIGNMENT_FAIL");
    expect(availableSimulation(input).executionStatus).toBe("SUCCESS");
  });

  it("sorts references by UTF-8 bytes rather than UTF-16 code units", () => {
    const input = buildManualReviewInput();
    const check = firstAlignment(input);
    check.status = "FAIL";
    check.sourceReferences = [
      pointer("/capability/raw/😀"),
      pointer("/capability/raw/\uE000"),
    ];

    expect(evaluateDecisionV0_1(input)).toEqual({
      status: "STOP",
      reasons: [
        {
          code: "CRITICAL_ALIGNMENT_FAIL",
          sourceReferences: ["/capability/raw/\uE000", "/capability/raw/😀"],
        },
      ],
    });
  });
});

describe("purity and determinism", () => {
  it("does not mutate a deeply frozen input", () => {
    const input = buildManualReviewInput();
    const before = structuredClone(input);
    deepFreeze(input);

    expect(evaluateDecisionV0_1(input)).toEqual({ status: "MANUAL_REVIEW" });
    expect(input).toEqual(before);
  });

  it("returns deeply equal fresh output across repeated evaluation", () => {
    const input = buildManualReviewInput();
    firstAlignment(input).status = "FAIL";
    const first = evaluateDecisionV0_1(input);
    const second = evaluateDecisionV0_1(input);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    if (first.status === "STOP" && second.status === "STOP") {
      expect(second.reasons).not.toBe(first.reasons);
    }
  });

  it("ignores object property insertion order", () => {
    const input = buildManualReviewInput();
    firstAlignment(input).status = "FAIL";
    const reordered = Object.fromEntries(Object.entries(input).reverse());

    expect(evaluateDecisionV0_1(reordered)).toEqual(
      evaluateDecisionV0_1(input),
    );
  });

  it("is synchronous and does not read clock, randomness, or fetch", () => {
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("clock access is forbidden");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("random access is forbidden");
    });
    vi.stubGlobal("fetch", () => {
      throw new Error("network access is forbidden");
    });

    try {
      const decision = evaluateDecisionV0_1(buildManualReviewInput());
      expect(decision).toEqual({ status: "MANUAL_REVIEW" });
      expect(decision).not.toBeInstanceOf(Promise);
      expect(dateNow).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
      random.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("exposes input errors only through the stable public class", () => {
    expect(() => evaluateDecisionV0_1({ schemaVersion: "0.2" })).toThrow(
      DecisionInputErrorV0_1,
    );
  });
});
