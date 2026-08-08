import {
  CAPABILITY_DIGEST_DOMAIN,
  capabilityDigestFromSnapshot,
  currentCapabilityDigest,
  isDeeplyFrozenJsonExactValue,
  isJsonExactValue,
} from "./integrity.js";
import type {
  MossRpcRequestV0_1,
  MossSimulationRpcClientV0_1,
  RawCapability,
  SimulationBlockFailureCodeV0_1,
  SimulationRpcObservationV0_1,
} from "./types.js";

const BLOCK_QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const BLOCK_HASH = /^0x[0-9a-fA-F]{64}$/;

type RetainedCapabilityV0_1 = Readonly<{
  snapshot: RawCapability;
  digest: `sha256:${string}`;
}>;

export type RecordingSimulationRpcSessionV0_1 = Readonly<{
  client: MossSimulationRpcClientV0_1;
  finish(): Promise<SimulationRpcObservationV0_1>;
}>;

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

function blockHash(value: unknown): string | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const hash = (value as Record<string, unknown>).hash;
    return typeof hash === "string" && BLOCK_HASH.test(hash) ? hash : null;
  } catch {
    return null;
  }
}

function addFailure(
  failures: SimulationBlockFailureCodeV0_1[],
  code: SimulationBlockFailureCodeV0_1,
): void {
  if (!failures.includes(code)) {
    failures.push(code);
  }
}

function requestBlock(request: MossRpcRequestV0_1): string | null {
  try {
    const params = request.params;
    const value = Array.isArray(params) ? params[1] : undefined;
    return typeof value === "string" && BLOCK_QUANTITY.test(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

async function observeHash(
  rawClient: MossSimulationRpcClientV0_1,
  blockNumber: string,
): Promise<string | null> {
  try {
    const result = await rawClient.request({
      method: "eth_getBlockByNumber",
      params: [blockNumber, false],
    });
    return blockHash(result);
  } catch {
    return null;
  }
}

export function retainSimulationCapabilityV0_1(
  capability: unknown,
): RetainedCapabilityV0_1 | undefined {
  if (
    (!isJsonExactValue(capability) &&
      !isDeeplyFrozenJsonExactValue(capability)) ||
    Array.isArray(capability)
  ) {
    return undefined;
  }
  try {
    const snapshot = deepFreeze(structuredClone(capability)) as RawCapability;
    const digest = capabilityDigestFromSnapshot(snapshot);
    return digest === undefined
      ? undefined
      : Object.freeze({ snapshot, digest });
  } catch {
    return undefined;
  }
}

export function postSimulationCapabilityDigestV0_1(
  capability: unknown,
): `sha256:${string}` | undefined {
  const current = currentCapabilityDigest(capability);
  if (current !== undefined) {
    return current;
  }
  return isDeeplyFrozenJsonExactValue(capability) && !Array.isArray(capability)
    ? capabilityDigestFromSnapshot(capability as RawCapability)
    : undefined;
}

export function createRecordingSimulationRpcSessionV0_1(
  rawClient: MossSimulationRpcClientV0_1,
): RecordingSimulationRpcSessionV0_1 {
  const blockNumberResponses: string[] = [];
  const preBlockHashes: (string | null)[] = [];
  const requestBlocks: {
    method: "debug_traceCall" | "eth_estimateGas";
    blockParameter: string | null;
  }[] = [];
  const failures: SimulationBlockFailureCodeV0_1[] = [];
  let finished: Promise<SimulationRpcObservationV0_1> | undefined;

  const client: MossSimulationRpcClientV0_1 = Object.freeze({
    async request(request: MossRpcRequestV0_1): Promise<unknown> {
      let method: string;
      try {
        method = request.method;
      } catch {
        return rawClient.request(request);
      }

      if (method === "debug_traceCall" || method === "eth_estimateGas") {
        const blockParameter = requestBlock(request);
        requestBlocks.push({ method, blockParameter });
        if (blockParameter === null) {
          addFailure(failures, "BLOCK_PARAMETER_UNOBSERVABLE");
        }
      }

      let response: unknown;
      try {
        response = await rawClient.request(request);
      } catch (error) {
        if (method === "eth_blockNumber") {
          addFailure(failures, "BLOCK_NUMBER_UNOBSERVABLE");
        }
        throw error;
      }

      if (method === "eth_blockNumber") {
        if (typeof response === "string" && BLOCK_QUANTITY.test(response)) {
          blockNumberResponses.push(response);
          const hash = await observeHash(rawClient, response);
          preBlockHashes.push(hash);
          if (hash === null) {
            addFailure(failures, "BLOCK_HASH_UNOBSERVABLE");
          }
        } else {
          addFailure(failures, "BLOCK_NUMBER_UNOBSERVABLE");
        }
      }

      return response;
    },
  });

  return Object.freeze({
    client,
    finish(): Promise<SimulationRpcObservationV0_1> {
      finished ??= (async () => {
        if (blockNumberResponses.length !== 1) {
          addFailure(
            failures,
            blockNumberResponses.length === 0
              ? "BLOCK_NUMBER_UNOBSERVABLE"
              : "BLOCK_NUMBER_INCONSISTENT",
          );
        }

        const blockNumber = blockNumberResponses[0];
        if (
          blockNumber !== undefined &&
          requestBlocks.some(
            ({ blockParameter }) => blockParameter !== blockNumber,
          )
        ) {
          addFailure(failures, "BLOCK_PARAMETER_INCONSISTENT");
        }

        const postBlockHash =
          blockNumberResponses.length === 1 && blockNumber !== undefined
            ? await observeHash(rawClient, blockNumber)
            : null;
        if (blockNumber !== undefined && postBlockHash === null) {
          addFailure(failures, "BLOCK_HASH_UNOBSERVABLE");
        }
        const preBlockHash = preBlockHashes[0];
        if (
          preBlockHash !== undefined &&
          preBlockHash !== null &&
          postBlockHash !== null &&
          preBlockHash !== postBlockHash
        ) {
          addFailure(failures, "BLOCK_HASH_CHANGED");
        }

        return deepFreeze({
          blockNumberResponses: [...blockNumberResponses],
          preBlockHashes: [...preBlockHashes],
          postBlockHash,
          requestBlocks: requestBlocks.map((request) => ({ ...request })),
          failures: [...failures],
        });
      })();
      return finished;
    },
  });
}

export { CAPABILITY_DIGEST_DOMAIN };
