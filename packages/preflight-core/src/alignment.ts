import {
  type Alignment,
  AlignmentSchema,
  type Asset,
  AssetSchema,
  CapabilitySchema,
  type EvmAddress,
  EvmAddressSchema,
  IntentSchema,
  JsonValueSchema,
  PositiveAmountSchema,
  ProtocolIdSchema,
  QuoteSchema,
  SelectionSchema,
  SimulationSchema,
  UnsignedAmountSchema,
} from "@moss-mini-demo/report-schema";
import { z } from "zod";
import {
  type AlignmentCheckIdV0_1,
  type AlignmentFactRoleV0_1,
  compareUtf8V0_1,
  isJsonDescriptorClosedAlignmentInput,
  outputReferencesAreValidV0_1,
  validateFactReferenceV0_1,
} from "./source-references.js";

const SOURCE_REFERENCE_INPUT_SCHEMA = z.string().max(2048);
const GAP_AVAILABILITIES = ["FAILED", "MISSING", "UNPROVABLE"] as const;
const OPERATION_SCHEMA = z.string().min(1).max(128);
const STATUS_SCHEMA = z.enum(["PROVEN", "FAILED"]);
const STATE_STATUS_SCHEMA = z.enum(["PROVEN", "FAILED", "NOT_APPLICABLE"]);
const MOVEMENT_SCHEMA = z.strictObject({
  asset: AssetSchema,
  from: EvmAddressSchema,
  to: EvmAddressSchema,
  amount: PositiveAmountSchema,
});
const MOVEMENT_LIST_SCHEMA = z
  .array(MOVEMENT_SCHEMA)
  .superRefine((items, context) => {
    const keys = items.map((item) => movementKey(item));
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "Movement evidence must not contain duplicate entries",
      });
    }
  });
const TARGET_SCHEMA = z.strictObject({
  address: EvmAddressSchema,
  role: z.enum(["PROTOCOL", "SPENDER", "TOKEN"]),
});
const TARGET_LIST_SCHEMA = z
  .array(TARGET_SCHEMA)
  .superRefine((items, context) => {
    const keys = items.map((item) => item.address);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "Expected transaction targets must be unique",
      });
    }
  });
const ADDRESS_LIST_SCHEMA = z
  .array(EvmAddressSchema)
  .superRefine((items, context) => {
    if (new Set(items).size !== items.length) {
      context.addIssue({
        code: "custom",
        message: "Observed transaction targets must be unique",
      });
    }
  });
const APPROVAL_AMOUNT_SCHEMA = z.strictObject({
  amount: UnsignedAmountSchema.nullable(),
  unbounded: z.boolean(),
});
const RECEIPT_STATUS_SCHEMA = z.strictObject({
  expectedCount: z.number().int().safe().min(1),
  observedCount: z.number().int().safe().min(0),
  allSuccessful: z.boolean(),
});

const GAP_SCHEMA = z.discriminatedUnion("availability", [
  z.strictObject({
    availability: z.literal(GAP_AVAILABILITIES[0]),
    sourceReference: SOURCE_REFERENCE_INPUT_SCHEMA,
  }),
  z.strictObject({
    availability: z.literal(GAP_AVAILABILITIES[1]),
    sourceReference: SOURCE_REFERENCE_INPUT_SCHEMA,
  }),
  z.strictObject({
    availability: z.literal(GAP_AVAILABILITIES[2]),
    sourceReference: SOURCE_REFERENCE_INPUT_SCHEMA,
  }),
]);

function factSchema<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion("availability", [
    z.strictObject({
      availability: z.literal("AVAILABLE"),
      value: valueSchema,
      sourceReference: SOURCE_REFERENCE_INPUT_SCHEMA,
    }),
    ...GAP_SCHEMA.options,
  ]);
}

const OPERATION_FACT_SCHEMA = factSchema(OPERATION_SCHEMA);
const ADDRESS_FACT_SCHEMA = factSchema(EvmAddressSchema.nullable());
const ASSET_FACT_SCHEMA = factSchema(AssetSchema);
const AMOUNT_FACT_SCHEMA = factSchema(UnsignedAmountSchema);
const SLIPPAGE_FACT_SCHEMA = factSchema(z.number().int().safe());
const PROTOCOL_FACT_SCHEMA = factSchema(ProtocolIdSchema);
const MOVEMENT_FACT_SCHEMA = factSchema(MOVEMENT_LIST_SCHEMA);
const TARGET_FACT_SCHEMA = factSchema(TARGET_LIST_SCHEMA);
const OBSERVED_TARGET_FACT_SCHEMA = factSchema(ADDRESS_LIST_SCHEMA);
const APPROVAL_AMOUNT_FACT_SCHEMA = factSchema(APPROVAL_AMOUNT_SCHEMA);
const STATUS_FACT_SCHEMA = factSchema(STATUS_SCHEMA);
const STATE_STATUS_FACT_SCHEMA = factSchema(STATE_STATUS_SCHEMA);
const WARNING_FACT_SCHEMA = factSchema(z.array(JsonValueSchema));
const RECEIPT_STATUS_FACT_SCHEMA = factSchema(RECEIPT_STATUS_SCHEMA);

const OBSERVATIONS_SCHEMA = z.strictObject({
  operation: z.strictObject({
    expected: OPERATION_FACT_SCHEMA,
    observed: OPERATION_FACT_SCHEMA,
  }),
  account: factSchema(EvmAddressSchema),
  inputAsset: ASSET_FACT_SCHEMA,
  outputAsset: ASSET_FACT_SCHEMA,
  amountIn: AMOUNT_FACT_SCHEMA,
  slippageBps: SLIPPAGE_FACT_SCHEMA,
  allowedProtocol: PROTOCOL_FACT_SCHEMA,
  recipient: factSchema(EvmAddressSchema),
  approvalSpender: z.strictObject({
    expected: ADDRESS_FACT_SCHEMA,
    observed: ADDRESS_FACT_SCHEMA,
  }),
  approvalAmount: APPROVAL_AMOUNT_FACT_SCHEMA,
  fundsMovement: z.strictObject({
    permitted: MOVEMENT_FACT_SCHEMA,
    observed: MOVEMENT_FACT_SCHEMA,
  }),
  capabilityIntegrity: STATUS_FACT_SCHEMA,
  transactionSet: z.strictObject({
    expected: TARGET_FACT_SCHEMA,
    observed: OBSERVED_TARGET_FACT_SCHEMA,
  }),
  warnings: WARNING_FACT_SCHEMA,
  receipts: RECEIPT_STATUS_FACT_SCHEMA,
  coverage: STATUS_FACT_SCHEMA,
  ordering: STATUS_FACT_SCHEMA,
  stateContinuity: STATE_STATUS_FACT_SCHEMA,
});

const ALIGNMENT_INPUT_SCHEMA = z.strictObject({
  schemaVersion: z.literal("0.1"),
  intent: IntentSchema,
  quotes: z
    .array(QuoteSchema)
    .min(1)
    .superRefine((quotes, context) => {
      const ids = quotes.map((quote) => quote.quoteId);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          message: "Quote identifiers must be unique",
        });
      }
    }),
  selection: SelectionSchema,
  capability: CapabilitySchema,
  simulation: SimulationSchema,
  observations: OBSERVATIONS_SCHEMA,
});

export type AlignmentFactValueV0_1<T> =
  | Readonly<{
      availability: "AVAILABLE";
      value: T;
      sourceReference: string;
    }>
  | Readonly<{
      availability: "FAILED" | "MISSING" | "UNPROVABLE";
      sourceReference: string;
    }>;

export type AlignmentMovementV0_1 = z.infer<typeof MOVEMENT_SCHEMA>;
export type AlignmentTransactionTargetV0_1 = z.infer<typeof TARGET_SCHEMA>;
export type AlignmentVerificationStatusV0_1 = z.infer<typeof STATUS_SCHEMA>;
export type AlignmentStateStatusV0_1 = z.infer<typeof STATE_STATUS_SCHEMA>;
export type AlignmentObservationV0_1 = z.infer<typeof OBSERVATIONS_SCHEMA>;
export type AlignmentInputV0_1 = z.infer<typeof ALIGNMENT_INPUT_SCHEMA>;

export class AlignmentInputErrorV0_1 extends Error {
  readonly code: "UNSUPPORTED_SCHEMA_VERSION" | "INVALID_ALIGNMENT_INPUT";

  constructor(code: "UNSUPPORTED_SCHEMA_VERSION" | "INVALID_ALIGNMENT_INPUT") {
    super(
      code === "UNSUPPORTED_SCHEMA_VERSION"
        ? "Unsupported Alignment input schema version"
        : "Invalid Alignment input",
    );
    this.name = "AlignmentInputErrorV0_1";
    this.code = code;
  }
}

type FactAssessment<T> =
  | Readonly<{ state: "VALUE"; value: T; reference: string }>
  | Readonly<{ state: "GAP"; reference?: string; invalid: boolean }>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSupportedSchemaVersion(input: unknown): boolean {
  return isObject(input) && input.schemaVersion === "0.1";
}

function parseAlignmentInput(input: unknown): AlignmentInputV0_1 {
  if (!isJsonDescriptorClosedAlignmentInput(input)) {
    throw new AlignmentInputErrorV0_1("INVALID_ALIGNMENT_INPUT");
  }
  if (!hasSupportedSchemaVersion(input)) {
    throw new AlignmentInputErrorV0_1("UNSUPPORTED_SCHEMA_VERSION");
  }
  const parsed = ALIGNMENT_INPUT_SCHEMA.safeParse(input);
  if (!parsed.success) {
    throw new AlignmentInputErrorV0_1("INVALID_ALIGNMENT_INPUT");
  }
  return parsed.data;
}

function movementKey(movement: AlignmentMovementV0_1): string {
  return JSON.stringify([
    movement.asset,
    movement.from,
    movement.to,
    movement.amount,
  ]);
}

function targetKey(target: AlignmentTransactionTargetV0_1): string {
  return target.address;
}

function assessment<T>(
  input: AlignmentInputV0_1,
  checkId: AlignmentCheckIdV0_1,
  role: AlignmentFactRoleV0_1,
  fact: AlignmentFactValueV0_1<T>,
): FactAssessment<T> {
  const validated = validateFactReferenceV0_1(input, checkId, role, fact);
  if (!validated.valid) {
    return { state: "GAP", invalid: true };
  }
  if (fact.availability !== "AVAILABLE") {
    return { state: "GAP", reference: validated.reference, invalid: false };
  }
  return {
    state: "VALUE",
    value: fact.value,
    reference: validated.reference,
  };
}

function statusFor<T>(
  facts: readonly FactAssessment<T>[],
  predicate: (values: readonly T[]) => boolean,
): "PASS" | "FAIL" | "REVIEW" {
  if (facts.some((fact) => fact.state !== "VALUE")) {
    return "REVIEW";
  }
  const values = facts.map(
    (fact) => (fact as Extract<FactAssessment<T>, { state: "VALUE" }>).value,
  );
  return predicate(values) ? "PASS" : "FAIL";
}

const STATIC_REFERENCES: Readonly<
  Partial<Record<AlignmentCheckIdV0_1, readonly string[]>>
> = {
  "account-v0-1": ["/intent/account"],
  "input-asset-v0-1": ["/intent/inputAsset"],
  "output-asset-v0-1": ["/intent/outputAsset"],
  "amount-in-v0-1": ["/intent/inputAmount"],
  "slippage-v0-1": ["/intent/maxSlippageBps"],
  "allowed-protocol-v0-1": ["/intent/allowedProtocols"],
  "approval-amount-v0-1": ["/intent/inputAmount"],
  "unexpected-funds-movement-v0-1": ["/intent"],
};

const FALLBACK_REFERENCES: Readonly<
  Record<AlignmentCheckIdV0_1, readonly string[]>
> = {
  "operation-v0-1": ["/selection", "/capability/availability"],
  "account-v0-1": ["/intent/account", "/capability/availability"],
  "input-asset-v0-1": ["/intent/inputAsset", "/capability/availability"],
  "output-asset-v0-1": ["/intent/outputAsset", "/capability/availability"],
  "amount-in-v0-1": ["/intent/inputAmount", "/capability/availability"],
  "slippage-v0-1": ["/intent/maxSlippageBps", "/capability/availability"],
  "allowed-protocol-v0-1": [
    "/intent/allowedProtocols",
    "/capability/availability",
  ],
  "recipient-v0-1": ["/intent/account", "/capability/availability"],
  "approval-spender-v0-1": ["/capability/availability"],
  "approval-amount-v0-1": ["/intent/inputAmount", "/capability/availability"],
  "unexpected-funds-movement-v0-1": ["/intent", "/simulation/availability"],
  "capability-integrity-v0-1": ["/capability/availability"],
  "transaction-set-v0-1": [
    "/capability/availability",
    "/simulation/availability",
  ],
  "warning-presence-v0-1": ["/simulation/availability"],
  "receipt-availability-v0-1": ["/simulation/availability"],
  "coverage-v0-1": ["/simulation/availability"],
  "ordering-v0-1": ["/simulation/availability"],
  "state-continuity-v0-1": ["/simulation/availability"],
};

function referenceList(
  input: AlignmentInputV0_1,
  checkId: AlignmentCheckIdV0_1,
  facts: readonly FactAssessment<unknown>[],
): string[] {
  const staticReferences =
    checkId === "recipient-v0-1"
      ? [
          input.intent.recipient === undefined
            ? "/intent/account"
            : "/intent/recipient",
        ]
      : (STATIC_REFERENCES[checkId] ?? []);
  const references = new Set(staticReferences);
  let needsFallback = false;
  for (const fact of facts) {
    if (fact.reference !== undefined) {
      references.add(fact.reference);
    }
    if (fact.state === "GAP" && fact.invalid) {
      needsFallback = true;
    }
  }
  if (references.size === 0 || needsFallback) {
    for (const reference of FALLBACK_REFERENCES[checkId]) {
      references.add(reference);
    }
  }
  const sorted = [...references].sort(compareUtf8V0_1);
  /* v8 ignore next -- parsed facts and fixed policy paths make this defensive branch unreachable */
  if (!outputReferencesAreValidV0_1(input, checkId, sorted)) {
    return [...FALLBACK_REFERENCES[checkId]].sort(compareUtf8V0_1);
  }
  return sorted;
}

function asUnknownFacts<T>(
  facts: readonly FactAssessment<T>[],
): readonly FactAssessment<unknown>[] {
  return facts as readonly FactAssessment<unknown>[];
}

function assetEqual(left: Asset, right: Asset): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === "NATIVE") {
    return true;
  }
  return right.kind === "ERC20" && left.address === right.address;
}

function addressSet(values: readonly EvmAddress[]): Set<string> {
  return new Set(values);
}

function evaluateCheck(
  input: AlignmentInputV0_1,
  checkId: AlignmentCheckIdV0_1,
  status: "PASS" | "FAIL" | "REVIEW",
  facts: readonly FactAssessment<unknown>[],
): Alignment["checks"][number] {
  const references = referenceList(input, checkId, facts);
  return {
    checkId: checkId as Alignment["checks"][number]["checkId"],
    critical: true,
    status,
    sourceReferences:
      references as Alignment["checks"][number]["sourceReferences"],
  };
}

function evaluateAlignment(input: AlignmentInputV0_1): Alignment {
  const observations = input.observations;
  const checks: Alignment["checks"] = [];

  const operation = [
    assessment(
      input,
      "operation-v0-1",
      "expected",
      observations.operation.expected,
    ),
    assessment(
      input,
      "operation-v0-1",
      "observed",
      observations.operation.observed,
    ),
  ];
  checks.push(
    evaluateCheck(
      input,
      "operation-v0-1",
      statusFor(operation, ([expected, observed]) => expected === observed),
      asUnknownFacts(operation),
    ),
  );

  const account = assessment(
    input,
    "account-v0-1",
    "observed",
    observations.account,
  );
  checks.push(
    evaluateCheck(
      input,
      "account-v0-1",
      statusFor([account], ([observed]) => observed === input.intent.account),
      asUnknownFacts([account]),
    ),
  );

  const inputAsset = assessment(
    input,
    "input-asset-v0-1",
    "observed",
    observations.inputAsset,
  );
  checks.push(
    evaluateCheck(
      input,
      "input-asset-v0-1",
      statusFor([inputAsset], ([observed]) =>
        assetEqual(input.intent.inputAsset, observed),
      ),
      asUnknownFacts([inputAsset]),
    ),
  );

  const outputAsset = assessment(
    input,
    "output-asset-v0-1",
    "observed",
    observations.outputAsset,
  );
  checks.push(
    evaluateCheck(
      input,
      "output-asset-v0-1",
      statusFor([outputAsset], ([observed]) =>
        assetEqual(input.intent.outputAsset, observed),
      ),
      asUnknownFacts([outputAsset]),
    ),
  );

  const amountIn = assessment(
    input,
    "amount-in-v0-1",
    "observed",
    observations.amountIn,
  );
  checks.push(
    evaluateCheck(
      input,
      "amount-in-v0-1",
      statusFor(
        [amountIn],
        ([observed]) => String(observed) === String(input.intent.inputAmount),
      ),
      asUnknownFacts([amountIn]),
    ),
  );

  const slippage = assessment(
    input,
    "slippage-v0-1",
    "observed",
    observations.slippageBps,
  );
  checks.push(
    evaluateCheck(
      input,
      "slippage-v0-1",
      statusFor(
        [slippage],
        ([observed]) =>
          observed >= 0 && observed <= input.intent.maxSlippageBps,
      ),
      asUnknownFacts([slippage]),
    ),
  );

  const protocol = assessment(
    input,
    "allowed-protocol-v0-1",
    "observed",
    observations.allowedProtocol,
  );
  checks.push(
    evaluateCheck(
      input,
      "allowed-protocol-v0-1",
      statusFor([protocol], ([observed]) =>
        input.intent.allowedProtocols.includes(observed),
      ),
      asUnknownFacts([protocol]),
    ),
  );

  const recipient = assessment(
    input,
    "recipient-v0-1",
    "observed",
    observations.recipient,
  );
  const expectedRecipient = input.intent.recipient ?? input.intent.account;
  checks.push(
    evaluateCheck(
      input,
      "recipient-v0-1",
      statusFor([recipient], ([observed]) => observed === expectedRecipient),
      asUnknownFacts([recipient]),
    ),
  );

  const approvalSpenderExpected = assessment(
    input,
    "approval-spender-v0-1",
    "expected",
    observations.approvalSpender.expected,
  );
  const approvalSpenderObserved = assessment(
    input,
    "approval-spender-v0-1",
    "observed",
    observations.approvalSpender.observed,
  );
  const approvalSpender = [approvalSpenderExpected, approvalSpenderObserved];
  checks.push(
    evaluateCheck(
      input,
      "approval-spender-v0-1",
      statusFor(
        approvalSpender,
        ([expected, observed]) => expected === observed,
      ),
      asUnknownFacts(approvalSpender),
    ),
  );

  const approvalAmount = assessment(
    input,
    "approval-amount-v0-1",
    "observed",
    observations.approvalAmount,
  );
  let approvalAmountStatus = "REVIEW" as "PASS" | "FAIL" | "REVIEW";
  if (approvalAmount.state === "VALUE") {
    const { amount, unbounded } = approvalAmount.value;
    const spender =
      approvalSpenderObserved.state === "VALUE"
        ? approvalSpenderObserved.value
        : undefined;
    if (
      unbounded ||
      (amount !== null && BigInt(amount) > BigInt(input.intent.inputAmount))
    ) {
      approvalAmountStatus = "FAIL";
    } else if (amount === null && !unbounded && spender === null) {
      approvalAmountStatus = "PASS";
    } else if (
      amount !== null &&
      BigInt(amount) > 0n &&
      !unbounded &&
      spender !== null &&
      spender !== undefined &&
      BigInt(amount) <= BigInt(input.intent.inputAmount)
    ) {
      approvalAmountStatus = "PASS";
    } else if (amount === null || spender === undefined) {
      approvalAmountStatus = "REVIEW";
    } else {
      approvalAmountStatus = "FAIL";
    }
  }
  checks.push(
    evaluateCheck(input, "approval-amount-v0-1", approvalAmountStatus, [
      ...asUnknownFacts([approvalAmount]),
      ...asUnknownFacts([approvalSpenderObserved]),
    ]),
  );

  const permittedMovement = assessment(
    input,
    "unexpected-funds-movement-v0-1",
    "permitted",
    observations.fundsMovement.permitted,
  );
  const observedMovement = assessment(
    input,
    "unexpected-funds-movement-v0-1",
    "observed",
    observations.fundsMovement.observed,
  );
  const movementFacts = [permittedMovement, observedMovement];
  const movementStatus = statusFor(movementFacts, ([permitted, observed]) => {
    const permittedKeys = new Set(permitted.map(movementKey));
    return observed.every((movement) =>
      permittedKeys.has(movementKey(movement)),
    );
  });
  checks.push(
    evaluateCheck(
      input,
      "unexpected-funds-movement-v0-1",
      movementStatus,
      asUnknownFacts(movementFacts),
    ),
  );

  const integrity = assessment(
    input,
    "capability-integrity-v0-1",
    "observed",
    observations.capabilityIntegrity,
  );
  checks.push(
    evaluateCheck(
      input,
      "capability-integrity-v0-1",
      statusFor([integrity], ([value]) => value === "PROVEN"),
      asUnknownFacts([integrity]),
    ),
  );

  const expectedTargets = assessment(
    input,
    "transaction-set-v0-1",
    "expected",
    observations.transactionSet.expected,
  );
  const observedTargets = assessment(
    input,
    "transaction-set-v0-1",
    "observed",
    observations.transactionSet.observed,
  );
  const targetFacts: readonly FactAssessment<unknown>[] = [
    ...asUnknownFacts([expectedTargets]),
    ...asUnknownFacts([observedTargets]),
  ];
  let targetStatus: "PASS" | "FAIL" | "REVIEW" = "REVIEW";
  if (expectedTargets.state === "VALUE" && observedTargets.state === "VALUE") {
    const expectedSet = new Set(expectedTargets.value.map(targetKey));
    const observedSet = addressSet(observedTargets.value);
    targetStatus =
      expectedSet.size === observedSet.size &&
      [...expectedSet].every((address) => observedSet.has(address))
        ? "PASS"
        : "FAIL";
  }
  checks.push(
    evaluateCheck(input, "transaction-set-v0-1", targetStatus, targetFacts),
  );

  const warnings = assessment(
    input,
    "warning-presence-v0-1",
    "observed",
    observations.warnings,
  );
  let warningStatus: "PASS" | "FAIL" | "REVIEW" = "REVIEW";
  if (
    warnings.state === "VALUE" &&
    input.simulation.availability === "AVAILABLE" &&
    input.simulation.warnings.availability === "AVAILABLE"
  ) {
    warningStatus =
      warnings.value.length === input.simulation.warnings.items.length
        ? warnings.value.length === 0
          ? "PASS"
          : "FAIL"
        : "REVIEW";
  }
  checks.push(
    evaluateCheck(
      input,
      "warning-presence-v0-1",
      warningStatus,
      asUnknownFacts([warnings]),
    ),
  );

  const receipts = assessment(
    input,
    "receipt-availability-v0-1",
    "observed",
    observations.receipts,
  );
  let receiptStatus: "PASS" | "FAIL" | "REVIEW" = "REVIEW";
  if (
    receipts.state === "VALUE" &&
    input.simulation.availability === "AVAILABLE" &&
    input.simulation.receipts.availability === "AVAILABLE"
  ) {
    const publicReceipts = input.simulation.receipts.items;
    if (receipts.value.observedCount !== publicReceipts.length) {
      receiptStatus = "REVIEW";
    } else if (receipts.value.observedCount !== receipts.value.expectedCount) {
      receiptStatus = "FAIL";
    } else if (
      receipts.value.allSuccessful &&
      publicReceipts.length > 0 &&
      publicReceipts.every((item) => item.status === "SUCCESS")
    ) {
      receiptStatus = "PASS";
    } else {
      receiptStatus = "FAIL";
    }
  }
  checks.push(
    evaluateCheck(
      input,
      "receipt-availability-v0-1",
      receiptStatus,
      asUnknownFacts([receipts]),
    ),
  );

  const coverage = assessment(
    input,
    "coverage-v0-1",
    "observed",
    observations.coverage,
  );
  checks.push(
    evaluateCheck(
      input,
      "coverage-v0-1",
      verificationStatus(input.simulation, "coverage", coverage),
      asUnknownFacts([coverage]),
    ),
  );

  const ordering = assessment(
    input,
    "ordering-v0-1",
    "observed",
    observations.ordering,
  );
  checks.push(
    evaluateCheck(
      input,
      "ordering-v0-1",
      verificationStatus(input.simulation, "ordering", ordering),
      asUnknownFacts([ordering]),
    ),
  );

  const continuity = assessment(
    input,
    "state-continuity-v0-1",
    "observed",
    observations.stateContinuity,
  );
  checks.push(
    evaluateCheck(
      input,
      "state-continuity-v0-1",
      stateContinuityStatus(input.simulation, continuity),
      asUnknownFacts([continuity]),
    ),
  );

  return AlignmentSchema.parse({ checks });
}

function verificationStatus(
  simulation: AlignmentInputV0_1["simulation"],
  component: "coverage" | "ordering",
  fact: FactAssessment<AlignmentVerificationStatusV0_1>,
): "PASS" | "FAIL" | "REVIEW" {
  if (fact.state !== "VALUE" || simulation.availability !== "AVAILABLE") {
    return "REVIEW";
  }
  let publicValue: boolean;
  if (component === "coverage") {
    if (simulation.coverage.availability !== "AVAILABLE") {
      return "REVIEW";
    }
    publicValue = simulation.coverage.complete;
  } else {
    if (simulation.ordering.availability !== "AVAILABLE") {
      return "REVIEW";
    }
    publicValue = simulation.ordering.valid;
  }
  if (fact.value === "PROVEN" && publicValue === true) {
    return "PASS";
  }
  if (fact.value === "FAILED" && publicValue === false) {
    return "FAIL";
  }
  return "REVIEW";
}

function stateContinuityStatus(
  simulation: AlignmentInputV0_1["simulation"],
  fact: FactAssessment<"PROVEN" | "FAILED" | "NOT_APPLICABLE">,
): "PASS" | "FAIL" | "REVIEW" {
  if (
    fact.state !== "VALUE" ||
    simulation.availability !== "AVAILABLE" ||
    simulation.stateContinuity.availability !== "AVAILABLE"
  ) {
    return "REVIEW";
  }
  if (
    (fact.value === "PROVEN" || fact.value === "NOT_APPLICABLE") &&
    simulation.stateContinuity.continuous
  ) {
    return "PASS";
  }
  if (fact.value === "FAILED" && !simulation.stateContinuity.continuous) {
    return "FAIL";
  }
  return "REVIEW";
}

export function evaluateAlignmentV0_1(input: unknown): Alignment {
  return evaluateAlignment(parseAlignmentInput(input));
}

export type { Alignment, AlignmentCheckIdV0_1, Asset, EvmAddress };
