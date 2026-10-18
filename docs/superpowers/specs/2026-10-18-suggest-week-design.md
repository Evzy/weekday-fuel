# Suggest my week: design

**Status:** approved 2026-10-18; v0.10.0 released 2026-10-18, owner phone checks pending

## Goal

One tap plans the working week so the meals share ingredients, the Sunday chicken gets used, and the shop is small and cheap — the "cook once, little to no prep" idea from the meal library, applied to planning. Today "Suggest a day" picks a breakfast and two mains at random (avoiding yesterday) and fits the portions; it ignores what the rest of the week buys.

Single user (the owner). Everything stays on the phone.

## Decisions

| Topic | Decision |
| --- | --- |
| Scope | A new **Suggest my week** button plans Mon–Fri together. "Suggest a day" and Swap stay as they are. |
| Which days | The weekdays of the week being viewed, from today on; past days are never changed. If none are left (e.g. viewing this week on a Saturday or Sunday), the button reads **Suggest next week** and plans next Mon–Fri. Weekend days are never planned. |
| Already-planned meals | Kept exactly, portions included. Only empty breakfast, lunch and dinner slots are filled. A day with all three is left alone. Snacks are neither added nor touched. |
| Lunch | Every filled lunch is a batch-chicken meal (a meal whose `batch` includes `chicken`: tender wraps, burrito bowl, fried rice today), so a Mon–Fri plan uses the 5 Sunday portions. |
| Breakfast and dinner pools | Breakfast: meals with the `breakfast` slot except the yoghurt bowl (as "Suggest a day" today). Dinner: meals with the `main` slot that don't use the chicken batch, so batch portions aren't spent at dinner. |
| Variety | A meal appears at most twice in the Mon–Fri week and never on two days in a row. Kept meals and meals on earlier days of the same week count. |
| Portions | Each day's newly added meals get portions fitted to the day's calorie and protein target (the existing `fitTiers` search, with kept meals' portions fixed). |
| Choosing the week | Generate about 2,000 random weeks that satisfy the rules, fit portions, and score each by its real shop: whole-pack cost at the chosen store plus a penalty for fresh food left over. Pick at random among the weeks within 3% of the best score, so repeated taps give different good weeks. |
| When rules can't be met | Relax "not two days in a row" first, then "at most twice"; the pools never run dry, so a plan always comes back. |
| Shop | All planned days are added to the shop (as the In shop toggle does). |
| Feedback | "Planning your week…" while it runs, then a one-line note under the button: "Planned Mon 19–Fri 23: 8 different meals, about $170 of groceries at Coles. The days are in your shop." (the week's meals only, not fixtures or other shop items). It clears on the next action. If every day to plan already has a breakfast, lunch and dinner, nothing changes and the note says to remove the meals to replace, then tap again. |

## Components

1. **`assets/weekday_fuel/planner.js` (new, pure: no DOM or storage).** `module.exports` under Node, `window.WeekdayFuelPlanner` in the page.
   - `weekDays(viewDate, today)` → the ISO dates to plan (rules above) and whether it's next week.
   - `planWeek(opts)` → `{days: {[date]: meals[]}, score, distinct}`. `opts`:
     - `dates`: the dates to plan; `before`: `{[date]: meals[]}` for earlier days of the same week (count towards variety, never changed);
     - `kept`: `{[date]: meals[]}` existing meals per planned date (`{id, slot, t, ...}`, returned unchanged, same objects);
     - `meals`: `MEALS`; `pools`: `{breakfast: ids, lunch: ids, dinner: ids}`;
     - `fit(date, meals, lockedCount)`: sets `t` on meals after the first `lockedCount` (the page wraps `fitTiers` with the day's target);
     - `score(dayMeals)`: number, lower is better (the page passes the shop scorer below);
     - `rng`: `() => [0, 1)` (default `Math.random`); `tries` (default 2000); `near` (default 0.03).
   - `shopScore(cat, dayMeals, store, opts)` → whole-pack cost for `cat.shopList({}, 0, dayMeals)` at `store` (falling back to the other store's product as the shop does) + `waste`: for fresh items (`sec` 1), the unused fraction of the last pack × that pack's price. Uses only catalogue data.
   - New meals are `{id, slot, t}` with `t` set by `fit`.
2. **`catalogue.js`:** if `shopScore` needs pack maths the catalogue already does for shop rows (packs to buy, pack price), expose it rather than duplicating it.
3. **`Weekday_Fuel.html`:**
   - Load `<script src="planner.js">`.
   - Today: a **Suggest my week** / **Suggest next week** button beside "Suggest a day" on weekdays and on weekends.
   - The action builds `opts` from state (kept meals per date, earlier weekdays, pools from `MEALS`, `fit` via a `fitTiers` variant that leaves locked meals' portions alone, the chosen store), saves each planned day, adds the dates to `shopDays`, shows the note, and moves the view to the first planned day.
   - `fitTiers(day, locked = 0)`: the first `locked` meals keep their `t`; existing callers are unchanged (`locked` 0).

## Testing

- `planner.test.js` with a fixed-seed `rng` and a small fixture catalogue and meals:
  - every rule: at most twice, never consecutive (across `before` and `kept`), lunch from the batch pool, kept meals and portions untouched and in place, only empty slots filled, past dates not in the plan;
  - `weekDays` for a weekday, a Friday, a Saturday and a Sunday, and viewing a past or future week;
  - `shopScore`: a week sharing one pack scores below a week buying two different packs; fresh leftovers add waste; a store-missing product uses the other store;
  - relaxing rules when kept meals make them impossible;
  - the choice comes from the near-best set (with a seeded rng the result is deterministic).
- Real-data test: a planned week from the real `MEALS`/catalogue satisfies the rules and scores no worse than the median of random valid weeks.
- Controller browser check: the button plans Mon–Fri, keeps a pre-planned meal and its portion, lunches are batch chicken, the shop shows the days, the note shows, a second tap on a full week changes nothing and says so, and after clearing the days a tap gives a different week; compare the shop total with five "Suggest a day" taps.
- Owner phone check: Sunday night, Suggest next week, look over the week and the shop, send the trolley.

## Out of scope

Overlap-aware "Suggest a day" and Swap, snacks, the kitchen inventory (see `2026-10-18-inventory-idea.md`), Build a shop picks, and planning weekends.
