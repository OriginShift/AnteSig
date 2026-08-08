# Monad live smoke

The M2-08 smoke is an explicitly invoked evidence check for the exact pinned Moss build on Monad mainnet. It runs one PancakeSwap V2 `quote -> action -> simulate` sequence through `@moss-mini-demo/moss-adapter`. It never signs, submits, broadcasts, or authorizes a transaction.

## Prerequisites

Use Node 22.23.1 and pnpm 11.16.0. The root checkout and pinned vendor tracked trees must be clean. The root checkout must be at the Mini-Demo commit being tested, and `vendor/moss` must remain at the repository gitlink `1ae6b6322d51fae9104f047efb94e601050b967f`.

```bash
git submodule update --init --recursive vendor/moss
test "$(git -C vendor/moss rev-parse HEAD)" = "1ae6b6322d51fae9104f047efb94e601050b967f"
pnpm --pm-on-fail=ignore -C vendor/moss install --frozen-lockfile
pnpm --pm-on-fail=ignore -C vendor/moss build
pnpm install --frozen-lockfile
```

Run the smoke with an HTTP(S) Monad mainnet endpoint:

```bash
MOSS_RPC_URL=https://rpc.monad.xyz pnpm --filter @moss-mini-demo/moss-adapter test:live
```

`MOSS_RPC_URL` is server-only secret material even when the public endpoint is used. Do not paste the raw URL, request headers, provider logs, or raw RPC request/response bodies into Issues or PRs. URLs containing username/password credentials are rejected.

## Evidence artifact

The command writes exactly one compact JSON artifact. It contains the observation time, Mini-Demo head, `eip155:143`, the fixed Moss build/patch identity, RPC scheme and host only, protocol/method names, quote/Capability/simulation counts, verification statuses, and exact block number/hash plus recorded call block parameters when those facts are proven.

It deliberately omits RPC path/query/fragment/credentials, headers, environment values, raw Quote data, Capability parameters/transactions, receipts, changes, raw warning messages, exception messages, and stacks. `LIVE_SOURCE` is used only after a real chain-143 quote, action, and simulation return at least one result. A failure uses `NOT_ESTABLISHED`; Fixture provenance is forbidden.

Classifications are fail closed:

- `SUCCESS`: complete evidence, at least one result, zero warnings, no halt/revert, proven block identity, and proven required verification; exits 0.
- `WARNING_STOP`: warnings, halt/revert, or failed required verification; exits nonzero.
- `UNPROVABLE_STOP`: exact block or another required verification cannot be proven; exits nonzero and includes stable reason codes.
- `FAILED_STOP`: configuration, pin, chain, quote, action, Capability, simulation, timeout, or artifact validation failed; exits nonzero with only a stable stage/code.

Every STOP result means do not sign or submit. `SUCCESS` proves only that this smoke observed the recorded live sequence at the recorded block. It is not evidence that an action is safe, approved, executable later, or authorized for signing.

PancakeSwap V2 is the sole M2-08 P0 path. Kuru and second-protocol coverage are outside this issue.

## Offline regression

The artifact contract is tested without importing vendor Moss or opening the network:

```bash
pnpm exec vitest run packages/moss-adapter/test/live/artifact.test.mjs
pnpm check
```

The live command is intentionally excluded from `pnpm check` and CI. Retain the manual artifact with the exact PR head, date, Moss commit, patchset digest, RPC host, block number/hash, counts, statuses, and classification. Preserve nonzero STOP results as failures; never relabel them as successful live evidence.
