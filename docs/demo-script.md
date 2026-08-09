# AnteSig Three-Minute Demo

## Release Subject

This script is fixed to annotated RC tag `hackathon-rc-2026-08-05`, peeled
commit `34f64df97c510a82a700c7b18bf0c0e0009a0aa2`. Automated evidence is
complete; real presenter timing and review remain owned by Issue #62.

## Presenter Setup

- Pre-start a production build with `CLEAR402_ENABLED=true`; the presenter must
  not open a terminal or edit code during the demo.
- Keep [antesig.vercel.app](https://antesig.vercel.app) open in a second tab as
  the public fallback. Its hosted Live session and Clear402 profile are
  intentionally disabled.
- Confirm `Fixture`, `Happy path`, `Amount mismatch`, and `Run preflight` are
  visible. Use only the named synthetic Fixtures in the timed run.
- Say `synthetic Fixture` when showing a Fixture. Never say safe, approved,
  guaranteed, authenticated, or ready to sign.

## Primary Timed Run

The spoken text is intentionally bounded to the fixed three-minute structure.
Operator actions are not part of the narration.

| Time | Operator action | Say | Evidence |
| --- | --- | --- | --- |
| 00:00-00:20 | Start on the workbench and point to the three comparison columns. | "An AI agent can prepare an operation that simulates successfully and still violates its user's request. AnteSig compares the request, prepared operation, simulation, Alignment, and bounded Decision before wallet review. It never signs or sends." | [Product brief](project-brief.md), [security boundary](security-boundary.md) |
| 00:20-00:40 | Point to Monad, provenance, and Moss build facts. | "AnteSig owns the review workflow. Monad is the recorded chain context. Moss supplies the pinned Capability and simulation boundary. Clear402 comes only after the report as optional unsigned integrity evidence." | [Architecture](architecture.md), [Moss dependency](moss-dependency.md), [Clear402 ADR](adr/0005-clear402-monad-action-credential-v0-1.md) |
| 00:40-01:20 | Select `Fixture`, `Happy path`, then `Run preflight`. Show provenance, comparison, Alignment, and the banner. | "This is the named Happy path synthetic Fixture, not Live chain evidence. AnteSig preserves the original Capability and compares requested, prepared, and simulated values. Every critical check passes, so the Decision is `MANUAL_REVIEW`. That means only that no defined stop condition was detected. Human review remains required; this is not approval or authorization." | [Gate A](gate-a-report.md), [evidence claim map](evidence-claims.md), [Decision Engine tests](../packages/decision-engine/test/evaluate.test.ts) |
| 01:20-02:05 | Select `Amount mismatch`, run, then show the 1-versus-10 comparison, source references, and action boundary. | "This synthetic Fixture keeps simulation `SUCCESS`, but the user requested one base unit and the prepared operation uses ten. Simulation success is not intent match. Alignment records the mismatch and the Decision Engine returns `STOP` with `CRITICAL_ALIGNMENT_FAIL`. The evidence pointers stay inspectable, and the boundary is `DO_NOT_PROCEED_TO_SIGNER`." | [Amount mismatch Fixture](../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json), [STOP requirements](stop-presentation.md), [Gate C](gate-c-report.md) |
| 02:05-02:35 | In the enabled build, return to Happy path. Export, verify, tamper a copy, and verify again. | "Clear402 wraps the completed report without changing its Decision. The original verifies; the tampered copy produces a digest mismatch. This is unsigned consistency evidence, not identity, authentication, safety, freshness, or authorization." | [Gate B](gate-b-report.md), [credential verifier](../packages/clear402-profile/src/integrity.ts), [Clear402 controls](../apps/web/src/components/credential-actions.tsx) |
| 02:35-02:55 | Return to the evidence ledger and raw-evidence controls. | "The contribution is a strict evidence boundary: deterministic fail-closed decisions, immutable Capability and raw evidence, explicit Fixture-versus-Live provenance, and an optional credential that cannot influence the core report." | [Gate C](gate-c-report.md), [architecture](architecture.md), [release runbook](release-runbook.md) |
| 02:55-03:00 | Finish on the STOP banner. | "AnteSig makes intent mismatch visible before wallet review and stops when mandatory evidence fails." | [Known Issues](known-issues.md), [hackathon scope](hackathon-scope.md) |

## Failure-Recovery Cues

| Failure | Recovery without terminal or editing | Required statement |
| --- | --- | --- |
| Primary local page is unavailable | Switch to the pre-opened public tab and continue with the two Fixture flows. | "This is the public fallback; provenance remains `FIXTURE`." |
| A Live request is accidentally selected | Keep `LIVE_UNAVAILABLE` visible, click `Recover with Fixture`, choose the intended named Fixture, and run again. | "The Live attempt failed. Recovery is a new Fixture run with a new run ID and no evidence reuse." |
| Clear402 controls are unavailable | Continue with the public fallback script below; do not claim an export was performed. | "Clear402 is disabled in this deployment; the enabled behavior is release-tested but is not being executed in this fallback." |
| Network is unavailable | Switch to the pre-staged local production tab. | "This is local production, not the public deployment and not Live chain evidence." |

## Public Fallback Script

Use the same `00:00-02:05` and `02:35-03:00` narration above. During
`02:05-02:35`, point to the `disabled` profile indicator and say:

> "This public deployment intentionally has Clear402 disabled, so no Credential
> control is present. The enabled release matrix separately proves export,
> verification, and tamper detection without changing the report or Decision.
> Clear402 remains unsigned consistency evidence, not authentication or
> authorization."

This fallback remains within the same three-minute window and does not depend
on screenshots, video, a terminal, Live availability, or hidden recovery.

## Timing And Fact Review

- [ ] Three normal-pace readings finish at or below 3:00; record them only in
      the human rehearsal log owned by Issue #62.
- [ ] Product reviewer confirms the problem, audience, and demo sequence.
- [ ] Technical reviewer checks every displayed control and linked artifact
      against the exact RC.
- [ ] Security reviewer confirms provenance, `MANUAL_REVIEW`, `STOP`, and
      Clear402 wording.
- [ ] Confirm the shown build and final media identify the exact RC tag.
- [ ] Do not claim a rehearsal, review, recording, or submission occurred until
      its external evidence exists.
