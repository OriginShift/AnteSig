import { describe, expect, it } from "vitest";

import { MossAdapterError } from "../src/errors.js";
import {
  parseHumanDecimalStrict,
  parseSmallestUnit,
  smallestUnitToHumanDecimal,
} from "../src/amount.js";

const UINT256_MAX =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

function expectInvalid(callback: () => unknown): void {
  expect(callback).toThrowError(MossAdapterError);
  expect(callback).toThrowError(
    expect.objectContaining({ code: "INVALID_INPUT", operation: "action" }),
  );
}

describe("smallest-unit and human-decimal conversion", () => {
  it.each([
    ["1000000000000000000", 18, "1"],
    ["1", 18, "0.000000000000000001"],
    ["42", 0, "42"],
    [
      UINT256_MAX,
      18,
      "115792089237316195423570985008687907853269984665640564039457.584007913129639935",
    ],
  ] as const)(
    "round-trips %s smallest units at %i decimals",
    (smallestUnit, decimals, humanDecimal) => {
      const converted = smallestUnitToHumanDecimal(smallestUnit, decimals);

      expect(converted).toEqual({
        smallestUnit,
        humanDecimal,
        decimals,
        conversion: "VIEM_PARSE_FORMAT_UNITS_V0_1",
      });
      expect(parseHumanDecimalStrict(humanDecimal, decimals)).toBe(
        BigInt(smallestUnit),
      );
      expect(parseSmallestUnit(smallestUnit)).toBe(BigInt(smallestUnit));
      expect(Object.isFrozen(converted)).toBe(true);
    },
  );

  it.each([-1, 1.5, 256, Number.NaN, "18"])(
    "rejects invalid decimals %j",
    (decimals) => {
      expectInvalid(() => smallestUnitToHumanDecimal("1", decimals));
    },
  );

  it.each([
    "0",
    "00",
    "01",
    "+1",
    "-1",
    "1.0",
    "1e18",
    " 1",
    "1 ",
    `${UINT256_MAX}0`,
    1,
  ])("rejects non-canonical smallest-unit value %j", (value) => {
    expectInvalid(() => parseSmallestUnit(value));
  });

  it.each([
    ["0", 18],
    ["1.0", 18],
    ["00.1", 18],
    [".1", 18],
    ["1.", 18],
    ["+1", 18],
    ["-1", 18],
    ["1e-18", 18],
    [" 1", 18],
    ["0.0000000000000000001", 18],
    ["1.1", 0],
  ] as const)(
    "rejects lossy or non-canonical human value %s",
    (value, decimals) => {
      expectInvalid(() => parseHumanDecimalStrict(value, decimals));
    },
  );
});
