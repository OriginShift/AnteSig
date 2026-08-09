# Contributing to AnteSig

## Before starting

Every change must start with a GitHub Issue. The Issue must state the goal,
scope, non-goals, dependencies, acceptance criteria, and manual verification
method. Work that changes architecture, schemas, STOP conditions, or a trust
boundary requires an explicit Maintainer decision before implementation.

Do not start from an undocumented protocol, token, or spender address. Address
sources and intended use require Maintainer confirmation.

## Branch and pull request workflow

1. Claim or receive assignment to an approved Issue.
2. Create a descriptive branch from the current `main` branch.
3. Keep the change within the Issue scope.
4. Open a pull request that links and closes the Issue.
5. Record actual changes, non-goals, verification evidence, risk, and decisions
   still required from the Maintainer.
6. Resolve review conversations before the pull request can be merged.

Contributors may create and push non-protected branches, create and update pull
requests, and participate in reviews. Contributors must not push to, update,
or merge `main` directly.

## Review and decision authority

Team members may review pull requests. A non-author approval is not required by
default, and the repository does not use an approval count as a substitute for
Maintainer judgment.

Only the Maintainer decides:

- architecture and module ownership boundaries;
- business and evidence schemas;
- STOP conditions and the meaning of `MANUAL_REVIEW`;
- trust boundaries and acceptable evidence;
- confirmed protocol, token, and spender addresses; and
- whether all merge conditions are satisfied.

Only the Maintainer may execute a merge. Reviews by other members do not grant
merge authority.

## Merge policy

Pull requests use squash merge by default. Auto-merge is disabled. After a
successful merge, the feature branch is deleted. No contributor may bypass
branch protection, unresolved conversations, or required checks.

Required status checks will be enabled after CI exists and has produced a
stable check name. Until then, pull requests must report all manual checks and
any available evidence without claiming CI coverage.

## Change boundaries

Never include private keys, seed phrases, signing code, or mainnet transaction
submission. Do not describe fixtures or mocks as real Moss or Monad evidence.
Do not modify the original Capability Tree or treat a natural-language
explanation as on-chain evidence.

M0 changes are limited to repository, documentation, architecture, security,
governance, and GitHub workflow foundations. Business implementation belongs
to later Issues and pull requests.
