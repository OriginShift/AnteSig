# ADR 0002: PreflightReport v0.1 Implementation Values

Status: Accepted
Date: 2026-07-25
Decision owner: Maintainer

## Context

[ADR 0001](./0001-preflight-report-v0-1-schema-contract.md) accepts the
PreflightReport v0.1 evidence boundary, module ownership, scalar categories,
and cross-field invariants. Before authorizing implementation in
[#5](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/5), the Maintainer
must fix the exact discriminators, enum values, and minimum canonical formats
that ADR 0001 intentionally did not leave to an implementation pull request.

Without this clarification, separate contributors could make incompatible
choices for native assets, absent selection, evidence availability, simulation
results, provenance, protocol identifiers, address acceptance, report identity,
network identity, timestamps, and source references.

This ADR is an Accepted Maintainer clarification of ADR 0001. Together, ADR
0001 and this ADR are the fixed v0.1 contract. Changes to the values or formats
below require a new Maintainer decision and cannot be introduced as an
implementation convenience in #5.

## Decision

### Asset discriminator

The exact asset discriminator property is `kind`. It has exactly these values:

| `kind` | Required identity field | Meaning |
| --- | --- | --- |
| `NATIVE` | None | The network's native asset. An `address` field is forbidden. |
| `ERC20` | `address` | An ERC-20 asset identified by a valid `EvmAddress`. |

No symbol, zero address, sentinel address, empty string, omitted discriminator,
or synonym is an asset identity. Display metadata remains outside the identity
union and cannot change the selected variant.

### Evidence availability

The exact availability discriminator property is `availability`. Capability,
the simulation source artifact, and every decision-critical evidence component
use the same complete availability vocabulary:

| `availability` | Meaning |
| --- | --- |
| `AVAILABLE` | The raw artifact or fact is present and resolvable. This says nothing about whether its contents are successful or favorable. |
| `FAILED` | Acquisition, production, parsing, or validation failed before the artifact or fact could be established. |
| `MISSING` | The required artifact or fact was not supplied or observed. |
| `UNPROVABLE` | Material is present, but it is insufficient or ambiguous and cannot prove the required fact. |

Capability uses all four values. The simulation source artifact and its
decision-critical Receipt, Outcome, Warning, coverage, ordering, and
state-continuity evidence also use all four values. Gas or any additional field
becomes decision-critical whenever a decision or alignment check relies on it;
it then uses this same vocabulary.

`AVAILABLE` requires the raw value, collection, or fact record, including an
empty Warning collection when the proven result is that no Warning occurred.
Each non-available variant requires its explicit structured failure record. A
consumer must not infer availability from an omitted, null, empty, or defaulted
field.

`FAILED` availability describes failure to establish evidence. It is distinct
from available evidence that establishes a negative semantic result, such as a
failed Receipt, incomplete coverage, invalid ordering, or interrupted state
continuity. Such evidence remains `AVAILABLE`; its own semantic result records
the negative fact and still requires `STOP` under ADR 0001.

### Selection states

The exact selection discriminator property is `status`. It has exactly
`SELECTED` and `NOT_SELECTED`.

- `SELECTED` requires the selected `protocolId`, the supporting successful
  quote reference, and the deterministic selection reason required by ADR
  0001.
- `NOT_SELECTED` is the only no-selection state. It forbids selected protocol
  and selected quote fields and requires a structured reason and source
  references.

`NONE`, `UNSELECTED`, `NO_SELECTION`, an omitted selection, and a nullable
selected protocol are not v0.1 states.

### Simulation availability and execution result

Simulation evidence separates whether the source evidence is available from
what the available evidence proves. The availability discriminator remains
`availability`. When and only when it is `AVAILABLE`, the exact
`executionStatus` property is required and has exactly `SUCCESS`, `FAILED`, or
`INTERRUPTED`.

The five decision-relevant cases are distinguished as follows:

| Case | `availability` | `executionStatus` |
| --- | --- | --- |
| Successful simulation | `AVAILABLE` | `SUCCESS` |
| Completed simulation with a failed execution result | `AVAILABLE` | `FAILED` |
| Available partial evidence proves an interrupted state chain | `AVAILABLE` | `INTERRUPTED` |
| Simulation evidence is absent | `MISSING` | Forbidden |
| Present material cannot prove the simulation result | `UNPROVABLE` | Forbidden |

An acquisition, production, parsing, or validation failure is represented by
`availability: FAILED`, with `executionStatus` forbidden. It is separate from
an available simulation whose `executionStatus` is `FAILED`.

Only the `AVAILABLE` plus `SUCCESS` combination can participate in a
`MANUAL_REVIEW` report, and only when every other ADR 0001 condition also
passes. Every other combination requires `STOP`. A successful execution status
does not override a Warning, failed Receipt, evidence gap, alignment result, or
any other mandatory STOP condition.

### Provenance

The exact `provenance` values are:

- `FIXTURE`
- `LOCAL_FORK`
- `LIVE_SOURCE`

No alias, mixed provenance, inferred default, or omitted provenance is valid.
`FIXTURE` is synthetic. `LOCAL_FORK` and `LIVE_SOURCE` remain evidence-context
labels only; neither is a safety, freshness, or execution claim.

### ProtocolId

`ProtocolId` is an ASCII lowercase kebab-case machine identifier with a length
of 1 through 64 characters. Its exact grammar is:

```text
^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

It must begin with an ASCII letter. Later characters may be ASCII lowercase
letters or digits, with single hyphens separating non-empty segments. Uppercase
letters, non-ASCII characters, underscores, periods, colons, slashes, leading
or trailing hyphens, consecutive hyphens, and all whitespace are rejected.

Validation performs no trimming, case folding, Unicode normalization, slug
generation, or other coercion. An input is either already canonical or is
rejected. This ADR fixes the grammar but declares no protocol identifier value.

### EIP-55 canonical addresses

An `EvmAddress` accepts only the exact EIP-55 canonical checksum rendering of
its 20 address bytes, using a lowercase `0x` prefix. Validation computes the
EIP-55 rendering and requires byte-for-byte string equality. It performs no
trimming, prefix repair, or case normalization.

Generic all-lowercase and all-uppercase compatibility forms are not accepted.
An alphabetic all-lowercase or all-uppercase body is rejected whenever it
differs from the computed EIP-55 canonical rendering. A rare canonical EIP-55
rendering whose alphabetic characters are uniformly cased remains valid only
because it exactly equals the computed canonical rendering; uniform case never
creates a separate bypass. An uppercase `0X` prefix is always rejected.

The zero address remains rejected even if its textual rendering would otherwise
pass the format comparison. Wrong length, non-hex input, whitespace, checksum
failure, and non-canonical case remain rejected as required by ADR 0001.

### Minimum verifiable envelope and reference formats

The following are exact v0.1 minimum formats:

| Value | Required format |
| --- | --- |
| `reportId` | A canonical lowercase RFC 9562 UUID version 4 string: 36 characters in `8-4-4-4-12` form, version nibble `4`, and variant nibble `8`, `9`, `a`, or `b`. Braces, URN prefixes, uppercase, whitespace, and normalization are rejected. |
| `generatedAt` | A calendar-valid UTC RFC 3339 timestamp in exact `YYYY-MM-DDTHH:mm:ss.sssZ` form. Exactly three fractional-second digits and uppercase `T` and `Z` are required. Offsets, omitted milliseconds, leap seconds, whitespace, and normalization are rejected. |
| `network` | A CAIP-2 network identifier restricted to `eip155:<chainId>`. The namespace is exact lowercase `eip155`; `chainId` is a positive canonical base-10 integer of 1 through 32 digits with no sign or leading zero. Whitespace, case conversion, aliases, and a bare chain ID are rejected. |
| Source reference | A non-empty RFC 6901 JSON Pointer string rooted at the complete validated report. It begins with `/`, uses only canonical `~0` and `~1` escaping, has no `#` fragment prefix or percent encoding, and must resolve to exactly one existing report location. |

Source-reference arrays are non-empty and contain unique pointer strings. Each
pointer must resolve to an immutable decision-input source record, its raw
artifact, or its explicit availability or failure record. Decision-input source
records include intent, quote, selection, Capability, and simulation evidence.
A pointer to `decision`, `limitations`, an alignment result without its
underlying source, a display model, generated prose, or a presentation
extension is not evidence and is rejected as a decision source. Array indices
use their canonical unsigned decimal form without leading zeroes.

These formats are intentionally narrower than the general standards where v0.1
needs one deterministic representation. They introduce no real report,
network, address, protocol, or evidence value.

## Alternatives considered

### Use nullable fields or infer state from field presence

Rejected. Nullability and omission cannot distinguish unavailable, failed,
missing, and unprovable evidence and can conceal a mandatory STOP condition.

### Use one simulation status for availability and execution meaning

Rejected. A failed attempt to acquire evidence is different from available raw
evidence proving a failed or interrupted execution. Combining them would weaken
provenance and source-reference checks.

### Accept and normalize user-friendly identifiers and addresses

Rejected. Trimming, case folding, slug generation, and permissive address
compatibility make stored identity differ from validated identity. v0.1 uses
reject-only canonical validation.

### Use free-form network names and source labels

Rejected. Display names cannot establish network identity, and free-form source
labels cannot be resolved independently against the report.

## Security and trust-boundary impact

This ADR does not change a STOP condition, the meaning of `MANUAL_REVIEW`, raw
evidence ownership, or Capability integrity. It gives exact serialized values
to the constraints already accepted in ADR 0001.

Non-successful simulation states, non-available critical evidence, failed
semantic evidence, invalid source references, and non-canonical identities
remain fail-closed. Availability never means favorable, provenance never means
trusted, and canonical formatting never means safe.

## Consequences

- #5 can implement and test one fixed v0.1 vocabulary without making Maintainer
  decisions in its pull request.
- #6 through #9 must consume these exact values after their release-order
  prerequisites are satisfied; this ADR does not start their final review.
- Producers must preserve the distinction between evidence acquisition failure
  and available evidence proving a negative result.
- Inputs that could be normalized into a valid value are rejected instead of
  silently rewritten.
- A change to any value, grammar, or cross-field combination above requires a
  later ADR and schema-version decision.

## Verification

This ADR is implementation-ready when review confirms:

- every discriminator property and literal is exact and exhaustive;
- the five simulation cases and the separate acquisition-failure case are
  unambiguous;
- only `AVAILABLE` plus `SUCCESS` can contribute to `MANUAL_REVIEW`;
- ProtocolId and all canonical envelope formats are reject-only;
- EIP-55 equality does not admit generic all-lowercase or all-uppercase
  compatibility input;
- source references are report-local, resolvable, and cannot point to derived
  prose as evidence;
- no STOP condition, `MANUAL_REVIEW` meaning, raw-evidence ownership, or
  Capability integrity rule changed; and
- the change contains no Zod, TypeScript, test, Fixture, or Schema
  implementation.

The documentation pull request carrying this ADR must pass `quality-gate` and
merge before the Maintainer posts the separate `Implementation Authorized`
record on #5.

## Related Issues and pull requests

- [ADR 0001: PreflightReport v0.1 Schema Contract](./0001-preflight-report-v0-1-schema-contract.md)
- [#5 M1-02: Define PreflightReport v0.1 runtime schema](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/5)

This ADR authorizes no implementation by itself. Authorization, assignee,
labels, and Project status are recorded separately on #5 after this decision is
merged and its quality gate succeeds.
