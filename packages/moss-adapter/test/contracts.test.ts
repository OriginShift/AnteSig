import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MOSS_BUILD_INFO,
  createProductionMossPort,
  type MossSourceBindings,
} from "../src/index.js";

function syntheticBindings() {
  const riskLabels = ["SYNTHETIC_PRICE_MOVEMENT"];
  const stub = {
    protocol: "synthetic-protocol",
    method: "swap",
    kind: "capability",
    risk: riskLabels,
  };
  const quote = { amountOut: "42000000", source: "synthetic-inline" };
  const capability = {
    kind: "capability",
    protocol: "synthetic-protocol",
    method: "swap",
    params: { amountIn: "1000000" },
    children: [],
  };
  const simulation = {
    status: "synthetic-success",
    receipts: [{ status: "synthetic-receipt" }],
  };
  const operation = {
    protocolId: "synthetic-protocol",
    method: "swap",
    operationKind: "CAPABILITY" as const,
    stub,
    riskLabels,
  };
  const bindings = {
    chainId: 143,
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => operation,
    quote: async () => ({ operation, quote }),
    action: async () => ({ operation, capability }),
    simulate: async () => ({
      protocolId: "synthetic-protocol",
      method: "swap",
      simulation,
    }),
  } satisfies MossSourceBindings;
  return { bindings, stub, riskLabels, quote, capability, simulation };
}

describe("Moss adapter evidence contracts", () => {
  it("preserves the loaded Stub and risk labels while separating derived data", async () => {
    const { bindings, stub, riskLabels } = syntheticBindings();
    const port = createProductionMossPort(bindings);

    const contract = await port.describe("synthetic-protocol", "swap");

    expect(contract.mossOriginal.stub).toBe(stub);
    expect(contract.mossOriginal.riskLabels).toBe(riskLabels);
    expect(contract.mossOriginal.riskLabels).toBe(stub.risk);
    expect(contract.mossOriginal.source).toMatchObject({
      layer: "MOSS_ORIGINAL",
      provenance: "PINNED_SUBMODULE",
    });
    expect(contract.miniDemoDerived.source.layer).toBe("MINI_DEMO_DERIVED");
    expect(contract.miniDemoDerived.riskLabels).toEqual(riskLabels);
    expect(contract.miniDemoDerived.riskLabels).not.toBe(riskLabels);
    expect(contract.buildInfo).toBe(MOSS_BUILD_INFO);
  });

  it("keeps quote results raw and explicitly unselected", async () => {
    const { bindings, quote } = syntheticBindings();
    const port = createProductionMossPort(bindings);

    const evidence = await port.quote("synthetic-protocol", {
      method: "swap",
      account: "synthetic-account",
      params: { amountIn: "1000000" },
    });

    expect(evidence.mossOriginal.value).toBe(quote);
    expect(evidence.miniDemoDerived).toMatchObject({
      normalizationStatus: "NOT_NORMALIZED",
      reason: "DEFERRED_TO_M2_05",
    });
    expect(evidence).not.toHaveProperty("selection");
  });

  it("keeps raw capability identity and freezes only an independent snapshot", async () => {
    const { bindings, capability } = syntheticBindings();
    const port = createProductionMossPort(bindings);

    const evidence = await port.action("synthetic-protocol", {
      method: "swap",
      account: "synthetic-account",
      params: { amountIn: "1000000" },
    });

    expect(evidence.mossOriginal.value).toBe(capability);
    expect(evidence.miniDemoDerived.snapshot).toEqual(capability);
    expect(evidence.miniDemoDerived.snapshot).not.toBe(capability);
    expect(Object.isFrozen(capability)).toBe(false);
    expect(Object.isFrozen(evidence.miniDemoDerived.snapshot)).toBe(true);
    expect(Object.isFrozen(evidence.miniDemoDerived.snapshot.params)).toBe(
      true,
    );
    expect(evidence.miniDemoDerived.integrity).toEqual({
      status: "NOT_EVALUATED",
      reason: "DEFERRED_TO_M2_06",
    });
    expect(capability).not.toHaveProperty("riskLabels");
    expect(evidence).not.toHaveProperty("digest");
  });

  it("keeps simulation raw and explicitly unmapped", async () => {
    const { bindings, capability, simulation } = syntheticBindings();
    const port = createProductionMossPort(bindings);

    const evidence = await port.simulate(capability);

    expect(evidence.mossOriginal.value).toBe(simulation);
    expect(evidence.miniDemoDerived).toMatchObject({
      mappingStatus: "NOT_MAPPED",
      reason: "DEFERRED_TO_M2_07",
    });
    expect(evidence).not.toHaveProperty("alignment");
    expect(evidence).not.toHaveProperty("decision");
  });

  it("exposes the exact immutable #24 build identity", () => {
    const { bindings } = syntheticBindings();
    const port = createProductionMossPort(bindings);

    expect(port.buildInfo()).toBe(MOSS_BUILD_INFO);
    expect(MOSS_BUILD_INFO).toMatchObject({
      sourceMode: "INTEGRATION_FORK",
      upstreamCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
      integrationCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
      patchsetDigest:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      officialRelease: false,
    });
    expect(Object.isFrozen(MOSS_BUILD_INFO)).toBe(true);
    expect(Object.isFrozen(MOSS_BUILD_INFO.packages)).toBe(true);
  });
});
