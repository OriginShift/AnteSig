import { SimulationSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import {
  evidenceTimelineModel,
  serializeRawArtifact,
} from "../src/client/evidence-model";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const ROUTER = "0x3333333333333333333333333333333333333333";

const WARNING = {
  code: "TRACE_FAILED",
  message: "Exact warning message from source",
  detail: "unknown warning detail retained",
};

const SIMULATION = SimulationSchema.parse({
  availability: "AVAILABLE",
  executionStatus: "SUCCESS",
  raw: {
    mossOriginal: {
      simulation: {
        results: [
          { protocol: "token-protocol", method: "approve" },
          { protocol: "swap-protocol", method: "swap" },
        ],
        unknownFutureField: { retained: true },
      },
      transactions: [
        {
          transactionIndex: 1,
          value: { from: ACCOUNT, to: ROUTER, value: "0x1", data: "0xbbbb" },
        },
        {
          transactionIndex: 0,
          value: { from: ACCOUNT, to: TOKEN, value: "0x0", data: "0xaaaa" },
        },
      ],
      receipts: [
        {
          transactionIndex: 0,
          value: { kind: "receipt", outcome: { status: "SUCCESS" } },
        },
        {
          transactionIndex: 1,
          value: { kind: "receipt", outcome: { status: "SUCCESS" } },
        },
      ],
      outcomes: [
        { transactionIndex: 0, value: { status: "SUCCESS", amountOut: "0" } },
        { transactionIndex: 1, value: { status: "SUCCESS", amountOut: "42" } },
      ],
      warnings: [
        {
          transactionIndex: 1,
          warningIndex: 0,
          code: WARNING.code,
          message: WARNING.message,
          value: WARNING,
        },
      ],
      gas: [
        { transactionIndex: 0, value: "21000" },
        { transactionIndex: 1, value: "900719925474099312345" },
      ],
    },
    unknownRawEnvelope: ["preserved", { version: 2 }],
  },
  receipts: {
    availability: "AVAILABLE",
    items: [
      { status: "SUCCESS", raw: { publicReceipt: 0 } },
      { status: "SUCCESS", raw: { publicReceipt: 1 } },
    ],
  },
  outcomes: {
    availability: "AVAILABLE",
    items: [
      { status: "SUCCESS", raw: { publicOutcome: 0 } },
      { status: "SUCCESS", raw: { publicOutcome: 1 } },
    ],
  },
  warnings: { availability: "AVAILABLE", items: [WARNING] },
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
    raw: { status: "PROVEN" },
  },
});

describe("Simulation evidence timeline model", () => {
  it("groups Receipt, Outcome, Warning and gas by stable transaction index", () => {
    const model = evidenceTimelineModel(SIMULATION);
    expect(model.transactions.map((entry) => entry.transactionIndex)).toEqual([
      0, 1,
    ]);
    expect(model.transactions[0]).toMatchObject({
      protocol: "token-protocol",
      method: "approve",
      from: ACCOUNT,
      to: TOKEN,
      value: "0x0",
      receipts: [{ status: "SUCCESS" }],
      outcomes: [{ status: "SUCCESS" }],
      gas: [{ value: "21000" }],
    });
    expect(model.transactions[1]).toMatchObject({
      protocol: "swap-protocol",
      method: "swap",
      from: ACCOUNT,
      to: ROUTER,
      value: "0x1",
      gas: [{ value: "900719925474099312345" }],
    });
  });

  it("retains exact Warning code/message and its raw unknown fields", () => {
    const warning =
      evidenceTimelineModel(SIMULATION).transactions[1]?.warnings[0];
    expect(warning).toEqual({
      code: WARNING.code,
      message: WARNING.message,
      raw: WARNING,
      sourceReference: "/simulation/raw/mossOriginal/warnings/0",
    });
  });

  it("shows coverage, ordering and state continuity with source references", () => {
    expect(evidenceTimelineModel(SIMULATION).statuses).toEqual([
      {
        label: "Coverage",
        availability: "AVAILABLE",
        value: "TRUE",
        sourceReference: "/simulation/coverage",
      },
      {
        label: "Ordering",
        availability: "AVAILABLE",
        value: "TRUE",
        sourceReference: "/simulation/ordering",
      },
      {
        label: "State continuity",
        availability: "AVAILABLE",
        value: "TRUE",
        sourceReference: "/simulation/stateContinuity",
      },
    ]);
  });

  it("keeps unknown raw fields in complete JSON output", () => {
    const serialized = serializeRawArtifact(SIMULATION);
    expect(JSON.parse(serialized)).toEqual(SIMULATION);
    expect(serialized).toContain("unknownFutureField");
    expect(serialized).toContain("unknownRawEnvelope");
    expect(serialized).toContain("unknown warning detail retained");
  });
});
