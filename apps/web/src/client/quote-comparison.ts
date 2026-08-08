import type { Asset, Quote, Selection } from "@moss-mini-demo/report-schema";

export type QuoteComparisonRow = Readonly<{
  quoteId: string;
  protocolId: string;
  status: "SUCCESS" | "FAILED";
  inputAsset: string;
  outputAsset: string;
  inputAmount: string;
  outcomeLabel: "Amount out" | "Failure";
  outcomeValue: string;
  sourceReferences: readonly string[];
}>;

function assetAddress(asset: Asset): string {
  return asset.kind === "NATIVE" ? "NATIVE (no token address)" : asset.address;
}

export function quoteComparisonRows(
  quotes: readonly Quote[],
): readonly QuoteComparisonRow[] {
  return quotes.map((quote) => ({
    quoteId: quote.quoteId,
    protocolId: quote.protocolId,
    status: quote.status,
    inputAsset: assetAddress(quote.inputAsset),
    outputAsset: assetAddress(quote.outputAsset),
    inputAmount: quote.inputAmount,
    outcomeLabel: quote.status === "SUCCESS" ? "Amount out" : "Failure",
    outcomeValue:
      quote.status === "SUCCESS" ? quote.outputAmount : quote.failure.code,
    sourceReferences:
      quote.status === "SUCCESS" ? [] : quote.failure.sourceReferences,
  }));
}

export function selectionSummary(selection: Selection): string {
  return selection.status === "SELECTED"
    ? `Selected ${selection.protocolId} / ${selection.quoteId}`
    : "No quote selected";
}
