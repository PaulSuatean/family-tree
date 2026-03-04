# Visual testing

This repo now includes a Playwright-based visual QA harness for layout checks.

## What it tests

- Full-page screenshots for the landing, demo tree, store, contact, and auth pages.
- Optional authenticated screenshots for dashboard and editor when local test credentials are provided.
- Three breakpoints: mobile (`390x844`), tablet (`1024x1366`), and desktop (`1440x1200`).
- Automatic layout audit for horizontal overflow and obvious sibling overlap in key sections.
- Page-specific checks for edge alignment and nested layout containment on fragile screens.
- A readable local audit output with screenshots and the elements flagged as likely misaligned.

## First-time setup

```powershell
npm install
npx playwright install chromium
```

## Commands

```powershell
npm run test:visual
npm run test:visual:headed
npm run test:visual:update
```

## Authenticated pages

To include `dashboard` and `editor` in the visual run, set local credentials before running Playwright:

```powershell
$env:VISUAL_TEST_LOGIN_IDENTIFIER="test@test.com"
$env:VISUAL_TEST_PASSWORD="password123"
npm run test:visual:update
npm run test:visual
```

Notes:
- The auth-enabled run stays local and uses your local app only.
- The editor test logs in, opens the dashboard, and clicks the first available `Edit` button.
- If the env vars are not set, the suite skips `dashboard` and `editor` and only runs the public pages.

## How to use it

1. Run `npm run test:visual:update` once to create the initial screenshot baseline.
2. Change your HTML or CSS.
3. Run `npm run test:visual`.
4. If a change is intentional, re-run `npm run test:visual:update` to refresh the baseline.
5. If you want the authenticated pages covered, keep the env vars set for both the update and the normal run.

## Output

- Baseline snapshots are stored next to the test spec in `tests/visual.spec.js-snapshots/`.
- Failure artifacts are written to `test-results/`.
- The HTML report is written to `playwright-report/visual/`.
- Local audit artifacts are written to `visual-audit/<page>-<viewport>/`.
- Each audit folder contains:
  - `page.png`
  - `page-annotated.png` when issues are detected
  - `report.json`
  - `report.md`
