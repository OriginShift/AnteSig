# Real Versus Mock

## Purpose

This document separates target-demo evidence requirements from acceptable
mocked boundaries and from what this repository has actually completed. A
fixture or mock must never be described as live Moss or Monad evidence.

## Must be real in the target demo

The target demo must use and identify real sources for:

- approved Monad RPC state or an explicitly identified local fork derived from
  Monad state;
- Kuru and PancakeSwap quote responses used for protocol comparison;
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

At M0, the repository contains only:

- project, architecture, security, real-versus-mock, and governance documents;
- contribution, security reporting, CODEOWNERS, Issue, and pull request
  templates;
- an MIT license; and
- GitHub repository governance objects and permissions.

The current repository has not implemented or verified:

- a frontend or backend;
- Moss discovery, loading, action, Capability construction, or simulation;
- Monad RPC or local-fork connectivity;
- Kuru or PancakeSwap quotes;
- Receipt, Outcome, Warning, gas, coverage, or ordering extraction;
- intent alignment, decision logic, report generation, or export;
- any business schema; or
- any success or failure fixture.

There is no runnable demo at M0.

## Prohibited claims

- Do not label a fixture, static JSON, screenshot, or manually written example
  as real Moss evidence.
- Do not label mocked RPC output as Monad state or simulation evidence.
- Do not imply that documentation proves integration.
- Do not present `MANUAL_REVIEW` as a safety conclusion.
- Do not hide missing evidence behind generated explanatory text.
