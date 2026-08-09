# AnteSig Project Description

## Submission Status

Draft only. This text is based on
`main@34f64df97c510a82a700c7b18bf0c0e0009a0aa2`. The exact RC tag, video URLs,
submission-form URL, and submission confirmation must be added only after their
Maintainer and external evidence gates complete.

## Short Description

AnteSig is a preflight evidence console that helps a person check whether an
AI-prepared Monad Swap matches the original request before wallet review. It
keeps intent, the prepared operation, Moss Capability, simulation evidence,
deterministic Alignment, and a fail-closed Decision inspectable in one flow.

## Problem

A transaction simulation can succeed while the prepared operation still
violates user intent. A reviewer working from raw payloads may miss a changed
amount, asset, recipient, protocol, or approval. AnteSig makes that comparison
explicit before any signing decision and returns only `MANUAL_REVIEW` or
`STOP`.

`MANUAL_REVIEW` is not approval or a safety conclusion. `STOP` exposes the
mandatory reason and source references together with
`DO_NOT_PROCEED_TO_SIGNER`. AnteSig never signs, broadcasts, or authorizes a
transaction.

## What The Demo Shows

1. A named Happy path synthetic Fixture displays the request, prepared action,
   simulation evidence, passing critical Alignment, and `MANUAL_REVIEW` with
   its human-review limitation.
2. A named Amount mismatch synthetic Fixture keeps simulation `SUCCESS` while
   a 1-versus-10 prepared amount mismatch produces
   `CRITICAL_ALIGNMENT_FAIL` and fail-closed `STOP`.
3. With the optional Clear402 profile enabled, the completed report can be
   exported, verified, tampered in a copy, and verified again. A digest mismatch
   is detected without changing the report or Decision.

The public deployment is Fixture-capable and intentionally has no hosted Live
session. A Live request fails explicitly with `LIVE_UNAVAILABLE` and requires a
new, user-selected Fixture recovery run. The release gate separately records a
sanitized standalone Live Quote, Capability, and simulation observation on
Monad chain 143; it never signs or submits a transaction.

## Architecture And Responsibilities

- **AnteSig** owns the structured request, application orchestration,
  deterministic Alignment, Decision, report, and inspection UI.
- **Moss** is the pinned integration-fork dependency supplying the protocol
  Capability and simulation boundary. Its build metadata states
  `officialRelease=false`.
- **Monad** is the recorded `eip155:143` chain context for the bounded evidence
  path.
- **Clear402** is an optional unsigned report-integrity envelope using RFC 8785
  canonicalization and an unkeyed SHA-256 digest. It is not a signature,
  authentication, ZK proof, safety verdict, or authorization.

The source report remains separate from derived presentation. Raw Capability
and simulation evidence stay inspectable, and display text cannot create,
repair, suppress, reorder, or strengthen evidence.

## Technical Contributions

- strict runtime contracts for reports, requests, provenance, evidence
  availability, and Decision inputs;
- a pure deterministic Decision Engine with a closed STOP vocabulary and
  evidence-owned source references;
- immutable Capability and evidence snapshots across the pinned Moss adapter;
- an explicit Live/Fixture split with fail-closed recovery and no evidence
  reuse;
- desktop and mobile evidence inspection, raw JSON drawers, and visible action
  boundaries;
- an optional Clear402 profile that remains downstream of the core report and
  Decision; and
- release gates covering the pinned Moss workspace, full quality suite,
  security and dependency audit, both optional-profile modes, local fallback,
  public smoke, visual QA, and the bounded standalone Live observation.

## Verified Boundaries

- Operation: one structured exact-input Swap.
- Live protocol: PancakeSwap V2 in the standalone smoke path.
- Public Web mode: deterministic named Fixtures; hosted Live is unconfigured.
- Asset identity: canonical address, never token symbol or display metadata.
- Decision states: `MANUAL_REVIEW` or `STOP` only.
- Execution: no wallet, private key, signing, broadcast, cross-chain, or
  mainnet-submission behavior.
- Clear402 assurance: unsigned internal consistency only.

## Evidence

- Public demo: [antesig.vercel.app](https://antesig.vercel.app)
- Source: [github.com/OriginShift/AnteSig](https://github.com/OriginShift/AnteSig)
- [Gate A: Mini-Demo without Clear402](../docs/gate-a-report.md)
- [Gate B: optional Clear402 regression](../docs/gate-b-report.md)
- [Gate C: release acceptance](../docs/gate-c-report.md)
- [Evidence claim map](../docs/evidence-claims.md)
- [Known Issues](../docs/known-issues.md)

## Required Final Fields

```text
RC tag:                       BLOCKED BY #59
RC commit:                    BLOCKED BY #59
90-second backup video URL:   BLOCKED BY #62/#63
Three-minute demo video URL:  BLOCKED BY #62/#63
Submission URL:               BLOCKED BY #63/#64
Submission confirmation:      BLOCKED BY #63/#64
```

These fields must not be populated from draft, local-only, assumed, or
unconfirmed evidence.
