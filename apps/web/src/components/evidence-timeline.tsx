import type { Provenance, Simulation } from "@moss-mini-demo/report-schema";
import {
  evidenceTimelineModel,
  type TimelineArtifact,
} from "../client/evidence-model";
import { RawEvidenceDrawer } from "./raw-evidence-drawer";

const RAW_TRIGGER_ID = "simulation-raw-trigger";

function SourceReference({ reference }: Readonly<{ reference: string }>) {
  return (
    <a className="source-pointer" href={`#${RAW_TRIGGER_ID}`}>
      {reference}
    </a>
  );
}

function ArtifactList({
  artifacts,
  label,
}: Readonly<{
  artifacts: readonly TimelineArtifact[];
  label: "Receipts" | "Outcomes";
}>) {
  return (
    <section className="timeline-artifacts">
      <h5>{label}</h5>
      {artifacts.length > 0 ? (
        <ul>
          {artifacts.map((artifact) => (
            <li key={artifact.sourceReference}>
              <span
                className={`record-status ${(artifact.status ?? "unknown").toLowerCase()}`}
              >
                {artifact.status ?? "STATUS NOT PRESENT"}
              </span>
              <SourceReference reference={artifact.sourceReference} />
            </li>
          ))}
        </ul>
      ) : (
        <p>None present.</p>
      )}
    </section>
  );
}

export function EvidenceTimeline({
  provenance,
  simulation,
}: Readonly<{ provenance: Provenance; simulation: Simulation }>) {
  const model = evidenceTimelineModel(simulation);
  const receipts = model.transactions.flatMap(
    (transaction) => transaction.receipts,
  );
  const outcomes = model.transactions.flatMap(
    (transaction) => transaction.outcomes,
  );
  const warnings = model.transactions.flatMap(
    (transaction) => transaction.warnings,
  );
  const receiptStatus =
    receipts.length > 0 &&
    receipts.every((artifact) => artifact.status === "SUCCESS")
      ? "SUCCESS"
      : (receipts[0]?.status ?? "NOT PRESENT");
  const stages = [
    {
      label: "Coverage",
      value:
        model.statuses.find((status) => status.label === "Coverage")?.value ??
        model.availability,
    },
    {
      label: "Ordering",
      value:
        model.statuses.find((status) => status.label === "Ordering")?.value ??
        model.availability,
    },
    {
      label: "Continuity",
      value:
        model.statuses.find((status) => status.label === "State continuity")
          ?.value ?? model.availability,
    },
    {
      label: "Execution",
      value: model.executionStatus ?? model.availability,
    },
    { label: "Boundary", value: "NOT AUTHORIZATION" },
  ];

  return (
    <section
      className="evidence-section evidence-timeline"
      aria-labelledby="timeline-heading"
    >
      <div className="section-heading evidence-heading">
        <span className="section-index" aria-hidden="true">
          05
        </span>
        <div>
          <h3 id="timeline-heading">Simulation evidence</h3>
          <p>Indexed records in API evidence order</p>
        </div>
        <div className="evidence-status-badges">
          <span
            className={`availability-badge ${model.availability.toLowerCase()}`}
          >
            {model.availability}
          </span>
          {model.executionStatus ? (
            <span
              className={`execution-badge ${model.executionStatus.toLowerCase()}`}
            >
              {model.executionStatus}
            </span>
          ) : null}
        </div>
      </div>

      <ol className="simulation-stage-rail" aria-label="Evidence sequence">
        {stages.map((stage, index) => (
          <li
            className={index === stages.length - 1 ? "boundary" : ""}
            key={stage.label}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{stage.label}</strong>
            <small>{stage.value}</small>
          </li>
        ))}
      </ol>

      {model.transactions.length > 0 ? (
        <>
          <div className="simulation-summary-board">
            <section className="simulation-receipt-sheet">
              <header>
                <span>Receipt ledger</span>
                <strong>
                  {String(receipts.length).padStart(2, "0")} records
                </strong>
              </header>
              {model.statuses.length > 0 ? (
                <dl className="simulation-verification-statuses verification-statuses">
                  {model.statuses.map((status) => (
                    <div key={status.label}>
                      <dt>{status.label}</dt>
                      <dd>
                        <strong>{status.value}</strong>
                        <span>{status.availability}</span>
                        <SourceReference reference={status.sourceReference} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div className="simulation-sheet-footer">
                <span>Warnings · {warnings.length}</span>
                <strong
                  className={`record-status ${receiptStatus.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {receiptStatus}
                </strong>
              </div>
            </section>

            <div className="simulation-outcome-stack">
              <section className="simulation-outcome-sheet">
                <span className="simulation-outcome-label">
                  Outcome ledger · {String(outcomes.length).padStart(2, "0")}{" "}
                  records
                </span>
                <strong>
                  Execution · {model.executionStatus ?? model.availability}
                </strong>
                <p className="simulation-outcome-copy">
                  Observed execution evidence does not grant authorization.
                </p>
              </section>
              <p className="simulation-boundary-note">
                <strong>Success is not permission to sign</strong>
                <span className="simulation-boundary-provenance">
                  {provenance}
                </span>
              </p>
            </div>
          </div>

          <details className="timeline-inspector">
            <summary>
              Inspect indexed transaction records
              <span>{model.transactions.length}</span>
            </summary>
            <ol className="timeline-inspector-list timeline-list">
              {model.transactions.map((transaction) => (
                <li
                  className="timeline-entry"
                  key={transaction.transactionIndex}
                >
                  <div className="timeline-index" aria-hidden="true">
                    {transaction.transactionIndex}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-title">
                      <div>
                        <span className="timeline-type">
                          Transaction #{transaction.transactionIndex}
                        </span>
                        <strong>
                          {transaction.protocol ?? "Protocol not present"} ·{" "}
                          {transaction.method ?? "Method not present"}
                        </strong>
                      </div>
                      {transaction.transactionSourceReference ? (
                        <SourceReference
                          reference={transaction.transactionSourceReference}
                        />
                      ) : null}
                    </div>

                    <dl className="timeline-transaction-facts">
                      <div>
                        <dt>From</dt>
                        <dd>{transaction.from ?? "not present"}</dd>
                      </div>
                      <div>
                        <dt>To</dt>
                        <dd>{transaction.to ?? "not present"}</dd>
                      </div>
                      <div>
                        <dt>Value</dt>
                        <dd>{transaction.value ?? "not present"}</dd>
                      </div>
                      <div>
                        <dt>Gas</dt>
                        <dd>
                          {transaction.gas.length > 0
                            ? transaction.gas.map((gas) => (
                                <span
                                  className="gas-record"
                                  key={gas.sourceReference}
                                >
                                  {gas.value ?? "null"}
                                  <SourceReference
                                    reference={gas.sourceReference}
                                  />
                                </span>
                              ))
                            : "not present"}
                        </dd>
                      </div>
                    </dl>

                    <div className="timeline-record-grid">
                      <ArtifactList
                        artifacts={transaction.receipts}
                        label="Receipts"
                      />
                      <ArtifactList
                        artifacts={transaction.outcomes}
                        label="Outcomes"
                      />
                    </div>

                    <section className="timeline-warnings">
                      <h5>Warnings</h5>
                      {transaction.warnings.length > 0 ? (
                        <ul>
                          {transaction.warnings.map((warning) => (
                            <li key={warning.sourceReference}>
                              <strong>{warning.code}</strong>
                              <p>{warning.message}</p>
                              <SourceReference
                                reference={warning.sourceReference}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>None present.</p>
                      )}
                    </section>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : (
        <div
          className={`evidence-empty ${model.availability === "AVAILABLE" ? "" : "failed"}`}
        >
          <strong>
            {model.failureCode ?? "No indexed transaction evidence present"}
          </strong>
          {model.failureSourceReferences.map((reference) => (
            <SourceReference key={reference} reference={reference} />
          ))}
        </div>
      )}

      <RawEvidenceDrawer
        artifact={simulation}
        filename="simulation-evidence.json"
        title="Simulation evidence"
        triggerId={RAW_TRIGGER_ID}
      />
    </section>
  );
}
