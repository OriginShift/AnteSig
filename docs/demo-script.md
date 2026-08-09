# AnteSig Five-Minute Demo

## Draft Status

This script is drafted against `main@34f64df97c510a82a700c7b18bf0c0e0009a0aa2`.
Final timing approval and replacement of that SHA with the immutable RC tag are
blocked by Maintainer-only [Issue #59](https://github.com/OriginShift/AnteSig/issues/59).

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

The spoken text is intentionally bounded to the fixed five-minute structure.
Operator actions are not part of the narration.

| Time | Operator action | Say | Evidence |
| --- | --- | --- | --- |
| 00:00-00:35 | Start on the AnteSig workbench. Point to `User request`, `Agent prepared`, and `Simulation occurred`. | "An AI agent can prepare an operation that simulates successfully and still violates what its user asked for. Reviewing raw JSON under time pressure makes that difference easy to miss. AnteSig puts the request, prepared operation, simulation evidence, deterministic alignment, and bounded decision in one preflight view before wallet review. It never signs or sends a transaction." | [Product brief](project-brief.md), [security boundary](security-boundary.md) |
| 00:35-01:05 | Point to the Monad network, provenance, and Moss build facts. | "AnteSig is the application and policy layer. Monad is the recorded chain context. Moss supplies the pinned protocol capability and simulation boundary. Clear402 is optional and comes only after the report as an unsigned integrity envelope. Those responsibilities do not replace one another, and display text is never treated as evidence." | [Architecture](architecture.md), [Moss dependency](moss-dependency.md), [Clear402 ADR](adr/0005-clear402-monad-action-credential-v0-1.md) |
| 01:05-02:10 | Select `Fixture`, `Happy path`, then `Run preflight`. Show provenance, comparison, Capability, evidence, Alignment, and the banner. | "This is the named Happy path synthetic Fixture, not Live chain evidence. The request is an exact-input Swap. AnteSig records the Quote and selected protocol, preserves the original Capability, and compares the requested, prepared, and simulated values. Here every critical check passes and the Decision is `MANUAL_REVIEW`. That means only that no defined stop condition was detected in the available evidence. Human review is still required; this is not approval, authorization, or permission to sign." | [Gate A](gate-a-report.md), [evidence claim map](evidence-claims.md), [Decision Engine tests](../packages/decision-engine/test/evaluate.test.ts) |
| 02:10-03:20 | Select `Amount mismatch`, run, then show `Why STOP`, the 1-versus-10 comparison, source references, and action boundary. | "Now this second synthetic Fixture keeps simulation status `SUCCESS`, but the user requested one base unit and the prepared operation uses ten. Simulation success is not intent match. Deterministic Alignment records the mismatch and the Decision Engine returns `STOP` with `CRITICAL_ALIGNMENT_FAIL`. The source pointers remain inspectable, and the visible boundary is `DO_NOT_PROCEED_TO_SIGNER`. A Quote supported selection; it did not prove execution or alignment. AnteSig does not repair or hide the adverse evidence." | [Amount mismatch Fixture](../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json), [STOP requirements](stop-presentation.md), [Gate C](gate-c-report.md) |
| 03:20-04:15 | In the enabled build, return to Happy path. Export, verify, tamper a copy, and verify again. | "Clear402 wraps the completed report without changing its evidence or Decision. The original export verifies because its schema-valid report matches the stored RFC 8785 SHA-256 digest. I tamper only with a copy; verification now reports a digest mismatch. This is unsigned integrity evidence. Anyone replacing the report can also replace an unkeyed digest, so it proves neither identity nor authenticity, safety, freshness, or authorization." | [Gate B](gate-b-report.md), [credential verifier](../packages/clear402-profile/src/integrity.ts), [Clear402 controls](../apps/web/src/components/credential-actions.tsx) |
| 04:15-04:45 | Return to the evidence ledger and raw-evidence controls. | "The technical contribution is the evidence boundary: strict runtime contracts, deterministic fail-closed decisions, immutable Capability and raw evidence, explicit Fixture-versus-Live provenance, and an optional credential that cannot influence the core report. The release gate also covers desktop and mobile flows, dependency audit, local fallback, public smoke, and a sanitized standalone Live observation." | [Gate C](gate-c-report.md), [architecture](architecture.md), [release runbook](release-runbook.md) |
| 04:45-05:00 | Finish on the STOP banner. | "Next work can add a configured hosted Live session and stronger attestation profiles. Today the bounded result is simpler: make intent mismatch visible before wallet review, preserve the evidence, and stop when a mandatory condition fails." | [Known Issues](known-issues.md), [hackathon scope](hackathon-scope.md) |

## Failure-Recovery Cues

| Failure | Recovery without terminal or editing | Required statement |
| --- | --- | --- |
| Primary local page is unavailable | Switch to the pre-opened public tab and continue with the two Fixture flows. | "This is the public fallback; provenance remains `FIXTURE`." |
| A Live request is accidentally selected | Keep `LIVE_UNAVAILABLE` visible, click `Recover with Fixture`, choose the intended named Fixture, and run again. | "The Live attempt failed. Recovery is a new Fixture run with a new run ID and no evidence reuse." |
| Clear402 controls are unavailable | Continue with the public fallback script below; do not claim an export was performed. | "Clear402 is disabled in this deployment; the enabled behavior is release-tested but is not being executed in this fallback." |
| Network is unavailable | Switch to the pre-staged local production tab. | "This is local production, not the public deployment and not Live chain evidence." |

## Public Fallback Script

Use the same `00:00-03:20` and `04:15-05:00` narration above. During
`03:20-04:15`, point to the `disabled` profile indicator and say:

> "This public deployment intentionally has Clear402 disabled, so no Credential
> control or credential-bearing response is present. The optional enabled-mode
> release matrix separately proves export, valid verification, and tamper
> detection without changing the report or Decision. I am not presenting that
> test evidence as an action performed in this fallback session. Clear402
> remains an unsigned consistency check, not authentication or authorization."

This fallback remains within the same five-minute window and does not depend on
screenshots, video, a terminal, Live availability, or hidden Fixture recovery.

## Timing And Fact Review

- [ ] Three normal-pace readings finish at or below 5:00; record them only in
      the human rehearsal log owned by Issue #62.
- [ ] Product reviewer confirms the problem, audience, and demo sequence.
- [ ] Technical reviewer checks every displayed control and linked artifact
      against the exact RC.
- [ ] Security reviewer confirms provenance, `MANUAL_REVIEW`, `STOP`, and
      Clear402 wording.
- [ ] Replace the draft SHA with the immutable RC tag and commit after #59.
- [ ] Do not claim a rehearsal, review, recording, or submission occurred until
      its external evidence exists.
