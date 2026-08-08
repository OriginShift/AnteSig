import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createFailureArtifact,
  createLiveArtifact,
  publicRpcMetadata,
  serializeArtifact,
} from "./artifact.mjs";

const PINNED_MOSS_COMMIT = "1ae6b6322d51fae9104f047efb94e601050b967f";
const PROTOCOL_ID = "pancakeswap-v2";
const QUOTE_METHOD = "quote";
const ACTION_METHOD = "swap";
const ACCOUNT = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC";
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const VENDOR = fileURLToPath(
  new URL("../../../../vendor/moss/", import.meta.url),
);
const TIMEOUT_MS = 180_000;

let stage = "CONFIG";
let miniDemoHead = null;
let emitted = false;
const rawRpcUrl = process.env.MOSS_RPC_URL ?? "";

function gitHead(directory) {
  return execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function trackedStatus(directory) {
  return execFileSync(
    "git",
    ["-C", directory, "status", "--porcelain", "--untracked-files=no"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
}

function stableFailureCode(error) {
  try {
    if (
      typeof error === "object" &&
      error !== null &&
      typeof error.safeCode === "string" &&
      /^[A-Z][A-Z0-9_]{0,63}$/.test(error.safeCode)
    ) {
      return error.safeCode;
    }
  } catch {
    // Source errors are deliberately reduced to the current stable stage.
  }
  return `${stage}_FAILED`;
}

function moduleUrl(relativePath) {
  return pathToFileURL(`${VENDOR}${relativePath}`).href;
}

function operationFrom(registry, protocolId, method) {
  const stub = registry.load([{ protocol: protocolId, method }])[0];
  if (stub === undefined) {
    throw Object.assign(new Error("operation missing"), {
      safeCode: "MOSS_OPERATION_MISSING",
    });
  }
  return {
    protocolId: stub.protocol,
    method: stub.method,
    operationKind: stub.kind === "capability" ? "CAPABILITY" : "QUERY",
    stub,
    riskLabels: stub.risk,
  };
}

function capabilityCounts(root) {
  const seen = new Set();
  let capabilityNodeCount = 0;
  let transactionNodeCount = 0;
  const visit = (node) => {
    if (typeof node !== "object" || node === null || seen.has(node)) {
      throw Object.assign(new Error("invalid capability"), {
        safeCode: "CAPABILITY_SHAPE_INVALID",
      });
    }
    seen.add(node);
    if (node.kind === "transaction") {
      transactionNodeCount += 1;
      return;
    }
    if (node.kind !== "capability" || !Array.isArray(node.children)) {
      throw Object.assign(new Error("invalid capability"), {
        safeCode: "CAPABILITY_SHAPE_INVALID",
      });
    }
    capabilityNodeCount += 1;
    for (const child of node.children) visit(child);
  };
  visit(root);
  return { kind: root.kind, capabilityNodeCount, transactionNodeCount };
}

function simulationSummary(evidence) {
  const retained = evidence.mossOriginal.retained.simulation;
  const results = retained.results;
  if (!Array.isArray(results)) {
    throw Object.assign(new Error("invalid simulation"), {
      safeCode: "SIMULATION_SHAPE_INVALID",
    });
  }
  return {
    resultCount: results.length,
    warningCount: evidence.mossOriginal.warnings.length,
    halted: retained.halted !== undefined,
    revertedCount: results.filter((result) => result.reverted === true).length,
  };
}

function emit(result) {
  if (emitted) return;
  emitted = true;
  clearTimeout(timeout);
  const output = serializeArtifact(result.artifact, rawRpcUrl);
  process.stdout.write(`${output}\n`, () => process.exit(result.exitCode));
}

const timeout = setTimeout(() => {
  emit(
    createFailureArtifact({
      observedAt: new Date().toISOString(),
      miniDemoHead,
      rpcUrl: rawRpcUrl,
      stage: "TIMEOUT",
      code: "LIVE_SMOKE_TIMEOUT",
    }),
  );
}, TIMEOUT_MS);

async function run() {
  publicRpcMetadata(rawRpcUrl);
  miniDemoHead = gitHead(ROOT);

  stage = "PIN";
  const vendorHead = gitHead(VENDOR);
  if (
    vendorHead !== PINNED_MOSS_COMMIT ||
    trackedStatus(ROOT).length > 0 ||
    trackedStatus(VENDOR).length > 0
  ) {
    throw Object.assign(new Error("wrong Moss pin"), {
      safeCode:
        vendorHead === PINNED_MOSS_COMMIT
          ? "CHECKOUT_NOT_CLEAN"
          : "MOSS_PIN_MISMATCH",
    });
  }

  stage = "IMPORT";
  const [adapter, core, pancakeswap, simulatorPackage, system] =
    await Promise.all([
      import(new URL("../../dist/index.js", import.meta.url)),
      import(moduleUrl("packages/core/dist/index.js")),
      import(moduleUrl("packages/protocols/pancakeswap/dist/index.js")),
      import(moduleUrl("packages/simulator/dist/index.js")),
      import(moduleUrl("packages/system/dist/index.js")),
    ]);
  stage = "CHAIN";
  const runtime = await core.createRuntime({ rpcUrl: rawRpcUrl });
  const registry = new core.Registry(runtime).use(pancakeswap);

  const bindings = {
    chainId: core.MONAD_CHAIN_ID,
    simulationRpcClient: {
      request: (request) => runtime.client.request(request),
    },
    buildInfo: () => adapter.MOSS_BUILD_INFO,
    describe: async (protocolId, method) =>
      operationFrom(registry, protocolId, method),
    quote: async (protocolId, input) => {
      const operation = operationFrom(registry, protocolId, input.method);
      const quote = await registry.action(
        protocolId,
        input.method,
        input.account,
        input.params,
      );
      if (quote.kind !== "query") {
        throw Object.assign(new Error("expected query"), {
          safeCode: "QUOTE_SHAPE_INVALID",
        });
      }
      return { operation, quote };
    },
    action: async (protocolId, input) => {
      const operation = operationFrom(registry, protocolId, input.method);
      const capability = await registry.action(
        protocolId,
        input.method,
        input.account,
        input.params,
      );
      if (capability.kind !== "capability") {
        throw Object.assign(new Error("expected capability"), {
          safeCode: "CAPABILITY_SHAPE_INVALID",
        });
      }
      return { operation, capability };
    },
    simulate: async (capability, rpcClient) => {
      const forwardingRuntime = {
        rpcUrl: rawRpcUrl,
        client: { request: (request) => rpcClient.request(request) },
      };
      const simulator = simulatorPackage.createTraceSimulator(
        forwardingRuntime,
        {
          receipt: (node, changes) => registry.parseReceipt(node, changes),
        },
      );
      return {
        protocolId: capability.protocol,
        method: capability.method,
        simulation: await simulator.simulate(capability),
      };
    },
  };
  const port = adapter.createProductionMossPort(bindings);

  const intent = {
    tokenIn: core.NATIVE,
    tokenOut: system.USDC_ADDRESS,
    amountIn: "1",
  };
  stage = "QUOTE";
  await port.quote(PROTOCOL_ID, {
    method: QUOTE_METHOD,
    account: ACCOUNT,
    params: intent,
  });

  stage = "ACTION";
  const action = await port.action(PROTOCOL_ID, {
    method: ACTION_METHOD,
    account: ACCOUNT,
    params: { ...intent, slippage: 50 },
  });
  const capability = action.mossOriginal.value;
  const capabilitySummary = capabilityCounts(capability);

  stage = "SIMULATION";
  const simulation = await port.simulate(capability);
  const verification = simulation.miniDemoDerived;
  const summary = simulationSummary(simulation);

  stage = "ARTIFACT";
  return createLiveArtifact({
    observedAt: new Date().toISOString(),
    miniDemoHead,
    rpcUrl: rawRpcUrl,
    mossBuild: port.buildInfo(),
    protocolId: PROTOCOL_ID,
    quoteMethod: QUOTE_METHOD,
    actionMethod: ACTION_METHOD,
    quoteCount: 1,
    capability: capabilitySummary,
    simulation: summary,
    verification: {
      simulationBlock: verification.simulationBlock,
      capabilityIntegrity: verification.capabilityIntegrity,
      receiptCoverage: verification.receiptCoverage,
      ordering: verification.ordering,
      stateContinuity: verification.stateContinuity,
    },
  });
}

try {
  emit(await run());
} catch (error) {
  emit(
    createFailureArtifact({
      observedAt: new Date().toISOString(),
      miniDemoHead,
      rpcUrl: rawRpcUrl,
      stage,
      code: stableFailureCode(error),
    }),
  );
}
