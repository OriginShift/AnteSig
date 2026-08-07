import { formatUnits, parseUnits } from "viem";
import { MossAdapterError } from "./errors.js";

const UINT256_MAX = (1n << 256n) - 1n;
const SMALLEST_UNIT = /^[1-9][0-9]*$/;
const HUMAN_DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

function invalidAmount(): never {
  throw new MossAdapterError("INVALID_INPUT", "action");
}

function validatedDecimals(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 255
  ) {
    return invalidAmount();
  }
  return value;
}

export function parseSmallestUnit(value: unknown): bigint {
  if (typeof value !== "string" || !SMALLEST_UNIT.test(value)) {
    return invalidAmount();
  }
  try {
    const parsed = BigInt(value);
    if (parsed < 1n || parsed > UINT256_MAX) {
      return invalidAmount();
    }
    return parsed;
  } catch {
    return invalidAmount();
  }
}

export function parseHumanDecimalStrict(
  value: unknown,
  decimalsValue: unknown,
): bigint {
  const decimals = validatedDecimals(decimalsValue);
  if (typeof value !== "string") {
    return invalidAmount();
  }
  const match = HUMAN_DECIMAL.exec(value);
  const fraction = match?.[1] ?? "";
  if (match === null || fraction.length > decimals) {
    return invalidAmount();
  }
  try {
    const parsed = parseUnits(value, decimals);
    if (
      parsed < 1n ||
      parsed > UINT256_MAX ||
      formatUnits(parsed, decimals) !== value
    ) {
      return invalidAmount();
    }
    return parsed;
  } catch {
    return invalidAmount();
  }
}

export function smallestUnitToHumanDecimal(
  value: unknown,
  decimalsValue: unknown,
): Readonly<{
  smallestUnit: string;
  humanDecimal: string;
  decimals: number;
  conversion: "VIEM_PARSE_FORMAT_UNITS_V0_1";
}> {
  const decimals = validatedDecimals(decimalsValue);
  const smallest = parseSmallestUnit(value);
  const humanDecimal = formatUnits(smallest, decimals);
  if (parseHumanDecimalStrict(humanDecimal, decimals) !== smallest) {
    return invalidAmount();
  }
  return Object.freeze({
    smallestUnit: smallest.toString(10),
    humanDecimal,
    decimals,
    conversion: "VIEM_PARSE_FORMAT_UNITS_V0_1",
  });
}
