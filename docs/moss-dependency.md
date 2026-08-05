# Moss Dependency Provenance

Audit date: 2026-08-05 (Asia/Hong_Kong)

## Purpose and boundary

Moss-Mini Demo pins Moss as an independent Git submodule at `vendor/moss` so
that a recursive clone and CI use the same reviewable source tree. The pin is
dependency provenance and an offline build input only. It does not implement a
Moss adapter, run Moss or Monad against a chain, create protocol evidence, or
show that Moss or the Mini-Demo is safe or operational.

Moss source remains in its own pnpm workspace. The Mini-Demo root workspace
does not register `vendor/moss`, does not copy Moss source, and does not resolve
these source packages from npm.

## Canonical build information

The accepted build-information contract is:

```ts
type MossBuildInfo = {
  sourceMode: "OFFICIAL_RELEASE" | "INTEGRATION_FORK";
  upstreamRepository: "https://github.com/nishuzumi/moss";
  upstreamCommit: string;
  integrationRepository?: string;
  integrationCommit?: string;
  patchsetDigest?: `sha256:${string}`;
  packages: Readonly<Record<string, string>>;
  officialRelease: boolean;
};
```

The exact record for this dependency pin is:

```json
{
  "sourceMode": "INTEGRATION_FORK",
  "upstreamRepository": "https://github.com/nishuzumi/moss",
  "upstreamCommit": "1ae6b6322d51fae9104f047efb94e601050b967f",
  "integrationRepository": "https://github.com/Moss-Mini-Demo/moss",
  "integrationCommit": "1ae6b6322d51fae9104f047efb94e601050b967f",
  "patchsetDigest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "packages": {
    "@themoss/core": "0.1.0",
    "@themoss/simulator": "0.1.0",
    "@themoss/protocol-kuru": "0.1.0",
    "@themoss/protocol-pancakeswap": "0.1.0"
  },
  "officialRelease": false
}
```

The package values are versions declared by manifests in the pinned source
tree. A package version alone is not the dependency identity and does not imply
that an equivalent npm artifact exists. The repositories and exact commits
above are authoritative.

## Source decision

The latest audited GitHub release is `v0.1.0` at commit
`a83434a61f81bdcc253f9b22dac53775cf6f659f`. The corresponding
`@themoss/core@0.1.0` npm artifact exposes the rejected legacy Plan API, while
`@themoss/protocol-pancakeswap@0.1.0` is not published. Those registry
artifacts cannot provide this pin's required Capability/Receipt source set.

Upstream PR [#138](https://github.com/nishuzumi/moss/pull/138) was merged as
`0c11b5ee672672d1b381afbabb587ae165805aa1`. The pinned upstream commit
`1ae6b6322d51fae9104f047efb94e601050b967f` contains that merge, so it is not
reapplied as an integration patch.

The public organization fork serves the same accepted commit. The integration
patch list is empty. The recorded digest is SHA-256 over the exact byte stream
from:

```bash
git diff --binary --no-ext-diff \
  1ae6b6322d51fae9104f047efb94e601050b967f..1ae6b6322d51fae9104f047efb94e601050b967f
```

An empty stream produces
`sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
Any non-empty integration diff invalidates this record.

## API and license fingerprint

These immutable Git blobs identify the reviewed source surfaces:

| Surface | Source path | Git blob SHA | Reviewed contract |
| --- | --- | --- | --- |
| Capability and Receipt | `packages/core/src/types.ts` | `ed6fb07d851a652a826220d6a73520eb58376f3a` | Public `CapabilityNode`, `CapabilityResult`, and `Receipt` contracts; no legacy Plan fallback |
| Simulator | `packages/simulator/src/index.ts` | `26016966d2588587995892b22f914bc59d6773f7` | The simulator consumes one root `CapabilityNode` tree |
| Kuru entry | `packages/protocols/kuru/src/index.ts` | `992e51ec2c6f5381230f1241b1c4343e29cf82a0` | Public source-package entry |
| PancakeSwap entry | `packages/protocols/pancakeswap/src/index.ts` | `60cd62e4fb6c27fe790a699f09144436fee83704` | Public source-package entry, independent of npm publication |
| License | `LICENSE` | `41416c0feb1e55d569ff759db4eaa34cd40a93a3` | MIT license and upstream attribution |

The pinned Moss repository and the listed package manifests identify their
license as MIT. The submodule preserves the upstream repository history,
copyright notice, and license file; Moss source is not copied into an ordinary
Mini-Demo directory.

## Reproducible verification

The Mini-Demo uses Node `22.23.1` and pnpm `11.16.0`. The independent pinned
Moss workspace declares Node 22 and pnpm `11.10.0`. CI and clean-clone
verification use each workspace's recorded pnpm version.

From a recursive Mini-Demo checkout:

```bash
git submodule status --recursive
test "$(git -C vendor/moss rev-parse HEAD)" = \
  "1ae6b6322d51fae9104f047efb94e601050b967f"
git -C vendor/moss diff --exit-code
git -C vendor/moss diff --cached --exit-code

corepack enable
(
  cd vendor/moss
  corepack pnpm --version
  corepack pnpm install --frozen-lockfile
  corepack pnpm build
  corepack pnpm typecheck
  corepack pnpm test:offline
)
```

The Moss test command sets its repository-defined offline mode. It must not be
replaced with an online, RPC, protocol, wallet, signing, or transaction test in
the regular quality gate.

The pinned Moss tree has its own root Biome configuration. After its complete
gate passes, the Mini-Demo quality gate deinitializes that third-party worktree
before scanning the Mini-Demo root. This keeps both tools inside their owning
workspace without changing the recorded gitlink:

```bash
git submodule deinit --force vendor/moss

corepack install --global pnpm@11.16.0
pnpm install --frozen-lockfile
pnpm check

git submodule update --init --recursive vendor/moss
```

A remote reproducibility check starts from a new directory and initializes the
submodule during clone:

```bash
issue24_clone_dir=$(mktemp -d)
git clone --recurse-submodules \
  https://github.com/Moss-Mini-Demo/moss-mini-demo.git \
  "$issue24_clone_dir/repo"
cd "$issue24_clone_dir/repo"
```

The remaining commands are the same pinned-SHA, dual-workspace checks above.
No prior `node_modules`, `dist`, pnpm store, credential, or untracked source is
evidence for a successful clean clone.

## Update rule

The submodule has no tracked branch. A later upstream release or commit does
not move this dependency automatically. Updating it requires a separately
reviewed dependency change that records a new upstream and integration commit,
complete patch list, binary diff digest, API/license fingerprint, clean-clone
results, and exact-Head CI evidence.

Do not silently substitute a direct upstream checkout, personal or private
fork, npm fallback, floating branch or tag, copied source, or hidden
credential. A fork visibility change, commit drift, blob mismatch, non-empty
unreviewed patch, or offline-gate failure invalidates this provenance record.

## Evidence limitations

A reproducible source checkout and green offline build prove only that the
recorded dependency inputs passed the recorded engineering checks. They are not
Moss runtime output, Monad or protocol evidence, a Capability, simulation,
Receipt, Quote, wallet result, transaction authorization, safety conclusion,
execution guarantee, or permission to sign.
