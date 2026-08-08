import { describe, expect, it, vi } from "vitest";
import {
  type AlignmentCheckIdV0_1,
  AlignmentInputErrorV0_1,
  evaluateAlignmentV0_1,
} from "../src/index.js";
import {
  ALIGNMENT_CHECK_IDS_V0_1,
  compareUtf8V0_1,
  isJsonDescriptorClosedAlignmentInput,
  outputReferencesAreValidV0_1,
  validateFactReferenceV0_1,
} from "../src/source-references.js";
import { ACCOUNT, buildPassingInput, setAtPath } from "./synthetic.js";

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

describe("raw-backed source-reference validation", () => {
  it("resolves canonical RFC 6901 escapes without invoking presentation paths", () => {
    const input = buildPassingInput();
    setAtPath(input, ["capability", "raw", "context", "a/b~c"], {
      account: ACCOUNT,
    });
    const result = validateFactReferenceV0_1(
      input,
      "account-v0-1",
      "observed",
      {
        availability: "AVAILABLE",
        value: ACCOUNT,
        sourceReference: "/capability/raw/context/a~1b~0c/account",
      },
    );

    expect(result).toEqual({
      valid: true,
      reference: "/capability/raw/context/a~1b~0c/account",
      value: ACCOUNT,
    });
  });

  it.each([
    "",
    "#/capability/raw/context/account",
    "/capability/raw/context/~2",
    "/capability/raw/context/%61ccount",
    "/quotes/00/raw/context/operation",
    "/quotes/99/raw/context/operation",
    "/capability/raw/__proto__",
    "/capability/raw/constructor",
    "/capability/raw/prototype",
    "/alignment/checks/0",
    "/decision/status",
    "/capability/raw/sourceReferences/0",
  ])("rejects invalid, unsafe, unresolved, or output pointer %s", (pointer) => {
    expect(
      validateFactReferenceV0_1(
        buildPassingInput(),
        "account-v0-1",
        "observed",
        {
          availability: "AVAILABLE",
          value: ACCOUNT,
          sourceReference: pointer,
        },
      ),
    ).toEqual({ valid: false });
  });

  it("requires raw equality, relevance, and matching explicit availability", () => {
    const input = buildPassingInput();
    expect(
      validateFactReferenceV0_1(input, "account-v0-1", "observed", {
        availability: "AVAILABLE",
        value: ACCOUNT,
        sourceReference: "/simulation/raw/context/observedTransactionTargets/0",
      }),
    ).toEqual({ valid: false });
    expect(
      validateFactReferenceV0_1(input, "account-v0-1", "observed", {
        availability: "AVAILABLE",
        value: "0x5555555555555555555555555555555555555555",
        sourceReference: "/capability/raw/context/account",
      }),
    ).toEqual({ valid: false });
    expect(
      validateFactReferenceV0_1(input, "account-v0-1", "observed", {
        availability: "UNPROVABLE",
        sourceReference: "/capability/availability",
      }),
    ).toEqual({ valid: false });

    const unavailable = buildPassingInput();
    unavailable.capability = {
      availability: "UNPROVABLE",
      failure: {
        code: "SYNTHETIC_UNPROVABLE" as never,
        sourceReferences: ["/intent" as never],
      },
    };
    expect(
      validateFactReferenceV0_1(unavailable, "account-v0-1", "observed", {
        availability: "UNPROVABLE",
        sourceReference: "/capability/availability",
      }),
    ).toEqual({
      valid: true,
      reference: "/capability/availability",
      value: "UNPROVABLE",
    });
  });

  it("rejects non-canonical and unsafe array indexes during resolution", () => {
    const input = buildPassingInput();
    for (const pointer of [
      "/quotes/not-an-index/raw/context/operation",
      "/quotes/999999999999999999999999/raw/context/operation",
      "/quotes/1/raw/context/operation",
    ]) {
      expect(
        validateFactReferenceV0_1(input, "operation-v0-1", "expected", {
          availability: "AVAILABLE",
          value: "swap",
          sourceReference: pointer,
        }),
      ).toEqual({ valid: false });
    }

    setAtPath(input, ["capability", "raw", "context", "list"], [ACCOUNT]);
    expect(
      validateFactReferenceV0_1(input, "account-v0-1", "observed", {
        availability: "AVAILABLE",
        value: ACCOUNT,
        sourceReference: "/capability/raw/context/list/not-an-index/account",
      }),
    ).toEqual({ valid: false });
  });

  it("recognizes every report-owned simulation raw artifact form", () => {
    const input = buildPassingInput();
    if (
      input.simulation.availability !== "AVAILABLE" ||
      input.simulation.warnings.availability !== "AVAILABLE"
    ) {
      throw new Error("synthetic simulation unavailable");
    }
    input.simulation.warnings.items = [[]];
    setAtPath(input, ["simulation", "coverage", "raw", "coverage"], true);
    setAtPath(input, ["simulation", "ordering", "raw", "ordering"], true);
    setAtPath(
      input,
      ["simulation", "stateContinuity", "raw", "stateContinuity"],
      true,
    );
    setAtPath(
      input,
      ["simulation", "receipts", "items", "0", "raw", "receipts"],
      true,
    );
    const references: readonly [AlignmentCheckIdV0_1, string][] = [
      ["coverage-v0-1", "/simulation/coverage/raw/coverage"],
      ["ordering-v0-1", "/simulation/ordering/raw/ordering"],
      [
        "state-continuity-v0-1",
        "/simulation/stateContinuity/raw/stateContinuity",
      ],
      [
        "receipt-availability-v0-1",
        "/simulation/receipts/items/0/raw/receipts",
      ],
      ["warning-presence-v0-1", "/simulation/warnings/items/0"],
    ];
    for (const [checkId, reference] of references) {
      expect(outputReferencesAreValidV0_1(input, checkId, [reference])).toBe(
        true,
      );
    }
  });

  it("recognizes component-level explicit availability evidence", () => {
    const input = buildPassingInput();
    if (input.simulation.availability !== "AVAILABLE") {
      throw new Error("synthetic simulation unavailable");
    }
    input.simulation.coverage = {
      availability: "UNPROVABLE",
      failure: {
        code: "SYNTHETIC_UNPROVABLE" as never,
        sourceReferences: ["/simulation/raw" as never],
      },
    };
    expect(
      validateFactReferenceV0_1(input, "coverage-v0-1", "observed", {
        availability: "UNPROVABLE",
        sourceReference: "/simulation/coverage/availability",
      }),
    ).toEqual({
      valid: true,
      reference: "/simulation/coverage/availability",
      value: "UNPROVABLE",
    });
  });

  it("accepts only resolving, unique, check-relevant output references", () => {
    const input = buildPassingInput();
    expect(
      outputReferencesAreValidV0_1(input, "account-v0-1", [
        "/intent/account",
        "/capability/raw/context/account",
      ]),
    ).toBe(true);
    expect(outputReferencesAreValidV0_1(input, "account-v0-1", [])).toBe(false);
    expect(
      outputReferencesAreValidV0_1(input, "account-v0-1", [
        "/intent/account",
        "/intent/account",
      ]),
    ).toBe(false);
    expect(
      outputReferencesAreValidV0_1(input, "account-v0-1", [
        "/simulation/raw/context/warnings",
      ]),
    ).toBe(false);
    expect(
      outputReferencesAreValidV0_1(input, "account-v0-1", [
        "/capability/raw/missing",
      ]),
    ).toBe(false);
  });

  it.each([
    "approval-spender-v0-1",
    "capability-integrity-v0-1",
    "transaction-set-v0-1",
    "warning-presence-v0-1",
    "receipt-availability-v0-1",
    "coverage-v0-1",
    "ordering-v0-1",
    "state-continuity-v0-1",
  ] as const)("rejects Intent output references for %s", (checkId) => {
    expect(
      outputReferencesAreValidV0_1(buildPassingInput(), checkId, ["/intent"]),
    ).toBe(false);
  });

  it("sorts references by UTF-8 bytes with a code-unit tie break", () => {
    const values = ["/😀", "/\uE000", "/b", "/a"];
    expect([...values].sort(compareUtf8V0_1)).toEqual([
      "/a",
      "/b",
      "/\uE000",
      "/😀",
    ]);

    const high0 = "/\uD800";
    const high1 = "/\uD801";
    expect([...new TextEncoder().encode(high0)]).toEqual([
      ...new TextEncoder().encode(high1),
    ]);
    expect(compareUtf8V0_1(high0, high1)).toBeLessThan(0);
    expect(compareUtf8V0_1("/a", "/aa")).toBeLessThan(0);
    expect(compareUtf8V0_1("/same", "/same")).toBe(0);
  });

  it("keeps the fixed check-id registry closed", () => {
    expect(ALIGNMENT_CHECK_IDS_V0_1).toHaveLength(18);
    expect(new Set(ALIGNMENT_CHECK_IDS_V0_1).size).toBe(18);
  });
});

describe("descriptor-closed hostile input boundary", () => {
  it("accepts ordinary and deeply frozen JSON graphs", () => {
    const input = buildPassingInput();
    setAtPath(input, ["capability", "raw", "context", "emoji"], "😀");
    expect(isJsonDescriptorClosedAlignmentInput(input)).toBe(true);
    deepFreeze(input);
    expect(isJsonDescriptorClosedAlignmentInput(input)).toBe(true);
    expect(evaluateAlignmentV0_1(input).checks).toHaveLength(18);
  });

  it("accepts JSON primitives but lets the contract parser reject them", () => {
    for (const value of [null, true, "value", 1]) {
      expect(isJsonDescriptorClosedAlignmentInput(value)).toBe(true);
      expect(() => evaluateAlignmentV0_1(value)).toThrow(
        AlignmentInputErrorV0_1,
      );
    }
  });

  it("rejects accessors without reading them", () => {
    let reads = 0;
    const input = buildPassingInput() as unknown as Record<string, unknown>;
    Object.defineProperty(input, "secret", {
      enumerable: true,
      get() {
        reads += 1;
        return "must-not-read";
      },
    });

    expect(isJsonDescriptorClosedAlignmentInput(input)).toBe(false);
    expect(() => evaluateAlignmentV0_1(input)).toThrow(AlignmentInputErrorV0_1);
    expect(reads).toBe(0);
  });

  it("rejects proxies before their traps can participate in evaluation", () => {
    const input = buildPassingInput();
    const proxy = new Proxy(input.capability, {
      get() {
        throw new Error("proxy trap must not become evidence");
      },
    });
    (input as unknown as Record<string, unknown>).capability = proxy;

    expect(isJsonDescriptorClosedAlignmentInput(input)).toBe(false);
    expect(() => evaluateAlignmentV0_1(input)).toThrow(AlignmentInputErrorV0_1);
  });

  it("fails closed when the Node proxy detector is unavailable or throws", () => {
    const originalProcess = (globalThis as unknown as { process: unknown })
      .process;
    vi.stubGlobal("process", undefined);
    const unavailable = isJsonDescriptorClosedAlignmentInput({ value: true });
    vi.stubGlobal("process", {
      getBuiltinModule() {
        throw new Error("node:util unavailable");
      },
    });
    const throwing = isJsonDescriptorClosedAlignmentInput({ value: true });
    vi.stubGlobal("process", originalProcess);
    vi.unstubAllGlobals();

    expect(unavailable).toBe(false);
    expect(throwing).toBe(false);
  });

  it.each([
    [
      "cycle",
      (input: Record<string, unknown>) => {
        input.cycle = input;
      },
    ],
    [
      "repeated reference",
      (input: Record<string, unknown>) => {
        const repeated = { value: true };
        input.first = repeated;
        input.second = repeated;
      },
    ],
    [
      "sparse array",
      (input: Record<string, unknown>) => {
        input.sparse = new Array(2);
      },
    ],
    [
      "function",
      (input: Record<string, unknown>) => {
        input.callable = () => true;
      },
    ],
    [
      "symbol value",
      (input: Record<string, unknown>) => {
        input.symbol = Symbol("value");
      },
    ],
    [
      "custom prototype",
      (input: Record<string, unknown>) => {
        input.custom = new Date(0);
      },
    ],
    [
      "non-finite number",
      (input: Record<string, unknown>) => {
        input.number = Number.POSITIVE_INFINITY;
      },
    ],
    [
      "negative zero",
      (input: Record<string, unknown>) => {
        input.number = -0;
      },
    ],
    [
      "lone surrogate value",
      (input: Record<string, unknown>) => {
        input.value = "\uD800";
      },
    ],
    [
      "lone low surrogate value",
      (input: Record<string, unknown>) => {
        input.value = "\uDC00";
      },
    ],
  ] as const)("rejects a %s graph", (_name, mutate) => {
    const input = buildPassingInput() as unknown as Record<string, unknown>;
    mutate(input);

    expect(isJsonDescriptorClosedAlignmentInput(input)).toBe(false);
    expect(() => evaluateAlignmentV0_1(input)).toThrow(AlignmentInputErrorV0_1);
  });

  it("rejects symbol, lone-surrogate, non-enumerable, and prototype keys", () => {
    const values: Record<string, unknown>[] = [];

    const symbolKey = buildPassingInput() as unknown as Record<string, unknown>;
    Object.defineProperty(symbolKey, Symbol("key"), {
      enumerable: true,
      value: true,
    });
    values.push(symbolKey);

    const surrogateKey = buildPassingInput() as unknown as Record<
      string,
      unknown
    >;
    Object.defineProperty(surrogateKey, "\uD800", {
      enumerable: true,
      value: true,
    });
    values.push(surrogateKey);

    const hidden = buildPassingInput() as unknown as Record<string, unknown>;
    Object.defineProperty(hidden, "hidden", {
      enumerable: false,
      value: true,
    });
    values.push(hidden);

    const forbidden = buildPassingInput() as unknown as Record<string, unknown>;
    Object.defineProperty(forbidden, "__proto__", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: null,
    });
    values.push(forbidden);

    for (const value of values) {
      expect(isJsonDescriptorClosedAlignmentInput(value)).toBe(false);
    }
  });

  it("rejects malformed array descriptors", () => {
    const input = buildPassingInput() as unknown as Record<string, unknown>;
    const array = [1];
    Object.defineProperty(array, "extra", {
      enumerable: true,
      value: 2,
    });
    input.array = array;

    expect(isJsonDescriptorClosedAlignmentInput(input)).toBe(false);

    const customPrototype = buildPassingInput() as unknown as Record<
      string,
      unknown
    >;
    customPrototype.array = Object.setPrototypeOf([1], null);
    expect(isJsonDescriptorClosedAlignmentInput(customPrototype)).toBe(false);

    const wrongKeyOrder = buildPassingInput() as unknown as Record<
      string,
      unknown
    >;
    const holeWithExtra = [1];
    delete holeWithExtra[0];
    Object.defineProperty(holeWithExtra, "extra", {
      enumerable: true,
      value: 2,
    });
    wrongKeyOrder.array = holeWithExtra;
    expect(isJsonDescriptorClosedAlignmentInput(wrongKeyOrder)).toBe(false);

    const invalidElement = buildPassingInput() as unknown as Record<
      string,
      unknown
    >;
    const hiddenIndex = [1];
    Object.defineProperty(hiddenIndex, "0", {
      enumerable: false,
      value: 1,
    });
    invalidElement.array = hiddenIndex;
    expect(isJsonDescriptorClosedAlignmentInput(invalidElement)).toBe(false);
  });
});
