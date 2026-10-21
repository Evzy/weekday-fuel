# v0.28.0: Weigh-in trend on Today — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

Spec: `docs/superpowers/specs/2026-10-21-weigh-in-trend-design.md`.

**Goal:** The weekly pace suggestion shows on Today, applies with one tap, holds for 7 days after a change, and offers to re-fit planned days.

**Architecture:** New pure module `trend.js` (`WeekdayFuelTrend`, like `gap.js`) owns the verdict and hold; the page wraps it and adds the Today panel, shared apply handler and re-fit.

## Global constraints

- Commit to `main` by explicit path; never stage CRLF-only modified files this plan doesn't edit (confirm with `git diff --cached --stat`). Never `git stash` / `git clean` / `git reset --hard`.
- CI green before the next task; version bump only in the release task. Escape strings with `esc`. HTML via file edit tools, UTF-8 without BOM.
- `settings.adjustChange` is additive and optional; `adjust` keeps its meaning.
- Tests: `node --test "apps/android/app/src/test/js/*.test.js"`; HTML parse check (last `<script>` through `node --check`).
- Only stop servers you started.

---

## Task 1: `trend.js`

**Files:** `apps/android/app/src/main/assets/weekday_fuel/trend.js` (new), `apps/android/app/src/test/js/trend.test.js` (new), `.github/workflows/release-android.yml` (add `trend.test.js` to the explicit list), `Weekday_Fuel.html` (`<script src="trend.js"></script>` next to `gap.js`; `verdict()` becomes a wrapper).

- Tests first per the spec's Testing list for `trend.test.js`, including that the non-hold results match today's `verdict()` heads, bodies and `adj` for each rule.
- Implement `verdict(weights, today, modeKey, modes, changed, opts)` with `opts.fmtDay`. Keep `weightSeries`/`avgWindow` in the page for the chart and table, or have them call module helpers; behaviour unchanged.
- Page `verdict()` passes `state.weights`, `iso(new Date())`, `S().mode`, `MODES`, `S().adjustChange || null`, `{fmtDay}`.
- Commit `Weigh-in: trend module with a 7-day hold`.

## Task 2: Today panel, apply, re-fit

**Files:** `Weekday_Fuel.html`.

- Today panel under `renderTodayWeighBox` per spec (today's date only).
- One `trendapply` handler for Today and the Weigh view (replace `applyadj`'s body or route it through the same function): sets `adjust`, `adjustChange`, saves, computes candidates, sets `state.trendRefit`.
- Re-fit prompt and `trendrefit` / `trendrefitno` handlers; re-fit loops candidate dates with `fitTiers(d,0,date,{bought:true})`, saves changed days (`saveDay` or the existing save path used by `todayFit`), sets the note.
- Weigh view: hold sentence instead of the button during a hold.
- Clear `state.trendRefit` on tab switch like other notes.
- Suite + parse check + browser check (own free port, no host) per spec. Commit `Today: weigh-in trend suggestion and re-fit`.

## Task 3: Release v0.28.0

- `versionCode 42 → 43`, `versionName "0.27.3" → "0.28.0"`; commit `Release v0.28.0: weigh-in trend on Today`; CI; confirm APK in `Evzy/weekday-fuel-releases`.
