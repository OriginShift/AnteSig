# Gate B: Optional Clear402 Regression Matrix

## Verdict

**PASS**

Behavioral subject SHA: `8494a5c213e6ed6a29387d0b9438ca78e765f31c`

Execution date: 2026-08-09 (Asia/Hong_Kong)

Gate B proves that Clear402 adds a portable, unsigned report-integrity
credential without changing the Mini-Demo Core report, presentation, alignment,
or Decision behavior. This Gate change is report-only.

This is single-operator QA. No independent-review claim is made.

## Environment

- Node.js: `v22.23.1`
- pnpm: `11.16.0`
- Browser: Playwright Chromium 148 via Playwright `1.60.0`
- Network and RPC: not configured
- Subject main quality gate:
  [run 31268744889](https://github.com/OriginShift/AnteSig/actions/runs/31268744889),
  `SUCCESS` on the exact subject SHA under Node.js 22.23.1

## Machine Matrix

All commands ran from a clean worktree at the exact subject SHA with the stated
Node.js version. Screenshot writes were disabled during the matrix so the
committed Gate A artifacts remained unchanged.

| Command | Result | Evidence |
| --- | --- | --- |
| `CLEAR402_ENABLED=false pnpm build` | PASS | Next.js production build completed; `/`, `/api/health`, `/api/preflight`, and disabled `/api/verify` emitted |
| `CLEAR402_ENABLED=false pnpm test:integration` | PASS | 1 file, 19 tests |
| `CLEAR402_ENABLED=false pnpm test:e2e` | PASS | 7 passed; 2 enabled-only tests skipped |
| `CLEAR402_ENABLED=true pnpm build` | PASS | Same production route set completed with the optional profile enabled |
| `CLEAR402_ENABLED=true pnpm test:integration` | PASS | 1 file, 19 tests |
| `CLEAR402_ENABLED=true pnpm test:e2e` | PASS | 8 passed; 1 disabled-only test skipped |
| `pnpm --filter @moss-mini-demo/clear402-profile test` | PASS | 3 files, 36 tests |
| `pnpm check` | PASS | 48 files, 1,237 tests; package import, browser bundle, and production start smokes passed |

Both packages subject to coverage thresholds remained at 100% statements,
branches, functions, and lines: Clear402 profile (27 statements) and preflight
core (524 statements).

## Trust-Boundary Matrix

| Requirement | Result | Executable evidence |
| --- | --- | --- |
| Valid export verifies | PASS | Credential action tests prove deterministic JSON export equals the generated Credential; profile and browser tests return `integrity: VALID` |
| Amount tamper is invalid | PASS | Profile verifier tamper matrix changes `report.intent.inputAmount` and returns integrity `INVALID` |
| Decision tamper is invalid | PASS | Profile verifier tamper matrix changes `report.decision` and returns integrity `INVALID` |
| Digest or protected-field tamper is invalid | PASS | Profile and browser tests return `DIGEST_INVALID`; the current report ID, amount, and Decision remain unchanged |
| Wrong version or type is schema-invalid | PASS | Profile verifier returns `SCHEMA_INVALID` for both discriminators; API tests preserve the distinction |
| Verifier is offline | PASS | Fetch probe remains uncalled; Clear402 profile depends only on report schema, hashing, canonicalization, and validation packages |
| False mode equals Gate A behavior | PASS | Internal E2E explicitly finds no Credential actions; external false-mode production smoke passed all 7 Gate A tests |
| Credential failure does not change Decision | PASS | Integration test preserves both report and presentation `STOP` while returning only `CREDENTIAL_GENERATION_FAILED` in the extension |
| Assurance remains bounded | PASS | UI and schema expose `UNSIGNED_INTEGRITY_EVIDENCE`; no safety, authentication, signature, ZK, or on-chain claim is made |

## Core Non-Intrusion Audit

The five M4 implementation merge commits were audited individually:

- `f329b2b8d466ac51bf8aba77c4ca195ff62e730d` (M4-01)
- `7bd9d1f01bb4920c794334ba0f449f8cc56edb96` (M4-02)
- `c7aa5b37b5e2ae7064ce39ac5db0735142a95cac` (M4-03)
- `2428b81cf0ef5ecd124c9ca8c2a906a06f764bee` (M4-04)
- `8494a5c213e6ed6a29387d0b9438ca78e765f31c` (M4-05)

None changes `packages/moss-adapter`, `packages/preflight-core`,
`packages/report-schema`, or `packages/decision-engine`. The separate AnteSig
rebrand commit between M4-02 and M4-03 changed Moss Adapter repository URL
metadata only; it was not an M4 functional change.

False- and true-mode integration tests also compare the baseline report and
presentation directly before accepting the appended Clear402 extension.

## M4 CI Chain

| M4 PR | Merge SHA | Exact-head quality gate |
| --- | --- | --- |
| [#90](https://github.com/OriginShift/AnteSig/pull/90) | `f329b2b` | [SUCCESS](https://github.com/OriginShift/AnteSig/actions/runs/31260568591) |
| [#91](https://github.com/OriginShift/AnteSig/pull/91) | `7bd9d1f` | [SUCCESS](https://github.com/OriginShift/AnteSig/actions/runs/31261180431) |
| [#94](https://github.com/OriginShift/AnteSig/pull/94) | `c7aa5b3` | [SUCCESS](https://github.com/OriginShift/AnteSig/actions/runs/31265742712) |
| [#95](https://github.com/OriginShift/AnteSig/pull/95) | `2428b81` | [SUCCESS](https://github.com/OriginShift/AnteSig/actions/runs/31267212115) |
| [#96](https://github.com/OriginShift/AnteSig/pull/96) | `8494a5c` | [SUCCESS](https://github.com/OriginShift/AnteSig/actions/runs/31268561095) |

## Scope

- No product, schema, dependency, lockfile, or trust-boundary code changed in
  this Gate.
- Gate A remains `PASS` at `docs/gate-a-report.md`.
- M4-01 through M4-05 are closed and their merged-main quality gates succeeded.
- No unresolved Gate B blocker remains.
