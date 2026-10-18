# Bought meals and Clear unbought (v0.15.0)

Evan, 2026-10-19: planned days shouldn't feel set in stone. Meals that went through a saved order should show as bought and stay put; everything else should be easy to clear in one go.

## Decisions (Evan)

- A **Clear** button on Today removes every planned meal that hasn't been bought, on any date. Bought meals stay.
- Bought meals show a **Bought** tick and are **locked** (no swap, portion change, remove or In shop toggle) unless the day is unlocked.
- Bought is tracked **per meal** (option 1), so a meal left out of the shop on a bought day is still unbought.

## Data

- A planned meal in `days` gets an optional `bought`: the saved order's id (the order's `at`). Additive, like `ate`; old data has none.
- **Marking:** "Save order and start next shop", after the order saves, sets `bought = order id` on every meal in the order's shop days with `shop !== false` and no `bought` yet, then saves those days. If the order wasn't saved (nothing to save), nothing is marked.
- **Unmarking:** deleting a saved order in Past orders removes `bought` from every meal whose `bought` equals that order's id.
- **Existing orders (one-time backfill):** on first load of this version, for each saved order (oldest first), mark meals on the order's `days` with `shop !== false` and no `bought` as `bought = order id`. A settings flag `boughtBackfill: true` (additive) records that it ran, so it runs once.
- Pure helpers (new functions in `orders.js` or a small `bought.js`, ES5, tested): `markBought(days, dates, orderId)`, `unmarkBought(days, orderId)`, `backfillBought(days, orders)`, `clearUnbought(days)` → `{ days, cleared }`. Each returns new day objects only for days it changed and never mutates its input.

## Today screen

- **Meal rows:** a bought meal shows a small "Bought" tick next to its name. While its day is locked, its tier, swap, remove and In shop controls are hidden; Ate it and the recipe stay.
- **Unlock:** a day with any bought meal shows "Unlock to edit" in the meals header. Unlocking is transient (`state.unlocked[date]`, cleared on reload) and shows "Lock" to undo. Unlocked bought meals are editable and keep their `bought` mark. Swapping or changing a bought meal's portion while unlocked shows the note "This meal's food was bought for the original meal."
- **Day shop line:** when every meal on the day is bought, the "Add day to shop" line becomes "Bought with your shop on {order date}" (no button). When some are bought and some aren't, the line stays as today (adding the day adds only the unbought meals: bought meals are left out of the shop's `dayMeals`).
- **New suggestion / Fit portions:** treat bought meals like eaten ones: kept in place and fixed when fitting (unless the day is unlocked; then Fit portions may re-tier them, New suggestion still keeps them).
- Adding a meal to a bought day is allowed; the new meal is unbought.

## Clear unbought

- A "Clear unbought meals" button on Today, under the week planner row, shown only when at least one unbought, uneaten meal exists on any date.
- Two taps (the `state.armed` pattern used by Next shop): the first tap changes the label to "Tap again to clear N meals"; any other action disarms it.
- Removes every meal with no `bought` and no string `ate` from every day; removes now-empty days from the current shop's days (`settings.shopDays`); keeps fixtures, extras and tracking. Saves each changed day and settings.

## Shop and Kitchen

- Bought meals are excluded from the shop's `dayMeals` (they've been bought), so a day can't buy the same meal twice.
- Inventory: bought meals that aren't ticked or skipped are reserved food wherever they are, including on a shop day (`reserved()` treats a bought meal on a shop day like a `shop:false` one, since it isn't in that shop); ticking still uses stock.

## Testing

- Helper tests: mark/unmark/backfill/clear, including `shop:false` meals, already-bought meals not re-marked, eaten meals kept by Clear, inputs not mutated, unknown order ids.
- Browser check at phone width: Bought tick, locked controls, Unlock/Lock, Clear with two taps, delete order unlocks meals.

## Owner checks

Save an order and see that day's meals show Bought and are locked; tap Clear and see only unbought meals go; delete a test order and see its meals unlock.
