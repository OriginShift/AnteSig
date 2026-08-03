const resolvedEntry = import.meta.resolve("@moss-mini-demo/decision-engine");
if (!resolvedEntry.endsWith("/packages/decision-engine/dist/index.js")) {
  throw new Error(
    `public package entry resolved outside decision-engine dist: ${resolvedEntry}`,
  );
}

const packageEntry = await import("@moss-mini-demo/decision-engine");
const runtimeExports = Object.keys(packageEntry).sort();
const expectedRuntimeExports = [
  "DecisionInputErrorV0_1",
  "evaluateDecisionV0_1",
];
if (JSON.stringify(runtimeExports) !== JSON.stringify(expectedRuntimeExports)) {
  throw new Error(
    `unexpected decision-engine runtime exports: ${runtimeExports.join(", ")}`,
  );
}

const input = {
  schemaVersion: "0.1",
  reportId: "22222222-2222-4222-8222-222222222222",
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
    allowedProtocols: ["synthetic-smoke-protocol"],
  },
  quotes: [
    {
      quoteId: "synthetic-smoke-quote",
      protocolId: "synthetic-smoke-protocol",
      inputAsset: { kind: "NATIVE" },
      outputAsset: {
        kind: "ERC20",
        address: "0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC",
      },
      inputAmount: "1000000000000000",
      status: "SUCCESS",
      outputAmount: "42000000",
      raw: { source: "synthetic-package-smoke" },
    },
  ],
  selection: {
    status: "SELECTED",
    protocolId: "synthetic-smoke-protocol",
    quoteId: "synthetic-smoke-quote",
    reason: {
      code: "SYNTHETIC_SELECTION",
      sourceReferences: ["/quotes/0"],
    },
  },
  capability: {
    availability: "AVAILABLE",
    raw: { source: "synthetic-package-smoke" },
  },
  simulation: {
    availability: "AVAILABLE",
    executionStatus: "SUCCESS",
    raw: { source: "synthetic-package-smoke" },
    receipts: {
      availability: "AVAILABLE",
      items: [{ status: "SUCCESS", raw: { source: "synthetic-receipt" } }],
    },
    outcomes: {
      availability: "AVAILABLE",
      items: [{ status: "SUCCESS", raw: { source: "synthetic-outcome" } }],
    },
    warnings: { availability: "AVAILABLE", items: [] },
    coverage: {
      availability: "AVAILABLE",
      complete: true,
      raw: { source: "synthetic-coverage" },
    },
    ordering: {
      availability: "AVAILABLE",
      valid: true,
      raw: { source: "synthetic-ordering" },
    },
    stateContinuity: {
      availability: "AVAILABLE",
      continuous: true,
      raw: { source: "synthetic-continuity" },
    },
  },
  alignment: {
    checks: [
      {
        checkId: "synthetic-smoke-alignment",
        critical: true,
        status: "PASS",
        sourceReferences: ["/intent/inputAmount"],
      },
    ],
  },
};

const manualReview = packageEntry.evaluateDecisionV0_1(input);
if (JSON.stringify(manualReview) !== '{"status":"MANUAL_REVIEW"}') {
  throw new Error(
    `unexpected MANUAL_REVIEW output: ${JSON.stringify(manualReview)}`,
  );
}

const stopInput = structuredClone(input);
stopInput.selection = {
  status: "NOT_SELECTED",
  reason: {
    code: "SYNTHETIC_NO_SELECTION",
    sourceReferences: ["/quotes/0"],
  },
};
const stop = packageEntry.evaluateDecisionV0_1(stopInput);
if (
  stop.status !== "STOP" ||
  stop.reasons.length !== 1 ||
  stop.reasons[0]?.code !== "NO_VALID_SELECTION" ||
  stop.reasons[0]?.sourceReferences[0] !== "/selection/status"
) {
  throw new Error(`unexpected STOP output: ${JSON.stringify(stop)}`);
}

let boundaryError;
try {
  packageEntry.evaluateDecisionV0_1({ schemaVersion: "0.2" });
} catch (error) {
  boundaryError = error;
}
if (!(boundaryError instanceof packageEntry.DecisionInputErrorV0_1)) {
  throw new Error("invalid input did not throw DecisionInputErrorV0_1");
}
if (boundaryError.code !== "UNSUPPORTED_SCHEMA_VERSION") {
  throw new Error(`unexpected boundary error code: ${boundaryError.code}`);
}

for (const typeOnlyName of ["DecisionV0_1", "StopReasonCodeV0_1"]) {
  if (typeOnlyName in packageEntry) {
    throw new Error(`${typeOnlyName} must not exist at runtime`);
  }
}
