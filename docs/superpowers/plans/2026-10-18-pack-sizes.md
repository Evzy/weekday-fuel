# Pack sizes chosen by the week — plan

Spec: `docs/superpowers/specs/2026-10-18-pack-sizes-design.md`. Commit to `main`. Do not bump the version. Run `node --test "apps/android/app/src/test/js/*.test.js"` (all must pass) and the inline-script parse check before committing. Stage files by explicit path; never commit `.superpowers/`.

## Task 1: packs in the catalogue, shop and lookups

Files: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js`, `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`, `apps/android/app/src/test/js/catalogue.test.js` (and `catalogue-data.test.js` if it checks product fields).

1. **Data (`ITEMS` in catalogue.js):**
   - Coles breast and thigh: rename `small: {...}` to `packs: [{...}]` (same product object).
   - Woolworths breast: add `packs: [{ name: "Woolworths RSPCA Approved Chicken Breast Fillet 1.5kg - 2.2kg", url: "https://www.woolworths.com.au/shop/productdetails/969723/woolworths-rspca-approved-chicken-breast-fillet", stockcode: 969723, size: 1500, sizeLabel: "1.5–2.2kg tray", price: 24.2, checked: "2026-10-18" }]`. Item note becomes: "Woolworths buys 650g packs, or the 1.5–2.2kg tray when it's cheaper for the week (charged at 2.2kg, the difference refunded)".
   - Woolworths thigh: add `packs: [{ name: "Woolworths RSPCA Approved Chicken Thigh Fillets Skinless 1.2kg - 1.8kg", url: "https://www.woolworths.com.au/shop/productdetails/727622/woolworths-rspca-approved-chicken-thigh-fillets-skinless", stockcode: 727622, size: 1200, sizeLabel: "1.2–1.8kg tray", price: 26.1, checked: "2026-10-18" }]`.
   - Coles ham: replace with `{ name: "The Deli Shaved Leg Ham 250g", url: "https://www.coles.com.au/product/the-deli-shaved-leg-ham-250g-1476946", size: 250, price: 6, checked: "2026-10-18" }`; item note: "Coles doesn't sell deli ham by weight online, so a 250g pack instead".
2. **`storeLine(item, product, need)`:** keep `perKg` as is. If `product.packs` is a non-empty array, evaluate candidates `[product].concat(product.packs)`: `n = Math.max(1, Math.ceil((need - SMALL_PACK_SLACK) / c.size - 1e-9))`, `cost = n * c.price`, `waste = Math.max(0, n * c.size - need) / c.size * c.price`; choose the lowest `cost + waste`, ties to the earlier candidate. Without packs: `n = Math.max(1, Math.ceil(need / size - 1e-9))` as now. Return `{ product: chosen, quantity: n, cost: round2(n * chosen.price), buy }`. `packLabel` uses `product.sizeLabel` when present (e.g. "1 × 1.5–2.2kg tray"). Remove the old `small` logic. Update the `SMALL_PACK_SLACK` comment to say it allows for approximate pack weights when an item has packs.
3. **`mealCost`:** for each ingredient use the lowest `price / size` among the store product and its `packs` (perKg stays `q / 1000 * price`).
4. **`applyColesPrices`:** generalise `small` to `packs`: apply live prices to every pack by `colesId`; drop packs that are unavailable; if the main product is unavailable, the first remaining pack becomes the main product carrying the rest as its `packs` (omit `packs` when none remain), and if none remain the item gets `coles: null, colesUnavailable: p` as now. Never mutate the input (the frozen test must still pass). Do not add `packs` keys that weren't there.
5. **`applyLivePrices` (Woolworths):** unchanged behaviour for the main product; keep its `packs` as they are (spread the product so `packs` survive). Trays never get live prices.
6. **`checked(store)`:** include every pack's `checked`.
7. **Weekday_Fuel.html:** `colesIds()` and `colesProduct(id)` iterate `[i.coles].concat(i.coles.packs||[])` instead of `[i.coles, i.coles.small]`; `wooliesProduct(code)` also searches `i.woolies.packs`; the `refreshPrices` message's `stockcodes` stays main products only.
8. **`.cursor/rules/meals.mdc`:** where products are described, add one line: "A store product may list other pack sizes of the same food in `packs` (meat only so far); the shop buys whichever is cheapest for the week counting leftovers as waste. Variable-weight trays use their lightest weight as `size`, the up-front charge as `price`, and a `sizeLabel`."
9. **Tests (catalogue.test.js):** change the fixture's Coles `small` to `packs: [...]`. The choice now follows cost + waste, so update expectations and test names:
   - `tenderwrap ×3` (600 g): small pack, 1.
   - `tenderwrap ×4` (800 g): two small packs ($14.40 + $4.80 waste) beat one large ($16.80 + $7.20 waste).
   - `m650`: one small; `m651`: two small packs (score 20.99) beat one large (25.79).
   - `buffalomac ×13` (2340 g): four small packs, $28.80.
   - Add a test with a Woolworths-style tray (`size: 1500, price: 24.2, sizeLabel: "1.5–2.2kg tray"`) on a 650 g $9.40 main: need 1400 buys one tray with buy text `"1 × 1.5–2.2kg tray"`; need 1000 buys two 650 g packs.
   - `mealCost` uses the cheapest per-unit pack (assert a value with the fixture).
   - Live price tests: rename `small` to `packs[0]` throughout and keep the same behaviours, including the frozen-input test and both-unavailable test.
   - `checked`/`colesChecked` includes pack dates.
   - A Woolworths live price leaves `packs` untouched.
10. **catalogue-data.test.js:** where it checks `p.small` (product fields, and the loop over `[p, p.small]`), check every entry of `p.packs` instead; add that `packs`, when present, is a non-empty array, that only meat items (`breast`, `thigh`, `mince`, `ham`) have packs, and that `sizeLabel`, when present, is a non-empty string.
