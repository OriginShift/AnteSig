# ADR 0004: DecisionInput and STOP reason correction

Status: Accepted
Date: 2026-07-31
Decision owner: Maintainer

## Context

ADR 0003 correctly requires a fail-closed Decision Engine, closed STOP reason
vocabulary, source evidence, and deterministic output. Its Decision output
shape and several SourceReference examples conflict with the merged v0.1
runtime schema and fixture:

- ADR 0003 shows `MANUAL_REVIEW` with `reasons: []`; the merged report contract
  uses exactly `{ status: "MANUAL_REVIEW" }`.
- ADR 0003 refers to collection `raw/<i>` locations; the runtime schema owns
  the canonical collection records at `items/<i>`.
- The runtime schema currently permits any stable string as a STOP reason code.
- The runtime schema checks all STOP references as one aggregate set, allowing
  one arbitrary reason to cover multiple unrelated triggers.
- Receipt and Outcome records have no expected transaction set, expected count,
  or completeness proof. A non-empty collection is not, by itself, proof that
  the collection is complete.

Issue #18 accepted this correction before a Decision Engine implementation or
STOP fixture exists. This ADR records one executable v0.1 contract for Issue
#19 and the subsequent Decision Engine work.

## Decision

### Version classification

This is a pre-Decision-Engine v0.1 contract correction. It does not create a
v0.2 schema, add a decision state, add a reason code, add a completeness field,
or change a source-record location. It makes the accepted fail-closed boundary
runtime-enforceable before a consumer or Engine release exists.

Adding expected transaction identities or counts, adding a Receipt/Outcome
completeness proof, renaming or adding a STOP reason code, or changing a
Decision JSON shape requires a separate Maintainer ADR and version decision.

### DecisionInput boundary

`@moss-mini-demo/report-schema` exports the strict runtime
`DecisionInputV0_1Schema` and inferred `DecisionInputV0_1` type. It contains
exactly these top-level source locations:

```text
schemaVersion, reportId, generatedAt, network, provenance
intent, quotes, selection
capability, simulation
alignment
```

It rejects `decision`, `limitations`, `presentation`, `credential`, every
unknown field, invalid schema version, invalid cross-field input, and malformed,
dangling, metadata-targeting, cyclic, or owner-unrelated SourceReferences.
`DecisionInputV0_1` is not a partial report and is not a complete
`PreflightReport` with fields ignored.

`decision` is Engine output. `limitations` are added only after evaluation and
cannot waive or supply evidence for a Decision. Existing source paths are kept
stable when those output fields are appended.

### Decision output

The v0.1 Decision shapes are exactly:

```json
{ "status": "MANUAL_REVIEW" }
```

```json
{
  "status": "STOP",
  "reasons": [
    {
      "code": "<StopReasonCodeV0_1>",
      "sourceReferences": ["<canonical SourceReference>"]
    }
  ]
}
```

`MANUAL_REVIEW` has no `reasons` property. `STOP` has one or more strict reason
objects and no presentation prose, severity, confidence, authorization, or
extension field. Generic failure, quote, selection, and limitation codes remain
`StableCode` values; only `decision.reasons[*].code` uses the closed STOP enum.

### STOP code and evidence ownership

`StopReasonCodeV0_1` is exactly this closed vocabulary and order:

| Rank | Code | Canonical evidence location |
| ---: | --- | --- |
| 10 | `NO_VALID_SELECTION` | `/selection/status` |
| 20-22 | `CAPABILITY_FAILED`, `CAPABILITY_MISSING`, `CAPABILITY_UNPROVABLE` | `/capability/availability` |
| 30-32 | `SIMULATION_ACQUISITION_FAILED`, `SIMULATION_MISSING`, `SIMULATION_UNPROVABLE` | `/simulation/availability` |
| 40 | `SIMULATION_EXECUTION_FAILED` | `/simulation/executionStatus` |
| 41 | `SIMULATION_INTERRUPTED` | `/simulation/executionStatus` |
| 50 | `WARNING_PRESENT` | every triggering `/simulation/warnings/items/<i>` |
| 60 | `RECEIPT_FAILED` | every triggering `/simulation/receipts/items/<i>` |
| 61 | `RECEIPT_SET_INCOMPLETE` | `/simulation/receipts/items`, only when the collection is empty |
| 70 | `OUTCOME_FAILED` | every triggering `/simulation/outcomes/items/<i>` |
| 71 | `OUTCOME_SET_INCOMPLETE` | `/simulation/outcomes/items`, only when the collection is empty |
| 80 | `COVERAGE_INCOMPLETE` | `/simulation/coverage` |
| 90 | `ORDERING_INVALID` | `/simulation/ordering` |
| 100 | `STATE_CONTINUITY_INTERRUPTED` | `/simulation/stateContinuity` |
| 110 | `CRITICAL_ALIGNMENT_FAIL` | union of the underlying validated input references for critical `FAIL` checks |
| 111 | `CRITICAL_ALIGNMENT_REVIEW` | union of the underlying validated input references for critical `REVIEW` checks |
| 120-122 | `REQUIRED_EVIDENCE_FAILED`, `REQUIRED_EVIDENCE_MISSING`, `REQUIRED_EVIDENCE_UNPROVABLE` | each exact `/simulation/<component>/availability` |

For ranks 120-122, `<component>` is exactly `warnings`, `receipts`, `outcomes`,
`coverage`, `ordering`, or `stateContinuity`.

Every reason object must contain all and only the evidence locations that
triggered that reason code. A reason cannot borrow references belonging to a
different code. One code appears at most once; repeated triggers for that code
aggregate unique references. Reasons are sorted by the rank above.

The canonical collection records are:

```text
/simulation/warnings/items/<i>
/simulation/receipts/items/<i>
/simulation/outcomes/items/<i>
/simulation/coverage
/simulation/ordering
/simulation/stateContinuity
```

The ADR 0003 `raw/<i>` examples are not v0.1 DecisionInput paths.

### Receipt and Outcome completeness limit

From `items` alone, v0.1 can prove only that an empty Receipt or Outcome
collection is incomplete. It cannot detect every non-empty but partially
missing collection because the contract has no expected set or independent
completeness proof. Non-empty does not mean complete, and v0.1 must not claim
otherwise.

An Adapter that cannot independently prove a required non-empty collection is
complete must not represent that inability as a favorable fact. A future
completeness-proof contract requires the version decision described above.

## Alternatives considered

### Keep ADR 0003 and accept the current runtime schema

Rejected. It leaves arbitrary STOP codes and global reference coverage as
schema-valid output, so a report can be structurally valid while violating the
accepted trust boundary.

### Add expected transaction sets in this correction

Rejected. It would add new evidence semantics and producer obligations across
the schema, Adapter, fixtures, Engine, and report consumers. That is v0.2 work,
not a correction.

### Let generated explanation text carry the missing distinction

Rejected. Generated text is not evidence and cannot repair an ambiguous source
contract or substitute for a code-specific SourceReference.

## Security and trust-boundary impact

This correction preserves the two existing decision states and the rule that
missing, unprovable, failed, or adverse critical evidence does not become a
favorable conclusion. It prevents a STOP reason from self-proving, from using
another reason's evidence, or from presenting an arbitrary string as a stable
decision diagnostic.

`MANUAL_REVIEW` remains permission for human inspection only, not approval,
safety, signability, executability, or a guarantee.

## Consequences

- Issue #19 owns the runtime boundary, ADR record, and tests.
- Issue #6 consumes the exported input schema and implements the same closed
  code table without adding aliases or alternative diagnostics.
- Existing generic `StructuredReasonSchema` remains available for non-Decision
  records, so quote, selection, and acquisition failures do not inherit STOP
  vocabulary accidentally.
- Consumers can render a stable STOP vocabulary and follow each reason to its
  own evidence without treating UI copy as evidence.

## Verification

```bash
pnpm --filter @moss-mini-demo/report-schema build
pnpm vitest run packages/report-schema/test
pnpm test:package-import
pnpm typecheck
pnpm lint
pnpm format:check
pnpm check
git diff --check
```

The test matrix must prove strict DecisionInput projection, forbidden-field
rejection, public-entry imports, fixed STOP code rejection, code-specific
reference ownership, multi-reason order, canonical `items/<i>` paths, obsolete
`raw/<i>` rejection, and the empty-only Receipt/Outcome set rule.

## Related Issues and pull requests

- [#18 M1-07 decision](https://github.com/OriginShift/AnteSig/issues/18)
- [#19 M1-08 implementation](https://github.com/OriginShift/AnteSig/issues/19)
- [#6 Decision Engine](https://github.com/OriginShift/AnteSig/issues/6)
- [ADR 0001](./0001-preflight-report-v0-1-schema-contract.md)
- [ADR 0002](./0002-preflight-report-v0-1-implementation-values.md)
- [ADR 0003](./0003-decision-engine-v0-1-contract.md)
