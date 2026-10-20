# Pack sizes for smaller shops — design

Date: 2026-10-20. Approved by Evan in chat.

## Problem

Shop already sums exactly what the planned (not yet bought) meals need, across every planned day from today on, including meals added to a day by hand. It then rounds up to whole packs. Only chicken breast and thigh have more than one pack size, so a two-day shop still buys a 12-egg carton, a 907g yoghurt tub, a 2kg potato bag and so on. Smaller shops should buy smaller packs.

## Goals

1. More pack sizes in the catalogue for the items where one size is too coarse.
2. The pack chooser picks the cheapest total for this shop. Leftovers go to stock as now.
3. Review shows the chosen pack and the leftover, and lets the owner switch pack size per item.

Out of scope: changing meal figures, adding new ingredients, picking days inside Shop (planning fewer days already gives a smaller shop).

## 1. Catalogue research

Add `packs` alternatives (existing shape: `{name, url, size, price, checked, sizeLabel?}`, plus `stockcode` for Woolworths) to these items, at each store that stocks a matching product of the same kind (same brand family or store brand, same macros within ~5%):

| Item | Current | Candidate sizes |
| --- | --- | --- |
| eggs | 12 | 6, 18 or 30 |
| yog | 907g | ~500g |
| cheese | 700g (C) / 500g (W) | 250g |
| bread | 16 slices | smaller loaf |
| spinach | 120g | 60g, 280g |
| potato | 2kg | 1kg bag, or loose per kg |
| mince | 500g | 1kg |
| toms | 250g | other punnet sizes |
| passata | 700g | ~400g |
| fzpeas, fzmix | 1kg | 500g |
| muesli | 1kg | ~500g |

Research writes findings to `docs/catalogue-research.md` (new dated section) with each product's name, URL, stockcode/id, size, price and check date. A size that a store doesn't stock is skipped for that store. Packs whose macros differ materially from the item's `per`/`AMOUNTS` are not added; they'd change meal figures, which is Evan's call. Loose-by-kg potatoes use the existing `perKg` path only if the store sells them that way in the online shop.

Nothing in CI fetches the stores. Research happens once, by hand, via web search/fetch.

## 2. Pack choice: cheapest total

`storeLine` in `catalogue.js` currently scores each candidate as `cost + wasted value`. Change to:

- Candidates: the main product plus `packs`. One pack size per line (no mixing sizes), quantity `q = max(1, ceil((need - slack) / size))`. Slack stays `PACK_SLACK` for items marked `approx: true` (breast and thigh, sold by approximate weight) and is 0 for every other item.
- Score = `q * price`. Ties break toward less leftover, then toward the main product.
- An owner override (section 3) wins when that pack exists for the store.

Examples: need 4 eggs, 6-pack $4 vs 12-pack $6 → 1 × 6. Need 10 → 1 × 12 rather than 2 × 6 at $8.

`line.alts` stays as is (other candidates), so `orders.js` matching of past sends keeps working.

## 3. Review: chosen pack, leftover, switch

- Each Review row with more than one candidate at the selected store shows `buy` text plus leftover, e.g. "1 × 6 eggs · 2 left over". Leftover is `q*size - need` in the item unit, hidden when 0.
- Tapping the pack text opens a small sheet listing the candidates with quantity and cost for this need; picking one saves an override. "Auto (cheapest)" clears it.
- Override storage: `settings.packPick = { woolies: { <itemId>: <stockcode> }, coles: { <itemId>: <url> } }`. Additive optional field; old settings without it behave as auto. An override pointing at a product no longer in the catalogue is ignored.
- Everything shown is escaped with `esc`.

## Data flow

`shopList` → `shopRow` → `storeLine(item, product, need, override)` → line `{product, quantity, cost, buy, alts, leftover}`. Send uses `line.product` as today, so trolley scripts, live prices (`applyLivePrices` / `applyColesPrices` already update pack prices) and the sent record need no changes. Stock after Finish uses the chosen pack size as today.

## Testing

- `catalogue.test.js`: cheapest-total choice for small/medium/large needs; tie-break; override honoured; unknown override ignored; leftover value.
- Catalogue sanity test: every pack has a positive `size` and `price`, Woolworths packs have a numeric `stockcode`, Coles packs have a `coles.com.au/product/` URL ending in an id.
- Existing 347 tests stay green; parse check on the HTML.

## Release

One minor release (v0.25.0) after research, code and review land with CI green.
