# Live Coles prices — design

**Status:** approved 2026-10-15; v0.7.0 released 2026-10-16, owner phone checks pending
**Scope:** Coles prices, specials and availability stay current in the background, like Woolworths prices since v0.3.1 (`2026-10-15-both-stores-design.md`). No Coles trolley or checkout.
**Release:** v0.7.0

## Goal

Shop's Coles prices are a snapshot from 15 Oct that only changes with a new release. After this, they are read from Coles in the background together with Woolworths prices, so Coles totals, meal costs, specials and "missed at Coles" are as current as the Woolworths side.

Single user (the owner). Nothing is written to Coles; no login.

## Decisions

| Question | Decision |
| --- | --- |
| Which store's prices | The store Coles picks for the phone (logged out it chose Coles Local St Kilda, VIC, on 2026-10-15). Its name is shown with the price label. |
| When | Together with Woolworths: the same automatic refresh when Shop opens and saved prices are over 12 hours old, and the same **Refresh prices** button. The two stores refresh side by side; one failing doesn't stop the other. |
| How | A hidden Coles page in the app runs a price script that makes the site's own batch product request (`productsInfo`), plus the store name, in one go. |
| Which products | Every Coles product in the catalogue (46 today, including the chicken small packs). The product ID is the number at the end of its Coles URL. Items with no Coles product (wraps) stay that way. |

Rejected:

- **Each product's page data** (`/_next/data/<build>/en/product/<slug>.json`): needs no key but is ~250 KB per product, ~45 requests and ~11 MB per refresh. Kept as the fallback if the batch request fails the phone check.
- **Native HTTP to Coles without a page:** would have to copy the bot-protection cookies and the page's key by hand; the most fragile option.
- **A Coles store picker in the app:** more work for a few cents' difference.
- **A separate Coles refresh button, or refreshing only the chosen store:** the owner wants one refresh for both.

## Research (2026-10-15, Cursor's browser, logged out)

- Every coles.com.au page carries `window.__RUNTIME_CONFIG__` with `BFF_API_SUBSCRIPTION_KEY` (a public key the site itself sends) and sets the cookie `fulfillmentStoreId` (`0668`); `__NEXT_DATA__.props.pageProps.initStoreId` holds the same store.
- `POST /api/graphql` (same origin), headers `Content-Type: application/json` and `Ocp-Apim-Subscription-Key: <key>`, body `{query, variables}`:
  - `productsInfo(productIds: [String!]!, brandedStoreId: BrandedId!) { invalidProducts results { id name availability pricing { now was promotionType } } }` with `brandedStoreId: "COL:0668"`. Product IDs must be 4–7 digit strings. Unknown IDs come back in `invalidProducts`. A product with no price has `pricing: null` (wraps 8566038).
  - `store(id: "COL:0668") { name }` gives "Coles Local St Kilda".
  - Without the key: HTTP 401. A bad ID: HTTP 200 with `errors` and `data: null`.
- Sample: Dare 8991361 `now 3.3, was 4.65` (special); yoghurt 1435100 `availability: false`; capsicum 7214862 `now 1.74` (each, weighed); mince 8112799 `now 9.8, was null, promotionType "SPECIAL"`.

## Components

1. **Coles price script (`assets/coles/prices.js`, new).** Injected into the hidden Coles page. `window.__weekdayFuelColesPrices = { start(ids), state() }`, like `woolworths/prices.js`.
   - Reads the key from `__RUNTIME_CONFIG__.BFF_API_SUBSCRIPTION_KEY` and the store from the `fulfillmentStoreId` cookie, else `__NEXT_DATA__.props.pageProps.initStoreId`. Missing either: state `notReady` (the page isn't a normal Coles page yet).
   - Requests IDs in chunks of 30; the first request also asks for `store { name }`.
   - Each result becomes `prices[id] = {price, was, special, available}`: `price` is `pricing.now` when a positive number, else null; `was` only when greater than `price`; `special` is `was != null || promotionType === "SPECIAL"`; `available` is false when `availability` is false or there is no price.
   - Final state `{phase: "done", at, store: {id, name}, prices}`; `name` may be null. Any HTTP error, unreadable reply, or `errors` without `data`: `{phase: "error", error}`.
   - Never stores or logs the key.
2. **Coles session (`ColesSession.kt`, new package `dev.weekdayfuel.app.coles`).** Owns a WebView that is never shown, with no JavaScript bridge. `refreshPrices(ids)` loads `https://www.coles.com.au/` when the page isn't a Coles page or needs a fresh load, injects the script on page finish, polls `state()` every 300 ms, and gives up after 30 s. After every reply it unloads the page (`about:blank`), so Coles' scripts don't run between refreshes and each refresh loads a fresh page with the current key. `notReady` waits for the next page load until the timeout. Only http(s) links load in it; anything else is dropped, since nobody sees the page. `ColesUrls.isColesPage(scheme, host)` accepts https `www.coles.com.au` only.
3. **Models and messages (Kotlin).** `ColesPricesJson.parseIds` (strings of 4–7 digits, deduped; anything else makes the list unreadable) and `parseScriptState`; `HostMessages.colesPrices(state)` gives `{type: "colesPricesDone", at, store, prices}` or `{type: "colesPricesError", message}` ("Couldn't update Coles prices." by default).
4. **Host (`MainActivity.kt`).** `refreshPrices` gains an optional `colesIds` array. Woolworths runs as now when `stockcodes` is non-empty. Coles runs when `colesIds` is non-empty; a present but unreadable `colesIds` gets `colesPricesError`. Destroyed with the activity like the Woolworths session.
5. **Catalogue (`catalogue.js`).**
   - `colesId(product)`: the trailing number of the product URL as a string, or null.
   - `applyColesPrices(items, prices)`: for each Coles product and its small pack, a live price replaces `price` and sets `was` and `live: true`. An unavailable small pack is dropped. An unavailable main pack is replaced by its small pack when that is available; otherwise the item gets `coles: null, colesUnavailable: <the catalogue product>`. A product missing from `prices` keeps its price.
   - `shopList` rows carry `colesUnavailable` like `wooliesUnavailable`.
   - `checked("coles")` is unchanged; the page decides the label.
6. **Storage.** A new key `weekdayfuel.v1.colesPrices`: `{at, store: {id, name}, prices: {[id]: {price, was, special, available}}}`. A new reply is merged over the old prices (as for Woolworths). Existing keys keep their shape.
7. **Shop (`Weekday_Fuel.html`).**
   - `buildCat` applies Woolworths then Coles live prices.
   - `refreshPrices` posts `colesIds` (the `colesId` strings of every catalogue Coles product and small pack) with the stockcodes. Each store has its own state (`null`, `"busy"`, `"error"`). The automatic refresh runs when either store's saved prices are missing or over 12 hours old; it asks for both.
   - Price label: "Coles prices from 9:40 today (Coles Local St Kilda) · Woolworths prices from 9:40 today." Before any live Coles prices: "Coles prices checked 15 Oct" as now. While either is busy: "Updating prices…" instead of the button. Each failure on its own line: "Couldn't update Coles prices" / "Couldn't update Woolworths prices".
   - A Coles special shows "Special, was $X" like Woolworths. A Coles product unavailable online reads "<name> · unavailable online now", counts as missed at Coles, and "Missed at Coles" says "Coles doesn't have these online right now" for it, like Woolworths. Its product link still opens.
8. **Past orders (`orders.js`).** In a Coles shop, a Buy yourself item whose row has `colesUnavailable` gets the note "unavailable online at Coles".

## Error handling

- Offline, timeout, Coles changed (no key, 401, GraphQL errors): keep the last Coles prices; "Couldn't update Coles prices". No retry until the next Shop open after 12 hours, or the button.
- Woolworths and Coles results arrive separately; each only touches its own state and cache.
- Unreadable Coles cache: ignored; catalogue Coles prices are used.
- Every Coles-derived string (product and store names) goes through `esc`.
- Outside the app (plain browser): no live prices, as now.

## Testing

- `coles-prices.test.js` (Node, fake `fetch`/`document.cookie`/`__RUNTIME_CONFIG__`): the request carries the key header, `COL:<store>` and the IDs in chunks of 30; the store comes from the cookie, else `initStoreId`; a reply maps to the price map with special, was and unavailable (`availability: false`, `pricing: null`); the store name; `notReady` without key or store; HTTP 401, `errors` without data, and a non-JSON reply become `error`; `start` refuses while fetching.
- `catalogue.test.js`: `colesId` for every catalogue Coles product; `applyColesPrices` price and was; unavailable main pack becomes missed with `colesUnavailable`; unavailable large pack falls back to the small pack; unavailable small pack is dropped; missing IDs keep catalogue prices; `shopList` carries `colesUnavailable`.
- `orders.test.js`: the Coles unavailable note.
- Kotlin: `ColesPricesJson` parsing (IDs, state with store), `HostMessages.colesPrices` done and error, `ColesUrls`.
- CI lists the new test file in the JS step. Nothing in CI talks to Coles or Woolworths.
- Controller browser check with a fake host: both refreshes requested; Coles reply updates prices, totals, specials, the yoghurt missed at Coles, the store name in the label; Coles error with Woolworths success shows only the Coles failure; escaping of a hostile store name.
- Owner phone checks: Refresh prices updates both stores; the label shows the Coles store; a Coles special shows its was-price; Coles prices still show after reopening the app.

## Out of scope

A Coles trolley or checkout; choosing the Coles store; live search for new Coles products; opening Coles links inside the app.
