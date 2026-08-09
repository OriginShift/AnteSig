# AnteSig Five-Minute Demo Draft

## Preconditions

- Open the public deployment at [antesig.vercel.app](https://antesig.vercel.app)
  in a clean desktop browser. A pre-staged local production server may be used
  only as the documented fallback; do not edit code during the demo.
- Confirm the presenter can see the `Live` and `Fixture` mode controls and the
  `Run preflight` action.
- Use the exact wording in this script for provenance and Decision limits.
- The public deployment currently has no Live session and Clear402 disabled.
  That is demonstrated as an explicit failure and recovery, not hidden.

## Timed Run (4:45 target)

| Time | Operator action | Say / show | Evidence link |
| --- | --- | --- | --- |
| 0:00-0:20 | Open the URL and point to the first viewport. | "AnteSig is a preflight evidence console. It shows what was requested, what was prepared, what simulation observed, and why review stops or remains manual. It never signs or sends a transaction." | [product brief](project-brief.md), [security boundary](security-boundary.md) |
| 0:20-0:45 | Leave `Live` selected, enter a valid account, output token address, positive base-unit amount, and the default slippage, then run. | "This is a structured exact-input Swap request on Monad chain 143. Live is a source mode, not a claim that this deployment has a configured RPC." | [intent form](../apps/web/src/client/intent-form.ts), [scope](hackathon-scope.md) |
| 0:45-1:05 | Show the error state and failed run ID. | "The Live source is unavailable. No report, Decision, or Fixture result was created." Point to `LIVE_UNAVAILABLE`, `Request mode: LIVE`, and `Failed run ID`. | [preflight route](../apps/web/app/api/preflight/route.ts), [Live recovery E2E](../tests/e2e/gate-a-smoke.e2e.mjs) |
| 1:05-1:20 | Click `Recover with Fixture`, select `Happy path`, and run. | "Recovery is explicit. This is a new Fixture run; no Live evidence is reused." Point to separate run IDs, `Source: FIXTURE`, and `Evidence reuse: NONE`. | [Fixture service](../apps/web/src/server/fake-preflight-service.ts), [recovery audit](../apps/web/src/components/workbench-shell.tsx) |
| 1:20-2:05 | Show the Happy path result from top to bottom. | "The decision is `MANUAL_REVIEW`: no defined stop condition was detected in this available synthetic evidence. Human review remains required; this is not approval or authorization." Show the three-way comparison, Alignment, Capability tree, and Simulation evidence. | [Decision model](../apps/web/src/client/decision-banner.ts), [comparison](../apps/web/src/components/comparison-strip.tsx), [Gate A smoke](../tests/e2e/gate-a-smoke.e2e.mjs) |
| 2:05-2:55 | Switch to `Fixture`, select `Amount mismatch`, and run. | "Simulation can report `SUCCESS` while the prepared amount does not match the requested amount. The Decision Engine therefore returns `STOP`." Show `CRITICAL_ALIGNMENT_FAIL`, its source pointers, and `DO_NOT_PROCEED_TO_SIGNER`. | [amount mismatch Fixture](../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json), [Decision Engine](../packages/decision-engine/src/evaluate.ts), [STOP presentation](stop-presentation.md) |
| 2:55-3:25 | Open Capability raw JSON and Simulation raw JSON. | "Raw evidence stays separate from display text. Quote is selection context, not execution evidence; a simulation is specific to its recorded context and is not a later-execution guarantee." Show the provenance label before opening each drawer. | [raw evidence components](../apps/web/src/components/capability-inspector.tsx), [simulation timeline](../apps/web/src/components/evidence-timeline.tsx), [security rules](security-boundary.md) |
| 3:25-3:55 | Point to network/provenance facts and Moss identity. | "This current demo records chain 143 in the contract and reports a pinned integration-fork Moss identity. `officialRelease` is false. A standalone live smoke is a separate, sanitized observation." | [health route](../apps/web/app/api/health/route.ts), [Moss build](../packages/moss-adapter/src/build-info.ts), [live smoke](live-smoke.md) |
| 3:55-4:25 | Optional branch only when the deployment health says `clear402.enabled=true`: export, verify, tamper, verify again. Otherwise point out that the public deployment has it disabled. | "Clear402 is an optional unsigned integrity credential. A digest mismatch detects changed report data; it is not authentication, a signature, a safety proof, or a transaction authorization." | [Clear402 controls](../apps/web/src/components/credential-actions.tsx), [Gate B](gate-b-report.md) |
| 4:25-4:45 | Return to the STOP banner and close. | "The core insight is simple: simulation success does not prove intent alignment. AnteSig keeps the evidence inspectable and stops when a mandatory condition fails. Wallet review and any execution decision remain outside this product." | [claim map](evidence-claims.md), [known issues](known-issues.md) |

## Presenter Guardrails

- Say `synthetic Fixture` every time a Fixture is shown.
- Say `observed at its recorded context` for live-smoke output; never say
  "safe", "approved", "guaranteed", or "ready to sign".
- Do not open a terminal, edit code, paste an RPC URL, reveal a credential, or
  claim a public Live result while health reports `network.configured=false`.
- If a request fails, keep the failure visible and use the explicit recovery
  control. Do not retry until a Fixture appears automatically.

## Acceptance Checklist

- [ ] Complete run is under five minutes.
- [ ] Live failure, Fixture provenance, Happy path, and Amount mismatch are
      shown in one continuous browser session.
- [ ] `MANUAL_REVIEW` limitation and `STOP` action boundary are spoken exactly.
- [ ] Three-way comparison, raw Capability, Simulation, Alignment references,
      and run IDs are visible.
- [ ] No wallet, signer, signing, cross-chain, ZK, or safety claim is made.
- [ ] Optional Clear402 branch is run only when its health flag is enabled.
