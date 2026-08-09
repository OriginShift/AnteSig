# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm TypeScript monorepo. `apps/web/` contains the Next.js UI and API routes; keep browser code in `src/client/`, server logic in `src/server/`, request contracts in `src/contracts/`, and React components in `src/components/`. Domain packages live under `packages/`: `report-schema`, `decision-engine`, `moss-adapter`, and `preflight-core`. Packages keep implementation in `src/` and tests in `test/`. Repository integration suites are in `tests/`; synthetic inputs are in `fixtures/`; architecture and security rules are in `docs/`. `vendor/moss/` is a pinned Git submodule—do not edit it as application code.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile` installs the pinned workspace dependencies (Node 22.13–22.x and pnpm 11 required).
- `pnpm dev` starts the web app in development mode.
- `pnpm build` builds packages in dependency order, then builds Next.js.
- `pnpm test` builds and runs all Vitest tests.
- `pnpm test:e2e` runs Playwright against a production build; artifacts go to `artifacts/test-results/`.
- `pnpm check` runs the CI quality gate: formatting, linting, types, builds, tests, coverage, and smoke checks.

## Coding Style & Naming Conventions

Use strict TypeScript and ES modules. Biome enforces two-space indentation and lint rules; run `pnpm format:check` and `pnpm lint`. Follow existing naming: kebab-case files (`preflight-service.ts`), PascalCase React components, camelCase functions, and uppercase constants. Prefer explicit types at package and API boundaries. Keep domain logic deterministic and side-effect free where established.

## Testing Guidelines

Vitest files use `*.test.ts` or `*.test.tsx`; Playwright files use `*.e2e.ts`; Node entry-point checks use `*.smoke.mjs`. Place tests beside their package or app. Add regression coverage for changed behavior and use synthetic fixtures with explicit `FIXTURE` provenance. `preflight-core` enforces 100% coverage via `pnpm test:coverage`.

## Commit & Pull Request Guidelines

Start every change from an approved Issue. History uses concise imperative subjects such as `feat(web): orchestrate fail-closed preflight API`, `test: ...`, and milestone labels like `M3-04: ...`; include the PR number when GitHub squashes. PRs must close the Issue and document actual changes, non-goals, verification evidence, risks, and required maintainer decisions. Include screenshots for UI changes. Never push or merge `main`; only the Maintainer merges after checks and review conversations are resolved.

## Security & Evidence Boundaries

Never add private keys, signing, transaction submission, or unverified protocol/token/spender addresses. Do not present mocks or fixtures as real Moss or Monad evidence, weaken mandatory `STOP` conditions, or rewrite the original Capability Tree. Architecture, schema, trust-boundary, and decision-semantics changes require explicit Maintainer approval.
