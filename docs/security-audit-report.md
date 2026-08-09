# M5 Security Audit Report (Historical Pre-Remediation Run)

## Current Release Resolution

The `NO-GO` below is the preserved result for the exact historical subject
`6d3eb1e0d82394fd0c2c3a7c08147e5d5cce6cea`. It is not the current release
verdict.

Dynamic Bug [#102](https://github.com/OriginShift/AnteSig/issues/102) and
[PR #104](https://github.com/OriginShift/AnteSig/pull/104) remediated the six
production advisories without suppression. Gate C then re-ran frozen install,
the production audit, both optional-profile modes, the full quality gate, and
production smokes at candidate
`b28116979084719f6f4fa0fd829f3671b4ab28f2`; its current release conclusion is
[PASS](gate-c-report.md). The production audit also exits successfully with no
known vulnerabilities on `main@4ec4e2d8c5e8fbbc08572f544461cbd5e1c24d7d`.

This resolution notice does not rewrite the original finding or its exact-SHA
evidence. Any later dependency change requires a fresh audit.

## Historical Verdict

**NO-GO**

Audited subject SHA: `6d3eb1e0d82394fd0c2c3a7c08147e5d5cce6cea`

Execution date: 2026-08-09 (Asia/Hong_Kong)

The application and evidence boundaries passed the scoped source, test, and
runtime checks. Release remains blocked because the production dependency graph
contains two moderate and four high advisories. Dynamic Bug
[#102](https://github.com/OriginShift/AnteSig/issues/102) owns remediation and
must pass a fresh production audit before Gate C.

This is a single-operator audit. No independent-review claim is made.

## Findings

| ID | Priority | Status | Owner | Finding | Reproduction | Required mitigation |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | P0 | OPEN at audited SHA; later resolved by #102 | Maintainer / dependencies, tracked by [#102](https://github.com/OriginShift/AnteSig/issues/102) | The installed production graph contains 6 advisories: 2 moderate and 4 high. | `ASDF_NODEJS_VERSION=22.23.1 pnpm audit --prod --audit-level=moderate` exits 1. | Resolve to maintained compatible versions without suppressing advisories; require the same command to exit 0 and the full false/true-mode matrix to pass. |

No additional P0, P1, or P2 defect was confirmed in the audited scope. The
matrix below records each checked boundary and its evidence; a PASS is bounded
to the exact subject SHA and does not override SEC-001.

## Advisory Inventory

| Severity | Package and installed path | Advisory | Patched floor reported by audit |
| --- | --- | --- | --- |
| High | `sharp@0.34.5`; direct Web dependency and through Next.js | `GHSA-f88m-g3jw-g9cj` | `sharp >=0.35.0` |
| High | `postcss@8.4.31`; `apps__web > next > postcss` | `GHSA-6g55-p6wh-862q` | `postcss >=8.5.12` |
| High | `postcss@8.4.31`; `apps__web > next > postcss` | `GHSA-r28c-9q8g-f849` | `postcss >=8.5.18` |
| High | `nanoid@3.3.16`; `apps__web > next > postcss > nanoid` | `GHSA-2v37-7h3g-55p8` | `nanoid >=3.3.17` |
| Moderate | `postcss@8.4.31`; `apps__web > next > postcss` | `GHSA-qx2v-qp2m-jg93` | `postcss >=8.5.10` |
| Moderate | `postcss@8.4.31`; `apps__web > next > postcss` | `GHSA-fxqj-rqcc-2cmp` | `postcss >=8.5.23` |

The effective minimums for #102 are therefore `sharp >=0.35.0`,
`postcss >=8.5.23`, and `nanoid >=3.3.17`. Severity alone does not prove
reachability, but these packages are in the production graph and the Issue's
release policy requires remediation rather than acceptance or suppression.

GitHub Secret Scanning and Dependabot APIs both returned zero open alerts at
audit time. That does not contradict or replace the package-manager result;
the exact local production audit is the release control.

## Audit Matrix

| Boundary | Result | Evidence and classification |
| --- | --- | --- |
| Tracked secret filenames | PASS | `git ls-files` found zero tracked `.env`, key, PEM, or `id_rsa` paths. |
| Secret-value scan | PASS | The required pattern scan found 21 hits in 6 files. Every hit is a literal synthetic canary in Moss Adapter redaction tests or a forbidden browser-bundle marker. No hit contains a real credential. The 37 tracked Fixture/screenshot artifacts produced zero secret-pattern hits. |
| GitHub secret alerts | PASS | `repos/OriginShift/AnteSig/secret-scanning/alerts?state=open` returned an empty list. |
| RPC material | PASS | `MOSS_RPC_URL` is read only by the explicitly invoked server-side live-smoke script. The sanitizer rejects credentials in URLs, emits host/scheme only, rejects raw URL leakage, and forbids Fixture provenance in a live artifact. The Web route exposes no RPC parameter. |
| Browser/server separation | PASS | Moss Adapter and source build data remain server-only. The production browser-bundle smoke rejects Moss package names, vendor paths, fork markers, RPC markers, and private-key markers across all emitted static JavaScript. |
| Request media and byte limits | PASS | Preflight requires strict JSON, enforces declared and streamed UTF-8 input at 65,536 bytes, and caps serialized output at 2,097,152 bytes. Verify uses the same bounded reader with a 2,097,152-byte request cap. Errors are fixed and do not echo input or backend detail. |
| JSON and prototype-sensitive input | PASS | Strict Zod contracts reject unknown shape and `__proto__`, `constructor`, and `prototype` keys recursively before service execution. Tests cover invalid JSON, malformed content length, invalid UTF-8, prototype keys, and hostile descriptors. |
| Scenario allowlist and path traversal | PASS | Fixture scenario is a three-value enum and the server maps values to imported in-memory JSON. Tests reject `../../private.json`, extra scenario fields, and LIVE requests carrying a scenario. No request value becomes a filesystem path. |
| SSRF and arbitrary RPC | PASS | The production Web route resolves no Live session and accepts only structured intent fields. The client cannot submit a URL, hostname, header, provider, or RPC endpoint. Fixture requests contain only contract version and enum scenario. |
| Raw evidence XSS | PASS | Untrusted raw JSON is serialized with `JSON.stringify` and assigned to a read-only React `textarea` value. Other raw-derived strings are React text nodes. No `dangerouslySetInnerHTML`, HTML assignment, `eval`, or dynamic script path exists in application source. Browser E2E opens and reads the JSON dialog without page errors. |
| Downloads | PASS | Raw evidence is downloaded as an `application/json` Blob with filenames assembled from fixed strings and the provenance enum. Clear402 filenames use a schema-validated UUID report ID. E2E checks exact suggested filenames and parses downloaded JSON. No user input controls a path or executable media type. |
| Sensitive response/logging | PASS | Preflight rejects credential-shaped keys anywhere in a parsed report, returns fixed errors, and logs only run ID plus stable code. Tests prove private-key canaries, service messages, timeout details, raw exception messages, causes, and stacks do not reach responses or log events. |
| Wallet/sign/send absence | PASS | Source and dependency scans found no wallet connector, signing call, private-key input, `sendTransaction`, or raw-transaction broadcast path. The only signer string is the fixed `DO_NOT_PROCEED_TO_SIGNER` STOP boundary. |
| Capability integrity and mutation | PASS | Adapter boundaries snapshot and deep-freeze retained source evidence, verify exact Capability integrity, reject source/build drift, and preserve the exact action object passed to simulation. Tests prove caller inputs remain unmodified and retained snapshots remain immutable. |
| STOP and provenance | PASS | Schemas require non-Fixture provenance for Live success and exact Fixture provenance for Fixture success. Decision and presentation tests preserve all STOP reasons, source references, fixed order, and `DO_NOT_PROCEED_TO_SIGNER`. Browser tests prove Live failure cannot silently become Fixture success and recovery uses a distinct run ID with no evidence reuse. |
| Integration-fork attribution | PASS | The gitlink, server health record, and Moss Adapter record pin `1ae6b6322d51fae9104f047efb94e601050b967f`, expose `INTEGRATION_FORK`, and set `officialRelease=false`. CI validates the exact third-party workspace before building AnteSig. |
| Public deployment observation | PASS with product limitation | HTTPS serves HSTS. `/api/health` is `no-store` and reports `network.configured=false`, `clear402.enabled=false`, the pinned Moss commit, and `officialRelease=false`. This is health/configuration evidence, not a live-chain or safety claim. |

## Required Command Results

```text
tracked secret filenames:                         PASS, 0 hits
required secret-value scan:                       PASS, 21 classified test hits
GitHub Secret Scanning open alerts:               PASS, 0
GitHub Dependabot open alerts:                    OBSERVED, 0
pnpm audit --prod --audit-level=moderate:          FAIL, 2 moderate / 4 high
pnpm check:                                        PASS, 49 files / 1,258 tests
Clear402 false browser E2E:                        PASS, 8 passed / 2 skipped
Clear402 true browser E2E:                         PASS, 9 passed / 1 skipped
Clear402 profile and preflight core coverage:      PASS, 100%
browser-bundle and production-start smokes:        PASS
main quality-gate run 31288125536 at subject SHA: PASS
```

The zero Dependabot result must not be reported as a clean dependency state.
The package-manager audit is reproducible and controls the verdict.

## Historical Gate Decision

At this historical subject, Gate C and release-candidate tagging were
**NO-GO** until #102 merged and all of the following were recorded against the
remediation head and merged main:

1. production audit exits 0 at the moderate threshold;
2. frozen installation and full `pnpm check` pass;
3. Clear402 false and true builds, integration tests, and browser E2E pass;
4. production start and public health/demo smoke pass; and
5. the dependency diff contains no advisory suppression or unrelated behavior.

The Current Release Resolution above records that these conditions were later
satisfied. The Maintainer-only RC tag remains a separate pending action.
