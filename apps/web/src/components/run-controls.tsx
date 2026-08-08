"use client";

import {
  RUNNABLE_FIXTURES,
  type RunnableFixtureScenario,
  type WorkbenchMode,
} from "../client/run-controls";

type RunControlsProps = Readonly<{
  mode: WorkbenchMode;
  fixtureScenario: RunnableFixtureScenario | undefined;
  running: boolean;
  canRun: boolean;
  onModeChange(mode: WorkbenchMode): void;
  onLoadFixture(scenario: RunnableFixtureScenario): void;
  onRun(): void;
  onCancel(): void;
}>;

export function RunControls({
  mode,
  fixtureScenario,
  running,
  canRun,
  onModeChange,
  onLoadFixture,
  onRun,
  onCancel,
}: RunControlsProps) {
  return (
    <div className="run-controls">
      <fieldset className="mode-control">
        <legend className="visually-hidden">Preflight mode</legend>
        {(["LIVE", "FIXTURE"] as const).map((option) => (
          <button
            aria-pressed={mode === option}
            className={mode === option ? "active" : ""}
            disabled={running}
            key={option}
            onClick={() => onModeChange(option)}
            type="button"
          >
            {option === "LIVE" ? "Live" : "Fixture"}
          </button>
        ))}
      </fieldset>

      {mode === "FIXTURE" ? (
        <div className="fixture-picker">
          <span className="field-label fixture-picker-label">Load fixture</span>
          <div className="fixture-options">
            {RUNNABLE_FIXTURES.map((fixture) => (
              <button
                aria-pressed={fixtureScenario === fixture.scenario}
                className={
                  fixtureScenario === fixture.scenario ? "selected" : ""
                }
                disabled={running}
                key={fixture.scenario}
                onClick={() => onLoadFixture(fixture.scenario)}
                type="button"
              >
                <strong className="fixture-label">{fixture.label}</strong>
                <span className="fixture-description">
                  {fixture.description}
                </span>
              </button>
            ))}
          </div>
          <p
            className={fixtureScenario ? "fixture-loaded" : "fixture-required"}
          >
            {fixtureScenario
              ? `Loaded: ${fixtureScenario}`
              : "Fixture selection required."}
          </p>
        </div>
      ) : null}

      <div className="run-actions">
        <button
          className="command-button primary"
          disabled={!canRun || running}
          onClick={onRun}
          type="button"
        >
          {running ? "Running preflight" : "Run preflight"}
        </button>
        {running ? (
          <button
            className="command-button secondary"
            onClick={onCancel}
            type="button"
          >
            Cancel run
          </button>
        ) : null}
      </div>
    </div>
  );
}
