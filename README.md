# Moss-Mini Demo

Moss-Mini Demo is a planned preflight evidence console for people who need to
inspect an AI agent's intended Monad operation before any wallet review. The
target product will organize user intent, protocol quotes, a Moss Capability
Tree, simulation evidence, intent alignment, and a bounded decision into a
report that a person can inspect.

Moss is an underlying dependency and evidence-producing capability. It is not
the name of this repository or the application itself.

## Current status

This checkout contains the **M0 - Repository & Architecture Baseline**, the
M1-01 engineering foundation, and the M1-02 `PreflightReport` v0.1 runtime
schema package. The engineering foundation provides a pnpm workspace, Node 22
and pnpm 11 project constraints, strict no-emit TypeScript validation, Biome
formatting and linting, Vitest test-runner infrastructure, and the
`quality-gate` GitHub Actions workflow.

The runtime schema is a validation contract, not a runnable demo, frontend,
backend, Fixture, Decision Engine, or protocol integration. The repository has
no Moss or Monad integration, wallet, signing, transaction, or chain
integration; it also contains no real address, private key, API key, receipt,
quote, simulation, or other real-chain evidence.

Do not interpret repository setup, local tooling, CI, or documentation as
evidence that the target system works, as real-chain evidence, or as a safety
guarantee.

## Safety position

The only planned decision results are `MANUAL_REVIEW` and `STOP`.
`MANUAL_REVIEW` means only that no defined stop condition was detected in the
available evidence and that a person may continue reviewing the operation. It
does not mean the transaction is safe, guaranteed to execute, or suitable for
signing.

This project does not store or handle private keys, sign transactions, or send
transactions to Monad mainnet. Natural-language explanations are not on-chain
evidence. Token addresses identify assets; token symbols are display metadata.

See [Security boundary](docs/security-boundary.md) for the mandatory stop
conditions and trust boundaries.

## Planned evidence flow

```text
Intent
  -> Quote
  -> Protocol Selection
  -> Moss
  -> Capability
  -> Simulation
  -> Alignment
  -> Decision
  -> Report
```

The application must preserve the original Capability Tree. Raw evidence and
the display model are separate artifacts; presentation code must not rewrite
or strengthen evidence semantics.

## Repository structure

```text
.
|-- .github/
|   |-- CODEOWNERS
|   |-- ISSUE_TEMPLATE/
|   `-- pull_request_template.md
|-- docs/
|   |-- adr/
|   |-- architecture.md
|   |-- governance.md
|   |-- project-brief.md
|   |-- real-vs-mock.md
|   `-- security-boundary.md
|-- packages/
|   `-- report-schema/
|-- CONTRIBUTING.md
|-- LICENSE
|-- README.md
`-- SECURITY.md
```

## Project documents

- [Project brief](docs/project-brief.md)
- [Architecture](docs/architecture.md)
- [Security boundary](docs/security-boundary.md)
- [Real versus mock](docs/real-vs-mock.md)
- [Governance](docs/governance.md)
- [Architecture decision records](docs/adr/README.md)

## Contributing

All work starts with an Issue. Contributors then create a non-protected branch
and open a pull request linked to that Issue. Contributors must not update
`main` directly. Only the Maintainer may execute a merge.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before claiming an Issue or opening a
pull request.

## License

Moss-Mini Demo is licensed under the [MIT License](LICENSE).
