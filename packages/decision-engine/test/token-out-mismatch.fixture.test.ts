import { describe, expect, it } from "vitest";

const REPORT_SCHEMA_PACKAGE = ["@moss-mini-demo", "report-schema"].join("/");
const DECISION_ENGINE_PACKAGE = ["@moss-mini-demo", "decision-engine"].join(
  "/",
);
const FIXTURE_PATH =
  "../../report-schema/fixtures/token-out-mismatch.v0.1.json";

const fixtureTexts = (
  import.meta as unknown as {
    glob(
      pattern: string,
      options: { eager: true; query: "?raw"; import: "default" },
    ): Record<string, string>;
  }
).glob("../../report-schema/fixtures/token-out-mismatch.v0.1.json", {
  eager: true,
  query: "?raw",
  import: "default",
});
const fixtureText = fixtureTexts[FIXTURE_PATH];

function readFixture(): unknown {
  if (fixtureText === undefined) {
    throw new Error("tokenOut mismatch fixture is missing");
  }
  return JSON.parse(fixtureText);
}

describe("tokenOut mismatch STOP fixture", () => {
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
      "/intent/outputAsset/address",
      "/simulation/outcomes/items/0/raw/tokenOut/address",
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
      reportId: "88888888-8888-4888-8888-888888888888",
      generatedAt: "2031-04-05T06:07:08.000Z",
      network: "eip155:99999999999999999999999999999999",
      provenance: "FIXTURE",
      intent: {
        account: "0x3333333333333333333333333333333333333333",
        recipient: "0x4444444444444444444444444444444444444444",
      },
    });
    expect(fixture.intent.outputAsset).toEqual({
      kind: "ERC20",
      address: "0x1111111111111111111111111111111111111111",
    });
    expect(fixture.quotes).toHaveLength(1);
    expect(fixture.quotes[0]).toMatchObject({
      quoteId: "synthetic-token-out-mismatch-quote-v0-1",
      protocolId: "synthetic-token-out-mismatch-protocol",
      outputAsset: fixture.intent.outputAsset,
      inputAmount: fixture.intent.inputAmount,
      status: "SUCCESS",
      raw: { origin: "synthetic-development-fixture" },
    });
    expect(fixture.selection).toMatchObject({
      status: "SELECTED",
      protocolId: "synthetic-token-out-mismatch-protocol",
      quoteId: "synthetic-token-out-mismatch-quote-v0-1",
    });
    expect(fixture.capability).toMatchObject({
      availability: "AVAILABLE",
      raw: { origin: "synthetic-development-fixture" },
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
            tokenOut: {
              kind: "ERC20",
              address: "0x2222222222222222222222222222222222222222",
            },
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
    const intendedTokenOut = fixture.intent.outputAsset.address;
    const observedTokenOut =
      fixture.simulation.outcomes.items[0]?.raw.tokenOut.address;
    expect(intendedTokenOut).toBe("0x1111111111111111111111111111111111111111");
    expect(observedTokenOut).toBe("0x2222222222222222222222222222222222222222");
    expect(observedTokenOut).not.toBe(intendedTokenOut);
    expect(fixture.alignment.checks).toEqual([
      {
        checkId: "synthetic-token-out-alignment",
        critical: true,
        status: "FAIL",
        sourceReferences: expectedReferences,
      },
    ]);
    expect(
      expectedReferences.some((reference) =>
        reference.startsWith("/alignment"),
      ),
    ).toBe(false);
    expect(fixture.decision).toEqual(expectedDecision);

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

    const firstDecision = decisionEngine.evaluateDecisionV0_1(inputParsed.data);
    const secondDecision = decisionEngine.evaluateDecisionV0_1(
      inputParsed.data,
    );
    expect(firstDecision).toEqual(expectedDecision);
    expect(secondDecision).toEqual(firstDecision);

    const limitation = fixture.limitations.find(
      (item: { code: unknown }) =>
        item.code === "SYNTHETIC_TOKEN_OUT_MISMATCH_FIXTURE_ONLY",
    );
    expect(limitation?.sourceReferences).toEqual(expectedReferences);
    expect(limitation?.description).toContain(
      "Its favorable synthetic simulation does not override the tokenOut mismatch.",
    );
    expect(limitation?.description).toContain(
      "It is not Moss, Monad, protocol, wallet, RPC, Quote, Receipt, simulation, or chain evidence.",
    );
    expect(limitation?.description).toContain(
      "MANUAL_REVIEW is not a safety conclusion, approval, authorization, execution guarantee, or permission to sign.",
    );
    expect(limitation?.description).toContain(
      "STOP is a structured fail-closed result, not a safety proof or transaction authorization.",
    );
  });
});
