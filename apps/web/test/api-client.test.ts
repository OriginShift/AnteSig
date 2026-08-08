import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import {
  PreflightClientError,
  type PreflightFetch,
  requestPreflight,
} from "../src/client/api-client";

const REQUEST = {
  contractVersion: "0.1",
  mode: "FIXTURE",
  scenario: "manual-review-success",
} as const;

const SUCCESS_RESPONSE = {
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
};

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("preflight API client", () => {
  it("posts the exact request and returns a validated success", async () => {
    const fetcher = vi.fn<PreflightFetch>(async () =>
      jsonResponse(SUCCESS_RESPONSE),
    );

    await expect(requestPreflight(REQUEST, { fetcher })).resolves.toMatchObject(
      {
        ok: true,
        mode: "FIXTURE",
        scenario: "manual-review-success",
      },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("/api/preflight");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(REQUEST),
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns a strict API error without substituting Fixture data", async () => {
    const fetcher: PreflightFetch = async () =>
      jsonResponse(
        {
          contractVersion: "0.1",
          ok: false,
          runId: "run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e",
          error: {
            code: "LIVE_UNAVAILABLE",
            message: "Live preflight is unavailable.",
          },
        },
        503,
      );

    await expect(requestPreflight(REQUEST, { fetcher })).resolves.toEqual({
      contractVersion: "0.1",
      ok: false,
      runId: "run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e",
      error: {
        code: "LIVE_UNAVAILABLE",
        message: "Live preflight is unavailable.",
      },
    });
  });

  it.each([
    ["non-JSON content", new Response("not json")],
    ["invalid contract", jsonResponse({ ok: true })],
    ["status/body mismatch", jsonResponse(SUCCESS_RESPONSE, 503)],
    [
      "declared overflow",
      jsonResponse(SUCCESS_RESPONSE, 200, { "content-length": "2097153" }),
    ],
  ])(
    "rejects %s with a stable invalid-response error",
    async (_name, response) => {
      const fetcher: PreflightFetch = async () => response;
      await expect(
        requestPreflight(REQUEST, { fetcher }),
      ).rejects.toMatchObject({
        name: "PreflightClientError",
        kind: "INVALID_RESPONSE",
        message: "The preflight service returned an invalid response.",
      });
    },
  );

  it("classifies caller cancellation separately", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher: PreflightFetch = async (_input, init) => {
      if (init?.signal?.aborted) {
        throw new DOMException("private abort detail", "AbortError");
      }
      return jsonResponse(SUCCESS_RESPONSE);
    };

    await expect(
      requestPreflight(REQUEST, { fetcher, signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: "ABORTED",
      message: "The preflight request was cancelled.",
    });
  });

  it("classifies timeout separately", async () => {
    vi.useFakeTimers();
    const fetcher: PreflightFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("late private detail", "AbortError")),
          { once: true },
        );
      });

    const request = requestPreflight(REQUEST, { fetcher, timeoutMs: 10 });
    const assertion = expect(request).rejects.toMatchObject({
      kind: "TIMEOUT",
      message: "The preflight request timed out.",
    });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it("redacts an arbitrary network exception", async () => {
    const fetcher: PreflightFetch = async () => {
      throw new Error("rpc-key=private-network-sentinel");
    };

    const error = await requestPreflight(REQUEST, { fetcher }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PreflightClientError);
    expect(error).toMatchObject({
      kind: "NETWORK",
      message: "The preflight service could not be reached.",
    });
    expect(JSON.stringify(error)).not.toContain("private-network-sentinel");
  });
});
