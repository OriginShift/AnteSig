import { describe, expect, it } from "vitest";
import { DecisionInputV0_1Schema } from "../src/index.js";
import { buildManualReviewReport } from "./synthetic.js";

function buildDecisionInput() {
  const {
    decision: _decision,
    limitations: _limitations,
    ...input
  } = buildManualReviewReport();
  return input;
}

function firstAlignmentCheck(input: ReturnType<typeof buildDecisionInput>) {
  const [check] = input.alignment.checks;
  if (!check) {
    throw new Error("synthetic input must contain an alignment check");
  }
  return check;
}

describe("DecisionInputV0_1Schema", () => {
  it("accepts the strict source-evidence projection", () => {
    const input = buildDecisionInput();

    expect(DecisionInputV0_1Schema.parse(input)).toEqual(input);
  });

  it("rejects a complete PreflightReport because it contains decision output", () => {
    expect(
      DecisionInputV0_1Schema.safeParse(buildManualReviewReport()).success,
    ).toBe(false);
  });

  it.each(["decision", "limitations", "presentation", "credential"])(
    "rejects forbidden top-level field %s",
    (field) => {
      const input = buildDecisionInput();

      expect(
        DecisionInputV0_1Schema.safeParse({ ...input, [field]: {} }).success,
      ).toBe(false);
    },
  );

  it("rejects unknown nested fields", () => {
    const input = buildDecisionInput();

    expect(
      DecisionInputV0_1Schema.safeParse({
        ...input,
        intent: { ...input.intent, extension: true },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["Warning", "/simulation/warnings/items/0"],
    ["Receipt", "/simulation/receipts/items/0"],
    ["Outcome", "/simulation/outcomes/items/0"],
  ])("accepts canonical %s item references", (_name, reference) => {
    const input = buildDecisionInput();
    firstAlignmentCheck(input).sourceReferences = [reference];
    if (reference === "/simulation/warnings/items/0") {
      if (input.simulation.availability !== "AVAILABLE") {
        throw new Error("synthetic input must have a simulation");
      }
      input.simulation.warnings = {
        availability: "AVAILABLE",
        items: [{ source: "synthetic-warning" }],
      };
    }

    expect(DecisionInputV0_1Schema.safeParse(input).success).toBe(true);
  });

  it("rejects the obsolete raw collection path", () => {
    const input = buildDecisionInput();
    firstAlignmentCheck(input).sourceReferences = [
      "/simulation/receipts/raw/0",
    ];

    expect(DecisionInputV0_1Schema.safeParse(input).success).toBe(false);
  });

  it.each([
    "/quotes/99",
    "/selection/reason/sourceReferences/0",
    "/alignment/checks/0",
  ])("rejects invalid input source reference %s", (reference) => {
    const input = buildDecisionInput();
    input.selection.reason.sourceReferences = [reference];

    expect(DecisionInputV0_1Schema.safeParse(input).success).toBe(false);
  });
});
