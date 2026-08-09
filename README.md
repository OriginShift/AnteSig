# AnteSig

AnteSig is a preflight evidence console for people who need to
inspect an AI agent's intended Monad operation before any wallet review. The
product organizes user intent, protocol quotes, a Moss Capability
Tree, simulation evidence, intent alignment, and a bounded decision into a
report that a person can inspect.

Moss is an underlying dependency and evidence-producing capability. AnteSig is
the product name; the existing repository and package scope remain stable for
technical compatibility.

## Current status

This checkout contains the merged M0-M5 implementation through the M5-06
performance gate. The project is maintained in the public
[OriginShift/AnteSig repository](https://github.com/OriginShift/AnteSig), and
the current public demo is [antesig.vercel.app](https://antesig.vercel.app).
The engineering foundation provides a pnpm workspace with a registered
`packages/*` boundary, Node 22 and pnpm 11 project constraints, strict no-emit
TypeScript validation, Biome formatting and linting, Vitest, and the stable
`quality-gate` GitHub Actions workflow.

The public `@moss-mini-demo/report-schema` package provides the
`PreflightReport` v0.1 runtime Schema and strict `DecisionInput` boundary. The
public `@moss-mini-demo/decision-engine` package validates that input and
deterministically returns only `MANUAL_REVIEW` or fail-closed `STOP`. The
Engine is pure, synchronous, and offline. It does not create or strengthen
evidence, calculate Alignment, or authorize signing or execution.

The repository also contains three purely synthetic development Fixtures:

- a favorable `MANUAL_REVIEW` Schema Fixture;
- a tokenOut mismatch Fixture with a critical failed Alignment and `STOP`; and
- an amountIn mismatch Fixture whose synthetic simulation remains `SUCCESS`
  while its critical failed Alignment produces `STOP`.

All three declare `provenance: FIXTURE`. They validate Schema and Decision
Engine boundaries, not Moss, Monad, protocol, Quote, Receipt, simulation, RPC,
wallet, or chain evidence. `MANUAL_REVIEW` is not a safety conclusion,
approval, authorization, execution guarantee, or permission to sign. `STOP`
is a structured fail-closed result, not proof of safety, transaction
authorization, or real-chain observation.

The Next.js Web/API workbench provides Live and Fixture modes, strict and
versioned preflight contracts, server-generated run identifiers, explicit
provenance, a three-way request/prepared/simulation comparison, raw evidence
drawers, Alignment and STOP presentation, and explicit Live-to-Fixture
recovery. The hosted deployment currently has no configured Live session, so a
valid `LIVE` request returns `LIVE_UNAVAILABLE`; it never silently falls back
to Fixture data. The UI exposes the Happy path and Amount mismatch Fixtures;
the API and regression matrix additionally cover token-out mismatch, synthetic
RPC failure, warning, network failure, and timeout cases.

Clear402 is an optional layer. When enabled, it appends an unsigned
report-integrity credential after a valid report and supports offline export,
verification, and tamper detection. It does not create evidence or alter a
Decision. It is disabled on the current public demo.

The hosted Web/API path is not a live-chain backend: it has no configured RPC
network or wallet execution. The standalone [Monad live-smoke procedure](docs/live-smoke.md)
is the only path that can establish a sanitized `LIVE_SOURCE` observation from
the pinned Moss build, and it never signs, broadcasts, or authorizes a
transaction. Fixtures and CI prove deterministic application behavior only.

Do not interpret repository setup, local tooling, CI, or documentation as
evidence that the target system works, as real-chain evidence, or as a safety
guarantee.

## Safety position

The Decision Engine produces only `MANUAL_REVIEW` and `STOP`.
`MANUAL_REVIEW` means only that no defined stop condition was detected in the
available evidence and that a person may continue reviewing the operation. It
is not a safety conclusion, approval, authorization, execution guarantee, or
permission to sign. `STOP` is a structured fail-closed result and does not
prove that any other operation is safe or authorize a transaction.

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
|-- apps/
|   `-- web/
|-- docs/
|   |-- adr/
|   |-- architecture.md
|   |-- governance.md
|   |-- m1-completion-evidence.md
|   |-- project-brief.md
|   |-- real-vs-mock.md
|   `-- security-boundary.md
|-- packages/
|   |-- decision-engine/
|   `-- report-schema/
|-- CONTRIBUTING.md
|-- LICENSE
|-- README.md
`-- SECURITY.md
```

## Project documents

- [Project brief](docs/project-brief.md)
- [Hackathon scope and Gate contract](docs/hackathon-scope.md)
- [Judge evidence map](docs/judge-map.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
- [Architecture](docs/architecture.md)
- [Security boundary](docs/security-boundary.md)
- [STOP presentation requirements](docs/stop-presentation.md)
- [Real versus mock](docs/real-vs-mock.md)
- [Evidence claims and source map](docs/evidence-claims.md)
- [Known issues and operational limits](docs/known-issues.md)
- [Five-minute demo draft](docs/demo-script.md)
- [Reliability QA report](docs/reliability-report.md)
- [Performance acceptance report](docs/performance-report.md)
- [Production release runbook](docs/release-runbook.md)
- [M1 completion evidence and criteria](docs/m1-completion-evidence.md)
- [Governance](docs/governance.md)
- [Architecture decision records](docs/adr/README.md)

## Contributing

All work starts with an Issue. Contributors then create a non-protected branch
and open a pull request linked to that Issue. Contributors must not update
`main` directly. Only the Maintainer may execute a merge.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before claiming an Issue or opening a
pull request.

## License

AnteSig is licensed under the [MIT License](LICENSE).
