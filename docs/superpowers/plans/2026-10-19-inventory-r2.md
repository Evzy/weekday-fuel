# Kitchen inventory, release 2 — plan

Spec: `docs/superpowers/specs/2026-10-18-inventory-design.md` (Release 2 section). Commit to `main`, one commit per task. No version bump (the release task does it). Verify each task with `node --test "apps/android/app/src/test/js/*.test.js"` (all pass) and the inline-script parse check:

```
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

Rules: as in the release 1 plan (ES5 pure modules with the `module.exports` / `root.X` footer; modern JS inline; `esc` every catalogue-, meal- or store-derived string; existing localStorage keys keep their shape; stage by explicit path; never commit `.superpowers/`; never `git stash`, `git clean`, `git reset --hard`).

**Invariant:** with no inventory (or an empty `have`), every screen, total, trolley line and saved order is exactly what it is today. Tests must pin this.

## Design choice

Fully covered rows are **not** in `shopList`'s result, so every existing consumer (totals, Missed lists, trolley/cart lines, ticks, the pantry check, `shopScore`, stock-in) skips them without changes. They come from a separate `coveredList` with the same arguments. Partly covered rows stay in `shopList` with `have` set and store lines sized for `need − have`.

## Task 1: shop maths (`catalogue.js`, `planner.js`)

1. `shopList(picks, fixtureDays, dayMeals, have)`: `have` optional `{ item: amount }`. For each row, `h = min(max(have[id], 0), need)` when `have[id]` is a finite number > 0, else 0. When `h > 0` and `need − h ≤ max(1e-9, 0.05 × need)` the row is dropped (covered). Otherwise the row keeps `need`, gains `have: h` (only when `h > 0`; keep the row object identical to today when `h` is 0), and its `coles`/`woolies` lines are `storeLine(it, product, need − h)`.
2. `coveredList(picks, fixtureDays, dayMeals, have)`: rows covered by the same rule as `shopList` (shortfall within 5% of `need`, and `have > 0`), each `{ id, sec, name, unit, need, have, used, days, covered: true }` with the actual `have` (no store lines), in catalogue order.
3. Share the need-building code between the two (no copy-paste).
4. `planner.shopScore(cat, dayMeals, store, have)`: passes `have` to `shopList`; the sec 1 leftover uses `need − (r.have || 0)`.
5. Tests (`catalogue.test.js` / `planner.test.js` or a new `shop-have.test.js` added to the CI list in `.github/workflows/release-android.yml`):
   - no `have` / `{}` / unrelated items gives deep-equal output to today's call;
   - partly covered: line sized for the remainder (e.g. need 400, have 250 → line for 150), `need` unchanged, `have` 250;
   - fully covered and over-covered rows appear only in `coveredList`;
   - fixtures (sec 0) covered by Dare/Grenade stock;
   - bad `have` values (negative, NaN, string) ignored;
   - `shopScore` drops covered rows and uses the remainder for leftovers.

## Task 2: what's free to use (`inventory.js`)

1. `reserved(inv, days, cat, today, shopDays, fixtureOn)` → `{ item: amount }` (null-prototype object), empty when `inv` is null. `shopDays` is the sorted array of shop dates; `first` = its first date, or none.
   - Meals: for each date `d` in `days` with `d` > the start's local date (like `pending`) and (`first` missing ? `d` < `today` : `d` < `first`), every planned meal whose `ate` is absent (not a string, not `false`) reserves `cat.amountFor(meal.id, item, meal.t)` for each item in `cat.AMOUNTS[meal.id]`. Unknown meal ids reserve nothing.
   - Shop-day meals with `shop === false` that aren't ticked or skipped are also reserved (they're eaten from what's at home).
   - Fixtures: when `first` exists, each date from tomorrow (`today` + 1) to the day before `first` with `fixtureOn(date, key)` reserves 1 `dare` and 1 `grenade`.
2. `free(stockMap, reservedMap)` → `{ item: amount }` with `max(0, stock[item].amount − reserved[item])` for items with a positive result.
3. Tests: no inventory → `{}`; pending past meals reserved; ticked and skipped meals not reserved; meals on and after the first shop day not reserved except `shop:false` ones; dates before the start not reserved; fixtures from tomorrow to the day before the first shop day honouring `fixtureOn`; no shop days → only past pending; `free` clamps at 0 and drops zero items.

## Task 3: Shop screen and saved orders (`Weekday_Fuel.html`, `orders.js`)

1. A helper `shopHave()`: when `lsInv()` is null return `null`; else `free(stock(inv, state.days, CAT, new Date(), fixtureOn), reserved(inv, state.days, CAT, iso(new Date()), shopDays(), fixtureOn))`. Compute it once per render/handler (don't call `stock` per row).
2. `shopRows()` and the Build-a-shop list in `renderShop` pass `shopHave()` to `shopList`. Every other `shopList` call that feeds the current shop (trolley send, pantry check, next shop, Coles cart) must go through `shopRows()` or pass the same `have`, so the list, totals, trolley and saved order agree. The planner (`suggestWeek` score and the week cost line) passes the same `have`.
3. Partly covered rows: the "need" part of the Buy line reads "need 400g · have 250g" (use `needLabel`-style formatting in the item's unit).
4. A panel "Covered by what you have" after the Fixtures/Fresh/Pantry sections listing `coveredList(...)` rows: name and "need X · have X" (`esc` names). Hidden when empty.
5. `orders.snapshot(rows, ticks, sentLines, opts)`: optional `opts.covered` (array of covered rows) adds each to `groups.had` as `{ name, buy: "", cost: null, store: null, note: "covered by what you have", for }`. `nextshop` passes the covered rows. Stock-in is unaffected (covered rows aren't in `rows`). Add an `orders` test for `opts.covered` and that omitting it changes nothing.
6. Empty-shop check: a shop whose rows are all covered still shows the list screen (with the covered panel), not "Pick at least one meal".
7. The "Left to buy", store totals and Missed lists need no change (they use `shopList` rows).

## Task 4: release v0.14.0

Bump `versionCode` to 23 and `versionName` to "0.14.0" in `apps/android/app/build.gradle.kts` after the final review; CI must be green.
