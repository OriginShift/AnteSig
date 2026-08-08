import type { Quote, Selection } from "@moss-mini-demo/report-schema";
import {
  quoteComparisonRows,
  selectionSummary,
} from "../client/quote-comparison";

type QuoteComparisonProps = Readonly<{
  quotes: readonly Quote[];
  selection: Selection;
}>;

export function QuoteComparison({ quotes, selection }: QuoteComparisonProps) {
  const rows = quoteComparisonRows(quotes);
  return (
    <section className="quote-comparison" aria-labelledby="quotes-heading">
      <div className="section-heading">
        <div>
          <h3 id="quotes-heading">Protocol quotes</h3>
          <p>Each protocol result is shown independently.</p>
        </div>
        <span className="quote-count">{rows.length}</span>
      </div>

      <div className="quote-list">
        {rows.map((quote) => (
          <article
            className={`quote-row ${quote.status.toLowerCase()}`}
            key={quote.quoteId}
          >
            <div className="quote-title">
              <div>
                <strong className="quote-protocol">{quote.protocolId}</strong>
                <span>{quote.quoteId}</span>
              </div>
              <span className="quote-status">{quote.status}</span>
            </div>
            <dl className="quote-facts">
              <div>
                <dt>Input asset</dt>
                <dd>{quote.inputAsset}</dd>
              </div>
              <div>
                <dt>Output token</dt>
                <dd>{quote.outputAsset}</dd>
              </div>
              <div>
                <dt>Amount in</dt>
                <dd>{quote.inputAmount}</dd>
              </div>
              <div>
                <dt>{quote.outcomeLabel}</dt>
                <dd>{quote.outcomeValue}</dd>
              </div>
            </dl>
            {quote.status === "FAILED" ? (
              <p className="source-reference-line">
                Sources: {quote.sourceReferences.join(", ") || "none"}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="selection-rule">
        <span className="field-label">Selection rule</span>
        <strong className="selection-code">{selection.reason.code}</strong>
        <p>{selectionSummary(selection)}</p>
        <small>
          Sources: {selection.reason.sourceReferences.join(", ") || "none"}
        </small>
      </div>
    </section>
  );
}
