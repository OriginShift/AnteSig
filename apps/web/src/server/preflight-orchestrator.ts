import "server-only";

import {
  type AssetCatalogV0_1,
  type CapabilityConstructionPolicyV0_1,
  type CapabilityConstructionResultV0_1,
  collectAndSelectQuotesV0_1,
  constructCapabilityV0_1,
  MossAdapterError,
  type MossPort,
  type QuoteCollectionRequestV0_1,
  type QuoteCollectionResultV0_1,
} from "@moss-mini-demo/moss-adapter";
import type {
  Intent,
  Limitation,
  Network,
  Provenance,
  ProtocolId,
} from "@moss-mini-demo/report-schema";
import type { RunId } from "../contracts/preflight";
import {
  projectPreflightReportV0_1,
  type SelectedQuoteCollection,
} from "./preflight-projection";
import type {
  PreflightService,
  PreflightServiceInput,
  PreflightServiceResult,
} from "./preflight-service";

export const PREFLIGHT_TOTAL_TIMEOUT_MS = 25_000;
export const PREFLIGHT_QUOTE_TIMEOUT_MS = 8_000;
const DEFAULT_REPORT_RESERVE_MS = 100;
const TIMEOUT_MESSAGE = "Preflight orchestration exceeded its hard deadline.";

export type PreflightLiveSession = Readonly<{
  port: MossPort;
  catalog: AssetCatalogV0_1;
  candidateProtocols: readonly ProtocolId[];
  createCapabilityPolicy(
    input: Readonly<{
      selection: SelectedQuoteCollection;
      request: QuoteCollectionRequestV0_1;
    }>,
  ): CapabilityConstructionPolicyV0_1;
  network: Network;
  provenance: Exclude<Provenance, "FIXTURE">;
  limitations: readonly Limitation[];
}>;

export type ResolveLiveSession = (
  input: Readonly<{ runId: RunId; intent: Intent }>,
) => PreflightLiveSession | undefined;

type Timer = ReturnType<typeof setTimeout>;
type Clock = Readonly<{
  now(): number;
  setTimeout(callback: () => void, delay: number): Timer;
  clearTimeout(timer: Timer): void;
}>;

type OrchestratorDependencies = Readonly<{
  fixtureService: PreflightService;
  resolveLiveSession: ResolveLiveSession;
  totalTimeoutMs?: number;
  quoteTimeoutMs?: number;
  reportReserveMs?: number;
  clock?: Clock;
}>;

const SYSTEM_CLOCK: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
};

const TIMED_OUT = Symbol("TIMED_OUT");

function timeoutResult(): PreflightServiceResult {
  return {
    status: "TIMEOUT",
    code: "PREFLIGHT_TIMEOUT",
    message: TIMEOUT_MESSAGE,
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  clock: Clock,
  onTimeout: () => void,
): Promise<T | typeof TIMED_OUT> {
  if (timeoutMs <= 0) {
    onTimeout();
    return TIMED_OUT;
  }
  let timer: Timer | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = clock.setTimeout(() => {
      onTimeout();
      resolve(TIMED_OUT);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clock.clearTimeout(timer);
    }
  }
}

function mergeSignals(
  first: AbortSignal | undefined,
  second: AbortSignal,
  third: AbortSignal,
): AbortSignal {
  return AbortSignal.any(
    first === undefined ? [second, third] : [first, second, third],
  );
}

function abortableQuotePort(
  port: MossPort,
  quoteSignal: AbortSignal,
  totalSignal: AbortSignal,
): MossPort {
  const wrapped: MossPort = {
    describe: (protocolId, method) => port.describe(protocolId, method),
    quote: (protocolId, input, options) =>
      port.quote(protocolId, input, {
        signal: mergeSignals(options?.signal, quoteSignal, totalSignal),
      }),
    action: (protocolId, input) => port.action(protocolId, input),
    simulate: (capability) => port.simulate(capability),
    buildInfo: () => port.buildInfo(),
  };
  return Object.freeze(wrapped);
}

function quoteRequest(
  intent: Intent,
  candidateProtocols: readonly ProtocolId[],
): QuoteCollectionRequestV0_1 {
  return {
    chainId: 143,
    candidateProtocols: [...candidateProtocols],
    allowedProtocols: [...intent.allowedProtocols],
    quoteInput: {
      method: "swap",
      account: intent.account,
      params: {
        inputAsset: structuredClone(intent.inputAsset),
        outputAsset: structuredClone(intent.outputAsset),
        amountIn: intent.inputAmount,
        slippageBps: intent.maxSlippageBps,
        ...(intent.recipient === undefined
          ? {}
          : { recipient: intent.recipient }),
      },
    },
    inputAsset: structuredClone(intent.inputAsset),
    outputAsset: structuredClone(intent.outputAsset),
    amountIn: intent.inputAmount,
  };
}

function isActionAcquisitionFailure(error: unknown): boolean {
  return error instanceof MossAdapterError && error.code === "ACTION_FAILED";
}

function isSimulationAcquisitionFailure(error: unknown): boolean {
  return (
    error instanceof MossAdapterError && error.code === "SIMULATION_FAILED"
  );
}

function settledPromise<T>(
  promise: Promise<T>,
): Promise<
  | Readonly<{ status: "FULFILLED"; value: T }>
  | Readonly<{ status: "REJECTED"; error: unknown }>
> {
  return promise.then(
    (value) => ({ status: "FULFILLED", value }),
    (error: unknown) => ({ status: "REJECTED", error }),
  );
}

export class PreflightOrchestrator implements PreflightService {
  readonly #fixtureService: PreflightService;
  readonly #resolveLiveSession: ResolveLiveSession;
  readonly #totalTimeoutMs: number;
  readonly #quoteTimeoutMs: number;
  readonly #reportReserveMs: number;
  readonly #clock: Clock;

  constructor(dependencies: OrchestratorDependencies) {
    this.#fixtureService = dependencies.fixtureService;
    this.#resolveLiveSession = dependencies.resolveLiveSession;
    this.#totalTimeoutMs =
      dependencies.totalTimeoutMs ?? PREFLIGHT_TOTAL_TIMEOUT_MS;
    this.#quoteTimeoutMs =
      dependencies.quoteTimeoutMs ?? PREFLIGHT_QUOTE_TIMEOUT_MS;
    this.#reportReserveMs =
      dependencies.reportReserveMs ?? DEFAULT_REPORT_RESERVE_MS;
    this.#clock = dependencies.clock ?? SYSTEM_CLOCK;
    if (
      !Number.isSafeInteger(this.#totalTimeoutMs) ||
      this.#totalTimeoutMs <= 0 ||
      !Number.isSafeInteger(this.#quoteTimeoutMs) ||
      this.#quoteTimeoutMs <= 0 ||
      !Number.isSafeInteger(this.#reportReserveMs) ||
      this.#reportReserveMs < 0 ||
      this.#reportReserveMs >= this.#totalTimeoutMs
    ) {
      throw new TypeError("Invalid preflight deadline configuration");
    }
  }

  async run(input: PreflightServiceInput): Promise<PreflightServiceResult> {
    if (input.request.mode === "FIXTURE") {
      return this.#fixtureService.run(input);
    }

    const deadline = this.#clock.now() + this.#totalTimeoutMs;
    const session = this.#resolveLiveSession({
      runId: input.runId,
      intent: input.request.intent,
    });
    if (this.#clock.now() >= deadline) {
      return timeoutResult();
    }
    if (session === undefined) {
      return {
        status: "UNAVAILABLE",
        code: "LIVE_UNAVAILABLE",
        message: "Live preflight is not configured.",
      };
    }
    return this.#runLive(input.runId, input.request.intent, session, deadline);
  }

  async #runLive(
    runId: RunId,
    intent: Intent,
    session: PreflightLiveSession,
    deadline: number,
  ): Promise<PreflightServiceResult> {
    const remainingBudget = () =>
      Math.max(0, deadline - this.#clock.now() - this.#reportReserveMs);
    const totalController = new AbortController();
    const quoteController = new AbortController();
    const request = quoteRequest(intent, session.candidateProtocols);
    const port = abortableQuotePort(
      session.port,
      quoteController.signal,
      totalController.signal,
    );

    const quoteBudget = Math.min(this.#quoteTimeoutMs, remainingBudget());
    const quote = await withTimeout(
      collectAndSelectQuotesV0_1(port, session.catalog, request),
      quoteBudget,
      this.#clock,
      () => quoteController.abort("MOSS_MINI_DEMO_QUOTE_STAGE_TIMEOUT_V0_1"),
    );
    if (quote === TIMED_OUT) {
      const report = projectPreflightReportV0_1({
        intent,
        quote: { status: "FAILED", code: "QUOTE_STAGE_TIMEOUT" },
        quoteRequest: request,
        capability: { status: "MISSING", code: "NO_VALID_SELECTION" },
        simulation: { status: "MISSING", code: "NO_CAPABILITY" },
        metadata: this.#metadata(runId, session),
      });
      return this.#clock.now() < deadline
        ? { status: "SUCCESS", report }
        : timeoutResult();
    }

    if (quote.status === "NOT_SELECTED") {
      const report = projectPreflightReportV0_1({
        intent,
        quote: { status: "COLLECTED", result: quote },
        quoteRequest: request,
        capability: { status: "MISSING", code: "NO_VALID_SELECTION" },
        simulation: { status: "MISSING", code: "NO_CAPABILITY" },
        metadata: this.#metadata(runId, session),
      });
      return this.#clock.now() < deadline
        ? { status: "SUCCESS", report }
        : timeoutResult();
    }

    const action = await withTimeout(
      settledPromise(this.#constructCapability(session, quote, request)),
      remainingBudget(),
      this.#clock,
      () => totalController.abort("MOSS_MINI_DEMO_ACTION_TIMEOUT_V0_1"),
    );
    if (action === TIMED_OUT) {
      return this.#failedActionReport(
        runId,
        intent,
        session,
        request,
        quote,
        "ACTION_TIMEOUT",
        deadline,
      );
    }
    if (action.status === "REJECTED") {
      if (!isActionAcquisitionFailure(action.error)) {
        throw action.error;
      }
      return this.#failedActionReport(
        runId,
        intent,
        session,
        request,
        quote,
        "ACTION_ACQUISITION_FAILED",
        deadline,
      );
    }

    const simulation = await withTimeout(
      settledPromise(session.port.simulate(action.value.simulatorInput)),
      remainingBudget(),
      this.#clock,
      () => totalController.abort("MOSS_MINI_DEMO_SIMULATION_TIMEOUT_V0_1"),
    );
    if (simulation === TIMED_OUT) {
      return this.#failedSimulationReport(
        runId,
        intent,
        session,
        request,
        quote,
        action.value,
        "SIMULATION_TIMEOUT",
        deadline,
      );
    }
    if (simulation.status === "REJECTED") {
      if (!isSimulationAcquisitionFailure(simulation.error)) {
        throw simulation.error;
      }
      return this.#failedSimulationReport(
        runId,
        intent,
        session,
        request,
        quote,
        action.value,
        "SIMULATION_ACQUISITION_FAILED",
        deadline,
      );
    }

    const report = projectPreflightReportV0_1({
      intent,
      quote: { status: "COLLECTED", result: quote },
      quoteRequest: request,
      capability: { status: "AVAILABLE", result: action.value },
      simulation: { status: "AVAILABLE", evidence: simulation.value },
      metadata: this.#metadata(runId, session),
    });
    return this.#clock.now() < deadline
      ? { status: "SUCCESS", report }
      : timeoutResult();
  }

  #constructCapability(
    session: PreflightLiveSession,
    selection: SelectedQuoteCollection,
    request: QuoteCollectionRequestV0_1,
  ): Promise<CapabilityConstructionResultV0_1> {
    const policy = session.createCapabilityPolicy({ selection, request });
    return constructCapabilityV0_1(session.port, selection, request, policy);
  }

  #failedActionReport(
    runId: RunId,
    intent: Intent,
    session: PreflightLiveSession,
    request: QuoteCollectionRequestV0_1,
    quote: QuoteCollectionResultV0_1,
    code: string,
    deadline: number,
  ): PreflightServiceResult {
    const report = projectPreflightReportV0_1({
      intent,
      quote: { status: "COLLECTED", result: quote },
      quoteRequest: request,
      capability: { status: "FAILED", code },
      simulation: { status: "MISSING", code: "NO_CAPABILITY" },
      metadata: this.#metadata(runId, session),
    });
    return this.#clock.now() < deadline
      ? { status: "SUCCESS", report }
      : timeoutResult();
  }

  #failedSimulationReport(
    runId: RunId,
    intent: Intent,
    session: PreflightLiveSession,
    request: QuoteCollectionRequestV0_1,
    quote: QuoteCollectionResultV0_1,
    capability: CapabilityConstructionResultV0_1,
    code: string,
    deadline: number,
  ): PreflightServiceResult {
    const report = projectPreflightReportV0_1({
      intent,
      quote: { status: "COLLECTED", result: quote },
      quoteRequest: request,
      capability: { status: "AVAILABLE", result: capability },
      simulation: { status: "FAILED", code },
      metadata: this.#metadata(runId, session),
    });
    return this.#clock.now() < deadline
      ? { status: "SUCCESS", report }
      : timeoutResult();
  }

  #metadata(runId: RunId, session: PreflightLiveSession) {
    return {
      reportId: runId.slice("run_".length),
      generatedAt: new Date(this.#clock.now()).toISOString(),
      network: session.network,
      provenance: session.provenance,
      limitations: session.limitations,
    };
  }
}
