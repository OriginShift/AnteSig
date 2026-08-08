# ADR 0005: Clear402 Monad Action Credential v0.1

Status: Accepted
Date: 2026-08-08
Decision owner: Maintainer

## Context

Gate A established that the Mini-Demo produces and presents a complete
PreflightReport without Clear402. The optional Clear402 layer now needs one
portable integrity envelope without becoming a source of evidence, a Decision
input, or a dependency of the report-producing path.

An underspecified envelope would create several incompatible interpretations:

- a verifier could hash a report, the envelope, or an implementation-specific
  serialization;
- metadata and presentation could be mistaken for protected evidence;
- an unkeyed digest could be described as proof of identity or authenticity;
- unsupported versions could be accepted through permissive parsing; or
- enabling or disabling Clear402 could change the existing report or Decision.

This ADR freezes the v0.1 contract before the schema, digest, API, or UI is
implemented. It does not add a signature, key, signer, zero-knowledge proof,
onchain anchor, execution authorization, or new Decision state.

## Decision

### Ownership and dependency direction

The credential contract is owned by the future private workspace package
`@moss-mini-demo/clear402-profile` at `packages/clear402-profile/`. Its only
public code entry point is the package root.

The package may depend on `@moss-mini-demo/report-schema`, an audited RFC 8785
implementation, and a SHA-256 implementation. It must not import or call Moss,
the Moss Adapter, Preflight Core, the Decision Engine, RPC, protocol clients,
the web UI, wallet code, or network APIs.

`@moss-mini-demo/report-schema` and every producer of PreflightReport remain
independent of Clear402. No M4 implementation may change the PreflightReport
Schema, Alignment, Decision rules, Moss Adapter behavior, or Gate A expected
behavior.

### Exact v0.1 envelope

The public runtime schema and inferred type represent exactly this strict
object:

```ts
type Clear402MonadActionCredentialV0_1 = {
  credentialVersion: "0.1";
  credentialType: "clear402.monad-action.preflight";
  profile: "clear402.monad-action.v0.1";
  report: PreflightReport;
  integrity: {
    canonicalization: "RFC8785";
    digestAlgorithm: "sha256";
    reportDigest: `sha256:${string}`;
  };
  assurance: {
    kind: "UNSIGNED_INTEGRITY_EVIDENCE";
    statement: "Unsigned integrity evidence only. The digest checks the enclosed report after RFC 8785 canonicalization; it does not establish signer identity, authenticity, authorization, safety, freshness, or protection from deliberate digest replacement.";
  };
};
```

`reportDigest` is more narrowly constrained than the TypeScript template can
show. Its exact runtime grammar is:

```text
^sha256:[0-9a-f]{64}$
```

The envelope and both nested metadata objects reject every unknown field. The
`report` field must pass the sole public `PreflightReportSchema`; a copied or
relaxed report shape is forbidden. Generation must use the validated report
value without adding, removing, normalizing, or mutating report fields.

The credential contains no `presentation`, UI state, generated explanation,
display label, run control, or API metadata. Presentation remains a separate,
unprotected sidecar derived from the report.

### Protected object and exact bytes

The protected object is the `report` property only. The protected bytes are
exactly:

```text
UTF-8(RFC8785(credential.report))
```

The digest is:

```text
"sha256:" + lowercase-hex(SHA-256(protected-bytes))
```

There is no byte-order mark, trailing newline, domain prefix, JSON wrapper,
locale-dependent ordering, whitespace-preserving input, or platform-default
text encoding. Object key insertion order does not affect the result. RFC 8785
number, string, Unicode, escaping, and property-order rules apply without an
ad-hoc canonicalizer or a `localeCompare` implementation.

Envelope metadata is not part of the digest target. Its integrity boundary is
the strict set of v0.1 literal values above. The digest therefore states only
that the enclosed, schema-valid report is internally consistent with the
stored digest. Because the digest is unkeyed, a party that changes the report
can also calculate a replacement digest. v0.1 must never claim otherwise.

### Version and type handling

A v0.1 parser accepts only the exact `credentialVersion`, `credentialType`, and
`profile` literals above. A wrong or unsupported value is `SCHEMA_INVALID`.
The parser must not downgrade, guess compatibility, ignore the field, or try a
v0.1 digest after a version/type/profile mismatch.

A future profile or credential version requires a separate schema and explicit
dispatch before validation. It must not broaden this v0.1 schema.

### Generation contract

Credential generation has this order:

1. Parse the candidate report with `PreflightReportSchema`.
2. Use the successful parsed report as the envelope's `report` value.
3. RFC 8785-canonicalize that report and encode the result as UTF-8.
4. Calculate SHA-256 and render the exact lowercase digest form.
5. Construct and parse the complete strict credential before returning it.

Generation accepts no presentation sidecar and performs no Moss, RPC, protocol,
wallet, or network operation. It must not mutate its input.

Generation runs only after the original report and Decision have completed.
Failure to generate a credential is an explicit Clear402 extension failure; it
must not change, replace, re-evaluate, or wrap the report Decision and must not
be represented as a `STOP` reason.

### Offline verification contract

The independent verifier accepts an unknown JSON value and performs these
steps in order:

1. Strictly parse the complete v0.1 envelope, including the report schema.
2. Return `SCHEMA_INVALID` for any schema, version, type, profile, assurance,
   digest-format, report, or unknown-field failure.
3. Recompute the digest from the parsed envelope's `report` using the exact
   protected bytes above.
4. Return `DIGEST_INVALID` when the recomputed and stored digests differ.
5. Return integrity `VALID` only when both schema and digest checks pass.

Schema-invalid and digest-invalid results remain distinguishable. Expected
validation failures are data results, not uncaught exceptions. Verification
does not mutate its input and makes zero network, Moss, RPC, protocol, wallet,
clock, or randomness calls.

Integrity `VALID` means only that the schema-valid enclosed report matches its
unkeyed digest. It is not a result about signer identity, origin,
authenticity, authorization, safety, freshness, current chain state,
executability, or the correctness of the report's Decision.

### Optional application behavior

Only the exact environment value `CLEAR402_ENABLED=true` enables Clear402. An
absent value, `false`, or any other value is disabled.

When disabled:

- the existing `/api/preflight` request and response contracts remain
  unchanged and contain no credential or credential-status field;
- the preflight path does not invoke credential generation or verification;
- the existing report, presentation, Decision, errors, and recovery behavior
  remain Gate A behavior;
- Credential actions are absent from the UI; and
- `POST /api/verify` returns HTTP 404 without parsing the request body, with
  the exact no-store JSON body below.

```json
{
  "ok": false,
  "error": {
    "code": "CLEAR402_DISABLED",
    "message": "Clear402 credential verification is disabled."
  }
}
```

When enabled, the application may add a credential only as an optional
response extension after a valid report exists. The verify API remains an
offline consumer of a supplied credential. Neither path may call back into
report production or alter a Decision.

The health contract continues to expose only the boolean
`clear402.enabled`; it does not expose configuration values, payloads, or
internal errors.

## Alternatives considered

### Protect the full envelope

Rejected for v0.1. Including `reportDigest` in its own target is circular.
Defining a second envelope shape with the digest omitted would introduce a
less obvious protected-object contract while still providing no signer
authenticity. Strict fixed metadata plus a report-only digest gives the
portable report integrity check required by Gate B.

### Protect report and presentation together

Rejected. Presentation is derived display data, can evolve independently, and
must not become evidence or alter the Decision boundary.

### Use JSON.stringify or an in-house key sorter

Rejected. Runtime insertion order, locale comparison, number rendering, and
Unicode handling are not an interoperable canonicalization contract.

### Treat a valid digest as authentication or safety

Rejected. SHA-256 without a secret, signature, trusted key, or anchor proves
neither who created the payload nor whether it is safe. An attacker can modify
the report and replace the digest.

### Make Clear402 part of report generation

Rejected. It would invert the dependency boundary, make Gate A depend on an
optional consumer, and allow a credential failure to influence evidence or a
Decision.

### Silently accept unknown versions

Rejected. Canonicalization, protected objects, assurance, and verification
semantics may change by version. Guessing compatibility would make an invalid
credential appear verified under the wrong contract.

## Security and trust-boundary impact

This ADR adds a portable consistency check around an already valid report. It
does not add evidence, improve the report's evidence quality, prove a source,
or authorize an action. The existing mandatory STOP conditions and exact
meaning of `MANUAL_REVIEW` are unchanged.

The exact assurance statement and verifier result vocabulary prevent an
unkeyed digest from being presented as a signature, identity proof, safety
verdict, freshness proof, or onchain attestation. Strict schemas and explicit
version rejection prevent metadata confusion and permissive downgrade.

## Consequences

- Issue #44 implements only the strict envelope schema and public package
  boundary.
- Issue #45 implements the exact RFC 8785 bytes, SHA-256 digest, and offline
  verifier.
- Issue #46 adds optional generation and verification API behavior while
  preserving the false-mode contract.
- Issue #47 may export, verify, and tamper with a deep copy for demonstration;
  it cannot put presentation into the credential or use authenticity wording.
- Issue #48 must prove both enabled behavior and unchanged Gate A false mode.
- Adding a signature, signer, key, anchor, new protected object, or new
  assurance kind requires a new ADR and credential version.

## Verification

The implementation matrix derived from this ADR must include:

```bash
pnpm --filter @moss-mini-demo/clear402-profile build
pnpm vitest run packages/clear402-profile/test/schema.test.ts
pnpm vitest run packages/clear402-profile/test/canonicalize.test.ts
pnpm vitest run packages/clear402-profile/test/verifier.test.ts
CLEAR402_ENABLED=false pnpm test:integration
CLEAR402_ENABLED=true pnpm test:integration
pnpm test:package-import
pnpm check
```

Tests must cover strict unknown-field rejection, every exact discriminator,
invalid report rejection, lowercase digest grammar, frozen RFC/Unicode/escaping
vectors, insertion-order equivalence, report/digest tampering, unsupported
versions, input immutability, zero network calls, exact assurance wording,
disabled API behavior, and unchanged Decisions.

## Related Issues and pull requests

- [#43 Credential boundary decision](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/43)
- [#44 Credential schema package](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/44)
- [#45 RFC 8785 digest and verifier](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/45)
- [#46 Optional generation and verify API](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/46)
- [#47 Credential UI](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/47)
- [#48 Gate B](https://github.com/Moss-Mini-Demo/moss-mini-demo/issues/48)
- [ADR 0001](./0001-preflight-report-v0-1-schema-contract.md)
- [ADR 0004](./0004-decision-input-and-stop-reason-correction.md)

