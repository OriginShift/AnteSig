import {
  DecisionInputV0_1Schema,
  JsonPointerSyntaxSchema,
  StableCodeSchema,
  type DecisionInputV0_1,
  type JsonPointerSyntax,
} from "@moss-mini-demo/report-schema";
import type { DecisionV0_1 } from "../src/index.js";

type UnavailableEvidence = Exclude<
  DecisionInputV0_1["capability"],
  { availability: "AVAILABLE" }
>;

export function pointer(value: string): JsonPointerSyntax {
  return JsonPointerSyntaxSchema.parse(value);
}

export function unavailable(
  availability: "FAILED" | "MISSING" | "UNPROVABLE",
  sourceReferences: JsonPointerSyntax[] = [pointer("/intent")],
): UnavailableEvidence {
  return {
    availability,
    failure: {
      code: StableCodeSchema.parse(`SYNTHETIC_${availability}`),
      sourceReferences,
    },
  };
}

export function buildManualReviewInput(): DecisionInputV0_1 {
  return DecisionInputV0_1Schema.parse({
    schemaVersion: "0.1",
    reportId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2031-03-04T05:06:07.000Z",
    network: "eip155:99999999999999999999999999999999",
    provenance: "FIXTURE",
    intent: {
      account: "0x47833B74E85e2847125e5c3F20B59f6eD063985A",
      inputAsset: { kind: "NATIVE" },
      outputAsset: {
        kind: "ERC20",
        address: "0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC",
      },
      inputAmount: "1000000000000000",
      maxSlippageBps: 50,
      allowedProtocols: ["synthetic-protocol"],
      recipient: "0xD468b6928b92D983F6C6CB9382B438E13D999e3d",
    },
    quotes: [
      {
        quoteId: "synthetic-quote-1",
        protocolId: "synthetic-protocol",
        inputAsset: { kind: "NATIVE" },
        outputAsset: {
          kind: "ERC20",
          address: "0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC",
        },
        inputAmount: "1000000000000000",
        status: "SUCCESS",
        outputAmount: "42000000",
        raw: { source: "synthetic", sequence: 1 },
      },
    ],
    selection: {
      status: "SELECTED",
      protocolId: "synthetic-protocol",
      quoteId: "synthetic-quote-1",
      reason: {
        code: "SYNTHETIC_SELECTION",
        sourceReferences: ["/quotes/0"],
      },
    },
    capability: {
      availability: "AVAILABLE",
      raw: {
        source: "synthetic",
        supported: true,
        display: { synthetic: true },
        "\uE000": "synthetic-private-use-key",
        "😀": "synthetic-supplementary-key",
      },
    },
    simulation: {
      availability: "AVAILABLE",
      executionStatus: "SUCCESS",
      raw: {
        source: "synthetic",
        execution: "complete",
        sourceReferences: { synthetic: true },
      },
      receipts: {
        availability: "AVAILABLE",
        items: [
          {
            status: "SUCCESS",
            raw: { id: "synthetic-receipt", extension: { synthetic: true } },
          },
        ],
      },
      outcomes: {
        availability: "AVAILABLE",
        items: [{ status: "SUCCESS", raw: { id: "synthetic-outcome" } }],
      },
      warnings: { availability: "AVAILABLE", items: [] },
      coverage: {
        availability: "AVAILABLE",
        complete: true,
        raw: { scope: "synthetic-complete" },
      },
      ordering: {
        availability: "AVAILABLE",
        valid: true,
        raw: { ordering: "synthetic-valid" },
      },
      stateContinuity: {
        availability: "AVAILABLE",
        continuous: true,
        raw: { continuity: "synthetic-continuous" },
      },
    },
    alignment: {
      checks: [
        {
          checkId: "synthetic-critical-alignment",
          critical: true,
          status: "PASS",
          sourceReferences: ["/intent/inputAmount"],
        },
      ],
    },
  });
}

export function availableSimulation(input: DecisionInputV0_1) {
  if (input.simulation.availability !== "AVAILABLE") {
    throw new Error("synthetic input must contain available simulation");
  }
  return input.simulation;
}

export function buildReport(
  input: DecisionInputV0_1,
  decision: DecisionV0_1,
): unknown {
  return { ...input, decision, limitations: [] };
}
