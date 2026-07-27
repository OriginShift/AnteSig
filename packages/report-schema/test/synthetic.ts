import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { PreflightReportInput } from "../src/index.js";

function checksumAddress(hexBody: string): string {
  const lowercaseBody = hexBody.toLowerCase();
  const hash = bytesToHex(keccak_256(utf8ToBytes(lowercaseBody)));
  let checksummedBody = "";

  for (const [index, character] of [...lowercaseBody].entries()) {
    checksummedBody +=
      /[a-f]/.test(character) && Number.parseInt(hash[index] ?? "0", 16) >= 8
        ? character.toUpperCase()
        : character;
  }

  return `0x${checksummedBody}`;
}

export function syntheticAddress(label: string): string {
  return checksumAddress(
    bytesToHex(keccak_256(utf8ToBytes(label))).slice(0, 40),
  );
}

export function unavailable(
  availability: "FAILED" | "MISSING" | "UNPROVABLE",
  code = "SYNTHETIC_EVIDENCE_UNAVAILABLE",
  sourceReferences = ["/intent"],
) {
  return {
    availability,
    failure: { code, sourceReferences },
  } as const;
}

export function buildManualReviewReport(): PreflightReportInput {
  const outputToken = syntheticAddress("synthetic-output-token");

  return {
    schemaVersion: "0.1",
    reportId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-01-02T03:04:05.000Z",
    network: "eip155:99999999999999999999999999999999",
    provenance: "FIXTURE",
    intent: {
      account: syntheticAddress("synthetic-account"),
      inputAsset: { kind: "NATIVE" },
      outputAsset: { kind: "ERC20", address: outputToken },
      inputAmount: "1000000000000000",
      maxSlippageBps: 50,
      allowedProtocols: ["synthetic-protocol"],
      recipient: syntheticAddress("synthetic-recipient"),
    },
    quotes: [
      {
        quoteId: "synthetic-quote-1",
        protocolId: "synthetic-protocol",
        inputAsset: { kind: "NATIVE" },
        outputAsset: { kind: "ERC20", address: outputToken },
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
      raw: { source: "synthetic", supported: true },
    },
    simulation: {
      availability: "AVAILABLE",
      executionStatus: "SUCCESS",
      raw: { source: "synthetic", execution: "complete" },
      receipts: {
        availability: "AVAILABLE",
        items: [{ status: "SUCCESS", raw: { id: "synthetic-receipt" } }],
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
          sourceReferences: ["/intent", "/simulation"],
        },
      ],
    },
    decision: { status: "MANUAL_REVIEW" },
    limitations: [],
  };
}

export function buildStopReport(): PreflightReportInput {
  const report = buildManualReviewReport();

  return {
    ...report,
    selection: {
      status: "NOT_SELECTED",
      reason: {
        code: "SYNTHETIC_NO_SELECTION",
        sourceReferences: ["/quotes/0"],
      },
    },
    capability: unavailable("MISSING"),
    simulation: unavailable("UNPROVABLE", "SYNTHETIC_SIMULATION_UNPROVABLE", [
      "/capability",
    ]),
    alignment: {
      checks: [
        {
          checkId: "synthetic-critical-alignment",
          critical: true,
          status: "REVIEW",
          sourceReferences: ["/capability", "/simulation"],
        },
      ],
    },
    decision: {
      status: "STOP",
      reasons: [
        {
          code: "SYNTHETIC_EVIDENCE_INCOMPLETE",
          sourceReferences: ["/selection", "/capability", "/simulation"],
        },
      ],
    },
    limitations: [
      {
        code: "SYNTHETIC_LIMITATION",
        description: "Synthetic evidence is intentionally unavailable.",
        sourceReferences: ["/simulation"],
      },
    ],
  };
}
