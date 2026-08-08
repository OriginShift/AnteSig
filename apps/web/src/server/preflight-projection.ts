import "server-only";

import type {
  CapabilityConstructionResultV0_1,
  QuoteCollectionRequestV0_1,
  QuoteCollectionResultV0_1,
  RawCapability,
  RawSimulationEvidence,
} from "@moss-mini-demo/moss-adapter";
import {
  assemblePreflightReportV0_1,
  evaluateAlignmentV0_1,
} from "@moss-mini-demo/preflight-core";
import {
  CapabilitySchema,
  type Intent,
  type Limitation,
  type Network,
  type PreflightReport,
  type Provenance,
  QuoteSchema,
  SelectionSchema,
  SimulationSchema,
} from "@moss-mini-demo/report-schema";

type SelectedQuoteCollection = Extract<
  QuoteCollectionResultV0_1,
  { status: "SELECTED" }
>;

export type PreflightProjectionMetadata = Readonly<{
  reportId: string;
  generatedAt: string;
  network: Network;
  provenance: Exclude<Provenance, "FIXTURE">;
  limitations: readonly Limitation[];
}>;

export type PreflightProjectionInput = Readonly<{
  intent: Intent;
  quoteRequest: QuoteCollectionRequestV0_1;
  quote:
    | Readonly<{
        status: "COLLECTED";
        result: QuoteCollectionResultV0_1;
      }>
    | Readonly<{
        status: "FAILED";
        code: "QUOTE_STAGE_TIMEOUT";
      }>;
  capability:
    | Readonly<{
        status: "AVAILABLE";
        result: CapabilityConstructionResultV0_1;
      }>
    | Readonly<{
        status: "FAILED" | "MISSING";
        code: string;
      }>;
  simulation:
    | Readonly<{ status: "AVAILABLE"; evidence: RawSimulationEvidence }>
    | Readonly<{
        status: "FAILED" | "MISSING";
        code: string;
      }>;
  metadata: PreflightProjectionMetadata;
}>;

export class PreflightProjectionError extends Error {
  constructor() {
    super("Preflight evidence cannot be projected");
    this.name = "PreflightProjectionError";
  }
}

type JsonRecord = Record<string, unknown>;
type Availability = "FAILED" | "MISSING" | "UNPROVABLE";

function invariant(): never {
  throw new PreflightProjectionError();
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonClone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return invariant();
  }
}

function quoteId(index: number, protocolId: string): string {
  return `quote-${index}-${protocolId}`;
}

function projectQuotes(input: PreflightProjectionInput) {
  if (input.quote.status === "FAILED") {
    const failureCode = input.quote.code;
    return input.quoteRequest.candidateProtocols.map((protocolId, index) =>
      QuoteSchema.parse({
        quoteId: quoteId(index, protocolId),
        protocolId,
        inputAsset: input.intent.inputAsset,
        outputAsset: input.intent.outputAsset,
        inputAmount: input.intent.inputAmount,
        status: "FAILED",
        failure: {
          code: failureCode,
          sourceReferences: ["/intent"],
        },
      }),
    );
  }

  return input.quote.result.outcomes.map((outcome, index) => {
    const base = {
      quoteId: quoteId(index, outcome.protocolId),
      protocolId: outcome.protocolId,
      inputAsset: input.intent.inputAsset,
      outputAsset: input.intent.outputAsset,
      inputAmount: input.intent.inputAmount,
    };
    if (outcome.status !== "ELIGIBLE") {
      return QuoteSchema.parse({
        ...base,
        status: "FAILED",
        failure: {
          code: outcome.failure.code,
          sourceReferences: ["/intent"],
        },
      });
    }
    return QuoteSchema.parse({
      ...base,
      status: "SUCCESS",
      outputAmount: outcome.normalized.outputAmount,
      raw: {
        context: {
          operation: outcome.normalized.method,
          timing: outcome.acquiredTiming,
        },
        source: outcome.raw.source,
        snapshot: outcome.raw.snapshot,
        normalized: outcome.normalized,
      },
    });
  });
}

function projectSelection(
  input: PreflightProjectionInput,
  quotes: ReturnType<typeof projectQuotes>,
) {
  if (input.quote.status === "FAILED") {
    return SelectionSchema.parse({
      status: "NOT_SELECTED",
      reason: {
        code: input.quote.code,
        sourceReferences: ["/quotes"],
      },
    });
  }
  const result = input.quote.result;
  if (result.status === "NOT_SELECTED") {
    return SelectionSchema.parse({
      status: "NOT_SELECTED",
      reason: {
        code: result.code,
        sourceReferences: ["/quotes"],
      },
    });
  }

  const selectedIndex = result.outcomes.findIndex(
    (outcome) =>
      outcome.status === "ELIGIBLE" &&
      outcome.protocolId === result.selected.protocolId,
  );
  const quote = quotes[selectedIndex];
  if (selectedIndex < 0 || quote?.status !== "SUCCESS") {
    return invariant();
  }
  return SelectionSchema.parse({
    status: "SELECTED",
    protocolId: result.selected.protocolId,
    quoteId: quote.quoteId,
    reason: {
      code: result.method,
      sourceReferences: [`/quotes/${selectedIndex}/raw`],
    },
  });
}

function unavailableEvidence(
  availability: Availability,
  code: string,
  source: string,
) {
  return {
    availability,
    failure: { code, sourceReferences: [source] },
  } as const;
}

function transactionNodes(value: unknown): JsonRecord[] {
  if (!isRecord(value)) {
    return [];
  }
  const nodes: JsonRecord[] = [];
  if (value.kind === "transaction" && isRecord(value.transaction)) {
    nodes.push(value.transaction);
  }
  if (Array.isArray(value.children)) {
    for (const child of value.children) {
      nodes.push(...transactionNodes(child));
    }
  }
  return nodes;
}

function nativeMovements(capability: RawCapability) {
  return transactionNodes(capability).flatMap((transaction) => {
    if (
      typeof transaction.from !== "string" ||
      typeof transaction.to !== "string" ||
      typeof transaction.value !== "string" ||
      !/^0x[0-9a-fA-F]+$/.test(transaction.value)
    ) {
      return [];
    }
    const amount = BigInt(transaction.value);
    return amount === 0n
      ? []
      : [
          {
            asset: { kind: "NATIVE" as const },
            from: transaction.from,
            to: transaction.to,
            amount: amount.toString(),
          },
        ];
  });
}

function approvalFacts(capability: RawCapability, inputAmount: string) {
  const approvals: JsonRecord[] = [];
  const visit = (value: unknown): void => {
    if (!isRecord(value)) {
      return;
    }
    if (value.kind === "capability" && value.method === "approve") {
      approvals.push(value);
    }
    if (Array.isArray(value.children)) {
      value.children.forEach(visit);
    }
  };
  visit(capability);
  if (approvals.length === 0) {
    return {
      expectedSpender: null,
      observedSpender: null,
      amount: { amount: null, unbounded: false },
    };
  }
  if (approvals.length !== 1 || !isRecord(approvals[0]?.params)) {
    return undefined;
  }
  const spender = approvals[0].params.spender;
  if (typeof spender !== "string") {
    return undefined;
  }
  return {
    expectedSpender: spender,
    observedSpender: spender,
    amount: { amount: inputAmount, unbounded: false },
  };
}

function projectCapability(input: PreflightProjectionInput) {
  if (input.capability.status !== "AVAILABLE") {
    return CapabilitySchema.parse(
      unavailableEvidence(
        input.capability.status,
        input.capability.code,
        "/selection/status",
      ),
    );
  }
  if (
    input.quote.status !== "COLLECTED" ||
    input.quote.result.status !== "SELECTED"
  ) {
    return invariant();
  }

  const result = input.capability.result;
  const integrity = result.verifyCurrentIntegrity();
  const approval = approvalFacts(
    result.simulatorInput,
    input.intent.inputAmount,
  );
  const context = {
    operation: result.operation.method,
    account: result.actionInput.account,
    inputAsset: input.intent.inputAsset,
    outputAsset: input.intent.outputAsset,
    amountIn: input.intent.inputAmount,
    slippageBps: input.intent.maxSlippageBps,
    protocolId: result.operation.protocolId,
    recipient: input.intent.recipient ?? input.intent.account,
    approvalSpenderExpected: approval?.expectedSpender ?? null,
    approvalSpenderObserved: approval?.observedSpender ?? null,
    approvalAmount: approval?.amount ?? { amount: null, unbounded: false },
    approvalProven: approval !== undefined,
    permittedMovements: nativeMovements(result.simulatorInput),
    capabilityIntegrity:
      integrity.status === "MATCH" &&
      result.miniDemoDerived.nodeCount.status === "EXPECTED" &&
      result.miniDemoDerived.transactionTargets.status === "EXPECTED"
        ? "PROVEN"
        : "FAILED",
    expectedTransactionTargets:
      result.miniDemoDerived.transactionTargets.expected,
  };
  return CapabilitySchema.parse({
    availability: "AVAILABLE",
    raw: {
      context,
      operation: result.operation,
      mossOriginal: result.mossOriginal,
      miniDemoDerived: result.miniDemoDerived,
    },
  });
}

function outcomeSucceeded(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (value.status === "SUCCESS") {
    return true;
  }
  return isRecord(value.outcome) && value.outcome.status === "SUCCESS";
}

function simulationTargets(evidence: RawSimulationEvidence): string[] {
  return evidence.mossOriginal.transactions.flatMap(({ value }) =>
    isRecord(value) && typeof value.to === "string" ? [value.to] : [],
  );
}

function projectSimulation(
  input: PreflightProjectionInput,
  capability: ReturnType<typeof projectCapability>,
) {
  if (input.simulation.status !== "AVAILABLE") {
    return SimulationSchema.parse(
      unavailableEvidence(
        input.simulation.status,
        input.simulation.code,
        capability.availability === "AVAILABLE"
          ? "/capability/raw"
          : "/capability/availability",
      ),
    );
  }
  if (
    input.capability.status !== "AVAILABLE" ||
    capability.availability !== "AVAILABLE"
  ) {
    return invariant();
  }

  const evidence = input.simulation.evidence;
  const receipts = evidence.mossOriginal.receipts.map(({ value }) => ({
    status: outcomeSucceeded(value)
      ? ("SUCCESS" as const)
      : ("FAILED" as const),
    raw: value,
  }));
  const outcomes = evidence.mossOriginal.outcomes.map(({ value }) => ({
    status: outcomeSucceeded(value)
      ? ("SUCCESS" as const)
      : ("FAILED" as const),
    raw: value,
  }));
  const warnings = evidence.mossOriginal.warnings.map(({ value }) => value);
  const coverageProven = evidence.miniDemoDerived.receiptCoverage === "PROVEN";
  const orderingProven = evidence.miniDemoDerived.ordering === "PROVEN";
  const stateStatus = evidence.miniDemoDerived.stateContinuity;
  const stateContinuous =
    stateStatus === "PROVEN" || stateStatus === "NOT_APPLICABLE";
  const interrupted = stateStatus === "FAILED";
  const executionFailed =
    receipts.some((receipt) => receipt.status === "FAILED") ||
    outcomes.some((outcome) => outcome.status === "FAILED") ||
    evidence.mossOriginal.warnings.some(({ code }) => code === "REVERTED");

  const observedMovements = evidence.mossOriginal.transactions.flatMap(
    ({ value }) =>
      nativeMovements({
        kind: "capability",
        children: [{ kind: "transaction", transaction: value }],
      }),
  );
  const context = {
    block: evidence.miniDemoDerived.simulationBlock,
    moss: evidence.sourceContext,
    observedMovements,
    observedTransactionTargets: simulationTargets(evidence),
    warnings,
    receipts: {
      expectedCount:
        input.capability.result.miniDemoDerived.nodeCount.actual
          .transactionNodes,
      observedCount: receipts.length,
      allSuccessful: receipts.every((receipt) => receipt.status === "SUCCESS"),
    },
    coverage: coverageProven ? "PROVEN" : "FAILED",
    ordering: orderingProven ? "PROVEN" : "FAILED",
    stateContinuity: stateStatus,
  };

  return SimulationSchema.parse({
    availability: "AVAILABLE",
    executionStatus: interrupted
      ? "INTERRUPTED"
      : executionFailed
        ? "FAILED"
        : "SUCCESS",
    raw: {
      context,
      mossOriginal: evidence.mossOriginal,
      miniDemoDerived: evidence.miniDemoDerived,
    },
    receipts: { availability: "AVAILABLE", items: receipts },
    outcomes: { availability: "AVAILABLE", items: outcomes },
    warnings: { availability: "AVAILABLE", items: warnings },
    coverage: {
      availability: "AVAILABLE",
      complete: coverageProven,
      raw: { status: evidence.miniDemoDerived.receiptCoverage },
    },
    ordering: {
      availability: "AVAILABLE",
      valid: orderingProven,
      raw: { status: evidence.miniDemoDerived.ordering },
    },
    stateContinuity: {
      availability: "AVAILABLE",
      continuous: stateContinuous,
      raw: { status: stateStatus },
    },
  });
}

function gap(availability: Availability, sourceReference: string) {
  return { availability, sourceReference } as const;
}

function available<T>(value: T, sourceReference: string) {
  return { availability: "AVAILABLE" as const, value, sourceReference };
}

function alignmentObservations(
  quotes: ReturnType<typeof projectQuotes>,
  capability: ReturnType<typeof projectCapability>,
  simulation: ReturnType<typeof projectSimulation>,
) {
  const successfulQuoteIndex = quotes.findIndex(
    (quote) => quote.status === "SUCCESS",
  );
  const quote = quotes[successfulQuoteIndex];
  const operationExpected =
    quote?.status === "SUCCESS"
      ? available(
          (quote.raw as JsonRecord).context &&
            isRecord((quote.raw as JsonRecord).context)
            ? ((quote.raw as JsonRecord).context as JsonRecord).operation
            : undefined,
          `/quotes/${successfulQuoteIndex}/raw/context/operation`,
        )
      : gap(
          capability.availability === "AVAILABLE"
            ? "UNPROVABLE"
            : capability.availability,
          "/capability/availability",
        );

  const capabilityGap = () =>
    gap(
      capability.availability === "AVAILABLE"
        ? "UNPROVABLE"
        : capability.availability,
      "/capability/availability",
    );
  const simulationGap = () =>
    gap(
      simulation.availability === "AVAILABLE"
        ? "UNPROVABLE"
        : simulation.availability,
      "/simulation/availability",
    );
  const capabilityContext =
    capability.availability === "AVAILABLE" && isRecord(capability.raw)
      ? capability.raw.context
      : undefined;
  const simulationContext =
    simulation.availability === "AVAILABLE" && isRecord(simulation.raw)
      ? simulation.raw.context
      : undefined;
  const cap = isRecord(capabilityContext) ? capabilityContext : undefined;
  const sim = isRecord(simulationContext) ? simulationContext : undefined;
  const capFact = <T>(key: string, value: T) =>
    cap === undefined
      ? capabilityGap()
      : available(value, `/capability/raw/context/${key}`);
  const simFact = <T>(key: string, value: T) =>
    sim === undefined
      ? simulationGap()
      : available(value, `/simulation/raw/context/${key}`);

  const approvalProven = cap?.approvalProven === true;
  return {
    operation: {
      expected: operationExpected,
      observed:
        cap === undefined
          ? capabilityGap()
          : capFact("operation", cap.operation),
    },
    account:
      cap === undefined ? capabilityGap() : capFact("account", cap.account),
    inputAsset:
      cap === undefined
        ? capabilityGap()
        : capFact("inputAsset", cap.inputAsset),
    outputAsset:
      cap === undefined
        ? capabilityGap()
        : capFact("outputAsset", cap.outputAsset),
    amountIn:
      cap === undefined ? capabilityGap() : capFact("amountIn", cap.amountIn),
    slippageBps:
      cap === undefined
        ? capabilityGap()
        : capFact("slippageBps", cap.slippageBps),
    allowedProtocol:
      cap === undefined
        ? capabilityGap()
        : capFact("protocolId", cap.protocolId),
    recipient:
      cap === undefined ? capabilityGap() : capFact("recipient", cap.recipient),
    approvalSpender: {
      expected:
        cap === undefined || !approvalProven
          ? capabilityGap()
          : capFact("approvalSpenderExpected", cap.approvalSpenderExpected),
      observed:
        cap === undefined || !approvalProven
          ? capabilityGap()
          : capFact("approvalSpenderObserved", cap.approvalSpenderObserved),
    },
    approvalAmount:
      cap === undefined || !approvalProven
        ? capabilityGap()
        : capFact("approvalAmount", cap.approvalAmount),
    fundsMovement: {
      permitted:
        cap === undefined
          ? capabilityGap()
          : capFact("permittedMovements", cap.permittedMovements),
      observed:
        sim === undefined
          ? simulationGap()
          : simFact("observedMovements", sim.observedMovements),
    },
    capabilityIntegrity:
      cap === undefined
        ? capabilityGap()
        : capFact("capabilityIntegrity", cap.capabilityIntegrity),
    transactionSet: {
      expected:
        cap === undefined
          ? capabilityGap()
          : capFact(
              "expectedTransactionTargets",
              cap.expectedTransactionTargets,
            ),
      observed:
        sim === undefined
          ? simulationGap()
          : simFact(
              "observedTransactionTargets",
              sim.observedTransactionTargets,
            ),
    },
    warnings:
      sim === undefined ? simulationGap() : simFact("warnings", sim.warnings),
    receipts:
      sim === undefined ? simulationGap() : simFact("receipts", sim.receipts),
    coverage:
      sim === undefined ? simulationGap() : simFact("coverage", sim.coverage),
    ordering:
      sim === undefined ? simulationGap() : simFact("ordering", sim.ordering),
    stateContinuity:
      sim === undefined
        ? simulationGap()
        : simFact("stateContinuity", sim.stateContinuity),
  };
}

function validateStageCombinations(input: PreflightProjectionInput): void {
  const selected =
    input.quote.status === "COLLECTED" &&
    input.quote.result.status === "SELECTED";
  if (!selected && input.capability.status === "AVAILABLE") {
    invariant();
  }
  if (
    input.capability.status !== "AVAILABLE" &&
    input.simulation.status === "AVAILABLE"
  ) {
    invariant();
  }
}

export function projectPreflightReportV0_1(
  input: PreflightProjectionInput,
): PreflightReport {
  validateStageCombinations(input);
  const quotes = projectQuotes(input);
  if (quotes.length === 0) {
    return invariant();
  }
  const selection = projectSelection(input, quotes);
  const capability = projectCapability(input);
  const simulation = projectSimulation(input, capability);
  const alignment = evaluateAlignmentV0_1({
    schemaVersion: "0.1",
    intent: jsonClone(input.intent),
    quotes: jsonClone(quotes),
    selection: jsonClone(selection),
    capability: jsonClone(capability),
    simulation: jsonClone(simulation),
    observations: alignmentObservations(quotes, capability, simulation),
  });

  return assemblePreflightReportV0_1(
    {
      schemaVersion: "0.1",
      intent: jsonClone(input.intent),
      quotes: jsonClone(quotes),
      selection: jsonClone(selection),
      capability: jsonClone(capability),
      simulation: jsonClone(simulation),
      alignment,
    },
    {
      reportId: input.metadata.reportId,
      generatedAt: input.metadata.generatedAt,
      network: input.metadata.network,
      provenance: input.metadata.provenance,
      limitations: jsonClone(input.metadata.limitations),
    },
  );
}

export type { SelectedQuoteCollection };
