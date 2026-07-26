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

The repository contains the M0 baseline:

- project, architecture, security, real-versus-mock, and governance documents;
- contribution, security reporting, CODEOWNERS, Issue, and pull request
  templates;
- an MIT license; and
- GitHub repository governance objects and permissions.

This checkout also contains the M1-01 tooling and CI foundation:

- a root-only pnpm workspace;
- Node 22 and pnpm 11 project constraints;
- strict no-emit TypeScript validation;
- Biome formatting and linting;
- Vitest test-runner infrastructure; and
- the `quality-gate` GitHub Actions workflow.

It also contains the M1-02 `PreflightReport` v0.1 runtime schema package. The
package validates the fixed report contract using only synthetic test inputs;
it is not a Fixture, Decision Engine, report generator, or source of real
evidence.

This tooling and CI foundation is not a runnable application, protocol
integration, real or mocked protocol evidence, or a safety guarantee. It does
not establish any product, chain, evidence, or security capability.

The current repository has not implemented or verified:

- a runnable demo, frontend, or backend;
- any Fixture, Decision Engine, report generator, or other business TypeScript
  implementation;
- Moss discovery, loading, action, Capability construction, or simulation;
- Monad RPC or local-fork connectivity;
- Kuru or PancakeSwap quotes;
- Receipt, Outcome, Warning, gas, coverage, or ordering extraction;
- intent alignment, decision logic, report generation, or export;
- any real address, private key, API key, signing, transaction, or chain
  integration; or
- any real receipt, quote, simulation, or other real-chain evidence.

There is no runnable demo.

## Prohibited claims

- Do not label a fixture, static JSON, screenshot, or manually written example
  as real Moss evidence.
- Do not label mocked RPC output as Monad state or simulation evidence.
- Do not imply that documentation proves integration.
- Do not present `MANUAL_REVIEW` as a safety conclusion.
- Do not hide missing evidence behind generated explanatory text.
