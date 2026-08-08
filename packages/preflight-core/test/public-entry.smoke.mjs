const resolvedEntry = import.meta.resolve("@moss-mini-demo/preflight-core");
if (!resolvedEntry.endsWith("/packages/preflight-core/dist/index.js")) {
  throw new Error(
    `public package entry resolved outside preflight-core dist: ${resolvedEntry}`,
  );
}

const packageEntry = await import("@moss-mini-demo/preflight-core");
const runtimeExports = Object.keys(packageEntry).sort();
const expectedRuntimeExports = [
  "AlignmentInputErrorV0_1",
  "PreflightAssemblyErrorV0_1",
  "assemblePreflightReportV0_1",
  "derivePreflightPresentationV0_1",
  "evaluateAlignmentV0_1",
];
if (JSON.stringify(runtimeExports) !== JSON.stringify(expectedRuntimeExports)) {
  throw new Error(
    `unexpected preflight-core runtime exports: ${runtimeExports.join(", ")}`,
  );
}

let boundaryError;
try {
  packageEntry.evaluateAlignmentV0_1({ schemaVersion: "0.2" });
} catch (error) {
  boundaryError = error;
}
if (!(boundaryError instanceof packageEntry.AlignmentInputErrorV0_1)) {
  throw new Error("invalid input did not throw AlignmentInputErrorV0_1");
}
if (boundaryError.code !== "UNSUPPORTED_SCHEMA_VERSION") {
  throw new Error(`unexpected boundary error code: ${boundaryError.code}`);
}

const source = {
  schemaVersion: "0.1",
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
    raw: {
      source: "synthetic-package-smoke",
      context: {
        block: { status: "PROVEN", blockNumber: "0x1", blockHash: "0x01" },
        moss: { commit: "synthetic-package-smoke" },
      },
    },
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
const metadata = {
  reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  generatedAt: "2031-03-04T05:06:07.000Z",
  network: "eip155:143",
  provenance: "FIXTURE",
  limitations: [],
};
const report = packageEntry.assemblePreflightReportV0_1(source, metadata);
if (JSON.stringify(report.decision) !== '{"status":"MANUAL_REVIEW"}') {
  throw new Error(`unexpected assembled Decision: ${JSON.stringify(report)}`);
}
const presentation = packageEntry.derivePreflightPresentationV0_1(report);
if (
  JSON.stringify(presentation.decision) !== '{"status":"MANUAL_REVIEW"}' ||
  presentation.sourceContextReferences.length !== 2
) {
  throw new Error(
    `unexpected derived presentation: ${JSON.stringify(presentation)}`,
  );
}

let assemblyError;
try {
  packageEntry.assemblePreflightReportV0_1(
    { ...source, schemaVersion: "0.2" },
    metadata,
  );
} catch (error) {
  assemblyError = error;
}
if (!(assemblyError instanceof packageEntry.PreflightAssemblyErrorV0_1)) {
  throw new Error("invalid assembly input did not throw its public error");
}
if (assemblyError.code !== "UNSUPPORTED_SCHEMA_VERSION") {
  throw new Error(`unexpected assembly error code: ${assemblyError.code}`);
}

for (const typeOnlyName of [
  "AlignmentCheckIdV0_1",
  "AlignmentFactValueV0_1",
  "AlignmentInputV0_1",
  "AlignmentMovementV0_1",
  "AlignmentObservationV0_1",
  "AlignmentStateStatusV0_1",
  "AlignmentTransactionTargetV0_1",
  "AlignmentVerificationStatusV0_1",
  "PreflightAssemblyMetadataV0_1",
  "PreflightAssemblySourceV0_1",
  "PreflightPresentationDecisionV0_1",
  "PreflightPresentationReasonV0_1",
  "PreflightPresentationV0_1",
]) {
  if (typeOnlyName in packageEntry) {
    throw new Error(`${typeOnlyName} must not exist at runtime`);
  }
}
