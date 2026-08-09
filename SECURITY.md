# Security Policy

## Current scope

AnteSig contains an integrated, production-buildable and production-startable
Next.js evidence workbench and API. The public Web route runs allowlisted
synthetic Fixtures; valid `LIVE` requests return `LIVE_UNAVAILABLE` and never
fall back to Fixture data. The production request contract does not accept an
RPC URL or provider configuration from the browser.

The pinned Moss Adapter also exposes a separately invoked, server-only Monad
live-smoke path for a bounded PancakeSwap V2 Quote, Capability, and simulation
observation. That sanitized path is not wired into the hosted Web route and
never signs, broadcasts, or authorizes a transaction. A successful recorded
observation is time- and block-specific chain evidence, not a safety guarantee
or proof of future execution.

The integrated Fixture product, live-smoke procedure, health endpoint, builds,
and green CI provide only their explicitly recorded evidence. They do not
create wallet authority, prove a transaction safe, or establish current chain
state outside an exact live observation.

The documented security boundary is normative for future work. See
[docs/security-boundary.md](docs/security-boundary.md).

## Absolute exclusions

This project must not:

- collect, store, log, or transmit private keys or seed phrases;
- sign transactions;
- submit transactions to Monad mainnet;
- claim that simulation or `MANUAL_REVIEW` proves transaction safety;
- use token symbols as asset identity;
- use natural-language explanations as on-chain evidence; or
- use unconfirmed protocol, token, or spender addresses.

## Reporting a security concern

Do not place secrets, private keys, sensitive account data, or exploitable
details in a public Issue. For a non-sensitive boundary concern, open a bug
Issue and apply `area:security` and `risk:trust-boundary` when available. For a
sensitive concern, first contact the Maintainer through a mutually agreed
private channel and share only the minimum information needed to establish a
safe reporting path.

Security reports do not authorize testing against third-party systems,
protocols, accounts, or mainnet infrastructure.

## Maintainer gate

Changes affecting architecture, evidence semantics, STOP conditions,
Capability handling, protocol selection, token identity, spender validation,
or trust boundaries require a Maintainer decision. A pull request must not be
merged while a security conversation or required decision remains unresolved.
