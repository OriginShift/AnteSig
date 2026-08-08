import type {
  Asset,
  Capability,
  Intent,
  Quote,
  Selection,
  Simulation,
} from "@moss-mini-demo/report-schema";

type ComparisonItem = Readonly<{
  label: string;
  value: string;
  sourceReferences: readonly string[];
}>;

export type ComparisonColumn = Readonly<{
  key: "intent" | "prepared" | "simulation";
  title: string;
  description: string;
  items: readonly ComparisonItem[];
}>;

export type ComparisonStripInput = Readonly<{
  intent: Intent;
  quotes: readonly Quote[];
  selection: Selection;
  capability: Capability;
  simulation: Simulation;
}>;

function assetLabel(asset: Asset): string {
  return asset.kind === "NATIVE" ? "NATIVE" : asset.address;
}

function jsonValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) return "null";
  if (typeof value === "object" && value !== undefined) {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function rawPath(
  raw: unknown,
  path: readonly (string | number)[],
): string | undefined {
  let current = raw;
  for (const segment of path) {
    if (typeof current !== "object" || current === null) return undefined;
    if (Array.isArray(current)) {
      current =
        current[typeof segment === "number" ? segment : Number(segment)];
    } else {
      current = (current as Record<string, unknown>)[String(segment)];
    }
  }
  return jsonValue(current);
}

function item(
  label: string,
  value: string,
  sourceReferences: readonly string[],
): ComparisonItem {
  return { label, value, sourceReferences };
}

export function comparisonColumns({
  intent,
  quotes,
  selection,
  capability,
  simulation,
}: ComparisonStripInput): readonly ComparisonColumn[] {
  const quoteIndex =
    selection.status === "SELECTED"
      ? quotes.findIndex((quote) => quote.quoteId === selection.quoteId)
      : -1;
  const quote = quoteIndex >= 0 ? quotes[quoteIndex] : undefined;
  const quoteReference =
    quoteIndex >= 0 ? `/quotes/${quoteIndex}` : "/selection";
  const capabilityRawAmount =
    capability.availability === "AVAILABLE"
      ? rawPath(capability.raw, ["amountIn"])
      : undefined;
  const simulationOutcomeAmount =
    simulation.availability === "AVAILABLE" &&
    simulation.outcomes.availability === "AVAILABLE"
      ? rawPath(simulation.outcomes.items[0]?.raw, ["amountIn"])
      : undefined;
  const simulationTokenOut =
    simulation.availability === "AVAILABLE" &&
    simulation.outcomes.availability === "AVAILABLE"
      ? rawPath(simulation.outcomes.items[0]?.raw, ["tokenOut"])
      : undefined;

  return [
    {
      key: "intent",
      title: "User request",
      description: "Exact values submitted for this run",
      items: [
        item("Input asset", assetLabel(intent.inputAsset), [
          "/intent/inputAsset",
        ]),
        item("Output asset", assetLabel(intent.outputAsset), [
          "/intent/outputAsset",
        ]),
        item("Amount in", intent.inputAmount, ["/intent/inputAmount"]),
        item("Recipient", intent.recipient ?? "account default", [
          "/intent/recipient",
        ]),
        item("Slippage", `${intent.maxSlippageBps} bps`, [
          "/intent/maxSlippageBps",
        ]),
      ],
    },
    {
      key: "prepared",
      title: "Agent prepared",
      description: "Selection and Capability records returned by API",
      items: [
        item(
          "Selection",
          quote === undefined
            ? "No quote selected"
            : `${quote.protocolId} / ${quote.quoteId}`,
          selection.reason.sourceReferences,
        ),
        item(
          "Amount in",
          capabilityRawAmount ?? quote?.inputAmount ?? "not present",
          capabilityRawAmount !== undefined
            ? ["/capability/raw/amountIn"]
            : [`${quoteReference}/inputAmount`],
        ),
        item(
          "Output asset",
          quote === undefined ? "not present" : assetLabel(quote.outputAsset),
          [`${quoteReference}/outputAsset`],
        ),
        item("Capability", capability.availability, [
          "/capability/availability",
        ]),
      ],
    },
    {
      key: "simulation",
      title: "Simulation occurred",
      description: "Receipts, outcomes and warnings as returned",
      items: [
        item(
          "Execution",
          simulation.availability === "AVAILABLE"
            ? simulation.executionStatus
            : simulation.availability,
          ["/simulation/availability"],
        ),
        item(
          "Amount in observed",
          simulationOutcomeAmount ?? "not present",
          simulationOutcomeAmount === undefined
            ? ["/simulation/outcomes"]
            : ["/simulation/outcomes/items/0/raw/amountIn"],
        ),
        item(
          "Token out observed",
          simulationTokenOut ?? "not present",
          simulationTokenOut === undefined
            ? ["/simulation/outcomes"]
            : ["/simulation/outcomes/items/0/raw/tokenOut"],
        ),
        item(
          "Receipts / outcomes",
          simulation.availability !== "AVAILABLE"
            ? simulation.availability
            : `${simulation.receipts.availability} / ${simulation.outcomes.availability}`,
          ["/simulation/receipts", "/simulation/outcomes"],
        ),
        item(
          "Warnings",
          simulation.availability !== "AVAILABLE"
            ? simulation.availability
            : simulation.warnings.availability === "AVAILABLE"
              ? `${simulation.warnings.items.length} present`
              : simulation.warnings.availability,
          ["/simulation/warnings"],
        ),
      ],
    },
  ];
}
