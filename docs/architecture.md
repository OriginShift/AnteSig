# Architecture

## Status and purpose

This document defines the M0 architecture boundary for the target Moss-Mini
Demo. It is not an implementation design, business schema, or claim that any
module currently exists.

## Planned data flow

```text
Intent
  -> Quote
  -> Protocol Selection
  -> Moss
  -> Capability
  -> Simulation
  -> Alignment
  -> Decision
  -> Report
```

Each transition must preserve provenance. A later module may derive a view or
decision from an earlier artifact, but it must not silently rewrite the source
artifact.

## Module responsibilities and boundaries

### Intent

Records the operation the user asked to review, including the account, asset
addresses, amount constraints, allowed protocols, slippage limit, and intended
recipient where applicable. A changed request produces a new intent rather
than mutating the evidence record for an existing request.

Intent is a user requirement. It is not execution evidence.

### Quote

Collects protocol quote responses and failures using comparable asset and
amount units. A quote supports protocol selection only. It does not prove a
future execution result and must not be presented as simulation evidence.

### Protocol Selection

Applies a deterministic, disclosed selection rule only to eligible quotes and
records the selected protocol and reason. Selection does not mean best, safe,
or guaranteed. Protocol eligibility and any address used by selection require
Maintainer confirmation.

### Moss

Coordinates the approved Moss discovery, loading, action, and simulation
capabilities needed by the application. Moss remains an underlying dependency
and evidence source. Application policy, protocol comparison, and final user
decision semantics remain outside Moss.

### Capability

Holds the original Capability Tree returned by Moss, including nested actions,
transaction order, parameters, risk labels, and approval relationships. The
application must preserve this original tree byte-for-byte or as an equivalent
immutable source artifact. It must not reorder transactions, alter parameters,
rewrite calldata, remove nodes, or insert application-created nodes.

Any normalized or visual tree is a separate derived display model and must
retain references to its original source evidence.

### Simulation

Runs the original Capability against the approved Monad simulation state and
collects ordered transaction results, gas, changes, Receipts, Outcomes,
Warnings, rollback information, coverage, ordering evidence, and state-chain
continuity. Simulation success does not prove intent alignment, later mainnet
success, or transaction safety.

### Alignment

Compares intent, selection, original Capability, and simulation evidence using
deterministic checks. It verifies identities and constraints by address and
observed evidence, not by token symbols or generated prose. Alignment records
expected and observed values and the evidence source for every material check.

Alignment must not fill evidence gaps with assumptions.

### Decision

Evaluates the documented stop policy. Its output is limited to
`MANUAL_REVIEW` or `STOP`. It cannot output safe, approved, executable, or an
equivalent authorization.

Any mandatory stop condition takes precedence. Missing critical evidence is a
stop condition, not a neutral or successful result.

### Report

Presents intent, quote and selection context, the original Capability, raw
simulation evidence, derived display views, alignment results, the bounded
decision, timestamps, network and block context, and limitations. The report
must expose provenance and must not strengthen a source claim.

## Evidence separation

Raw artifacts and presentation artifacts have separate ownership:

```text
Source systems              Application-derived artifacts
--------------              -----------------------------
Intent record          ---> Intent display
Quote responses        ---> Quote comparison display
Original Capability    ---> Capability display tree
Simulation evidence    ---> Evidence timeline
Receipts and Outcomes  ---> Human-readable evidence view
                        ---> Alignment checks
                        ---> Decision and report
```

Derived artifacts may summarize or index raw artifacts. They may not replace
raw evidence, change ordering or meaning, or convert uncertainty into proof.
The exported original Capability and raw evidence remain independently
inspectable.

## Trust boundaries

- User input states intent but does not prove on-chain behavior.
- Quote providers support selection but do not prove simulation or execution.
- Moss and approved protocol packages are trusted code dependencies whose raw
  outputs must remain attributable.
- Monad RPC and simulation state provide time- and block-specific evidence,
  not a guarantee about later state.
- Natural-language generation is display assistance only and never evidence.
- The Maintainer owns architecture, schema, STOP policy, evidence sufficiency,
  and confirmed protocol, token, and spender addresses.

## Result invariant

The target application exposes exactly two decision states:

```text
MANUAL_REVIEW | STOP
```

`MANUAL_REVIEW` is permission to continue human inspection only. Every warning,
rollback, Receipt failure, unprovable coverage or ordering, state-chain
interruption, intent mismatch, or missing critical evidence results in `STOP`.
