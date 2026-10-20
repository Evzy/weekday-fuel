# Mixed pack sizes — design

Date: 2026-10-21. Approved by Evan in chat. Backlog item "Shop: mix pack sizes in one line".

## Problem

`storeLine` buys one pack size per item. Mixing is often cheaper: 15 eggs is 2 × 12 = $13.40 but 12 + 6 = $11.60; 1250g yoghurt is 2 × 907g = $17.60 but 907g + 500g = $15.30.

## Choosing

For a store product with `packs` (candidates = main + packs, at most 4), find counts `n_i ≥ 0` minimising total `Σ n_i·price_i` subject to `Σ n_i·size_i ≥ need − slack` (slack as now: `PACK_SLACK` for `approx` items, else 0), at least one pack. Exhaustive search with `n_i ≤ ceil((need − slack)/size_i)`; costs compared after `round2`. Tie-breaks: less leftover (`Σ n_i·size_i − need`), then fewer packs, then more of the main product. The result must be minimal: removing any single pack leaves the need uncovered (true of any cheapest solution with positive prices; assert in tests).

An override (`settings.packPick`) forces a single size exactly as now. Non-pack and `perKg` paths are unchanged.

## Line shape

Unchanged fields keep their meaning for the *primary part* (the part with the largest `quantity·size`; ties → main): `product`, `quantity`. Changed/added:

- `parts: [{product, quantity, cost}]` — always present when the product has packs (one entry when not mixed), ordered by size descending.
- `cost` — total over parts. `buy` — "1 × 12 + 1 × 6" (each part formatted as now; units via `packLabel`). `leftover` — total.
- `candidates` — unchanged (each size on its own), plus the pack sheet's "Auto (cheapest mix)".
- `alts` — candidates not in `parts`.

## Consumers

- **`cart.js`** `cartLines` / `colesCartLines`: one trolley line per part (Coles merging by id still applies). `removalLines` / `colesRemovalLines`: keep every part's id.
- **`orders.js`** `sentLineQty` → returns `[{product, qty}]` for every sent code among parts ∪ alts ∪ main (deduped). Callers: `snapshot` makes one ordered entry per row whose `buy` lists all sent parts and whose cost sums them; "pack size changed since sending" when the sent set differs from `parts`. Sent codes used by a row are not repeated as "not in this shop".
- **`inventory.js`** `amountFromSent` sums `buyAmount` over all returned parts; `buysFromRows` fallback sums `parts` when present.
- **Fingerprint** (`Weekday_Fuel.html` ~440): per store, the sorted list of `id:quantity` for all parts.
- **Review**: buy text from `line.buy`; product links use the primary product; pack sheet shows "Auto (cheapest mix)" ticked when no override (its row shows the mix and total), then each single size.
- **`planner.js`** `shopScore`: leftover from `Σ parts quantity·size` when `parts` exist.
- **`specials.js`** `useSwap`: unchanged (swap replaces the line; no `parts`, consumers fall back to `product`/`quantity`).

All consumers must handle lines without `parts` (deli, single-product items, swaps) exactly as now.

## Testing

- `catalogue.test.js`: 15 eggs → 12 + 6; 10 eggs → 12; 1250g yog → 907 + 500; exact fits; tie-breaks; override still single; minimality; approx slack.
- `cart.test.js`: two-part lines produce two trolley lines; removals keep both; Coles merge.
- `orders.test.js`: sentLineQty multi; snapshot single entry with both parts; changed-since-sending.
- `inventory.test.js`: Finish stock sums both parts.
- Fingerprint changes when the mix changes. Browser check of a mixed Review row and pack sheet.

## Release

v0.27.0.
