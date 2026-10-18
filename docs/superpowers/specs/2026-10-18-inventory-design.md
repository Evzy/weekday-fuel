# Kitchen inventory (v0.13.0 and v0.14.0)

Evan, 2026-10-18: keep a running count of the food at home so meals use it up and the shop only buys what's missing. Builds on `2026-10-18-inventory-idea.md`.

## Decisions (Evan)

- A planned meal uses its ingredients only when ticked "Ate it". Meals from earlier days left unticked are asked about: "Did you eat these?" with "Yes, all" and per-meal Ate it / Skipped.
- Food comes in from a saved order automatically, plus manual add and adjust.
- Fresh items carry a rough use-within and get flagged.
- The shop buys only what planned meals need beyond what's at home.
- "Already had" ticks and the pantry check stay.
- Dare and Grenade are tracked and use one of each per weekday automatically.
- Stored as a history of changes, so undo is exact.
- A new Kitchen tab.
- Tracking starts from the next saved order (or the first manual add); nothing is loaded from past orders.

## Release 1 (v0.13.0): tracking, meal ticks, Kitchen tab

### Storage

New key `weekdayfuel.inventory`: `{ v: 1, start: ISO time, events: [...] }`, created by the first stock-in or manual add. Event kinds:

- `{ id, at, k: "buy", item, amount, order }`: from a saved order (`order` = the order id).
- `{ id, at, k: "add", item, amount }`: manual add.
- `{ id, at, k: "set", item, amount, why: "count" | "used" | "toss" }`: Set amount, Used it all (0), Threw it out (0).

`id` is unique (time plus a counter); `amount` is a positive number in the item's catalogue unit (g, mL, eggs, slices, pouches, wraps, …; `set` may be 0). Events are kept for 120 days after `at`, except that the latest `set` per item and every `buy`/`add` newer than it are always kept. Invalid events are dropped when read.

A planned meal in `days` gets an optional `ate`: an ISO time when ticked, or `false` when marked skipped. Absent means not answered. This is additive; existing fields keep their shape and old data simply has no `ate`.

### Stock maths (`inventory.js`, pure, with tests)

`stock(inv, days, cat, now)` returns per item `{ amount, lots: [{ at, amount }], useSoon, off }`:

- Changes are applied in time order:
  - a `buy` or `add` adds a lot;
  - a ticked meal (`ate` time ≥ `start`) subtracts its amounts at its portion (`cat.amountFor`), oldest lots first;
  - each weekday from the start date up to and including today uses one `dare` and one `grenade`, at the start of that day;
  - a `set` keeps the newest lots totalling the new amount (the oldest are assumed used) or, when it's higher than the stock, adds a lot dated now for the difference.
- Amounts never go below 0; a use with nothing in stock is ignored.
- Fresh items get `keeps` (days) in the catalogue:

  | Item | Keeps (days) |
  | --- | --- |
  | breast, mince, thigh | 3 |
  | spinach | 4 |
  | ham | 5 |
  | bread, muffin | 5 |
  | toms, cucumber, capsicum | 7 |
  | yog | 14 |
  | wraps | 14 |
  | cheese | 21 |
  | eggs | 28 |

  A lot is `useSoon` when it's within 1 day of `keeps` (or past half of it for keeps ≤ 3) and `off` once older than `keeps`. Items without `keeps` (pantry, frozen, fixtures) never get flagged.
- `pending(days, inv, today)` lists planned meals on days from the start date to yesterday whose `ate` is absent.

### Stock in from orders

When "Save order and start next shop" saves an order, every shop row is added as a `buy` except:

- rows ticked "already had";
- pantry rows marked "I have it";
- rows with no product at either store.

The amount is what that row buys at the order's store (or the other store when the row is missed there): `quantity × product.size`, or `quantity × 1000` g for a deli line. Deleting a saved order in Past orders removes its `buy` events.

### Screens

- **Today:** each planned meal gets an "Ate it" toggle (sets `ate` to now, or removes it). When `pending` isn't empty, a card at the top says "Did you eat these?", lists them by day, and offers "Yes, all" (each `ate` = end of its day) plus a per-meal Ate it / Skipped.
- **Kitchen tab** (sixth tab, after Shop), in sections:
  1. **Use soon:** lots flagged use soon or off, with "bought Sat · use by Tue" or "probably off". Raw chicken adds "or freeze it".
  2. **Fridge:** sec 1 items.
  3. **Cupboard and freezer:** sec 2 items.
  4. **Daily:** Dare and Grenade.

  Only items with stock are listed. Tapping an item opens Used it all / Threw it out / Set amount (a number field in the item's unit). "Add food" picks a catalogue item and an amount. An empty Kitchen explains that stock starts with the next saved order and offers Add food. All names and amounts are escaped with `esc`.

## Release 2 (v0.14.0): the shop uses the stock

- `shopList` takes an optional `have` map `{ item: amount }`. Each row keeps `need` (what the meals and fixtures need) and gains `have` (`min(have, need)`). Store lines are worked out for `need − have`.
- A row where `need − have ≤ 0` is `covered`: it has no store lines. Covered rows are left out of totals, trolley lines, Missed lists and the planner's `shopScore`, and are shown under "Covered by what you have".
- `have` is the stock minus what's reserved:
  - meals planned on days from the start date up to the day before the first shop day that aren't ticked or skipped (and aren't in the shop's days);
  - one Dare and one Grenade per weekday from tomorrow to the day before the first shop day.

  With no shop days, nothing is reserved beyond pending past meals.
- Partly covered rows show "need 400g · have 250g · buy 1 × 500g".
- A saved order lists covered rows under "Already had" with the note "covered by what you have". They are not stocked in again.
- **Ticks and pantry check:** they stay for things the inventory doesn't know about. Covered rows don't appear in either.

## Out of scope

Barcode scanning, receipts, reading store order history, opened-jar shelf life, tracking cooked batch portions separately (the Sunday chicken counts as raw breast used when each meal is ticked), and loading past orders.

## Owner checks

- **Release 1:** save an order and check the Kitchen amounts match what arrived; tick a day's meals and check the amounts drop; delete a test order and check its stock goes.
- **Release 2:** plan a week with food already at home and check the shop buys less.
