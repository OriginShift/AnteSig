import type { AlignmentCheck } from "@moss-mini-demo/report-schema";

function SourceReferences({
  references,
}: Readonly<{ references: readonly string[] }>) {
  return (
    <span className="alignment-sources">
      {references.map((reference) => (
        <a href="#alignment-list" key={reference}>
          {reference}
        </a>
      ))}
    </span>
  );
}

export function AlignmentList({
  checks,
}: Readonly<{ checks: readonly AlignmentCheck[] }>) {
  return (
    <section
      className="alignment-list"
      id="alignment-list"
      aria-labelledby="alignment-heading"
    >
      <div className="section-heading">
        <div>
          <h3 id="alignment-heading">Alignment</h3>
          <p>Server-evaluated checks in canonical API order</p>
        </div>
        <span className="alignment-count">{checks.length}</span>
      </div>
      <ol>
        {checks.map((check) => (
          <li
            className={`alignment-check ${check.status.toLowerCase()}`}
            key={check.checkId}
          >
            <div className="alignment-check-heading">
              <span className="alignment-icon" aria-hidden="true">
                {check.status === "PASS"
                  ? "✓"
                  : check.status === "FAIL"
                    ? "!"
                    : "?"}
              </span>
              <strong>{check.checkId}</strong>
              <span className="alignment-status">{check.status}</span>
              {check.critical ? (
                <span className="critical-label">Critical</span>
              ) : null}
            </div>
            <SourceReferences references={check.sourceReferences} />
          </li>
        ))}
      </ol>
    </section>
  );
}
