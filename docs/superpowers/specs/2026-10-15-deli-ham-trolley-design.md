# Send deli ham to the Woolworths trolley — design

**Status:** done (v0.2.1)
**Scope:** deli ham goes into the Woolworths trolley by weight instead of "Add these yourself"

## Goal

"Send to Woolworths trolley" also sends the shaved deli ham, at the weight Build a shop says to buy. The owner no longer adds it by hand.

## Roadmap (agreed 2026-10-15)

This is the first of four specs, built and released in order:

1. **Deli ham in the trolley** (this spec).
2. **Both stores on every item:** a Coles and a Woolworths product per Shop item with links and actual prices, Coles in red and Woolworths in green, one row when it is the same product at both, separate entries when they differ, a Coles total and a Woolworths total, and items one store lacks listed as missed. The trolley stays Woolworths-only.
3. **Orders page:** "Start an order" copies the current shopping list into an order that tracks what is still left to get by hand, and clears the Shop list.
4. **Checkout in the app:** delivery or pick-up and address, time slot, substitutions, Rewards and promo codes, fees and minimum order, each step with a "View on Woolworths" button that opens the real site at that step.

## Facts (Woolworths, 2026-10-15)

From `/apis/ui/product/detail/175734` and the trolley capture in `docs/woolworths-requests.md`:

| Field | Value |
| --- | --- |
| Product | D'Orsogna Ham Leg Triple Smoked 97% Fat Free Shaved From The Deli, stockcode 175734 |
| Unit | `KG`; `MinimumQuantity` 0.1; `IncrementalMinimumQuantity` 100 g; `SupplyLimit` 10 |
| Price | $28.00/kg ($2.80 per 100 g) |
| Set-quantity request | Same `/api/v3/ui/trolley/update` body as packaged items, `quantity` in kilograms (0.3 = 300 g) |

## Decisions

| Question | Decision |
| --- | --- |
| How the weight is sent | As the trolley line's `quantity`, in kilograms (option 1). No new field. |
| Rounding | Up to the next 100 g, minimum 100 g. The owner never runs short. |
| Price | $2.80 per 100 g. |

Rejected:

- **Grams plus a unit field, converted in the trolley script:** more explicit but adds a field to every line for one item.
- **Keep ham manual with a quicker link:** does not remove the manual step.

## Changes

1. **Build a shop (`Weekday_Fuel.html`, `buildList()`).** Ham grams come from a new pure helper in `cart.js`, `deliGrams(needGrams)` = `max(100, ceil(needGrams / 100) * 100)`, so the rounding is unit-tested. Buy text: `"<g>g shaved from the deli"`. Cost: `g / 100 * 2.80`. The row's numeric `n` is the weight in kilograms (`g / 1000`), so `n` for ham is a decimal.
2. **Full list entry (`SHOP`, `ham`).** Product text and detail say 300 g at $2.80/100 g, sold in 100 g steps; price $8.40.
3. **Trolley lines (`cart.js`).** Ham is no longer routed to "Add these yourself". It becomes a normal line from its Woolworths link (stockcode 175734) with `quantity` = the row's kilograms, rounded to 3 decimals so floating-point noise never reaches Woolworths. Name: `"D'Orsogna Ham (deli, <g>g)"`, with grams = `round(quantity * 1000)`. A ticked ham is skipped like any other item. The `deli` manual reason and its `MANUAL_WHY` text are removed (no other deli items).
4. **Trolley script (`trolley.js`).** No change: it already passes `quantity` through. A test pins that a decimal reaches the request body unchanged.
5. **Android (`TrolleyModels.kt`).** `TrolleyLine.quantity` becomes `Double`. `parseLines` reads it with `getDouble` and still drops lines with quantity ≤ 0. `linesToJson` writes whole numbers as integers (`2`, not `2.0`) and decimals as-is (`0.3`).
6. **Docs.** `docs/woolworths-requests.md` deli section: automated from v0.2.1, 100 g steps, $28/kg.

## Error handling

Unchanged. If Woolworths does not accept the ham (`UpdatedItems` lacks 175734, e.g. the deli is unavailable at the owner's store), it appears under "Couldn't add" with its Open button, like any other line.

## Testing

- `cart.test.js`: `deliGrams` gives 300 for 250, 100 for 60, 300 for 300. A ham row with `n` 0.3 gives a line `{stockcode: 175734, quantity: 0.3}` named "D'Orsogna Ham (deli, 300g)"; `n` 0.30000000000000004 still gives 0.3; ticked ham gives no line; ham never appears in `manual`.
- `TrolleyJsonTest.kt`: `0.3` round-trips through `parseLines` and `linesToJson`; `2` stays `2` in the JSON; `0` and negative quantities are dropped.
- `trolley.test.js`: a line with quantity 0.3 is sent with `"quantity":0.3`.
- CI runs all of these. No CI step talks to the real Woolworths site.

## Release and phone checks (v0.2.1)

- [ ] Starter shop: Shop shows ham as "<g>g shaved from the deli"; after Send, the Woolworths trolley shows the ham at that weight.
- [ ] Send again: the ham weight is unchanged (set, not added).
- [ ] Tick the ham, send: the ham in the trolley is unchanged.
- [ ] "Add these yourself" no longer lists ham.
- [ ] The ham's product link (Shop → ham → product page) opens in the Woolworths screen. It showed a 404 in a logged-out desktop browser on 2026-10-15 although the product API reports it available; if it 404s on the phone too, fix the link in the follow-up.

## Out of scope

Everything in roadmap specs 2–4. Other weighed products (none in Shop today).
