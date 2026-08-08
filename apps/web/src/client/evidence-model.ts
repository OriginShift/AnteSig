import type {
  Capability,
  Limitation,
  Simulation,
} from "@moss-mini-demo/report-schema";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const parsed = record(entry);
        return parsed === undefined ? [] : [parsed];
      })
    : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function index(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function nested(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const segment of path) {
    const parsed = record(current);
    if (parsed === undefined) return undefined;
    current = parsed[segment];
  }
  return current;
}

export function serializeRawArtifact(artifact: unknown): string {
  return JSON.stringify(artifact, null, 2);
}

export type CapabilityRiskLabel = Readonly<{
  label: string;
  sourceReference: string;
}>;

export type CapabilityNodeModel = Readonly<{
  kind: "CAPABILITY" | "TRANSACTION" | "UNKNOWN";
  role:
    | "CAPABILITY"
    | "APPROVAL"
    | "TRANSACTION"
    | "APPROVAL_TRANSACTION"
    | "UNKNOWN";
  sourceReference: string;
  protocol?: string;
  method?: string;
  transactionIndex?: number;
  from?: string;
  to?: string;
  value?: string;
  children: readonly CapabilityNodeModel[];
}>;

export type CapabilityInspectorModel = Readonly<{
  availability: Capability["availability"];
  sourceReference: string;
  root?: CapabilityNodeModel;
  riskLabels: readonly CapabilityRiskLabel[];
  limitations: readonly Limitation[];
  failureCode?: string;
  failureSourceReferences: readonly string[];
}>;

type CapabilityTraversal = {
  transactionIndex: number;
};

function capabilityNode(
  value: JsonRecord,
  sourceReference: string,
  inherited: Readonly<{ protocol?: string; method?: string }>,
  traversal: CapabilityTraversal,
): CapabilityNodeModel {
  const nodeKind = text(value.kind);
  const protocol = text(value.protocol) ?? inherited.protocol;
  const method = text(value.method) ?? inherited.method;
  const children = records(value.children);

  if (nodeKind === "transaction") {
    const transaction = record(value.transaction);
    const transactionIndex = traversal.transactionIndex++;
    return {
      kind: "TRANSACTION",
      role: method === "approve" ? "APPROVAL_TRANSACTION" : "TRANSACTION",
      sourceReference,
      protocol,
      method,
      transactionIndex,
      from: text(transaction?.from),
      to: text(transaction?.to),
      value: text(transaction?.value),
      children: children.map((child, childIndex) =>
        capabilityNode(
          child,
          `${sourceReference}/children/${childIndex}`,
          { protocol, method },
          traversal,
        ),
      ),
    };
  }

  const kind = nodeKind === "capability" ? "CAPABILITY" : "UNKNOWN";
  return {
    kind,
    role:
      kind === "CAPABILITY"
        ? method === "approve"
          ? "APPROVAL"
          : "CAPABILITY"
        : "UNKNOWN",
    sourceReference,
    protocol,
    method,
    children: children.map((child, childIndex) =>
      capabilityNode(
        child,
        `${sourceReference}/children/${childIndex}`,
        { protocol, method },
        traversal,
      ),
    ),
  };
}

function riskLabels(raw: unknown): CapabilityRiskLabel[] {
  const sources = [
    {
      value: nested(raw, ["operation", "mossOriginal", "riskLabels"]),
      pointer: "/capability/raw/operation/mossOriginal/riskLabels",
    },
    {
      value: nested(raw, ["operation", "miniDemoDerived", "riskLabels"]),
      pointer: "/capability/raw/operation/miniDemoDerived/riskLabels",
    },
  ];
  return sources.flatMap(({ value, pointer }) =>
    Array.isArray(value)
      ? value.flatMap((entry, entryIndex) =>
          typeof entry === "string"
            ? [{ label: entry, sourceReference: `${pointer}/${entryIndex}` }]
            : [],
        )
      : [],
  );
}

export function capabilityInspectorModel(
  capability: Capability,
  limitations: readonly Limitation[],
): CapabilityInspectorModel {
  if (capability.availability !== "AVAILABLE") {
    return {
      availability: capability.availability,
      sourceReference: "/capability",
      riskLabels: [],
      limitations,
      failureCode: capability.failure.code,
      failureSourceReferences: capability.failure.sourceReferences,
    };
  }

  const rootValue =
    record(nested(capability.raw, ["mossOriginal", "value"])) ??
    (record(capability.raw)?.kind === "capability"
      ? record(capability.raw)
      : undefined);
  const sourceReference = nested(capability.raw, ["mossOriginal", "value"])
    ? "/capability/raw/mossOriginal/value"
    : "/capability/raw";

  return {
    availability: "AVAILABLE",
    sourceReference,
    ...(rootValue === undefined
      ? {}
      : {
          root: capabilityNode(
            rootValue,
            sourceReference,
            {},
            { transactionIndex: 0 },
          ),
        }),
    riskLabels: riskLabels(capability.raw),
    limitations,
    failureSourceReferences: [],
  };
}

export function flattenCapabilityNodes(
  root: CapabilityNodeModel | undefined,
): readonly CapabilityNodeModel[] {
  if (root === undefined) return [];
  return [
    root,
    ...root.children.flatMap((child) => flattenCapabilityNodes(child)),
  ];
}

export type TimelineArtifact = Readonly<{
  status?: string;
  raw: unknown;
  sourceReference: string;
}>;

export type TimelineWarning = Readonly<{
  code: string;
  message: string;
  raw: unknown;
  sourceReference: string;
}>;

export type EvidenceTransaction = Readonly<{
  transactionIndex: number;
  protocol?: string;
  method?: string;
  from?: string;
  to?: string;
  value?: string;
  transactionSourceReference?: string;
  receipts: readonly TimelineArtifact[];
  outcomes: readonly TimelineArtifact[];
  warnings: readonly TimelineWarning[];
  gas: readonly Readonly<{
    value: string | null;
    sourceReference: string;
  }>[];
}>;

export type EvidenceStatus = Readonly<{
  label: "Coverage" | "Ordering" | "State continuity";
  availability: string;
  value: string;
  sourceReference: string;
}>;

export type EvidenceTimelineModel = Readonly<{
  availability: Simulation["availability"];
  executionStatus?: string;
  transactions: readonly EvidenceTransaction[];
  statuses: readonly EvidenceStatus[];
  failureCode?: string;
  failureSourceReferences: readonly string[];
}>;

type MutableTransaction = {
  transactionIndex: number;
  protocol?: string;
  method?: string;
  from?: string;
  to?: string;
  value?: string;
  transactionSourceReference?: string;
  receipts: TimelineArtifact[];
  outcomes: TimelineArtifact[];
  warnings: TimelineWarning[];
  gas: { value: string | null; sourceReference: string }[];
};

function emptyTransaction(transactionIndex: number): MutableTransaction {
  return {
    transactionIndex,
    receipts: [],
    outcomes: [],
    warnings: [],
    gas: [],
  };
}

function itemStatus(value: unknown): string | undefined {
  const item = record(value);
  return text(item?.status) ?? text(record(item?.outcome)?.status);
}

function evidenceStatus(
  label: EvidenceStatus["label"],
  value: unknown,
  truthKey: "complete" | "valid" | "continuous",
  sourceReference: string,
): EvidenceStatus {
  const parsed = record(value);
  const availability = text(parsed?.availability) ?? "UNKNOWN";
  const truth = parsed?.[truthKey];
  return {
    label,
    availability,
    value:
      typeof truth === "boolean"
        ? truth
          ? "TRUE"
          : "FALSE"
        : (text(record(parsed?.raw)?.status) ?? "UNAVAILABLE"),
    sourceReference,
  };
}

export function evidenceTimelineModel(
  simulation: Simulation,
): EvidenceTimelineModel {
  if (simulation.availability !== "AVAILABLE") {
    return {
      availability: simulation.availability,
      transactions: [],
      statuses: [],
      failureCode: simulation.failure.code,
      failureSourceReferences: simulation.failure.sourceReferences,
    };
  }

  const mossOriginal = record(nested(simulation.raw, ["mossOriginal"]));
  const transactionMap = new Map<number, MutableTransaction>();
  const get = (transactionIndex: number) => {
    const existing = transactionMap.get(transactionIndex);
    if (existing !== undefined) return existing;
    const created = emptyTransaction(transactionIndex);
    transactionMap.set(transactionIndex, created);
    return created;
  };

  const rawTransactions = records(mossOriginal?.transactions);
  rawTransactions.forEach((entry, sourceIndex) => {
    const transactionIndex = index(entry.transactionIndex);
    if (transactionIndex === undefined) return;
    const transaction = record(entry.value);
    const target = get(transactionIndex);
    target.from = text(transaction?.from);
    target.to = text(transaction?.to);
    target.value = text(transaction?.value);
    target.transactionSourceReference = `/simulation/raw/mossOriginal/transactions/${sourceIndex}`;
  });

  const rawResults = records(nested(mossOriginal?.simulation, ["results"]));
  rawResults.forEach((result, transactionIndex) => {
    const target = get(transactionIndex);
    target.protocol = text(result.protocol);
    target.method = text(result.method);
  });

  records(mossOriginal?.receipts).forEach((entry, sourceIndex) => {
    const transactionIndex = index(entry.transactionIndex);
    if (transactionIndex === undefined) return;
    get(transactionIndex).receipts.push({
      status: itemStatus(entry.value),
      raw: entry.value,
      sourceReference: `/simulation/raw/mossOriginal/receipts/${sourceIndex}`,
    });
  });
  records(mossOriginal?.outcomes).forEach((entry, sourceIndex) => {
    const transactionIndex = index(entry.transactionIndex);
    if (transactionIndex === undefined) return;
    get(transactionIndex).outcomes.push({
      status: itemStatus(entry.value),
      raw: entry.value,
      sourceReference: `/simulation/raw/mossOriginal/outcomes/${sourceIndex}`,
    });
  });
  records(mossOriginal?.warnings).forEach((entry, sourceIndex) => {
    const transactionIndex = index(entry.transactionIndex);
    if (transactionIndex === undefined) return;
    get(transactionIndex).warnings.push({
      code: text(entry.code) ?? "UNKNOWN_WARNING",
      message: text(entry.message) ?? "",
      raw: entry.value,
      sourceReference: `/simulation/raw/mossOriginal/warnings/${sourceIndex}`,
    });
  });
  records(mossOriginal?.gas).forEach((entry, sourceIndex) => {
    const transactionIndex = index(entry.transactionIndex);
    if (transactionIndex === undefined) return;
    const value = entry.value;
    if (typeof value !== "string" && value !== null) return;
    get(transactionIndex).gas.push({
      value,
      sourceReference: `/simulation/raw/mossOriginal/gas/${sourceIndex}`,
    });
  });

  if (transactionMap.size === 0) {
    if (simulation.receipts.availability === "AVAILABLE") {
      simulation.receipts.items.forEach((receipt, transactionIndex) => {
        get(transactionIndex).receipts.push({
          status: receipt.status,
          raw: receipt.raw,
          sourceReference: `/simulation/receipts/items/${transactionIndex}`,
        });
      });
    }
    if (simulation.outcomes.availability === "AVAILABLE") {
      simulation.outcomes.items.forEach((outcome, transactionIndex) => {
        get(transactionIndex).outcomes.push({
          status: outcome.status,
          raw: outcome.raw,
          sourceReference: `/simulation/outcomes/items/${transactionIndex}`,
        });
      });
    }
    if (simulation.warnings.availability === "AVAILABLE") {
      simulation.warnings.items.forEach((warning, transactionIndex) => {
        const parsed = record(warning);
        get(transactionIndex).warnings.push({
          code: text(parsed?.code) ?? "UNKNOWN_WARNING",
          message: text(parsed?.message) ?? "",
          raw: warning,
          sourceReference: `/simulation/warnings/items/${transactionIndex}`,
        });
      });
    }
  }

  return {
    availability: "AVAILABLE",
    executionStatus: simulation.executionStatus,
    transactions: [...transactionMap.values()].sort(
      (left, right) => left.transactionIndex - right.transactionIndex,
    ),
    statuses: [
      evidenceStatus(
        "Coverage",
        simulation.coverage,
        "complete",
        "/simulation/coverage",
      ),
      evidenceStatus(
        "Ordering",
        simulation.ordering,
        "valid",
        "/simulation/ordering",
      ),
      evidenceStatus(
        "State continuity",
        simulation.stateContinuity,
        "continuous",
        "/simulation/stateContinuity",
      ),
    ],
    failureSourceReferences: [],
  };
}
