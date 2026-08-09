# M5 Performance Acceptance Report

## Verdict

**PASS WITH LIVE SCOPE CUT**

Subject main SHA: `76b64eb59d1cd4e9e3af9f2b0e9be0b37d0c20bd`

Execution date: 2026-08-09 (Asia/Hong_Kong)

This is a single-operator benchmark. No independent-review claim is made.
The production Fixture, browser, verification, export, timeout, and byte-limit
checks pass their targets and hard-fail thresholds. Live quote and successful
Live preflight latency remain unmeasured because the baseline has no configured
RPC and the Web route intentionally has no Live session. The five Live attempts
below are recorded as deterministic, visible `LIVE_UNAVAILABLE` failures, not
as successful Live performance samples.

## Environment

- Machine: Apple M5 Pro, macOS, `darwin/arm64`, 51,539,607,552 bytes memory
- Node.js: `v22.23.1`
- pnpm: `11.16.0`
- Browser: Playwright Chromium 148 via Playwright `1.60.0`
- Clear402: enabled for the production build and verification samples
- RPC/network: not configured (`network.configured=false`)
- Chrome DevTools MCP: unavailable in this execution environment; the
  benchmark uses Playwright Chromium and the browser Performance API instead

## Commands

```text
CLEAR402_ENABLED=true pnpm test:performance: PASS
  - production build
  - 2 performance guard tests
  - production server benchmark
```

The benchmark starts `next start` on a loopback port, runs against that
production build, and terminates the process after the sample matrix.

## Acceptance Matrix

| Metric | Samples | Min | Median | P95 | Max | Target | Hard fail | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Fixture response (ms) | 10 | 3.62 | 4.47 | 6.14 | 6.14 | <300 | >1,000 | PASS |
| First interactive (ms) | 10 | 63.70 | 71.20 | 107.30 | 107.30 | <2,000 | >4,000 | PASS |
| Credential verify (ms) | 10 | 2.20 | 2.52 | 3.47 | 3.47 | <100 | >500 | PASS |
| Export JSON (bytes) | 1 | 4,710 | 4,710 | 4,710 | 4,710 | <2,000,000 | >5,000,000 | PASS |
| Large raw evidence render (ms) | 1 | 55.56 | 55.56 | 55.56 | 55.56 | <2,000 | >4,000 | PASS |
| Large raw evidence drawer (ms) | 1 | 69.80 | 69.80 | 69.80 | 69.80 | visible without freeze | >1,000 | PASS |

Raw timing samples from the exact run:

```text
Fixture response ms:       4.96, 5.48, 6.07, 4.32, 3.94, 6.14, 4.60, 4.47, 3.98, 3.62
First interactive ms:    107.30, 68.00, 71.10, 71.70, 63.70, 71.20, 72.10, 71.60, 72.20, 70.50
Credential verify ms:      3.47, 2.52, 2.63, 2.26, 2.33, 2.56, 2.20, 2.22, 2.56, 2.52
Fixture response bytes:    6,419 for all 10 samples
Verify response bytes:     31 for all 10 samples
Large raw payload bytes:   1,500,000 injected; 1,502,991 serialized response
```

## Live Boundary

Five production Live attempts were made with the fixed valid intent contract:

```text
count:              5
status:             LIVE_UNAVAILABLE for all attempts
response ms:        2.80, 2.29, 0.91, 2.22, 2.32
p95 / max:          2.80 / 2.80
response bytes:     183 for all attempts
run IDs:            5 unique v4 run IDs
```

The response code and UI error state were both checked for
`LIVE_UNAVAILABLE`. A separate browser route test returned the real
`PREFLIGHT_TIMEOUT` 504 contract and verified the code/message became visible
in the Live error panel in 50.81ms. Since there is no Live session, no claim is
made for the `<8s` Live Quote or `<15s` successful Live preflight targets.

## Size And Timeout Guards

- Fixture response cap: `2,097,152` bytes; observed response: `6,419` bytes.
- Clear402 verify request cap: `2,097,152` bytes; observed response: `31` bytes.
- A preflight body beyond `65,536` bytes returned `413 REQUEST_TOO_LARGE`.
- A verify body beyond `2,097,152` bytes returned `413 REQUEST_TOO_LARGE`.
- A `1,500,000` byte raw evidence payload rendered and opened without UI
  freezing or exceeding the 4 second hard bound.
- Orchestrator budgets remain 8 seconds for quote and 25 seconds total; the
  performance guard tests enforce both remain below the issue hard-fail limits.

## Scope Decision

The Fixture and local product loop meet the performance acceptance criteria.
Live latency is an explicit scope cut for this baseline because `/api/health`
reports `network.configured=false` and the production route does not resolve a
Live session. Enabling Live measurements requires a separately authorized RPC
environment and a fresh run; it is not inferred from fail-fast unavailable
responses.
