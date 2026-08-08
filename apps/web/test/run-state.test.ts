import { describe, expect, it } from "vitest";
import fixture from "../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import {
  INITIAL_RUN_STATE,
  type RunState,
  reduceRunState,
} from "../src/client/run-state";
import type { PreflightSuccessResponse } from "../src/contracts/preflight";

const RESPONSE = {
  contractVersion: "0.1",
  ok: true,
  runId: "run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e",
  mode: "FIXTURE",
  scenario: "manual-review-success",
  report: fixture,
  presentation: {
    schemaVersion: "0.1",
    reportId: fixture.reportId,
    decision: { status: "MANUAL_REVIEW" },
    sourceContextReferences: [],
    limitationReferences: fixture.limitations.map(
      (_limitation, index) => `/limitations/${index}`,
    ),
  },
} as unknown as PreflightSuccessResponse;

function running(token = 1): RunState {
  return { status: "RUNNING", token, startedAt: 100 };
}

describe("run state", () => {
  it("starts from the stable idle state", () => {
    expect(INITIAL_RUN_STATE).toEqual({ status: "IDLE" });
    expect(
      reduceRunState(INITIAL_RUN_STATE, {
        type: "START",
        token: 1,
        startedAt: 100,
      }),
    ).toEqual(running());
  });

  it("rejects a duplicate start while one run is active", () => {
    const state = running();
    expect(
      reduceRunState(state, { type: "START", token: 2, startedAt: 101 }),
    ).toBe(state);
  });

  it("records only the matching successful response", () => {
    expect(
      reduceRunState(running(), {
        type: "RESOLVE",
        token: 1,
        completedAt: 120,
        response: RESPONSE,
      }),
    ).toEqual({
      status: "RESULT",
      token: 1,
      completedAt: 120,
      response: RESPONSE,
    });
  });

  it("records abort, timeout, network, API, and invalid-response errors distinctly", () => {
    for (const kind of [
      "ABORTED",
      "TIMEOUT",
      "NETWORK",
      "API",
      "INVALID_RESPONSE",
    ] as const) {
      expect(
        reduceRunState(running(), {
          type: "REJECT",
          token: 1,
          completedAt: 120,
          problem: {
            kind,
            code: kind,
            message: `${kind} message`,
            mode: "LIVE",
          },
        }),
      ).toMatchObject({
        status: "ERROR",
        problem: { kind, mode: "LIVE" },
      });
    }
  });

  it("ignores a stale success and stale error", () => {
    const state = running(2);
    expect(
      reduceRunState(state, {
        type: "RESOLVE",
        token: 1,
        completedAt: 120,
        response: RESPONSE,
      }),
    ).toBe(state);
    expect(
      reduceRunState(state, {
        type: "REJECT",
        token: 1,
        completedAt: 120,
        problem: {
          kind: "NETWORK",
          code: "NETWORK",
          message: "Network",
          mode: "LIVE",
        },
      }),
    ).toBe(state);
  });

  it("retains the failed mode and server runId for an explicit recovery", () => {
    expect(
      reduceRunState(running(), {
        type: "REJECT",
        token: 1,
        completedAt: 120,
        problem: {
          kind: "API",
          code: "LIVE_UNAVAILABLE",
          message: "Live preflight is unavailable.",
          mode: "LIVE",
          runId: "run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e",
        },
      }),
    ).toMatchObject({
      status: "ERROR",
      problem: {
        code: "LIVE_UNAVAILABLE",
        mode: "LIVE",
        runId: "run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e",
      },
    });
  });

  it("supersedes a run before accepting the newest response", () => {
    const replaced = reduceRunState(running(1), {
      type: "SUPERSEDE",
      token: 2,
      startedAt: 110,
    });
    const afterStale = reduceRunState(replaced, {
      type: "RESOLVE",
      token: 1,
      completedAt: 120,
      response: RESPONSE,
    });
    expect(afterStale).toBe(replaced);
    expect(
      reduceRunState(afterStale, {
        type: "RESOLVE",
        token: 2,
        completedAt: 121,
        response: RESPONSE,
      }),
    ).toMatchObject({ status: "RESULT", token: 2 });
  });

  it("resets result and error states without retaining evidence", () => {
    const result = reduceRunState(running(), {
      type: "RESOLVE",
      token: 1,
      completedAt: 120,
      response: RESPONSE,
    });
    expect(reduceRunState(result, { type: "RESET" })).toEqual(
      INITIAL_RUN_STATE,
    );
  });
});
