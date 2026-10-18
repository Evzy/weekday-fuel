# Bought meals and Clear unbought — plan

Spec: `docs/superpowers/specs/2026-10-19-bought-days-design.md`. Commit to `main`, one commit per task. No version bump until Task 3. Verify each task with `node --test "apps/android/app/src/test/js/*.test.js"` (all pass) and the inline-script parse check:

```
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

Rules: as in the inventory plans (ES5 pure modules with the `module.exports` / `root.X` footer; modern JS inline; `esc` every catalogue-, meal- or store-derived string; existing localStorage keys keep their shape, only the optional meal `bought` and settings `boughtBackfill` are added; stage by explicit path; never commit `.superpowers/`; never `git stash`, `git clean`, `git reset --hard`).

## Task 1: helpers, marking, unmarking, backfill, shop and reserved

Files: new `apps/android/app/src/main/assets/weekday_fuel/bought.js` (`window.WeekdayFuelBought`), loaded in `Weekday_Fuel.html` after `orders.js`; new `apps/android/app/src/test/js/bought.test.js` (add to the `node --test` list in `.github/workflows/release-android.yml`); `inventory.js`; `Weekday_Fuel.html`.

1. `bought.js` exports, each returning `{ days, changed: [dates] }` (new day and meal objects only where changed; never mutate input):
   - `markBought(days, dates, orderId)`: meals on those dates with `shop !== false` and no `bought` get `bought: orderId`.
   - `unmarkBought(days, orderId)`: removes `bought` where it equals `orderId`.
   - `backfillBought(days, orders)`: for each order oldest first (by `at`), `markBought(days, order.days, order.id)`; skips orders without a `days` array or `id`.
   - `clearUnbought(days)`: removes meals with no `bought` and no string `ate`; also returns `cleared` (count).
   - `isBought(meal)`: `typeof meal.bought === "string" && meal.bought !== ""`.
2. Marking: in `nextshop`, after `trySaveOrder()` returns an order id (not `true`), and before `shopDays` is cleared, apply `markBought(state.days, shopDays(), orderId)` and `saveDay` each changed date. Guard with try/catch so a failure never stops the shop reset.
3. Unmarking: in `delorder`, after the order is removed, apply `unmarkBought(state.days, v)` and `saveDay` each changed date.
4. Backfill: at startup (after state and days load), when `!S().boughtBackfill`, run `backfillBought(state.days, lsOrders())`, save changed days, set `state.settings.boughtBackfill = true`, `saveSettings()`.
5. Shop: `dayMealsFrom` always leaves out bought meals, so both `dayMeals()` and `dayMealsAll()` exclude them (a bought meal was never in the current shop, so the sent-row merge and the order's meal list don't need it).
6. `inventory.reserved()`: a meal on a shop day that is bought (`isBought` logic inline, no cross-module dependency) and not ticked or skipped is reserved, like a `shop:false` one. Test it in `inventory.test.js`.
7. Tests in `bought.test.js` for every helper: `shop:false` not marked, already-bought not re-marked, unmark only that id, backfill order and skips, clear keeps bought and eaten meals, counts, non-mutation, unknown ids, missing days.

## Task 2: Today screen

File: `Weekday_Fuel.html`.

1. Meal rows (`renderToday`): bought meals show a small "Bought" tick beside the name (reuse an existing chip/tick style). While the day isn't in `state.unlocked`, hide the tier, swap, remove and In shop controls for bought meals; keep Ate it and the recipe. Handlers for those actions also refuse bought meals on locked days (defence against stale buttons).
2. Meals header: when the day has any bought meal, show "Unlock to edit" (`data-act="unlockday"`) or "Lock" when unlocked. `state.unlocked` is a transient `{ date: true }`.
3. When an unlocked bought meal is swapped or its tier changed, set `state.dayNote = { date, msg: "This meal's food was bought for the original meal." }` and show it under the meals header for that day until the next action.
4. Day shop line: when the day has meals and all are bought, replace the Add-day-to-shop row with "Bought with your shop on {fmtShort(order date)}" (the order date from the `bought` id, an ISO time; fall back to "Bought" if unparseable). Mixed days keep the current row.
5. `suggestDay` keeps bought meals like eaten ones (in their slots, ids in `used`). `fitTiers` treats bought meals as fixed unless the day is unlocked.
6. Clear: under the week-planner row, when `WeekdayFuelBought.clearUnbought(state.days).cleared > 0`, show a ghost button "Clear unbought meals" (`data-act="clearunbought"`). First tap sets `state.armed="clearunbought"` and the label becomes "Tap again to clear N meals"; second tap applies `clearUnbought`, saves every changed day, removes now-empty days from `settings.shopDays`, saves settings. Make sure other actions disarm it (check how `state.armed` is reset).
7. Browser check at ~400px if practical; screenshot to `%TEMP%\bought.png`.

## Task 3: release v0.15.0

Bump `versionCode` to 25 and `versionName` to "0.15.0" in `apps/android/app/build.gradle.kts` after the final review; CI must be green.
