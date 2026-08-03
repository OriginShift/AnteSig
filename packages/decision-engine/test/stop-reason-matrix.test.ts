import {
  PreflightReportSchema,
  RecordIdSchema,
  type DecisionInputV0_1,
  type StopReasonCodeV0_1,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import { evaluateDecisionV0_1 } from "../src/index.js";
import {
  availableSimulation,
  buildManualReviewInput,
  buildReport,
  pointer,
  unavailable,
} from "./synthetic.js";

type ComponentName =
  | "warnings"
  | "receipts"
  | "outcomes"
  | "coverage"
  | "ordering"
  | "stateContinuity";
type UnavailableStatus = "FAILED" | "MISSING" | "UNPROVABLE";

interface StopTriggerCase {
  code: StopReasonCodeV0_1;
  rank: number;
  references: string[];
  mutate: (input: DecisionInputV0_1) => void;
}

const COMPONENTS: ComponentName[] = [
  "warnings",
  "receipts",
  "outcomes",
  "coverage",
  "ordering",
  "stateContinuity",
];
const UNAVAILABLE_STATUSES: UnavailableStatus[] = [
  "FAILED",
  "MISSING",
  "UNPROVABLE",
];

function firstAlignment(input: DecisionInputV0_1) {
  const [check] = input.alignment.checks;
  if (check === undefined) {
    throw new Error("synthetic critical Alignment is missing");
  }
  return check;
}

function setComponentUnavailable(
  input: DecisionInputV0_1,
  component: ComponentName,
  status: UnavailableStatus,
): void {
  const simulation = availableSimulation(input) as unknown as Record<
    ComponentName,
    unknown
  >;
  simulation[component] = unavailable(status, [pointer("/simulation/raw")]);
}

const STOP_TRIGGER_CASES: StopTriggerCase[] = [
  {
    code: "NO_VALID_SELECTION",
    rank: 10,
    references: ["/selection/status"],
    mutate: (input) => {
      input.selection = {
        status: "NOT_SELECTED",
        reason: {
          code: input.selection.reason.code,
          sourceReferences: [pointer("/quotes/0")],
        },
      };
    },
  },
  ...(["FAILED", "MISSING", "UNPROVABLE"] as const).map(
    (status, index): StopTriggerCase => ({
      code: (
        {
          FAILED: "CAPABILITY_FAILED",
          MISSING: "CAPABILITY_MISSING",
          UNPROVABLE: "CAPABILITY_UNPROVABLE",
        } as const
      )[status],
      rank: 20 + index,
      references: ["/capability/availability"],
      mutate: (input) => {
        input.capability = unavailable(status, [pointer("/intent")]);
      },
    }),
  ),
  ...(["FAILED", "MISSING", "UNPROVABLE"] as const).map(
    (status, index): StopTriggerCase => ({
      code: (
        {
          FAILED: "SIMULATION_ACQUISITION_FAILED",
          MISSING: "SIMULATION_MISSING",
          UNPROVABLE: "SIMULATION_UNPROVABLE",
        } as const
      )[status],
      rank: 30 + index,
      references: ["/simulation/availability"],
      mutate: (input) => {
        input.simulation = unavailable(status, [pointer("/capability")]);
      },
    }),
  ),
  {
    code: "SIMULATION_EXECUTION_FAILED",
    rank: 40,
    references: ["/simulation/executionStatus"],
    mutate: (input) => {
      availableSimulation(input).executionStatus = "FAILED";
    },
  },
  {
    code: "SIMULATION_INTERRUPTED",
    rank: 41,
    references: ["/simulation/executionStatus"],
    mutate: (input) => {
      availableSimulation(input).executionStatus = "INTERRUPTED";
    },
  },
  {
    code: "WARNING_PRESENT",
    rank: 50,
    references: ["/simulation/warnings/items/0"],
    mutate: (input) => {
      const warnings = availableSimulation(input).warnings;
      if (warnings.availability !== "AVAILABLE") {
        throw new Error("synthetic Warnings are unavailable");
      }
      warnings.items = [{ source: "synthetic-warning" }];
    },
  },
  {
    code: "RECEIPT_FAILED",
    rank: 60,
    references: ["/simulation/receipts/items/0"],
    mutate: (input) => {
      const receipts = availableSimulation(input).receipts;
      if (receipts.availability !== "AVAILABLE") {
        throw new Error("synthetic Receipts are unavailable");
      }
      receipts.items[0] = {
        status: "FAILED",
        raw: { source: "synthetic-failed-receipt" },
      };
    },
  },
  {
    code: "RECEIPT_SET_INCOMPLETE",
    rank: 61,
    references: ["/simulation/receipts/items"],
    mutate: (input) => {
      const receipts = availableSimulation(input).receipts;
      if (receipts.availability !== "AVAILABLE") {
        throw new Error("synthetic Receipts are unavailable");
      }
      receipts.items = [];
    },
  },
  {
    code: "OUTCOME_FAILED",
    rank: 70,
    references: ["/simulation/outcomes/items/0"],
    mutate: (input) => {
      const outcomes = availableSimulation(input).outcomes;
      if (outcomes.availability !== "AVAILABLE") {
        throw new Error("synthetic Outcomes are unavailable");
      }
      outcomes.items[0] = {
        status: "FAILED",
        raw: { source: "synthetic-failed-outcome" },
      };
    },
  },
  {
    code: "OUTCOME_SET_INCOMPLETE",
    rank: 71,
    references: ["/simulation/outcomes/items"],
    mutate: (input) => {
      const outcomes = availableSimulation(input).outcomes;
      if (outcomes.availability !== "AVAILABLE") {
        throw new Error("synthetic Outcomes are unavailable");
      }
      outcomes.items = [];
    },
  },
  {
    code: "COVERAGE_INCOMPLETE",
    rank: 80,
    references: ["/simulation/coverage"],
    mutate: (input) => {
      const coverage = availableSimulation(input).coverage;
      if (coverage.availability !== "AVAILABLE") {
        throw new Error("synthetic coverage is unavailable");
      }
      coverage.complete = false;
    },
  },
  {
    code: "ORDERING_INVALID",
    rank: 90,
    references: ["/simulation/ordering"],
    mutate: (input) => {
      const ordering = availableSimulation(input).ordering;
      if (ordering.availability !== "AVAILABLE") {
        throw new Error("synthetic ordering is unavailable");
      }
      ordering.valid = false;
    },
  },
  {
    code: "STATE_CONTINUITY_INTERRUPTED",
    rank: 100,
    references: ["/simulation/stateContinuity"],
    mutate: (input) => {
      const continuity = availableSimulation(input).stateContinuity;
      if (continuity.availability !== "AVAILABLE") {
        throw new Error("synthetic state continuity is unavailable");
      }
      continuity.continuous = false;
    },
  },
  {
    code: "CRITICAL_ALIGNMENT_FAIL",
    rank: 110,
    references: ["/intent/inputAmount", "/simulation/raw"],
    mutate: (input) => {
      const check = firstAlignment(input);
      check.status = "FAIL";
      check.sourceReferences = [
        pointer("/intent/inputAmount"),
        pointer("/simulation/raw"),
      ];
    },
  },
  {
    code: "CRITICAL_ALIGNMENT_REVIEW",
    rank: 111,
    references: ["/intent/inputAmount", "/simulation/raw"],
    mutate: (input) => {
      const check = firstAlignment(input);
      check.status = "REVIEW";
      check.sourceReferences = [
        pointer("/intent/inputAmount"),
        pointer("/simulation/raw"),
      ];
    },
  },
  ...(["FAILED", "MISSING", "UNPROVABLE"] as const).map(
    (status, index): StopTriggerCase => ({
      code: (
        {
          FAILED: "REQUIRED_EVIDENCE_FAILED",
          MISSING: "REQUIRED_EVIDENCE_MISSING",
          UNPROVABLE: "REQUIRED_EVIDENCE_UNPROVABLE",
        } as const
      )[status],
      rank: 120 + index,
      references: [`/simulation/warnings/availability`],
      mutate: (input) => {
        setComponentUnavailable(input, "warnings", status);
      },
    }),
  ),
];

function evaluateCase(testCase: StopTriggerCase) {
  const input = buildManualReviewInput();
  testCase.mutate(input);
  const decision = evaluateDecisionV0_1(input);

  expect(decision).toEqual({
    status: "STOP",
    reasons: [
      {
        code: testCase.code,
        sourceReferences: testCase.references,
      },
    ],
  });
  return { input, decision };
}

function firstReason(report: unknown): Record<string, unknown> {
  const decision = (report as { decision: { reasons: unknown[] } }).decision;
  const [reason] = decision.reasons;
  if (typeof reason !== "object" || reason === null) {
    throw new Error("synthetic STOP reason is missing");
  }
  return reason as Record<string, unknown>;
}

describe.each(STOP_TRIGGER_CASES)("STOP reason $code", (testCase) => {
  it(`emits rank ${testCase.rank} with exact canonical references`, () => {
    const { input, decision } = evaluateCase(testCase);
    expect(
      PreflightReportSchema.safeParse(buildReport(input, decision)).success,
    ).toBe(true);
  });

  it("rejects an omitted reason reference list", () => {
    const { input, decision } = evaluateCase(testCase);
    const report = structuredClone(buildReport(input, decision));
    delete firstReason(report).sourceReferences;

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it.each([
    ["empty", []],
    ["dangling", ["/quotes/99"]],
    ["unrelated", ["/intent"]],
    ["metadata", ["/selection/reason/sourceReferences/0"]],
    ["decision target", ["/decision"]],
    ["limitations target", ["/limitations"]],
    ["alignment target", ["/alignment/checks/0"]],
    ["self-reference", ["/decision/reasons/0"]],
    ["obsolete raw collection", ["/simulation/receipts/raw/0"]],
  ])("rejects %s reason associations", (_name, references) => {
    const { input, decision } = evaluateCase(testCase);
    const report = structuredClone(buildReport(input, decision));
    firstReason(report).sourceReferences = references;

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });
});

describe("required evidence availability matrix", () => {
  it.each(
    COMPONENTS.flatMap((component) =>
      UNAVAILABLE_STATUSES.map((status) => ({ component, status })),
    ),
  )(
    "maps $component $status to its code-owned reference",
    ({ component, status }) => {
      const input = buildManualReviewInput();
      setComponentUnavailable(input, component, status);

      expect(evaluateDecisionV0_1(input)).toEqual({
        status: "STOP",
        reasons: [
          {
            code: (
              {
                FAILED: "REQUIRED_EVIDENCE_FAILED",
                MISSING: "REQUIRED_EVIDENCE_MISSING",
                UNPROVABLE: "REQUIRED_EVIDENCE_UNPROVABLE",
              } as const
            )[status],
            sourceReferences: [`/simulation/${component}/availability`],
          },
        ],
      });
    },
  );
});

describe("same-code aggregation", () => {
  it("aggregates every Warning item", () => {
    const input = buildManualReviewInput();
    const warnings = availableSimulation(input).warnings;
    if (warnings.availability !== "AVAILABLE") {
      throw new Error("synthetic Warnings are unavailable");
    }
    warnings.items = [
      { source: "synthetic-warning-0" },
      { source: "synthetic-warning-1" },
    ];

    expect(evaluateDecisionV0_1(input)).toEqual({
      status: "STOP",
      reasons: [
        {
          code: "WARNING_PRESENT",
          sourceReferences: [
            "/simulation/warnings/items/0",
            "/simulation/warnings/items/1",
          ],
        },
      ],
    });
  });

  it("aggregates every failed Receipt and Outcome item", () => {
    const input = buildManualReviewInput();
    const simulation = availableSimulation(input);
    if (
      simulation.receipts.availability !== "AVAILABLE" ||
      simulation.outcomes.availability !== "AVAILABLE"
    ) {
      throw new Error("synthetic transaction evidence is unavailable");
    }
    simulation.receipts.items = [
      { status: "FAILED", raw: { id: "synthetic-receipt-0" } },
      { status: "FAILED", raw: { id: "synthetic-receipt-1" } },
    ];
    simulation.outcomes.items = [
      { status: "FAILED", raw: { id: "synthetic-outcome-0" } },
      { status: "FAILED", raw: { id: "synthetic-outcome-1" } },
    ];

    expect(evaluateDecisionV0_1(input)).toEqual({
      status: "STOP",
      reasons: [
        {
          code: "RECEIPT_FAILED",
          sourceReferences: [
            "/simulation/receipts/items/0",
            "/simulation/receipts/items/1",
          ],
        },
        {
          code: "OUTCOME_FAILED",
          sourceReferences: [
            "/simulation/outcomes/items/0",
            "/simulation/outcomes/items/1",
          ],
        },
      ],
    });
  });

  it("aggregates every unavailable component under one code", () => {
    const input = buildManualReviewInput();
    setComponentUnavailable(input, "warnings", "MISSING");
    setComponentUnavailable(input, "receipts", "MISSING");
    setComponentUnavailable(input, "outcomes", "MISSING");

    expect(evaluateDecisionV0_1(input)).toEqual({
      status: "STOP",
      reasons: [
        {
          code: "REQUIRED_EVIDENCE_MISSING",
          sourceReferences: [
            "/simulation/outcomes/availability",
            "/simulation/receipts/availability",
            "/simulation/warnings/availability",
          ],
        },
      ],
    });
  });

  it("aggregates and deduplicates critical Alignment references", () => {
    const input = buildManualReviewInput();
    const check = firstAlignment(input);
    check.status = "FAIL";
    check.sourceReferences = [
      pointer("/simulation/raw"),
      pointer("/intent/inputAmount"),
    ];
    input.alignment.checks.push({
      checkId: RecordIdSchema.parse("synthetic-critical-alignment-2"),
      critical: true,
      status: "FAIL",
      sourceReferences: [
        pointer("/intent/inputAmount"),
        pointer("/capability/raw/supported"),
      ],
    });

    expect(evaluateDecisionV0_1(input)).toEqual({
      status: "STOP",
      reasons: [
        {
          code: "CRITICAL_ALIGNMENT_FAIL",
          sourceReferences: [
            "/capability/raw/supported",
            "/intent/inputAmount",
            "/simulation/raw",
          ],
        },
      ],
    });
  });
});

it("does not infer incomplete non-empty Receipt or Outcome sets", () => {
  const input = buildManualReviewInput();
  expect(evaluateDecisionV0_1(input)).toEqual({ status: "MANUAL_REVIEW" });
});
