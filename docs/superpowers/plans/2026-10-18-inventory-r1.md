# Kitchen inventory, release 1 — plan

Spec: `docs/superpowers/specs/2026-10-18-inventory-design.md` (Release 1 section). Commit to `main`, one commit per task. No version bump (the release task does it). Verify each task with `node --test "apps/android/app/src/test/js/*.test.js"` (all pass) and the inline-script parse check:

```
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

Rules: match surrounding style (pure modules are ES5 with `var`/`function` and the `module.exports` / `root.X` footer like `orders.js`; the HTML inline script is modern JS). Escape every catalogue-, meal- or store-derived string in HTML with `esc`. Existing localStorage keys keep their shape (meals only gain the optional `ate`). Stage by explicit path; never commit `.superpowers/`; never `git stash`, `git clean`, `git reset --hard`.

## Task 1: `inventory.js` and `keeps`

Files: new `apps/android/app/src/main/assets/weekday_fuel/inventory.js`; `catalogue.js` (add `keeps`); `Weekday_Fuel.html` (add `<script src="inventory.js"></script>` after `orders.js`); new `apps/android/app/src/test/js/inventory.test.js`; `.github/workflows/release-android.yml` (append `apps/android/app/src/test/js/inventory.test.js` to the `node --test` list); `catalogue-data.test.js` (every `keeps` is a positive whole number and only on sec 1 items).

1. `catalogue.js` ITEMS: add `keeps` (days) to: breast 3, mince 3, thigh 3, spinach 4, ham 5, bread 5, muffin 5, toms 7, cucumber 7, capsicum 7, yog 14, wraps 14, cheese 21, eggs 28.
2. `inventory.js` exports (`window.WeekdayFuelInventory` in the browser):
   - `KEY = "weekdayfuel.inventory"`, `KEEP_DAYS = 120`.
   - `parse(json)`: returns `{ v: 1, start, events }` or `null` (bad JSON, wrong `v`, bad `start`). Drops invalid events (see the spec's event kinds; `amount` finite and > 0, or ≥ 0 for `set`; `why` one of count/used/toss; `order` a string for `buy`; `at` a parseable ISO time; `item` a non-empty string; `id` a non-empty string).
   - `addEvents(inv, events, now)`: returns a new inventory (creating `{ v: 1, start: now, events: [] }` when `inv` is null) with the events appended; each event gets `id` (`now` + "#" + a counter unique within the inventory) and `at` (`now` unless given). Never mutates its input.
   - `removeOrder(inv, orderId)`: new inventory without that order's `buy` events (returns `inv` unchanged when null).
   - `prune(inv, now)`: drops events older than `KEEP_DAYS` except, per item, the latest `set` and every `buy`/`add` at or after it.
   - `stock(inv, days, cat, now, fixtureOn)`: `days` is `{ [date]: day }` (the app's `state.days`), `fixtureOn(date, key)` says whether that day's fixture toggle is on. Returns `{ [item]: { amount, lots: [{ at, amount }], useSoon, off } }` for items with amount > 0. Follow the spec's ordering rules exactly:
     - Changes are applied in time order.
     - A ticked meal (`ate` string ≥ `start`) uses `cat.amountFor(meal.id, item, meal.t)` for every item in `cat.AMOUNTS[meal.id]`, oldest lot first.
     - Each date from the start date to `now`'s date (inclusive) with `fixtureOn` true uses 1 `dare` / 1 `grenade` at local midnight of that date.
     - A `set` below the stock keeps the newest lots totalling the amount; a `set` above it adds a lot for the difference.
     - Amounts never go below 0.
     - `useSoon`/`off` come from the oldest remaining lot's age against the item's `keeps`:
       - `off` when the age in days is over `keeps`;
       - `useSoon` when the age is ≥ `keeps − 1` (or ≥ `keeps / 2` when `keeps` ≤ 3);
       - both false for items without `keeps`.

     Dates are local `YYYY-MM-DD` strings like the rest of the app.
   - `pending(inv, days, today)`: `[{ date, i, id }]` for meals (with a known meal id is not required here) on dates ≥ the start date and < `today` whose `ate` is `undefined`, in date then index order. Empty when `inv` is null.
   - `buysFromRows(rows, store, ticks, haveIt)`: `[{ item, amount }]` from shop rows, following the spec's stock-in rule:
     - Skip ticked rows, rows in `haveIt`, and rows with no line at either store.
     - Use `row[store]` or else the other store's line.
     - The amount is `line.quantity * line.product.size`, or `line.quantity * 1000` when `product.perKg`.
3. Tests (`inventory.test.js`), with a small fixture catalogue built with `catalogue.create`, must cover:
   - parse validation;
   - add/remove order;
   - prune keeping the latest set;
   - stock from buys and ticked meals at their portion, with skipped (`ate: false`) and unanswered meals not using stock;
   - meals ticked before `start` ignored;
   - FIFO lots;
   - `set` lower, `set` higher, and `set` to 0;
   - fixtures per toggled day;
   - never negative;
   - `useSoon`/`off` boundaries for keeps 3 and 14;
   - `pending`;
   - `buysFromRows` including a deli line, a pack/tray line, a missed-at-store row, ticked and haveIt rows.

## Task 2: stock in, undo, and "Ate it"

File: `Weekday_Fuel.html` (and any test helpers needed).

1. Storage helpers next to the other `ls*` helpers: `lsInv()` (parse `WeekdayFuelInventory.KEY`, null on error) and `lsSetInv(inv)` (prune with now, then save; returns true/false like `lsSetOrders`).
2. `trySaveOrder` returns the saved order's id (or `true` when there was nothing to save); keep `saveOrder()`'s truthy/falsy contract. In the `nextshop` case, after a successful save that produced an order id, add `buy` events from `WeekdayFuelInventory.buysFromRows(shopRows(), store(), lsTicks(), (state.trolley && state.trolley.haveIt) || {})` with `order` = that id, before the ticks and trolley are cleared. If saving the inventory fails, still continue (the order is saved) and set `state.orderError` to "Saved the order, but couldn't update the kitchen stock."
3. `delorder`: after the order is removed, `lsSetInv(WeekdayFuelInventory.removeOrder(lsInv(), id))` when there's an inventory.
4. Today meals (`renderToday`): add an "Ate it" toggle button to each planned meal's actions (`aria-pressed`, `data-act="ate"`, `data-i`). The `ate` case sets `m.ate = new Date().toISOString()` or deletes `m.ate` when it's already a string, and turns `false` (skipped) into a time. It then calls `saveDay(date)`.
5. Pending card: at the top of the Today screen (after the header), when `WeekdayFuelInventory.pending(lsInv(), state.days, iso(new Date()))` isn't empty, show a panel titled "Did you eat these?". It lists each pending meal with its day (`dayShort`) and name, and two buttons: "Ate it" (`data-act="pendate" data-d data-i`, sets `ate` to the end of that day: local 23:59:59 as ISO) and "Skipped" (`data-act="pendskip"`, sets `ate = false`). It also has a "Yes, all" button (`data-act="pendall"`) that ticks them all at the end of their day. Save each changed day with `saveDay`. Unknown meal ids show as "Unknown meal" and can still be answered.

## Task 3: Kitchen tab

File: `Weekday_Fuel.html`.

1. `TABS` gains `["kitchen","Kitchen"]` after Shop; add an `ICON.kitchen` SVG in the same style as the others (a simple fridge outline); `render()` routes it to `renderKitchen()`.
2. `renderKitchen()`:
   - Stock: `WeekdayFuelInventory.stock(lsInv(), state.days, CAT, new Date(), (d, k) => !!(dayOf(d).fx && dayOf(d).fx[k]))`.
   - Sections, in order:
     1. **Use soon:** items with `useSoon` or `off`. Show the age line "bought {fmtShort(lot date)} · use by {fmtShort(lot date + keeps)}", or "probably off" when `off`; breast, mince and thigh add " or freeze it".
     2. **Fridge:** other sec 1 items.
     3. **Cupboard and freezer:** sec 2 items.
     4. **Daily:** sec 0 items.
   - Each row shows the item name and amount via `amountText`/`fmtAmt` in the item's unit (round to 1 decimal).
   - Tapping a row (`data-act="kitem"`) opens three actions under it:
     - Used it all (`kused`): `set 0, why used`.
     - Threw it out (`ktoss`): `set 0, why toss`.
     - Set amount: a number input plus a Save button (`kset`, reading the input; ignore non-numbers and negatives).
   - **Add food:** a panel with a `<select>` of all catalogue items (name and unit), an amount input, and an Add button (`kadd`, positive numbers only).
   - **Empty Kitchen:** when there's no inventory or no stock, say "Stock starts with your next saved order, or add what's at home now." above Add food.
   - **Saving:** every action saves via `lsSetInv(WeekdayFuelInventory.addEvents(lsInv(), [event], new Date().toISOString()))` and shows "Couldn't save" on failure.
3. Escape all names. Keep the tab usable at phone width (reuse existing classes: `panel`, `si`, `row between`, `small muted`, `btn`, `ghost`, `chip`).

## Task 4: release v0.13.0

Bump `versionCode` and `versionName` to 0.13.0 in `apps/android/app/build.gradle.kts` after the final review; CI must be green.
