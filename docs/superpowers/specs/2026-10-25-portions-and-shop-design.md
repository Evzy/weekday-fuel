# Portions and shop (2026-10-25)

## A — Fit portions before sending

- Manual tier dial sets optional `tierBy: "you"` on the meal. Per-day **Fit** and **todayFit** clear `tierBy` on that day (full refit).
- Pure `WeekdayFuelPortionFit.planDay` computes best L/S/X without mutating; optional `respectTierBy` treats `tierBy === "you"` as fixed (same fixed rules as `fitTiers` with `{ bought: true }`).
- Shop Review (step 1), unpaid, when nothing sent yet **or** meals changed since send: hint **Fit portions first** with per-line `Day · Slot → Tier`, marking hand-picked tiers. **Fit portions** / **Fit all** / **Fit the rest** as specified; not blocking Send.

## B — Notice portion changes after sending

- Unpaid, sent, not busy, no send review: if projected trolley lines from `trolleySend` differ from `sent.lines`, banner **Portions changed since you sent** + **Update trolley** (`pantrycheck`). Meal add/change banners unchanged.
- On send complete, optional `tiers: { [mealKey]: L|S|X }` on the sent record. `sentShopDayMeals` uses recorded tiers for Done stock credit. Paid: no extra UI.

## Tests

- `portion-fit.test.js`, `cart.js` `linesDiffer` / `projectSentLines`, `bought.js` tier helpers.
