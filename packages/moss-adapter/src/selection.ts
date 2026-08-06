import {
  compareProtocolIds,
  createAssetCatalogSnapshot,
  findCatalogEntry,
} from "./asset-catalog.js";
import {
  classifyAcquiredQuote,
  createSelectedQuoteDigest,
  quoteTiming,
  safeSourceErrorCode,
  validateQuoteCollectionRequest,
} from "./quote.js";
import type {
  AssetCatalogEntryV0_1,
  AssetCatalogV0_1,
  AssetCatalogSnapshotV0_1,
  MossPort,
  QuoteCandidateOutcomeV0_1,
  QuoteCollectionRequestV0_1,
  QuoteCollectionResultV0_1,
} from "./types.js";

const QUOTE_DEADLINE_MS = 8_000;
const QUOTE_TIMEOUT_REASON = "MOSS_MINI_DEMO_QUOTE_TIMEOUT_V0_1";
const SELECTION_METHOD = "DETERMINISTIC_CANDIDATE_SELECTION_V0_1";

type KnownCatalogEntry = AssetCatalogEntryV0_1 & {
  readonly decimals: Readonly<{ status: "KNOWN"; value: number }>;
};
type EligibleOutcome = Extract<
  QuoteCandidateOutcomeV0_1,
  { status: "ELIGIBLE" }
>;

function freezeOutcome<T extends QuoteCandidateOutcomeV0_1>(outcome: T): T {
  if ("failure" in outcome) {
    Object.freeze(outcome.failure);
  }
  Object.freeze(
    "terminalTiming" in outcome
      ? outcome.terminalTiming
      : outcome.acquiredTiming,
  );
  return Object.freeze(outcome);
}

function skipped(
  protocolId: QuoteCandidateOutcomeV0_1["protocolId"],
  code: "PROTOCOL_NOT_ALLOWED" | "UNKNOWN_ASSET" | "UNKNOWN_DECIMALS",
): QuoteCandidateOutcomeV0_1 {
  return freezeOutcome({
    status: "SKIPPED",
    protocolId,
    terminalTiming: quoteTiming(),
    failure: { code },
  });
}

function acquisitionFailed(
  protocolId: QuoteCandidateOutcomeV0_1["protocolId"],
  error: unknown,
): QuoteCandidateOutcomeV0_1 {
  return freezeOutcome({
    status: "ACQUISITION_FAILED",
    protocolId,
    terminalTiming: quoteTiming(),
    failure: {
      code: "QUOTE_ACQUISITION_FAILED",
      sourceErrorCode: safeSourceErrorCode(error),
    },
  });
}

function timeout(
  protocolId: QuoteCandidateOutcomeV0_1["protocolId"],
): QuoteCandidateOutcomeV0_1 {
  return freezeOutcome({
    status: "ACQUISITION_FAILED",
    protocolId,
    terminalTiming: quoteTiming(),
    failure: { code: "QUOTE_TIMEOUT" },
  });
}

function isKnown(
  entry: AssetCatalogEntryV0_1 | undefined,
): entry is KnownCatalogEntry {
  return entry?.decimals.status === "KNOWN";
}

function acquireCandidate(
  port: MossPort,
  protocolId: QuoteCandidateOutcomeV0_1["protocolId"],
  request: QuoteCollectionRequestV0_1,
  catalog: AssetCatalogSnapshotV0_1,
  inputEntry: KnownCatalogEntry,
  outputEntry: KnownCatalogEntry,
): Promise<QuoteCandidateOutcomeV0_1> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    let terminal = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const commit = (outcome: QuoteCandidateOutcomeV0_1) => {
      if (terminal) {
        return;
      }
      terminal = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      resolve(outcome);
    };

    let sourcePromise: Promise<Awaited<ReturnType<MossPort["quote"]>>>;
    try {
      sourcePromise = Promise.resolve(
        port.quote(protocolId, request.quoteInput, {
          signal: controller.signal,
        }),
      );
    } catch (error) {
      commit(acquisitionFailed(protocolId, error));
      return;
    }

    sourcePromise.then(
      (quote) => {
        if (terminal) {
          return;
        }
        try {
          commit(
            classifyAcquiredQuote(
              protocolId,
              quote,
              request,
              catalog,
              inputEntry,
              outputEntry,
            ),
          );
        } catch (error) {
          commit(acquisitionFailed(protocolId, error));
        }
      },
      (error: unknown) => {
        if (!terminal) {
          commit(acquisitionFailed(protocolId, error));
        }
      },
    );

    timer = setTimeout(() => {
      if (terminal) {
        return;
      }
      terminal = true;
      try {
        controller.abort(QUOTE_TIMEOUT_REASON);
      } catch {
        // Local timeout terminality does not depend on source cooperation.
      }
      resolve(timeout(protocolId));
    }, QUOTE_DEADLINE_MS);
  });
}

function compareEligible(
  left: EligibleOutcome,
  right: EligibleOutcome,
): number {
  const leftAmount = BigInt(left.normalized.normalizedAmountOut);
  const rightAmount = BigInt(right.normalized.normalizedAmountOut);
  if (leftAmount !== rightAmount) {
    return leftAmount > rightAmount ? -1 : 1;
  }
  return compareProtocolIds(left.protocolId, right.protocolId);
}

export async function collectAndSelectQuotesV0_1(
  port: MossPort,
  catalogValue: AssetCatalogV0_1,
  requestValue: QuoteCollectionRequestV0_1,
): Promise<QuoteCollectionResultV0_1> {
  const collectionStartedAt = Date.now();
  const request = validateQuoteCollectionRequest(requestValue);
  const catalog = createAssetCatalogSnapshot(catalogValue, collectionStartedAt);
  const inputEntry = findCatalogEntry(catalog, request.inputAsset);
  const outputEntry = findCatalogEntry(catalog, request.outputAsset);
  const allowedProtocols = new Set(request.allowedProtocols);

  const tasks = request.candidateProtocols.map((protocolId) => {
    if (!allowedProtocols.has(protocolId)) {
      return Promise.resolve(skipped(protocolId, "PROTOCOL_NOT_ALLOWED"));
    }
    if (inputEntry === undefined || outputEntry === undefined) {
      return Promise.resolve(skipped(protocolId, "UNKNOWN_ASSET"));
    }
    if (!isKnown(inputEntry) || !isKnown(outputEntry)) {
      return Promise.resolve(skipped(protocolId, "UNKNOWN_DECIMALS"));
    }
    return acquireCandidate(
      port,
      protocolId,
      request,
      catalog,
      inputEntry,
      outputEntry,
    );
  });

  const settled = await Promise.allSettled(tasks);
  const outcomes = Object.freeze(
    settled
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        const protocolId = request.candidateProtocols[index];
        if (protocolId === undefined) {
          throw new Error("Candidate result index is invalid");
        }
        return acquisitionFailed(protocolId, result.reason);
      })
      .sort((left, right) =>
        compareProtocolIds(left.protocolId, right.protocolId),
      ),
  );

  const eligible = outcomes
    .filter(
      (outcome): outcome is EligibleOutcome => outcome.status === "ELIGIBLE",
    )
    .sort(compareEligible);
  const winner = eligible[0];

  if (winner === undefined) {
    return Object.freeze({
      status: "NOT_SELECTED",
      method: SELECTION_METHOD,
      code: "NO_ELIGIBLE_QUOTE",
      catalog,
      outcomes,
    });
  }

  return Object.freeze({
    status: "SELECTED",
    method: SELECTION_METHOD,
    catalog,
    outcomes,
    selected: Object.freeze({
      protocolId: winner.protocolId,
      digest: createSelectedQuoteDigest(winner),
    }),
  });
}
