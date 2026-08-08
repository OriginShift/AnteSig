import type { Simulation } from "@moss-mini-demo/report-schema";
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
  simulation,
}: Readonly<{ simulation: Simulation }>) {
  const model = evidenceTimelineModel(simulation);

  return (
    <section
      className="evidence-section evidence-timeline"
      aria-labelledby="timeline-heading"
    >
      <div className="section-heading evidence-heading">
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

      {model.statuses.length > 0 ? (
        <dl className="verification-statuses">
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

      {model.transactions.length > 0 ? (
        <ol className="timeline-list">
          {model.transactions.map((transaction) => (
            <li className="timeline-entry" key={transaction.transactionIndex}>
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
