# Gate C release acceptance

## Conclusion

Gate C was executed on 2026-08-09 against exact candidate
`b28116979084719f6f4fa0fd829f3671b4ab28f2` in a fresh recursive clone.
The candidate passed the independent Moss workspace gate, AnteSig root gate,
live observation, both optional-profile modes, local production fallback, and
the exact public production deployment.

Conclusion: PASS

## Candidate identity

- Repository: <https://github.com/OriginShift/AnteSig>
- Candidate: `b28116979084719f6f4fa0fd829f3671b4ab28f2`
- Moss gitlink: `1ae6b6322d51fae9104f047efb94e601050b967f`
- Node.js: `v22.23.1`
- AnteSig pnpm: `11.16.0`
- Moss pnpm: `11.10.0`
- Candidate main CI:
  [SUCCESS](https://github.com/OriginShift/AnteSig/actions/runs/31294621628)
- Remediation PR exact-head CI:
  [SUCCESS](https://github.com/OriginShift/AnteSig/actions/runs/31294463856)
- Public alias: <https://antesig.vercel.app>
- Immutable production deployment:
  <https://antesig-6brzcbbnu-pillowtalk-qys-projects.vercel.app>

The clone began at `main...origin/main` with the exact candidate and initialized
Moss gitlink. No prior clone, `node_modules`, build output, or application cache
was used as the sole evidence. The Moss workspace was gated first, then
deinitialized before the AnteSig root Biome and quality scan, as required by
the dual-workspace contract. The gitlink was restored at the end.

## Machine gate

Every command below exited 0. Durations are wall-clock observations from this
acceptance run and are not performance targets.

| Command | Duration | Result |
| --- | ---: | --- |
| Moss `corepack pnpm install --frozen-lockfile` | 3.11s | PASS; 301 packages, lockfile unchanged |
| Moss `corepack pnpm build` | 12.67s | PASS; 13 workspace projects |
| Moss `corepack pnpm typecheck` | 12.45s | PASS; 13 workspace projects |
| Moss `corepack pnpm test:offline` | 10.38s | PASS; all package suites passed with repository-defined offline skips |
| AnteSig `pnpm install --frozen-lockfile` | 2.48s | PASS; 110 packages, lockfile unchanged |
| `MOSS_RPC_URL=<redacted> pnpm test:live` | 5.99s | PASS; sanitized `SUCCESS`, `LIVE_SOURCE` |
| `pnpm check` | 37.90s | PASS; format, lint, types, builds, imports, 51 files / 1,261 tests, coverage and production smokes |
| `pnpm test:fixtures` | 7.45s | PASS; 17/17 |
| `pnpm test:integration` | 7.47s | PASS; 21/21 |
| `CLEAR402_ENABLED=false pnpm test:e2e` | 13.80s | PASS; 8 passed, 2 credential-only tests skipped |
| `CLEAR402_ENABLED=true pnpm test:e2e` | 13.63s | PASS; 9 passed, 1 disabled-only test skipped |
| `CLEAR402_ENABLED=false pnpm build` | 6.96s | PASS; production route set built |
| local production `pnpm test:e2e:smoke` | 7.70s | PASS; 9/9 |
| public production `pnpm test:e2e:smoke` | 25.4s | PASS; 9/9 |
| `pnpm audit --prod --audit-level=moderate` | <3s | PASS; no known vulnerabilities |
| `git diff --check` | <1s | PASS |

The coverage gates remained at 100% for the bounded Clear402 profile and
preflight-core surfaces. Browser-bundle leakage and production start/health
smokes passed. E2E screenshot generation was treated as QA output, not as a
change to the candidate; final screenshot selection belongs to visual QA #58.

## Scenario and mode acceptance

| Requirement | Result | Evidence |
| --- | --- | --- |
| Happy Fixture | PASS | Desktop/mobile result reached `MANUAL_REVIEW` with the explicit non-approval limitation and `FIXTURE` provenance. |
| Amount mismatch | PASS | Desktop/mobile result showed critical Alignment failure and fail-closed `STOP` without requiring raw JSON. |
| RPC failure | PASS | Fixture and integration suites retained a deterministic failed source path with no strengthened evidence. |
| Receipt warning | PASS | Fixture and integration suites retained warning evidence and the required fail-closed Decision behavior. |
| Live unavailable recovery | PASS | Public and local E2E kept Live failed, required explicit Fixture recovery, generated a new run ID, and reused no evidence. |
| Standalone Live source | PASS | PancakeSwap V2 quote/action/simulation produced results on `eip155:143`; block, capability integrity, receipt coverage, and ordering were `PROVEN`. |
| Clear402 disabled | PASS | Credential text, controls, and browser resources were absent. |
| Clear402 enabled | PASS | Export and valid verification passed; tampering changed only the copy and produced digest-invalid status without changing evidence or Decision. |

The standalone Live artifact contained only bounded RPC scheme/host metadata;
no endpoint path, query, credential, header, raw RPC payload, transaction, or
secret was retained. This observation is not authorization to sign or submit.
The public Web route remains intentionally unconfigured for Live and returns
explicit `LIVE_UNAVAILABLE`; it never silently substitutes Fixture evidence.

## Release controls

- `/api/health` returned HTTP 200 with HSTS and `cache-control: no-store`,
  reported actual Node `22.23.1`, `network.configured=false`, and no sensitive
  value or full RPC URL.
- The public URL required no login and passed the complete 9-test external
  production smoke after its alias was assigned to the verified immutable
  deployment.
- The local false-mode production build/start fallback passed the same 9-test
  external smoke.
- The production dependency audit reported no known vulnerabilities.
- GitHub had no open Bug Issues and no open pull requests at final audit time.
- The earlier missing root live command was rejected, fixed through #107 / PR
  #108, and fully re-run on this new candidate; no evidence from the rejected
  candidate was used for this conclusion.

Gate C proves the recorded release controls and bounded demo behavior at this
candidate. It does not claim wallet execution, signing, transaction broadcast,
future chain behavior, or that `MANUAL_REVIEW` is approval or safety.
