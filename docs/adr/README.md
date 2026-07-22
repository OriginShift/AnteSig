# Architecture Decision Records

Architecture Decision Records capture Maintainer decisions that would otherwise
be lost in an Issue or pull request discussion.

## When an ADR is required

Create an ADR for a decision that changes or fixes:

- architecture or module ownership;
- a business, report, or evidence schema;
- Capability integrity or raw-evidence handling;
- a STOP condition or the meaning of `MANUAL_REVIEW`;
- a trust boundary or evidence-sufficiency rule;
- an approved protocol, token, spender, RPC, or network source; or
- a cross-cutting dependency or compatibility constraint.

An ADR records a decision; it does not replace the implementation Issue or pull
request.

## Naming

Use a monotonically increasing number and a short lowercase title:

```text
0001-short-decision-title.md
```

## Required sections

```text
# ADR NNNN: Title

Status: Proposed | Accepted | Superseded | Rejected
Date: YYYY-MM-DD
Decision owner: Maintainer

## Context
## Decision
## Alternatives considered
## Security and trust-boundary impact
## Consequences
## Verification
## Related Issues and pull requests
```

Only the Maintainer may mark an ADR Accepted, Superseded, or Rejected. Proposed
ADRs must be linked from the relevant Issue and pull request.
