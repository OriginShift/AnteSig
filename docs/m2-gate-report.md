# M2 Non-UI Integration Gate

## Verdict

**PASS**

Behavioral subject SHA: `e65fafcd4ea7cc7850fd2ce4418e8689df942546`

The gate covers the API boundary without Clear402 enabled. No production
business logic or dependency files changed for this gate.

## Acceptance Matrix

The same eight cases run with `CLEAR402_ENABLED` absent and with it set to
`false`, for 16 integration tests total.

| Case | Expected result | Result |
| --- | --- | --- |
| Health | `200`, disabled Clear402, no configured network | PASS |
| Happy fixture | `MANUAL_REVIEW` | PASS |
| Amount mismatch | `STOP` with `CRITICAL_ALIGNMENT_FAIL` | PASS |
| tokenOut mismatch | `STOP` with `CRITICAL_ALIGNMENT_FAIL` | PASS |
| Synthetic RPC failure | failed simulation evidence and `STOP` | PASS |
| Synthetic warning | retained warning and `STOP` | PASS |
| Malformed request | `400 INVALID_REQUEST`, no report or Decision | PASS |
| Programming error | redacted `500 INTERNAL_ERROR`, no fake `STOP` | PASS |

## Verification

- `pnpm test:integration`: 1 file passed, 16 tests passed.
- `pnpm check`: 34 files passed, 1,132 tests passed.
- Preflight core coverage: 200 tests passed; statements, branches, functions,
  and lines at 100%.
- Production build, public-package import smoke, browser-bundle leakage smoke,
  and production-start health smoke passed.
- `git diff --check` passed.
- `pnpm audit --prod --audit-level=moderate` reports the unchanged baseline of
  6 advisories (2 moderate, 4 high). This change does not modify dependencies
  or the lockfile.
- Local execution used Node `v25.9.0`; the repository declares
  `>=22.13 <23`, which remains enforced by CI.

## Repeatable Curl Check

Start the application with either Clear402 state:

```sh
env -u CLEAR402_ENABLED pnpm dev
CLEAR402_ENABLED=false pnpm dev
```

Run these commands from the repository root:

```sh
curl -fsS http://127.0.0.1:3000/api/health | jq '{status,clear402,network}'

curl -fsS -X POST http://127.0.0.1:3000/api/preflight \
  -H 'content-type: application/json' \
  --data @fixtures/requests/happy.json \
  | jq '{ok,mode,scenario,decision:.report.decision.status}'

curl -fsS -X POST http://127.0.0.1:3000/api/preflight \
  -H 'content-type: application/json' \
  --data @fixtures/requests/amount-mismatch.json \
  | jq '{ok,mode,scenario,decision:.report.decision.status,reasons:[.report.decision.reasons[].code]}'

curl -fsS -X POST http://127.0.0.1:3000/api/preflight \
  -H 'content-type: application/json' \
  --data @fixtures/requests/token-out-mismatch.json \
  | jq '{ok,mode,scenario,decision:.report.decision.status,reasons:[.report.decision.reasons[].code]}'
```

Observed in both states:

```text
health: status=ok, clear402.enabled=false, network.configured=false
happy: decision=MANUAL_REVIEW
amount-mismatch: decision=STOP, reason=CRITICAL_ALIGNMENT_FAIL
token-out-mismatch: decision=STOP, reason=CRITICAL_ALIGNMENT_FAIL
```
