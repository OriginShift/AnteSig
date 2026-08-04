# M1 Completion Evidence and Criteria

Snapshot date: 2026-08-05 (Asia/Hong_Kong)

Snapshot baseline:
`main@9e0d5c074517c3f95ab2ccecc35c2c0176ef7faf`

## Purpose and closure boundary

This document inventories the M1 engineering deliverables and evidence
boundaries present at the exact baseline above. It is an input to a later
Maintainer assessment. It is not an M1 closure certificate, a product Gate, a
safety Gate, or authorization to start M2 implementation.

Issue [#9](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/9) owns this
documentation delivery. Tracker
[#4](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/4) separately owns
the M1 closure assessment. At this snapshot, both Issues and the
[M1 Milestone](https://github.com/Moss-Mini-Demo/moss-mini-demo/milestone/2)
remain open. Their current lifecycle state is recorded by GitHub, not inferred
from this file.

After #9 is merged, the Maintainer must separately verify the new exact `main`
SHA and its push `quality-gate` before deciding whether to close #4 or the M1
Milestone. A green check on this branch or the baseline does not perform that
control-plane action.

## Baseline quality evidence

The exact baseline was verified by the
[`quality-gate` run](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30937008262)
and its
[`quality-gate` job](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30937008262/job/92085564423):

- clean GitHub checkout of
  `9e0d5c074517c3f95ab2ccecc35c2c0176ef7faf`;
- Node `22.23.1` and pnpm `11.16.0`;
- frozen-lockfile installation;
- format, lint, strict no-emit typecheck, ordered package builds, and public
  package-name import smoke tests;
- 13 test files and 655 tests passed; and
- job conclusion `success`.

At the snapshot date, main branch protection reports `quality-gate` as a
strict required check. The workflow and branch-protection configuration are
not modified by #9. Tooling, tests, documentation, and green CI show only that
the checked engineering contracts passed their defined checks. They are not
application behavior, protocol evidence, real-chain evidence, or a safety
guarantee.

## Engineering artifacts present

### Tooling and workspace

The repository has a pnpm workspace containing the root project and the
registered `packages/*` boundary. It constrains Node 22 and pnpm 11 and uses
strict no-emit TypeScript validation, Biome formatting and linting, Vitest,
ordered package builds, public package import smoke tests, and the stable
`quality-gate` GitHub Actions job.

### PreflightReport v0.1 Schema

The public `@moss-mini-demo/report-schema` package owns runtime validation for
the strict `PreflightReport` v0.1 contract and its DecisionInput projection.
Its public runtime boundary includes `PreflightReportSchema` and
`DecisionInputV0_1Schema`; consumers do not need package-internal imports or a
competing report shape.

The Schema validates structure, canonical scalar formats, cross-field
relations, SourceReference syntax and ownership, the closed STOP vocabulary,
and the MANUAL_REVIEW/STOP invariants. Validation does not collect Quotes,
construct Capability, run simulation, calculate Alignment, assemble a report,
or create evidence.

### Decision Engine v0.1

The public `@moss-mini-demo/decision-engine` runtime API is
`evaluateDecisionV0_1` plus `DecisionInputErrorV0_1`. `DecisionV0_1` and
`StopReasonCodeV0_1` are type exports.

The Engine parses unknown input through the public DecisionInput Schema, then
evaluates the accepted closed 22-code matrix. It is pure, synchronous, offline,
deterministic, fail-closed, and tested not to mutate its input. It returns only
`MANUAL_REVIEW` with no reasons or `STOP` with structured, source-associated
reasons. It does not create or strengthen source evidence, calculate Alignment,
perform I/O, or authorize execution.

### Synthetic development Fixtures

All three Fixture files declare `provenance: FIXTURE`. Every identifier and raw
payload is synthetic.

| Fixture | Checked behavior | Boundary |
| --- | --- | --- |
| `manual-review-success.v0.1.json` | A selected successful synthetic Quote, available successful synthetic simulation evidence, empty Warnings, complete coverage, valid ordering, continuous state, and critical PASS Alignment validate with `MANUAL_REVIEW`. | Favorable Schema path only; not a STOP scenario or real evidence. |
| `token-out-mismatch.v0.1.json` | A synthetic tokenOut mismatch creates one critical failed Alignment and exact `CRITICAL_ALIGNMENT_FAIL` STOP, even though the synthetic simulation is `SUCCESS`. The public Engine recomputes the stored Decision. | Regression data only; no real token, protocol, simulation, or chain observation. |
| `amount-in-mismatch.v0.1.json` | A synthetic 1-versus-10 amountIn mismatch creates one critical failed Alignment and exact `CRITICAL_ALIGNMENT_FAIL` STOP, while the synthetic simulation remains `SUCCESS`. The public Engine recomputes the stored Decision deterministically without changing input. | Regression data only; amounts are synthetic integer strings, not economic or chain evidence. |

Fixture JSON, static identifiers, synthetic raw payloads, synthetic Quotes,
Receipts, Outcomes, simulation records, Alignments, decisions, and green tests
are not Moss, Monad, protocol, wallet, RPC, or chain evidence.

`MANUAL_REVIEW` is not a safety conclusion, approval, authorization, execution
guarantee, or permission to sign. `STOP` is a structured fail-closed result,
not proof of safety, transaction authorization, or real-chain observation.

## M1 delivery traceability

The table records the GitHub and Git history observed at the snapshot baseline.
Each CI link is the successful push run for the listed main commit.

| Issue | Delivered scope | Closing PR or decision record | Main commit | Merged-main CI |
| --- | --- | --- | --- | --- |
| [#3](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/3) | M1-01 TypeScript workspace and quality gate | [PR #10](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/10) | `edd37e0b977fe2821752dda4d4c3b4715238ffe8` | [run 30131866900](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30131866900) |
| [#4](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/4) | M1 delivery tracker and separate closure assessment | GitHub Issue is the live control record | No closure commit at this snapshot | Requires a future exact-main assessment after #9 |
| [#5](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/5) | M1-02 PreflightReport v0.1 runtime Schema | [PR #15](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/15) | `a210d9c297ddef4b42648b2c1343da5b9c19a407` | [run 30263166240](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30263166240) |
| [#6](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/6) | M1-03 fail-closed Decision Engine | [PR #66](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/66) | `aa7ea761b2ac5e78535387e0a7d04d45485cdfb1` | [run 30833497929](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30833497929) |
| [#7](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/7) | M1-04 MANUAL_REVIEW success Fixture | [PR #16](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/16) | `316dd1478b46185df862be80499963e42d73855b` | [run 30277600027](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30277600027) |
| [#8](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/8) | M1-05 tokenOut mismatch STOP Fixture | [PR #67](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/67) | `c52384448e0016d36f2e723f8cdf37f10315e1c8` | [run 30870163331](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30870163331) |
| [#9](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/9) | M1-06 evidence-boundary and completion-criteria documentation | GitHub Issue is the live lifecycle record | Not predeclared by this evidence snapshot | Future exact-head and merged-main CI are required |
| [#18](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/18) | M1-07 DecisionInput/MANUAL_REVIEW contract clarification | [Maintainer Accepted record](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/18#issuecomment-5133046404) | Decision-only Issue; runtime correction delivered by #19 | Runtime evidence is recorded with #19 |
| [#19](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/19) | M1-08 ADR 0004 DecisionInput and strict STOP boundary | [PR #65](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/65) | `27a9bc66f483a25d6602fdac2748099bfb32d67e` | [run 30604382716](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30604382716) |
| [#20](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/20) | M1-09 amountIn mismatch STOP Fixture | [PR #68](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/68) | `9e0d5c074517c3f95ab2ccecc35c2c0176ef7faf` | [run 30937008262](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30937008262) |

## Supporting contract records

These records support M1 but are separate from the closing Issue rows above.

| Record | Delivery | Main commit | Merged-main CI |
| --- | --- | --- | --- |
| [ADR 0001](./adr/0001-preflight-report-v0-1-schema-contract.md) | [PR #13](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/13) | `241befaed79177229385c24811805908299768a2` | [run 30153270916](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30153270916) |
| [ADR 0002](./adr/0002-preflight-report-v0-1-implementation-values.md) | [PR #14](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/14) | `7f9c143e6c6b1cd4e161156fa8a5f6015f72a477` | [run 30158117333](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30158117333) |
| [ADR 0003](./adr/0003-decision-engine-v0-1-contract.md) | [PR #17](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/17) | `29d2cbcbb815eee81f16773b1487991386303c60` | [run 30207909234](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30207909234) |
| [ADR 0004](./adr/0004-decision-input-and-stop-reason-correction.md) | #18 decision, implemented by [PR #65](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/65) | `27a9bc66f483a25d6602fdac2748099bfb32d67e` | [run 30604382716](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30604382716) |
| [STOP presentation requirements](./stop-presentation.md) | [Issue #11](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/11) / [PR #12](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/12) | `7bbbc8bb9b4acb859bc73ba2b861f657864cce5c` | [run 30752494660](https://github.com/Moss-Mini-Demo/moss-mini-demo/actions/runs/30752494660) |

## Completion criteria for the separate tracker assessment

The later Maintainer-owned #4 assessment must verify all of these conditions
against the then-current exact `main`, not merely rely on this snapshot:

- all required M1 implementation and documentation Issues are closed through
  accepted merged changes or an explicit decision record;
- #9 is merged and the resulting `main` push `quality-gate` succeeds;
- the strict required `quality-gate` remains configured on main;
- a clean checkout completes the frozen install and full root `pnpm check`;
- both packages build and import through their public package names;
- the complete Schema and Decision Engine suites, including the closed 22-code
  matrix, pass;
- all three synthetic Fixtures validate, and both mismatch Fixtures reproduce
  their stored STOP Decision through the public Engine;
- the Fixture/non-evidence and MANUAL_REVIEW/STOP limitations remain explicit;
  and
- the final exact-main diff and repository state contain no unreviewed M1
  scope expansion.

Only after that assessment may the Maintainer decide whether #4 and the M1
Milestone meet their closure conditions. This evidence list does not make that
decision and does not make a green CI result a safety guarantee.

## Capabilities not implemented in M1

This repository is not a runnable application. M1 does not provide:

- a frontend, backend, API, report orchestrator, database, deployment, or
  product demo;
- Moss discovery, loading, action, Capability construction, or simulation;
- Monad RPC or local-fork connectivity;
- Kuru, PancakeSwap, or other live protocol Quote integration;
- live Receipt, Outcome, Warning, gas, coverage, ordering, state-continuity, or
  Alignment production;
- real addresses, private keys, API keys, wallets, signing, transaction
  broadcast, or chain integration; or
- real Moss, Monad, protocol, RPC, wallet, simulation, Receipt, Quote, or
  other real-chain evidence.

The Schema validates supplied data, the Engine evaluates validated data, and
the Fixtures exercise synthetic paths. None of them proves the target product
exists or that an operation is safe, approved, authorized, executable, or
signable.

## M2 planning snapshot

This section is informational only. It records the GitHub planning state at the
snapshot date and does not assign, authorize, start, or complete M2 work.

- [#22](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/22) is the
  accepted and closed M2 runtime and module-boundary decision.
- [#23](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/23),
  [#24](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/24), and
  [#32](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/32) are Ready
  and unassigned at this snapshot.
- #24 must precede #32 final review and merge because their workspace and
  lockfile changes may overlap.
- Every other M2 Issue remains governed by its own direct dependency and Scope
  Gates.

Current GitHub Issue, Project, Milestone, Review, and Merge Gate state remains
the control-plane source of truth.
