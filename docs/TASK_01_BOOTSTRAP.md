# Task P1-01 - Bootstrap Next.js application and project quality baseline

**Task ID:** P1-01  
**Phase:** P1 - Foundation  
**Source:** PRD sections 7–11 (two panels, React/Next.js PWA); supporting engineering practice  
**Scope:** ONLY project initialization, reproducible scripts, unit test harness, browser smoke test and initial Git commit. **No database, login or billing implementation yet.**

## Expected outcome

At completion you can open `http://localhost:3000`, see `Maa Collection`, run lint and typecheck, run one unit test and one browser smoke test, build successfully, and push a clean Git repository.

### Step 0 - Check tools

Use Node.js 24 LTS (or an approved project-pinned LTS), Git and pnpm:

```bash
node -v
git --version
npm install -g pnpm@latest
pnpm -v
```

If Node is another major, switch it using `nvm` or another version manager. A Node 24 project `.nvmrc` keeps collaborators aligned.

### Step 1 - Create app

```bash
pnpm create next-app@latest maa-collection \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias '@/*' --use-pnpm
cd maa-collection
printf '24\n' > .nvmrc
pnpm dev
```

Open **http://localhost:3000**. Stop with Ctrl+C after checking.

### Step 2 - Replace initial home page

File: `src/app/page.tsx`

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Maa Collection</h1>
      <p className="text-muted-foreground">
        Retail inventory and point-of-sale application. Project foundation is ready.
      </p>
    </main>
  );
}
```

For this task, keep routing and data intentionally minimal. We create both role panels in `P1-02`.

### Step 3 - Install unit test tools

```bash
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths \
  jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event
mkdir -p src/test src/lib e2e docs
```

File: `vitest.config.ts` (repository root)

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

File: `src/test/setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
```

File: `src/lib/app-config.ts`

```ts
export const APP_NAME = 'Maa Collection' as const;
```

File: `src/lib/app-config.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { APP_NAME } from './app-config';

describe('application configuration', () => {
  it('has the correct store application name', () => {
    expect(APP_NAME).toBe('Maa Collection');
  });
});
```

This test is intentionally small: it proves the harness works. In later phases, prioritize transaction and permission tests over arbitrary component snapshots.

### Step 4 - Install Playwright browser testing

```bash
pnpm create playwright
```

Choose **TypeScript**, choose **`e2e`** for test folder, enable GitHub Actions if desired, and install browsers (or use `pnpm exec playwright install chromium` afterwards). If the wizard created `playwright.config.ts`, update it with this minimal configuration:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3000' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Remove wizard-generated example tests that assert the Playwright homepage; create `e2e/home.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('app shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Maa Collection' })).toBeVisible();
});
```

### Step 5 - Add scripts

**Merge** this `scripts` configuration into the existing `package.json`; preserve framework-installed dependencies:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Do not run `npm init` or create a second lockfile. Keep `pnpm-lock.yaml` committed.

### Step 6 - Verify everything

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The Playwright config starts a dev server automatically if one is not running. Report any failure exactly; don't mark the task done by ignoring it.

### Step 7 - Add project documents and commit

Copy `PROJECT_BLUEPRINT.md`, `TASK_BACKLOG.md`, `DECISIONS.md` and this task file into your repository's `docs/` directory. Create `.env.example` later during P2; never commit real secrets.

```bash
git status
git add .
git commit -m "chore(P1-01): bootstrap Maa Collection Next.js app"
```

`create-next-app` typically initializes Git. If `git status` reports the directory is not a Git repository, run `git init` first, then repeat. Publishing to GitHub is optional and requires your remote details.

## Acceptance checklist

- [ ] Node major documented in `.nvmrc`, package manager standardized on pnpm.
- [ ] `src/app/page.tsx` renders the `Maa Collection` heading.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes one Vitest example.
- [ ] `pnpm build` passes.
- [ ] `pnpm test:e2e` passes Chromium home-page test.
- [ ] No `.env.local`, credentials or sensitive business data committed.
- [ ] Initial Git commit created with task ID.

## First review checklist

When done, review only:

1. `package.json` and `pnpm-lock.yaml`
2. `src/app/page.tsx`
3. `vitest.config.ts` and `playwright.config.ts`
4. outputs of the six quality commands

**Next task:** `P1-02` - shell out `/login`, `/admin/dashboard` and `/pos` with responsive navigation (mocked content; no DB/auth yet). Do not jump to offline sync before a correct online transaction system exists.
