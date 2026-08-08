# Judge Evidence Map

## Purpose

This map connects each judging direction to observable evidence and states what
still must be completed. Source artifacts take precedence over narration.

| Direction | Observable proof | Verified repository evidence | Remaining proof before final claim |
| --- | --- | --- | --- |
| Problem is real | A simulation can succeed while an amount mismatch produces `STOP` | Synthetic amount-mismatch fixture, deterministic Alignment and Decision tests, and the M2 non-UI gate | Show the mismatch in the final workbench without presenting Fixture data as live evidence |
| Users can understand it | User intent, prepared operation, and simulated outcome are compared; every `STOP` reason links to evidence | Presentation sidecar contract and STOP presentation requirements | Complete desktop/mobile three-way comparison, Capability inspector, evidence timeline, accessibility, and comprehension QA |
| Monad is material | Chain 143, protocol Quote, Moss Capability, simulation, and exact block context are observable | Sanitized PancakeSwap V2 live-smoke evidence through the pinned Moss build | Reproduce current live evidence for release and expose its source context in the UI |
| Demo is resilient | Live, Fixture, happy, mismatch, RPC-failure, and warning paths remain distinct and recoverable | Strict API contracts and 16-case non-UI matrix with Clear402 absent and disabled | Complete UI E2E, recovery controls, deployment/local-production fallback, and backup video |
| Team can explain it | A fixed five-minute story follows claim, evidence, limitation, and recovery | Frozen scope, Gate contracts, architecture, and evidence-boundary documents | Finalize the timed script, Q&A, repeated rehearsals, media, links, and submission record |

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
- Clear402, release, deployment, and submission claims remain planned until
  their own Gates pass and their artifacts exist.

## Source Documents

- [Hackathon scope and Gates](hackathon-scope.md)
- [M2 non-UI gate report](m2-gate-report.md)
- [Monad live smoke](live-smoke.md)
- [Security boundary](security-boundary.md)
- [Real versus mock](real-vs-mock.md)
- [STOP presentation requirements](stop-presentation.md)
