# Delivery minimum top-ups (design)

Date: 2026-10-27. Approved by Evan in chat.

## Problem

Woolworths won't complete a delivery order under $50 (Coles online also has a $50 minimum). A short plan (e.g. 3 days) can land under it, and Evan only finds out at checkout.

## Design

### Minimum

`DELIVERY_MIN = { woolies: 50, coles: 50 }` (dollars, one constant per store).

### Review step (step 1)

When the selected store's shop total (`shopStoreTotals()[store].total`, the app's current prices incl. live prices and specials) is below the minimum, show under the store switch:

> **Woolworths $38.40 · $11.60 under the $50 delivery minimum**
> small muted: "Based on the app's prices; the store's own subtotal may differ slightly."

Followed by up to 3 suggestions, cheapest first, each with its cost and an **Add** button:

1. **Plan the next day.** The first date after the last cart day (or after today when the cart is empty) that is a tracked day (weekday, or a weekend with `track`) and has no meals. Meals are chosen with the same planner as Suggest a week for that single day (variety rules against neighbouring days, `fit` for portions). The suggestion previews the meal names and the cost the day adds to this store's shop. **Add** writes those meals to the day (like Suggest a week does) so they join the cart through the normal path. Only one "next day" suggestion is shown at a time; after adding, the next one is computed.
2. **Daily staples ahead.** Extend staple needs by N extra days after the shop's span (N = 1, 2 or 3, whichever is the smallest that closes the gap, else 3), counting only staples that are not `out` (bought while out) and are active on those days. Shown as e.g. "Grenade bars for 2 more days (2 bars)". **Add** stores `settings.shopStapleAhead = N` (additive optional field); `stapleNeedMap()` includes those days. Cleared by Start over and Finish this shop.

Suggestion costs are the increase in this store's total after applying the change (computed by building the shop rows with the change applied), so pack rounding is accounted for. Suggestions that add $0 are hidden. When the total reaches the minimum the panel shows "$50 minimum reached" (only if a top-up was added in this shop), otherwise nothing.

### Elsewhere

- Check out step (3): if the selected store's total is still below the minimum, show a hint "Still $X under the $50 delivery minimum" with a button back to Review.
- After a send, adding a top-up changes the plan, so the existing "Your trolley no longer matches your plan · Update trolley" banner covers it.
- Done/stock: extra staples are bought lines like any other and credited to Kitchen stock.

## Out of scope

Long-life pantry restocks, bigger-pack switching (not chosen), changing the minimum in settings.

## Testing

- Pure helpers (new module `topup.js`): `nextPlanDay(daysMap, today, isTracked, hasMeals)`; `gapToMin(total, min)`; staple-ahead day span; suggestion ordering and hiding of $0 suggestions. Unit tests, added to the CI test list.
- Page: suggestion cost equals the total difference; Add next day writes meals and the shop updates; staple ahead included in needs and cleared on Finish/Start over; out staples excluded.
