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

export function ComparisonStrip(props: ComparisonStripInput) {
  const columns = comparisonColumns(props);
  return (
    <section className="comparison-strip" aria-labelledby="comparison-heading">
      <div className="section-heading">
        <div>
          <h3 id="comparison-heading">Three-way comparison</h3>
          <p>
            Request, prepared Capability and observed Simulation stay distinct
          </p>
        </div>
      </div>
      <div className="comparison-columns">
        {columns.map((column) => (
          <section
            className={`comparison-column ${column.key}`}
            key={column.key}
          >
            <header>
              <span className="comparison-column-index" aria-hidden="true">
                {column.key === "intent"
                  ? "1"
                  : column.key === "prepared"
                    ? "2"
                    : "3"}
              </span>
              <div>
                <h4>{column.title}</h4>
                <p>{column.description}</p>
              </div>
            </header>
            <dl>
              {column.items.map((entry) => (
                <div key={entry.label}>
                  <dt>{entry.label}</dt>
                  <dd>
                    <strong>{entry.value}</strong>
                    <SourceReferences references={entry.sourceReferences} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}
