# Security Policy

## Current scope

The default branch of Moss-Mini Demo remains at M0 and is not a runnable
application. M1-01 tooling and CI are under remediation in Draft PR #10 and
are not complete until they pass the Maintainer Merge Gate. They do not add any
wallet, signing, mainnet submission, Moss integration, Monad RPC integration,
or transaction simulation implementation.

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
