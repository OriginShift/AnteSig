import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MOSS_BUILD_INFO,
  createFakeMossPort,
  createProductionMossPort,
  type MossSourceBindings,
} from "../src/index.js";

function syntheticBindings(): MossSourceBindings {
  const riskLabels = ["SYNTHETIC_RISK"];
  const operation = {
    protocolId: "synthetic-protocol",
    method: "swap",
    operationKind: "CAPABILITY" as const,
    stub: {
      protocol: "synthetic-protocol",
      method: "swap",
      kind: "capability",
      risk: riskLabels,
      source: "synthetic-inline",
    },
    riskLabels,
  };
  return {
    chainId: 143,
    buildInfo: () => MOSS_BUILD_INFO,
    describe: async () => operation,
    quote: async () => ({ operation, quote: { amountOut: "42" } }),
    action: async () => ({
      operation,
      capability: { kind: "capability", children: [] },
    }),
    simulate: async () => ({
      protocolId: "synthetic-protocol",
      method: "swap",
      simulation: { status: "synthetic-success" },
    }),
  };
}

describe("FakeMossPort", () => {
  it("implements the same five-method shapes with explicit synthetic provenance", async () => {
    const fake = createFakeMossPort(syntheticBindings());
    const production = createProductionMossPort(syntheticBindings());
    const input = {
      method: "swap",
      account: "synthetic-account",
      params: { amountIn: "100" },
    } as const;
    const capability = { kind: "capability", children: [] } as const;

    const fakeResults = {
      describe: await fake.describe("synthetic-protocol", "swap"),
      quote: await fake.quote("synthetic-protocol", input),
      action: await fake.action("synthetic-protocol", input),
      simulate: await fake.simulate(capability),
      buildInfo: fake.buildInfo(),
    };
    const productionResults = {
      describe: await production.describe("synthetic-protocol", "swap"),
      quote: await production.quote("synthetic-protocol", input),
      action: await production.action("synthetic-protocol", input),
      simulate: await production.simulate(capability),
      buildInfo: production.buildInfo(),
    };

    expect(Object.keys(fakeResults)).toEqual(Object.keys(productionResults));
    expect(fakeResults.describe.mossOriginal.source.provenance).toBe(
      "SYNTHETIC_FAKE",
    );
    expect(fakeResults.quote.mossOriginal.source.provenance).toBe(
      "SYNTHETIC_FAKE",
    );
    expect(fakeResults.action.mossOriginal.source.provenance).toBe(
      "SYNTHETIC_FAKE",
    );
    expect(fakeResults.simulate.mossOriginal.source.provenance).toBe(
      "SYNTHETIC_FAKE",
    );
    expect(productionResults.describe.mossOriginal.source.provenance).toBe(
      "PINNED_SUBMODULE",
    );
    expect(fakeResults.buildInfo).toBe(MOSS_BUILD_INFO);
  });

  it("is deterministic and does not mutate inline synthetic inputs", async () => {
    const fake = createFakeMossPort(syntheticBindings());
    const input = {
      method: "swap",
      account: "synthetic-account",
      params: { amountIn: "100" },
    } as const;
    const before = structuredClone(input);

    const first = await fake.action("synthetic-protocol", input);
    const second = await fake.action("synthetic-protocol", input);

    expect(first).toEqual(second);
    expect(input).toEqual(before);
    expect(first.miniDemoDerived.snapshot).not.toBe(first.mossOriginal.value);
    expect(first.miniDemoDerived.integrity.status).toBe("NOT_EVALUATED");
  });

  it("shares the chain-id fail-closed boundary", () => {
    expect(() =>
      createFakeMossPort({ ...syntheticBindings(), chainId: 1 }),
    ).toThrowError(expect.objectContaining({ code: "CHAIN_ID_MISMATCH" }));
  });
});
