# Development progress (living)

Last updated: 2026-11-14

## Current milestone
Phase P1: application foundation.

## Task status
- [x] P1-01: bootstrap Next.js project + quality baseline (DONE 2026-11-14)
- [ ] P1-02: admin, cashier and login route shells (NEXT)

All other tasks are tracked in `docs/TASK_BACKLOG.md`.

## Verification log
| Date | Task | Commands run | Result | Notes |
|---|---|---|---|---|
| 2026-11-14 | P1-01 | `pnpm lint` | PASS | ESLint 9 flat config, no warnings |
| 2026-11-14 | P1-01 | `pnpm typecheck` | PASS | `tsc --noEmit`, strict mode |
| 2026-11-14 | P1-01 | `pnpm test` | PASS | 1 Vitest unit test (app-config smoke) |
| 2026-11-14 | P1-01 | `pnpm build` | PASS | Next.js 16.4.6 production build, `/` static |
| 2026-11-14 | P1-01 | `pnpm test:e2e` | PASS | 1 Playwright Chromium test, heading visible |

## P1-01 notes / deviations from the bootstrap guide
- Node 26 installed locally instead of 24 LTS; `.nvmrc` pins `26`. Both are even (LTS-line) majors; keep one major across CI/deploy.
- Versions pinned by lockfile: Next.js 16.4.6, React 19.3.0, Tailwind 4, TypeScript 5.9, Vitest 5, Playwright 1.65, pnpm 12.18.0.
- Playwright set up manually (config + `e2e/home.spec.ts` + `playwright install chromium`) instead of the interactive `pnpm create playwright` wizard.
- Blueprint folder skeleton created with `.gitkeep` placeholders (`src/features`, `src/server/*`, `src/db/schema`, `src/offline`, etc.). No functionality implemented.
- `CLAUDE.md` added at repo root as the single-source-of-truth context file for agents and contributors.
- Dev server prints an `allowedDevOrigins` hint when accessed via 127.0.0.1; harmless, can be configured later if it becomes noisy.

## Blockers / open questions
- P0 policy questions in `docs/DECISIONS.md` have not been approved.
- Confirm real scanner/printer models before choosing hardware APIs.
- Review gaps to add to backlog (see `CLAUDE.md`): day-close/cash reconciliation, EAN-13 mapping, stock-take, price override, GST slabs/HSN, accountant export, D-15 multi-tenant ambition.

## Next session handoff
Read `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `docs/PROGRESS.md`, `docs/TASK_BACKLOG.md`. Start **P1-02** (`/login`, `/admin/dashboard`, `/pos` route shells with responsive placeholder layouts — no DB/auth). Inspect the actual repo before modifying anything.
