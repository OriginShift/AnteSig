import { z } from "zod";
import { JsonPointerSyntaxListSchema } from "./references.js";
import {
  EvmAddressSchema,
  PositiveAmountSchema,
  ProtocolIdSchema,
  RawArtifactSchema,
  RecordIdSchema,
  StableCodeSchema,
} from "./scalars.js";

export const AvailabilitySchema = z.enum([
  "AVAILABLE",
  "FAILED",
  "MISSING",
  "UNPROVABLE",
]);

export const StructuredReasonSchema = z.strictObject({
  code: StableCodeSchema,
  sourceReferences: JsonPointerSyntaxListSchema,
});

export const StructuredFailureSchema = StructuredReasonSchema;

export const UnavailableEvidenceSchema = z.discriminatedUnion("availability", [
  z.strictObject({
    availability: z.literal("FAILED"),
    failure: StructuredFailureSchema,
  }),
  z.strictObject({
    availability: z.literal("MISSING"),
    failure: StructuredFailureSchema,
  }),
  z.strictObject({
    availability: z.literal("UNPROVABLE"),
    failure: StructuredFailureSchema,
  }),
]);

export const AssetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("NATIVE") }),
  z.strictObject({ kind: z.literal("ERC20"), address: EvmAddressSchema }),
]);

const QuoteBaseShape = {
  quoteId: RecordIdSchema,
  protocolId: ProtocolIdSchema,
  inputAsset: AssetSchema,
  outputAsset: AssetSchema,
  inputAmount: PositiveAmountSchema,
};

export const QuoteSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...QuoteBaseShape,
    status: z.literal("SUCCESS"),
    outputAmount: PositiveAmountSchema,
    raw: RawArtifactSchema,
  }),
  z.strictObject({
    ...QuoteBaseShape,
    status: z.literal("FAILED"),
    failure: StructuredFailureSchema,
  }),
]);

export const SelectionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("SELECTED"),
    protocolId: ProtocolIdSchema,
    quoteId: RecordIdSchema,
    reason: StructuredReasonSchema,
  }),
  z.strictObject({
    status: z.literal("NOT_SELECTED"),
    reason: StructuredReasonSchema,
  }),
]);

export const CapabilitySchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    raw: RawArtifactSchema,
  }),
  UnavailableEvidenceSchema,
]);

export const ReceiptRecordSchema = z.strictObject({
  status: z.enum(["SUCCESS", "FAILED"]),
  raw: RawArtifactSchema,
});

export const OutcomeRecordSchema = z.strictObject({
  status: z.enum(["SUCCESS", "FAILED"]),
  raw: RawArtifactSchema,
});

export const ReceiptsEvidenceSchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    items: z.array(ReceiptRecordSchema),
  }),
  UnavailableEvidenceSchema,
]);

export const OutcomesEvidenceSchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    items: z.array(OutcomeRecordSchema),
  }),
  UnavailableEvidenceSchema,
]);

export const WarningsEvidenceSchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    items: z.array(RawArtifactSchema),
  }),
  UnavailableEvidenceSchema,
]);

export const CoverageEvidenceSchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    complete: z.boolean(),
    raw: RawArtifactSchema,
  }),
  UnavailableEvidenceSchema,
]);

export const OrderingEvidenceSchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    valid: z.boolean(),
    raw: RawArtifactSchema,
  }),
  UnavailableEvidenceSchema,
]);

export const StateContinuityEvidenceSchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    continuous: z.boolean(),
    raw: RawArtifactSchema,
  }),
  UnavailableEvidenceSchema,
]);

export const SimulationSchema = z.union([
  z.strictObject({
    availability: z.literal("AVAILABLE"),
    executionStatus: z.enum(["SUCCESS", "FAILED", "INTERRUPTED"]),
    raw: RawArtifactSchema,
    receipts: ReceiptsEvidenceSchema,
    outcomes: OutcomesEvidenceSchema,
    warnings: WarningsEvidenceSchema,
    coverage: CoverageEvidenceSchema,
    ordering: OrderingEvidenceSchema,
    stateContinuity: StateContinuityEvidenceSchema,
  }),
  UnavailableEvidenceSchema,
]);

export const AlignmentCheckSchema = z.strictObject({
  checkId: RecordIdSchema,
  critical: z.boolean(),
  status: z.enum(["PASS", "FAIL", "REVIEW"]),
  sourceReferences: JsonPointerSyntaxListSchema,
});

export const DecisionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("MANUAL_REVIEW") }),
  z.strictObject({
    status: z.literal("STOP"),
    reasons: z.array(StructuredReasonSchema).min(1),
  }),
]);

export const LimitationSchema = z.strictObject({
  code: StableCodeSchema,
  description: z.string().min(1),
  sourceReferences: JsonPointerSyntaxListSchema,
});

export type Availability = z.infer<typeof AvailabilitySchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type Selection = z.infer<typeof SelectionSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
export type Simulation = z.infer<typeof SimulationSchema>;
export type AlignmentCheck = z.infer<typeof AlignmentCheckSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Limitation = z.infer<typeof LimitationSchema>;
