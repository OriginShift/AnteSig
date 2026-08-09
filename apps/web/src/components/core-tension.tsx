import type { Provenance } from "@moss-mini-demo/report-schema";
import type { ComparisonStripInput } from "../client/comparison-strip";
import {
  coreTensionModel,
  formatNativeAmount,
  ratioLabel,
  tensionProvenanceLabel,
} from "../client/core-tension";

export function CoreTension({
  input,
  provenance,
}: Readonly<{
  input: ComparisonStripInput;
  provenance: Provenance;
}>) {
  const model = coreTensionModel(input);
  if (model === undefined) return null;

  return (
    <section className="core-tension" aria-labelledby="core-tension-heading">
      <div className="tension-success-panel">
        <span className="section-index" aria-hidden="true">
          02
        </span>
        <p className="chapter-title">Core tension</p>
        <h3 id="core-tension-heading">
          Simulation <span>Success</span>
        </h3>
        <dl className="tension-amounts">
          <div>
            <dt>Requested</dt>
            <dd>
              <strong>{formatNativeAmount(model.requested)}</strong>
              <small>{model.requested} base units</small>
            </dd>
          </div>
          <div>
            <dt>Prepared</dt>
            <dd>
              <strong>{formatNativeAmount(model.prepared)}</strong>
              <small>{model.prepared} base units</small>
            </dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>
              <strong>{formatNativeAmount(model.observed)}</strong>
              <small>{model.observed} base units</small>
            </dd>
          </div>
        </dl>
        <p className="tension-statement">Success is not authorization.</p>
        <span className="tension-provenance">
          {tensionProvenanceLabel(provenance)}
        </span>
      </div>

      <div className="tension-fail-panel">
        <span className="tension-fail-heading">Alignment · Fail</span>
        <strong className="tension-ratio">
          {ratioLabel(model.requested, model.observed)}
        </strong>
        <span className="tension-fail-code">AMOUNT IN MISMATCH</span>
      </div>
    </section>
  );
}
