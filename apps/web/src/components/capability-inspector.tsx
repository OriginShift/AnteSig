import type {
  Capability,
  Limitation,
  Provenance,
} from "@moss-mini-demo/report-schema";
import {
  type CapabilityNodeModel,
  capabilityInspectorModel,
  provenanceBoundRawArtifact,
} from "../client/evidence-model";
import { RawEvidenceDrawer } from "./raw-evidence-drawer";

const RAW_TRIGGER_ID = "capability-raw-trigger";

type SourceReferencesProps = Readonly<{
  references: readonly string[];
}>;

function SourceReferences({ references }: SourceReferencesProps) {
  return (
    <span className="evidence-sources">
      {references.map((reference) => (
        <a href={`#${RAW_TRIGGER_ID}`} key={reference}>
          {reference}
        </a>
      ))}
    </span>
  );
}

function CapabilityNode({ node }: Readonly<{ node: CapabilityNodeModel }>) {
  return (
    <li className={`capability-node ${node.kind.toLowerCase()}`}>
      <div className="capability-node-row">
        <div className="node-identity">
          <span className={`node-role ${node.role.toLowerCase()}`}>
            {node.role.replace("_", " ")}
          </span>
          <strong>
            {node.kind === "TRANSACTION"
              ? `Transaction #${node.transactionIndex}`
              : (node.method ?? node.kind)}
          </strong>
          <a className="source-pointer" href={`#${RAW_TRIGGER_ID}`}>
            {node.sourceReference}
          </a>
        </div>
        <dl className="node-facts">
          <div>
            <dt>Protocol</dt>
            <dd>{node.protocol ?? "not present"}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{node.method ?? "not present"}</dd>
          </div>
          {node.kind === "TRANSACTION" ? (
            <>
              <div>
                <dt>From</dt>
                <dd>{node.from ?? "not present"}</dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>{node.to ?? "not present"}</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>{node.value ?? "not present"}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>
      {node.children.length > 0 ? (
        <ol className="capability-children">
          {node.children.map((child) => (
            <CapabilityNode key={child.sourceReference} node={child} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

type CapabilityInspectorProps = Readonly<{
  capability: Capability;
  limitations: readonly Limitation[];
  provenance: Provenance;
}>;

export function CapabilityInspector({
  capability,
  limitations,
  provenance,
}: CapabilityInspectorProps) {
  const model = capabilityInspectorModel(capability, limitations);

  return (
    <section
      className="evidence-section capability-inspector"
      aria-labelledby="capability-heading"
    >
      <div className="section-heading evidence-heading">
        <div>
          <h3 id="capability-heading">Capability inspector</h3>
          <p>Hierarchy and transaction order from API evidence</p>
        </div>
        <span
          className={`availability-badge ${model.availability.toLowerCase()}`}
        >
          {model.availability}
        </span>
      </div>

      {model.root ? (
        <ol className="capability-tree">
          <CapabilityNode node={model.root} />
        </ol>
      ) : model.availability === "AVAILABLE" ? (
        <div className="evidence-empty">
          <strong>Structured hierarchy not present</strong>
          <SourceReferences references={[model.sourceReference]} />
        </div>
      ) : (
        <div className="evidence-empty failed">
          <strong>{model.failureCode}</strong>
          <SourceReferences references={model.failureSourceReferences} />
        </div>
      )}

      <div className="evidence-metadata-grid">
        <section className="risk-labels" aria-labelledby="risk-labels-heading">
          <h4 id="risk-labels-heading">Risk labels</h4>
          {model.riskLabels.length > 0 ? (
            <ul>
              {model.riskLabels.map((risk) => (
                <li key={`${risk.sourceReference}:${risk.label}`}>
                  <strong>{risk.label}</strong>
                  <SourceReferences references={[risk.sourceReference]} />
                </li>
              ))}
            </ul>
          ) : (
            <p>None present in API evidence.</p>
          )}
        </section>

        <section
          className="evidence-limitations"
          aria-labelledby="limitations-heading"
        >
          <h4 id="limitations-heading">Limitations</h4>
          {model.limitations.length > 0 ? (
            <ul>
              {model.limitations.map((limitation) => (
                <li key={limitation.code}>
                  <strong>{limitation.code}</strong>
                  <p>{limitation.description}</p>
                  <SourceReferences references={limitation.sourceReferences} />
                </li>
              ))}
            </ul>
          ) : (
            <p>None present in API evidence.</p>
          )}
        </section>
      </div>

      <RawEvidenceDrawer
        artifact={provenanceBoundRawArtifact(
          provenance,
          "capability",
          capability,
        )}
        filename={`antesig-${provenance.toLowerCase()}-capability-evidence.json`}
        provenance={provenance}
        title="Capability evidence"
        triggerId={RAW_TRIGGER_ID}
      />
    </section>
  );
}
