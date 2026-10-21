# Add to a day: stay open, choose what to replace — design

Date: 2026-10-21. From Evan: adding a meal from Meals closes the sheet after one day, and the replace prompt only offers the first slot. Approved in chat.

## Stay open

- Meals "Add to a day" sheet (`state.sheet = "add:<id>"`, opened by `addmeal`): after a day is added (directly or through the replace/extra prompt), the sheet stays open. That day's row shows a tick and "Added {slot}" (several adds list each, e.g. "Added lunch, dinner"). Tapping the day again adds again (same placement rules).
- The sheet header gets a **Done** button (the existing Close). Closing clears the session's ticks.
- The day note (`state.dayNote`) and Week scroll are set for the last day added when the sheet closes, not on each add.
- Week's "+" flow (`weekaddopen` → `weekaddpick`, a single fixed date) keeps closing after the add, as now.

## Choose what to replace

`WeekdayFuelCartAdd.place` keeps its result shape and adds `options`: for a main meal when the natural slot is taken, every lunch and dinner meal on the day that isn't bought or eaten, as `{slot, existing}` in day order; for a breakfast, the unlocked breakfast(s). The prompt shows one button per option, "Replace {slot} ({meal name})", then "Add as an extra". When every candidate is locked, the existing "is bought. Add as an extra?" prompt stays.

`apply(dayMeals, mealId, slot, "replace", …)` replaces the first unlocked meal in the chosen slot (already its behaviour); the page passes the chosen option's slot. The added meal takes that slot.

Applies to both the Meals sheet and Week's "+" flow.

## Testing

- `cartadd.test.js`: `options` for lunch+dinner taken (both offered, order), one locked (only the other offered), both locked (`locked`), breakfast case, snack unaffected.
- Browser check: add a meal to three days without the sheet closing (ticks shown); a day with lunch and dinner shows both replace buttons and replacing dinner keeps lunch.

## Release

v0.29.1.
