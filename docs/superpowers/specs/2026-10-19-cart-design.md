# Cart (the Shop becomes a cart; add meals from Meals)

Date: 2026-10-19. Status: approved design.

## Goal

The Shop stops being a huge page of every meal at 0 serves. It becomes a cart: whatever you've planned and not bought yet. You add meals from the Meals tab through a day pop-up, so every meal has a day and a slot.

## Decisions (owner)

- **The cart is automatic:**
  - It holds every planned meal from today on that isn't bought yet. There's no "Add day to shop" step.
  - A meal can be left out with its existing **In shop** toggle, and a whole day with **Leave out**.
  - Meals planned after a trolley is sent wait for the next cart.
- **The add pop-up** is a 14-day strip showing each day's planned slots. Tapping a day puts the meal in its natural slot, and asks "replace or add as an extra" when that slot is full. Portions are fitted to the targets.
- **Removed:** the 0-serves picker, the "Build a shop / Full list" switch and the Full list, and the "Add day to shop / Remove from shop" buttons on Today.

## Cart days (replaces manual shop days)

`shopDays()` becomes derived:
- **No trolley sent** (`!lsSent() && !lsColesSent()`): every date ≥ today whose day has at least one meal that is in `MEAL`, not bought, and not `shop:false`, sorted ascending. `settings.shopDays` is ignored while no trolley is sent.
- **Trolley sent:** the dates stored in `settings.shopDays`, frozen, as today.
  - **When a trolley is sent** (Woolworths or Coles), the current derived cart days are written to `settings.shopDays` before the sent record is saved, so the freeze holds exactly what was sent.
  - **"Save order and start next shop"** clears `settings.shopDays`, as now, so the cart is derived again.

Everything that reads `shopDays()` keeps working with the derived list. That includes `dayMeals`, staple needs, inventory reserved/free, the fingerprint, `markBought` on save, and the Clear unbought skip dates. With no trolley sent, saving the order marks every cart meal as bought. That's the meaning of "the cart is what you bought".

**Consequences:**
- `applyPlan` and `suggestWeek` no longer write `settings.shopDays`. The `held` guard stays: when a trolley is sent, meals they add to frozen days get `shop:false` and `held:true` (system-held for the next cart). User **Leave out** / **In shop** toggles set `shop:false` only, without `held`. **Save order and start next shop** clears `held` and the hold flags on those meals so they join the derived cart again; explicit user `shop:false` stays.
- The `shopday` / `unshopday` actions and the Today "Add day to shop / Remove from shop" row are removed. The per-meal **In shop** toggle stays.
- Existing stored `settings.shopDays` with no trolley sent are simply ignored; there's no migration. With a trolley sent they're the frozen set, as today.

## Shop tab ("Your cart")

The order, top to bottom:
1. **Heading** "Your cart", with a summary line: "Mon 19 – Fri 23 · 15 meals", or "Your cart is empty".
2. **Cart days panel:** meals bunched by day, so the shop's shape and anything odd show at a glance (owner request). For each cart day, in date order:
   - **Header:** the day label (e.g. "Wed 21") and a **Leave out** button. Tapping the header opens the day on Today (existing `openday`).
   - **Slots:** breakfast, lunch and dinner each on its own short line: "Breakfast · Loaded ham & cheese toasty". An empty slot shows "–". Snacks and extra meals in the cart are listed after dinner. Meals that are `shop:false` or bought aren't shown, since they're not being bought.
   - **Flags,** small muted text next to the label:
     - **"Only N meal(s)"** when the day has fewer than 3 cart meals and is a weekday, or a tracked weekend.
     - **"In N days"** when the date is more than 7 days after today. Use "In 2 weeks" when N is 14, and "In N weeks" for whole weeks.
   - **Gap marker:** between two consecutive cart days, when there's at least one weekday between them that isn't in the cart, insert a thin divider line "· N days later ·", where N is the calendar-day difference. Untracked weekends alone don't trigger it, so Fri → Mon has no marker.
   - **Leave out** sets `shop:false` on that day's unbought meals, so the day drops from the derived cart; the meals stay planned.

   `cartadd.js` provides the pure helpers `dayFlags(dateIso, cartMealCount, todayIso, isTrackedWeekend)` (returns `{few: n|null, ahead: label|null}`) and `gapLabel(prevIso, nextIso, isTrackedWeekend)` (returns a string or null), both tested.
3. **Next cart** (only when a trolley is sent): days with unbought, in-shop meals ≥ today that aren't in the frozen set, under "Next cart". Copy: "Planned after your trolley was sent. They join the cart when you save that order."
4. **Extra serves from before:** shown only while `picks()` has any serves. It lists them (meal name × serves) with a **Clear** button (existing `clearpicks`). Picks still feed the shopping list until cleared. There's no way to add new picks.
5. **Empty state:** when there are no cart days, no picks and no sent lines, show: "Your cart is empty. Add meals from the Meals tab, or start with a plan." It has buttons for **Meals** (`gomeals`) and the past orders.
6. **The rest is unchanged:**
   - store totals and the store switch;
   - the shopping list sections, with specials;
   - covered items, missed-at, the trolley and the next-shop button;
   - past orders.

Remove the 0-serves picker, the `shopmode` dial and the Full list branch, along with `settings.shopMode` reads. The setting is left in stored data and harmless. Keep the "Fixtures" section heading for now; the cleanup pass renames it.

## Adding from Meals

**Meal card.** Every non-full `mealCard` in the Meals tab gets an **Add** button (`data-act="addmeal" data-v="{id}"`) next to Recipe.

**Add sheet** (`state.sheet = "add:{mealId}"`):
- **Title:** the meal name, under an eyebrow reading "Add to a day".
- **Strip:** the 14 days from today. Each day is a button showing the day label and a compact line of its planned breakfast, lunch and dinner, using meal short names or "–" for an empty slot. Weekends are included, since the cart works on any day; untracked weekends are labelled "off" like the week strip but can still be picked.
- **Slot choice:** tapping a day runs `WeekdayFuelCartAdd.place(meal, day)`:
  - **`{action:"add", slot}`:** the meal is added straight away.
  - **`{action:"ask", slot, existing}`:** the sheet shows "{slot} on {day} already has {existing meal}." with **Replace** and **Add as an extra** buttons.
    - **Replace** swaps the existing unbought, uneaten meal for the new one. Its tier is cleared before fitting.
    - **Add as an extra** adds the new meal to the same slot alongside it.
  - **`{action:"locked", slot, existing}`:** the existing meal is bought or eaten. The sheet shows "{slot} on {day} is bought. Add as an extra?" with only **Add as an extra**.
- **After adding:**
  1. The new meal is `{id, slot, t:"S"}`.
  2. Run `fitTiers` on the day, with every other meal locked. The new meal goes last, as in `applyPlan`.
  3. Save the day and reset `shopCtx`.
  4. If a trolley is sent and the date is in the frozen set, set `shop:false` and `held:true` on the new meal.
  5. Close the sheet and show a toast note on the Meals tab: "Added to Wed 21 lunch. It's in your cart." When a trolley is sent, the note ends "…It'll be in your next cart." instead.

**Natural slot** (`place`):
- **Breakfast meals** (`slots` includes "breakfast"): breakfast.
- **Main meals:** lunch if lunch is empty; otherwise dinner if dinner is empty; otherwise lunch (which is then full, so the user is asked).
- **Snack-only meals:** snack, which is never "full": snacks always add.
- A meal that is both breakfast and snack counts as breakfast.

## Module `cartadd.js` (`window.WeekdayFuelCartAdd`, pure ES5, tested)

- `naturalSlot(meal, dayMeals)` returns `"breakfast"|"lunch"|"dinner"|"snack"`.
- `place(meal, dayMeals, isBought)` returns `{action, slot, existing?}`, where `isBought(m)` is passed in (`WeekdayFuelBought.isBought`).
  - `existing` is the first meal in that slot.
  - The action is `locked` when that meal is bought or has `typeof ate === "string"`. Otherwise it is `ask` when the slot is non-snack and occupied, and `add` when the slot is empty or snack.
- `apply(dayMeals, mealId, slot, mode)` returns the new meals array, sorted in slot order and stable, without mutating the input.
  - `mode` is `"add"` (or `"extra"`, the same thing) or `"replace"`.
  - **Replace** removes the first unbought, uneaten meal in that slot and appends the new `{id, slot, t:"S"}`.
  - The function returns the new meal object as well: `{meals, added}`.
- `cartDays(daysMap, todayIso, isBought, mealExists)` returns sorted dates ≥ today, each with at least one meal where `mealExists(m.id)` holds, `!isBought(m)` and `m.shop !== false`.

## Tests (`cartadd.test.js`, added to the CI list)

- **`naturalSlot`:** breakfast; main with an empty lunch; main with lunch full gives dinner; both full gives lunch; snack-only; breakfast plus snack gives breakfast.
- **`place`:**
  - add to an empty slot;
  - ask when occupied;
  - locked when the meal is bought or eaten;
  - a snack always adds.
- **`apply`:**
  - extra keeps the existing meal;
  - replace removes only the first unbought, uneaten meal in the slot;
  - slot order is stable;
  - the input is not mutated;
  - the returned `added` is the same object that's in `meals`.
- **`dayFlags`:**
  - 1 or 2 meals on a weekday flag "few", 3 don't;
  - an untracked weekend never flags few;
  - more than 7 days ahead flags ahead, with labels "In 8 days", "In 2 weeks" and "In 3 weeks".
- **`gapLabel`:**
  - consecutive days give null, and so does Fri → Mon;
  - Mon → Wed gives "2 days later", and Mon → the following Wed gives "9 days later".
- **`cartDays`:**
  - excludes past dates;
  - excludes days whose meals are all bought, all `shop:false` or unknown;
  - includes today;
  - sorts dates ascending.

## Out of scope

- Undated serves for new meals; old picks only drain.
- Multi-day add in one go.
- The cleanup pass: Targets behind a gear, renaming the "Fixtures" heading, trimming copy.
