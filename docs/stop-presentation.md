# STOP Presentation Requirements

## Status

This document specifies presentation requirements for a future report or demo.
It does not claim that the current repository has a STOP-producing Decision
Engine, user interface, Moss or Monad integration, or real-chain evidence.

## Purpose and boundary

`STOP` is a fail-closed decision. A reviewer must be able to understand every
independent reason for the decision and inspect the exact evidence associated
with each reason. Human-readable explanations are subordinate to that evidence:
they cannot add certainty, change a reason code, or replace a SourceReference.

This document does not add, remove, rename, or weaken a STOP condition. It does
not define a report Schema, change `MANUAL_REVIEW`, alter the original
Capability, or authorize signing or transaction submission.

## Required display order

A future report or demo presenting `STOP` must preserve this reading order:

1. **STOP Decision**: show a stable `STOP` heading using text, not color alone.
2. **Plain-language explanations**: show one bounded explanation for every
   independently triggered reason. Do not collapse the display to the first
   reason.
3. **Action boundary**: state that the Capability must not proceed to a signer.
   Do not suggest a bypass or workaround.
4. **Evidence state**: identify the adverse available evidence or the `FAILED`,
   `MISSING`, or `UNPROVABLE` availability state for each reason.
5. **Exact diagnostics**: show each exact `StopReasonCodeV0_1` with only its
   associated raw-backed SourceReferences.
6. **Source context and limitations**: show source-owned context and limitations
   only when they actually exist, without treating them as evidence for a
   reason or proof of safety.

All reason objects must remain in the fixed ADR 0004 rank order. A repeated
trigger for the same code is displayed as one reason with the Engine-provided,
aggregated, deduplicated SourceReferences. The presentation must preserve those
references and must not move a reference from one code to another.

The six levels may use grouped sections or a timeline, but they must be
reachable without relying on hover, color, or generated prose.

## STOP code and evidence map

This is the complete v0.1 STOP vocabulary. `<i>` is a canonical zero-based
array index. For ranks 120 through 122, `<component>` is exactly `warnings`,
`receipts`, `outcomes`, `coverage`, `ordering`, or `stateContinuity`.

| Rank | Exact `StopReasonCodeV0_1` | Trigger to explain | Reason-specific SourceReferences |
| ---: | --- | --- | --- |
| 10 | `NO_VALID_SELECTION` | No protocol was selected. | `/selection/status` |
| 20 | `CAPABILITY_FAILED` | Capability acquisition, production, parsing, or validation failed. | `/capability/availability` |
| 21 | `CAPABILITY_MISSING` | Required Capability evidence is missing. | `/capability/availability` |
| 22 | `CAPABILITY_UNPROVABLE` | Present material cannot prove the Capability evidence. | `/capability/availability` |
| 30 | `SIMULATION_ACQUISITION_FAILED` | Simulation acquisition, production, parsing, or validation failed. | `/simulation/availability` |
| 31 | `SIMULATION_MISSING` | Required simulation evidence is missing. | `/simulation/availability` |
| 32 | `SIMULATION_UNPROVABLE` | Present material cannot prove the simulation evidence. | `/simulation/availability` |
| 40 | `SIMULATION_EXECUTION_FAILED` | Available simulation evidence records `executionStatus: FAILED`. | `/simulation/executionStatus` |
| 41 | `SIMULATION_INTERRUPTED` | Available simulation evidence records `executionStatus: INTERRUPTED`. | `/simulation/executionStatus` |
| 50 | `WARNING_PRESENT` | The available Warning collection contains entries. | Every triggering `/simulation/warnings/items/<i>` |
| 60 | `RECEIPT_FAILED` | An available Receipt record has `status: FAILED`. | Every triggering `/simulation/receipts/items/<i>` |
| 61 | `RECEIPT_SET_INCOMPLETE` | The available Receipt `items` collection is empty. | `/simulation/receipts/items` |
| 70 | `OUTCOME_FAILED` | An available Outcome record has `status: FAILED`. | Every triggering `/simulation/outcomes/items/<i>` |
| 71 | `OUTCOME_SET_INCOMPLETE` | The available Outcome `items` collection is empty. | `/simulation/outcomes/items` |
| 80 | `COVERAGE_INCOMPLETE` | Available coverage evidence has `complete: false`. | `/simulation/coverage` |
| 90 | `ORDERING_INVALID` | Available ordering evidence has `valid: false`. | `/simulation/ordering` |
| 100 | `STATE_CONTINUITY_INTERRUPTED` | Available state-continuity evidence has `continuous: false`. | `/simulation/stateContinuity` |
| 110 | `CRITICAL_ALIGNMENT_FAIL` | One or more critical alignment checks have `status: FAIL`. | The union of the triggering checks' validated underlying `intent`, `quotes`, `selection`, `capability`, or `simulation` references |
| 111 | `CRITICAL_ALIGNMENT_REVIEW` | One or more critical alignment checks have `status: REVIEW`. | The union of the triggering checks' validated underlying `intent`, `quotes`, `selection`, `capability`, or `simulation` references |
| 120 | `REQUIRED_EVIDENCE_FAILED` | A decision-critical component has `availability: FAILED`. | Each triggering `/simulation/<component>/availability` |
| 121 | `REQUIRED_EVIDENCE_MISSING` | A decision-critical component has `availability: MISSING`. | Each triggering `/simulation/<component>/availability` |
| 122 | `REQUIRED_EVIDENCE_UNPROVABLE` | A decision-critical component has `availability: UNPROVABLE`. | Each triggering `/simulation/<component>/availability` |

The paths `/simulation/warnings/raw/<i>`,
`/simulation/receipts/raw/<i>`, and
`/simulation/outcomes/raw/<i>` are obsolete ADR 0003 examples and are not v0.1
DecisionInput paths.

For `RECEIPT_SET_INCOMPLETE` and `OUTCOME_SET_INCOMPLETE`, v0.1 can detect only
an empty `items` collection. A non-empty collection must not be described as
complete, and this presentation must not claim that v0.1 detects an arbitrary
non-empty partial omission.

## Evidence-state distinction

Availability and the meaning of available evidence are separate:

- Available adverse evidence uses its semantic code, such as
  `WARNING_PRESENT`, `RECEIPT_FAILED`, `OUTCOME_FAILED`,
  `COVERAGE_INCOMPLETE`, `ORDERING_INVALID`, or
  `STATE_CONTINUITY_INTERRUPTED`.
- `FAILED`, `MISSING`, and `UNPROVABLE` describe failure to establish a
  component. They use the corresponding Capability, Simulation, or required
  evidence availability code.
- A display must not relabel available adverse evidence as an availability
  failure, or relabel unavailable evidence as an available semantic result.
- If one source triggers multiple independent codes, every applicable code and
  its own evidence remain visible.

## SourceReference boundary

Every displayed STOP reason must retain the exact SourceReferences from the
validated Decision. A reference must resolve to the source input evidence or
explicit fact permitted for that code.

The following cannot serve as evidence for a STOP reason:

- `decision` or another reason;
- `limitations`;
- an `alignment` result or `/alignment/...` path;
- a Schema-owned `sourceReferences` metadata field;
- presentation or display models, prose, or extensions; or
- a reference belonging only to a different reason code.

For critical alignment reasons, the display follows the underlying validated
references to `intent`, `quotes`, `selection`, `capability`, or `simulation`.
It must not cite the alignment result as self-proof.

A source-owned key inside a validated raw payload remains source data even if
its key text resembles a report-owned metadata name. The structural owner, not
the key text alone, determines whether it is evidence. Presentation code must
not create a new pointer, repair a rejected pointer, or use prose to bridge a
missing association.

## Plain-language explanation rules

Each explanation must:

- identify the exact reason code it explains;
- distinguish adverse available evidence from unavailable evidence;
- describe only what the referenced values establish;
- use bounded language such as "failed", "is missing", "cannot be proven", or
  "review stopped"; and
- remain visibly associated with its exact SourceReferences.

An explanation must not:

- hide a simultaneous reason or change the fixed reason order;
- claim a cause absent from the referenced source;
- call the operation safe, approved, ready to sign, guaranteed, or executable;
- turn a parser, RPC, application, or evidence failure into success; or
- offer a signing path while the Decision is `STOP`.

## Conditional source context

Source-owned values may be shown unchanged when the validated referenced
payload actually contains them. This includes a Warning code or message, an
unsigned transaction, a transaction index, a block number or hash, fork
context, a revert description, or other raw fields.

None of those fields is universally guaranteed by the v0.1 Warning or raw
artifact Schema. If a value is absent, the presentation must not invent it,
require it as though the Schema guaranteed it, or infer it from another
artifact. Report identity, generation time, network, provenance, and
limitations may provide surrounding context, but they do not satisfy a
reason's SourceReference requirement.

When a referenced Warning payload contains a source-owned code or message, the
display preserves that value unchanged. When it does not, the display shows the
available raw Warning artifact without manufacturing a code or message.

## MANUAL_REVIEW boundary

For contrast only, the exact v0.1 shape is
`{ "status": "MANUAL_REVIEW" }`; it has no `reasons` property. This document
does not define a `MANUAL_REVIEW` user interface. `MANUAL_REVIEW` is not a
safety conclusion, approval, authorization, execution guarantee, or permission
to sign.

## Demo walkthrough and verification

A future demo must begin a failure path at the STOP Decision, state the signer
boundary, and then follow each reason to its own evidence. Before using a STOP
display, verify that:

- all independently triggered codes are present once and in fixed rank order;
- each code exposes only its aggregated, deduplicated, reason-specific
  SourceReferences;
- available-negative and availability-failure states remain distinct;
- obsolete `raw/<i>` collection paths are absent;
- Warning and transaction context is conditional on actual source data;
- explanations do not strengthen, replace, or contradict evidence;
- the original Capability and raw simulation evidence remain separately
  inspectable;
- the Capability is explicitly barred from proceeding to a signer; and
- real evidence, fixture data, and unavailable evidence remain distinguished
  according to [Real Versus Mock](real-vs-mock.md).
