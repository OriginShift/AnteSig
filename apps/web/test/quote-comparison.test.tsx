import { QuoteSchema, SelectionSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import {
  quoteComparisonRows,
  selectionSummary,
} from "../src/client/quote-comparison";

const QUOTE_BASE = {
  inputAsset: { kind: "NATIVE" },
  outputAsset: {
    kind: "ERC20",
    address: "0x2222222222222222222222222222222222222222",
  },
  inputAmount: "1000000000000000000",
} as const;

const SUCCESS = QuoteSchema.parse({
  ...QUOTE_BASE,
  quoteId: "alpha-quote",
  protocolId: "alpha-protocol",
  status: "SUCCESS",
  outputAmount: "42000000",
  raw: { source: "test" },
});

const FAILED = QuoteSchema.parse({
  ...QUOTE_BASE,
  quoteId: "beta-quote",
  protocolId: "beta-protocol",
  status: "FAILED",
  failure: {
    code: "QUOTE_TIMEOUT",
    sourceReferences: ["/quotes/1/failure"],
  },
});

describe("quote comparison", () => {
  it("models a successful and failed protocol independently with the selection rule", () => {
    const rows = quoteComparisonRows([SUCCESS, FAILED]);
    const selection = SelectionSchema.parse({
      status: "SELECTED",
      protocolId: "alpha-protocol",
      quoteId: "alpha-quote",
      reason: {
        code: "FIRST_ALLOWED_SUCCESS",
        sourceReferences: ["/quotes/0"],
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        protocolId: "alpha-protocol",
        status: "SUCCESS",
        outcomeLabel: "Amount out",
        outcomeValue: "42000000",
        outputAsset: "0x2222222222222222222222222222222222222222",
      }),
      expect.objectContaining({
        protocolId: "beta-protocol",
        status: "FAILED",
        outcomeLabel: "Failure",
        outcomeValue: "QUOTE_TIMEOUT",
        sourceReferences: ["/quotes/1/failure"],
      }),
    ]);
    expect(selection.reason.code).toBe("FIRST_ALLOWED_SUCCESS");
    expect(selectionSummary(selection)).toBe(
      "Selected alpha-protocol / alpha-quote",
    );
  });

  it("preserves every failure and no-selection rule when all quotes fail", () => {
    const secondFailure = QuoteSchema.parse({
      ...QUOTE_BASE,
      quoteId: "gamma-quote",
      protocolId: "gamma-protocol",
      status: "FAILED",
      failure: {
        code: "QUOTE_REJECTED",
        sourceReferences: ["/quotes/1/failure"],
      },
    });
    const selection = SelectionSchema.parse({
      status: "NOT_SELECTED",
      reason: {
        code: "NO_ALLOWED_SUCCESS",
        sourceReferences: ["/quotes/0/failure", "/quotes/1/failure"],
      },
    });
    const rows = quoteComparisonRows([
      QuoteSchema.parse({
        ...FAILED,
        quoteId: "beta-only-failure",
        failure: {
          code: "QUOTE_TIMEOUT",
          sourceReferences: ["/quotes/0/failure"],
        },
      }),
      secondFailure,
    ]);

    expect(rows.map((row) => row.outcomeValue)).toEqual([
      "QUOTE_TIMEOUT",
      "QUOTE_REJECTED",
    ]);
    expect(rows.every((row) => row.status === "FAILED")).toBe(true);
    expect(selection.reason.code).toBe("NO_ALLOWED_SUCCESS");
    expect(selectionSummary(selection)).toBe("No quote selected");
  });
});
