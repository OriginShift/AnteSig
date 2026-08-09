# AnteSig Evidence Claims

## Purpose

This is the claim-to-evidence index for the current AnteSig checkout. A
statement is a product claim only when the linked source, test, or live-smoke
artifact supports exactly that statement. A Fixture, screenshot, green build,
or natural-language explanation cannot substitute for live evidence.

The current public demo is [antesig.vercel.app](https://antesig.vercel.app).
Its health response is currently `network.configured=false` and
`clear402.enabled=false`; therefore the public Live path is expected to return
an explicit `LIVE_UNAVAILABLE` response until a server-side Live session is
configured.

## Claim Map

| Claim | Evidence | Exact boundary |
| --- | --- | --- |
| AnteSig is a preflight evidence console for reviewing an AI-prepared Monad operation before wallet review. | [product brief](project-brief.md), [workbench shell](../apps/web/src/components/workbench-shell.tsx), [Gate A browser smoke](../tests/e2e/gate-a-smoke.e2e.mjs) | It is an evidence and explanation layer, not a wallet, signer, executor, safety oracle, or authorization system. |
| The P0 operation is one structured exact-input Swap on Monad chain 143. | [scope contract](hackathon-scope.md), [intent form](../apps/web/src/client/intent-form.ts), [quote request construction](../apps/web/src/server/preflight-orchestrator.ts) | Natural-language intent parsing, arbitrary transaction flows, and other operation types are outside this demo. |
| The UI compares what the user requested, what the agent prepared, and what simulation observed. | [comparison component](../apps/web/src/components/comparison-strip.tsx), [comparison model](../apps/web/src/client/comparison-strip.ts), [Gate A assertions](../tests/e2e/gate-a-smoke.e2e.mjs) | Display text describes the report; it does not create, repair, or strengthen evidence. |
| The Decision Engine returns only `MANUAL_REVIEW` or fail-closed `STOP`. | [Decision Engine entry](../packages/decision-engine/src/evaluate.ts), [presentation derivation](../packages/preflight-core/src/presentation.ts), [Decision tests](../packages/decision-engine/test/evaluate.test.ts) | `MANUAL_REVIEW` means only that no defined stop condition was detected in available evidence. It is not safe, approved, guaranteed, executable, or ready to sign. `STOP` is not a safety proof. |
| A `STOP` result exposes the exact action boundary and reason references. | [presentation contract](../apps/web/src/contracts/preflight.ts), [STOP banner](../apps/web/src/components/decision-banner.tsx), [STOP details](../apps/web/src/components/stop-details.tsx), [STOP requirements](stop-presentation.md) | References point to raw-backed report paths. Prose cannot replace a source reference or hide another reason. |
| `LIVE`, `LOCAL_FORK`, and `FIXTURE` are distinct provenance values. Live failure never becomes Fixture success silently. | [request/response provenance schemas](../apps/web/src/contracts/preflight.ts), [orchestrator mode split](../apps/web/src/server/preflight-orchestrator.ts), [Fixture service](../apps/web/src/server/fake-preflight-service.ts), [recovery E2E](../tests/e2e/gate-a-smoke.e2e.mjs) | The hosted API currently has no Live session and returns `LIVE_UNAVAILABLE`; the user must click the explicit Fixture recovery action. A recovered Fixture gets a separate run ID and `Evidence reuse: NONE`. |
| Quote data is selection context, not execution evidence. | [scope and evidence rules](hackathon-scope.md), [quote comparison](../apps/web/src/components/quote-comparison.tsx), [Moss selection tests](../packages/moss-adapter/test/selection.test.ts) | A successful Quote does not prove a Receipt, simulation result, intent alignment, or later execution. |
| A successful simulation is state- and block-specific and does not guarantee later execution. | [security boundary](security-boundary.md), [simulation timeline](../apps/web/src/components/evidence-timeline.tsx), [Gate A mismatch coverage](../tests/e2e/gate-a-smoke.e2e.mjs), [amount mismatch Fixture](../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json) | The amount mismatch Fixture intentionally keeps synthetic simulation `SUCCESS` while the alignment check produces `STOP`. |
| Moss is a pinned integration-fork dependency with reviewable build identity. | [Moss build record](../packages/moss-adapter/src/build-info.ts), [health exposure](../apps/web/app/api/health/route.ts), [dependency provenance](moss-dependency.md), [build identity tests](../packages/moss-adapter/test/contracts.test.ts) | `officialRelease` is `false`; the pin is dependency provenance and does not establish runtime, chain, safety, or protocol claims. |
| The only exposed live protocol choice is PancakeSwap V2, and token symbols are display metadata only. | [allowlisted protocol form](../apps/web/src/client/intent-form.ts), [asset identity rules](security-boundary.md), [schema invariant tests](../packages/report-schema/test/invariants.test.ts) | Token identity is the address. Kuru and every second protocol are outside this P0 demo path; no symbol/name/icon can approve an asset. |
| AnteSig does not handle wallets, private keys, signing, transaction broadcast, cross-chain operations, or ZK proofs. | [security boundary](security-boundary.md), [scope exclusions](hackathon-scope.md), [browser bundle smoke](../apps/web/test/browser-bundle-leak.smoke.mjs) | No UI or API claim may imply a signer hand-off is safe or authorized. `DO_NOT_PROCEED_TO_SIGNER` is the STOP boundary. |
| Clear402 is an optional unsigned report-integrity credential. | [Clear402 ADR](adr/0005-clear402-monad-action-credential-v0-1.md), [credential service](../apps/web/src/server/credential-service.ts), [credential UI](../apps/web/src/components/credential-actions.tsx), [Gate B report](gate-b-report.md) | It is an unkeyed digest and schema envelope. It is not authentication, a signature, a ZK proof, an on-chain attestation, safety evidence, or a Decision input. It is disabled on the current public demo. |
| The failure and recovery matrix is repeatable and browser-tested. | [reliability report](reliability-report.md), [integration matrix](../tests/integration/preflight-api.test.ts), [external smoke](../tests/e2e/gate-a-smoke.e2e.mjs) | The report is single-operator QA evidence. It does not claim independent review or live-chain availability in the hosted deployment. |

## Evidence Reading Order

Use the UI and the linked artifacts in this order:

1. user intent;
2. Quote and selected protocol;
3. original Capability tree;
4. simulation records, Receipts, Outcomes, Warnings, and context;
5. deterministic Alignment checks; and
6. the bounded Decision and its limitations.

For `STOP`, follow every reason's exact source references. For
`MANUAL_REVIEW`, repeat that human review remains required and do not use a
safety or execution adjective.

## Classification Rules

- `FIXTURE` is synthetic deterministic development data.
- `LOCAL_FORK` is explicitly identified fork evidence, not a mainnet
  submission.
- `LIVE_SOURCE` is valid only after the standalone live smoke records the
  configured chain, source build, Quote, Capability, and simulation at its
  observed context. Follow [the live-smoke procedure](live-smoke.md); do not
  paste RPC credentials, headers, or raw responses into public artifacts.
- A missing or unavailable mandatory check remains a failure. Do not convert
  an unavailable Live result into a Fixture report without the explicit user
  action and a new run.
