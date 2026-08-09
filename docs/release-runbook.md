# Production release runbook

## Release contract

AnteSig is deployed as a Vercel Next.js project at
<https://antesig.vercel.app>. The project Root Directory is `apps/web`, whose
`package.json` pins Vercel builds and Functions to Node `22.x`; Vercel may
update the minor and patch release. `/api/health` reports the actual
`process.versions.node` value and rejects a non-22 runtime.

The public URL requires no login. The production profile is intentionally
bounded:

- `CLEAR402_ENABLED=false` disables Credential actions and browser resources.
- `MOSS_RPC_URL` is not configured or consumed by the hosted Web route. A Live
  request must fail with `503 LIVE_UNAVAILABLE` and must not return a report or
  Decision.
- Fixture requests remain deterministic and return `provenance: FIXTURE`.
- `/api/health` exposes only bounded configuration and Moss build identity. It
  must never expose a secret, credential, private key, hostname, filesystem
  path, or full RPC URL.

Start from `config/production.env.example`. Do not commit `.env` files,
credentials, Vercel tokens, private keys, or RPC URLs. A missing optional
variable is the supported public baseline; it must not prevent startup.

## Pre-deployment gate

Run from a clean checkout of the exact release commit with Node `22.23.1` and
pnpm `11.16.0`:

```bash
corepack enable
pnpm install --frozen-lockfile
ASDF_NODEJS_VERSION=22.23.1 pnpm audit --prod --audit-level=moderate
ASDF_NODEJS_VERSION=22.23.1 pnpm check
ASDF_NODEJS_VERSION=22.23.1 CLEAR402_ENABLED=false pnpm build
ASDF_NODEJS_VERSION=22.23.1 pnpm test:web:production
ASDF_NODEJS_VERSION=22.23.1 pnpm test:web:production
```

The two production-start runs each allocate a new port, start a fresh Next.js
process, wait for health, exercise the page and logo, and stop the process.
They are the repeatable restart/cold-process smoke. They do not claim that a
specific Vercel request reached a newly allocated serverless isolate.

For a manual local fallback:

```bash
ASDF_NODEJS_VERSION=22.23.1 CLEAR402_ENABLED=false pnpm build
ASDF_NODEJS_VERSION=22.23.1 CLEAR402_ENABLED=false PORT=3000 pnpm start
curl -fsS http://127.0.0.1:3000/api/health | jq
BASE_URL=http://127.0.0.1:3000 ASDF_NODEJS_VERSION=22.23.1 pnpm test:e2e:smoke
```

## Deploy and verify

Production deploys must come from the merged `main` commit after its GitHub
`quality-gate` succeeds. Link the checkout to the existing project, inspect
the target, deploy, then record the immutable deployment URL before changing
traffic:

```bash
npx --yes vercel@latest link --yes --project antesig --scope <team-slug>
npx --yes vercel@latest project inspect antesig --scope <team-slug>
npx --yes vercel@latest deploy --prod --yes --scope <team-slug>
```

Verify the public alias and the immutable deployment URL:

```bash
curl -fsS https://antesig.vercel.app/api/health | jq
BASE_URL=https://antesig.vercel.app ASDF_NODEJS_VERSION=22.23.1 pnpm test:e2e:smoke
```

Required observations are HTTP 200 health, `app.nodeVersion` beginning `22.`,
`network.configured=false`, the expected Clear402 flag, a working Fixture
flow, explicit fail-closed Live behavior, and no authentication challenge.
Check HTTPS/HSTS headers as a separate observation. Never infer Live chain
evidence from health or Fixture success.

## Rollback

Before deployment, use `vercel ls antesig` to identify the current immutable
production URL. Select only a previously verified healthy production
deployment as the rollback target; do not guess from timestamps or aliases.
During an incident, the release owner runs:

```bash
npx --yes vercel@latest rollback <verified-good-deployment-url> --scope <team-slug>
npx --yes vercel@latest rollback status --scope <team-slug>
curl -fsS https://antesig.vercel.app/api/health | jq
BASE_URL=https://antesig.vercel.app ASDF_NODEJS_VERSION=22.23.1 pnpm test:e2e:smoke
```

Rollback repoints production traffic without rebuilding. Vercel disables
automatic production assignment after a rollback; after the incident is
resolved, restore a newly verified deployment explicitly:

```bash
npx --yes vercel@latest promote <verified-fixed-deployment-url> --scope <team-slug>
```

If the hosted service cannot be restored, use the local production fallback
above and describe it as local production, never as the public deployment.
The command behavior and plan limits are defined by Vercel's
[rollback CLI](https://vercel.com/docs/cli/rollback) and
[production rollback](https://vercel.com/docs/deployments/rollback-production-deployment)
documentation.
