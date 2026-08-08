const SCHEMA_VERSION = "moss-mini-demo/live-smoke/v0.1";
const NETWORK = "eip155:143";
const PINNED_MOSS_COMMIT = "1ae6b6322d51fae9104f047efb94e601050b967f";
const PATCHSET_DIGEST =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const MOSS_PACKAGES = Object.freeze({
  "@themoss/core": "0.1.0",
  "@themoss/simulator": "0.1.0",
  "@themoss/protocol-kuru": "0.1.0",
  "@themoss/protocol-pancakeswap": "0.1.0",
});
const SHA = /^[0-9a-f]{40}$/;
const BLOCK_NUMBER = /^0x(?:0|[1-9a-f][0-9a-f]*)$/;
const BLOCK_HASH = /^0x[0-9a-f]{64}$/;
const SAFE_FAILURE_VALUE = /^[A-Z][A-Z0-9_]{0,63}$/;
const FORBIDDEN_KEYS = new Set([
  "apikey",
  "authorization",
  "cause",
  "cookie",
  "credential",
  "credentials",
  "error",
  "exception",
  "fragment",
  "header",
  "headers",
  "message",
  "params",
  "password",
  "path",
  "query",
  "rpcurl",
  "secret",
  "stack",
  "token",
  "url",
  "username",
]);
const REQUIRED_PROVEN = ["capabilityIntegrity", "receiptCoverage", "ordering"];

function fail(code) {
  const error = new Error(code);
  error.safeCode = code;
  throw error;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function assertIsoDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail("INVALID_OBSERVED_AT");
  }
}

function assertBuildInfo(value) {
  const packages = isRecord(value) ? value.packages : undefined;
  if (
    !isRecord(value) ||
    value.sourceMode !== "INTEGRATION_FORK" ||
    value.upstreamRepository !== "https://github.com/nishuzumi/moss" ||
    value.upstreamCommit !== PINNED_MOSS_COMMIT ||
    value.integrationRepository !== "https://github.com/Moss-Mini-Demo/moss" ||
    value.integrationCommit !== PINNED_MOSS_COMMIT ||
    value.patchsetDigest !== PATCHSET_DIGEST ||
    value.officialRelease !== false ||
    !isRecord(packages) ||
    Object.keys(packages).length !== Object.keys(MOSS_PACKAGES).length ||
    !Object.entries(MOSS_PACKAGES).every(
      ([name, version]) => packages[name] === version,
    )
  ) {
    fail("INVALID_MOSS_BUILD_INFO");
  }
}

function assertVerificationStatus(value) {
  if (!new Set(["PROVEN", "FAILED", "UNPROVABLE"]).has(value)) {
    fail("INVALID_VERIFICATION_STATUS");
  }
}

function cloneJson(value) {
  try {
    return structuredClone(value);
  } catch {
    fail("ARTIFACT_NOT_JSON_SAFE");
  }
}

export function publicRpcMetadata(rawRpcUrl) {
  if (typeof rawRpcUrl !== "string" || rawRpcUrl.trim() !== rawRpcUrl) {
    fail("INVALID_RPC_URL");
  }
  let parsed;
  try {
    parsed = new URL(rawRpcUrl);
  } catch {
    fail("INVALID_RPC_URL");
  }
  if (
    !new Set(["http:", "https:"]).has(parsed.protocol) ||
    parsed.hostname.length === 0
  ) {
    fail("INVALID_RPC_URL");
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    fail("RPC_CREDENTIALS_FORBIDDEN");
  }
  return Object.freeze({
    scheme: parsed.protocol.slice(0, -1),
    host: parsed.host.toLowerCase(),
  });
}

function reducedBlock(block) {
  if (!isRecord(block) || !isRecord(block.observation)) {
    fail("INVALID_BLOCK_EVIDENCE");
  }
  const calls = block.observation.requestBlocks;
  if (
    !Array.isArray(calls) ||
    !calls.every(
      (call) =>
        isRecord(call) &&
        new Set(["debug_traceCall", "eth_estimateGas"]).has(call.method) &&
        (call.blockParameter === null ||
          (typeof call.blockParameter === "string" &&
            BLOCK_NUMBER.test(call.blockParameter))),
    )
  ) {
    fail("INVALID_BLOCK_CALLS");
  }
  const publicCalls = calls.map(({ method, blockParameter }) => ({
    method,
    blockParameter,
  }));

  if (block.status === "PROVEN") {
    if (
      typeof block.blockNumber !== "string" ||
      !BLOCK_NUMBER.test(block.blockNumber) ||
      typeof block.blockHash !== "string" ||
      !BLOCK_HASH.test(block.blockHash) ||
      !publicCalls.some(({ method }) => method === "debug_traceCall")
    ) {
      fail("INVALID_PROVEN_BLOCK");
    }
    return {
      status: "PROVEN",
      blockNumber: block.blockNumber.toLowerCase(),
      blockHash: block.blockHash.toLowerCase(),
      calls: publicCalls,
    };
  }

  if (
    block.status !== "UNPROVABLE" ||
    !Array.isArray(block.reasons) ||
    block.reasons.length === 0 ||
    !block.reasons.every(
      (reason) => typeof reason === "string" && SAFE_FAILURE_VALUE.test(reason),
    )
  ) {
    fail("INVALID_UNPROVABLE_BLOCK");
  }
  return {
    status: "UNPROVABLE",
    reasons: [...new Set(block.reasons)].sort(),
    calls: publicCalls,
  };
}

function classification({ simulation, verification }) {
  const values = REQUIRED_PROVEN.map((key) => verification[key]);
  if (verification.stateContinuity !== "NOT_APPLICABLE") {
    values.push(verification.stateContinuity);
  }
  if (
    verification.simulationBlock.status === "UNPROVABLE" ||
    values.includes("UNPROVABLE")
  ) {
    return Object.freeze({
      result: "UNPROVABLE_STOP",
      stop: true,
      exitCode: 1,
    });
  }
  if (
    simulation.warningCount > 0 ||
    simulation.halted ||
    simulation.revertedCount > 0 ||
    values.includes("FAILED")
  ) {
    return Object.freeze({
      result: "WARNING_STOP",
      stop: true,
      exitCode: 1,
    });
  }
  return Object.freeze({ result: "SUCCESS", stop: false, exitCode: 0 });
}

export function createLiveArtifact(input) {
  if (!isRecord(input)) {
    fail("INVALID_LIVE_INPUT");
  }
  assertIsoDate(input.observedAt);
  if (typeof input.miniDemoHead !== "string" || !SHA.test(input.miniDemoHead)) {
    fail("INVALID_MINI_DEMO_HEAD");
  }
  assertBuildInfo(input.mossBuild);
  if (
    input.protocolId !== "pancakeswap-v2" ||
    input.quoteMethod !== "quote" ||
    input.actionMethod !== "swap"
  ) {
    fail("INVALID_PROTOCOL_SEQUENCE");
  }
  if (input.quoteCount !== 1) {
    fail("QUOTE_NOT_PROVEN");
  }
  if (
    !isRecord(input.capability) ||
    input.capability.kind !== "capability" ||
    !isNonNegativeInteger(input.capability.capabilityNodeCount) ||
    input.capability.capabilityNodeCount < 1 ||
    !isNonNegativeInteger(input.capability.transactionNodeCount) ||
    input.capability.transactionNodeCount < 1
  ) {
    fail("CAPABILITY_NOT_PROVEN");
  }
  if (
    !isRecord(input.simulation) ||
    !isNonNegativeInteger(input.simulation.resultCount) ||
    input.simulation.resultCount < 1 ||
    !isNonNegativeInteger(input.simulation.warningCount) ||
    typeof input.simulation.halted !== "boolean" ||
    !isNonNegativeInteger(input.simulation.revertedCount)
  ) {
    fail("SIMULATION_NOT_PROVEN");
  }
  if (!isRecord(input.verification)) {
    fail("INVALID_VERIFICATION");
  }
  for (const key of REQUIRED_PROVEN) {
    assertVerificationStatus(input.verification[key]);
  }
  if (
    !new Set(["PROVEN", "FAILED", "UNPROVABLE", "NOT_APPLICABLE"]).has(
      input.verification.stateContinuity,
    )
  ) {
    fail("INVALID_VERIFICATION_STATUS");
  }

  const simulationBlock = reducedBlock(input.verification.simulationBlock);
  const publicVerification = {
    simulationBlock,
    capabilityIntegrity: input.verification.capabilityIntegrity,
    receiptCoverage: input.verification.receiptCoverage,
    ordering: input.verification.ordering,
    stateContinuity: input.verification.stateContinuity,
  };
  const disposition = classification({
    simulation: input.simulation,
    verification: publicVerification,
  });
  const artifact = {
    schemaVersion: SCHEMA_VERSION,
    observedAt: input.observedAt,
    result: disposition.result,
    stop: disposition.stop,
    provenance: "LIVE_SOURCE",
    network: NETWORK,
    miniDemoHead: input.miniDemoHead,
    mossBuild: cloneJson(input.mossBuild),
    rpc: publicRpcMetadata(input.rpcUrl),
    protocol: {
      id: input.protocolId,
      quoteMethod: input.quoteMethod,
      actionMethod: input.actionMethod,
    },
    quote: { successfulCount: input.quoteCount },
    capability: cloneJson(input.capability),
    simulation: cloneJson(input.simulation),
    verification: publicVerification,
  };
  assertSecretSafeArtifact(artifact, input.rpcUrl);
  return Object.freeze({
    artifact: cloneJson(artifact),
    exitCode: disposition.exitCode,
  });
}

export function createFailureArtifact(input) {
  if (!isRecord(input)) {
    fail("INVALID_FAILURE_INPUT");
  }
  assertIsoDate(input.observedAt);
  if (
    typeof input.stage !== "string" ||
    !SAFE_FAILURE_VALUE.test(input.stage) ||
    typeof input.code !== "string" ||
    !SAFE_FAILURE_VALUE.test(input.code)
  ) {
    fail("INVALID_FAILURE_CODE");
  }
  const miniDemoHead =
    typeof input.miniDemoHead === "string" && SHA.test(input.miniDemoHead)
      ? input.miniDemoHead
      : null;
  let rpc = null;
  try {
    rpc = publicRpcMetadata(input.rpcUrl);
  } catch {
    rpc = null;
  }
  const artifact = {
    schemaVersion: SCHEMA_VERSION,
    observedAt: input.observedAt,
    result: "FAILED_STOP",
    stop: true,
    provenance: "NOT_ESTABLISHED",
    network: NETWORK,
    miniDemoHead,
    rpc,
    failure: { stage: input.stage, code: input.code },
  };
  assertSecretSafeArtifact(artifact, input.rpcUrl);
  return Object.freeze({ artifact: cloneJson(artifact), exitCode: 1 });
}

export function assertSecretSafeArtifact(artifact, rawRpcUrl = "") {
  const seen = new WeakSet();
  const visit = (value) => {
    if (value === null || typeof value !== "object") {
      if (
        typeof value === "string" &&
        rawRpcUrl.length > 0 &&
        value.includes(rawRpcUrl)
      ) {
        fail("RAW_RPC_URL_LEAK");
      }
      return;
    }
    if (seen.has(value)) {
      fail("ARTIFACT_NOT_JSON_SAFE");
    }
    seen.add(value);
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
    } else {
      for (const [key, entry] of Object.entries(value)) {
        const normalized = key.replaceAll(/[^A-Za-z0-9]/g, "").toLowerCase();
        if (FORBIDDEN_KEYS.has(normalized)) {
          fail("FORBIDDEN_ARTIFACT_KEY");
        }
        visit(entry);
      }
    }
    seen.delete(value);
  };
  visit(artifact);
  let serialized;
  try {
    serialized = JSON.stringify(artifact);
  } catch {
    fail("ARTIFACT_NOT_JSON_SAFE");
  }
  if (rawRpcUrl.length > 0 && serialized.includes(rawRpcUrl)) {
    fail("RAW_RPC_URL_LEAK");
  }
  if (serialized.includes("FIXTURE")) {
    fail("FIXTURE_PROVENANCE_FORBIDDEN");
  }
  return true;
}

export function serializeArtifact(artifact, rawRpcUrl = "") {
  assertSecretSafeArtifact(artifact, rawRpcUrl);
  return JSON.stringify(artifact);
}
