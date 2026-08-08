import type {
  Asset,
  EvmAddress,
  ProtocolId,
} from "@moss-mini-demo/report-schema";

export type ChainId143 = 143;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type RawCapability = Readonly<{
  [key: string]: JsonValue;
}>;

export type MossBuildInfo = Readonly<{
  sourceMode: "OFFICIAL_RELEASE" | "INTEGRATION_FORK";
  upstreamRepository: string;
  upstreamCommit: string;
  integrationRepository?: string;
  integrationCommit?: string;
  patchsetDigest?: `sha256:${string}`;
  packages: Readonly<Record<string, string>>;
  officialRelease: boolean;
}>;

export type MossOriginalSource = Readonly<{
  layer: "MOSS_ORIGINAL";
  provenance: "PINNED_SUBMODULE" | "SYNTHETIC_FAKE";
  buildInfo: MossBuildInfo;
}>;

export type MiniDemoDerivedSource = Readonly<{
  layer: "MINI_DEMO_DERIVED";
  ruleVersion: "moss-adapter-boundary-v0.1";
}>;

export type QuoteInput = Readonly<{
  method: string;
  account: string;
  params: JsonValue;
}>;

export type QuoteRequestOptionsV0_1 = Readonly<{
  signal?: AbortSignal;
}>;

export type ActionInput = Readonly<{
  method: string;
  account: string;
  params: JsonValue;
}>;

export type MossRpcRequestV0_1 = Readonly<{
  method: string;
  params?: readonly unknown[];
}>;

export interface MossSimulationRpcClientV0_1 {
  request(request: MossRpcRequestV0_1): Promise<unknown>;
}

export type MossLoadedOperation = Readonly<{
  protocolId: string;
  method: string;
  operationKind: "CAPABILITY" | "QUERY";
  stub: Readonly<{ [key: string]: JsonValue }>;
  riskLabels: readonly string[];
}>;

export interface MossSourceBindings {
  readonly chainId: unknown;
  readonly simulationRpcClient: MossSimulationRpcClientV0_1;
  buildInfo(): MossBuildInfo;
  describe(protocolId: string, method: string): Promise<MossLoadedOperation>;
  quote(
    protocolId: string,
    input: QuoteInput,
    options?: QuoteRequestOptionsV0_1,
  ): Promise<
    Readonly<{
      operation: MossLoadedOperation;
      quote: JsonValue;
    }>
  >;
  action(
    protocolId: string,
    input: ActionInput,
  ): Promise<
    Readonly<{
      operation: MossLoadedOperation;
      capability: RawCapability;
    }>
  >;
  simulate(
    capability: RawCapability,
    rpcClient: MossSimulationRpcClientV0_1,
  ): Promise<
    Readonly<{
      protocolId: string;
      method: string;
      simulation: JsonValue;
    }>
  >;
}

export type RawOperationContract = Readonly<{
  chainId: ChainId143;
  protocolId: string;
  method: string;
  buildInfo: MossBuildInfo;
  mossOriginal: Readonly<{
    source: MossOriginalSource;
    protocolId: string;
    method: string;
    stub: JsonValue;
    riskLabels: readonly string[];
  }>;
  miniDemoDerived: Readonly<{
    source: MiniDemoDerivedSource;
    protocolId: string;
    method: string;
    operationKind: "CAPABILITY" | "QUERY";
    riskLabels: readonly string[];
  }>;
}>;

export type RawQuote = Readonly<{
  operation: RawOperationContract;
  mossOriginal: Readonly<{
    source: MossOriginalSource;
    value: JsonValue;
  }>;
  miniDemoDerived: Readonly<{
    source: MiniDemoDerivedSource;
    normalizationStatus: "NOT_NORMALIZED";
    reason: "DEFERRED_TO_M2_05";
  }>;
}>;

export type QuoteAssetV0_1 = Asset;

export type DecimalsRecordV0_1 =
  | Readonly<{ status: "KNOWN"; value: number }>
  | Readonly<{ status: "UNKNOWN" }>;

export type AssetCatalogEntryV0_1 = Readonly<{
  asset: QuoteAssetV0_1;
  decimals: DecimalsRecordV0_1;
}>;

export type AssetCatalogV0_1 = Readonly<{
  schemaVersion: "0.1";
  catalogId: string;
  sourceVersion: string;
  provenance: "SERVER_CONFIGURED" | "SYNTHETIC_TEST";
  sourceReference: string;
  chainId: ChainId143;
  validFrom: string;
  validUntil: string;
  entries: readonly AssetCatalogEntryV0_1[];
}>;

export type AssetCatalogSnapshotV0_1 = Readonly<{
  schemaVersion: "0.1";
  catalogId: string;
  sourceVersion: string;
  provenance: "SERVER_CONFIGURED" | "SYNTHETIC_TEST";
  sourceReference: string;
  chainId: ChainId143;
  validFrom: string;
  validUntil: string;
  entries: readonly AssetCatalogEntryV0_1[];
  digest: `sha256:${string}`;
}>;

export type QuoteCollectionRequestV0_1 = Readonly<{
  chainId: ChainId143;
  candidateProtocols: readonly ProtocolId[];
  allowedProtocols: readonly ProtocolId[];
  quoteInput: Readonly<{
    method: string;
    account: EvmAddress;
    params: Readonly<{
      inputAsset: QuoteAssetV0_1;
      outputAsset: QuoteAssetV0_1;
      amountIn: string;
      readonly [additionalKey: string]: JsonValue;
    }>;
  }>;
  inputAsset: QuoteAssetV0_1;
  outputAsset: QuoteAssetV0_1;
  amountIn: string;
}>;

export type QuoteRawProjectionV0_1 = Readonly<{
  chainId: ChainId143;
  inputAsset: QuoteAssetV0_1;
  outputAsset: QuoteAssetV0_1;
  amountIn: string;
  amountOut: string;
  observableBlockWindow: Readonly<{
    fromBlock: string;
    toBlock: string;
  }>;
}>;

export type QuoteTimingV0_1 = Readonly<{
  observedAt: string;
  monotonicNs: string;
  clock: "NODE_PROCESS_HRTIME_V0_1";
}>;

export type RawQuoteRetentionV0_1 =
  | Readonly<{
      status: "SNAPSHOTTED";
      source: RawQuote;
      snapshot: RawQuote["mossOriginal"]["value"];
    }>
  | Readonly<{
      status: "UNSNAPSHOTTABLE";
      source: RawQuote;
    }>;

export type NormalizedQuoteV0_1 = Readonly<{
  chainId: ChainId143;
  protocolId: ProtocolId;
  method: string;
  account: EvmAddress;
  inputAsset: QuoteAssetV0_1;
  outputAsset: QuoteAssetV0_1;
  inputAmount: string;
  outputAmount: string;
  normalizedAmountOut: string;
  inputDecimals: number;
  outputDecimals: number;
  catalog: Readonly<{
    catalogId: string;
    sourceVersion: string;
    provenance: "SERVER_CONFIGURED" | "SYNTHETIC_TEST";
    sourceReference: string;
    digest: `sha256:${string}`;
  }>;
  observableBlockWindow: Readonly<{
    fromBlock: string;
    toBlock: string;
  }>;
  mossSource: Readonly<{
    provenance: "PINNED_SUBMODULE" | "SYNTHETIC_FAKE";
    upstreamCommit: string;
    integrationCommit: string | null;
    patchsetDigest: string | null;
  }>;
}>;

export type QuoteCandidateFailureCodeV0_1 =
  | "PROTOCOL_NOT_ALLOWED"
  | "QUOTE_TIMEOUT"
  | "QUOTE_ACQUISITION_FAILED"
  | "MALFORMED_QUOTE"
  | "ASSET_DIRECTION_MISMATCH"
  | "AMOUNT_BASIS_MISMATCH"
  | "UNKNOWN_ASSET"
  | "UNKNOWN_DECIMALS";

type SnapshottedRawQuoteV0_1 = Readonly<{
  status: "SNAPSHOTTED";
  source: RawQuote;
  snapshot: RawQuote["mossOriginal"]["value"];
}>;

export type QuoteCandidateOutcomeV0_1 =
  | Readonly<{
      status: "SKIPPED";
      protocolId: ProtocolId;
      terminalTiming: QuoteTimingV0_1;
      failure: Readonly<{
        code: "PROTOCOL_NOT_ALLOWED" | "UNKNOWN_ASSET" | "UNKNOWN_DECIMALS";
      }>;
    }>
  | Readonly<{
      status: "ACQUISITION_FAILED";
      protocolId: ProtocolId;
      terminalTiming: QuoteTimingV0_1;
      failure:
        | Readonly<{ code: "QUOTE_TIMEOUT" }>
        | Readonly<{
            code: "QUOTE_ACQUISITION_FAILED";
            sourceErrorCode: import("./errors.js").MossAdapterErrorCode | null;
          }>;
    }>
  | Readonly<{
      status: "INELIGIBLE";
      protocolId: ProtocolId;
      acquiredTiming: QuoteTimingV0_1;
      raw: RawQuoteRetentionV0_1;
      failure: Readonly<{ code: "MALFORMED_QUOTE" }>;
    }>
  | Readonly<{
      status: "INELIGIBLE";
      protocolId: ProtocolId;
      acquiredTiming: QuoteTimingV0_1;
      raw: SnapshottedRawQuoteV0_1;
      failure: Readonly<{ code: "ASSET_DIRECTION_MISMATCH" }>;
    }>
  | Readonly<{
      status: "INELIGIBLE";
      protocolId: ProtocolId;
      acquiredTiming: QuoteTimingV0_1;
      raw: SnapshottedRawQuoteV0_1;
      failure: Readonly<{ code: "AMOUNT_BASIS_MISMATCH" }>;
    }>
  | Readonly<{
      status: "ELIGIBLE";
      protocolId: ProtocolId;
      acquiredTiming: QuoteTimingV0_1;
      raw: SnapshottedRawQuoteV0_1;
      normalized: NormalizedQuoteV0_1;
    }>;

export type SelectedQuoteDigestV0_1 = Readonly<{
  algorithm: "RFC8785-SHA256";
  value: `sha256:${string}`;
  payload: Readonly<Record<string, JsonValue>>;
}>;

export type QuoteCollectionResultV0_1 =
  | Readonly<{
      status: "SELECTED";
      method: "DETERMINISTIC_CANDIDATE_SELECTION_V0_1";
      catalog: AssetCatalogSnapshotV0_1;
      outcomes: readonly QuoteCandidateOutcomeV0_1[];
      selected: Readonly<{
        protocolId: ProtocolId;
        digest: SelectedQuoteDigestV0_1;
      }>;
    }>
  | Readonly<{
      status: "NOT_SELECTED";
      method: "DETERMINISTIC_CANDIDATE_SELECTION_V0_1";
      code: "NO_ELIGIBLE_QUOTE";
      catalog: AssetCatalogSnapshotV0_1;
      outcomes: readonly QuoteCandidateOutcomeV0_1[];
    }>;

export type CapabilityConstructionPolicyV0_1 = Readonly<{
  schemaVersion: "0.1";
  policyId: string;
  sourceVersion: string;
  provenance: "SYNTHETIC_TEST";
  sourceReference: string;
  chainId: ChainId143;
  catalogDigest: `sha256:${string}`;
  protocolId: ProtocolId;
  inputAsset: QuoteAssetV0_1;
  outputAsset: QuoteAssetV0_1;
  expectedNodeCount: Readonly<{
    capabilityNodes: number;
    transactionNodes: number;
    totalNodes: number;
  }>;
  expectedTransactionTargets: readonly Readonly<{
    address: EvmAddress;
    role: "PROTOCOL" | "SPENDER" | "TOKEN";
  }>[];
}>;

type CapabilityIntegrityVerificationV0_1 =
  | Readonly<{
      status: "MATCH";
      expectedDigest: `sha256:${string}`;
      actualDigest: `sha256:${string}`;
    }>
  | Readonly<{
      status: "MISMATCH";
      expectedDigest: `sha256:${string}`;
      actualDigest: `sha256:${string}`;
    }>
  | Readonly<{
      status: "UNPROVABLE";
      expectedDigest: `sha256:${string}`;
      actualDigest: null;
    }>;

export type CapabilityConstructionResultV0_1 = Readonly<{
  status: "CONSTRUCTED_SYNTHETIC";
  operation: RawOperationContract;
  actionInput: ActionInput;
  mossOriginal: RawCapabilityEvidence["mossOriginal"];
  simulatorInput: RawCapability;
  miniDemoDerived: Readonly<{
    source: MiniDemoDerivedSource;
    snapshot: RawCapability;
    selectedQuoteDigest: SelectedQuoteDigestV0_1;
    amount: Readonly<{
      smallestUnit: string;
      humanDecimal: string;
      decimals: number;
      conversion: "VIEM_PARSE_FORMAT_UNITS_V0_1";
    }>;
    integrity: Readonly<{
      algorithm: "RFC8785-SHA256";
      domain: "moss-mini-demo:capability:v0.1\n";
      digest: `sha256:${string}`;
    }>;
    nodeCount: Readonly<{
      status: "EXPECTED" | "UNEXPECTED";
      expected: CapabilityConstructionPolicyV0_1["expectedNodeCount"];
      actual: Readonly<{
        capabilityNodes: number;
        transactionNodes: number;
        totalNodes: number;
      }>;
    }>;
    transactionTargets: Readonly<{
      status: "EXPECTED" | "UNEXPECTED";
      expected: CapabilityConstructionPolicyV0_1["expectedTransactionTargets"];
      observed: readonly EvmAddress[];
      unexpected: readonly EvmAddress[];
    }>;
  }>;
  verifyCurrentIntegrity: () => CapabilityIntegrityVerificationV0_1;
}>;

export type RawCapabilityEvidence = Readonly<{
  operation: RawOperationContract;
  mossOriginal: Readonly<{
    source: MossOriginalSource;
    value: RawCapability;
  }>;
  miniDemoDerived: Readonly<{
    source: MiniDemoDerivedSource;
    snapshot: RawCapability;
    integrity: Readonly<{
      status: "NOT_EVALUATED";
      reason: "DEFERRED_TO_M2_06";
    }>;
  }>;
}>;

export type RawSimulationEvidence = Readonly<{
  sourceContext: Readonly<{
    chainId: ChainId143;
    protocolId: string;
    method: string;
    buildInfo: MossBuildInfo;
  }>;
  mossOriginal: Readonly<{
    source: MossOriginalSource;
    capability: unknown;
    simulation: JsonValue;
    retained: Readonly<{
      capability: RawCapability;
      simulation: JsonValue;
    }>;
    transactions: readonly Readonly<{
      transactionIndex: number;
      value: JsonValue;
    }>[];
    changes: readonly Readonly<{
      transactionIndex: number;
      changeIndex: number;
      value: JsonValue;
    }>[];
    receipts: readonly Readonly<{
      transactionIndex: number;
      value: JsonValue;
    }>[];
    outcomes: readonly Readonly<{
      transactionIndex: number;
      value: JsonValue;
    }>[];
    warnings: readonly Readonly<{
      transactionIndex: number;
      warningIndex: number;
      code: string;
      message: string;
      value: JsonValue;
    }>[];
    gas: readonly Readonly<{
      transactionIndex: number;
      value: string | null;
    }>[];
  }>;
  miniDemoDerived: MiniDemoDerivedVerificationV0_1;
}>;

export type SimulationVerificationStatusV0_1 =
  | "PROVEN"
  | "FAILED"
  | "UNPROVABLE";

export type StateContinuityVerificationStatusV0_1 =
  | SimulationVerificationStatusV0_1
  | "NOT_APPLICABLE";

export type SimulationBlockFailureCodeV0_1 =
  | "BLOCK_NUMBER_UNOBSERVABLE"
  | "BLOCK_NUMBER_INCONSISTENT"
  | "BLOCK_PARAMETER_UNOBSERVABLE"
  | "BLOCK_PARAMETER_INCONSISTENT"
  | "BLOCK_HASH_UNOBSERVABLE"
  | "BLOCK_HASH_CHANGED";

export type SimulationRpcObservationV0_1 = Readonly<{
  blockNumberResponses: readonly string[];
  preBlockHashes: readonly (string | null)[];
  postBlockHash: string | null;
  requestBlocks: readonly Readonly<{
    method: "debug_traceCall" | "eth_estimateGas";
    blockParameter: string | null;
  }>[];
  failures: readonly SimulationBlockFailureCodeV0_1[];
}>;

export type SimulationBlockVerificationV0_1 =
  | Readonly<{
      status: "PROVEN";
      blockNumber: string;
      blockHash: string;
      observation: SimulationRpcObservationV0_1;
    }>
  | Readonly<{
      status: "UNPROVABLE";
      reasons: readonly SimulationBlockFailureCodeV0_1[];
      observation: SimulationRpcObservationV0_1;
    }>;

export type MiniDemoDerivedVerificationV0_1 = Readonly<{
  source: MiniDemoDerivedSource;
  derivedBy: "@moss-mini-demo/moss-adapter";
  ruleVersion: "0.1";
  mossCommit: string;
  simulationBlock: SimulationBlockVerificationV0_1;
  capabilityIntegrity: SimulationVerificationStatusV0_1;
  capabilityDigests: Readonly<{
    algorithm: "RFC8785-SHA256";
    domain: "moss-mini-demo:capability:v0.1\n";
    preSimulation: `sha256:${string}` | null;
    postSimulation: `sha256:${string}` | null;
  }>;
  receiptCoverage: SimulationVerificationStatusV0_1;
  ordering: SimulationVerificationStatusV0_1;
  stateContinuity: StateContinuityVerificationStatusV0_1;
  sourceReferences: readonly string[];
}>;

export interface MossPort {
  describe(protocolId: string, method: string): Promise<RawOperationContract>;
  quote(
    protocolId: string,
    input: QuoteInput,
    options?: QuoteRequestOptionsV0_1,
  ): Promise<RawQuote>;
  action(
    protocolId: string,
    input: ActionInput,
  ): Promise<RawCapabilityEvidence>;
  simulate(capability: RawCapability): Promise<RawSimulationEvidence>;
  buildInfo(): MossBuildInfo;
}
