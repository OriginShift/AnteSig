# Real Versus Mock

## Purpose

This document separates target-demo evidence requirements from acceptable
mocked boundaries and from what this repository has actually completed. A
fixture or mock must never be described as live Moss or Monad evidence.

## Must be real for a Live claim

A `LIVE_SOURCE` claim must use and identify real sources for:

- approved Monad RPC state or an explicitly identified local fork derived from
  Monad state;
- the PancakeSwap V2 quote response used by the bounded P0 live-smoke path;
- the Capability Tree constructed by Moss;
- Moss simulation of the unmodified Capability;
- ordered transaction results and gas observations;
- Receipts, Outcomes, Warnings, Changes, coverage, ordering, and state-chain
  continuity evidence;
- deterministic intent alignment against addresses and observed evidence; and
- the generated preflight report and its bounded decision.

A local fork may prevent real-fund movement, but the report must identify it as
a local fork and record its source context. It must not be labeled as a mainnet
submission.

## May be mocked in the target demo

The target demo may mock or omit:

- final wallet signing;
- mainnet transaction submission;
- natural-language intent parsing by an LLM;
- a historical report database;
- USD pricing;
- user accounts and notifications; and
- Lending, Staking, Vault, cross-chain, or other out-of-scope operations.

Mocked components must be visibly and structurally identified as mocked. They
must not generate artifacts presented as Moss Capability, Receipt, simulation,
or Monad RPC evidence.

## Actually completed in the current repository

The repository contains the governed Node 22/pnpm 11 workspace, accepted report
and Decision contracts, deterministic Decision Engine, pinned Moss Adapter,
preflight orchestration and Alignment, optional Clear402 profile, integrated
Next.js workbench/API, automated tests, public deployment, and Gate A/B/C
evidence.

Three report Fixtures are purely synthetic and declare `provenance: FIXTURE`:

- `manual-review-success.v0.1.json` retains `MANUAL_REVIEW`;
- `token-out-mismatch.v0.1.json` produces a critical Alignment failure and
  `STOP`; and
- `amount-in-mismatch.v0.1.json` keeps synthetic simulation `SUCCESS` while a
  1-versus-10 amount mismatch produces `STOP`.

The allowlisted reliability bundles also exercise synthetic RPC failure and
warning paths. None of these identifiers, Quotes, Capabilities, simulation
records, Receipts, Outcomes, or source references is chain evidence.

The integrated Web/API product displays intent, selection, the original
Capability, simulation evidence, deterministic Alignment, the bounded
Decision, provenance, raw evidence, and explicit Live-to-Fixture recovery. The
public deployment runs the named Fixtures. Its hosted Web route has no Live
session: a valid `LIVE` request returns `LIVE_UNAVAILABLE`, creates no report or
Decision, and never silently becomes Fixture success.

Separately, the pinned Moss Adapter live-smoke command has recorded a sanitized
PancakeSwap V2 Quote, Capability, and simulation observation on `eip155:143` at
an exact block for Gate C. It is server-only, not connected to the public Web
route, and never signs, broadcasts, or authorizes a transaction.

Clear402 can optionally export and verify an unsigned report-integrity
credential and detect tampering with the protected report when the stored
digest is not replaced. It does not authenticate a source or alter evidence,
Alignment, or Decision. It is disabled on the current public deployment.

The current repository has not implemented or verified:

- a configured hosted Live Web session or public live-chain backend;
- Kuru or a second-protocol production path;
- arbitrary operations beyond one structured exact-input Swap;
- wallet connection, private-key handling, signing, broadcast, or transaction
  submission;
- cross-chain operations, Lending, Staking, Vault, or ZK proofs; or
- signer identity or authenticity for the unsigned Clear402 credential.

The repository therefore contains an integrated Fixture demo plus a separate
bounded Live observation path. Fixture behavior, public health, CI, and
screenshots must not be presented as a current Live chain result.

## Prohibited claims

- Do not label a fixture, static JSON, screenshot, or manually written example
  as real Moss evidence.
- Do not label mocked RPC output as Monad state or simulation evidence.
- Do not imply that documentation proves integration.
- Do not present `MANUAL_REVIEW` as a safety conclusion.
- Do not hide missing evidence behind generated explanatory text.
