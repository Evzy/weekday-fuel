# v0.27.0: Mixed pack sizes — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

Spec: `docs/superpowers/specs/2026-10-21-mixed-packs-design.md`.

**Goal:** A shop line can buy several pack sizes of one item (cheapest mix), and send, sent-record reading, orders, stock, fingerprint and Review all handle it.

**Architecture:** `catalogue.js` `storeLine` returns `parts`; consumers iterate `parts` when present and fall back to `product`/`quantity` otherwise.

## Global constraints

- Commit to `main` by explicit path; never stage the CRLF-only modified files except those this plan edits (`cart.js`, `cart.test.js`: Git normalises them to LF on add, so their staged diff is content-only — confirm with `git diff --cached --stat`). Never `git stash` / `git clean` / `git reset --hard`.
- CI green before the next task; version bump only in the release task. Escape strings with `esc`. HTML via file edit tools.
- Lines without `parts` behave exactly as today.
- Tests: `node --test "apps/android/app/src/test/js/*.test.js"`; HTML parse check.
- Only stop servers you started.

---

## Task 1: Cheapest mix in `storeLine`

**Files:** `catalogue.js`, `catalogue.test.js`.

- Tests first (spec Testing list for catalogue), then implement per spec "Choosing" and "Line shape". `buy` joins parts with " + ". `alts` = candidates not in parts. `candidates` unchanged.
- Update `planner.js` `shopScore` leftover to use parts (with a test in `planner.test.js` if one exists for shopScore).
- Commit `Shop: cheapest mix of pack sizes`.

## Task 2: Send, removals, sent reading, orders, stock

**Files:** `cart.js`, `orders.js`, `inventory.js` and their tests.

- `cartLines` / `colesCartLines`: a line per part; `removalLines` / `colesRemovalLines` keep all part ids.
- `sentLineQty` returns an array (update all callers); `snapshot` one entry per row listing sent parts; no "not in this shop" duplicates; changed-since-sending when sent ids ≠ part ids.
- `amountFromSent` / `buysFromRows` sum parts.
- Tests per spec. Commit `Shop: send and remember mixed packs`.

## Task 3: Page

**Files:** `Weekday_Fuel.html`.

- Fingerprint uses all parts (`id:quantity` sorted) per store.
- Pack sheet: "Auto (cheapest mix)" row shows the mix buy text and total; single sizes as now.
- Check every other `line.product`/`line.quantity` read in the page (pantry check, product links, trolley result view, specials suggestion) behaves sensibly with parts.
- Suite + parse check + browser check (own free port): plan enough days that eggs or yoghurt mixes; Review shows "1 × 12 + 1 × 6"; sheet Auto/single size round trip. Commit `Shop Review: mixed packs`.

## Task 4: Release v0.27.0

- `versionCode 38 → 39`, `versionName "0.26.0" → "0.27.0"`; commit `Release v0.27.0: mixed pack sizes`; CI; confirm APK. Mark backlog item done.
