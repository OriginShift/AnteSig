import {
  PreflightReportSchema,
  SimulationSchema,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import amountMismatchFixture from "../../../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json";
import manualReviewFixture from "../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import { comparisonColumns } from "../src/client/comparison-strip";

function columns(fixture: unknown) {
  const report = PreflightReportSchema.parse(fixture);
  return comparisonColumns({
    intent: report.intent,
    quotes: report.quotes,
    selection: report.selection,
    capability: report.capability,
    simulation: report.simulation,
  });
}

function value(
  result: ReturnType<typeof columns>,
  column: "intent" | "prepared" | "simulation",
  label: string,
) {
  return result
    .find((entry) => entry.key === column)
    ?.items.find((entry) => entry.label === label);
}

describe("three-way comparison", () => {
  it("keeps request, prepared Capability and observed Simulation distinct", () => {
    const result = columns(manualReviewFixture);

    expect(result.map((column) => column.title)).toEqual([
      "User request",
      "Agent prepared",
      "Simulation occurred",
    ]);
    expect(value(result, "intent", "Amount in")).toEqual({
      label: "Amount in",
      value: "1000000000000000",
      sourceReferences: ["/intent/inputAmount"],
    });
    expect(value(result, "prepared", "Capability")?.value).toBe("AVAILABLE");
    expect(value(result, "simulation", "Execution")?.value).toBe("SUCCESS");
    expect(value(result, "simulation", "Warnings")?.value).toBe("0 present");
  });

  it("makes the API-provided amount mismatch visible without opening raw JSON", () => {
    const result = columns(amountMismatchFixture);

    expect(value(result, "intent", "Amount in")?.value).toBe(
      "1000000000000000000",
    );
    expect(value(result, "prepared", "Amount in")?.value).toBe(
      "10000000000000000000",
    );
    expect(value(result, "simulation", "Amount in observed")?.value).toBe(
      "10000000000000000000",
    );
    expect(
      value(result, "simulation", "Amount in observed")?.sourceReferences,
    ).toEqual(["/simulation/outcomes/items/0/raw/amountIn"]);
  });

  it("preserves Warning and missing-evidence states as text", () => {
    const report = PreflightReportSchema.parse(amountMismatchFixture);
    const warningSimulation = SimulationSchema.parse({
      ...report.simulation,
      warnings: {
        availability: "AVAILABLE",
        items: [{ code: "EXACT_WARNING", message: "Exact warning text" }],
      },
    });
    const warningColumns = comparisonColumns({
      intent: report.intent,
      quotes: report.quotes,
      selection: report.selection,
      capability: report.capability,
      simulation: warningSimulation,
    });
    const missingSimulation = SimulationSchema.parse({
      availability: "MISSING",
      failure: {
        code: "SIMULATION_MISSING",
        sourceReferences: ["/capability"],
      },
    });
    const missingColumns = comparisonColumns({
      intent: report.intent,
      quotes: report.quotes,
      selection: report.selection,
      capability: report.capability,
      simulation: missingSimulation,
    });

    expect(value(warningColumns, "simulation", "Warnings")?.value).toBe(
      "1 present",
    );
    expect(value(missingColumns, "simulation", "Execution")?.value).toBe(
      "MISSING",
    );
    expect(
      value(missingColumns, "simulation", "Receipts / outcomes")?.value,
    ).toBe("MISSING");
  });
});
