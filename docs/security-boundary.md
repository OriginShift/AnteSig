# Security Boundary

## Boundary statement

Moss-Mini Demo is a preflight evidence and explanation layer. It is not a
wallet, signer, transaction executor, safety oracle, or authorization system.
The application may determine that evidence requires stopping or that a result
may proceed to manual review. It cannot authorize a transaction.

## Non-goals

Private keys, seed phrases, signing, and Monad mainnet transaction submission
are outside the project boundary. Future code must not collect, persist, log,
transmit, or request signing material.

The project also does not guarantee execution success, economic outcome,
protocol correctness, or transaction safety.

## Identity rules

- A token address is the asset identity. A symbol, name, icon, or decimal label
  is display metadata and cannot establish identity.
- Protocol, token, and spender addresses require Maintainer confirmation before
  use. The source and network context must be reviewable.
- An address inferred from prose, a screenshot, token symbol, model response,
  or unverified example is not approved.
- An approval spender must match the Maintainer-confirmed protocol expectation
  and the user intent. An unexpected approval requires `STOP`.

## Mandatory STOP conditions

The decision must be `STOP` when any of the following occurs:

- any Warning is present;
- any transaction or simulation step rolls back;
- Receipt generation, parsing, or validation fails;
- complete Change coverage cannot be proven;
- Change or Receipt ordering cannot be proven;
- the simulated state chain is interrupted or a dependent step lacks the prior
  state it requires;
- observed execution is inconsistent with user intent, including account,
  asset address, direction, amount, slippage, protocol, spender, or recipient;
- an unexpected Capability, approval, call, or funds movement appears;
- the original Capability Tree was modified or its integrity cannot be shown;
- protocol, token, or spender identity has not been confirmed by the
  Maintainer; or
- any critical evidence is missing, ambiguous, stale beyond its stated
  context, or cannot be attributed to its source.

A system error or inability to complete a mandatory check is missing evidence
and therefore results in `STOP`.

## Evidence rules

Natural-language explanations, model output, UI labels, and summaries are not
on-chain evidence. They may describe evidence only when the underlying source
remains accessible and the description does not add certainty or meaning.

Raw Capability, simulation, Receipt, Outcome, Warning, gas, coverage, ordering,
and state-continuity evidence must be preserved separately from display models.
Presentation code must not repair, suppress, reorder, or reinterpret evidence
to avoid a stop condition.

Quote data is selection context, not execution evidence. A successful
simulation is block- and state-specific and is not proof that a later mainnet
transaction will succeed.

## Meaning of MANUAL_REVIEW

`MANUAL_REVIEW` means only that all mandatory checks completed against the
available evidence and no documented stop condition was detected. A person
must still inspect wallet details and current conditions. The label must never
be rendered or described as safe, approved, guaranteed, or ready to sign.

The only alternative result is `STOP`.
