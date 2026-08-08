import {
  AlignmentSchema,
  DecisionInputV0_1Schema,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import {
  type AlignmentCheckIdV0_1,
  AlignmentInputErrorV0_1,
  type AlignmentInputV0_1,
  evaluateAlignmentV0_1,
} from "../src/index.js";
import {
  ACCOUNT,
  buildPassingInput,
  CHECK_CASES,
  makeExplicitGap,
  makeIrrelevantReference,
  makeSameOwnerIrrelevantReference,
  OTHER,
  primaryFact,
  setAtPath,
  setFactAndSource,
} from "./synthetic.js";

function availableValue(fact: {
  availability: string;
  value?: unknown;
}): unknown {
  if (fact.availability !== "AVAILABLE") {
    throw new Error("synthetic fact is unavailable");
  }
  return fact.value;
}

function checkStatus(input: AlignmentInputV0_1, checkId: AlignmentCheckIdV0_1) {
  const alignment = evaluateAlignmentV0_1(input);
  const check = alignment.checks.find(
    (candidate) => candidate.checkId === checkId,
  );
  if (check === undefined) {
    throw new Error(`missing Alignment check ${checkId}`);
  }
  return check;
}

describe("deterministic Alignment check matrix", () => {
  it("emits the fixed 18 critical checks in canonical order", () => {
    const alignment = evaluateAlignmentV0_1(buildPassingInput());

    expect(alignment.checks).toHaveLength(18);
    expect(alignment.checks.map((check) => check.checkId)).toEqual(
      CHECK_CASES.map((entry) => entry.id),
    );
    expect(alignment.checks.every((check) => check.critical)).toBe(true);
    expect(alignment.checks.every((check) => check.status === "PASS")).toBe(
      true,
    );
    expect(AlignmentSchema.parse(alignment)).toEqual(alignment);
  });

  it.each(CHECK_CASES)("$id has a proven PASS case", ({ id }) => {
    expect(checkStatus(buildPassingInput(), id).status).toBe("PASS");
  });

  it.each(CHECK_CASES)("$id has a proven FAIL case", (checkCase) => {
    const input = buildPassingInput();
    const fact = primaryFact(input, checkCase);
    setFactAndSource(input, fact, checkCase.failValue);
    checkCase.updatePublicEvidence?.(input, checkCase.failValue);

    expect(checkStatus(input, checkCase.id).status).toBe("FAIL");
  });

  it.each(CHECK_CASES)(
    "$id maps explicit missing evidence to REVIEW",
    (checkCase) => {
      const input = buildPassingInput();
      makeExplicitGap(input, checkCase);

      expect(checkStatus(input, checkCase.id).status).toBe("REVIEW");
    },
  );

  it.each(CHECK_CASES)(
    "$id maps an invalid or unresolved reference to REVIEW",
    (checkCase) => {
      const invalid = buildPassingInput();
      primaryFact(invalid, checkCase).sourceReference = "#/fragment";
      const invalidCheck = checkStatus(invalid, checkCase.id);
      expect(invalidCheck.status).toBe("REVIEW");
      expect(invalidCheck.sourceReferences).not.toContain("#/fragment");

      const unresolved = buildPassingInput();
      primaryFact(unresolved, checkCase).sourceReference =
        "/simulation/raw/does-not-exist";
      const unresolvedCheck = checkStatus(unresolved, checkCase.id);
      expect(unresolvedCheck.status).toBe("REVIEW");
      expect(unresolvedCheck.sourceReferences).not.toContain(
        "/simulation/raw/does-not-exist",
      );
    },
  );

  it.each(CHECK_CASES)(
    "$id rejects a value-equal but irrelevant evidence owner",
    (checkCase) => {
      const input = buildPassingInput();
      makeIrrelevantReference(input, checkCase);

      const check = checkStatus(input, checkCase.id);
      expect(check.status).toBe("REVIEW");
      expect(check.sourceReferences).not.toContain(
        primaryFact(input, checkCase).sourceReference,
      );
    },
  );

  it.each(CHECK_CASES)(
    "$id rejects a value-equal but irrelevant field in the correct owner",
    (checkCase) => {
      const input = buildPassingInput();
      makeSameOwnerIrrelevantReference(input, checkCase);

      const check = checkStatus(input, checkCase.id);
      expect(check.status).toBe("REVIEW");
      expect(check.sourceReferences).not.toContain(
        primaryFact(input, checkCase).sourceReference,
      );
    },
  );
});

describe("check-specific boundaries", () => {
  it("uses the Intent account when recipient is omitted", () => {
    const input = buildPassingInput();
    delete input.intent.recipient;
    const fact = input.observations.recipient;
    setFactAndSource(input, fact, ACCOUNT);

    expect(checkStatus(input, "recipient-v0-1").status).toBe("PASS");
  });

  it("accepts a necessary bounded approval and rejects zero approval", () => {
    const bounded = buildPassingInput();
    setFactAndSource(
      bounded,
      bounded.observations.approvalSpender.expected,
      OTHER,
    );
    setFactAndSource(
      bounded,
      bounded.observations.approvalSpender.observed,
      OTHER,
    );
    setFactAndSource(bounded, bounded.observations.approvalAmount, {
      amount: "1000",
      unbounded: false,
    });
    expect(checkStatus(bounded, "approval-spender-v0-1").status).toBe("PASS");
    expect(checkStatus(bounded, "approval-amount-v0-1").status).toBe("PASS");

    const zero = structuredClone(bounded);
    setFactAndSource(zero, zero.observations.approvalAmount, {
      amount: "0",
      unbounded: false,
    });
    expect(checkStatus(zero, "approval-amount-v0-1").status).toBe("FAIL");

    const excessive = structuredClone(bounded);
    setFactAndSource(excessive, excessive.observations.approvalAmount, {
      amount: "1001",
      unbounded: false,
    });
    expect(checkStatus(excessive, "approval-amount-v0-1").status).toBe("FAIL");

    const unknownSpender = structuredClone(bounded);
    const spender = unknownSpender.observations.approvalSpender
      .observed as unknown as {
      availability: string;
      sourceReference: string;
      value?: unknown;
    };
    delete spender.value;
    spender.availability = "UNPROVABLE";
    spender.sourceReference = "/capability/availability";
    expect(checkStatus(unknownSpender, "approval-amount-v0-1").status).toBe(
      "REVIEW",
    );
  });

  it("compares transaction and movement sets independent of order", () => {
    const input = buildPassingInput();
    const secondTarget = OTHER;
    const secondMovement = {
      asset: { kind: "NATIVE" as const },
      from: ACCOUNT,
      to: OTHER,
      amount: "1",
    };
    setFactAndSource(input, input.observations.transactionSet.expected, [
      { address: secondTarget, role: "TOKEN" },
      ...(availableValue(
        input.observations.transactionSet.expected,
      ) as unknown[]),
    ]);
    setFactAndSource(input, input.observations.transactionSet.observed, [
      ...(availableValue(
        input.observations.transactionSet.observed,
      ) as unknown[]),
      secondTarget,
    ]);
    setFactAndSource(input, input.observations.fundsMovement.permitted, [
      secondMovement,
      ...(availableValue(
        input.observations.fundsMovement.permitted,
      ) as unknown[]),
    ]);
    setFactAndSource(input, input.observations.fundsMovement.observed, [
      ...(availableValue(
        input.observations.fundsMovement.observed,
      ) as unknown[]),
      secondMovement,
    ]);

    expect(checkStatus(input, "transaction-set-v0-1").status).toBe("PASS");
    expect(checkStatus(input, "unexpected-funds-movement-v0-1").status).toBe(
      "PASS",
    );
  });

  it("requires public simulation evidence to agree with raw-backed facts", () => {
    const input = buildPassingInput();
    if (
      input.simulation.availability !== "AVAILABLE" ||
      input.simulation.coverage.availability !== "AVAILABLE" ||
      input.simulation.ordering.availability !== "AVAILABLE" ||
      input.simulation.stateContinuity.availability !== "AVAILABLE" ||
      input.simulation.warnings.availability !== "AVAILABLE" ||
      input.simulation.receipts.availability !== "AVAILABLE"
    ) {
      throw new Error("synthetic simulation unavailable");
    }
    input.simulation.coverage.complete = false;
    input.simulation.ordering.valid = false;
    input.simulation.stateContinuity.continuous = false;
    input.simulation.warnings.items = [{ code: "PUBLIC_ONLY_WARNING" }];
    input.simulation.receipts.items = [];

    for (const id of [
      "warning-presence-v0-1",
      "receipt-availability-v0-1",
      "coverage-v0-1",
      "ordering-v0-1",
      "state-continuity-v0-1",
    ] as const) {
      expect(checkStatus(input, id).status).toBe("REVIEW");
    }
  });

  it("reviews individually unavailable public simulation components", () => {
    const unavailable = {
      availability: "UNPROVABLE" as const,
      failure: {
        code: "SYNTHETIC_UNPROVABLE" as never,
        sourceReferences: ["/simulation/raw" as never],
      },
    };
    for (const [component, checkId] of [
      ["coverage", "coverage-v0-1"],
      ["ordering", "ordering-v0-1"],
      ["stateContinuity", "state-continuity-v0-1"],
    ] as const) {
      const input = buildPassingInput();
      if (input.simulation.availability !== "AVAILABLE") {
        throw new Error("synthetic simulation unavailable");
      }
      input.simulation[component] = structuredClone(unavailable);
      expect(checkStatus(input, checkId).status).toBe("REVIEW");
    }
  });

  it("fails a public failed receipt even when the raw fact claims success", () => {
    const input = buildPassingInput();
    if (
      input.simulation.availability !== "AVAILABLE" ||
      input.simulation.receipts.availability !== "AVAILABLE"
    ) {
      throw new Error("synthetic receipts unavailable");
    }
    input.simulation.receipts.items[0] = {
      status: "FAILED",
      raw: { receiptId: "synthetic-public-failed" },
    };

    expect(checkStatus(input, "receipt-availability-v0-1").status).toBe("FAIL");

    const incomplete = buildPassingInput();
    setFactAndSource(incomplete, incomplete.observations.receipts, {
      expectedCount: 2,
      observedCount: 1,
      allSuccessful: true,
    });
    expect(checkStatus(incomplete, "receipt-availability-v0-1").status).toBe(
      "FAIL",
    );
  });

  it("rejects duplicate semantic sets and malformed scalar observations", () => {
    const duplicate = buildPassingInput();
    const target = (
      availableValue(
        duplicate.observations.transactionSet.observed,
      ) as unknown[]
    )[0];
    setFactAndSource(
      duplicate,
      duplicate.observations.transactionSet.observed,
      [target, target],
    );
    expect(() => evaluateAlignmentV0_1(duplicate)).toThrow(
      AlignmentInputErrorV0_1,
    );

    const duplicateMovements = buildPassingInput();
    const movement = (
      availableValue(
        duplicateMovements.observations.fundsMovement.observed,
      ) as unknown[]
    )[0];
    setFactAndSource(
      duplicateMovements,
      duplicateMovements.observations.fundsMovement.observed,
      [structuredClone(movement), structuredClone(movement)],
    );
    expect(() => evaluateAlignmentV0_1(duplicateMovements)).toThrow(
      AlignmentInputErrorV0_1,
    );

    const duplicateExpectedTargets = buildPassingInput();
    const expectedTarget = (
      availableValue(
        duplicateExpectedTargets.observations.transactionSet.expected,
      ) as unknown[]
    )[0];
    setFactAndSource(
      duplicateExpectedTargets,
      duplicateExpectedTargets.observations.transactionSet.expected,
      [structuredClone(expectedTarget), structuredClone(expectedTarget)],
    );
    expect(() => evaluateAlignmentV0_1(duplicateExpectedTargets)).toThrow(
      AlignmentInputErrorV0_1,
    );

    const duplicateQuotes = buildPassingInput();
    const firstQuote = duplicateQuotes.quotes[0];
    if (firstQuote === undefined) {
      throw new Error("synthetic quote missing");
    }
    duplicateQuotes.quotes.push(structuredClone(firstQuote));
    expect(() => evaluateAlignmentV0_1(duplicateQuotes)).toThrow(
      AlignmentInputErrorV0_1,
    );

    for (const value of ["-1", "1.0", "1e3", 1000, -0, Number.NaN]) {
      const invalid = buildPassingInput();
      const fact = invalid.observations.amountIn as unknown as {
        value: unknown;
        sourceReference: string;
      };
      fact.value = value;
      expect(() => evaluateAlignmentV0_1(invalid)).toThrow(
        AlignmentInputErrorV0_1,
      );
    }
  });
});

describe("output integration, purity, and determinism", () => {
  it("builds Alignment accepted by the complete DecisionInput schema", () => {
    const input = buildPassingInput();
    const alignment = evaluateAlignmentV0_1(input);
    const parsed = DecisionInputV0_1Schema.safeParse({
      schemaVersion: "0.1",
      reportId: "11111111-1111-4111-8111-111111111111",
      generatedAt: "2031-03-04T05:06:07.000Z",
      network: "eip155:143",
      provenance: "FIXTURE",
      intent: input.intent,
      quotes: input.quotes,
      selection: input.selection,
      capability: input.capability,
      simulation: input.simulation,
      alignment,
    });

    expect(parsed.success).toBe(true);
  });

  it("does not mutate or freeze caller input and returns fresh output", () => {
    const input = buildPassingInput();
    const before = structuredClone(input);
    const first = evaluateAlignmentV0_1(input);
    const second = evaluateAlignmentV0_1(input);

    expect(input).toEqual(before);
    expect(Object.isFrozen(input)).toBe(false);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.checks).not.toBe(first.checks);
    const firstCheck = first.checks[0];
    if (firstCheck === undefined) {
      throw new Error("synthetic Alignment check missing");
    }
    firstCheck.status = "FAIL";
    expect(evaluateAlignmentV0_1(input)).toEqual(second);
  });

  it("ignores property insertion order and stays byte-deterministic", () => {
    const input = buildPassingInput();
    const reordered = Object.fromEntries(
      Object.entries(input).reverse(),
    ) as unknown as AlignmentInputV0_1;
    const first = evaluateAlignmentV0_1(input);
    const second = evaluateAlignmentV0_1(reordered);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("is synchronous and does not read clock, randomness, fetch, or prose", () => {
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("clock forbidden");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("random forbidden");
    });
    vi.stubGlobal("fetch", () => {
      throw new Error("network forbidden");
    });
    try {
      const alignment = evaluateAlignmentV0_1(buildPassingInput());
      expect(alignment).not.toBeInstanceOf(Promise);
      expect(JSON.stringify(alignment)).not.toContain("prose");
      expect(now).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      random.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("uses stable structured errors for unsupported and malformed input", () => {
    expect(() => evaluateAlignmentV0_1({ schemaVersion: "0.2" })).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_SCHEMA_VERSION" }),
    );
    expect(() => evaluateAlignmentV0_1({ schemaVersion: "0.1" })).toThrow(
      expect.objectContaining({ code: "INVALID_ALIGNMENT_INPUT" }),
    );

    const extra = buildPassingInput() as unknown as Record<string, unknown>;
    extra.prose = "must not alter deterministic checks";
    expect(() => evaluateAlignmentV0_1(extra)).toThrow(AlignmentInputErrorV0_1);
  });

  it("maps source value substitution to REVIEW rather than trusting the fact", () => {
    const input = buildPassingInput();
    setAtPath(input, ["capability", "raw", "context", "account"], OTHER);

    const check = checkStatus(input, "account-v0-1");
    expect(check.status).toBe("REVIEW");
    expect(check.sourceReferences).not.toContain(
      input.observations.account.sourceReference,
    );
  });
});
