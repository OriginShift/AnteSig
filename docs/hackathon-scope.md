# Hackathon Scope and Gate Contract

## Status

This document freezes delivery scope and acceptance conditions. It distinguishes
verified repository behavior from planned work; a listed Gate is not passed
until its own acceptance Issue records a passing result.

## Product Scope

The sole P0 user operation is a structured exact-input swap on Monad. The user
supplies the account, input and output asset addresses, exact input amount,
slippage limit, allowed protocol, and optional recipient. Natural-language
intent parsing is not required.

The product tests one central claim: a successful simulation does not establish
that the prepared operation matches the user's intent.

The two primary scenarios are:

- a favorable exact-input swap whose complete evidence reaches
  `MANUAL_REVIEW`; and
- an amount mismatch where the prepared and simulated amount differs from the
  intent and the Decision Engine returns `STOP`, even if simulation succeeds.

PancakeSwap V2 is the sole P0 live protocol path. A second protocol, including
Kuru, is P1 and begins only after the P0 path and Gate A are complete. Token
mismatch, RPC failure, and warning cases are supporting failure coverage; they
do not expand the P0 operation.

## Decision Boundary

The only decision states are:

```text
MANUAL_REVIEW | STOP
```

`MANUAL_REVIEW` has the exact v0.1 shape
`{ "status": "MANUAL_REVIEW" }`. It means that the defined checks completed
against the available evidence without triggering a documented stop condition.
A person must continue reviewing. It is not authorization, a guarantee, or
permission to sign or submit.

`STOP` is fail closed. Every independent reason and its exact source references
remain inspectable. Neither state authorizes a transaction.

## Evidence Provenance

- `LIVE_SOURCE` identifies evidence observed from the configured live source at
  its recorded network and block context.
- `LOCAL_FORK` identifies evidence produced against an explicitly identified
  fork context. It is not a mainnet submission.
- `FIXTURE` identifies synthetic development evidence. It cannot substantiate a
  claim about Moss, a protocol, Monad RPC, or chain behavior.
- A failed or unavailable live path remains an explicit failure. It never falls
  back silently to Fixture evidence.

Quote data is selection context, not execution evidence. Raw Capability and
simulation artifacts remain separate from derived Alignment, Decision, and
presentation models.

## Gate Contracts

The dates below are the original schedule baselines. A missed date does not
change the acceptance criteria or turn planned work into completed work.

### Gate A: Mini-Demo independent of Clear402

Original target: 2026-08-01 23:00 Asia/Hong_Kong.

Gate A requires all of the following:

- `CLEAR402_ENABLED=false` and an absent variable both preserve the complete
  Intent-to-PreflightReport workflow;
- the happy and amount-mismatch scenarios work through the actual UI and API;
- at least one PancakeSwap V2 live Quote, Capability, and simulation smoke has
  current, accurately classified evidence;
- live failure is explicit and never represented as Fixture success;
- original Capability, transactions, Changes, Receipts, Outcomes, and Warnings
  are inspectable;
- Decision output comes from the Decision Engine rather than UI constants;
- the comparison shows user intent, prepared operation, and simulated outcome;
- desktop and mobile workflow, accessibility, loading, error, retry, and visual
  stability checks pass; and
- all core tests pass with Clear402 absent or disabled.

### Gate B: Optional Clear402 credential layer

Original target: 2026-08-02 23:00 Asia/Hong_Kong.

Gate B requires a strict `clear402.monad-action.preflight` envelope that consumes
only a valid PreflightReport, RFC 8785 canonicalization, SHA-256 digesting, JSON
export, independent verification, and tamper rejection. The credential must be
identified as unsigned integrity evidence. Disabling Clear402 must leave Gate A
behavior unchanged.

### Gate C: Release candidate

Original target: 2026-08-05 18:00 Asia/Hong_Kong.

Gate C requires clean-clone installation, all offline and production gates,
desktop and mobile E2E, current live-smoke evidence, Fixture recovery, happy,
amount-mismatch, RPC-failure, and warning scenarios, secret and dependency
audits, repeatable deployment or local production fallback, a playable 90-second
backup video, and one complete five-minute rehearsal.

## Verified and Planned

Verified through the M2 non-UI gate:

- strict PreflightReport and Decision contracts;
- deterministic quote selection, Capability integrity, simulation mapping,
  Alignment, report assembly, presentation sidecar, and API orchestration;
- explicit Live, Local Fork, and Fixture boundaries;
- PancakeSwap V2 Monad live smoke with a sanitized evidence artifact; and
- a 16-case non-UI integration matrix with Clear402 absent and disabled.

Still planned and not established by those artifacts:

- the complete desktop and mobile workbench and Gate A;
- any Clear402 credential package, export, verifier, tamper UI, or Gate B;
- release E2E, production deployment, media, release tag, Gate C, and final
  submission; and
- Kuru or any second live protocol.

## Scope Cut

Cut in this order when schedule pressure requires it:

1. second protocol, Capability animation, and Markdown or print export;
2. third attack scenario, extended protocol explanation, and external anchoring;
3. automatic live retry, additional token choices, and complex forms.

Do not cut the happy and amount-mismatch paths, Moss Capability and simulation
evidence, PreflightReport, Decision Engine, explicit provenance, Fixture
recovery, Gate A without Clear402, the minimum credential envelope/digest/verify
contract, Gate B regression matrix, or Gate C.

## Outside Scope

- wallet connection, private-key or seed handling;
- signing, transaction broadcast, or mainnet submission;
- ZK proofs, x402/CAW payment rails, verifier networks, or provider registries;
- multichain support or general-purpose agent execution;
- lending, staking, vault, bridge, or arbitrary transaction flows; and
- claims of guaranteed execution, economic outcome, protocol correctness, or
  transaction safety.
