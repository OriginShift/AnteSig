import { describe, expect, it } from "vitest";
import {
  PreflightReportSchema,
  type PreflightReportInput,
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
  validReferences: string[];
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
  const simulation = availableSimulation(report);
  (simulation as unknown as Record<ComponentName, unknown>)[component] =
    unavailable(status, `SYNTHETIC_${component.toUpperCase()}_${status}`, [
      "/simulation/raw",
    ]);
}

function buildStopReport(
  testCase: StopTriggerCase,
  sourceReferences = testCase.validReferences,
): PreflightReportInput {
  const report = buildManualReviewReport();
  testCase.mutate(report);
  report.decision = {
    status: "STOP",
    reasons: [
      {
        code: "SYNTHETIC_STOP_TRIGGER",
        sourceReferences,
      },
    ],
  };
  return report;
}

function firstStopReason(report: PreflightReportInput) {
  if (report.decision.status !== "STOP") {
    throw new Error("synthetic report must have a STOP decision");
  }
  const reason = report.decision.reasons[0];
  if (reason === undefined) {
    throw new Error("synthetic STOP decision must have a reason");
  }
  return reason;
}

function addReferenceCycle(report: PreflightReportInput): void {
  const quote = report.quotes[0];
  if (quote === undefined) {
    throw new Error("synthetic report must contain a quote");
  }
  report.quotes.push({
    quoteId: "synthetic-cyclic-stop-quote",
    protocolId: quote.protocolId,
    inputAsset: quote.inputAsset,
    outputAsset: quote.outputAsset,
    inputAmount: quote.inputAmount,
    status: "FAILED",
    failure: {
      code: "SYNTHETIC_CYCLIC_STOP_QUOTE_FAILURE",
      sourceReferences: ["/selection/reason"],
    },
  });
  report.selection.reason.sourceReferences = ["/quotes/1/failure"];
}

const STOP_TRIGGER_CASES: StopTriggerCase[] = [
  {
    name: "NOT_SELECTED",
    validReferences: ["/selection"],
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
      validReferences: ["/capability"],
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
      validReferences: ["/simulation"],
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
  ...(["FAILED", "INTERRUPTED"] as const).map(
    (status): StopTriggerCase => ({
      name: `executionStatus ${status}`,
      validReferences: ["/simulation/executionStatus"],
      unrelatedReference: "/intent",
      mutate: (report) => {
        availableSimulation(report).executionStatus = status;
      },
    }),
  ),
  {
    name: "non-empty Warnings",
    validReferences: ["/simulation/warnings/items/0"],
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
    validReferences: ["/simulation/receipts/items/0"],
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
    validReferences: ["/simulation/receipts/items"],
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
    validReferences: ["/simulation/outcomes/items/0"],
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
    validReferences: ["/simulation/outcomes/items"],
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
    validReferences: ["/simulation/coverage"],
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
    validReferences: ["/simulation/ordering"],
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
    validReferences: ["/simulation/stateContinuity"],
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
        validReferences: [`/simulation/${component}`],
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
      validReferences: ["/intent", "/simulation"],
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

const FORBIDDEN_CONTEXT_REFERENCES = [
  ["reference metadata", "/selection/reason/sourceReferences/0"],
  ["the STOP reason itself", "/decision/reasons/0"],
  ["the decision root", "/decision"],
  ["limitations", "/limitations"],
  ["an Alignment result", "/alignment/checks/0"],
] as const;

describe.each(STOP_TRIGGER_CASES)("STOP association: $name", (testCase) => {
  it("accepts references associated with the actual trigger", () => {
    const report = buildStopReport(testCase);
    const parsed = PreflightReportSchema.safeParse(report);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
  });

  it("rejects an empty sourceReferences list", () => {
    const report = buildStopReport(testCase);
    firstStopReason(report).sourceReferences = [];

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects omitted sourceReferences", () => {
    const report = buildStopReport(testCase);
    const reason = firstStopReason(report) as unknown as {
      sourceReferences?: string[];
    };
    delete reason.sourceReferences;

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects a syntax-valid dangling reference", () => {
    const report = buildStopReport(testCase, ["/quotes/99"]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects a resolvable but unrelated reference", () => {
    const report = buildStopReport(testCase, [testCase.unrelatedReference]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("does not let a correct reference hide an unrelated extra reference", () => {
    const report = buildStopReport(testCase, [
      ...testCase.validReferences,
      testCase.unrelatedReference,
    ]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it.each(FORBIDDEN_CONTEXT_REFERENCES)(
    "rejects a reference to %s",
    (_name, pointer) => {
      const report = buildStopReport(testCase, [pointer]);

      expect(PreflightReportSchema.safeParse(report).success).toBe(false);
    },
  );

  it("rejects a report containing a source-reference cycle", () => {
    const report = buildStopReport(testCase);
    addReferenceCycle(report);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });
});

describe("multiple simultaneous STOP triggers", () => {
  function buildMultipleTriggerReport(sourceReferences: string[]) {
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
          code: "SYNTHETIC_MULTIPLE_TRIGGERS",
          sourceReferences,
        },
      ],
    };
    return report;
  }

  it("requires an association for every trigger", () => {
    const report = buildMultipleTriggerReport(["/capability"]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });

  it("accepts complete trigger coverage", () => {
    const report = buildMultipleTriggerReport(["/capability", "/simulation"]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(true);
  });
});

describe("critical Alignment source coverage", () => {
  const criticalFailure = STOP_TRIGGER_CASES.find(
    (testCase) => testCase.name === "critical Alignment FAIL",
  );
  if (criticalFailure === undefined) {
    throw new Error("critical Alignment matrix case is missing");
  }

  it("requires every underlying source reference", () => {
    const report = buildStopReport(criticalFailure, ["/intent"]);

    expect(PreflightReportSchema.safeParse(report).success).toBe(false);
  });
});
