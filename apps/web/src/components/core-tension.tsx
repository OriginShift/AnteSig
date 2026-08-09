import type { ComparisonStripInput } from "../client/comparison-strip";
import { comparisonColumns } from "../client/comparison-strip";

function amountValue(
  input: ComparisonStripInput,
  columnKey: "intent" | "prepared" | "simulation",
  label: "Amount in" | "Amount in observed",
): string {
  const column = comparisonColumns(input).find(
    (candidate) => candidate.key === columnKey,
  );
  return (
    column?.items.find((item) => item.label === label)?.value ?? "not present"
  );
}

function formatNativeAmount(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  const padded = value.padStart(19, "0");
  const whole = padded.slice(0, -18);
  const fraction = padded.slice(-18, -16);
  return `${BigInt(whole)}.${fraction} NATIVE`;
}

function ratioLabel(requested: string, observed: string): string {
  if (!/^\d+$/.test(requested) || !/^\d+$/.test(observed)) return "≠";
  const requestedAmount = BigInt(requested);
  const observedAmount = BigInt(observed);
  if (requestedAmount === 0n || observedAmount % requestedAmount !== 0n) {
    return "≠";
  }
  return `${observedAmount / requestedAmount}×`;
}

export function CoreTension({
  input,
  show,
}: Readonly<{
  input: ComparisonStripInput;
  show: boolean;
}>) {
  if (!show) return null;

  const requested = amountValue(input, "intent", "Amount in");
  const prepared = amountValue(input, "prepared", "Amount in");
  const observed = amountValue(input, "simulation", "Amount in observed");

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
              <strong>{formatNativeAmount(requested)}</strong>
              <small>{requested}</small>
            </dd>
          </div>
          <div>
            <dt>Prepared</dt>
            <dd>
              <strong>{formatNativeAmount(prepared)}</strong>
              <small>{prepared}</small>
            </dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>
              <strong>{formatNativeAmount(observed)}</strong>
              <small>{observed}</small>
            </dd>
          </div>
        </dl>
        <p className="tension-statement">Success is not authorization.</p>
        <span className="tension-provenance">FIXTURE / SOURCE-BOUND</span>
      </div>

      <div className="tension-fail-panel">
        <span className="tension-fail-heading">Alignment · Fail</span>
        <strong className="tension-ratio">
          {ratioLabel(requested, observed)}
        </strong>
        <span className="tension-fail-code">AMOUNT IN MISMATCH</span>
      </div>
    </section>
  );
}
