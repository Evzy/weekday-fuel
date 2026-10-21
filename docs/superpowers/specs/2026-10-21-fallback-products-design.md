# Fallback products when the main is unavailable

Date: 2026-10-21. Evan’s Woolworths shop missed bread when Abbott’s Farmhouse Wholemeal was unavailable online (`applyLivePrices` sets `woolies: null` and `wooliesUnavailable`).

## Catalogue

- Optional `fallback` on a store product (same fields as a product: name, url, stockcode for Woolworths, size, price, checked).
- First use: **bread** — Helga’s Traditional Wholemeal 750g (Woolworths 84129, Coles 5969435, $5.20, 16 slices). Treated as equivalent macros to Abbott’s; Helga’s slices are ~10% lighter (noted in item note and research).

## Live prices

- When the **main** product (and any packs) would be unavailable and no alternate pack is promoted, if `fallback` exists and is not unavailable in live data (or has no live entry), use the fallback as the active store product with optional live price; set `fallbackFor` to the main product’s name on that product object.
- If the fallback is also unavailable, behaviour unchanged (missed / unavailable row).
- Fallback is **never** used when the main is available.

## Price refresh & lookups

- Fallback stockcodes and Coles ids are included wherever catalogue codes are enumerated (Woolworths refresh list, Coles refresh list, uniqueness tests, inventory catalogue walk, etc.).

## Shop Review

- When a row uses a fallback product, show: `{item short} unavailable — {fallback name} instead` (escaped).

## Testing

- `catalogue.test.js`: main unavailable → fallback + live price; main available → main; both unavailable → today’s unavailable behaviour.
- `catalogue-data.test.js`: fallback codes unique; Coles fallback URL ends with id; well-formed fallback products.
