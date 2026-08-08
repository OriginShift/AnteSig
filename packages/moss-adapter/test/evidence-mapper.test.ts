import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  type MapMossEvidenceInputV0_1,
  mapMossEvidenceV0_1,
} from "../src/evidence-mapper.js";
import {
  MOSS_BUILD_INFO,
  MossAdapterError,
  type MossBuildInfo,
  type RawCapability,
  type SimulationRpcObservationV0_1,
} from "../src/index.js";
import { retainSimulationCapabilityV0_1 } from "../src/simulation.js";
import type { JsonValue } from "../src/types.js";
import {
  approvalSwapCapability,
  approvalSwapSimulation,
  provenObservation,
  SYNTHETIC_BLOCK_HASH,
  singleSuccessSimulation,
  singleTransactionCapability,
} from "./fixtures/simulation.js";

function mappingInput(
  capability: RawCapability = singleTransactionCapability(),
  simulation: unknown = singleSuccessSimulation(),
  observation: SimulationRpcObservationV0_1 = provenObservation(),
): MapMossEvidenceInputV0_1 {
  const retained = retainSimulationCapabilityV0_1(capability);
  if (retained === undefined) {
    throw new Error("synthetic Capability must be retainable");
  }
  const originalSource = Object.freeze({
    layer: "MOSS_ORIGINAL" as const,
    provenance: "SYNTHETIC_FAKE" as const,
    buildInfo: MOSS_BUILD_INFO,
  });
  return {
    protocolId: "synthetic-protocol",
    method: "swap",
    buildInfo: MOSS_BUILD_INFO,
    originalSource,
    derivedSource: Object.freeze({
      layer: "MINI_DEMO_DERIVED" as const,
      ruleVersion: "moss-adapter-boundary-v0.1" as const,
    }),
    capability,
    retainedCapability: retained.snapshot,
    simulation,
    observation,
    preSimulationDigest: retained.digest,
    postSimulationDigest: retained.digest,
  };
}

function firstResult(simulation: ReturnType<typeof singleSuccessSimulation>) {
  const result = simulation.results[0];
  if (result === undefined) {
    throw new Error("synthetic result is required");
  }
  return result;
}

describe("lossless Moss evidence mapping", () => {
  it("maps a single success with exact provenance, block, and one-step semantics", () => {
    const capability = singleTransactionCapability();
    const simulation = singleSuccessSimulation();
    const evidence = mapMossEvidenceV0_1(mappingInput(capability, simulation));

    expect(evidence.mossOriginal.capability).toBe(capability);
    expect(evidence.mossOriginal.simulation).toBe(simulation);
    expect(evidence.mossOriginal.transactions).toHaveLength(1);
    expect(evidence.mossOriginal.changes).toHaveLength(1);
    expect(evidence.mossOriginal.receipts).toHaveLength(1);
    expect(evidence.mossOriginal.outcomes).toHaveLength(1);
    expect(evidence.mossOriginal.warnings).toEqual([]);
    expect(evidence.mossOriginal.gas).toEqual([
      { transactionIndex: 0, value: "900719925474099312345" },
    ]);
    expect(evidence.miniDemoDerived).toMatchObject({
      derivedBy: "@moss-mini-demo/moss-adapter",
      ruleVersion: "0.1",
      mossCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
      simulationBlock: {
        status: "PROVEN",
        blockHash: SYNTHETIC_BLOCK_HASH,
      },
      capabilityIntegrity: "PROVEN",
      receiptCoverage: "PROVEN",
      ordering: "PROVEN",
      stateContinuity: "NOT_APPLICABLE",
    });
    expect(evidence.mossOriginal.source.layer).toBe("MOSS_ORIGINAL");
    expect(evidence.miniDemoDerived.source.layer).toBe("MINI_DEMO_DERIVED");
  });

  it("preserves Approval + Swap transaction and Change order with stable indices", () => {
    const evidence = mapMossEvidenceV0_1(
      mappingInput(approvalSwapCapability(), approvalSwapSimulation()),
    );

    expect(
      evidence.mossOriginal.transactions.map(
        ({ transactionIndex }) => transactionIndex,
      ),
    ).toEqual([0, 1]);
    expect(
      evidence.mossOriginal.changes.map(({ transactionIndex, changeIndex }) => [
        transactionIndex,
        changeIndex,
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(
      evidence.mossOriginal.receipts.map(
        ({ value }) => (value as { text: string }).text,
      ),
    ).toEqual(["approve synthetic receipt", "swap synthetic receipt"]);
    expect(evidence.mossOriginal.outcomes.map(({ value }) => value)).toEqual([
      { amountOut: "0", status: "SUCCESS" },
      { amountOut: "42", status: "SUCCESS" },
    ]);
    expect(evidence.miniDemoDerived).toMatchObject({
      receiptCoverage: "PROVEN",
      ordering: "PROVEN",
      stateContinuity: "PROVEN",
    });
  });

  it("retains Receipt leaf text and shared Change identity", () => {
    const simulation = singleSuccessSimulation();
    const result = firstResult(simulation);
    const receiptLeaf = result.receipt.changes[0];
    const change = result.changes[0];
    expect(receiptLeaf?.change).toBe(change);

    const evidence = mapMossEvidenceV0_1(mappingInput(undefined, simulation));
    expect(evidence.mossOriginal.changes[0]?.value).toBe(change);
    const retainedReceipt = evidence.mossOriginal.receipts[0];
    if (retainedReceipt === undefined) {
      throw new Error("synthetic retained Receipt is required");
    }
    expect(
      (retainedReceipt.value as { changes: JsonValue[] }).changes[0],
    ).toMatchObject({ text: "swap synthetic change" });

    const retained = evidence.mossOriginal.retained.simulation as {
      results: {
        changes: unknown[];
        receipt: { changes: { change: unknown }[] };
      }[];
    };
    expect(retained.results[0]?.receipt.changes[0]?.change).toBe(
      retained.results[0]?.changes[0],
    );
  });

  it("retains unknown raw fields and freezes only independent snapshots", () => {
    const capability = singleTransactionCapability();
    const simulation = singleSuccessSimulation();
    const before = structuredClone({ capability, simulation });
    const evidence = mapMossEvidenceV0_1(mappingInput(capability, simulation));

    expect({ capability, simulation }).toEqual(before);
    expect(Object.isFrozen(capability)).toBe(false);
    expect(Object.isFrozen(simulation)).toBe(false);
    expect(evidence.mossOriginal.retained.capability).not.toBe(capability);
    expect(evidence.mossOriginal.retained.simulation).not.toBe(simulation);
    expect(Object.isFrozen(evidence.mossOriginal.retained.capability)).toBe(
      true,
    );
    expect(Object.isFrozen(evidence.mossOriginal.retained.simulation)).toBe(
      true,
    );
    expect(evidence.mossOriginal.retained.simulation).toMatchObject({
      unknownFutureField: {
        retained: true,
        nested: ["synthetic", { version: 2 }],
      },
    });
  });

  it("does not prove a block when results exist without an observed trace", () => {
    const observation = {
      ...provenObservation(),
      requestBlocks: Object.freeze([]),
    };
    const evidence = mapMossEvidenceV0_1(
      mappingInput(undefined, undefined, observation),
    );
    expect(evidence.miniDemoDerived.simulationBlock).toMatchObject({
      status: "UNPROVABLE",
      reasons: expect.arrayContaining(["BLOCK_PARAMETER_UNOBSERVABLE"]),
    });
  });

  it("retains exact Warning code/message and explicit rollback material", () => {
    const simulation = singleSuccessSimulation();
    const result = firstResult(simulation) as Record<string, unknown>;
    delete result.receipt;
    delete result.changes;
    result.reverted = true;
    result.revertReason = "synthetic rollback";
    result.warnings = [
      {
        code: "REVERTED",
        message: "transaction reverted: synthetic rollback",
        unknownWarningField: "retained",
      },
    ];
    result.gas = null;
    (simulation as Record<string, unknown>).halted = {
      transactionIndex: 0,
      reason: "synthetic rollback",
    };

    const evidence = mapMossEvidenceV0_1(mappingInput(undefined, simulation));
    expect(evidence.mossOriginal.warnings).toEqual([
      expect.objectContaining({
        transactionIndex: 0,
        warningIndex: 0,
        code: "REVERTED",
        message: "transaction reverted: synthetic rollback",
        value: expect.objectContaining({ unknownWarningField: "retained" }),
      }),
    ]);
    expect(evidence.miniDemoDerived).toMatchObject({
      receiptCoverage: "FAILED",
      ordering: "UNPROVABLE",
      stateContinuity: "NOT_APPLICABLE",
    });
  });

  it("marks a missing Receipt and an identity coverage mismatch explicitly", () => {
    const missing = singleSuccessSimulation();
    delete (firstResult(missing) as Record<string, unknown>).receipt;
    expect(
      mapMossEvidenceV0_1(mappingInput(undefined, missing)).miniDemoDerived,
    ).toMatchObject({
      receiptCoverage: "FAILED",
      ordering: "UNPROVABLE",
    });

    const mismatched = singleSuccessSimulation();
    const result = firstResult(mismatched);
    result.receipt.changes[0] = {
      ...result.receipt.changes[0],
      change: { ...result.changes[0] },
    };
    expect(
      mapMossEvidenceV0_1(mappingInput(undefined, mismatched)).miniDemoDerived,
    ).toMatchObject({
      receiptCoverage: "FAILED",
      ordering: "FAILED",
    });
  });

  it("distinguishes explicit ordering and state-chain interruption", () => {
    const unordered = singleSuccessSimulation();
    const unorderedResult = firstResult(unordered) as Record<string, unknown>;
    delete unorderedResult.receipt;
    delete unorderedResult.changes;
    unorderedResult.warnings = [
      {
        code: "CHANGE_ORDER_UNAVAILABLE",
        message: "synthetic ordering unavailable",
      },
    ];
    expect(
      mapMossEvidenceV0_1(mappingInput(undefined, unordered)).miniDemoDerived
        .ordering,
    ).toBe("FAILED");

    const interrupted = approvalSwapSimulation();
    interrupted.results.splice(1, 1);
    const first = interrupted.results[0] as Record<string, unknown>;
    first.warnings = [
      {
        code: "STATE_CHAIN_FAILED",
        message: "synthetic prior state unavailable",
      },
    ];
    (interrupted as Record<string, unknown>).halted = {
      transactionIndex: 0,
      reason: "synthetic prior state unavailable",
    };
    expect(
      mapMossEvidenceV0_1(mappingInput(approvalSwapCapability(), interrupted))
        .miniDemoDerived.stateContinuity,
    ).toBe("FAILED");
  });

  it("is deterministic for equal observations and does not mutate input", () => {
    const capability = singleTransactionCapability();
    const simulation = singleSuccessSimulation();
    const input = mappingInput(capability, simulation);
    const before = structuredClone({ capability, simulation });

    const first = mapMossEvidenceV0_1(input);
    const second = mapMossEvidenceV0_1(input);

    expect(first).toEqual(second);
    expect({ capability, simulation }).toEqual(before);
  });

  it("rejects an unsupported Moss commit before reusing mapping rules", () => {
    const input = mappingInput();
    const drifted = {
      ...MOSS_BUILD_INFO,
      integrationCommit: "0000000000000000000000000000000000000000",
    } as MossBuildInfo;
    const driftedInput = {
      ...input,
      buildInfo: drifted,
      originalSource: {
        ...input.originalSource,
        buildInfo: drifted,
      },
    };

    expect(() => mapMossEvidenceV0_1(driftedInput)).toThrowError(
      expect.objectContaining({
        code: "SOURCE_CONTRACT_VIOLATION",
        operation: "simulate",
      }),
    );
  });

  it.each([
    [
      "cycle",
      () => {
        const simulation = singleSuccessSimulation() as Record<string, unknown>;
        simulation.self = simulation;
        return simulation;
      },
    ],
    ["Proxy", () => new Proxy(singleSuccessSimulation(), {})],
    [
      "accessor",
      () =>
        Object.defineProperty(singleSuccessSimulation(), "hidden", {
          enumerable: true,
          get: () => "synthetic",
        }),
    ],
    ["sparse array", () => ({ results: new Array(1) })],
    [
      "Symbol",
      () => {
        const simulation = singleSuccessSimulation();
        Object.defineProperty(simulation, Symbol("synthetic"), {
          enumerable: true,
          value: "hidden",
        });
        return simulation;
      },
    ],
    [
      "non-finite number",
      () => ({ ...singleSuccessSimulation(), extra: Infinity }),
    ],
    [
      "lone surrogate",
      () => ({ ...singleSuccessSimulation(), extra: "\ud800" }),
    ],
  ] as const)("rejects a %s raw simulation graph", (_name, create) => {
    let caught: unknown;
    try {
      mapMossEvidenceV0_1(mappingInput(undefined, create()));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MossAdapterError);
    expect(caught).toMatchObject({
      code: "SOURCE_CONTRACT_VIOLATION",
      operation: "simulate",
    });
    expect(caught).not.toHaveProperty("cause");
  });
});
