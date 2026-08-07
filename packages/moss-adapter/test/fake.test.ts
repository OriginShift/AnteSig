import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MOSS_BUILD_INFO,
  createFakeMossPort,
  createProductionMossPort,
  type MossSourceBindings,
  type RawCapability,
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
  it("forwards the exact optional quote AbortSignal", async () => {
    const bindings = syntheticBindings();
    const quote = vi.fn(bindings.quote as MossSourceBindings["quote"]);
    const fake = createFakeMossPort({ ...bindings, quote });
    const controller = new AbortController();

    await fake.quote(
      "synthetic-protocol",
      { method: "swap", account: "synthetic-account", params: {} },
      { signal: controller.signal },
    );

    expect(quote).toHaveBeenCalledOnce();
    expect(quote.mock.calls[0]?.[2]?.signal).toBe(controller.signal);
  });

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

  it("forwards a registered synthetic action return by exact identity", async () => {
    const bindings = syntheticBindings();
    const capability = { kind: "capability", children: [] };
    const action = vi.fn(
      async (...args: Parameters<MossSourceBindings["action"]>) => ({
        ...(await bindings.action(...args)),
        capability,
      }),
    );
    const simulate = vi.fn(bindings.simulate as MossSourceBindings["simulate"]);
    const fake = createFakeMossPort({ ...bindings, action, simulate });

    const evidence = await fake.action("synthetic-protocol", {
      method: "swap",
      account: "synthetic-account",
      params: {},
    });
    await fake.simulate(evidence.mossOriginal.value);

    expect(evidence.mossOriginal.value).toBe(capability);
    expect(simulate).toHaveBeenCalledOnce();
    expect(simulate.mock.calls[0]?.[0]).toBe(capability);
  });

  it.each([
    [
      "non-enumerable property",
      (raw: Record<PropertyKey, unknown>) => {
        Object.defineProperty(raw, "hidden", {
          value: "synthetic-hidden",
          enumerable: false,
        });
      },
    ],
    [
      "Symbol key",
      (raw: Record<PropertyKey, unknown>) => {
        Object.defineProperty(raw, Symbol("synthetic-hidden"), {
          value: "synthetic-hidden",
          enumerable: true,
        });
      },
    ],
    [
      "sparse array",
      (raw: Record<PropertyKey, unknown>) => {
        raw.children = new Array(1);
      },
    ],
    [
      "extra array property",
      (raw: Record<PropertyKey, unknown>) => {
        const children = raw.children as unknown[] & { extra?: string };
        children.extra = "synthetic-extra";
      },
    ],
  ] as const)(
    "rejects registered %s before fake simulation delegation",
    async (_name, mutate) => {
      const bindings = syntheticBindings();
      const capability: RawCapability = { kind: "capability", children: [] };
      const action = vi.fn(
        async (...args: Parameters<MossSourceBindings["action"]>) => ({
          ...(await bindings.action(...args)),
          capability,
        }),
      );
      const simulate = vi.fn(
        bindings.simulate as MossSourceBindings["simulate"],
      );
      const fake = createFakeMossPort({ ...bindings, action, simulate });
      const evidence = await fake.action("synthetic-protocol", {
        method: "swap",
        account: "synthetic-account",
        params: {},
      });
      mutate(
        evidence.mossOriginal.value as unknown as Record<PropertyKey, unknown>,
      );

      await expect(
        fake.simulate(evidence.mossOriginal.value),
      ).rejects.toMatchObject({ code: "INVALID_INPUT", operation: "simulate" });
      expect(simulate).not.toHaveBeenCalled();
    },
  );
});
