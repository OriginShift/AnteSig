import type { FixtureScenario, PreflightRequest } from "../contracts/preflight";

export type WorkbenchMode = "LIVE" | "FIXTURE";

export const RUNNABLE_FIXTURES = [
  {
    scenario: "manual-review-success",
    label: "Happy path",
    description: "Synthetic MANUAL_REVIEW response",
  },
  {
    scenario: "amount-in-mismatch",
    label: "Amount mismatch",
    description: "Synthetic STOP response",
  },
] as const satisfies readonly Readonly<{
  scenario: FixtureScenario;
  label: string;
  description: string;
}>[];

export type RunnableFixtureScenario =
  (typeof RUNNABLE_FIXTURES)[number]["scenario"];

export function createFixtureRequest(
  value: unknown,
): PreflightRequest | undefined {
  const scenario = RUNNABLE_FIXTURES.find(
    (fixture) => fixture.scenario === value,
  )?.scenario;
  return scenario === undefined
    ? undefined
    : { contractVersion: "0.1", mode: "FIXTURE", scenario };
}
