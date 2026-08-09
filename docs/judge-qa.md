# AnteSig Judge Q&A

## Use

Answers are deliberately bounded to evidence available in the repository and
the current release candidate. A source link supports each technical claim.
When a question asks beyond that evidence, answer with the limitation instead
of a roadmap promise.

### 1. What problem does AnteSig solve?

It helps a person inspect whether an AI-prepared Monad operation matches the
request before wallet review. It compares intent, the prepared operation,
simulation evidence, deterministic Alignment, and a bounded Decision in one
view. It is not a wallet or executor. ([Product brief](project-brief.md))

### 2. What is the core insight?

Simulation success does not prove intent match. The amount-mismatch synthetic
Fixture keeps simulation `SUCCESS` while a critical 1-versus-10 mismatch forces
`STOP`. ([Amount mismatch Fixture](../packages/report-schema/fixtures/amount-in-mismatch.v0.1.json))

### 3. Who is the user?

A person reviewing an AI agent's proposed exact-input Swap before any signing
decision. Natural-language intent parsing, wallet connection, and execution are
outside the current scope. ([Hackathon scope](hackathon-scope.md))

### 4. What does AnteSig itself own?

It owns the structured request, evidence orchestration, deterministic
Alignment, bounded Decision, report, and inspection UI. It must preserve source
evidence rather than strengthen it. ([Architecture](architecture.md))

### 5. What does Moss do?

Moss supplies the pinned protocol capability and simulation dependency used by
the adapter boundary. The pin is an integration fork with
`officialRelease=false`, not a claim of official support or safety.
([Moss dependency](moss-dependency.md))

### 6. Why is Monad material rather than a label?

The report contract records `eip155:143`, and the release gate ran a standalone
PancakeSwap V2 Quote, Capability, and simulation observation at an exact block
through the pinned Moss build. That observation never signed or submitted a
transaction. ([Gate C](gate-c-report.md))

### 7. Is the public website running Live chain requests?

No. Its health contract reports `network.configured=false`, and a Live request
returns explicit `LIVE_UNAVAILABLE`. It never silently substitutes Fixture
evidence. ([Known Issues](known-issues.md))

### 8. Then what does the public demo prove?

It proves the deterministic product workflow, failure boundary, explicit
recovery, and responsive inspection UI using named synthetic Fixtures. It does
not prove current chain state. ([Evidence claims](evidence-claims.md))

### 9. What is the difference between LIVE_SOURCE and FIXTURE?

`FIXTURE` is synthetic deterministic data. `LIVE_SOURCE` is used only for a
sanitized observation produced from the configured chain source at its recorded
context. Neither label is a safety guarantee. ([Live smoke](live-smoke.md))

### 10. What does MANUAL_REVIEW mean?

Only that no defined stop condition was detected in the available evidence and
a person may continue inspecting. It is not safe, approved, executable, or
permission to sign. ([Security boundary](security-boundary.md))

### 11. What forces STOP?

Warnings, failed or missing critical evidence, rollback or interrupted state,
unprovable coverage or ordering, intent mismatch, Capability integrity failure,
and other accepted mandatory conditions force `STOP`. The UI exposes the exact
reason references and `DO_NOT_PROCEED_TO_SIGNER`. ([STOP requirements](stop-presentation.md))

### 12. Can a successful Quote prove the transaction will work?

No. A Quote supports deterministic protocol selection only. It is not a
Receipt, simulation result, intent-alignment result, or future-execution
guarantee. ([Evidence claims](evidence-claims.md))

### 13. Can a successful simulation prove later execution?

No. It is specific to its recorded state and block context, and it still must
be checked against user intent and every mandatory evidence condition.
([Security boundary](security-boundary.md))

### 14. How do you prevent display text from becoming evidence?

The source report and derived presentation are separate. Raw Capability and
simulation artifacts remain inspectable; display components may summarize but
cannot repair, reorder, suppress, or strengthen them. ([Architecture](architecture.md))

### 15. Do you modify the Capability before simulation?

The accepted boundary forbids it. Adapter tests and Gate C verify the original
action identity, immutable snapshots, and source/build correlation across the
flow. ([Gate C](gate-c-report.md))

### 16. How is token identity established?

By the canonical address in the report contract. Token symbol, name, icon, and
decimals are display metadata and cannot establish identity. ([ADR 0001](adr/0001-preflight-report-v0-1-schema-contract.md))

### 17. Which protocol is in the P0 path?

PancakeSwap V2 is the sole live-smoke protocol. Kuru and a second-protocol demo
were cut from this bounded release rather than represented as implemented.
([Live smoke](live-smoke.md))

### 18. What is Clear402?

An optional strict envelope around the completed report with RFC 8785
canonicalization and an unkeyed SHA-256 digest. It is generated only after the
report and cannot change evidence, Alignment, or Decision. ([Clear402 ADR](adr/0005-clear402-monad-action-credential-v0-1.md))

### 19. What does a VALID Clear402 result prove?

Only that the schema-valid enclosed report matches its stored unkeyed digest.
It does not prove signer identity, origin, authenticity, safety, freshness,
authorization, or current chain state. ([Gate B](gate-b-report.md))

### 20. What happens when the credential is tampered with?

Changing protected report data in a copy without updating the digest produces
`DIGEST_INVALID`. The displayed report and its Decision remain unchanged.
([Gate B](gate-b-report.md))

### 21. Could an attacker change both the report and digest?

Yes. The digest is unkeyed, so deliberate replacement is outside its assurance.
That is why the product says unsigned integrity evidence and makes no
authentication claim. ([Clear402 ADR](adr/0005-clear402-monad-action-credential-v0-1.md))

### 22. Does AnteSig connect a wallet or sign transactions?

No. It has no private-key collection, wallet connector, signing, broadcast,
cross-chain execution, or mainnet submission path. ([Security boundary](security-boundary.md))

### 23. How do failures recover without becoming misleading success?

A failed Live run remains visibly Live. The user must explicitly choose
`Recover with Fixture`; the recovered request has a new run ID, `FIXTURE`
provenance, and `Evidence reuse: NONE`. ([Gate A](gate-a-report.md))

### 24. What prevents a browser from supplying an arbitrary RPC URL?

The production request contract accepts only structured intent fields for Live
and an allowlisted scenario enum for Fixture. The Web route exposes no client
RPC, URL, hostname, header, or provider input. ([Security audit](security-audit-report.md))

### 25. How do you handle hostile JSON or raw evidence in the UI?

Strict contracts reject unknown and prototype-sensitive input, byte limits are
enforced, and raw JSON is rendered as text rather than injected HTML. Browser
and integration tests cover these boundaries. ([Security audit](security-audit-report.md))

### 26. Is the dependency and release gate clean?

The earlier advisory finding was remediated before Gate C. At the Gate C
candidate, the production audit exited successfully, the full quality gate
passed, and no open Bug Issue remained. This answer is bounded to that recorded
candidate, not future dependency state. ([Gate C](gate-c-report.md))

### 27. What performance has been measured?

The production Fixture response, first interaction, credential verification,
export, and large-evidence rendering passed their recorded thresholds. Hosted
successful Live latency was not measured because the public route has no Live
session. ([Performance report](performance-report.md))

### 28. How broad is the current operation support?

One structured exact-input Swap. Arbitrary calls, Lending, Staking, Vault,
cross-chain flows, natural-language parsing, wallet signing, and ZK proofs are
not implemented. ([Hackathon scope](hackathon-scope.md))

### 29. What would you build next?

A separately authorized hosted Live session and a new, explicitly versioned
attestation profile are possible future work. Neither is part of the current
release claim. ([Known Issues](known-issues.md))

### 30. What should a judge remember in one sentence?

AnteSig makes the gap between simulation success and user-intent alignment
visible before wallet review, preserves the evidence, and fails closed when a
mandatory condition is not met. ([Evidence claims](evidence-claims.md))

## Review Checklist

- [ ] Replace candidate references with the exact immutable RC after #59.
- [ ] Delete or narrow any answer not supported by that RC.
- [ ] Product, technical, and security reviewers each record their real review;
      this file does not claim those reviews have occurred.
