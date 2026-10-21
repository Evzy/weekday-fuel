# Trolley matches the plan — design

Date: 2026-10-21. From Evan's acceptance testing: the Woolworths checkout total was about $50 above Shop Review because products from before were still in the trolley ("the cart needs to match the plan"). Choices (chat): remove products that aren't in the plan automatically, without asking; check when sending and again at Woolworths Check out; Coles too, since its trolley can be read.

## Rule

A product is **in the plan** for a store when its code (Woolworths stockcode, Coles product id) is a part of any current Shop row line for that store (all mixed-pack parts, deli kg lines included), whatever its quantity. Everything else in that store's trolley is removed (quantity 0).

## Send (both stores)

- The page adds `keep: [codes]` to the send message (`TROLLEY[s].send`): every in-plan code for that store, computed from `shopRows()` at send time (not only the lines being sent, so "Send these too" top-ups keep earlier sends).
- The host passes `keep` through to the store script unchanged (Kotlin message models get an optional list; absent = old behaviour, nothing extra removed). Validation: array of positive safe integers for Woolworths (each ≤ 9007199254740991) / array of product id strings for Coles (same 4–7 digit rule as line `productId`), at most 300 entries.
- Store scripts, after the login check and their existing trolley read, before setting quantities:
  - Woolworths `trolley.js`: read trolley codes from `/api/ui/v2/bootstrap` `TrolleyRequest.AvailableItems[].Stockcode` (and `UnavailableItems` if present); for each code not in `keep` and not in the send lines, send quantity 0 with the existing update request.
  - Coles `trolley.js`: from `readTrolley`, for each product id not in `keep` and not in the send lines, set quantity 0 through the existing set path (orderItemId).
  - Each removal is reported in results as `{code, outcome: "removed", extra: true}` (or `failed` with reason). Extra removals count towards progress totals.
- When `keep` is absent, scripts behave exactly as today.
- Start over sends `keep: []`, so it empties the whole trolley (not only what the app sent).

## Woolworths Check out

On checkout load (and after each successful address/time change reload), if `summary.items` has stockcodes not in the plan's Woolworths codes, the page sends a normal Woolworths trolley send with only quantity-0 lines for those codes and `keep` set, then reloads checkout when it finishes. One automatic attempt per checkout open (no loop if a removal fails).

## Showing it

- The send result and the checkout panel show one line: "Removed {n} item(s) that weren't in your plan" with product names where known (checkout summary names; send results show names when the script has them, else the count only). Failed removals: "Couldn't remove {n} item(s) not in your plan — remove them on {store}."
- Stock and sent records ignore `extra` results (they were never the app's lines).

## Owner-account writes

Quantity-0 updates for products not in the current plan, chosen by Evan. Not reversible by the app: anything added by hand on the store sites will be removed at the next send or Woolworths checkout open. Say so in the release notes.

## Testing

- Woolworths `trolley.test.js`: with `keep`, a trolley code outside keep and lines gets a quantity-0 update and an `extra` removed result; codes in keep or lines are untouched; without `keep` nothing extra is sent; a failed extra removal is reported.
- Coles `coles-trolley.test.js`: same cases via the stubbed trolley read.
- Kotlin JSON tests: `keep` parsed and passed through; invalid `keep` rejected; absent `keep` still valid.
- Page: pure helper `WeekdayFuelCart.planCodes(rows, store, colesId)` with tests (parts, deli, both stores); browser check (no host) that the send message carries `keep` and Start over sends `keep: []`.
- Nothing in CI talks to the real sites.

## Release

v0.29.0.
