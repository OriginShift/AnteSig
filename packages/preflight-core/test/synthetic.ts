import type { AlignmentCheckIdV0_1, AlignmentInputV0_1 } from "../src/index.js";

export const ACCOUNT = "0x1111111111111111111111111111111111111111";
export const TOKEN = "0x2222222222222222222222222222222222222222";
export const RECIPIENT = "0x3333333333333333333333333333333333333333";
export const TARGET = "0x4444444444444444444444444444444444444444";
export const OTHER = "0x5555555555555555555555555555555555555555";

type MutableRecord = Record<string, unknown>;
export type MutableFact = MutableRecord & {
  availability: string;
  sourceReference: string;
  value?: unknown;
};

export type CheckCase = Readonly<{
  id: AlignmentCheckIdV0_1;
  factPath: readonly string[];
  failValue: unknown;
  updatePublicEvidence?: (input: AlignmentInputV0_1, value: unknown) => void;
}>;

const inputAsset = { kind: "NATIVE" } as const;
const outputAsset = { kind: "ERC20", address: TOKEN } as const;
const movement = {
  asset: inputAsset,
  from: ACCOUNT,
  to: TARGET,
  amount: "1000",
};
const expectedTargets = [{ address: TARGET, role: "PROTOCOL" }];

const BASE_INPUT = {
  schemaVersion: "0.1",
  intent: {
    account: ACCOUNT,
    inputAsset,
    outputAsset,
    inputAmount: "1000",
    maxSlippageBps: 50,
    allowedProtocols: ["alpha-protocol"],
    recipient: RECIPIENT,
  },
  quotes: [
    {
      quoteId: "synthetic-quote",
      protocolId: "alpha-protocol",
      inputAsset,
      outputAsset,
      inputAmount: "1000",
      status: "SUCCESS",
      outputAmount: "4200",
      raw: { context: { operation: "swap" } },
    },
  ],
  selection: {
    status: "SELECTED",
    protocolId: "alpha-protocol",
    quoteId: "synthetic-quote",
    reason: {
      code: "DETERMINISTIC_SELECTION",
      sourceReferences: ["/quotes/0/raw"],
    },
  },
  capability: {
    availability: "AVAILABLE",
    raw: {
      context: {
        operation: "swap",
        account: ACCOUNT,
        inputAsset,
        outputAsset,
        amountIn: "1000",
        slippageBps: 25,
        protocolId: "alpha-protocol",
        recipient: RECIPIENT,
        approvalSpenderExpected: null,
        approvalSpenderObserved: null,
        approvalAmount: { amount: null, unbounded: false },
        permittedMovements: [movement],
        capabilityIntegrity: "PROVEN",
        expectedTransactionTargets: expectedTargets,
      },
    },
  },
  simulation: {
    availability: "AVAILABLE",
    executionStatus: "SUCCESS",
    raw: {
      context: {
        observedMovements: [movement],
        observedTransactionTargets: [TARGET],
        warnings: [],
        receipts: {
          expectedCount: 1,
          observedCount: 1,
          allSuccessful: true,
        },
        coverage: "PROVEN",
        ordering: "PROVEN",
        stateContinuity: "NOT_APPLICABLE",
      },
    },
    receipts: {
      availability: "AVAILABLE",
      items: [{ status: "SUCCESS", raw: { receiptId: "synthetic-0" } }],
    },
    outcomes: {
      availability: "AVAILABLE",
      items: [{ status: "SUCCESS", raw: { outcomeId: "synthetic-0" } }],
    },
    warnings: { availability: "AVAILABLE", items: [] },
    coverage: {
      availability: "AVAILABLE",
      complete: true,
      raw: { status: "PROVEN" },
    },
    ordering: {
      availability: "AVAILABLE",
      valid: true,
      raw: { status: "PROVEN" },
    },
    stateContinuity: {
      availability: "AVAILABLE",
      continuous: true,
      raw: { status: "NOT_APPLICABLE" },
    },
  },
  observations: {
    operation: {
      expected: {
        availability: "AVAILABLE",
        value: "swap",
        sourceReference: "/quotes/0/raw/context/operation",
      },
      observed: {
        availability: "AVAILABLE",
        value: "swap",
        sourceReference: "/capability/raw/context/operation",
      },
    },
    account: {
      availability: "AVAILABLE",
      value: ACCOUNT,
      sourceReference: "/capability/raw/context/account",
    },
    inputAsset: {
      availability: "AVAILABLE",
      value: inputAsset,
      sourceReference: "/capability/raw/context/inputAsset",
    },
    outputAsset: {
      availability: "AVAILABLE",
      value: outputAsset,
      sourceReference: "/capability/raw/context/outputAsset",
    },
    amountIn: {
      availability: "AVAILABLE",
      value: "1000",
      sourceReference: "/capability/raw/context/amountIn",
    },
    slippageBps: {
      availability: "AVAILABLE",
      value: 25,
      sourceReference: "/capability/raw/context/slippageBps",
    },
    allowedProtocol: {
      availability: "AVAILABLE",
      value: "alpha-protocol",
      sourceReference: "/capability/raw/context/protocolId",
    },
    recipient: {
      availability: "AVAILABLE",
      value: RECIPIENT,
      sourceReference: "/capability/raw/context/recipient",
    },
    approvalSpender: {
      expected: {
        availability: "AVAILABLE",
        value: null,
        sourceReference: "/capability/raw/context/approvalSpenderExpected",
      },
      observed: {
        availability: "AVAILABLE",
        value: null,
        sourceReference: "/capability/raw/context/approvalSpenderObserved",
      },
    },
    approvalAmount: {
      availability: "AVAILABLE",
      value: { amount: null, unbounded: false },
      sourceReference: "/capability/raw/context/approvalAmount",
    },
    fundsMovement: {
      permitted: {
        availability: "AVAILABLE",
        value: [movement],
        sourceReference: "/capability/raw/context/permittedMovements",
      },
      observed: {
        availability: "AVAILABLE",
        value: [movement],
        sourceReference: "/simulation/raw/context/observedMovements",
      },
    },
    capabilityIntegrity: {
      availability: "AVAILABLE",
      value: "PROVEN",
      sourceReference: "/capability/raw/context/capabilityIntegrity",
    },
    transactionSet: {
      expected: {
        availability: "AVAILABLE",
        value: expectedTargets,
        sourceReference: "/capability/raw/context/expectedTransactionTargets",
      },
      observed: {
        availability: "AVAILABLE",
        value: [TARGET],
        sourceReference: "/simulation/raw/context/observedTransactionTargets",
      },
    },
    warnings: {
      availability: "AVAILABLE",
      value: [],
      sourceReference: "/simulation/raw/context/warnings",
    },
    receipts: {
      availability: "AVAILABLE",
      value: {
        expectedCount: 1,
        observedCount: 1,
        allSuccessful: true,
      },
      sourceReference: "/simulation/raw/context/receipts",
    },
    coverage: {
      availability: "AVAILABLE",
      value: "PROVEN",
      sourceReference: "/simulation/raw/context/coverage",
    },
    ordering: {
      availability: "AVAILABLE",
      value: "PROVEN",
      sourceReference: "/simulation/raw/context/ordering",
    },
    stateContinuity: {
      availability: "AVAILABLE",
      value: "NOT_APPLICABLE",
      sourceReference: "/simulation/raw/context/stateContinuity",
    },
  },
};

export function buildPassingInput(): AlignmentInputV0_1 {
  return JSON.parse(JSON.stringify(BASE_INPUT)) as AlignmentInputV0_1;
}

export function getAtPath(root: unknown, path: readonly string[]): unknown {
  let current = root;
  for (const segment of path) {
    if (typeof current !== "object" || current === null) {
      throw new Error(`cannot read synthetic path ${path.join(".")}`);
    }
    current = (current as MutableRecord)[segment];
  }
  return current;
}

export function setAtPath(
  root: unknown,
  path: readonly string[],
  value: unknown,
): void {
  const parent = getAtPath(root, path.slice(0, -1));
  if (typeof parent !== "object" || parent === null) {
    throw new Error(`cannot write synthetic path ${path.join(".")}`);
  }
  (parent as MutableRecord)[path.at(-1) ?? ""] = value;
}

function decodePointer(pointer: string): string[] {
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function primaryFact(
  input: AlignmentInputV0_1,
  checkCase: CheckCase,
): MutableFact {
  return getAtPath(input, checkCase.factPath) as MutableFact;
}

export function setFactAndSource(
  input: AlignmentInputV0_1,
  fact: MutableFact,
  value: unknown,
): void {
  setAtPath(input, decodePointer(fact.sourceReference), structuredClone(value));
  fact.value = structuredClone(value);
}

export function makeExplicitGap(
  input: AlignmentInputV0_1,
  checkCase: CheckCase,
): void {
  const capabilityGap = {
    availability: "UNPROVABLE",
    failure: {
      code: "SYNTHETIC_UNPROVABLE",
      sourceReferences: ["/intent"],
    },
  };
  const simulationGap = structuredClone(capabilityGap);
  const simulationChecks = new Set<AlignmentCheckIdV0_1>([
    "unexpected-funds-movement-v0-1",
    "transaction-set-v0-1",
    "warning-presence-v0-1",
    "receipt-availability-v0-1",
    "coverage-v0-1",
    "ordering-v0-1",
    "state-continuity-v0-1",
  ]);
  const fact = primaryFact(input, checkCase);
  delete fact.value;
  fact.availability = "UNPROVABLE";
  if (simulationChecks.has(checkCase.id)) {
    (input as unknown as MutableRecord).simulation = simulationGap;
    fact.sourceReference = "/simulation/availability";
  } else {
    (input as unknown as MutableRecord).capability = capabilityGap;
    fact.sourceReference = "/capability/availability";
  }
}

export function makeIrrelevantReference(
  input: AlignmentInputV0_1,
  checkCase: CheckCase,
): void {
  const fact = primaryFact(input, checkCase);
  const simulationOwned = fact.sourceReference.startsWith("/simulation/");
  const capability = (input.capability as unknown as MutableRecord)
    .raw as MutableRecord;
  const simulation = (input.simulation as unknown as MutableRecord)
    .raw as MutableRecord;
  const quoteRaw = (input.quotes[0] as unknown as MutableRecord)
    .raw as MutableRecord;
  const targetRoot =
    checkCase.id === "capability-integrity-v0-1"
      ? quoteRaw
      : simulationOwned
        ? capability
        : simulation;
  const targetPrefix =
    checkCase.id === "capability-integrity-v0-1"
      ? "/quotes/0/raw"
      : simulationOwned
        ? "/capability/raw"
        : "/simulation/raw";
  targetRoot.irrelevant = targetRoot.irrelevant ?? {};
  (targetRoot.irrelevant as MutableRecord)[checkCase.id] = structuredClone(
    fact.value,
  );
  fact.sourceReference = `${targetPrefix}/irrelevant/${checkCase.id}`;
}

export function makeSameOwnerIrrelevantReference(
  input: AlignmentInputV0_1,
  checkCase: CheckCase,
): void {
  const fact = primaryFact(input, checkCase);
  const simulationOwned = fact.sourceReference.startsWith("/simulation/");
  const root = simulationOwned
    ? ((input.simulation as unknown as MutableRecord).raw as MutableRecord)
    : ((input.capability as unknown as MutableRecord).raw as MutableRecord);
  root.irrelevant = root.irrelevant ?? {};
  (root.irrelevant as MutableRecord)[checkCase.id] = structuredClone(
    fact.value,
  );
  fact.sourceReference = `${simulationOwned ? "/simulation/raw" : "/capability/raw"}/irrelevant/${checkCase.id}`;
}

export const CHECK_CASES: readonly CheckCase[] = [
  {
    id: "operation-v0-1",
    factPath: ["observations", "operation", "observed"],
    failValue: "lend",
  },
  {
    id: "account-v0-1",
    factPath: ["observations", "account"],
    failValue: OTHER,
  },
  {
    id: "input-asset-v0-1",
    factPath: ["observations", "inputAsset"],
    failValue: outputAsset,
  },
  {
    id: "output-asset-v0-1",
    factPath: ["observations", "outputAsset"],
    failValue: inputAsset,
  },
  {
    id: "amount-in-v0-1",
    factPath: ["observations", "amountIn"],
    failValue: "1001",
  },
  {
    id: "slippage-v0-1",
    factPath: ["observations", "slippageBps"],
    failValue: 51,
  },
  {
    id: "allowed-protocol-v0-1",
    factPath: ["observations", "allowedProtocol"],
    failValue: "beta-protocol",
  },
  {
    id: "recipient-v0-1",
    factPath: ["observations", "recipient"],
    failValue: OTHER,
  },
  {
    id: "approval-spender-v0-1",
    factPath: ["observations", "approvalSpender", "observed"],
    failValue: OTHER,
  },
  {
    id: "approval-amount-v0-1",
    factPath: ["observations", "approvalAmount"],
    failValue: { amount: "1000", unbounded: true },
  },
  {
    id: "unexpected-funds-movement-v0-1",
    factPath: ["observations", "fundsMovement", "observed"],
    failValue: [{ ...movement, to: OTHER }],
  },
  {
    id: "capability-integrity-v0-1",
    factPath: ["observations", "capabilityIntegrity"],
    failValue: "FAILED",
  },
  {
    id: "transaction-set-v0-1",
    factPath: ["observations", "transactionSet", "observed"],
    failValue: [OTHER],
  },
  {
    id: "warning-presence-v0-1",
    factPath: ["observations", "warnings"],
    failValue: [{ code: "SYNTHETIC_WARNING" }],
    updatePublicEvidence(input, value) {
      if (input.simulation.availability === "AVAILABLE") {
        input.simulation.warnings = {
          availability: "AVAILABLE",
          items: value as never[],
        };
      }
    },
  },
  {
    id: "receipt-availability-v0-1",
    factPath: ["observations", "receipts"],
    failValue: {
      expectedCount: 1,
      observedCount: 1,
      allSuccessful: false,
    },
    updatePublicEvidence(input) {
      if (
        input.simulation.availability === "AVAILABLE" &&
        input.simulation.receipts.availability === "AVAILABLE"
      ) {
        input.simulation.receipts.items[0] = {
          status: "FAILED",
          raw: { receiptId: "synthetic-failed" },
        };
      }
    },
  },
  {
    id: "coverage-v0-1",
    factPath: ["observations", "coverage"],
    failValue: "FAILED",
    updatePublicEvidence(input) {
      if (
        input.simulation.availability === "AVAILABLE" &&
        input.simulation.coverage.availability === "AVAILABLE"
      ) {
        input.simulation.coverage.complete = false;
      }
    },
  },
  {
    id: "ordering-v0-1",
    factPath: ["observations", "ordering"],
    failValue: "FAILED",
    updatePublicEvidence(input) {
      if (
        input.simulation.availability === "AVAILABLE" &&
        input.simulation.ordering.availability === "AVAILABLE"
      ) {
        input.simulation.ordering.valid = false;
      }
    },
  },
  {
    id: "state-continuity-v0-1",
    factPath: ["observations", "stateContinuity"],
    failValue: "FAILED",
    updatePublicEvidence(input) {
      if (
        input.simulation.availability === "AVAILABLE" &&
        input.simulation.stateContinuity.availability === "AVAILABLE"
      ) {
        input.simulation.stateContinuity.continuous = false;
      }
    },
  },
];
