# ADR 0001: PreflightReport v0.1 Schema Contract

Status: Accepted
Date: 2026-07-25
Decision owner: Maintainer

Implementation values and canonical formats are clarified by
[ADR 0002](./0002-preflight-report-v0-1-implementation-values.md). ADR 0002 is
part of the fixed v0.1 contract.

## Context

M1 requires a runtime-validated PreflightReport v0.1 before later work can
implement alignment, decision evaluation, success and STOP fixtures, or
documentation. The report must preserve the security boundary already defined
by the repository:

- `MANUAL_REVIEW` is not a safety conclusion or authorization to sign.
- `STOP` is required for warnings, rollback, Receipt failure, unprovable
  coverage or ordering, state-chain interruption, intent mismatch, and missing
  critical evidence.
- The original Capability and raw simulation evidence are immutable source
  artifacts. Display models cannot change their meaning.
- Asset identity is address-based; symbols and generated prose are display data
  only.

Without a contract, an implementation could make material evidence optional,
mix display output with source evidence, introduce non-canonical value formats,
or produce a `MANUAL_REVIEW` result that cannot be checked against its inputs.

This ADR is a pre-implementation decision. It does not create a runtime
schema, TypeScript type, test fixture, address, protocol integration, Moss or
Monad integration, wallet behavior, frontend, or backend.

## Decision

### Module ownership and public boundary

The future runtime schema is owned by a single package:

- Directory boundary: `packages/report-schema/`
- Source boundary: `packages/report-schema/src/`
- Sole public entry point: `packages/report-schema/src/index.ts`
- Public package identity: `@moss-mini-demo/report-schema`

Issue #5 is responsible for creating this package and registering the future
`packages/*` workspace boundary. This ADR does not change the current
root-only workspace configuration.

The package owns report validation, report-domain types, canonical scalar
validation, discriminated report states, and cross-field invariants. It does
not own protocol adapters, Moss calls, RPC calls, quote collection, wallet
operations, display components, report persistence, or decision policy beyond
encoding the already-approved invariants below.

All future consumers import the public package entry point. They must not
import package-internal validation modules or define competing report shapes.

### PreflightReport v0.1 envelope

`schemaVersion` is required and has the exact value `0.1`. A v0.1 parser
rejects reports claiming another version rather than guessing compatible
semantics.

The source report has these required top-level responsibilities:

| Component | Responsibility | Not responsible for |
| --- | --- | --- |
| `schemaVersion` | Identifies this exact contract version. | Compatibility guessing. |
| `reportId`, `generatedAt`, `network`, `provenance` | Identifies the report, its generation context, and whether evidence is fixture, local-fork, or live-source evidence. | Proving a later chain state. |
| `intent` | Records the user constraints being evaluated. | Execution proof. |
| `quotes` | Records each quote attempt and its success or failure evidence. | Final execution proof. |
| `selection` | Records whether a protocol was selected, which successful quote supports it, and why. | A claim that the selected protocol is best or safe. |
| `capability` | Preserves the original Capability source artifact and its availability state. | A normalized tree or UI hierarchy. |
| `simulation` | Preserves original ordered simulation evidence, including warnings, Receipts, Outcomes, coverage, ordering, and state continuity. | A guarantee about later execution. |
| `alignment` | Records deterministic checks between intent, selection, Capability, and simulation evidence. | Filling a gap with generated prose. |
| `decision` | Records only `MANUAL_REVIEW` or `STOP`, its reasons, and source references. | Safety approval, signing authorization, or execution. |
| `limitations` | Records known report limitations and temporal constraints. | Hiding a critical evidence failure. |

The report source contract is strict for decision-critical fields. Unknown or
reinterpreted decision-critical fields are rejected. Non-critical presentation
extensions, if later needed, must be isolated in an explicitly versioned,
namespaced extension boundary and must not affect validation or the decision.

### Source evidence and derived-model separation

`PreflightReport` is a source-evidence contract. It stores original Capability
and simulation artifacts, their provenance, and source references. It does not
store a Capability display tree, Receipt prose, generated summary, UI state, or
other derived presentation as a substitute for source evidence.

Derived models are separate sidecars owned by their future presentation
consumer. They may index, label, or summarize source artifacts only when each
derived value remains traceable to a source reference. They must not:

- mutate, reorder, remove, insert, or reconstruct the original Capability;
- suppress a Warning, failed Receipt, coverage failure, ordering failure, or
  state-chain interruption;
- provide a decision input that is absent from the source report; or
- convert a missing or unprovable source fact into a display assertion.

The Capability contract uses a required availability discriminator. When the
original tree is present, its raw source payload is required and must be
preserved losslessly. When it is missing, failed, or unprovable, the report
uses an explicit failure record with evidence references; it does not omit the
Capability field.

The simulation contract follows the same rule. Raw ordered evidence is required
when available. Otherwise, an explicit availability or failure record is
required. Receipt, Outcome, Warning, coverage, ordering, and state-continuity
facts cannot disappear through optional fields.

### Canonical scalar and identity rules

No real address, protocol identifier, token, spender, RPC endpoint, or chain
example is introduced by this ADR.

#### EVM addresses and native assets

- An `EvmAddress` represents exactly 20 bytes using the `0x` prefix plus 40
  hexadecimal characters and must satisfy EIP-55 checksum semantics.
- The zero address is rejected for every asset, protocol, spender, account, or
  recipient identity field in v0.1.
- Wrong length, missing prefix, non-hex characters, whitespace, non-canonical
  case, checksum failure, and display symbols are rejected as EVM addresses.
- An asset is a tagged value, not a symbol or overloaded address string. The
  native asset uses the exact native tag; an ERC-20 asset uses the EVM-address
  tag and an `EvmAddress` value.
- Native assets must never be encoded with a zero address or a sentinel address.
- Token symbols, names, icons, and decimals are display metadata only and do
  not satisfy identity validation.

#### Amounts and slippage

- All token, gas, quote, balance, and transfer amounts use canonical base-10
  unsigned integer strings in smallest units.
- Canonical amount strings allow only `0` or a non-zero digit followed by digits.
  They reject floating-point values, decimal points, exponent notation, signs,
  whitespace, separators, leading zeroes, JavaScript numbers, and locale text.
- Fields whose semantic value must be positive, including intent input amount
  and successful-quote output amount, reject `0`.
- `maxSlippageBps` is a finite, safe JSON integer in the inclusive range from
  0 through 10,000. Fractions, negative values, non-finite values, and values
  above 10,000 are rejected. It is a bounded basis-point value, never a token
  amount or percentage string.

#### Protocol and state vocabularies

- A `ProtocolId` is a non-empty, canonical machine identifier. It is not an
  address, marketing label, or token symbol. This ADR declares no protocol
  values.
- `QuoteStatus` has exactly `SUCCESS` and `FAILED`. A successful quote carries
  the comparable input and output constraints plus evidence context. A failed
  quote carries an explicit structured failure record.
- `AlignmentStatus` has exactly `PASS`, `FAIL`, and `REVIEW`. Every alignment
  check declares whether it is critical and includes source references.
- `DecisionStatus` has exactly `MANUAL_REVIEW` and `STOP`. No synonym such as
  safe, approved, executable, warning-only, or pending is permitted.

### Required cross-field invariants

The future schema must reject a report that violates any of these invariants.
They are schema-enforced constraints, not UI guidance.

1. `intent.allowedProtocols` is non-empty and contains unique `ProtocolId`
   values. A selected protocol must appear in this set.
2. A `SELECTED` selection must reference a quote whose status is `SUCCESS`,
   whose protocol equals the selected protocol, and whose assets and input
   amount match the selected intent. A no-selection state is explicit and
   cannot impersonate a selected protocol.
3. A `MANUAL_REVIEW` decision requires a successful simulation, present and
   provable critical evidence, no raw Warning, and `PASS` for every critical
   alignment check. A failed, missing, interrupted, unprovable, or otherwise
   non-successful simulation is incompatible with `MANUAL_REVIEW`.
4. A critical alignment status of either `FAIL` or `REVIEW` is incompatible
   with `MANUAL_REVIEW`. Non-critical checks remain visible with their status
   and references; they do not erase a critical failure.
5. Every decision-critical source artifact uses an explicit availability state.
   Missing, unprovable, failed, or unavailable evidence requires `STOP` and a
   structured reason. It cannot be hidden by omitting a field, an empty object,
   a nullable success field, or generated explanation text.
6. Every `STOP` reason has a stable reason code and at least one resolvable
   source reference. A Warning-driven STOP references one or more elements of
   the original warning collection. A Receipt, coverage, ordering,
   state-continuity, or alignment STOP references the raw source or explicit
   availability record that triggered it.
7. Every source reference resolves to a report-local immutable artifact and
   location. A dangling, ambiguous, or display-only reference invalidates the
   report. Reference syntax and any integrity metadata are implementation
   details, but must be deterministic and independently checkable.
8. `limitations` may describe known constraints, but it cannot downgrade,
   waive, or replace a mandatory `STOP` reason.

### Fixture and evidence provenance boundary

Every report declares its provenance. A fixture is explicitly synthetic and
must identify itself as fixture-origin evidence. A fixture may demonstrate a
contract path, but it is never described as real Moss, Monad, protocol,
Receipt, quote, or chain evidence.

Fixture work in #7 and #8 may use schema-valid synthetic identifiers only. It
must not add a real address or assert that a synthetic payload came from a live
network, local fork, protocol, wallet, or signer. Real or local-fork evidence,
when later in scope, requires its own provenance and must retain raw source
artifacts under the same contract.

### Version evolution

`0.1` freezes the semantics above. Existing fields and enumerations cannot be
reinterpreted, relaxed, or silently broadened within v0.1. A decision-critical
change, including a new decision status, weaker evidence requirement, different
address rule, or changed STOP relation, requires a new ADR and a new
`schemaVersion`.

Additive non-critical display metadata is allowed only through the isolated
extension boundary and must not affect parsing, source preservation, alignment,
or decision evaluation. Parsers must reject unknown schema versions rather than
assuming forward compatibility.

### Delivery dependencies

- #5 implements this contract, exports it only through the schema package
  boundary, and supplies schema tests for the listed invariants.
- #6 consumes the accepted contract for Decision Engine behavior; it cannot
  introduce additional decision values or bypass source references.
- #7 produces only synthetic success-fixture evidence that validates to the
  contract and demonstrates `MANUAL_REVIEW` without claiming real evidence.
- #8 produces only synthetic STOP-fixture evidence that demonstrates explicit
  STOP reasons and their source references.
- #9 documents the accepted contract, provenance labels, limitations, and the
  distinction between fixture and real evidence.

No implementation pull request for #5 is authorized by this ADR alone. The
Maintainer merges this ADR pull request first, then separately assigns #5 for
implementation.

## Alternatives considered

### Put display models inside PreflightReport

Rejected. It would make presentation-derived values appear equivalent to raw
evidence and could conceal source gaps or semantic changes.

### Make evidence fields optional for incomplete reports

Rejected. Optional critical fields allow a missing Receipt, Warning, coverage,
ordering, or state-continuity fact to disappear rather than produce `STOP`.
Explicit availability states preserve the failure and its provenance.

### Use token symbols, floating-point numbers, or sentinel addresses

Rejected. Symbols do not establish asset identity, floating-point values lose
smallest-unit precision, and sentinel addresses confuse native assets with
address-based assets.

### Let each future consumer define its own report shape

Rejected. Separate shapes would permit drift between schema, Decision Engine,
fixtures, and documentation, making cross-field security invariants unreliable.

### Add more decision outcomes for incomplete data

Rejected. The existing security boundary permits only `MANUAL_REVIEW` and
`STOP`; incomplete or unprovable evidence is already a `STOP` condition.

## Security and trust-boundary impact

This ADR does not alter the project security boundary. It makes the existing
boundary executable by requiring explicit evidence availability, immutable
source references, address-based identity, smallest-unit amounts, and the two
approved decision states.

In particular, it does not weaken any mandatory STOP condition, change the
meaning of `MANUAL_REVIEW`, permit Capability modification, make natural
language evidence, add a protocol source, or authorize signing or mainnet
submission.

If implementation reveals that one of these constraints needs to change, work
must stop and a separate Maintainer decision must be proposed. The constraint
must not be changed opportunistically in #5 through schema defaults, optional
properties, coercion, test fixtures, or UI behavior.

## Consequences

Positive consequences:

- #5 has one owner, package boundary, public entry point, scalar vocabulary,
  top-level composition, and invariant set to implement and test.
- #6 through #9 share one vocabulary for provenance, evidence references,
  critical checks, STOP reasons, and decision states.
- Missing evidence remains observable and produces a deterministic stop path.

Costs and constraints:

- #5 must add the future package boundary to the currently root-only workspace.
- Implementers must model explicit availability unions and resolvable references
  instead of using permissive optional properties.
- Fixtures need synthetic provenance and cannot shortcut validation with prose
  or real-looking claims.
- Any future change to a decision-critical contract requires review and a new
  version decision.

## Verification

This ADR is verified at review time by confirming:

- Status is Accepted and the decision owner is the Maintainer.
- The package boundary and sole public entry point are explicit.
- All required top-level report responsibilities are present.
- Raw Capability and simulation source artifacts are separate from derived
  presentation models.
- Address, native-asset, smallest-unit amount, slippage, protocol, quote,
  alignment, and decision rules are unambiguous and contain no real address or
  protocol value.
- Every listed cross-field invariant is testable by #5 without weakening a STOP
  condition.
- Fixture provenance, version evolution, and dependencies for #6 through #9
  are explicit.
- The change contains documentation only and does not assign or implement #5,
  advance #12, or close #4.

The #5 implementation acceptance suite must later test valid reports and
rejection of invalid address format, zero/sentinel native representation,
floating-point or non-canonical amount, invalid slippage, empty protocol set,
invalid selection, invalid `MANUAL_REVIEW`, absent critical evidence, and
unreferenced STOP reasons.

## Related Issues and pull requests

- [#5 M1-02: Define PreflightReport v0.1 runtime schema](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/5)
- [#6 M1-03: Decision Engine](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/6)
- [#7 M1-04: Success Fixture](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/7)
- [#8 M1-05: STOP Fixture](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/8)
- [#9 M1-06: Documentation](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/9)

This accepted decision is delivered by its own documentation pull request. That
pull request must not close #5 or authorize its implementation before it is
merged by the Maintainer.
