# Choose today's Dare, staples bought while out — design

Date: 2026-10-21. From Evan: he sometimes gets the 45g protein Dare (750mL) when it's on special, buys Dares on his morning walk, and wants to pick which one he had on Today. Choices (chat): the Today chooser lists all Dare swaps; the choice is for that day only (regular stays the default); the shop shouldn't buy Dares (bought on the walk). Design approved in chat.

## Catalogue

- New swap on `dare`: `{ id: "dare-750", short: "Dare 45g", todayOnly: true, name: "Dare Protein Double Espresso No Sugar Added 750mL", serves: 1, per: { k: 444, p: 45, c: 38.3, f: 12 } }` with Woolworths 6020777. **`todayOnly: true`** excludes it from shop specials (`suggest`, `resolveUseChoice`); catalogue-data skips the +80 kcal guard for `todayOnly` swaps. ("Dare Protein Double Espresso Iced Coffee No Sugar Added 750mL", https://www.woolworths.com.au/shop/productdetails/6020777/dare-protein-double-espresso-iced-coffee-no-sugar-added, $5.80) and Coles 1045886 ("Dare Protein No Sugar Added Iced Coffee Double Espresso 750mL", https://www.coles.com.au/product/dare-protein-no-sugar-added-iced-coffee-double-espresso-750ml-1045886, $5.80), checked 2026-10-21. Macros from the label: 248 kJ, 6.0g P, 5.1g C, 1.6g F per 100mL, same recipe as the 500mL.
- Every existing Dare swap gets a `short` label for chips: "Dare Mocha", "Pauls", "Rokeby", "Oak" (and any other existing swap: a short brand-led label ≤ 12 chars).
- Record in `docs/catalogue-research.md`.

## Staples bought while out

- Staple rows get an optional `out: true` (additive; `normalizeRow` keeps it only when `=== true`; `copyEntry`, `applyAdd`, `applyEdit` carry it).
- `needs()` skips `out` staples, so Shop never buys them. Stock reservations and end-of-day consumption skip them too (wherever staples reserve or consume inventory: gap spare reserve, inventory consumption).
- Macros and the day target are unchanged: an `out` staple still counts on days it's on.
- Staple edit sheet: a checkbox "Buy it while out (not in the shop)".

## Today: choose which one

- Day field `day.stapleChoice = { <stapleId>: <swapId> }` (additive, optional). Only valid swap ids of that staple's item count; anything else is ignored.
- Macros for a staple on a day with a choice come from the swap's `per` (k, p; c and f when given, else the staple's own c/f scaled by k ratio), times the staple's `amount` (servings). Used everywhere the day's staple macros are summed (totals, fitTiers base, gap maths, week views).
- A chosen swap never consumes home stock for that day.
- Today chip: when the staple's item has swaps, a small "▾" button sits next to the chip (`.chipedit` style, `data-act="staplechoose"`). It opens a sheet listing the regular item first then each swap: short label, kcal, protein; the current choice is marked. Picking the regular item deletes the key; picking a swap sets it. Either turns the staple on for the day if it was skipped. Then `todayFit(date)` and the existing fit note.
- Chip text uses the swap's `short` when chosen: "Dare 45g · 444".
- Only for today's editable day (same gate as the staple chips).

## Testing

- `staples.test.js`: `out` parse/round-trip; `needs` skips `out`; choice macros (swap per, scaled c/f fallback, invalid swap ignored, amount 2).
- `catalogue-data.test.js` passes with the new swap (unique codes, URL ends with id); every swap has a `short`.
- Browser check: Dare chip ▾ → pick Dare 45g → kcal and protein totals rise by 148 / 15 and portions refit; tomorrow's chip shows the regular Dare; staple sheet `out` toggle removes Dare from Shop Review.

## Release

v0.30.0.
