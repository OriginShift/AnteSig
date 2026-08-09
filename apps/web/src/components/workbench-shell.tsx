"use client";

import Image from "next/image";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { PreflightClientError, requestPreflight } from "../client/api-client";
import {
  EMPTY_INTENT_DRAFT,
  type IntentDraft,
  type IntentErrors,
  validateIntentDraft,
} from "../client/intent-form";
import {
  createFixtureRequest,
  type RunnableFixtureScenario,
  type WorkbenchMode,
} from "../client/run-controls";
import {
  INITIAL_RUN_STATE,
  type RunProblem,
  reduceRunState,
} from "../client/run-state";
import type { PreflightRequest, RunId } from "../contracts/preflight";
import { AlignmentList } from "./alignment-list";
import { CapabilityInspector } from "./capability-inspector";
import { ComparisonStrip } from "./comparison-strip";
import { CoreTension } from "./core-tension";
import { CredentialActions } from "./credential-actions";
import { DecisionBanner } from "./decision-banner";
import { EvidenceTimeline } from "./evidence-timeline";
import { IntentForm } from "./intent-form";
import { ProvenanceBadge } from "./provenance-badge";
import { QuoteComparison } from "./quote-comparison";
import { RunControls } from "./run-controls";
import { StopDetails } from "./stop-details";

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

function reportAsset(
  asset: { kind: "NATIVE" } | { kind: "ERC20"; address: string },
) {
  return asset.kind === "NATIVE" ? "NATIVE (no token address)" : asset.address;
}

type LiveRecovery = Readonly<{
  code: string;
  message: string;
  runId?: RunId;
}>;

function LiveRecoveryAudit({
  recoveredRunId,
  recovery,
}: Readonly<{
  recoveredRunId?: RunId;
  recovery: LiveRecovery;
}>) {
  return (
    <section
      aria-labelledby="recovery-heading"
      className={`recovery-audit ${recoveredRunId ? "complete" : "pending"}`}
    >
      <span className="recovery-eyebrow">Explicit recovery</span>
      <h3 id="recovery-heading">Live failure retained</h3>
      <p>
        {recovery.code}: {recovery.message}
      </p>
      <dl className="recovery-facts">
        <div>
          <dt>Failed source</dt>
          <dd>LIVE</dd>
        </div>
        <div>
          <dt>Failed run ID</dt>
          <dd data-run-id={recovery.runId ? "true" : undefined}>
            {recovery.runId ?? "not returned by the server"}
          </dd>
        </div>
        <div>
          <dt>Recovery source</dt>
          <dd>{recoveredRunId ? "FIXTURE" : "awaiting Fixture run"}</dd>
        </div>
        <div>
          <dt>Recovery run ID</dt>
          <dd data-run-id={recoveredRunId ? "true" : undefined}>
            {recoveredRunId ?? "not created"}
          </dd>
        </div>
        <div>
          <dt>Recovery state</dt>
          <dd>{recoveredRunId ? "COMPLETE" : "PENDING"}</dd>
        </div>
        <div>
          <dt>Evidence reuse</dt>
          <dd>NONE</dd>
        </div>
      </dl>
    </section>
  );
}

export function WorkbenchShell({
  clear402Enabled,
}: Readonly<{ clear402Enabled: boolean }>) {
  const [state, dispatch] = useReducer(reduceRunState, INITIAL_RUN_STATE);
  const [mode, setMode] = useState<WorkbenchMode>("LIVE");
  const [intentDraft, setIntentDraft] =
    useState<IntentDraft>(EMPTY_INTENT_DRAFT);
  const [intentErrors, setIntentErrors] = useState<IntentErrors>({});
  const [fixtureScenario, setFixtureScenario] = useState<
    RunnableFixtureScenario | undefined
  >(undefined);
  const [liveRecovery, setLiveRecovery] = useState<LiveRecovery | undefined>();
  const activeRun = useRef<
    { controller: AbortController; token: number } | undefined
  >(undefined);
  const nextToken = useRef(0);
  const controlPane = useRef<HTMLElement>(null);
  const resultRegion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "RESULT" || state.status === "ERROR") {
      const target = resultRegion.current;
      requestAnimationFrame(() => {
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start" });
      });
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

    let request: PreflightRequest | undefined;
    if (mode === "LIVE") {
      const validation = validateIntentDraft(intentDraft);
      if (!validation.ok) {
        setIntentErrors(validation.errors);
        requestAnimationFrame(() => {
          controlPane.current
            ?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')
            ?.focus();
        });
        return;
      }
      setIntentErrors({});
      request = validation.request;
    } else {
      request = createFixtureRequest(fixtureScenario);
      if (request === undefined) return;
    }
    const requestMode = request.mode;

    const token = ++nextToken.current;
    const controller = new AbortController();
    activeRun.current = { controller, token };
    dispatch({ type: "START", token, startedAt: Date.now() });

    try {
      const response = await requestPreflight(request, {
        signal: controller.signal,
      });
      if (response.ok) {
        if (response.mode === "LIVE") setLiveRecovery(undefined);
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
            mode: requestMode,
            runId: response.runId,
          },
        });
      }
    } catch (error) {
      const problem: RunProblem =
        error instanceof PreflightClientError
          ? {
              kind: error.kind,
              code: error.kind,
              message: error.message,
              mode: requestMode,
            }
          : {
              kind: "NETWORK",
              code: "NETWORK",
              message: "The preflight service could not be reached.",
              mode: requestMode,
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
  }, [fixtureScenario, intentDraft, mode]);

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
        mode,
      },
    });
    activeRun.current = undefined;
  }, [mode]);

  const changeMode = useCallback(
    (nextMode: WorkbenchMode) => {
      if (nextMode === mode) return;
      if (
        nextMode === "FIXTURE" &&
        state.status === "ERROR" &&
        state.problem.mode === "LIVE"
      ) {
        setLiveRecovery({
          code: state.problem.code,
          message: state.problem.message,
          runId: state.problem.runId,
        });
      } else {
        setLiveRecovery(undefined);
      }
      setMode(nextMode);
      setIntentErrors({});
      setFixtureScenario(undefined);
      dispatch({ type: "RESET" });
    },
    [mode, state],
  );

  const loadFixture = useCallback((scenario: RunnableFixtureScenario) => {
    setFixtureScenario(scenario);
    dispatch({ type: "RESET" });
  }, []);

  const report = state.status === "RESULT" ? state.response.report : undefined;
  const credentialExtension =
    state.status === "RESULT" && clear402Enabled && "clear402" in state.response
      ? state.response.clear402
      : undefined;
  const recoveredRunId =
    liveRecovery &&
    state.status === "RESULT" &&
    state.response.mode === "FIXTURE"
      ? state.response.runId
      : undefined;

  return (
    <div className={`workbench-shell status-${state.status.toLowerCase()}`}>
      <header className="app-bar">
        <a className="brand-lockup" href="#page-top" aria-label="AnteSig home">
          <Image
            alt="AnteSig logo"
            className="brand-logo"
            height={1168}
            priority
            sizes="58px"
            src="/brand/antesig-logo.png"
            width={1188}
          />
          <span className="brand-copy">
            <span className="brand-name">AnteSig</span>
            <span className="brand-surface">Preflight workbench</span>
          </span>
        </a>
        <ul aria-label="Environment" className="environment-list">
          <li
            className="environment-item"
            title={`Network: ${report?.network ?? "awaiting run"}`}
          >
            Network: {report?.network ?? "awaiting run"}
          </li>
          <li
            className="environment-item"
            title={`Optional profile: ${clear402Enabled ? "Clear402 enabled" : "disabled"}`}
          >
            Optional profile:{" "}
            {clear402Enabled ? "Clear402 enabled" : "disabled"}
          </li>
        </ul>
      </header>

      <section
        className="forensic-intro"
        id="page-top"
        aria-labelledby="intro-heading"
      >
        <div className="intro-technical-frame" aria-hidden="true" />
        <div className="intro-provenance">
          <span className="intro-provenance-mark" aria-hidden="true">
            •—•
          </span>
          <span>Provenance</span>
          <strong>
            {mode === "FIXTURE"
              ? fixtureScenario
                ? "FIXTURE"
                : "FIXTURE NOT LOADED"
              : "LIVE INPUT"}
          </strong>
        </div>

        <div className="intro-copy">
          <span className="intro-chapter">01 · Evidence boundary</span>
          <h1 id="intro-heading">Evidence before action.</h1>
          <p>Inspect intent. Preserve evidence. Stop before signer.</p>
          <a className="intro-cta" href="#preflight-workbench">
            <span>Run preflight</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>

        <ol className="intro-evidence-spine" aria-label="Evidence sequence">
          <li>
            <span>01</span>
            <strong>Intent</strong>
          </li>
          <li>
            <span>02</span>
            <strong>Capability</strong>
          </li>
          <li>
            <span>03</span>
            <strong>Simulation</strong>
          </li>
          <li>
            <span>04</span>
            <strong>Decision</strong>
          </li>
        </ol>
      </section>

      <main className="workbench-main" id="preflight-workbench">
        <div className="workbench-heading">
          <div>
            <span className="workbench-kicker">Evidence ledger / v0.1</span>
            <h2>Exact-input Swap preflight</h2>
            <p>Structured intent, protocol quotes and evidence provenance</p>
          </div>
          <span className={`state-badge ${state.status.toLowerCase()}`}>
            {state.status}
          </span>
        </div>

        <div className="workbench-grid">
          <section
            className="control-pane"
            aria-labelledby="request-heading"
            ref={controlPane}
          >
            <div className="pane-heading">
              <h2 id="request-heading">Run input</h2>
              <p>Contract v0.1 · /api/preflight</p>
            </div>

            <RunControls
              canRun={mode === "LIVE" || fixtureScenario !== undefined}
              fixtureScenario={fixtureScenario}
              mode={mode}
              onCancel={cancelRun}
              onLoadFixture={loadFixture}
              onModeChange={changeMode}
              onRun={runPreflight}
              running={state.status === "RUNNING"}
            />

            {mode === "LIVE" ? (
              <IntentForm
                disabled={state.status === "RUNNING"}
                draft={intentDraft}
                errors={intentErrors}
                onChange={(draft) => {
                  setIntentDraft(draft);
                  setIntentErrors({});
                }}
              />
            ) : (
              <dl className="fixture-request-facts">
                <div>
                  <dt>Request mode</dt>
                  <dd>FIXTURE</dd>
                </div>
                <div>
                  <dt>Scenario</dt>
                  <dd>{fixtureScenario ?? "not loaded"}</dd>
                </div>
                <div>
                  <dt>Payload boundary</dt>
                  <dd>Fixed enum request</dd>
                </div>
              </dl>
            )}
          </section>

          <section className="result-pane" aria-labelledby="result-heading">
            <div className="result-header" ref={resultRegion} tabIndex={-1}>
              <div>
                <h2 id="result-heading">Run result</h2>
                <p>{stateDescription(state.status)}</p>
              </div>
              <ProvenanceBadge
                fixtureLoaded={fixtureScenario !== undefined}
                mode={mode}
                provenance={report?.provenance}
              />
            </div>

            <section
              aria-busy={state.status === "RUNNING"}
              aria-live="polite"
              className="result-surface"
            >
              {liveRecovery ? (
                <LiveRecoveryAudit
                  recoveredRunId={recoveredRunId}
                  recovery={liveRecovery}
                />
              ) : null}

              {state.status === "IDLE" ? (
                <div className="empty-state">
                  <span className="empty-state-index" aria-hidden="true">
                    01—06
                  </span>
                  <h3>No result</h3>
                  <p>
                    Run identifiers and bounded Decision output appear here.
                  </p>
                  <ol className="empty-evidence-track" aria-hidden="true">
                    <li>Intent</li>
                    <li>Prepared</li>
                    <li>Simulation</li>
                    <li>Decision</li>
                  </ol>
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
                <div
                  className={`result-content decision-${state.response.presentation.decision.status.toLowerCase()}`}
                >
                  <DecisionBanner
                    limitations={state.response.report.limitations}
                    presentation={state.response.presentation}
                  />

                  <CoreTension
                    input={{
                      capability: state.response.report.capability,
                      intent: state.response.report.intent,
                      quotes: state.response.report.quotes,
                      selection: state.response.report.selection,
                      simulation: state.response.report.simulation,
                    }}
                    provenance={state.response.report.provenance}
                  />

                  {credentialExtension ? (
                    <CredentialActions extension={credentialExtension} />
                  ) : null}

                  <ComparisonStrip
                    capability={state.response.report.capability}
                    intent={state.response.report.intent}
                    provenance={state.response.report.provenance}
                    quotes={state.response.report.quotes}
                    selection={state.response.report.selection}
                    simulation={state.response.report.simulation}
                  />

                  <AlignmentList
                    checks={state.response.report.alignment.checks}
                  />

                  <dl className="result-facts">
                    <div>
                      <dt>Run ID</dt>
                      <dd data-run-id="true">{state.response.runId}</dd>
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
                      <dt>Provenance</dt>
                      <dd>{state.response.report.provenance}</dd>
                    </div>
                    <div>
                      <dt>Network</dt>
                      <dd>{state.response.report.network}</dd>
                    </div>
                  </dl>

                  <section
                    className="report-intent"
                    aria-labelledby="intent-heading"
                  >
                    <div className="section-heading">
                      <div>
                        <h3 id="intent-heading">Report intent</h3>
                        <p>Server-validated contract values</p>
                      </div>
                    </div>
                    <dl className="report-intent-facts">
                      <div>
                        <dt>Account</dt>
                        <dd>{state.response.report.intent.account}</dd>
                      </div>
                      <div>
                        <dt>Input asset</dt>
                        <dd>
                          {reportAsset(state.response.report.intent.inputAsset)}
                        </dd>
                      </div>
                      <div>
                        <dt>Output token</dt>
                        <dd>
                          {reportAsset(
                            state.response.report.intent.outputAsset,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Amount in</dt>
                        <dd>{state.response.report.intent.inputAmount}</dd>
                      </div>
                      <div>
                        <dt>Slippage</dt>
                        <dd>
                          {state.response.report.intent.maxSlippageBps} bps
                        </dd>
                      </div>
                      <div>
                        <dt>Allowlist</dt>
                        <dd>
                          {state.response.report.intent.allowedProtocols.join(
                            ", ",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Recipient</dt>
                        <dd>
                          {state.response.report.intent.recipient ??
                            "account default"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <QuoteComparison
                    quotes={state.response.report.quotes}
                    selection={state.response.report.selection}
                  />

                  <CapabilityInspector
                    capability={state.response.report.capability}
                    limitations={state.response.report.limitations}
                    provenance={state.response.report.provenance}
                  />

                  <EvidenceTimeline
                    provenance={state.response.report.provenance}
                    simulation={state.response.report.simulation}
                  />

                  <StopDetails
                    presentation={state.response.presentation}
                    provenance={state.response.report.provenance}
                  />
                </div>
              ) : null}

              {state.status === "ERROR" ? (
                <div className="error-state">
                  <span className="error-code">{state.problem.code}</span>
                  <h3>Run unavailable</h3>
                  <p>{state.problem.message}</p>
                  <dl className="error-run-facts">
                    <div>
                      <dt>Request mode</dt>
                      <dd>{state.problem.mode}</dd>
                    </div>
                    <div>
                      <dt>Failed run ID</dt>
                      <dd
                        data-run-id={state.problem.runId ? "true" : undefined}
                      >
                        {state.problem.runId ?? "not returned by the server"}
                      </dd>
                    </div>
                  </dl>
                  <div className="error-actions">
                    <button
                      className="command-button secondary"
                      onClick={runPreflight}
                      type="button"
                    >
                      Retry preflight
                    </button>
                    {state.problem.mode === "LIVE" ? (
                      <button
                        className="command-button primary"
                        onClick={() => changeMode("FIXTURE")}
                        type="button"
                      >
                        Recover with Fixture
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
