# Governance

## Roles

### Maintainer

The Maintainer is the merge gate and owns scope, architecture, security
boundaries, and final repository decisions. The Maintainer decides architecture,
schemas, STOP conditions, trust boundaries, confirmed protocol and address
sources, evidence sufficiency, and whether a pull request meets merge
conditions.

Only the Maintainer may execute a merge into `main`.

### Contributors

Contributors may view and claim Issues, create and push non-protected branches,
open and update pull requests, and participate in reviews. Contributors may not
update or merge `main`, change repository rules or branch protection, manage
Organization membership or Teams, manage repository secrets, or enter a bypass
list.

## Issue-first workflow

All work starts with an approved Issue. The Issue defines scope, non-goals,
dependencies, acceptance criteria, manual checks, and completion evidence. A
branch and pull request must link back to that Issue.

Untracked implementation is not eligible for merge.

## Branch and pull request controls

- `main` is protected and cannot be updated directly by contributors.
- Changes enter `main` through a pull request.
- Required approving reviews are set to zero; approval count is not the merge
  authority model.
- Review conversations must be resolved.
- Linear history is required.
- Force pushes and branch deletion are disabled for `main`.
- Required status checks will be enabled after CI exists and has a stable check
  name.
- Auto-merge is disabled.

Members may participate in review, but no non-author approval is required by
default. Review participation does not grant merge authority.

## Review conclusions

Every formal pull request assessment uses exactly one conclusion:

- `READY_TO_MERGE`
- `CHANGES_REQUESTED`
- `BLOCKED`
- `MAINTAINER_DECISION_REQUIRED`

An assessment records pull request identity, actual changes, blocking findings
with file locations, non-blocking suggestions, architecture and security
impact, CI and test evidence, unresolved conversations, remaining merge
conditions, and Maintainer decisions required.

A read-only review does not submit a GitHub Review. A GitHub Review is submitted
only when the Maintainer explicitly requests that action.

## Merge policy

Squash merge is the default and only enabled merge method. The Maintainer must
re-check the current pull request head, required conversations, checks,
architecture and security conditions, Issue linkage, and unresolved decisions
immediately before merging. The feature branch is deleted after merge.

No pull request is merged automatically. A merge occurs only after an explicit
Maintainer instruction to execute that specific merge.

## Decision authority

The following require Maintainer approval:

- changes to system scope or module ownership;
- business, report, or evidence schemas;
- additions, removals, or weakening of STOP conditions;
- changes to Capability integrity or raw-evidence preservation;
- changes to the meaning of `MANUAL_REVIEW`;
- protocol, token, spender, RPC, and network sources; and
- changes to repository permissions, protection, secrets, or bypass access.

## Tracking and release state

Issues and pull requests carry Milestone, label, dependency, blocker, and risk
context. Known Issues must distinguish a product limitation from missing or
unverified evidence. Project status must reflect actual work state and must not
be advanced to Done before the linked acceptance criteria are satisfied.

M0 is a repository and architecture baseline, not a software release or
runnable demo.
