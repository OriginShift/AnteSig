"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { PreflightClientError, requestPreflight } from "../client/api-client";
import {
  INITIAL_RUN_STATE,
  type RunProblem,
  reduceRunState,
} from "../client/run-state";
import type { PreflightRequest } from "../contracts/preflight";

const SAMPLE_REQUEST = {
  contractVersion: "0.1",
  mode: "FIXTURE",
  scenario: "manual-review-success",
} as const satisfies PreflightRequest;

function stateDescription(status: string): string {
  switch (status) {
    case "RUNNING":
      return "Request in progress";
    case "RESULT":
      return "Validated response received";
    case "ERROR":
      return "Request did not complete";
    default:
      return "No active request";
  }
}

export function WorkbenchShell() {
  const [state, dispatch] = useReducer(reduceRunState, INITIAL_RUN_STATE);
  const activeRun = useRef<
    { controller: AbortController; token: number } | undefined
  >(undefined);
  const nextToken = useRef(0);
  const resultRegion = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state.status === "RESULT" || state.status === "ERROR") {
      resultRegion.current?.focus();
    }
  }, [state.status]);

  useEffect(
    () => () => {
      activeRun.current?.controller.abort();
    },
    [],
  );

  const runPreflight = useCallback(async () => {
    if (activeRun.current) return;

    const token = ++nextToken.current;
    const controller = new AbortController();
    activeRun.current = { controller, token };
    dispatch({ type: "START", token, startedAt: Date.now() });

    try {
      const response = await requestPreflight(SAMPLE_REQUEST, {
        signal: controller.signal,
      });
      if (response.ok) {
        dispatch({
          type: "RESOLVE",
          token,
          completedAt: Date.now(),
          response,
        });
      } else {
        dispatch({
          type: "REJECT",
          token,
          completedAt: Date.now(),
          problem: {
            kind: "API",
            code: response.error.code,
            message: response.error.message,
          },
        });
      }
    } catch (error) {
      const problem: RunProblem =
        error instanceof PreflightClientError
          ? { kind: error.kind, code: error.kind, message: error.message }
          : {
              kind: "NETWORK",
              code: "NETWORK",
              message: "The preflight service could not be reached.",
            };
      dispatch({
        type: "REJECT",
        token,
        completedAt: Date.now(),
        problem,
      });
    } finally {
      if (activeRun.current?.token === token) activeRun.current = undefined;
    }
  }, []);

  const cancelRun = useCallback(() => {
    const active = activeRun.current;
    if (!active) return;
    active.controller.abort();
    dispatch({
      type: "REJECT",
      token: active.token,
      completedAt: Date.now(),
      problem: {
        kind: "ABORTED",
        code: "ABORTED",
        message: "The preflight request was cancelled.",
      },
    });
    activeRun.current = undefined;
  }, []);

  return (
    <div className="workbench-shell">
      <header className="app-bar">
        <div className="brand-lockup">
          <span className="brand-name">Moss-Mini Demo</span>
          <span className="brand-surface">Preflight workbench</span>
        </div>
        <ul aria-label="Environment" className="environment-list">
          <li className="environment-item">Network: awaiting run</li>
          <li className="environment-item">Optional profile: disabled</li>
        </ul>
      </header>

      <main className="workbench-main">
        <div className="workbench-heading">
          <div>
            <h1>Preflight workbench</h1>
            <p>Run state and strict API response boundary</p>
          </div>
          <span className={`state-badge ${state.status.toLowerCase()}`}>
            {state.status}
          </span>
        </div>

        <div className="workbench-grid">
          <section className="control-pane" aria-labelledby="request-heading">
            <div className="pane-heading">
              <h2 id="request-heading">Run input</h2>
              <p>Synthetic development request</p>
            </div>
            <dl className="request-facts">
              <div>
                <dt>Mode</dt>
                <dd>Fixture</dd>
              </div>
              <div>
                <dt>Scenario</dt>
                <dd>manual-review-success</dd>
              </div>
              <div>
                <dt>Contract</dt>
                <dd>Preflight v0.1</dd>
              </div>
              <div>
                <dt>Endpoint</dt>
                <dd>/api/preflight</dd>
              </div>
            </dl>
            <div className="run-actions">
              <button
                className="command-button primary"
                disabled={state.status === "RUNNING"}
                onClick={runPreflight}
                type="button"
              >
                {state.status === "RUNNING"
                  ? "Running preflight"
                  : "Run preflight"}
              </button>
              {state.status === "RUNNING" ? (
                <button
                  className="command-button secondary"
                  onClick={cancelRun}
                  type="button"
                >
                  Cancel run
                </button>
              ) : null}
            </div>
          </section>

          <section className="result-pane" aria-labelledby="result-heading">
            <div className="result-header">
              <div>
                <h2 id="result-heading">Run result</h2>
                <p>{stateDescription(state.status)}</p>
              </div>
              {state.status === "RESULT" ? (
                <span className="provenance-badge">
                  {state.response.report.provenance}
                </span>
              ) : null}
            </div>

            <section
              aria-busy={state.status === "RUNNING"}
              aria-live="polite"
              className="result-surface"
              ref={resultRegion}
              tabIndex={-1}
            >
              {state.status === "IDLE" ? (
                <div className="empty-state">
                  <h3>No run selected</h3>
                  <p>
                    Result identifiers and bounded Decision output appear here.
                  </p>
                </div>
              ) : null}

              {state.status === "RUNNING" ? (
                <div className="loading-state">
                  <span className="loading-indicator" aria-hidden="true" />
                  <h3>Running preflight</h3>
                  <p>Waiting for the server-validated response.</p>
                </div>
              ) : null}

              {state.status === "RESULT" ? (
                <div className="result-content">
                  <div
                    className={`decision-banner ${
                      state.response.report.decision.status === "STOP"
                        ? "stop"
                        : ""
                    }`}
                  >
                    <div>
                      <strong>Decision</strong>
                      <p>Human review remains required.</p>
                    </div>
                    <span className="decision-value">
                      {state.response.report.decision.status}
                    </span>
                  </div>
                  <dl className="result-facts">
                    <div>
                      <dt>Run ID</dt>
                      <dd>{state.response.runId}</dd>
                    </div>
                    <div>
                      <dt>Report ID</dt>
                      <dd>{state.response.report.reportId}</dd>
                    </div>
                    <div>
                      <dt>Mode</dt>
                      <dd>{state.response.mode}</dd>
                    </div>
                    <div>
                      <dt>Network</dt>
                      <dd>{state.response.report.network}</dd>
                    </div>
                    <div>
                      <dt>Limitations</dt>
                      <dd>{state.response.report.limitations.length}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {state.status === "ERROR" ? (
                <div className="error-state">
                  <span className="error-code">{state.problem.code}</span>
                  <h3>Run unavailable</h3>
                  <p>{state.problem.message}</p>
                  <button
                    className="command-button secondary"
                    onClick={runPreflight}
                    type="button"
                  >
                    Retry preflight
                  </button>
                </div>
              ) : null}
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
