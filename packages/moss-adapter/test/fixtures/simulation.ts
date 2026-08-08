import type {
  MossRpcRequestV0_1,
  RawCapability,
  SimulationRpcObservationV0_1,
} from "../../src/index.js";

export const SYNTHETIC_BLOCK = "0x1234";
export const SYNTHETIC_BLOCK_HASH = `0x${"12".repeat(32)}`;
export const SYNTHETIC_OTHER_BLOCK_HASH = `0x${"34".repeat(32)}`;

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const SPENDER = "0x3333333333333333333333333333333333333333";
const ROUTER = "0x4444444444444444444444444444444444444444";

function transaction(to: string, data: string) {
  return {
    from: ACCOUNT,
    to,
    data,
    value: "0x0",
  };
}

export function singleTransactionCapability(): RawCapability {
  return {
    kind: "capability",
    protocol: "synthetic-protocol",
    method: "swap",
    params: { amountIn: "1" },
    children: [
      {
        kind: "transaction",
        transaction: transaction(ROUTER, "0x1234"),
      },
    ],
  };
}

export function approvalSwapCapability(): RawCapability {
  return {
    kind: "capability",
    protocol: "synthetic-protocol",
    method: "swap",
    params: { amountIn: "1" },
    children: [
      {
        kind: "capability",
        protocol: "synthetic-token",
        method: "approve",
        params: { spender: SPENDER },
        children: [
          {
            kind: "transaction",
            transaction: transaction(TOKEN, "0xaaaa"),
          },
        ],
      },
      {
        kind: "transaction",
        transaction: transaction(ROUTER, "0xbbbb"),
      },
    ],
  };
}

function successfulResult(
  protocol: string,
  method: string,
  to: string,
  data: string,
  amountOut: string,
) {
  const change = {
    kind: "event",
    address: to,
    topics: ["0x01"],
    data: "0x02",
  };
  const receipt = {
    kind: "receipt",
    protocol,
    outcome: { amountOut, status: "SUCCESS" },
    text: `${method} synthetic receipt`,
    changes: [
      {
        kind: "change",
        change,
        data: { amountOut },
        text: `${method} synthetic change`,
      },
    ],
  };
  return {
    protocol,
    method,
    transaction: transaction(to, data),
    reverted: false,
    receipt,
    changes: [change],
    warnings: [],
    gas: "900719925474099312345",
  };
}

export function singleSuccessSimulation() {
  return {
    results: [
      successfulResult("synthetic-protocol", "swap", ROUTER, "0x1234", "42"),
    ],
    unknownFutureField: {
      retained: true,
      nested: ["synthetic", { version: 2 }],
    },
  };
}

export function approvalSwapSimulation() {
  return {
    results: [
      successfulResult("synthetic-token", "approve", TOKEN, "0xaaaa", "0"),
      successfulResult("synthetic-protocol", "swap", ROUTER, "0xbbbb", "42"),
    ],
  };
}

export function provenObservation(): SimulationRpcObservationV0_1 {
  return Object.freeze({
    blockNumberResponses: Object.freeze([SYNTHETIC_BLOCK]),
    preBlockHashes: Object.freeze([SYNTHETIC_BLOCK_HASH]),
    postBlockHash: SYNTHETIC_BLOCK_HASH,
    requestBlocks: Object.freeze([
      Object.freeze({
        method: "debug_traceCall" as const,
        blockParameter: SYNTHETIC_BLOCK,
      }),
      Object.freeze({
        method: "eth_estimateGas" as const,
        blockParameter: SYNTHETIC_BLOCK,
      }),
    ]),
    failures: Object.freeze([]),
  });
}

export type RecordedRpcCall = Readonly<{
  request: MossRpcRequestV0_1;
}>;

export function successfulRawRpcClient(
  options: { blockNumber?: string; preHash?: string; postHash?: string } = {},
) {
  const blockNumber = options.blockNumber ?? SYNTHETIC_BLOCK;
  const preHash = options.preHash ?? SYNTHETIC_BLOCK_HASH;
  const postHash = options.postHash ?? preHash;
  const calls: RecordedRpcCall[] = [];
  let hashReads = 0;
  const client = {
    async request(request: MossRpcRequestV0_1): Promise<unknown> {
      calls.push({ request });
      if (request.method === "eth_blockNumber") {
        return blockNumber;
      }
      if (request.method === "eth_getBlockByNumber") {
        const hash = hashReads++ === 0 ? preHash : postHash;
        return { hash };
      }
      if (request.method === "debug_traceCall") {
        return { type: "CALL", from: ACCOUNT, to: ROUTER, logs: [] };
      }
      if (request.method === "eth_estimateGas") {
        return "0x5208";
      }
      throw new Error("unexpected synthetic RPC method");
    },
  };
  return { client, calls };
}
