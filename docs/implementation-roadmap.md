# Implementation Roadmap

## Status Model

This roadmap records dependency order and exit conditions. `Implemented` means
merged code or documentation exists; `Verified` additionally requires the
named gate evidence. A planned stage is not a current product capability.

## Critical Path

```text
M2 evidence core and non-UI gate
  -> M3 workbench and Gate A
  -> M4 optional Clear402 layer and Gate B
  -> M5 reliability, deployment, Gate C, and release candidate
  -> M6 rehearsal, media, submission, and final Go/No-Go
```

| Stage | Original target | Current boundary | Exit condition |
| --- | --- | --- | --- |
| M2 evidence core | 2026-07-31 | Implemented through the non-UI integration gate; this scope freeze remains | Scope docs merged and M2 parent inventory reconciled |
| M3 / Gate A | 2026-08-01 23:00 | Planned | Complete desktop/mobile workbench passes Gate A with Clear402 absent and disabled |
| M4 / Gate B | 2026-08-02 23:00 | Planned | Optional credential generation, export, independent verify, tamper rejection, and false-mode regression pass |
| M5 / Gate C | 2026-08-05 18:00 | Planned | Reliability, security, performance, deployment, clean-clone, visual, and release acceptance pass |
| Emergency cutoff | 2026-08-06 18:00 | Historical schedule control | Only release-blocking fixes; no scope expansion |
| M6 submission | 2026-08-07 to 2026-08-09 | Planned | Rehearsal, media, contribution record, submission links, and Maintainer Go/No-Go complete |

Missing an original date never weakens a Gate. Status changes only when the
corresponding Issue, CI, and evidence artifacts agree.

## M3: Workbench and Gate A

Execution order: shell and API state machine; intent/quote/selection controls;
Capability and simulation inspectors; three-way comparison and Decision UI;
responsive/accessibility hardening; Gate A acceptance.

The workbench must support the happy and amount-mismatch workflows first. It
must expose raw evidence and provenance, render loading/error/retry states, and
keep `MANUAL_REVIEW` visually neutral. Gate A is blocked until real browser QA
passes on desktop and mobile.

## M4: Clear402 and Gate B

Execution order: freeze the credential boundary; implement strict schema;
implement RFC 8785 digest and independent verifier; add optional generation and
verify API; add export/verify/tamper UI; run Gate B.

The dependency direction is one way:

```text
Moss Adapter -> Preflight Core -> PreflightReport -> optional Clear402 Profile
```

Clear402 cannot own Mini-Demo evidence generation, Alignment, Decision, or
recovery behavior. Gate A must continue to pass when Clear402 is absent or
disabled.

## M5: Reliability and Release

Build deterministic scenario bundles, make Live and Fixture recovery explicit,
complete integration/E2E/failure coverage, audit claims and boundaries, measure
performance and response size, deploy with a health runbook, run clean-clone
Gate C, complete final visual QA, then freeze and tag the release candidate.

Fixture and live evidence remain separately labeled throughout. Deployment
failure may use the documented local production fallback; it cannot be
represented as a successful public deployment.

## M6: Demo and Submission

Finalize the five-minute script and Q&A, run timed recovery rehearsals, finalize
media and links, record contributions and submission details, then perform the
Maintainer final Go/No-Go. Release and submission records must contain real URLs
or explicit blockers, never placeholders presented as completed evidence.

## Schedule-Pressure Rules

First remove second-protocol work, animation, and secondary exports. Then remove
third attacks, extended comparison explanation, and external anchoring. Finally
remove automatic retry, additional token flexibility, and complex forms.

Do not remove the evidence core, happy and amount-mismatch paths, provenance,
Fixture recovery, Gate A false mode, minimum credential digest/verify contract,
Gate B regression matrix, or Gate C.
