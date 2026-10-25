# Log a meal I ate (design)

Date: 2026-10-25. Approved by Evan.

## Problem

Sometimes Evan makes one of the usual meals ad hoc: it wasn't planned, or he forgot to log it earlier. Today the only way to add it is the normal add flow, which puts the meal in the cart and treats it as planned (refits can change its portion). He wants a simple way to record "I ate this" that never goes to the cart.

## Design

### Today page

A **Log a meal I ate** button on Today, next to "Ate something else?". It shows whenever setup is done, including on an untracked weekend.

It opens a sheet:

1. Pick a meal from the usual meal list (same search and slot filters as the Meals tab).
2. Pick the slot (Breakfast, Lunch, Dinner; defaults to the meal's own slot) and the portion (Light, Standard, Loaded; defaults to Standard).
3. If today already has a planned meal in that slot that is not bought and not logged, show an unticked checkbox **Instead of the planned {Slot} · {Meal name}**. If there are several, one checkbox per meal. Ticking removes that planned meal from today (so it also leaves the cart).
4. **Log it** saves, closes the sheet, and shows a Today note: "Logged {Slot} · {Meal} ({Portion})".

On an untracked weekend, logging sets `day.track = true` for today.

### Data

The logged meal is pushed onto `day.meals` as:

```js
{ id, slot, t, shop: false, ate: <ISO time of logging>, logged: true }
```

`logged` is a new optional field; no other storage shape changes.

### Behaviour of a logged meal

- **Cart:** never in the cart (`shop: false`). The "Not in cart" toggle is hidden for logged meals.
- **Kitchen stock:** never touched. `inventory.js` skips meals with `logged === true` when computing stock use (including past days) and reservations.
- **Portions:** fixed. Because `ate` is set, `fitTiers` and all refits already treat it as eaten; the rest of today fits around it.
- **Counts:** in today's totals, the Week tally, over/under spreading to later days, and the weigh-in trend, like any eaten meal.
- **Display:** tagged **Logged** in Today and Week lines.
- **Editing:** tapping it opens the usual meal sheet; portion can be changed and the meal removed. Swap and "Not in cart" are hidden for logged meals.
- **Dates:** today only.

### Out of scope

Past days, Kitchen stock deduction, a whole-day "no cart" mode.

## Testing

- `inventory.test.js`: a logged meal (today and on a past day) uses no stock and reserves none; a normal eaten meal still does.
- A pure helper for the log action (e.g. `cartadd.logMeal(day, {id, slot, t, replace: [indexes]}, nowIso)`) returning the new meals array: adds the logged meal, removes only the ticked planned meals, never removes bought or logged ones. Unit tested.
- Shop: logged meals don't appear in `dayMeals()`, shop rows or `toBuyKeys`.
- Manual: log on a planned weekday, on an empty weekday, and on an untracked weekend; replace a planned meal and confirm the cart row drops.
