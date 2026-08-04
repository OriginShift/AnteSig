import { describe, expect, it } from "vitest";

const REPORT_SCHEMA_PACKAGE = ["@moss-mini-demo", "report-schema"].join("/");
const DECISION_ENGINE_PACKAGE = ["@moss-mini-demo", "decision-engine"].join(
  "/",
);
const FIXTURE_PATH =
  "../../report-schema/fixtures/amount-in-mismatch.v0.1.json";

const fixtureTexts = (
  import.meta as unknown as {
    glob(
      pattern: string,
      options: { eager: true; query: "?raw"; import: "default" },
    ): Record<string, string>;
  }
).glob("../../report-schema/fixtures/amount-in-mismatch.v0.1.json", {
  eager: true,
  query: "?raw",
  import: "default",
});
const fixtureText = fixtureTexts[FIXTURE_PATH];

function readFixture(): unknown {
  if (fixtureText === undefined) {
    throw new Error("amountIn mismatch fixture is missing");
  }
  return JSON.parse(fixtureText);
}

describe("amountIn mismatch STOP fixture", () => {
  it("exists and is valid JSON", () => {
    expect(readFixture()).toBeTypeOf("object");
  });

  it("validates and deterministically recomputes the exact STOP", async () => {
    const [{ DecisionInputV0_1Schema, PreflightReportSchema }, decisionEngine] =
      await Promise.all([
        import(REPORT_SCHEMA_PACKAGE),
        import(DECISION_ENGINE_PACKAGE),
      ]);
    const parsed = PreflightReportSchema.safeParse(readFixture());

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    const fixture = parsed.data;
    const expectedReferences = [
      "/capability/raw/amountIn",
      "/intent/inputAmount",
      "/simulation/outcomes/items/0/raw/amountIn",
    ];
    const expectedDecision = {
      status: "STOP",
      reasons: [
        {
          code: "CRITICAL_ALIGNMENT_FAIL",
          sourceReferences: expectedReferences,
        },
      ],
    };

    expect(fixture).toMatchObject({
      schemaVersion: "0.1",
      reportId: "99999999-9999-4999-8999-999999999999",
      generatedAt: "2031-05-06T07:08:09.000Z",
      network: "eip155:99999999999999999999999999999999",
      provenance: "FIXTURE",
      intent: {
        account: "0x5555555555555555555555555555555555555555",
        inputAsset: { kind: "NATIVE" },
        outputAsset: {
          kind: "ERC20",
          address: "0x7777777777777777777777777777777777777777",
        },
        inputAmount: "1000000000000000000",
        recipient: "0x6666666666666666666666666666666666666666",
      },
    });
    expect(fixture.quotes).toHaveLength(1);
    expect(fixture.quotes[0]).toMatchObject({
      quoteId: "synthetic-amount-in-mismatch-quote-v0-1",
      protocolId: "synthetic-amount-in-mismatch-protocol",
      inputAsset: fixture.intent.inputAsset,
      outputAsset: fixture.intent.outputAsset,
      inputAmount: fixture.intent.inputAmount,
      status: "SUCCESS",
      raw: { origin: "synthetic-development-fixture" },
    });
    expect(fixture.selection).toMatchObject({
      status: "SELECTED",
      protocolId: "synthetic-amount-in-mismatch-protocol",
      quoteId: "synthetic-amount-in-mismatch-quote-v0-1",
    });
    expect(fixture.capability).toMatchObject({
      availability: "AVAILABLE",
      raw: {
        origin: "synthetic-development-fixture",
        amountIn: "10000000000000000000",
      },
    });
    if (fixture.capability.availability !== "AVAILABLE") {
      throw new Error("mismatch fixture must provide Capability evidence");
    }
    expect(fixture.simulation).toMatchObject({
      availability: "AVAILABLE",
      executionStatus: "SUCCESS",
      receipts: { availability: "AVAILABLE" },
      outcomes: { availability: "AVAILABLE" },
      warnings: { availability: "AVAILABLE", items: [] },
      coverage: { availability: "AVAILABLE", complete: true },
      ordering: { availability: "AVAILABLE", valid: true },
      stateContinuity: { availability: "AVAILABLE", continuous: true },
    });
    if (fixture.simulation.availability !== "AVAILABLE") {
      throw new Error("mismatch fixture must provide simulation evidence");
    }
    expect(fixture.simulation.receipts).toMatchObject({
      availability: "AVAILABLE",
      items: [{ status: "SUCCESS" }],
    });
    expect(fixture.simulation.outcomes).toMatchObject({
      availability: "AVAILABLE",
      items: [
        {
          status: "SUCCESS",
          raw: {
            origin: "synthetic-development-fixture",
            amountIn: "10000000000000000000",
          },
        },
      ],
    });
    if (
      fixture.simulation.receipts.availability !== "AVAILABLE" ||
      fixture.simulation.outcomes.availability !== "AVAILABLE" ||
      fixture.simulation.coverage.availability !== "AVAILABLE" ||
      fixture.simulation.ordering.availability !== "AVAILABLE" ||
      fixture.simulation.stateContinuity.availability !== "AVAILABLE"
    ) {
      throw new Error("mismatch fixture must provide favorable evidence");
    }

    const syntheticRawArtifacts = [
      fixture.quotes[0]?.raw,
      fixture.capability.raw,
      fixture.simulation.raw,
      fixture.simulation.receipts.items[0]?.raw,
      fixture.simulation.outcomes.items[0]?.raw,
      fixture.simulation.coverage.raw,
      fixture.simulation.ordering.raw,
      fixture.simulation.stateContinuity.raw,
    ];
    expect(syntheticRawArtifacts).toHaveLength(8);
    for (const raw of syntheticRawArtifacts) {
      expect(raw).toMatchObject({ origin: "synthetic-development-fixture" });
    }

    const intentAmountIn = fixture.intent.inputAmount;
    const quoteAmountIn = fixture.quotes[0]?.inputAmount;
    const quoteAmountOut =
      fixture.quotes[0]?.status === "SUCCESS"
        ? fixture.quotes[0].outputAmount
        : undefined;
    const capabilityAmountIn = fixture.capability.raw.amountIn;
    const simulationAmountIn =
      fixture.simulation.outcomes.items[0]?.raw.amountIn;
    const amounts = [
      intentAmountIn,
      quoteAmountIn,
      quoteAmountOut,
      capabilityAmountIn,
      simulationAmountIn,
    ];
    expect(intentAmountIn).toBe("1000000000000000000");
    expect(quoteAmountIn).toBe(intentAmountIn);
    expect(capabilityAmountIn).toBe("10000000000000000000");
    expect(simulationAmountIn).toBe(capabilityAmountIn);
    expect(simulationAmountIn).not.toBe(intentAmountIn);
    for (const amount of amounts) {
      expect(amount).toBeTypeOf("string");
      expect(amount).toMatch(/^[1-9][0-9]*$/);
    }

    expect(fixture.alignment.checks).toEqual([
      {
        checkId: "synthetic-amount-in-alignment",
        critical: true,
        status: "FAIL",
        sourceReferences: expectedReferences,
      },
    ]);
    expect(fixture.decision).toEqual(expectedDecision);

    const limitation = fixture.limitations.find(
      (item: { code: unknown }) =>
        item.code === "SYNTHETIC_AMOUNT_IN_MISMATCH_FIXTURE_ONLY",
    );
    expect(limitation?.sourceReferences).toEqual(expectedReferences);
    const allReferences = [
      ...fixture.alignment.checks.flatMap(
        (check: { sourceReferences: string[] }) => check.sourceReferences,
      ),
      ...(fixture.decision.status === "STOP"
        ? fixture.decision.reasons.flatMap(
            (reason: { sourceReferences: string[] }) => reason.sourceReferences,
          )
        : []),
      ...fixture.limitations.flatMap(
        (item: { sourceReferences: string[] }) => item.sourceReferences,
      ),
    ];
    expect(
      allReferences.every((reference) =>
        expectedReferences.includes(reference),
      ),
    ).toBe(true);

    const decisionInput = Object.fromEntries(
      Object.entries(fixture).filter(
        ([key]) => key !== "decision" && key !== "limitations",
      ),
    );
    const inputParsed = DecisionInputV0_1Schema.safeParse(decisionInput);
    expect(inputParsed.success).toBe(true);
    if (!inputParsed.success) {
      throw new Error(inputParsed.error.message);
    }

    const inputSnapshot = structuredClone(inputParsed.data);
    const inputJsonBefore = JSON.stringify(inputParsed.data);
    const firstDecision = decisionEngine.evaluateDecisionV0_1(inputParsed.data);
    const secondDecision = decisionEngine.evaluateDecisionV0_1(
      inputParsed.data,
    );
    expect(firstDecision).toEqual(expectedDecision);
    expect(secondDecision).toEqual(firstDecision);
    expect(inputParsed.data).toEqual(inputSnapshot);
    expect(JSON.stringify(inputParsed.data)).toBe(inputJsonBefore);
    expect(fixture.simulation.executionStatus).toBe("SUCCESS");

    expect(limitation?.description).toContain(
      "Its favorable synthetic simulation does not override the amountIn mismatch.",
    );
    expect(limitation?.description).toContain(
      "The 1-versus-10 amount values are synthetic integer strings, not Moss, Monad, token, protocol, wallet, RPC, Quote, Receipt, simulation, or chain evidence.",
    );
    expect(limitation?.description).toContain(
      "MANUAL_REVIEW is not a safety conclusion, approval, authorization, execution guarantee, or permission to sign.",
    );
    expect(limitation?.description).toContain(
      "STOP is a structured fail-closed result, not a safety proof or transaction authorization.",
    );
  });
});
