# Plans (preset weeks on the Meals tab)

Date: 2026-10-19. Status: approved design.

## Goal

The fastest way to start eating: pick a ready-made week on the Meals tab, choose a start day, and have the meals land on real days. This replaces the Shop's "starter shop", whose undated picks are going away with the cart redesign.

## Decisions (owner)

- A plan is a **fixed, hand-picked menu**. It's the same meals every time; portions are fitted to the targets when applied. Rule-based plans (such as a cheapest week from live prices) are out of scope.
- **Applying fills, never replaces.** Pick a start day; empty slots get the plan's meal, and any slot that already has a meal keeps it. Bought meals are never touched.
- **First set: one plan, "Fewest items".** More plans later are data-only additions.
- "Suggest my week" and "Suggest a day" **stay on Today**. Today's empty state links to Plans.

## The Fewest items plan

It grows the old starter (toasty, chicken tender wraps, chicken burrito bowl, buffalo chicken mac) into 5 weekdays. All four meals share most of their ingredients.

| Day | Breakfast | Lunch | Dinner |
| --- | --- | --- | --- |
| 1 | toasty | tenderwrap | buffalomac |
| 2 | toasty | burritobowl | buffalomac |
| 3 | toasty | tenderwrap | burritobowl |
| 4 | toasty | burritobowl | buffalomac |
| 5 | toasty | tenderwrap | burritobowl |

Blurb: "4 meals that share their ingredients, so the shopping list is as short as it gets."

## UI

**Meals tab.** A "Plans" panel sits at the top, above batch prep. Each plan is a card showing:
- the name and blurb;
- "N items · about $X a day · 5 weekdays", where N is the number of distinct catalogue items across the plan's meals at Standard portions (staples excluded), and $X is the plan's cost at the selected store's usual prices divided by its days.

**Plan sheet.** Tapping a card opens a sheet with:
- the day-by-day menu, labelled with the real dates for the chosen start day;
- a start-day picker: a strip of the next 14 days with weekends dimmed. Weekends can't be picked, because the plan fills weekdays. The default is the first weekday from today whose breakfast, lunch and dinner are all empty, or else the next weekday;
- an "Add to my days" button.

**After applying.** The sheet closes and Today opens on the start day, with a note: "Added N meals, Mon 20 – Fri 24." When meals were kept, the note adds "Kept M you'd already planned." If nothing was added, the note says "Those days are already planned. Nothing changed."

**Today.** When the viewed day has no meals, the empty state adds a "Start with a plan" button that opens the Meals tab.

**Shop.** The starter shop hint, its button, the `STARTER` constant and the `starter` action are removed. An existing `settings.trial` keeps working unchanged.

## Applying a plan

Given a plan with K days and a start date:
1. **Dates.** Take the first K weekdays (Mon–Fri) on or after the start date.
2. **Fill.** For plan day i (date dᵢ) and each slot of breakfast, lunch and dinner:
   - If the day already has any meal in that slot, keep it and count it as kept.
   - Otherwise add `{id, slot, t:"S"}` and count it as added.
   - Slot names match the existing day meals (breakfast, lunch, dinner). Other existing meals, such as snacks, stay as they are.
3. **Fit.** For each date that got at least one meal, run the existing `fitTiers` with the pre-existing meals locked, so only the added meals' portions change.
4. **Shop days.** Each date that got a meal becomes a shop day, as with `suggestWeek`.
5. **Save.** Save each changed day, save the settings, reset `shopCtx`, show the note, and render.

Dates with no added meals aren't saved or marked as shop days.

## Module

`apps/android/app/src/main/assets/weekday_fuel/plans.js` exposes `window.WeekdayFuelPlans` (and `module.exports` for tests), following the pattern of `staples.js` and `bought.js`. All functions are pure:
- `PLANS`: an array of `{id, name, blurb, days:[{breakfast, lunch, dinner}]}`.
- `weekdaysFrom(startIso, n)` returns n ISO weekday dates on or after the start.
- `defaultStart(todayIso, daysMap)` returns the first weekday from today with breakfast, lunch and dinner all empty, searching 14 days. If there is none, it returns the first weekday on or after today.
- `fill(plan, startIso, daysMap)` returns `{dates, changes:{[iso]:{meals, added:[...]}} , added, kept}`. Each entry's `meals` is the day's new meal list sorted in slot order, and `added` lists the slots that were filled. It doesn't fit portions or write anything.
- `byId(id)`, `isWeekend(iso)` and `mealCounts(plan)`, which returns `{[mealId]: serves}`.
- `summary(plan, shopFn)` returns `{items, costPerDay}`. `shopFn(counts)` returns `{items, total}`: the HTML passes a function that builds a shop list from the counts and totals it at the selected store.

The HTML handles the sheet, the calls to `fitTiers` and saving.

## Tests (`plans.test.js`, added to the CI test list)

- Every plan meal id exists in `meals.js`, and its slots allow the plan slot: breakfast meals for breakfast, main meals for lunch and dinner.
- Every plan day has breakfast, lunch and dinner.
- `weekdaysFrom` skips weekends and works across month ends.
- `defaultStart` skips partly planned days and falls back when everything is planned.
- `fill`:
  - fills empty days;
  - keeps an existing slot, including a bought meal;
  - leaves snacks untouched;
  - doesn't change a fully planned day (no entry in `changes`);
  - gets the added and kept counts right.
- `summary` counts distinct items and divides the cost by the plan's days.

## Out of scope

- Rule-based or generated plans; generation stays on Today.
- Single-day presets, and weekend plans.
- Plans editable by the user.
- Cart redesign changes beyond removing the starter shop.
