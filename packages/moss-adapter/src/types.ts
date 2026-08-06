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

export type ActionInput = Readonly<{
  method: string;
  account: string;
  params: JsonValue;
}>;

export type MossLoadedOperation = Readonly<{
  protocolId: string;
  method: string;
  operationKind: "CAPABILITY" | "QUERY";
  stub: Readonly<{ [key: string]: JsonValue }>;
  riskLabels: readonly string[];
}>;

export interface MossSourceBindings {
  readonly chainId: unknown;
  buildInfo(): MossBuildInfo;
  describe(protocolId: string, method: string): Promise<MossLoadedOperation>;
  quote(
    protocolId: string,
    input: QuoteInput,
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
  simulate(capability: RawCapability): Promise<
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
    value: JsonValue;
  }>;
  miniDemoDerived: Readonly<{
    source: MiniDemoDerivedSource;
    mappingStatus: "NOT_MAPPED";
    reason: "DEFERRED_TO_M2_07";
  }>;
}>;

export interface MossPort {
  describe(protocolId: string, method: string): Promise<RawOperationContract>;
  quote(protocolId: string, input: QuoteInput): Promise<RawQuote>;
  action(
    protocolId: string,
    input: ActionInput,
  ): Promise<RawCapabilityEvidence>;
  simulate(capability: RawCapability): Promise<RawSimulationEvidence>;
  buildInfo(): MossBuildInfo;
}
