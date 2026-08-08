import type { Provenance } from "@moss-mini-demo/report-schema";
import type { WorkbenchMode } from "../client/run-controls";

type ProvenanceBadgeProps = Readonly<{
  mode: WorkbenchMode;
  fixtureLoaded: boolean;
  provenance?: Provenance;
}>;

export function ProvenanceBadge({
  mode,
  fixtureLoaded,
  provenance,
}: ProvenanceBadgeProps) {
  const value =
    provenance ??
    (mode === "LIVE"
      ? "LIVE SOURCE / LOCAL FORK"
      : fixtureLoaded
        ? "FIXTURE REQUEST"
        : "FIXTURE NOT LOADED");

  return (
    <span
      className={`provenance-badge ${provenance ? "observed" : "requested"}`}
    >
      <span className="provenance-label">
        {provenance ? "Response source" : "Request source"}
      </span>
      <strong className="provenance-value">{value}</strong>
    </span>
  );
}
