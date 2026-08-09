# Judge Evidence Map

## Purpose

This map connects each judging direction to observable evidence and states what
still requires human demo or submission proof. Source artifacts take precedence
over narration.

| Direction | Observable proof | Verified repository evidence | Remaining proof before final submission |
| --- | --- | --- | --- |
| Problem is real | A simulation can succeed while an amount mismatch produces `STOP` | Synthetic amount-mismatch Fixture, deterministic Alignment and Decision tests, Gate A browser evidence, and Gate C | Show the exact final-RC Fixture in the timed demo and state its synthetic provenance |
| Users can understand it | User intent, prepared operation, and simulated outcome are compared; every `STOP` reason links to evidence | Desktop/mobile three-way comparison, Capability inspector, evidence timeline, accessibility checks, comprehension QA, and final visual QA | Complete real timed rehearsals and record mock-judge comprehension |
| Monad is material | Chain 143, protocol Quote, Moss Capability, simulation, and exact block context are observable | Gate C records sanitized PancakeSwap V2 live-smoke evidence through the pinned Moss build | Keep the standalone observation distinct from the hosted Web route and link the exact RC evidence in final media |
| Demo is resilient | Live, Fixture, happy, mismatch, RPC-failure, and warning paths remain distinct and recoverable | Strict API/integration matrices, explicit browser recovery, local production fallback, deployed public smoke, and Gate C | Complete human failure-recovery drills and record the backup video |
| Team can explain it | A fixed five-minute story follows claim, evidence, limitation, and recovery | Gate contracts, architecture, evidence claims, Known Issues, and the repository demo draft | Finalize the script/Q&A against the immutable RC, rehearse it, audit media links, and capture submission confirmation |

## Evidence Reading Order

The final demo should make the central comparison visible in this order:

1. what the user requested;
2. which Quote and protocol were selected, and why;
3. what Moss constructed in the original Capability;
4. what the simulation observed at its recorded context;
5. which deterministic Alignment checks passed or failed; and
6. whether the Decision Engine returned `MANUAL_REVIEW` or `STOP`.

For `STOP`, show every reason and its source references. For
`MANUAL_REVIEW`, state only that no defined stop condition was detected in the
available evidence and that human review must continue.

## Claim Boundaries

- A Fixture proves deterministic application behavior, not live chain behavior.
- A live smoke proves only the recorded observation at its exact context.
- A successful simulation does not prove intent alignment or later execution.
- A Quote supports selection and is not Receipt or simulation evidence.
- UI prose and screenshots describe evidence; they do not create it.
- Clear402, deployment, and release-acceptance claims are bounded by Gate B and
  Gate C. The Maintainer RC tag, rehearsal, media, and submission claims remain
  pending until their own artifacts exist.

## Source Documents

- [Hackathon scope and Gates](hackathon-scope.md)
- [M2 non-UI gate report](m2-gate-report.md)
- [Monad live smoke](live-smoke.md)
- [Security boundary](security-boundary.md)
- [Real versus mock](real-vs-mock.md)
- [STOP presentation requirements](stop-presentation.md)
