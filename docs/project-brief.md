# Project Brief

## Product

AnteSig is a preflight evidence console for Monad operations
prepared by an AI agent. It is intended to help a person understand what an
agent selected, what Moss constructed, what simulation observed, and why the
application stopped or allowed the result to proceed to manual review.

Moss supplies underlying capabilities and evidence. AnteSig is the
application that will preserve, align, and present that evidence.

## Problem

An agent can misunderstand intent, select the wrong protocol or asset, alter an
amount, introduce an unexpected approval, or produce a confident explanation
that is not supported by execution evidence. Simulation success alone does not
show that the action matches the original request or that later execution will
succeed.

Users need an inspectable report that keeps these concepts distinct:

- what the user requested;
- what quotes and selection logic chose;
- what Moss constructed;
- what the simulation and Receipts actually evidenced;
- whether execution evidence aligns with intent; and
- which condition caused the process to stop.

## Intended users

- People reviewing AI-agent-prepared Monad operations before wallet review.
- Developers integrating Moss into agents or wallet-adjacent products.
- Protocol adapter developers inspecting Capability and Receipt behavior.
- Reviewers who need a clear evidence and trust-boundary record.

## Target outcome

The target demo will produce a Preflight Evidence Report and one of exactly two
results:

- `MANUAL_REVIEW`: defined stop conditions were not detected in the available
  evidence; a person may continue reviewing, without any safety guarantee.
- `STOP`: the evidence contains a mandatory stop condition or is insufficient
  to support continued review.

## M0 scope

M0 establishes only:

- the repository and MIT license;
- project, architecture, security, and real-versus-mock documentation;
- Issue, branch, pull request, review, and merge governance;
- GitHub Teams, permissions, labels, Milestone, Project, templates, and branch
  protection; and
- an ADR location for future Maintainer decisions.

## M0 non-goals

M0 does not implement a frontend, backend, Moss SDK integration, Monad RPC,
quote collection, protocol selection, simulation, alignment engine, decision
engine, report schema, fixture, protocol adapter, or any wallet operation.

M0 contains no protocol, token, or spender address and provides no command that
claims to run a demo.

## M0 completion evidence

M0 is complete only when the required documents and GitHub controls can be
inspected in a pull request, their limitations are explicit, and the Maintainer
has verified that contributors can work on non-protected branches without
gaining update or merge access to `main`.
