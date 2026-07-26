# ADR 0003: Decision Engine v0.1 Contract

Status: Proposed
Date: 2026-07-26
Decision owner: Maintainer

## Context

[ADR 0001](./0001-preflight-report-v0-1-schema-contract.md) and
[ADR 0002](./0002-preflight-report-v0-1-implementation-values.md) fix the
PreflightReport v0.1 evidence boundary, exact serialized values, and mandatory
STOP invariants. Before implementation begins for
[#6](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/6), the Decision
Engine needs one equally exact contract for its module ownership, input and
output boundary, STOP reason codes, source references, deterministic ordering,
and acceptance tests.

A complete PreflightReport already contains `decision`, while the Decision
Engine is responsible for producing that value. Passing a complete report into
the Engine would create a circular authority boundary: an input decision could
influence, validate, or provide evidence for its own replacement. Passing
unvalidated partial objects would instead let malformed or unsupported evidence
reach policy evaluation.

This ADR separates runtime input validation from decision evaluation. It does
not use the current implementation of
[PR #15](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/15) as a
contract source. PR #15 is only a delivery dependency: the implementation of
#6 cannot begin until the accepted report-schema implementation has merged.

This ADR introduces no Decision Engine code, test, Fixture, protocol adapter,
address, RPC source, wallet behavior, signing behavior, transaction behavior,
frontend, backend, or natural-language generation.

## Decision

### Module ownership and dependency direction

Decision Engine v0.1 is owned by one package:

- Directory boundary: `packages/decision-engine/`
- Source boundary: `packages/decision-engine/src/`
- Sole public entry point: `packages/decision-engine/src/index.ts`
- Public package identity: `@moss-mini-demo/decision-engine`

All consumers import the package identity or its sole public entry point. They
must not import package-internal rule modules or define a competing decision
policy.

The allowed dependency direction is:

```text
@moss-mini-demo/report-schema
              |
              v
@moss-mini-demo/decision-engine
              |
              v
future report assembly or application orchestration
```

The Decision Engine may depend only on the public
`@moss-mini-demo/report-schema` boundary plus deterministic standard-library
operations. `report-schema` must not depend on `decision-engine`. Report
assembly may depend on both, but it cannot re-evaluate, weaken, or rewrite the
Engine result.

The package is a pure, synchronous policy evaluator. It must not perform I/O,
read the clock, read environment variables, use randomness, mutate its input,
cache a result across calls, or depend on iteration order outside the rules in
this ADR.

The package must not contain or depend on UI components, presentation models,
protocol adapters, Moss integration, RPC clients, wallets, signers, transaction
submission, persistence, network access, or natural-language generation.

### Decision input and circular-boundary removal

The rule evaluator consumes a validated `DecisionInputV0_1`, not a complete
`PreflightReport` and not a caller-defined partial report. The report-schema
public boundary owns runtime validation for this input.

`DecisionInputV0_1` has the same top-level source locations that the final
report uses for:

- `schemaVersion`, `reportId`, `generatedAt`, `network`, and `provenance`;
- `intent`, `quotes`, and `selection`;
- `capability` and `simulation`; and
- `alignment`.

The properties `decision` and `limitations` are forbidden in Engine input.
`decision` is produced by the Engine. `limitations` is appended later by report
assembly and cannot waive, downgrade, or provide evidence for a decision.
Adding these two properties after evaluation does not move or rename any
decision-input source location, so an accepted source reference resolves to
the same artifact in the input and the assembled report.

The report-schema public entry exports the strict `DecisionInputV0_1Schema`
and its inferred `DecisionInputV0_1` type. The Decision Engine public entry
exports this exact evaluator signature:

```text
evaluateDecisionV0_1(input: unknown): DecisionV0_1
```

The evaluator parses `input` with `DecisionInputV0_1Schema`; its private rule
core receives only the successful parsed value. Runtime validation is required
even when a TypeScript caller claims to hold the corresponding type, so a cast
or plain JavaScript call cannot bypass validation.

Invalid input never produces a `Decision`. The boundary rejects before rule
evaluation as follows:

| Condition | Boundary error code | Required behavior |
| --- | --- | --- |
| `schemaVersion` is absent or not exactly `0.1` | `UNSUPPORTED_SCHEMA_VERSION` | Reject; do not guess compatibility and do not emit `STOP`. |
| Any schema or cross-field constraint fails | `INVALID_DECISION_INPUT` | Reject; do not evaluate a partial object. |
| Any SourceReference is malformed, forbidden, dangling, ambiguous, circular, or unrelated to its owning record | `INVALID_SOURCE_REFERENCE` | Reject; do not copy or repair the reference. |

When more than one class applies, classification precedence is
`UNSUPPORTED_SCHEMA_VERSION`, then `INVALID_SOURCE_REFERENCE`, then
`INVALID_DECISION_INPUT`. These are input-boundary error codes, not decision
statuses and not STOP reason codes. Emitting a STOP for malformed input would
require inventing a valid source reference inside an invalid document, so it is
forbidden.

Rejection throws `DecisionInputErrorV0_1` with a readonly `code` equal to the
selected boundary error code. It returns no Result envelope, partial Decision,
reason, or fallback value. Parser issue details may be attached for debugging,
but they are not stable contract data, evidence, or an alternative decision
channel.

### Decision output

The successful evaluator return value is exactly one strict `DecisionV0_1`.
It has one of these shapes:

```text
{
  status: "MANUAL_REVIEW",
  reasons: []
}

{
  status: "STOP",
  reasons: [
    {
      code: <StopReasonCodeV0_1>,
      sourceReferences: [<SourceReference>, ...]
    },
    ...
  ]
}
```

`MANUAL_REVIEW` requires an empty `reasons` array. `STOP` requires a non-empty
`reasons` array. Every STOP reason has exactly `code` and
`sourceReferences`; presentation text, severity, risk scores, confidence,
approval, signability, executability, and extension fields are forbidden.

The Engine returns only `DecisionV0_1`, not a parallel diagnostics object.
The structured reasons are the complete decision diagnostics. A later display
layer may describe them, but generated text is not Engine output and cannot
change their meaning.

No output value such as `SAFE`, `APPROVED`, `PASS`, `PENDING`, `SIGNABLE`,
`EXECUTABLE`, or a risk score is permitted. `MANUAL_REVIEW` retains exactly the
meaning fixed by the security boundary: continue human inspection only.

### STOP reason codes and source locations

The following table is the exhaustive `StopReasonCodeV0_1` vocabulary and its
canonical output order. The rank is contract data, not an implementation hint.
`<i>` is a canonical zero-based array index without leading zeroes.

| Rank | Reason code | Trigger after valid input | Permitted evidence references |
| ---: | --- | --- | --- |
| 10 | `NO_VALID_SELECTION` | `selection.status` is `NOT_SELECTED`. | `/selection/status` |
| 20 | `CAPABILITY_FAILED` | `capability.availability` is `FAILED`. | `/capability/availability` |
| 21 | `CAPABILITY_MISSING` | `capability.availability` is `MISSING`. | `/capability/availability` |
| 22 | `CAPABILITY_UNPROVABLE` | `capability.availability` is `UNPROVABLE`. | `/capability/availability` |
| 30 | `SIMULATION_ACQUISITION_FAILED` | `simulation.availability` is `FAILED`. | `/simulation/availability` |
| 31 | `SIMULATION_MISSING` | `simulation.availability` is `MISSING`. | `/simulation/availability` |
| 32 | `SIMULATION_UNPROVABLE` | `simulation.availability` is `UNPROVABLE`. | `/simulation/availability` |
| 40 | `SIMULATION_EXECUTION_FAILED` | Available simulation has `executionStatus: FAILED`, including a rollback. | `/simulation/executionStatus` and the applicable `/simulation/receipts/raw/<i>` or `/simulation/outcomes/raw/<i>` records |
| 41 | `SIMULATION_INTERRUPTED` | Available simulation has `executionStatus: INTERRUPTED`. | `/simulation/executionStatus` and `/simulation/stateContinuity` |
| 50 | `WARNING_PRESENT` | The available original Warning collection contains one or more entries. | One or more `/simulation/warnings/raw/<i>` entries; the collection container alone is insufficient |
| 60 | `RECEIPT_FAILED` | Any available Receipt records a failed transaction or failed validation result. | Each triggering `/simulation/receipts/raw/<i>` entry |
| 61 | `RECEIPT_SET_INCOMPLETE` | Receipt evidence is available but the required transaction set is incomplete. | `/simulation/receipts` |
| 70 | `OUTCOME_FAILED` | Any available Outcome records failure. | Each triggering `/simulation/outcomes/raw/<i>` entry |
| 71 | `OUTCOME_SET_INCOMPLETE` | Outcome evidence is available but the required transaction set is incomplete. | `/simulation/outcomes` |
| 80 | `COVERAGE_INCOMPLETE` | Available coverage evidence does not prove complete Change coverage. | `/simulation/coverage` |
| 90 | `ORDERING_INVALID` | Available ordering evidence does not prove canonical Change, Receipt, Outcome, or transaction ordering. | `/simulation/ordering` |
| 100 | `STATE_CONTINUITY_INTERRUPTED` | Available state-continuity evidence shows an interrupted or missing prior-state dependency. | `/simulation/stateContinuity` |
| 110 | `CRITICAL_ALIGNMENT_FAIL` | One or more critical alignment checks have `status: FAIL`. | The union of each triggering check's validated underlying references to `intent`, `quotes`, `selection`, `capability`, or `simulation`; `/alignment/...` is forbidden |
| 111 | `CRITICAL_ALIGNMENT_REVIEW` | One or more critical alignment checks have `status: REVIEW`. | The union of each triggering check's validated underlying references to `intent`, `quotes`, `selection`, `capability`, or `simulation`; `/alignment/...` is forbidden |
| 120 | `REQUIRED_EVIDENCE_FAILED` | A decision-critical Warning, Receipt, Outcome, coverage, ordering, or state-continuity evidence component has `availability: FAILED`. | That component's exact `/simulation/<component>/availability` location |
| 121 | `REQUIRED_EVIDENCE_MISSING` | A decision-critical component listed above has `availability: MISSING`. | That component's exact `/simulation/<component>/availability` location |
| 122 | `REQUIRED_EVIDENCE_UNPROVABLE` | A decision-critical component listed above has `availability: UNPROVABLE`. | That component's exact `/simulation/<component>/availability` location |

For ranks 120 through 122, `<component>` is exactly one of `warnings`,
`receipts`, `outcomes`, `coverage`, `ordering`, or `stateContinuity`. A new
decision-critical component or reason code requires a new Maintainer ADR; an
implementation cannot extend this list within v0.1.

Available but negative evidence uses its semantic reason code, not an
availability code. For example, an available incomplete coverage record emits
`COVERAGE_INCOMPLETE`; it does not emit `REQUIRED_EVIDENCE_UNPROVABLE`.

Intent mismatch, unexpected Capability content, unexpected approvals or funds
movement, Capability integrity failure, and unconfirmed protocol, token, or
spender identity are represented by critical deterministic alignment checks.
Their status emits `CRITICAL_ALIGNMENT_FAIL` or
`CRITICAL_ALIGNMENT_REVIEW`, while the Decision reason carries the underlying
raw source references rather than citing the alignment result.

### Multiple reasons, deduplication, and deterministic output

The Engine evaluates every mandatory rule and returns all independently
triggered STOP reason codes. It must not stop after the first failure. Any one
reason forces `STOP`, regardless of successful quotes, a selected protocol, a
successful simulation execution status, favorable evidence, provenance, or
non-critical alignment results.

Output is canonicalized as follows:

1. There is at most one reason object for each reason code.
2. All source references for the same code are aggregated.
3. Byte-identical canonical pointer strings are deduplicated.
4. References within a reason are sorted by ascending UTF-8 byte order.
5. Reasons are sorted by the numeric rank in the table above.
6. No input traversal order, object insertion order, or set iteration order may
   affect the result.

If one artifact triggers more than one independently observable rule, each
applicable code remains present. For example, an interrupted simulation and
available evidence of interrupted state continuity emit both ranks 41 and 100.
Repeated evaluation of deeply equal input must produce a deeply equal output,
and evaluation must not mutate the input.

### SourceReference trust boundary

Every Decision reason has at least one SourceReference permitted by its row in
the reason table. References are validated against `DecisionInputV0_1` before
rule evaluation and are revalidated against the assembled report before that
report is accepted.

An allowed reference must:

- use the canonical RFC 6901 form fixed by ADR 0002;
- resolve to exactly one existing decision-input source record, raw artifact,
  explicit availability discriminator, or explicit negative fact;
- be relevant to the owning reason code under the table above;
- remain independently inspectable without explanatory prose; and
- resolve to the same source value after `decision` and `limitations` are
  added to the report.

The first decoded segment of a Decision reason reference may be only `intent`,
`quotes`, `selection`, `capability`, or `simulation`. References rooted at
`decision`, `limitations`, or `alignment` are forbidden. A reason cannot point
to its own output, another reason, an alignment result, generated prose, a
display model, or a presentation extension.

A reference to a schema-owned `sourceReferences` field is always forbidden,
including a reference from one metadata array to another. This removes
self-proof and cycles. The Engine may read an alignment check's already
validated references, but it copies their underlying source targets into the
Decision reason; it never points at `/alignment/<i>/sourceReferences`.

Path ownership is structural, not a global segment-name blacklist. Inside a
schema-owned `raw` subtree, an original payload key named `sourceReferences`,
`display`, `prose`, `extension`, or `extensions` remains ordinary immutable
source data and is not rejected by name. The same names are forbidden only
when they identify report-owned reference metadata or derived presentation
fields outside `raw`.

An absent, dangling, unrelated, ambiguous, metadata-targeting, or circular
reference rejects the entire decision input. A human-readable reason or
limitation cannot substitute for a reference.

### Acceptance-test matrix

Issue #6 implementation must test the package through its sole public entry
point with Node 22 and synthetic, offline data only.

For every reason code in the exhaustive table, a parameterized acceptance
matrix must prove all of the following:

1. The exact trigger with the exact relevant source reference emits STOP and
   the expected code.
2. The same trigger with an empty or omitted reference list is rejected.
3. A syntactically valid but dangling reference is rejected.
4. A resolvable but unrelated reference is rejected.
5. A reference to schema-owned `sourceReferences`, `decision`, `limitations`,
   or `alignment` is rejected.
6. A self-reference or cycle through reference metadata is rejected.

The implementation also requires tests for:

- all three input-boundary error classes and their precedence;
- rejection of a complete PreflightReport as Engine input;
- acceptance of raw payload keys named `sourceReferences`, `display`, `prose`,
  `extension`, and `extensions` when the path is inside `raw`;
- every individual reason trigger;
- every availability versus available-negative distinction;
- multiple simultaneous reasons in canonical rank order;
- repeated triggers collapsing to one reason code with sorted unique refs;
- mandatory STOP overriding otherwise successful evidence;
- the exact MANUAL_REVIEW boundary: valid input, selected quote, available and
  successful simulation, empty proven Warning collection, complete and
  favorable critical evidence, and every critical alignment check `PASS`;
- `MANUAL_REVIEW` with exactly an empty reasons array;
- deterministic deep equality across repeated evaluations and differently
  ordered equivalent construction inputs;
- no mutation of frozen input; and
- a Node 22 package-name import smoke test for
  `@moss-mini-demo/decision-engine`.

Tests must not access a network, use a real address, use real chain or protocol
evidence, claim a Fixture is live evidence, or depend on the current contents
of PR #15.

### Delivery and authorization order

This ADR may be reviewed and merged while PR #15 is being repaired. Its merge
does not complete #6 and does not authorize implementation to start before the
report-schema dependency has merged.

After this ADR is Accepted and merged, the Maintainer records the fixed #6
contract, owner, dependency, and acceptance matrix on Issue #6. Issue #6
remains Ready. Actual Decision Engine implementation may begin only after #5
and its implementation PR have merged to `main` and the resulting main head
has passed `quality-gate`.

The #6 implementation pull request must start from that latest main head,
remain Draft until its own current-head checks and review conditions pass, and
must not reinterpret ADR 0001, ADR 0002, or this ADR. Tracker #4 remains Open
and In Progress. M1 remains incomplete.

## Alternatives considered

### Pass a complete PreflightReport into the Engine

Rejected. The input would already contain the Decision that the Engine owns,
creating circular authority and allowing decision or limitation content to
influence its own validation.

### Accept any partial object and return STOP for parse failures

Rejected. An invalid object cannot supply the valid, independently resolvable
source reference required by every STOP reason. Input rejection and policy STOP
are separate fail-closed outcomes.

### Return only the first STOP reason

Rejected. It hides simultaneous mandatory failures, makes remediation
iterative, and lets traversal order affect observable output.

### Return Decision plus free-form diagnostics

Rejected. A second diagnostic channel can drift from reason codes and can make
generated explanation appear evidentiary. Structured Decision reasons are the
only evaluation diagnostics.

### Let each alignment check define a new Decision reason code

Rejected. It would let an implementation or adapter expand public Decision
semantics without a Maintainer decision. v0.1 uses the two fixed critical
alignment codes and preserves the underlying raw evidence references.

## Security and trust-boundary impact

This ADR preserves every mandatory STOP condition in `docs/security-boundary.md`
and the module direction in `docs/architecture.md`. It does not convert input
failure into success, allow decision self-reference, or treat alignment output,
prose, provenance, or a successful simulation status as sufficient evidence.

`MANUAL_REVIEW` remains permission to continue human inspection only. It is not
safe, approved, signable, executable, or a guarantee. Any mandatory STOP
reason overrides favorable evidence. Raw Capability and simulation artifacts
remain owned by their source contracts and are never rewritten by the Engine.

## Consequences

- #6 has one package boundary, one public evaluator, one exhaustive reason-code
  vocabulary, and one deterministic output algorithm.
- Report assembly cannot provide an existing Decision or limitations as Engine
  input.
- Invalid or unsupported evidence is rejected before policy evaluation rather
  than represented by an unverifiable Decision.
- Consumers can test and render stable reason codes without inventing safety
  semantics or parsing generated prose.
- Adding a reason code, changing rank, broadening an allowed evidence path, or
  changing the Decision shape requires a new Maintainer ADR and version
  decision.
- The report-schema implementation must expose a runtime-validated
  DecisionInput v0.1 boundary that is compatible with this contract before #6
  implementation begins.

## Verification

This ADR is implementation-ready when review confirms:

- the package, public entry, and one-way dependency direction are exact;
- Decision input excludes `decision` and `limitations` and retains stable
  report-local source locations;
- unsupported versions, invalid schemas, and invalid SourceReferences reject
  before evaluation without manufacturing a STOP;
- output contains only `MANUAL_REVIEW` or `STOP` and no second diagnostic or
  authorization channel;
- the reason-code table is exhaustive, uniquely ranked, and maps every code to
  independently checkable source locations;
- all reasons are returned, deduplicated, and sorted deterministically;
- report-owned reference metadata and derived results cannot self-prove, while
  identically named raw payload fields remain valid source data;
- the acceptance matrix covers every code, invalid association class,
  multi-reason behavior, and the exact MANUAL_REVIEW boundary;
- no existing STOP condition or MANUAL_REVIEW meaning is weakened;
- PR #15 is referenced only as a delivery dependency, not as a contract source;
  and
- the ADR pull request contains only this decision document and the ADR index.

The Proposed ADR pull request must pass `quality-gate`. Only the Maintainer may
then mark it Accepted. The Accepted current head must pass `quality-gate` again
before the Maintainer performs the Merge Gate.

## Related Issues and pull requests

- [ADR 0001: PreflightReport v0.1 Schema Contract](./0001-preflight-report-v0-1-schema-contract.md)
- [ADR 0002: PreflightReport v0.1 Implementation Values](./0002-preflight-report-v0-1-implementation-values.md)
- [#4 M1 Evidence Contract Delivery Tracker](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/4)
- [#5 PreflightReport v0.1 runtime schema](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/5)
- [#6 Decision Engine](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/6)
- [PR #15 report-schema implementation dependency](https://github.com/Moss-Mini-Demo/moss-mini-demo/pull/15)

This ADR authorizes no implementation by itself. Authorization, dependency,
assignee, labels, and Project state are recorded separately on #6 after this
decision is Accepted and merged.
