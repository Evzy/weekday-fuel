# Weigh-in trend on Today — design

Date: 2026-10-21. Builds on the existing weekly verdict (`verdict()` in `Weekday_Fuel.html`, shown only on the hidden Weigh view with an "Apply ±150 kcal to weekdays" button). Choices (chat): surface the suggestion on Today; suggest and tap, not automatic; after applying, hold the suggestion until 7 days have passed; offer to re-fit planned days, including bought meals.

## Pace rules

This week's 7-day average vs the 7 days before it, each needing at least 3 weigh-ins. With `MODES` as today, evaluated in order:

- **bulk** and 0 ≤ delta < 0.1 → +150, "Not gaining yet" (runs first; otherwise bulk `lo` = 0.1 labels a small gain "Dropping faster than planned");
- delta below `mode.lo` → +150, "Dropping faster than planned";
- **cut** and delta > 0 → −150, "Trending up";
- **cut** and −0.25 < delta ≤ 0 → −150, "Cut has stalled" (must run after **cut** delta > 0 and before `delta > mode.hi`; the earlier single rule "cut and delta > −0.25" made "Cut has stalled" unreachable for any gain);
- delta above `mode.hi` → −150, "Gaining faster than planned" (bulk) or "Trending up" (recomp);
- otherwise on track, no change.

The body text keeps its current wording.

## trend.js (new, pure)

`WeekdayFuelTrend` (browser global and CommonJS export, like `gap.js`), no DOM or storage:

- `verdict(weights, today, modeKey, modes, changed)` → `{state, head, body, adj, delta, hold}`. `weights` is the `state.weights` map; `changed` is `{at, by}` or null. Moves the logic of the current `verdict()`, including its 7-day window averaging.
- **Hold:** when `changed.at` is set and `today < addDays(changed.at, 7)`, an `adj` of 0 is returned with `hold: {at, by, next}` (`next` = `changed.at + 7` days). `head` and `body` still describe the trend; `body` ends "Changed {±by} kcal on {day}; next check from {day}." in place of the suggestion sentence.
- Dates are ISO `YYYY-MM-DD` strings; day labels are passed in through a `fmtDay` option so the module needs no locale code.

`Weekday_Fuel.html`'s `verdict()` becomes a thin wrapper passing `state.weights`, today, `S().mode`, `MODES` and `S().adjustChange`.

## Settings

Additive optional field `settings.adjustChange = {at: "YYYY-MM-DD", by: ±150}`, written when a suggestion is applied. `adjust` keeps its meaning. Typing a new value in Targets' "Weekday adjustment" field doesn't set or clear `adjustChange`.

## Today

- Under the weigh-in box, when `verdict().adj` is not 0: a one-line panel "{head}. 7-day average {cur} kg vs {prev} kg. {Raise|Drop} weekdays 150 kcal?" with **Apply** (`data-act="trendapply"`) and **Details** (opens the Weigh view). Nothing extra when there's no suggestion or during a hold.
- Shown only for today's date on Today (not past days).

## Apply (Today and Weigh view share one handler)

1. `settings.adjust += adj`; `settings.adjustChange = {at: today, by: adj}`; `saveSettings()`.
2. Count re-fit candidates: dates from today on where `dayHasMeals` and the day is editable (today only when `dayEditable(today)`).
3. If there are any, set `state.trendRefit = {k: newTarget, n}` and show, in place of the suggestion panel (Today) or the button (Weigh view): "Target is now {k} kcal. Re-fit portions on 1 planned day?" or "... on {n} planned days?" with **Re-fit** and **Not now**. With no candidates, show "Target is now {k} kcal." once.

The Weigh view's existing **Apply** button uses the same handler; during a hold it shows the hold sentence instead of the button.

## Re-fit

For each candidate date: `fitTiers(day, 0, date, {bought: true})`, the same call as `todayFit`. Eaten meals stay fixed through `mealImpliedAte`; bought meals are re-fitted. Save each changed day. The note becomes "Re-fitted {changed} of 1 day." / "of {n} days." (or "Portions already fit." when none changed), on `state.trendNote`, cleared on the next tab switch like other notes. If the new portions need more food than was bought, the existing gap line and Shop top-up show it; this feature adds no shop logic.

## Out of scope

Undo or history of changes; changing the phase targets; past days' targets.

## Testing

- `trend.test.js` (added to the workflow's explicit list): each pace rule; fewer than 3 weigh-ins in either week → wait; hold active for 6 days after `at` and cleared on day 7; hold body wording; on-track during a hold still says on track.
- Browser check without host: seed weights for a stalled cut → Today shows the panel; Apply moves the Targets "Now" figure by −150 and shows the re-fit prompt; Re-fit changes a planned day's tiers and shows the note; the panel stays hidden the next day (stub date) and returns 7 days after.

## Release

v0.28.0.
