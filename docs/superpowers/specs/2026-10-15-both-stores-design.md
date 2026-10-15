# Coles and Woolworths on every Shop item — design

**Status:** approved 2026-10-15; v0.3.0 released and accepted by the owner 2026-10-15; v0.3.1 (live Woolworths prices) released 2026-10-15; done
**Scope:** roadmap spec 2 of 5 (see `2026-10-15-deli-ham-trolley-design.md`): every Shop item gets its real Coles and Woolworths product and price, Shop totals per store, a store switch, computed meal costs, and live Woolworths prices

## Goal

Shop shows what the week's shop actually costs at Coles and at Woolworths, using real products with links and prices. The owner picks a store and the list, pack counts and "Left to buy" follow it; anything that store does not sell is listed as missed. Woolworths prices stay current (including specials) by being read from Woolworths in the background. Meal per-serve costs are worked out from the same prices.

Single user (the owner).

## Decisions

| Question | Decision |
| --- | --- |
| Price freshness | Woolworths: live, read in the background. Coles: a dated snapshot, refreshed when the owner asks (new release). |
| Pairing | One Shop item, two product lines: Coles (red) and Woolworths (green). An identical product at both shows one name with both prices. |
| Store choice | A Coles / Woolworths switch. No "cheapest mix". |
| Missing at a store | Listed under "Missed at Coles" / "Missed at Woolworths", left unticked. |
| Meal costs | Worked out from the chosen store's prices. |
| Live refresh | Automatic when Shop opens and the saved prices are over 12 hours old, plus a "Refresh prices" button. |
| Product research | The controller researches both stores in Cursor's browser; the owner approves the table before it is built in. |
| Trolley | Stays Woolworths-only, now driven by each item's Woolworths product. |
| Releases | v0.3.0: catalogue, both stores, store switch, meal costs (snapshot prices). v0.3.1: live Woolworths prices. |

Rejected:

- **Extra columns on the existing `SHOP` / `LINKS` / `PACK` tables:** keeps the maths in the 1,000-line HTML where no test reaches it.
- **Searching the stores live for each item:** fragile, picks wrong products, loses approved pairings.
- **Live Coles prices:** a second background site to maintain; can be a later spec.

## Components

1. **Catalogue (`apps/android/app/src/main/assets/weekday_fuel/catalogue.js`).** Pure data and functions, no DOM, no storage, loaded by `Weekday_Fuel.html` as `window.WeekdayFuelCatalogue`, Node-testable like `cart.js`. Replaces `SHOP`, `LINKS` and `PACK` in the HTML. Holds every item's two products and the shopping maths now in `buildList()` (pack counts, ham by weight, chicken pack choice, pasta by meal), per store.
2. **Meal amounts (in `catalogue.js`).** The per-serve amount of every item each meal uses (today's `AMT`, completed so sauces and pantry items have amounts too, e.g. soy 15 mL). Used for both the shop list and meal costs.
3. **Shop tab (`Weekday_Fuel.html`).** Renders what the catalogue returns: two-line item rows, both totals, the store switch, missed items, price-age labels, Refresh prices.
4. **Trolley lines (`cart.js`).** Reads each item's Woolworths product from the catalogue instead of `LINKS`.
5. **Price script (`apps/android/app/src/main/assets/woolworths/prices.js`, v0.3.1).** Runs inside the background Woolworths page like `trolley.js`; reads current price, was-price and availability for a list of stockcodes; exposes state for the host to poll.
6. **Woolworths session (`WoolworthsSession.kt`, v0.3.1).** Runs the price script on request; one script at a time (a price refresh waits for a running send and vice versa).

## Data

Each catalogue item:

```js
{
  id: "cheese",                        // existing Shop ids are kept (ticks are keyed by them)
  sec: 1,                              // 0 fixtures, 1 weekly top-up, 2 pantry & freezer
  name: "Light tasty shredded cheese", // plain name shown on the row
  note: "Keeps for weeks in the fridge",
  same: false,                         // true when both stores sell the identical product
  coles:   { name, url, size, unit, price, checked } | null,
  woolies: { name, url, stockcode, size, unit, price, checked } | null,
}
```

- `size` + `unit` is one pack ("500", "g"); `price` is the shelf price of one pack in dollars; `checked` is the ISO date the price was read.
- Weighed deli products use `unit: "kg"`, `size: 1`, `price` per kg; the existing 100 g rounding (`deliGrams`) applies at both stores.
- The chicken breast small/large pack choice keeps its current rule, with each store's two pack products recorded on the item (`coles` / `woolies` for the large pack, `colesSmall` / `wooliesSmall` for the small one).
- Pasta keeps one product per pasta type per store (spaghetti, macaroni), chosen by the picked meals as today.
- `null` means that store has no matching product.

Settings gain `store: "coles" | "woolies"` (default `"woolies"`). Saved data is otherwise unchanged; ticks stay keyed by item id.

Live Woolworths prices (v0.3.1) are cached under a new key `weekdayfuel.v1.prices`: `{ at: ISO time, prices: { [stockcode]: { price, was, special, available } } }`.

## Shop tab

**Item rows.** `same: true`: one product name, then "Coles $x" in red and "Woolworths $y" in green. Otherwise two lines, a red Coles line and a green Woolworths line, each with its own product name and price. A store with no product shows "Not at Coles" / "Not at Woolworths" on that line. Tapping a line's product opens it: Woolworths in the in-app Woolworths screen, Coles as Coles links open today. Colours come from two new CSS variables, `--coles` and `--woolies`, with light and dark theme values next to the existing palette.

**Build a shop.** The summary panel shows "Coles $X" and "Woolworths $Y" for the picked meals (whole packs, as today). Below it, the Coles / Woolworths switch. The Buy lines, pack counts, "Left to buy" and the trolley panel follow the chosen store; the other store's price stays visible on each row. Items the chosen store does not sell are listed in a "Missed at <store>" panel with the other store's product and price. They are not counted in that store's total or "Left to buy", and their tick (if any) is left as it is. Each store's total says how many items it misses ("Coles $X · 2 missed").

**Full list.** Every item with both lines; section totals per store.

**Price labels.** "Coles prices checked 15 Oct" (oldest `checked` date in the catalogue) and, from v0.3.1, "Woolworths prices from 9:40 today" with a "Refresh prices" button. A Woolworths product on special shows "Special, was $X"; one unavailable online counts as missed at Woolworths with "unavailable online now".

## Meal costs

- A meal's Standard per-serve cost = sum over its items of `amount / pack size × pack price` at the chosen store; where that store has no product, the other store's price is used.
- Light and Extra keep their current ratio to Standard: `computed S × (typed L ÷ typed S)` and the same for X. The typed values stay in `MEALS` only as ratio sources.
- Shown wherever meal costs are shown today (meal cards, the meal picker, Today's estimated cost).
- Dare and Grenade in Today's tally keep the costs set in Targets. In Shop, their rows use the chosen store's catalogue price.

## Live Woolworths prices (v0.3.1)

- When Shop opens inside the app and `weekdayfuel.v1.prices.at` is missing or over 12 hours old, the page posts `{type: "refreshPrices", stockcodes: [...]}`; "Refresh prices" posts the same.
- The host runs `prices.js` in the background Woolworths page (no login needed; the product request works logged out). It reads each product's price, was-price, special flag and availability. A go/no-go capture in the plan checks for a request that returns many products at once; otherwise it requests products one at a time.
- The host replies `{type: "pricesDone", at, prices}` or `{type: "pricesError", message}`. The page saves `pricesDone` to the cache and re-renders Shop.
- Live prices replace the catalogue's Woolworths prices for display, totals, meal costs and the trolley panel.
- Same host channel rules as the trolley: only the app origin messages the host; Woolworths pages get no bridge.

## Error handling

- Refresh fails (offline, Woolworths changed): keep the last prices; Shop shows "Couldn't update Woolworths prices" under the price label. No automatic retry until the next Shop open after 12 hours, or the button.
- A product missing from the response keeps its cached or catalogue price.
- Unreadable cache: ignored; catalogue prices are used.
- Outside the app (plain browser): no live prices, no Refresh button; catalogue prices are used.

## Research (before building)

The controller fills a table in `docs/catalogue-research.md`: for each item, the Coles and Woolworths product (name, URL, stockcode for Woolworths, pack size, price, date), whether they are identical, and per-serve amounts for every meal ingredient that lacks one. Prices are read in Cursor's browser from each store's own product data. The owner approves or corrects the table before the catalogue is built from it.

## Testing

- `catalogue.test.js` (Node): pack counts per store for a packed item, ham by weight at both stores, chicken small/large rule, pasta by meal; both totals and missed counts; an item missing at one store; meal Standard cost and the fallback to the other store; Light/Extra ratios; live prices overriding catalogue prices, specials, unavailable counted as missed.
- `cart.test.js`: trolley lines come from each item's Woolworths product; items with no Woolworths product go to "Add these yourself".
- `prices.test.js` (v0.3.1): a fake Woolworths response gives the expected price map; HTTP errors and missing products are handled.
- Kotlin tests for parsing the price script's state (v0.3.1).
- Nothing in CI talks to the real sites.

## Release and phone checks

v0.3.0:

- [ ] Shop shows both totals; switching store changes Buy lines, pack counts and Left to buy.
- [ ] Rows are red/green; an identical product shows one name with two prices.
- [ ] Coles and Woolworths product links open the right pages.
- [ ] A missed item appears under "Missed at <store>".
- [ ] Meal costs change when the store changes.
- [ ] Send to Woolworths trolley now includes chicken breast, mince and wraps.

v0.3.1:

- [ ] Opening Shop shows "Woolworths prices from <time>"; Refresh prices updates it.
- [ ] A product on special shows "Special, was $X" matching woolworths.com.au.
- [ ] Airplane mode + Refresh shows "Couldn't update Woolworths prices" and keeps the old prices.

## Out of scope

Live Coles prices, a Coles trolley, a "cheapest mix" store option, Suggest a day to the trolley (roadmap 3), in-app checkout (roadmap 4) and the orders page (roadmap 5).
