import type { Provenance } from "@moss-mini-demo/report-schema";
import type { PreflightPresentation } from "../contracts/preflight";

function SourceReferences({
  references,
}: Readonly<{ references: readonly string[] }>) {
  return (
    <span className="stop-sources">
      {references.map((reference) => (
        <a href="#alignment-list" key={reference}>
          {reference}
        </a>
      ))}
    </span>
  );
}

export function StopDetails({
  presentation,
  provenance,
}: Readonly<{
  presentation: PreflightPresentation;
  provenance: Provenance;
}>) {
  if (presentation.decision.status !== "STOP") return null;
  return (
    <section className="stop-details" aria-labelledby="stop-details-heading">
      <div className="section-heading">
        <span className="section-index" aria-hidden="true">
          06
        </span>
        <div>
          <h3 id="stop-details-heading">Why STOP</h3>
          <p>Exact reason codes and source references from the API Decision</p>
        </div>
        <span className="stop-reason-count">
          {presentation.decision.reasons.length}
        </span>
      </div>
      <div className="stop-boundary-strip">
        <span>Action boundary</span>
        <strong>{presentation.decision.actionBoundary}</strong>
        <span>Provenance</span>
        <strong>{provenance}</strong>
      </div>
      <ol>
        {presentation.decision.reasons.map((reason) => (
          <li key={`${reason.code}:${reason.sourceReferences.join(",")}`}>
            <div className="stop-reason-heading">
              <strong>{reason.code}</strong>
              <span className="stop-reason-icon" aria-hidden="true">
                !
              </span>
            </div>
            <p>{reason.explanation}</p>
            <SourceReferences references={reason.sourceReferences} />
          </li>
        ))}
      </ol>
    </section>
  );
}
