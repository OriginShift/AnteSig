# Synthetic Development Fixtures

These files are development fixtures for validating the PreflightReport v0.1
Schema and Decision Engine boundary. Their provenance is `FIXTURE`; every
identifier and raw payload is synthetic.

- `manual-review-success.v0.1.json` is the favorable Schema fixture. It retains
  a `MANUAL_REVIEW` Decision and is not a STOP scenario.
- `token-out-mismatch.v0.1.json` records a synthetic intended-versus-observed
  tokenOut mismatch. Favorable simulation evidence does not override its
  critical failed Alignment or exact `CRITICAL_ALIGNMENT_FAIL` STOP Decision.
- `amount-in-mismatch.v0.1.json` records a synthetic 1-versus-10 amountIn
  mismatch across Intent, Capability, and simulated Outcome evidence. A
  successful simulation does not override its critical failed Alignment or
  exact `CRITICAL_ALIGNMENT_FAIL` STOP Decision.

None of these files is evidence from Moss, Monad, a protocol, wallet, RPC,
Quote, Receipt, simulation, or chain. `MANUAL_REVIEW` is not a safety
conclusion, approval, authorization, execution guarantee, or permission to
sign. `STOP` is a structured fail-closed result, not a safety proof or
transaction authorization.

Do not use these fixtures as product presentation evidence or as permission to
sign or submit a transaction. A Fixture or green CI run is not a safety
guarantee or transaction authorization.
