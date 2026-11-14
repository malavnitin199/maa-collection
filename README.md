# Maa Collection

Mobile-first **inventory + point-of-sale (POS)** web app for an Indian clothing shop. A salesperson scans an item's barcode, sees its details and stock, enters the price the customer agreed to pay, and the sale is recorded against their name. The owner sees stock, revenue and sales per salesperson.

It starts as a tool for one shop (Maa Collection). The plan is to grow it into a product many retailers can use, so shop settings and tax are data-driven, not hardcoded.

- **Live demo:** https://maa-collection-pi.vercel.app
- **Status:** early stage. A working **demo** of the scan-to-sell flow runs on **dummy data stored in the browser**. There's no database, real login or billing yet. See [Project status and roadmap](#project-status-and-roadmap).

---

## Contents

1. [What the app does today](#what-the-app-does-today)
2. [Tech stack](#tech-stack)
3. [Installation and running locally](#installation-and-running-locally)
4. [Using the app](#using-the-app)
5. [Testing barcode scanning](#testing-barcode-scanning)
6. [Available scripts](#available-scripts)
7. [Running the tests](#running-the-tests)
8. [Project structure](#project-structure)
9. [Core rules the code follows](#core-rules-the-code-follows)
10. [Deployment (Vercel)](#deployment-vercel)
11. [Documentation index](#documentation-index)
12. [Troubleshooting](#troubleshooting)
13. [Project status and roadmap](#project-status-and-roadmap)
14. [Contributing](#contributing)

---

## What the app does today

| Screen | URL | Who | What it does |
|---|---|---|---|
| Home | `/` | Everyone | Landing page with a **Get started** button |
| Role picker | `/login` | Everyone | Demo-only. Choose **Salesman** or **Admin** (no password yet) |
| Counter sale | `/pos` | Salesman | Scan or type a code, see item details, enter quantity and the agreed price, record the sale |
| Dashboard | `/admin/dashboard` | Admin | Stock per item, low-stock warnings, total revenue, units sold, sales per salesperson, **Reset demo data** |
| Test labels | `/admin/labels` | Admin | One EAN-13 barcode per demo item, for scan testing or printing |

### The sale flow

```
Scan (phone camera / USB or Bluetooth scanner / typed code)
  → Item details: SKU, barcode, brand, category, size, colour, MRP, stock
  → "Sell this item" → quantity + agreed sale price (prefilled with MRP)
  → "Record sale"
  → stock goes down, sale is saved under the selected salesperson
```

There's **no multi-item cart**. Each scan is one sale, because every customer bargains a different price (owner decision ADR-004 in [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md)). The price entered is what gets recorded, and the MRP at that moment is stored next to it.

Rules checked before a sale is saved:

| Situation | Message shown |
|---|---|
| Code not in the catalog | `No item found for "…"` |
| Stock is 0 | Details still show; selling is refused as out of stock |
| Quantity above stock | `Only N left in stock.` |
| Price above MRP | `Sale price cannot be above MRP.` |
| Empty or invalid price | `Enter a valid sale price.` |

### Three ways to scan

1. **Phone camera.** Tap **Scan with camera**. It reads barcodes (EAN-13, EAN-8, UPC-A, Code 128), and QR codes too if an item ever carries one, and closes on its own after one read. On Chrome for Android it uses the phone's built-in barcode reader; elsewhere it uses [zxing](https://github.com/zxing-js/browser).
2. **USB or Bluetooth barcode scanner.** These act like a keyboard: they type the code and press Enter. Just scan; you don't need to tap anything first.
3. **Typing.** Type a SKU (`MAA-TS-001`) or barcode (`8901111000014`) and press Enter. This is the fallback for a torn label.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router), React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| Scanning | `@zxing/browser` plus the browser's `BarcodeDetector` when available |
| Label generation | Our own EAN-13 barcode encoder in `src/features/scanning/ean13.ts` (no extra library) |
| Unit tests | Vitest + Testing Library (jsdom) |
| End-to-end tests | Playwright (Chromium) |
| Package manager | **pnpm only** (one lockfile; don't use npm/yarn/bun to install) |
| Hosting | Vercel |

Planned for later phases (not installed yet): PostgreSQL + Drizzle ORM, Better Auth, Zod, shadcn/ui, TanStack Query, Zustand, Dexie (offline). See [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md).

---

## Installation and running locally

### 1. Prerequisites

| Tool | Version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org) | **26** (pinned in `.nvmrc`) | `node -v` |
| [pnpm](https://pnpm.io) | **12.18.0** (pinned in `package.json` → `packageManager`) | `pnpm -v` |
| [Git](https://git-scm.com) | any recent | `git --version` |

**Install Node 26.** Use [nvm](https://github.com/nvm-sh/nvm) or download it from nodejs.org:

```bash
nvm install      # reads .nvmrc and installs Node 26
nvm use
```

**Install pnpm.** Newer Node versions no longer include Corepack, so install pnpm directly:

```bash
npm install -g pnpm@12.18.0
```

### 2. Get the code

```bash
git clone https://github.com/malavnitin199/maa-collection.git
cd maa-collection
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Start the development server

```bash
pnpm dev
```

Open **http://localhost:3000**. Click **Get started**, then **Continue as Salesman**, to reach the sale screen.

> Use `localhost`, not `127.0.0.1` or your computer's IP address. In development, Next.js blocks scripts for other addresses, so the page loads but its buttons stay disabled.

### 5. (Optional) Production build on your computer

```bash
pnpm build
pnpm start      # serves the production build on http://localhost:3000
```

### Environment variables

**None are needed right now.** The demo has no database or external services. When the database arrives (phase P2), a `.env.local` file will be needed; `.env*` files are git-ignored and must never be committed.

---

## Using the app

1. Go to `/login` and choose **Continue as Salesman**.
2. On **Counter sale**, scan a test label, or type `MAA-TS-001` and press Enter.
3. Check the item details, tap **Sell this item**, enter the quantity and the agreed price (up to MRP), then tap **Record sale**.
4. Choose who made the sale in the **Salesperson** dropdown (Ravi or Priya in the demo).
5. Go to `/login` → **Continue as Admin** to see the dashboard. **Reset demo data** restores the starting stock and clears sales.

### Demo catalog

| SKU | Barcode | Item | Starting stock |
|---|---|---|---|
| MAA-TS-001 | 8901111000014 | Classic Crew Tee, M, Black | 3 |
| MAA-TS-002 | 8901111000021 | Classic Crew Tee, L, White | 5 |
| MAA-KU-001 | 8902222000016 | Anarkali Kurta, M, Blue | 4 |
| MAA-KU-002 | 8902222000023 | Anarkali Kurta, L, Red | 2 (low) |
| MAA-JE-001 | 8903333000018 | Slim Fit Jeans, 32, Indigo | 6 |
| MAA-SH-001 | 8905555000012 | Oxford Shirt, 40, Sky Blue | 1 (low) |
| MAA-SA-001 | 8904444000010 | Banarasi Saree, Free, Green | 0 (out of stock) |
| MAA-DR-001 | 8906666000014 | A-Line Dress, S, Maroon | 8 |

> **Demo data lives in each browser's `localStorage`.** Your phone and your laptop each keep their own stock and sales. Check the dashboard on the same device you sold from. The catalog is a fixed list in `src/features/catalog/dummy-catalog.ts`. Both are temporary until the database phase.

---

## Testing barcode scanning

**The camera only works on `https://` addresses or `localhost`.** Browsers block camera access on plain `http://` addresses such as `http://192.168.x.x:3000`. To scan with a phone, use the deployed site or your own Vercel preview.

1. On a laptop, open **`/admin/labels`** (for example https://maa-collection-pi.vercel.app/admin/labels). It shows one barcode for every demo item. You can also print the page.
2. On the phone, open **`/pos`** and tap **Scan with camera**, then allow camera access.
3. Hold the barcode flat inside the green box, about 15–20 cm away, until it is sharp. Keep the laptop screen bright and avoid glare.
4. The item details appear automatically.

Each item has **one label: an EAN-13 barcode** encoding its barcode number, the same kind of barcode printed on clothing tags. The images are in `public/barcodes/<SKU>.svg`. After changing the catalog, regenerate them:

```bash
pnpm labels:generate
```

Full guide, including hardware scanners and troubleshooting: **[`docs/SCANNING.md`](docs/SCANNING.md)**.

---

## Available scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the development server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build (run `pnpm build` first) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check. Runs `next typegen` first to generate Next.js route types (`LayoutProps`, `PageProps`), then `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest), run once |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm test:e2e` | End-to-end tests (Playwright, Chromium). Starts the dev server automatically |
| `pnpm labels:generate` | Regenerate the barcode images for the demo catalog |

---

## Running the tests

**One-time setup for end-to-end tests.** Download the Playwright browser:

```bash
pnpm exec playwright install chromium
```

**Full quality gate.** Every change must pass this before it is committed:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

| Suite | Location | Covers |
|---|---|---|
| Unit (Vitest) | `src/**/*.test.ts` | Money in paise, catalog lookup, sale validation rules, EAN-13 check digits and drawing, scanner keystroke detection |
| End-to-end (Playwright) | `e2e/*.spec.ts` | Role picker, scan → details → sell → stock drops → dashboard, price above MRP rejected, unknown and out-of-stock codes, scanner works without tapping the box, labels page shows one barcode per item |

The camera itself needs a real device. The automated tests cover everything around it, and [`docs/SCANNING.md`](docs/SCANNING.md) lists the manual phone checks.

---

## Project structure

```
maa-collection/
├── src/
│   ├── app/                      Routes only (pages, layouts)
│   │   ├── page.tsx              /  home
│   │   ├── (auth)/login/         /login  demo role picker
│   │   ├── (pos)/pos/            /pos  counter sale (Salesman)
│   │   └── (admin)/admin/        /admin/dashboard, /admin/labels (Admin)
│   ├── features/                 Feature UI and browser logic
│   │   ├── pos/                  pos-screen.tsx: scan → details → sell
│   │   ├── scanning/             camera-scanner.tsx, scanner-keystrokes.ts, ean13.ts
│   │   ├── catalog/              dummy-catalog.ts: demo items + lookup by SKU/barcode
│   │   ├── inventory/            inventory.ts (sale rules), dummy-store.ts (localStorage demo store)
│   │   └── reports/              admin-dashboard.tsx
│   ├── components/layout/        Shared header with role badge and navigation
│   ├── lib/                      money.ts (paise formatting), app-config.ts
│   ├── server/                   (later) services, repositories, access control
│   ├── db/                       (later) PostgreSQL schema
│   ├── offline/                  (later) offline queue and sync
│   └── test/                     Test setup
├── e2e/                          Playwright end-to-end tests
├── public/barcodes/              Generated barcode labels
├── scripts/generate-labels.ts    Label generator (pnpm labels:generate)
├── docs/                         Product and engineering documentation
└── .cursor/rules/                Rules for AI coding agents (also apply to humans)
```

Empty folders (`server/`, `db/`, `offline/`, …) hold a `.gitkeep`. They are the agreed skeleton and get filled in their phase.

---

## Core rules the code follows

These come from the requirements and must not be broken (full list in [`CLAUDE.md`](CLAUDE.md)):

1. **Money is stored as whole paise** (₹499.00 = `49900`), never as decimals with fractions.
2. **Sales and stock movements are never edited or deleted.** Corrections are new, linked records.
3. **The server decides stock and totals** (once the database exists). A retried request must never sell twice.
4. **Salespeople never receive cost, profit or supplier data.** It is removed on the server, not just hidden on screen.
5. **Offline sales stay provisional** until the server confirms them.
6. **GST can differ per item by price** (Indian clothing tax slabs). Never assume one flat rate.
7. **Both kinds of barcode are supported:** our own printed labels and the manufacturer's EAN-13 barcodes.

---

## Deployment (Vercel)

The app is hosted on Vercel at https://maa-collection-pi.vercel.app. It is currently deployed from the command line with the [Vercel CLI](https://vercel.com/docs/cli). The GitHub repository is **not** connected yet, so pushing to GitHub does not update the site.

```bash
npm install -g vercel     # once
vercel login              # once
vercel link               # once per checkout: links this folder to the Vercel project
vercel deploy             # preview deployment (its own https URL, good for phone testing)
vercel deploy --prod      # production: updates maa-collection-pi.vercel.app
```

No environment variables are needed on Vercel yet. To deploy automatically on every push to `main`, connect this GitHub repository in the Vercel project's **Settings → Git**.

---

## Documentation index

| Document | Read it for |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Single source of truth: product summary, stack, core rules, workflow |
| [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) | Short product reference and current status |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | What's done, test results, next steps (living log) |
| [`docs/TASK_BACKLOG.md`](docs/TASK_BACKLOG.md) | Phased task list P0–P8 with stable task IDs |
| [`docs/SCANNING.md`](docs/SCANNING.md) | How scanning works, test labels, phone testing, troubleshooting |
| [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md) | Proposed full architecture (a proposal, not settled requirements) |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Open business and policy questions (GST, returns, discounts…) |
| [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) | Decisions the owner has approved |
| [`docs/INTERVIEW_GUIDE.md`](docs/INTERVIEW_GUIDE.md) | Plain-language walkthrough of the project and a demo script |
| [`docs/TASK_01_BOOTSTRAP.md`](docs/TASK_01_BOOTSTRAP.md) | How the project was set up (task P1-01) |
| [`docs/SOURCE_PRD.pdf`](docs/SOURCE_PRD.pdf) | The original 12-page requirements document |
| [`AGENTS.md`](AGENTS.md), [`.cursor/rules/`](.cursor/rules) | Instructions for AI coding agents |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `pnpm: command not found` | `npm install -g pnpm@12.18.0` |
| Odd install or build errors | Check `node -v` shows 26 (`nvm use`), then delete `node_modules` and run `pnpm install` again |
| Page loads but buttons stay disabled (dev) | Open `http://localhost:3000`, not `127.0.0.1` or an IP address |
| Port 3000 already in use | Stop the other process, or run `pnpm dev -p 3001` (Playwright expects 3000) |
| "Camera needs HTTPS" | Use the Vercel URL or `localhost`; plain `http://` IP addresses can't use the camera |
| "Camera permission was denied" | Allow the camera in the browser's site settings and reload |
| Camera opens but never reads | Barcode flat inside the green box, 15–20 cm away, sharp, bright screen, no glare. |
| Scan says "No item found" | The code isn't in the demo catalog. Use the labels from `/admin/labels` |
| Stock looks different on phone and laptop | Expected: demo data is stored per browser. Use **Reset demo data** to start over |
| `pnpm test:e2e` says the browser is missing | `pnpm exec playwright install chromium` |

---

## Project status and roadmap

**Done**
- P1-01: project setup and quality checks (lint, typecheck, unit tests, build, end-to-end tests)
- P1-02: login, salesman and admin page outlines
- Demo scan-to-sell flow: camera, hardware scanner and typed scanning; bargained price up to MRP; sales per salesperson; admin dashboard; barcode test labels

**Next** (see [`docs/TASK_BACKLOG.md`](docs/TASK_BACKLOG.md))
- P1-03: shared UI components (shadcn/ui)
- P2: PostgreSQL database, replacing the browser-only demo store so all devices share one stock
- P3: catalog management, mapping manufacturer barcodes, label printing
- Later: real staff login, GST per item, receipts, returns and exchanges, offline billing, reports, day-close cash count, accountant export

Open business questions (GST slabs, discount limits, returns policy, hardware) are tracked in [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Contributing

- Work on **one backlog task at a time** (by its ID in `docs/TASK_BACKLOG.md`), with the smallest change that does the job.
- Ship tests with the feature, especially anything about money or stock.
- Run the full quality gate before committing, and record results in `docs/PROGRESS.md`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`.
- Never commit secrets (`.env*` and `.vercel/` are git-ignored).
- Don't invent business policy (tax, discounts, returns). Record the question in `docs/DECISIONS.md` and ask the owner.

## License

No license has been chosen yet. Until one is added, all rights are reserved by the project owner.
