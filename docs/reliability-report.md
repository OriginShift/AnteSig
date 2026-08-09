# M5 Reliability QA Report

## Verdict

**PASS**

Behavioral subject SHA: `593f27076494a4f0c26d19382e9afd5cfd49d425`

Execution date: 2026-08-09 (Asia/Hong_Kong)

The production-like reliability matrix covers the core UI flows, deterministic
failure bundles, explicit recovery, concurrency, timeout, network failure,
raw evidence, Clear402, and false-mode regression. This QA change is limited to
tests and this report; it does not change product or Decision code.

This is single-operator QA. No independent-review claim is made.

## Environment

- Node.js: `v22.23.1`
- pnpm: `11.16.0`
- Browser: Playwright Chromium 148 via Playwright `1.60.0`
- Network/RPC: not configured; Live-source behavior is represented by the
  existing deterministic local-fork integration boundary
- Subject main quality gate:
  [run 31283714008](https://github.com/OriginShift/AnteSig/actions/runs/31283714008),
  `SUCCESS` in 3m08s on the exact subject SHA
- Playwright retries: `0`
- Failure artifacts: screenshots use `only-on-failure`; traces use
  `retain-on-failure`

## Executed Matrix

Every command ran against the subject SHA plus the QA-only test changes.
Durations are wall-clock `real` values unless Playwright's duration is stated.
Screenshot writes were disabled for successful internal E2E runs.

| Command | Result | Exact count | Duration |
| --- | --- | --- | --- |
| `pnpm test` | PASS | 49 files, 1,258 tests | 8.46s |
| `pnpm test:fixtures` | PASS | 1 file, 17 tests | 7.39s |
| `CLEAR402_ENABLED=false pnpm build` | PASS | Production routes built | 6.74s |
| `CLEAR402_ENABLED=false pnpm test:integration` | PASS | 1 file, 21 tests | 7.13s |
| `CLEAR402_ENABLED=false pnpm test:e2e` | PASS | 8 passed, 2 skipped | 23.06s; Playwright 22.6s |
| `CLEAR402_ENABLED=true pnpm build` | PASS | Same production routes built | 6.49s |
| `CLEAR402_ENABLED=true pnpm test:integration` | PASS | 1 file, 21 tests | 7.20s |
| `CLEAR402_ENABLED=true pnpm test:e2e` | PASS | 9 passed, 1 skipped | 12.90s; Playwright 12.5s |
| `BASE_URL=http://127.0.0.1:3021 pnpm test:e2e:smoke` | PASS | 9 passed | Playwright 7.2s |
| `CLEAR402_ENABLED=false pnpm check` | PASS | 49 files, 1,258 tests plus coverage/smokes | 31.25s |

Clear402 profile and preflight core remained at 100% statements, branches,
functions, and lines. Browser-bundle leakage passed for 11 JavaScript
artifacts, and production start/health smoke passed.

## Scenario Coverage

| Reliability requirement | Result | Executable evidence |
| --- | --- | --- |
| Desktop/mobile happy | PASS | Internal and external E2E assert `MANUAL_REVIEW`, complete evidence columns, semantic source references, and viewport bounds |
| Desktop/mobile amount mismatch | PASS | Internal and external E2E assert `STOP`, `CRITICAL_ALIGNMENT_FAIL`, mismatched values, and no horizontal overflow |
| RPC failure | PASS | Fixture tests recompute `SIMULATION_ACQUISITION_FAILED`; API integration runs the raw adapter path and asserts failed evidence plus `STOP` |
| Receipt warning | PASS | Fixture and integration tests retain the exact warning and recompute `WARNING_PRESENT` plus `STOP` |
| Explicit Fixture recovery | PASS | Internal/external E2E retain the failed Live run, require a user click, issue a distinct Fixture run ID, prove `Evidence reuse: NONE`, and complete within 15 seconds |
| Double submit/stale response | PASS | Production smoke proves a duplicate click sends no second request and a cancelled late response cannot replace the newest result |
| API timeout | PASS | Integration maps service timeout to strict 504/`PREFLIGHT_TIMEOUT` with no Decision; production smoke asserts the same UI contract on mobile |
| Network failure | PASS | Production smoke aborts the request, asserts `NETWORK`, keeps Live selected, exposes no result, and performs no Fixture request |
| Raw drawer keyboard/provenance | PASS | Internal E2E proves keyboard open/close/focus; recovery tests assert the raw header, JSON, and download are `FIXTURE` |
| Credential export/verify/tamper | PASS | Enabled E2E validates exact export provenance, integrity `VALID`, digest `INVALID` after tamper, and unchanged displayed Decision/report |
| Clear402 false-mode regression | PASS | Disabled E2E asserts no Credential UI or browser resource; external production smoke remains entirely false-mode |
| Console/network audit | PASS | Every external test records console/page errors and fails on unexpected diagnostics; only the asserted 503, 504, and aborted-network resource diagnostics are allowed |

All browser assertions are semantic; screenshots are not used as pass
criteria. Both Playwright configurations retain a trace and screenshot for a
failure, with no retry that could hide a deterministic defect.

## QA Observation

The first 504 smoke run correctly retained failure artifacts because its audit
allowlist did not yet recognize Chromium's expected 504 resource diagnostic.
The assertion and product UI contract had already passed. The QA test was
corrected to allow only that exact diagnostic, and the complete nine-test
production smoke then passed without retry. No product root-cause bug was
found, so no Bug Issue was opened.

## Scope And Residual Boundary

- Changed paths are limited to `tests/integration/**`, `tests/e2e/**`, and this
  report.
- No product, schema, Decision Engine, dependency, lockfile, or trust-boundary
  implementation changed.
- Results prove deterministic Fixture/local-fork reliability. They do not
  claim an external RPC, a live production source, transaction signing, or
  execution safety.
- No unresolved M5-03 blocker remains.
