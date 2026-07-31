import { describe, expect, it } from "vitest";
import {
  PreflightReportSchema,
  type PreflightReportInput,
  type StopReasonCodeV0_1,
} from "../src/index.js";
import { buildManualReviewReport, unavailable } from "./synthetic.js";

type UnavailableStatus = "FAILED" | "MISSING" | "UNPROVABLE";
type ComponentName =
  | "receipts"
  | "outcomes"
  | "warnings"
  | "coverage"
  | "ordering"
  | "stateContinuity";

interface StopTriggerCase {
  name: string;
  code: StopReasonCodeV0_1;
  references: string[];
  unrelatedReference: string;
  mutate: (report: PreflightReportInput) => void;
}

const UNAVAILABLE_STATUSES: UnavailableStatus[] = [
  "FAILED",
  "MISSING",
  "UNPROVABLE",
];
const COMPONENT_NAMES: ComponentName[] = [
  "receipts",
  "outcomes",
  "warnings",
  "coverage",
  "ordering",
  "stateContinuity",
];

function availableSimulation(report: PreflightReportInput) {
  if (report.simulation.availability !== "AVAILABLE") {
    throw new Error("synthetic report must contain available simulation");
  }
  return report.simulation;
}

function setUnavailableComponent(
  report: PreflightReportInput,
  component: ComponentName,
  status: UnavailableStatus,
): void {
  const simulation = availableSimulation(report) as unknown as Record<
    ComponentName,
    unknown
  >;
  simulation[component] = unavailable(
    status,
    `SYNTHETIC_${component.toUpperCase()}_${status}`,
    ["/simulation/raw"],
  );
}

function buildStopReport(
  testCase: StopTriggerCase,
  references = testCase.references,
): PreflightReportInput {
  const report = buildManualReviewReport();
  testCase.mutate(report);
  report.decision = {
    status: "STOP",
    reasons: [{ code: testCase.code, sourceReferences: references }],
  };
  return report;
}

const STOP_TRIGGER_CASES: StopTriggerCase[] = [
  {
    name: "no valid selection",
    code: "NO_VALID_SELECTION",
    references: ["/selection/status"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      report.selection = {
        status: "NOT_SELECTED",
        reason: {
          code: "SYNTHETIC_NOT_SELECTED",
          sourceReferences: ["/quotes/0"],
        },
      };
    },
  },
  ...UNAVAILABLE_STATUSES.map(
    (status): StopTriggerCase => ({
      name: `Capability ${status}`,
      code: (
        {
          FAILED: "CAPABILITY_FAILED",
          MISSING: "CAPABILITY_MISSING",
          UNPROVABLE: "CAPABILITY_UNPROVABLE",
        } as const
      )[status],
      references: ["/capability/availability"],
      unrelatedReference: "/intent",
      mutate: (report) => {
        report.capability = unavailable(
          status,
          `SYNTHETIC_CAPABILITY_${status}`,
          ["/intent"],
        );
      },
    }),
  ),
  ...UNAVAILABLE_STATUSES.map(
    (status): StopTriggerCase => ({
      name: `Simulation ${status}`,
      code: (
        {
          FAILED: "SIMULATION_ACQUISITION_FAILED",
          MISSING: "SIMULATION_MISSING",
          UNPROVABLE: "SIMULATION_UNPROVABLE",
        } as const
      )[status],
      references: ["/simulation/availability"],
      unrelatedReference: "/intent",
      mutate: (report) => {
        report.simulation = unavailable(
          status,
          `SYNTHETIC_SIMULATION_${status}`,
          ["/capability"],
        );
      },
    }),
  ),
  {
    name: "failed execution",
    code: "SIMULATION_EXECUTION_FAILED",
    references: ["/simulation/executionStatus"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      availableSimulation(report).executionStatus = "FAILED";
    },
  },
  {
    name: "interrupted execution",
    code: "SIMULATION_INTERRUPTED",
    references: ["/simulation/executionStatus"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      availableSimulation(report).executionStatus = "INTERRUPTED";
    },
  },
  {
    name: "non-empty Warnings",
    code: "WARNING_PRESENT",
    references: ["/simulation/warnings/items/0"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const warnings = availableSimulation(report).warnings;
      if (warnings.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain Warnings");
      }
      warnings.items = [{ source: "synthetic-warning" }];
    },
  },
  {
    name: "failed Receipt",
    code: "RECEIPT_FAILED",
    references: ["/simulation/receipts/items/0"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const receipts = availableSimulation(report).receipts;
      if (receipts.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain Receipts");
      }
      receipts.items[0] = {
        status: "FAILED",
        raw: { source: "synthetic-failed-receipt" },
      };
    },
  },
  {
    name: "empty Receipt collection",
    code: "RECEIPT_SET_INCOMPLETE",
    references: ["/simulation/receipts/items"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const receipts = availableSimulation(report).receipts;
      if (receipts.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain Receipts");
      }
      receipts.items = [];
    },
  },
  {
    name: "failed Outcome",
    code: "OUTCOME_FAILED",
    references: ["/simulation/outcomes/items/0"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const outcomes = availableSimulation(report).outcomes;
      if (outcomes.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain Outcomes");
      }
      outcomes.items[0] = {
        status: "FAILED",
        raw: { source: "synthetic-failed-outcome" },
      };
    },
  },
  {
    name: "empty Outcome collection",
    code: "OUTCOME_SET_INCOMPLETE",
    references: ["/simulation/outcomes/items"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const outcomes = availableSimulation(report).outcomes;
      if (outcomes.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain Outcomes");
      }
      outcomes.items = [];
    },
  },
  {
    name: "incomplete coverage",
    code: "COVERAGE_INCOMPLETE",
    references: ["/simulation/coverage"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const coverage = availableSimulation(report).coverage;
      if (coverage.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain coverage");
      }
      coverage.complete = false;
    },
  },
  {
    name: "invalid ordering",
    code: "ORDERING_INVALID",
    references: ["/simulation/ordering"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const ordering = availableSimulation(report).ordering;
      if (ordering.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain ordering");
      }
      ordering.valid = false;
    },
  },
  {
    name: "discontinuous state",
    code: "STATE_CONTINUITY_INTERRUPTED",
    references: ["/simulation/stateContinuity"],
    unrelatedReference: "/intent",
    mutate: (report) => {
      const continuity = availableSimulation(report).stateContinuity;
      if (continuity.availability !== "AVAILABLE") {
        throw new Error("synthetic report must contain state continuity");
      }
      continuity.continuous = false;
    },
  },
  ...COMPONENT_NAMES.flatMap((component) =>
    UNAVAILABLE_STATUSES.map(
      (status): StopTriggerCase => ({
        name: `${component} ${status}`,
        code: (
          {
            FAILED: "REQUIRED_EVIDENCE_FAILED",
            MISSING: "REQUIRED_EVIDENCE_MISSING",
            UNPROVABLE: "REQUIRED_EVIDENCE_UNPROVABLE",
          } as const
        )[status],
        references: [`/simulation/${component}/availability`],
        unrelatedReference: "/intent",
        mutate: (report) => {
          setUnavailableComponent(report, component, status);
        },
      }),
    ),
  ),
  ...(["FAIL", "REVIEW"] as const).map(
    (status): StopTriggerCase => ({
      name: `critical Alignment ${status}`,
      code:
        status === "FAIL"
          ? "CRITICAL_ALIGNMENT_FAIL"
          : "CRITICAL_ALIGNMENT_REVIEW",
      references: ["/intent", "/simulation"],
      unrelatedReference: "/quotes/0",
      mutate: (report) => {
        const check = report.alignment.checks[0];
        if (check === undefined) {
          throw new Error("synthetic report must contain Alignment");
        }
        check.status = status;
      },
    }),
  ),
];

describe.each(STOP_TRIGGER_CASES)("STOP reason: $name", (testCase) => {
  it("accepts the exact reason code and triggering references", () => {
    expect(
      PreflightReportSchema.safeParse(buildStopReport(testCase)).success,
    ).toBe(true);
  });

  it("rejects an empty reference list", () => {
    expect(
      PreflightReportSchema.safeParse(buildStopReport(testCase, [])).success,
    ).toBe(false);
  });

  it("rejects a reference owned by another reason", () => {
    expect(
      PreflightReportSchema.safeParse(
        buildStopReport(testCase, [
          ...testCase.references,
          testCase.unrelatedReference,
        ]),
      ).success,
    ).toBe(false);
  });

  it("rejects a different fixed reason code", () => {
    const report = buildStopReport(testCase);
    if (report.decision.status !== "STOP") {
      throw new Error("synthetic report must stop");
    }
    report.decision.reasons[0] = {
      code: "NO_VALID_SELECTION",
      sourceReferences: testCase.references,
    };

    expect(PreflightReportSchema.safeParse(report).success).toBe(
      testCase.code === "NO_VALID_SELECTION",
    );
  });
});

describe("STOP reason ownership", () => {
  it("rejects an arbitrary STOP code", () => {
    const report = buildManualReviewReport();
    report.selection = {
      status: "NOT_SELECTED",
      reason: {
        code: "SYNTHETIC_NOT_SELECTED",
        sourceReferences: ["/quotes/0"],
      },
    };
    report.decision = {
      status: "STOP",
      reasons: [
        {
          code: "SYNTHETIC_STOP_CODE" as never,
          sourceReferences: ["/selection/status"],
        },
      ],
    };

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects one reason that globally covers different triggers", () => {
    const report = buildManualReviewReport();
    report.capability = unavailable("MISSING", "SYNTHETIC_CAPABILITY_MISSING", [
      "/intent",
    ]);
    report.simulation = unavailable(
      "UNPROVABLE",
      "SYNTHETIC_SIMULATION_UNPROVABLE",
      ["/capability"],
    );
    report.decision = {
      status: "STOP",
      reasons: [
        {
          code: "CAPABILITY_MISSING",
          sourceReferences: [
            "/capability/availability",
            "/simulation/availability",
          ],
        },
      ],
    };

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("accepts separately owned reasons in canonical order", () => {
    const report = buildManualReviewReport();
    report.capability = unavailable("MISSING", "SYNTHETIC_CAPABILITY_MISSING", [
      "/intent",
    ]);
    report.simulation = unavailable(
      "UNPROVABLE",
      "SYNTHETIC_SIMULATION_UNPROVABLE",
      ["/capability"],
    );
    report.decision = {
      status: "STOP",
      reasons: [
        {
          code: "CAPABILITY_MISSING",
          sourceReferences: ["/capability/availability"],
        },
        {
          code: "SIMULATION_UNPROVABLE",
          sourceReferences: ["/simulation/availability"],
        },
      ],
    };

    expect(PreflightReportSchema.safeParse(report).success).toBe(true);
  });

  it("rejects valid reasons in non-canonical order", () => {
    const report = buildManualReviewReport();
    report.capability = unavailable("MISSING", "SYNTHETIC_CAPABILITY_MISSING", [
      "/intent",
    ]);
    report.simulation = unavailable(
      "UNPROVABLE",
      "SYNTHETIC_SIMULATION_UNPROVABLE",
      ["/capability"],
    );
    report.decision = {
      status: "STOP",
      reasons: [
        {
          code: "SIMULATION_UNPROVABLE",
          sourceReferences: ["/simulation/availability"],
        },
        {
          code: "CAPABILITY_MISSING",
          sourceReferences: ["/capability/availability"],
        },
      ],
    };

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("does not infer non-empty partial Receipt completeness", () => {
    const report = buildManualReviewReport();
    report.decision = {
      status: "STOP",
      reasons: [
        {
          code: "RECEIPT_SET_INCOMPLETE",
          sourceReferences: ["/simulation/receipts/items"],
        },
      ],
    };

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });
});
