# Close the gap on Today — design

Date: 2026-10-20. Approved by Evan in chat. Backlog item "Today: close the gap when portions can't" (`docs/backlog.md`).

## Problem

Skipping or adding a staple on Today refits portions, but when every remaining meal is already Loaded (or Light) the day stays off target, and the app only says "Portions refit".

## Behaviour

**Trigger.** After today's portions are fitted, if today's kcal is more than 100 off target (`|total − target| > 100`), Today shows under the bars: "170 kcal short even at Loaded · Close the gap" (or "210 kcal over even at Light · Close the gap"). Shown whether or not a refit just happened. Not shown on past days, untracked days or days with no meals.

**Sheet.** "Close the gap" opens a sheet of suggestions. Each row shows the effect on today ("→ 2480 kcal · 205g protein"). Nothing changes until a row is tapped. Applying leaves a note on Today with **Undo**, which restores the exact previous state of every day and the stock link it changed.

### Shortfall suggestions

1. **Spare snack.** Fixed list (`SNACKS` in `gap.js`):

   | id | Label | Items |
   | --- | --- | --- |
   | grenade | Grenade bar | grenade 1 |
   | dare | Dare iced coffee | dare 1 |
   | yog-honey | Yoghurt + honey | yog 200, honey 15 |
   | eggs2 | 2 boiled eggs | eggs 2 |
   | ham-cheese | Ham & cheese | ham 50, cheese 30 |
   | yog-berry | Yoghurt + berries | yog 200, fzberry 100 |

   A snack is offered only when every item is spare (free stock ≥ amount; free = stock − reserved, via `WeekdayFuelInventory.free`). Macros come from the catalogue `MACROS` per item. Ordered by how close today ends up to target (protein shortfall weighted as in `fitTiers`), best 3 shown. Applying adds a today extra `{n, k, p, uses: [{id, amount}]}`.
2. **Spread over the rest of the week.** Remaining planned, tracked days after today up to Sunday of this week (Mon–Sun week). Split the gap evenly (rounded to whole kcal, remainder on the first day). Offered only when at least one such day exists and, after refitting each with its new target, the summed shortfall of those days is less than half the original gap. Applying sets `day.adj = {k: +n, from: "<today>"}` on each (adding to any existing `adj.k`), then refits those days with bought meals allowed. Week shows "/ 2557 kcal · +57 from Tue".
3. **Bring a meal forward.** Candidates: bought meals on tracked days after today up to Sunday, not eaten. For each, simulate moving it to today (appended, slot "Extra"), refitting today, and refitting the source day. Offered when today ends closer to target than it is now; best 2 by today's result. Preview shows both days ("Today 2480 · Thu 2050"). Applying moves the meal object (its `bought` value kept) and refits both days.

### Surplus suggestions (over target with everything Light)

- **Skip a staple today** for each staple on today (uses the existing toggle), ordered by closeness.
- **Spread the surplus**: as above with negative `adj.k`.
- No bring-forward.

## Data (additive, optional)

- `day.extras[i].uses?: [{id, amount}]` — the stock model (`inventory.js` `stock`) consumes these at the end of that day like eaten meals (only for past days, or today once the day ends). Extras without `uses` behave as now.
- `day.adj?: {k: number, from: "YYYY-MM-DD"}` — per-day kcal target offset. `target(date)` returns `{k: base + (adj.k || 0), p}` when given a date; callers that have a date pass it (`dayPip`, `fitTiers`, Today, Week tiles/panels). `from` is display only; spreads from different days add up and keep the latest `from`.
- No new localStorage keys. Backup/restore carries both because they live in days.

## Units

- `gap.js` (pure, UMD like the other modules): `snackOptions({free, macros, gap, base, target})`, `spreadPlan({gapK, days})`, `forwardCandidates({today, days, isBought, eaten})`, `SNACKS`. No DOM.
- Page: target(date), the Today line and sheet, apply/undo, Week "+n from" label.
- `inventory.js`: `uses` consumption in `stock`.

## Testing

- `gap.test.js`: snack filtering by free stock and ordering; spread split and remainder; spread rejected when later days can't absorb; forward candidates (bought only, this week only, not eaten); surplus case.
- `inventory.test.js`: extras `uses` consumed at end of day, not before; extras without `uses` ignored.
- Browser check: plan a week, skip the Dare on Today, see the shortfall line, apply each suggestion type and undo.

## Release

v0.26.0.
