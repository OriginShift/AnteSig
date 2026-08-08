import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertSecretSafeArtifact,
  createFailureArtifact,
  createLiveArtifact,
  publicRpcMetadata,
  serializeArtifact,
} from "./artifact.mjs";

const RPC_SECRET =
  "https://rpc.example.test/private/customer?api_key=do-not-print#fragment";
const BLOCK_NUMBER = "0x123";
const BLOCK_HASH = `0x${"ab".repeat(32)}`;
const PINNED_MOSS_COMMIT = "1ae6b6322d51fae9104f047efb94e601050b967f";

function provenInput(overrides = {}) {
  return {
    observedAt: "2026-08-08T00:00:00.000Z",
    miniDemoHead: "1".repeat(40),
    rpcUrl: RPC_SECRET,
    mossBuild: {
      sourceMode: "INTEGRATION_FORK",
      upstreamRepository: "https://github.com/nishuzumi/moss",
      upstreamCommit: PINNED_MOSS_COMMIT,
      integrationRepository: "https://github.com/Moss-Mini-Demo/moss",
      integrationCommit: PINNED_MOSS_COMMIT,
      patchsetDigest:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      packages: {
        "@themoss/core": "0.1.0",
        "@themoss/simulator": "0.1.0",
        "@themoss/protocol-kuru": "0.1.0",
        "@themoss/protocol-pancakeswap": "0.1.0",
      },
      officialRelease: false,
    },
    protocolId: "pancakeswap-v2",
    quoteMethod: "quote",
    actionMethod: "swap",
    quoteCount: 1,
    capability: {
      kind: "capability",
      capabilityNodeCount: 1,
      transactionNodeCount: 1,
    },
    simulation: {
      resultCount: 1,
      warningCount: 0,
      halted: false,
      revertedCount: 0,
    },
    verification: {
      simulationBlock: {
        status: "PROVEN",
        blockNumber: BLOCK_NUMBER,
        blockHash: BLOCK_HASH,
        observation: {
          requestBlocks: [
            { method: "debug_traceCall", blockParameter: BLOCK_NUMBER },
            { method: "eth_estimateGas", blockParameter: BLOCK_NUMBER },
          ],
        },
      },
      capabilityIntegrity: "PROVEN",
      receiptCoverage: "PROVEN",
      ordering: "PROVEN",
      stateContinuity: "NOT_APPLICABLE",
    },
    ...overrides,
  };
}

describe("live smoke artifact", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("offline test attempted a network request");
      }),
    );
  });

  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reduces RPC URLs to scheme and host without path, query, or fragment", () => {
    expect(publicRpcMetadata(RPC_SECRET)).toEqual({
      scheme: "https",
      host: "rpc.example.test",
    });
    const { artifact, exitCode } = createLiveArtifact(provenInput());
    const serialized = serializeArtifact(artifact, RPC_SECRET);

    expect(exitCode).toBe(0);
    expect(artifact.result).toBe("SUCCESS");
    expect(artifact.stop).toBe(false);
    expect(artifact.provenance).toBe("LIVE_SOURCE");
    expect(serialized).not.toContain(RPC_SECRET);
    expect(serialized).not.toContain("private/customer");
    expect(serialized).not.toContain("do-not-print");
    expect(serialized).not.toContain("fragment");
  });

  it("rejects credentials, malformed URLs, and non-HTTP schemes", () => {
    expect(() =>
      publicRpcMetadata("https://user:password@rpc.example.test"),
    ).toThrow("RPC_CREDENTIALS_FORBIDDEN");
    expect(() => publicRpcMetadata("not a URL")).toThrow("INVALID_RPC_URL");
    expect(() => publicRpcMetadata("wss://rpc.example.test")).toThrow(
      "INVALID_RPC_URL",
    );
  });

  it("preserves exact proven block metadata and call block parameters", () => {
    const { artifact } = createLiveArtifact(provenInput());

    expect(artifact.verification.simulationBlock).toEqual({
      status: "PROVEN",
      blockNumber: BLOCK_NUMBER,
      blockHash: BLOCK_HASH,
      calls: [
        { method: "debug_traceCall", blockParameter: BLOCK_NUMBER },
        { method: "eth_estimateGas", blockParameter: BLOCK_NUMBER },
      ],
    });
  });

  it("classifies warnings, halt, revert, and failed verification as STOP", () => {
    const cases = [
      { simulation: { ...provenInput().simulation, warningCount: 1 } },
      { simulation: { ...provenInput().simulation, halted: true } },
      { simulation: { ...provenInput().simulation, revertedCount: 1 } },
      {
        verification: {
          ...provenInput().verification,
          receiptCoverage: "FAILED",
        },
      },
    ];

    for (const changed of cases) {
      const { artifact, exitCode } = createLiveArtifact(provenInput(changed));
      expect(artifact.result).toBe("WARNING_STOP");
      expect(artifact.stop).toBe(true);
      expect(exitCode).toBe(1);
    }
  });

  it("classifies block and required-status uncertainty as UNPROVABLE_STOP", () => {
    const unprovableBlock = {
      status: "UNPROVABLE",
      reasons: ["BLOCK_HASH_UNOBSERVABLE"],
      observation: {
        requestBlocks: [
          { method: "debug_traceCall", blockParameter: BLOCK_NUMBER },
        ],
      },
    };
    const blockResult = createLiveArtifact(
      provenInput({
        verification: {
          ...provenInput().verification,
          simulationBlock: unprovableBlock,
        },
      }),
    );
    const statusResult = createLiveArtifact(
      provenInput({
        verification: {
          ...provenInput().verification,
          ordering: "UNPROVABLE",
        },
      }),
    );

    expect(blockResult.artifact.result).toBe("UNPROVABLE_STOP");
    expect(blockResult.artifact.verification.simulationBlock.reasons).toEqual([
      "BLOCK_HASH_UNOBSERVABLE",
    ]);
    expect(statusResult.artifact.result).toBe("UNPROVABLE_STOP");
    expect(blockResult.exitCode).toBe(1);
    expect(statusResult.exitCode).toBe(1);
  });

  it("rejects zero results and incomplete quote or Capability evidence", () => {
    expect(() =>
      createLiveArtifact(
        provenInput({
          simulation: { ...provenInput().simulation, resultCount: 0 },
        }),
      ),
    ).toThrow("SIMULATION_NOT_PROVEN");
    expect(() => createLiveArtifact(provenInput({ quoteCount: 0 }))).toThrow(
      "QUOTE_NOT_PROVEN",
    );
    expect(() =>
      createLiveArtifact(
        provenInput({
          capability: {
            ...provenInput().capability,
            transactionNodeCount: 0,
          },
        }),
      ),
    ).toThrow("CAPABILITY_NOT_PROVEN");
  });

  it("rejects build metadata that differs from the exact pin", () => {
    expect(() =>
      createLiveArtifact(
        provenInput({
          mossBuild: {
            ...provenInput().mossBuild,
            patchsetDigest: `sha256:${"0".repeat(64)}`,
          },
        }),
      ),
    ).toThrow("INVALID_MOSS_BUILD_INFO");
  });

  it("creates allowlisted FAILED_STOP output without exception details", () => {
    const { artifact, exitCode } = createFailureArtifact({
      observedAt: "2026-08-08T00:00:00.000Z",
      miniDemoHead: "1".repeat(40),
      rpcUrl: RPC_SECRET,
      stage: "SIMULATION",
      code: "SIMULATION_FAILED",
    });
    const serialized = serializeArtifact(artifact, RPC_SECRET);

    expect(exitCode).toBe(1);
    expect(artifact).toMatchObject({
      result: "FAILED_STOP",
      stop: true,
      provenance: "NOT_ESTABLISHED",
      failure: { stage: "SIMULATION", code: "SIMULATION_FAILED" },
    });
    expect(serialized).not.toContain(RPC_SECRET);
    expect(serialized).not.toContain("do-not-print");
    expect(serialized).not.toContain("message");
    expect(serialized).not.toContain("stack");
  });

  it("rejects forbidden keys, raw URL leakage, and Fixture provenance", () => {
    expect(() =>
      assertSecretSafeArtifact({ authorization: "sentinel" }),
    ).toThrow("FORBIDDEN_ARTIFACT_KEY");
    expect(() =>
      assertSecretSafeArtifact({ note: RPC_SECRET }, RPC_SECRET),
    ).toThrow("RAW_RPC_URL_LEAK");
    expect(() =>
      assertSecretSafeArtifact({ provenance: "FIXTURE_SOURCE" }),
    ).toThrow("FIXTURE_PROVENANCE_FORBIDDEN");
  });
});
