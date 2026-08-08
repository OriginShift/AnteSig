import type {
  PreflightClientErrorKind,
  PreflightClientSuccessResponse,
} from "./api-client";
import type { WorkbenchMode } from "./run-controls";
import type { RunId } from "../contracts/preflight";

export type RunProblem = {
  kind: PreflightClientErrorKind | "API";
  code: string;
  message: string;
  mode: WorkbenchMode;
  runId?: RunId;
};

export type RunState =
  | { status: "IDLE" }
  | { status: "RUNNING"; token: number; startedAt: number }
  | {
      status: "RESULT";
      token: number;
      completedAt: number;
      response: PreflightClientSuccessResponse;
    }
  | {
      status: "ERROR";
      token: number;
      completedAt: number;
      problem: RunProblem;
    };

export type RunEvent =
  | { type: "START"; token: number; startedAt: number }
  | { type: "SUPERSEDE"; token: number; startedAt: number }
  | {
      type: "RESOLVE";
      token: number;
      completedAt: number;
      response: PreflightClientSuccessResponse;
    }
  | {
      type: "REJECT";
      token: number;
      completedAt: number;
      problem: RunProblem;
    }
  | { type: "RESET" };

export const INITIAL_RUN_STATE: RunState = { status: "IDLE" };

export function reduceRunState(state: RunState, event: RunEvent): RunState {
  if (event.type === "RESET") return INITIAL_RUN_STATE;

  if (event.type === "START") {
    return state.status === "RUNNING"
      ? state
      : { status: "RUNNING", token: event.token, startedAt: event.startedAt };
  }

  if (event.type === "SUPERSEDE") {
    return {
      status: "RUNNING",
      token: event.token,
      startedAt: event.startedAt,
    };
  }

  if (state.status !== "RUNNING" || state.token !== event.token) {
    return state;
  }

  if (event.type === "RESOLVE") {
    return {
      status: "RESULT",
      token: event.token,
      completedAt: event.completedAt,
      response: event.response,
    };
  }

  return {
    status: "ERROR",
    token: event.token,
    completedAt: event.completedAt,
    problem: event.problem,
  };
}
