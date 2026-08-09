import type { Provenance } from "@moss-mini-demo/report-schema";
import type { ComparisonStripInput } from "../client/comparison-strip";
import { comparisonColumns } from "../client/comparison-strip";

function SourceReferences({
  references,
}: Readonly<{ references: readonly string[] }>) {
  return (
    <span className="comparison-sources">
      {references.map((reference) => (
        <a href="#alignment-list" key={reference}>
          {reference}
        </a>
      ))}
    </span>
  );
}

function formattedAmount(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  const padded = value.padStart(19, "0");
  const whole = padded.slice(0, -18);
  const fraction = padded.slice(-18, -16);
  return `${BigInt(whole)}.${fraction}`;
}

function columnTitle(key: "intent" | "prepared" | "simulation"): string {
  if (key === "intent") return "User intent";
  if (key === "prepared") return "Agent prepared";
  return "Simulation observed";
}

export function ComparisonStrip({
  provenance,
  ...props
}: ComparisonStripInput & Readonly<{ provenance: Provenance }>) {
  const columns = comparisonColumns(props);
  return (
    <section className="comparison-strip" aria-labelledby="comparison-heading">
      <div className="section-heading">
        <span className="section-index" aria-hidden="true">
          03
        </span>
        <div>
          <h3 aria-label="Three-way comparison" id="comparison-heading">
            Source-bound values
          </h3>
          <p>
            Request, prepared Capability and observed Simulation stay distinct
          </p>
        </div>
      </div>
      <div className="comparison-columns">
        {columns.map((column) => {
          const amountLabel =
            column.key === "simulation" ? "Amount in observed" : "Amount in";
          const amount = column.items.find(
            (entry) => entry.label === amountLabel,
          );
          const detailItems = column.items.filter(
            (entry) => entry.label !== amountLabel,
          );

          return (
            <section
              className={`comparison-column ${column.key}`}
              key={column.key}
            >
              <header>
                <span className="comparison-column-index" aria-hidden="true">
                  {column.key === "intent"
                    ? "01"
                    : column.key === "prepared"
                      ? "02"
                      : "03"}
                </span>
                <div>
                  <h4>{columnTitle(column.key)}</h4>
                  <p>{column.description}</p>
                </div>
              </header>

              <div className="comparison-primary-value">
                <span className="comparison-primary-label">
                  {amount?.label ?? amountLabel}
                </span>
                <strong>
                  {amount === undefined
                    ? "not present"
                    : formattedAmount(amount.value)}
                </strong>
                <em className="comparison-primary-unit">NATIVE</em>
                {amount === undefined ? null : (
                  <SourceReferences references={amount.sourceReferences} />
                )}
              </div>

              <details className="comparison-details">
                <summary>Inspect source-bound fields</summary>
                <dl>
                  {detailItems.map((entry) => (
                    <div key={entry.label}>
                      <dt>{entry.label}</dt>
                      <dd>
                        <strong>{entry.value}</strong>
                        <SourceReferences references={entry.sourceReferences} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </section>
          );
        })}
      </div>
      <footer className="comparison-footer">
        <a href="#alignment-list">Trace source references →</a>
        <span className="comparison-provenance">Provenance · {provenance}</span>
      </footer>
    </section>
  );
}
