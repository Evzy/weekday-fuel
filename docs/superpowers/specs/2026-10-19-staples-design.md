# Daily staples (v0.16.0)

Evan, 2026-10-19: Dare and Grenade shouldn't be special. Any item can be a staple he has every day (or every weekday), set up from Today. First of three UI simplifications (staples, then the Shop as a cart, then a cleanup pass).

## Decisions (Evan)

- Any catalogue item can be a staple, with a daily amount in its unit.
- Each staple is "every day" or "weekdays"; Dare and Grenade start as weekdays, 1 each (today's behaviour).
- A staple can be skipped for a single day from a small chip row on Today.
- Staples are added, edited and removed from Today.
- Option 1: a staples list in settings (not auto-added meals).

## Data

- `settings.staples`: `[{ id, amount, days: "all" | "weekdays", from?, until? }]`, in display order. `id` is a catalogue item id; `amount` > 0 in the item's unit; optional `from` and `until` are local `YYYY-MM-DD` (inclusive). A staple applies on `date` only when `date` is within `[from, until]` (open-ended when omitted). The same `id` may appear more than once when date ranges do not overlap. Additive setting; when absent it defaults to `[{ id: "dare", amount: 1, days: "weekdays" }, { id: "grenade", amount: 1, days: "weekdays" }]` (no `from`, so from the beginning).
- **History-safe edits (do not rewrite the past):** adding a staple sets `from` to today; editing amount or schedule sets `until` to yesterday on the current entry and appends a new entry from today; removing sets `until` to yesterday (or deletes the entry if `from` is today or later). Kitchen stock, reserved and day totals for past dates use the staple list that applied on each date. Chips show one row per active `id` (no `until`, or `until` ≥ today; not yet started entries hidden).
- **On a day:** a staple is on for `date` when (`days === "all"`, or the date is a weekday, or the day is a weekend with `track: true`) and `day.fx[id] !== false`. `day.fx` keeps its shape and meaning (item id → on/off); `dayOf` stops writing default `fx` values (absent means "follow the staple"). Existing stored `fx` values keep working: weekday `true` = on, weekend `false` = off, an explicit `false` = skipped.
- `settings.fixtures`, `settings.fixtureDays` and `settings.readyMealPrice` stay in storage, unused.
- **Unit weights:** catalogue items measured in counted units get `unitSize` (grams, or mL for drinks) so macros can be computed from `MACROS` (per 100 g / 100 mL): dare 500, grenade 60, eggs 58, wraps 48, bread 45, muffin 67, rice (pouch) 250, plus any other counted-unit item (find them by `unit`; take sizes from the `MACROS` notes and `.cursor/rules/meals.mdc` label facts; ask Evan only if an item has no source). Items in g or mL need none.

## Pure module (`staples.js`, ES5, tested)

- `parse(list, cat)`: valid staples only (known item id, finite amount > 0, `days` one of the two values; optional valid `from`/`until`; drops overlapping ranges for the same `id`).
- `onDay(staple, date, day)`: false when `date` is before `from` or after `until`, then the schedule/`day.fx` rules above (`date` a local `YYYY-MM-DD`).
- `activeStaples(list, today)`, `applyAdd`, `applyEdit`, `applyRemove`: history-safe list mutations for the UI.
- `forDay(staples, date, day)` → `[{ id, amount }]` of staples on that day.
- `macros(id, amount, cat, MACROS)` → `{ k, p, c, f }` (amount × unitSize when counted, ÷ 100 × the per-100 values); `null` when the item has no macros.
- `cost(id, amount, cat, store)` → amount's share of the store's pack price (`amount / product.size × price`, or per kg for deli items), other store as fallback; `null` when neither store sells it.

## Where staples are used

- **Day totals (`totals`)**: add `macros` and `cost` of each staple on that day (replacing the `settings.fixtures` loop).
- **Today:** the Fixtures block becomes a "Staples" row of chips: each chip shows the item's short name, a tick when on, and its kcal; tap toggles `day.fx[id]` for that date (saving the day). A small edit button on each chip and a "+" chip open a sheet: item `<select>` (all catalogue items with macros), amount (in the item's unit), Every day / Weekdays, Save, and Remove (edit only). Saving updates `settings.staples`.
- **Shop:** `shopList`/`coveredList`'s second argument changes from a fixture day count to a staple need map `{ id: total }` (a number is still accepted and means "that many of every sec 0 item", for old callers and tests); the page builds the map as `amount × number of shop days where it's on`. Staple needs add to meal needs for the same item (e.g. daily yoghurt plus a yoghurt bowl). The "Dare + Grenade for how many days?" stepper is removed. With no shop days, no staples are in the shop.
- **Kitchen (`inventory.js`):** `stock()` and `reserved()` take a `staplesOn(date)` → `[{ id, amount }]` callback instead of `fixtureOn(date, key)`; each staple on a date uses its amount at local midnight (stock) / is reserved for dates from tomorrow to the day before the first shop day (reserved), as Dare and Grenade do now. Prune passes the same callback.
- **Planner:** day fitting uses the staples' macros via `totals` (no separate fixture kcal).
- **Targets:** remove the fixture editors and the ready-made price comparison panel. (The remake meals stay; their "compare to the shelf price" line goes.)

## Compatibility

- With default staples (Dare 1 and Grenade 1, weekdays) and existing data, day totals use the catalogue's label macros instead of `settings.fixtures` (296 vs 295 kcal for Dare, 244 vs 244 for Grenade) and the catalogue price instead of the typed fixture price. Everything else (shop quantities for shop days, Kitchen stock, reserved) matches today when the shop's fixture day count equals its number of weekday shop days.
- No localStorage key changes shape.

## Testing

- `staples.test.js` (CI list): parse, onDay (weekday, weekend, tracked weekend, skipped, "all"), forDay, macros for g/mL and counted items, cost (both stores, fallback, deli), unknown items.
- `inventory.test.js`: staples callback with amounts > 1 and a non-fixture staple (e.g. 170 g yog daily); existing fixture tests adapted.
- `catalogue`/shop tests: staple needs per shop day; no shop days → no staples.
- Browser check at phone width: chip row, toggle, add/edit/remove sheet, totals update.

## Owner checks

Today shows Dare and Grenade as chips with the same day totals as before (within a few kcal); add yoghurt as a daily staple and see it in totals, the Shop and the Kitchen; skip Dare on one day.
