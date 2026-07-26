import { describe, expect, it } from "vitest";
import { PreflightReportSchema } from "@moss-mini-demo/report-schema";

const fixtureTexts = (
  import.meta as unknown as {
    glob(
      pattern: string,
      options: { eager: true; query: "?raw"; import: "default" },
    ): Record<string, string>;
  }
).glob("../fixtures/manual-review-success.v0.1.json", {
  eager: true,
  query: "?raw",
  import: "default",
});
const fixtureText = fixtureTexts["../fixtures/manual-review-success.v0.1.json"];

function readFixture(): unknown {
  if (fixtureText === undefined) {
    throw new Error("MANUAL_REVIEW success fixture is missing");
  }
  return JSON.parse(fixtureText);
}

describe("MANUAL_REVIEW success fixture", () => {
  it("exists and is valid JSON", () => {
    expect(readFixture()).toBeTypeOf("object");
  });

  it("validates as complete synthetic MANUAL_REVIEW evidence", () => {
    const parsed = PreflightReportSchema.safeParse(readFixture());

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    const fixture = parsed.data;
    expect(fixture.provenance).toBe("FIXTURE");
    expect(fixture.decision.status).toBe("MANUAL_REVIEW");

    const selection = fixture.selection;
    expect(selection.status).toBe("SELECTED");
    if (selection.status !== "SELECTED") {
      throw new Error("success fixture must select a quote");
    }
    const quote = fixture.quotes.find(
      (candidate) => candidate.quoteId === selection.quoteId,
    );
    expect(quote?.status).toBe("SUCCESS");
    expect(quote?.protocolId).toBe(selection.protocolId);
    expect(quote?.inputAsset).toEqual(fixture.intent.inputAsset);
    expect(quote?.outputAsset).toEqual(fixture.intent.outputAsset);
    expect(quote?.inputAmount).toBe(fixture.intent.inputAmount);

    expect(fixture.capability.availability).toBe("AVAILABLE");
    expect(fixture.simulation.availability).toBe("AVAILABLE");
    if (fixture.simulation.availability !== "AVAILABLE") {
      throw new Error("success fixture must provide simulation evidence");
    }
    expect(fixture.simulation.executionStatus).toBe("SUCCESS");
    expect(fixture.simulation.receipts.availability).toBe("AVAILABLE");
    expect(fixture.simulation.outcomes.availability).toBe("AVAILABLE");
    if (fixture.simulation.receipts.availability !== "AVAILABLE") {
      throw new Error("success fixture must provide Receipt evidence");
    }
    if (fixture.simulation.outcomes.availability !== "AVAILABLE") {
      throw new Error("success fixture must provide Outcome evidence");
    }
    expect(fixture.simulation.receipts.items).not.toHaveLength(0);
    expect(
      fixture.simulation.receipts.items.every(
        (receipt) => receipt.status === "SUCCESS",
      ),
    ).toBe(true);
    expect(fixture.simulation.outcomes.items).not.toHaveLength(0);
    expect(
      fixture.simulation.outcomes.items.every(
        (outcome) => outcome.status === "SUCCESS",
      ),
    ).toBe(true);
    expect(fixture.simulation.warnings).toEqual({
      availability: "AVAILABLE",
      items: [],
    });
    expect(fixture.simulation.coverage).toMatchObject({
      availability: "AVAILABLE",
      complete: true,
    });
    expect(fixture.simulation.ordering).toMatchObject({
      availability: "AVAILABLE",
      valid: true,
    });
    expect(fixture.simulation.stateContinuity).toMatchObject({
      availability: "AVAILABLE",
      continuous: true,
    });

    const criticalChecks = fixture.alignment.checks.filter(
      (check) => check.critical,
    );
    expect(criticalChecks).not.toHaveLength(0);
    expect(criticalChecks.every((check) => check.status === "PASS")).toBe(true);

    expect(fixture.limitations).toContainEqual(
      expect.objectContaining({
        code: "SYNTHETIC_DEVELOPMENT_FIXTURE_ONLY",
        description: expect.stringMatching(
          /synthetic development fixture.*not a safety conclusion.*permission to sign/i,
        ),
      }),
    );
  });
});
