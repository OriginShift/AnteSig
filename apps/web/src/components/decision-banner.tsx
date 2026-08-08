import type { Limitation } from "@moss-mini-demo/report-schema";
import { decisionBannerModel } from "../client/decision-banner";
import type { PreflightPresentation } from "../contracts/preflight";

export function DecisionBanner({
  presentation,
  limitations,
}: Readonly<{
  presentation: PreflightPresentation;
  limitations: readonly Limitation[];
}>) {
  const model = decisionBannerModel(presentation, limitations);
  const isStop = model.status === "STOP";
  return (
    <section
      aria-labelledby="decision-heading"
      className={`decision-banner ${isStop ? "stop" : "manual-review"}`}
    >
      <span className="decision-icon" aria-hidden="true">
        {isStop ? "!" : "?"}
      </span>
      <div className="decision-copy">
        <strong id="decision-heading">{model.heading}</strong>
        <p>{model.message}</p>
        {model.actionBoundary ? (
          <span className="action-boundary">
            Action boundary: {model.actionBoundary}
          </span>
        ) : null}
        {model.limitations.length > 0 ? (
          <ul className="decision-limitations">
            {model.limitations.map((limitation) => (
              <li key={limitation.code}>
                <strong>{limitation.code}</strong>
                <span>{limitation.description}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className="decision-value">{model.status}</span>
    </section>
  );
}
