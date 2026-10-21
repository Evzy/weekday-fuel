# v0.29.0: Trolley matches the plan — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

Spec: `docs/superpowers/specs/2026-10-21-trolley-matches-plan-design.md`.

**Goal:** Sending (both stores) and Woolworths Check out remove trolley products that aren't in the plan.

## Global constraints

- Commit to `main` by explicit path; never stage CRLF-only modified files this plan doesn't edit (the Kotlin/JS files this plan edits will show their CRLF normalisation; confirm the staged diff is content-only with `git diff --cached --stat`). Never `git stash` / `git clean` / `git reset --hard`.
- No local Android SDK: Kotlin is checked by CI only; keep Kotlin edits small and mirror existing patterns. Store pages never get a JS bridge; only `https://appassets.androidplatform.net` may message the host. No CI test talks to real sites.
- CI green before the next task; version bump only in the release task. Escape strings with `esc`. HTML via file edit tools, UTF-8 without BOM.
- Tests: `node --test "apps/android/app/src/test/js/*.test.js"`; HTML parse check.

## Task 1: Store scripts and host pass-through

**Files:** `assets/woolworths/trolley.js`, `assets/coles/trolley.js`, the Kotlin trolley message models/parsers for both stores (`woolworths/TrolleyModels.kt`, `woolworths/HostMessages.kt`, `coles/ColesTrolleyModels.kt` and wherever the send message is turned into the script call), their JS and Kotlin tests.

- Tests first per spec Testing. Optional `keep`; absent = unchanged behaviour.
- Commit `Trolley: remove products not in the plan when keep is sent`.

## Task 2: Page

**Files:** `cart.js` (+ `cart.test.js`) for `planCodes`; `Weekday_Fuel.html`.

- Send messages carry `keep` from `planCodes(shopRows(), store, colesId)`; Start over sends `keep: []`.
- Results with `extra` are excluded from `sentAfter`, stock and orders; result view shows the removed / couldn't-remove line.
- Woolworths Check out: one automatic removal pass on load for summary items not in the plan, then reload; show the line with names.
- Suite + parse check + browser check (no host; stand-in host capturing messages). Commit `Shop: keep the trolley to the plan`.

## Task 3: Release v0.29.0

- `versionCode 45 → 46`, `versionName "0.28.2" → "0.29.0"`; commit `Release v0.29.0: trolley matches the plan`; CI; confirm APK.
