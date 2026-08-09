# AnteSig Known Issues

This list is intentionally explicit. These are current product boundaries and
operational limitations, not reasons to soften an evidence claim.

| Priority | Issue | Observable behavior | Operator handling |
| --- | --- | --- | --- |
| P0 | Hosted Live source is not configured | `GET https://antesig.vercel.app/api/health` reports `network.configured=false`; a valid Live request returns `503 LIVE_UNAVAILABLE` with no report or Decision. | Keep Live selected while showing the failure. Use the visible `Recover with Fixture` action, choose a named Fixture, and run it. The recovered run has a different run ID and `Evidence reuse: NONE`. Do not describe the Fixture as chain evidence. |
| P0 | No fresh public live-smoke artifact is bundled with the web deployment | The repository contains the reproducible [live-smoke command and artifact contract](live-smoke.md), but a public URL alone does not prove a current Monad observation. | Treat `LIVE_SOURCE` as unestablished until the pinned Moss smoke completes with a sanitized artifact. Never infer Live status from the health endpoint, UI label, screenshot, or CI. |
| P1 | Moss is an integration fork, not an official release | Health and build metadata expose `sourceMode=INTEGRATION_FORK` and `officialRelease=false` at the pinned commit. | Link [Moss dependency provenance](moss-dependency.md) whenever discussing the dependency. Do not claim official Moss support or safety. |
| P1 | Fixture coverage is intentionally allowlisted | The API validates three synthetic scenarios; the UI exposes Happy path and Amount mismatch for the demo. | Use only named scenarios. Token-out mismatch, RPC failure, and warning cases are regression/API evidence, not hidden live behavior. |
| P1 | Clear402 is optional and disabled on the public demo | Health reports `clear402.enabled=false`; no Credential controls or credential-bearing browser assets are loaded in false mode. | Enable only in a controlled deployment when the Gate B matrix is required. Explain the output as unsigned integrity evidence, never authentication or authorization. |
| P0 | Wallet and transaction execution are out of scope | There is no wallet connection, private-key handling, signing, broadcast, cross-chain execution, or ZK proof path. STOP explicitly says `DO_NOT_PROCEED_TO_SIGNER`. | Keep all final decisions with the human reviewer. Do not add a signer link or execution promise to the demo script. |
| P1 | Live-smoke secrets and raw chain payloads must stay private | `MOSS_RPC_URL`, request headers, credentials, raw RPC bodies, and exception details are not safe public evidence. | Share only the sanitized artifact fields permitted by [live-smoke](live-smoke.md). Redact provider and credential material from Issues, PRs, screenshots, and videos. |
| P1 | Dependency audit evidence is point-in-time | The six advisories found by the historical security audit were remediated by [#102](https://github.com/OriginShift/AnteSig/issues/102). Gate C and the current main audit reported no known production vulnerabilities, but that result is bounded to their exact dependency graphs and audit times. | Re-run `pnpm audit --prod --audit-level=moderate` for every new release candidate. Treat a new advisory as a fresh finding; do not generalize the recorded clean result to future dependency state. |
| P2 | Schedule and roadmap documents contain historical target dates | Missed dates remain recorded as history and do not change Gate acceptance criteria. | Use the current Issue, Project status, exact commit, and linked gate report as the source of truth. |

## Explicitly Not Bugs

- A `MANUAL_REVIEW` result is not an approval; that wording is deliberate.
- A synthetic simulation can be `SUCCESS` while a critical Alignment mismatch
  returns `STOP`; this is the central demonstration.
- A failed Live request staying in Live mode until an explicit recovery click is
  expected fail-closed behavior.
- Token symbols, labels, screenshots, and generated explanations do not prove
  asset identity or chain evidence.
