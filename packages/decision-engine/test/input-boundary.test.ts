import { describe, expect, it } from "vitest";
import { DecisionInputErrorV0_1, evaluateDecisionV0_1 } from "../src/index.js";
import {
  availableSimulation,
  buildManualReviewInput,
  buildReport,
  pointer,
  unavailable,
} from "./synthetic.js";

type ErrorCode = DecisionInputErrorV0_1["code"];

function expectInputError(input: unknown, code: ErrorCode): void {
  let decision: unknown;
  let thrown: unknown;

  try {
    decision = evaluateDecisionV0_1(input);
  } catch (error) {
    thrown = error;
  }

  expect(decision).toBeUndefined();
  expect(thrown).toBeInstanceOf(DecisionInputErrorV0_1);
  expect(thrown).toMatchObject({ code });
  expect((thrown as Error).message).toBe(
    {
      UNSUPPORTED_SCHEMA_VERSION: "Unsupported DecisionInput schema version",
      INVALID_SOURCE_REFERENCE: "Invalid DecisionInput source reference",
      INVALID_DECISION_INPUT: "Invalid DecisionInput",
    }[code],
  );
}

function setSelectionReferences(input: unknown, references: unknown): void {
  const selection = (
    input as { selection: { reason: Record<string, unknown> } }
  ).selection;
  selection.reason.sourceReferences = references;
}

describe("DecisionInput v0.1 boundary", () => {
  it.each([null, {}, { schemaVersion: "0.2" }, { schemaVersion: 1 }])(
    "classifies unsupported schemaVersion before evaluation",
    (input) => {
      expectInputError(input, "UNSUPPORTED_SCHEMA_VERSION");
    },
  );

  it("classifies strict Schema failures as INVALID_DECISION_INPUT", () => {
    expectInputError(
      { ...buildManualReviewInput(), unexpected: true },
      "INVALID_DECISION_INPUT",
    );
  });

  it("rejects a complete PreflightReport as INVALID_DECISION_INPUT", () => {
    const input = buildManualReviewInput();
    expectInputError(
      buildReport(input, { status: "MANUAL_REVIEW" }),
      "INVALID_DECISION_INPUT",
    );
  });

  it("rejects an input with no critical Alignment check", () => {
    const input = buildManualReviewInput();
    input.alignment.checks[0] = {
      ...input.alignment.checks[0],
      critical: false,
    };

    expectInputError(input, "INVALID_DECISION_INPUT");
  });

  it.each([
    ["missing", undefined],
    ["empty", []],
    ["malformed", ["intent"]],
    ["dangling", ["/quotes/99"]],
    ["unrelated", ["/capability"]],
    ["metadata", ["/selection/reason/sourceReferences/0"]],
    ["self-reference", ["/selection/reason"]],
  ])("classifies %s SourceReference input", (_name, references) => {
    const input = buildManualReviewInput();
    if (references === undefined) {
      const reason = input.selection.reason as unknown as Record<
        string,
        unknown
      >;
      delete reason.sourceReferences;
    } else {
      setSelectionReferences(input, references);
    }

    expectInputError(input, "INVALID_SOURCE_REFERENCE");
  });

  it("classifies a SourceReference cycle", () => {
    const input = buildManualReviewInput();
    const simulation = availableSimulation(input);
    simulation.receipts = unavailable("MISSING", [
      pointer("/simulation/outcomes/failure"),
    ]);
    simulation.outcomes = unavailable("MISSING", [
      pointer("/simulation/receipts/failure"),
    ]);

    expectInputError(input, "INVALID_SOURCE_REFERENCE");
  });

  it("allows metadata-like keys inside source-owned raw subtrees", () => {
    const input = buildManualReviewInput();
    const [check] = input.alignment.checks;
    if (check === undefined) {
      throw new Error("synthetic critical Alignment is missing");
    }
    check.sourceReferences = [
      pointer("/capability/raw/display"),
      pointer("/simulation/raw/sourceReferences"),
      pointer("/simulation/receipts/items/0/raw/extension"),
    ];

    expect(evaluateDecisionV0_1(input)).toEqual({ status: "MANUAL_REVIEW" });
  });

  it.each([
    ["unsupported plus source", true, false],
    ["unsupported plus Schema", false, true],
    ["unsupported plus source plus Schema", true, true],
  ])("gives schemaVersion precedence for %s", (_name, source, schema) => {
    const input = buildManualReviewInput() as unknown as Record<
      string,
      unknown
    >;
    input.schemaVersion = "0.2";
    if (source) {
      setSelectionReferences(input, ["/quotes/99"]);
    }
    if (schema) {
      input.unexpected = true;
    }

    expectInputError(input, "UNSUPPORTED_SCHEMA_VERSION");
  });

  it("gives SourceReference errors precedence over other Schema errors", () => {
    const input = buildManualReviewInput();
    setSelectionReferences(input, ["/quotes/99"]);
    const [quote] = input.quotes;
    if (quote === undefined) {
      throw new Error("synthetic Quote is missing");
    }
    input.quotes.push(structuredClone(quote));

    expectInputError(input, "INVALID_SOURCE_REFERENCE");
  });
});
