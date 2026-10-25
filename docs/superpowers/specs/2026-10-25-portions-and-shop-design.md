# Portions and shop (2026-10-25)

## A — Fit portions before sending

- Manual tier dial sets optional `tierBy: "you"`. Per-day **Fit** and **todayFit** clear `tierBy` on that day.
- `WeekdayFuelPortionFit.planDay`: `respectTierBy` defaults **false** (same as legacy `fitTiers`); only Shop **Fit the rest** passes `respectTierBy: true`. Base totals include fixed meals even when the meal id is unknown to `MEAL`.
- Shop Review hint **Fit portions first** (hidden while `trolleyBusy` or send review pending). After **Fit the rest**, hide while only hand-picked changes remain until those days’ meal+tier fingerprint changes.

## B — Trolley mismatch after sending

- Unpaid, sent, not busy, no send review: if `trolleySend` would change the trolley vs last attempt, banner **Your trolley no longer matches your plan** + **Update trolley** (`pantrycheck`). Uses `shopSentHaveIt` (always merges `sent.haveIt`). Comparison uses `sendFailed` on the sent record so failed add lines do not loop the banner.
- On send complete: optional `tiers`, optional `sendFailed` (failed add quantities). `sentShopDayMeals` merges `tiers` from both stores (current store first). Paid: no extra UI.

## Tests

- `portion-fit.test.js`, `cart.js` (`linesDiffer`, `sendFailed`), `bought.js` tier helpers.
