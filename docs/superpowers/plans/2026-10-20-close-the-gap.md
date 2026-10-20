# v0.26.0: Close the gap on Today — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

Spec: `docs/superpowers/specs/2026-10-20-close-the-gap-design.md`.

**Goal:** When today can't hit target by portions alone, Today offers spare snacks, a spread over the rest of the week, or bringing a bought meal forward, each with preview and undo.

**Architecture:** Pure suggestion maths in a new `gap.js`; `inventory.js` learns extras `uses`; the page gets a date-aware `target(date)`, a Today shortfall line, a sheet, apply/undo, and a Week label.

**Tech stack:** Vanilla JS in an Android WebView; UMD modules beside `Weekday_Fuel.html`; `node --test`.

## Global constraints

- Commit to `main` by explicit path; never stage the CRLF-only modified files; never `git stash` / `git clean` / `git reset --hard`. CI green before the next task; version bump only in the release task.
- Escape meal/catalogue/store strings with `esc`. Edit the HTML with file edit tools (UTF-8, no BOM).
- Existing localStorage shapes unchanged; `extras[].uses` and `day.adj` are additive and optional. Meal ids and figures unchanged.
- New test files must be added to the explicit test list in `.github/workflows/release-android.yml` (line ~53) and new asset scripts loaded by the HTML like the other modules.
- Tests: `node --test "apps/android/app/src/test/js/*.test.js"`; HTML parse check on the last `<script>`.

---

## Task 1: `gap.js` suggestion maths

**Files:** Create `apps/android/app/src/main/assets/weekday_fuel/gap.js`, `apps/android/app/src/test/js/gap.test.js`; modify the workflow test list.

**Produces (global `WeekdayFuelGap` / `module.exports`):**
- `SNACKS`: array of `{id, label, items: [{id, amount}]}` exactly as the spec table.
- `snackMacros(snack, macrosFor)` → `{k, p}`; `macrosFor(itemId, amount)` returns `{k, p}` or null (snack skipped if any null).
- `snackOptions({free, macrosFor, total, target, limit})` → up to `limit` (default 3) `[{snack, k, p, after: {k, p}, score}]`, only snacks whose every item has `free[id] >= amount`, sorted by `score = |after.k − target.k| + max(0, target.p − after.p) * 12`, and only those whose score beats the current score.
- `spreadSplit(gapK, dates)` → `[{date, k}]`: even split of a signed integer gap, remainder (same sign) on the first date; `[]` when no dates.
- `forwardCandidates({today, weekEnd, days, isBought, isEaten})` → `[{date, index, meal}]` for bought, not-eaten meals on dates `> today` and `<= weekEnd`, in date then index order.

Steps: write tests first (each function, edge cases: empty free, missing macros, negative gap split, remainder sign, candidates exclude unbought/eaten/past/next week), see them fail, implement, all tests pass, commit `gap.js`, `gap.test.js`, workflow: `Close the gap: suggestion maths`.

## Task 2: Extras `uses` in stock, and per-day target offset

**Files:** Modify `inventory.js` (`stock`), `inventory.test.js`; `Weekday_Fuel.html` (`target`, callers).

- `stock`: for each day with `extras`, each extra with a valid `uses` array (`id` string, `amount` > 0) adds `use` actions at `endOfDay(date)` when that is ≤ now and ≥ inventory start. Tests: consumed after end of day, not before; invalid `uses` entries ignored; extras without `uses` unchanged.
- Page: `target(date)` → base plus `state.days[date]?.adj?.k` when finite. Pass the date in `dayPip`, `fitTiers` (it has `date`), `renderToday`, Week tiles/panels and `weekTally` paths that compare against target. Leave dateless callers (setup card, plan sheet) on the base.
- Week day panel: after "/ {target} kcal" show ` · +57 from Tue` (or `−40 from Tue`) when `adj.k` is non-zero (`dayShort(adj.from)`).
- Full suite + parse check. Commit: `Close the gap: extras use stock; per-day target offset`.

## Task 3: Today line, sheet, apply and undo

**Files:** Modify `Weekday_Fuel.html`; load `gap.js` like the other modules.

- **Line** under Today's bars when tracked, has meals, editable, and `|t.k − tg.k| > 100`: "{n} kcal short even at Loaded · [Close the gap]" when every unfixed meal is `X`, else "{n} kcal short · [Close the gap]"; surplus wording "over" / "Light". (Fit portions button stays.)
- **Sheet** `state.sheet = "gap"`: sections in order, each hidden when empty:
  - Shortfall: "Spare at home" (`snackOptions` with `free` from `WeekdayFuelInventory.free(stock, reserved)` as the Kitchen view computes it); "Spread over the week" (one row: "Make up {n} kcal over {Wed–Fri} (+{x} a day)", offered per spec rule: simulate on clones, refit with `fitTiers(...,{bought:true})`, accept when summed |shortfall| < half the gap); "Bring a meal forward" (from `forwardCandidates`, simulate on clones, keep those improving today, best 2, row "Have {Thu}'s {meal name} today → Today {k} · {Thu} {k}").
  - Surplus: "Skip a staple" rows for each staple on today (simulate toggle on a clone + refit), and the spread row with negative split. No forward.
- **Apply** (`data-act="gapapply"` with `data-v` = option index into `state.gapOptions` built at render): snapshot `{date: clone(day)}` for every day it touches into `state.gapUndo`, then apply: snack → push extra `{n: label, k, p, uses}`; spread → add `adj` to each date (sum `k`, set `from` = today) and `fitTiers(day,0,date,{bought:true})`; forward → splice meal from source, push to today with `slot: "Extra"`, refit both; skip staple → existing toggle + refit. `saveDay` each; close sheet; `state.todayNote = "{what was done}"` with an **Undo** button (`gapundo`) that restores the snapshots and saves.
- `state.gapUndo` clears on the next non-gap action (like `todayNote`).
- Escape all labels. Full suite + parse check. Browser check per spec (own server on a free port, stop it). Commit: `Close the gap: Today sheet with spare snacks, spread and bring forward`.

## Task 4: Release v0.26.0

- `build.gradle.kts`: `versionCode = 37` → `38`, `versionName = "0.25.0"` → `"0.26.0"`; commit `Release v0.26.0: close the gap`; push; CI; confirm `WeekdayFuel-v0.26.0-debug.apk`. Mark the backlog item done in `docs/backlog.md`.
