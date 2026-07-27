import { describe, expect, it } from "vitest";
import {
  CapabilitySchema,
  CoverageEvidenceSchema,
  OrderingEvidenceSchema,
  OutcomeRecordSchema,
  QuoteSchema,
  RawArtifactSchema,
  ReceiptRecordSchema,
  SimulationSchema,
  StateContinuityEvidenceSchema,
  WarningsEvidenceSchema,
} from "../src/index.js";
import { syntheticAddress } from "./synthetic.js";

const OMIT_RAW = Symbol("omit-raw");
type RawInput = unknown | typeof OMIT_RAW;

interface RawLocation {
  name: string;
  build: (raw: RawInput) => unknown;
  parse: (input: unknown) => { success: boolean };
}

function rawField(raw: RawInput): Record<string, unknown> {
  return raw === OMIT_RAW ? {} : { raw };
}

function availableSimulation(raw: RawInput): unknown {
  return {
    availability: "AVAILABLE",
    executionStatus: "SUCCESS",
    ...rawField(raw),
    receipts: {
      availability: "AVAILABLE",
      items: [{ status: "SUCCESS", raw: { source: "synthetic" } }],
    },
    outcomes: {
      availability: "AVAILABLE",
      items: [{ status: "SUCCESS", raw: { source: "synthetic" } }],
    },
    warnings: { availability: "AVAILABLE", items: [] },
    coverage: {
      availability: "AVAILABLE",
      complete: true,
      raw: { source: "synthetic" },
    },
    ordering: {
      availability: "AVAILABLE",
      valid: true,
      raw: { source: "synthetic" },
    },
    stateContinuity: {
      availability: "AVAILABLE",
      continuous: true,
      raw: { source: "synthetic" },
    },
  };
}

const RAW_LOCATIONS: RawLocation[] = [
  {
    name: "successful Quote raw",
    build: (raw) => ({
      quoteId: "synthetic-quote",
      protocolId: "synthetic-protocol",
      inputAsset: { kind: "NATIVE" },
      outputAsset: {
        kind: "ERC20",
        address: syntheticAddress("raw-location-output"),
      },
      inputAmount: "1",
      status: "SUCCESS",
      outputAmount: "1",
      ...rawField(raw),
    }),
    parse: (input) => QuoteSchema.safeParse(input),
  },
  {
    name: "Capability raw",
    build: (raw) => ({ availability: "AVAILABLE", ...rawField(raw) }),
    parse: (input) => CapabilitySchema.safeParse(input),
  },
  {
    name: "Simulation raw",
    build: availableSimulation,
    parse: (input) => SimulationSchema.safeParse(input),
  },
  {
    name: "Receipt raw",
    build: (raw) => ({ status: "SUCCESS", ...rawField(raw) }),
    parse: (input) => ReceiptRecordSchema.safeParse(input),
  },
  {
    name: "Outcome raw",
    build: (raw) => ({ status: "SUCCESS", ...rawField(raw) }),
    parse: (input) => OutcomeRecordSchema.safeParse(input),
  },
  {
    name: "Warning item",
    build: (raw) => ({
      availability: "AVAILABLE",
      items: [raw === OMIT_RAW ? undefined : raw],
    }),
    parse: (input) => WarningsEvidenceSchema.safeParse(input),
  },
  {
    name: "coverage raw",
    build: (raw) => ({
      availability: "AVAILABLE",
      complete: true,
      ...rawField(raw),
    }),
    parse: (input) => CoverageEvidenceSchema.safeParse(input),
  },
  {
    name: "ordering raw",
    build: (raw) => ({
      availability: "AVAILABLE",
      valid: true,
      ...rawField(raw),
    }),
    parse: (input) => OrderingEvidenceSchema.safeParse(input),
  },
  {
    name: "state-continuity raw",
    build: (raw) => ({
      availability: "AVAILABLE",
      continuous: true,
      ...rawField(raw),
    }),
    parse: (input) => StateContinuityEvidenceSchema.safeParse(input),
  },
];

const VALID_RAW_ARTIFACTS = [
  ["object with nested null", { source: "synthetic", nested: null }],
  ["array with nested null", ["synthetic", null]],
  ["string", "synthetic"],
  ["number", 42],
  ["true boolean", true],
  ["false boolean", false],
] as const;

describe("RawArtifactSchema", () => {
  it.each(VALID_RAW_ARTIFACTS)("preserves a non-null %s", (_name, raw) => {
    expect(RawArtifactSchema.parse(raw)).toEqual(raw);
  });

  it.each([null, undefined])("rejects absent artifact value %s", (raw) => {
    expect(RawArtifactSchema.safeParse(raw).success).toBe(false);
  });
});

describe.each(RAW_LOCATIONS)("$name", ({ build, parse }) => {
  it.each(VALID_RAW_ARTIFACTS)("accepts a non-null %s", (_name, raw) => {
    expect(parse(build(raw)).success).toBe(true);
  });

  it("rejects top-level null", () => {
    expect(parse(build(null)).success).toBe(false);
  });

  it("rejects missing or undefined raw", () => {
    expect(parse(build(OMIT_RAW)).success).toBe(false);
  });
});
