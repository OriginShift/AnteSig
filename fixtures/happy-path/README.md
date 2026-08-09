# happy-path

Offline synthetic reliability bundle. Source boundary: `FIXTURE`.

Expected Decision: `MANUAL_REVIEW`. All addresses, amounts, evidence, timestamps,
and identifiers are deterministic test data.

- `request.json`: fixture-only request and intent
- `raw-moss-result.json`: synthetic adapter input or acquisition failure
- `expected-report.json`: strict PreflightReport v0.1
- `expected-decision.json`: Decision Engine output
- `expected-credential-invariants.json`: unsigned Credential invariants

Run `pnpm test:fixtures` to validate and recompute this bundle.
