import type { Provenance } from "@moss-mini-demo/report-schema";
import type { ComparisonStripInput } from "./comparison-strip";
import { comparisonColumns } from "./comparison-strip";

export type CoreTensionModel = Readonly<{
  observed: string;
  prepared: string;
  requested: string;
}>;

function amountValue(
  input: ComparisonStripInput,
  columnKey: "intent" | "prepared" | "simulation",
  label: "Amount in" | "Amount in observed",
): string {
  const column = comparisonColumns(input).find(
    (candidate) => candidate.key === columnKey,
  );
  return (
    column?.items.find((item) => item.label === label)?.value ?? "not present"
  );
}

export function formatNativeAmount(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  const padded = value.padStart(19, "0");
  const whole = padded.slice(0, -18);
  const fraction = padded.slice(-18).replace(/0+$/, "");
  return `${BigInt(whole)}.${fraction || "0"} NATIVE`;
}

export function ratioLabel(requested: string, observed: string): string {
  if (!/^\d+$/.test(requested) || !/^\d+$/.test(observed)) return "not exact";
  const requestedAmount = BigInt(requested);
  const observedAmount = BigInt(observed);
  if (requestedAmount === 0n || observedAmount % requestedAmount !== 0n) {
    return "not exact";
  }
  return `${observedAmount / requestedAmount}x`;
}

export function tensionProvenanceLabel(provenance: Provenance): string {
  return `${provenance} / SOURCE-BOUND`;
}

export function coreTensionModel(
  input: ComparisonStripInput,
): CoreTensionModel | undefined {
  const requested = amountValue(input, "intent", "Amount in");
  const prepared = amountValue(input, "prepared", "Amount in");
  const observed = amountValue(input, "simulation", "Amount in observed");
  const valuesAreExact = [requested, prepared, observed].every((value) =>
    /^\d+$/.test(value),
  );
  const simulationSucceeded =
    input.simulation.availability === "AVAILABLE" &&
    input.simulation.executionStatus === "SUCCESS";
  const hasMismatch = requested !== prepared || requested !== observed;

  return valuesAreExact && simulationSucceeded && hasMismatch
    ? { observed, prepared, requested }
    : undefined;
}
