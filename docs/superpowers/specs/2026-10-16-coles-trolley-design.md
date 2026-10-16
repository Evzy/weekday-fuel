# Send the shop to the Coles trolley — design

**Status:** approved 2026-10-16
**Scope:** fill the owner's Coles trolley from Build a shop when Coles is the picked store, then check out on Coles' own pages in an in-app Coles screen. Mirrors the Woolworths trolley (`2026-10-14-woolworths-trolley-design.md`) and its removal and past-orders behaviour.
**Release:** v0.8.0

## Goal

With Coles picked in Build a shop, one tap puts everything still left to buy into the owner's Coles online trolley, with the right products and pack counts. The owner then checks out on Coles' own pages without leaving Weekday Fuel.

Single user (the owner).

## Decisions (owner, 2026-10-16)

| Question | Decision |
| --- | --- |
| How far it goes | Fill the Coles trolley, then check out on Coles' own pages in an in-app Coles screen (like Woolworths v0.2.0). No Weekday Fuel checkout screens for Coles. |
| The Send button | One button that follows the store picked in Build a shop: "Send to Coles trolley" when Coles is picked, unchanged when Woolworths is picked. |
| Past orders | Items sent to the Coles trolley are saved under "Ordered on Coles". |
| Mechanism | A script in the logged-in Coles page sends the site's own set-quantity trolley request. Guided adding (product pages one by one) is the fallback. |

Rejected: tapping through Coles' page buttons (about 30 page loads, slow, breaks with layout changes); guided adding as the main path (doesn't do the adding).

## Research (coles.com.au, logged out, 2026-10-16)

From the site's own code (`_app-*.js`, RTK Query endpoints):

- Base URL in the browser: `https://www.coles.com.au/api/bff` (`COLES_BFF_API_URL` is used only server-side).
- **Set quantities:** `PATCH /api/bff/trolley/store/<storeId>` with body `{ageGateVerified: false, swapBehaviour: false, items: [{actions: [{productId: "<id>", quantity: <n>, orderItemId?: "<id>"}]}]}`. `quantity` is the target quantity (set, not add); `orderItemId` is sent for products already in the trolley. The response has `results[].actionedItems[]` per product.
- **Read the trolley:** `GET /api/bff/trolley/store/<storeId>?sortBy=…` with header `x-api-version: 3`; items carry `productId`, `quantity` and `orderItemId`.
- Headers: `Content-Type: application/json`, `Ocp-Apim-Subscription-Key` (the same public key as the price request, from `window.__RUNTIME_CONFIG__.BFF_API_SUBSCRIPTION_KEY`), session/visitor/user ID headers taken from Coles cookies, `credentials: "include"`.
- Adding needs a login: logged out, the site shows a login prompt instead of sending.
- The store is the `fulfillmentStoreId` cookie, as for prices. Logged in, it is the owner's own store, so live Coles prices follow it.

Task 1 confirms the exact headers and responses on the owner's account.

## Components

1. **Coles trolley script (`apps/android/app/src/main/assets/coles/trolley.js`, new).** Runs inside the Coles page; no bridge. Exposes `window.__weekdayFuelColesTrolley = {start(lines), state()}`, like `coles/prices.js`. Reads the key and store from the page at run time (never stored, logged or put in state). Reads the trolley, then sends one `PATCH` with an action per line (`orderItemId` for products already there). State: `{phase: "fetching" | "notReady" | "needsLogin" | "done" | "error", results: [{productId, added, reason?}], error}`. A 401 or 403 gives `needsLogin`.
2. **Cart lines (`apps/android/app/src/main/assets/weekday_fuel/cart.js`).** Gains `colesCartLines(rows, ticks, haveIt)` → `{lines: [{itemId, productId, quantity, name, url}], manual: [{itemId, name, reason}]}` and `colesRemovalLines(lastLines, rows)` → `[{productId, quantity: 0}]`, keyed by `colesId` from `catalogue.js`. Rows with no Coles product go to `manual` with reason `"woolies"` (Woolworths-only), `"unavailable"` (`colesUnavailable`) or `"nostore"`. `sentAfter(lastLines, lines, results, key)` gains an optional `key` (default `"stockcode"`); Coles passes `"productId"`. The Woolworths functions don't change.
3. **Coles session (`dev.weekdayfuel.app.coles.ColesSession`).** Gains `send(lines)` beside `refreshPrices`: loads the Coles home page if needed, injects `trolley.js`, polls `state()`, reports `needsLogin` (the host shows the Coles screen on the login page and resumes when the script no longer reports `needsLogin` after a page load), done or error. Gives up after 60 s. It doesn't unload the page to `about:blank` while the Coles screen is showing or a send is pending; a price refresh and a send never run at the same time (a send waits for a running price refresh, then runs).
4. **Store screen.** `woolworths/WoolworthsScreen.kt` is store-neutral apart from its name; it becomes `dev.weekdayfuel.app.StoreScreen`, with one instance per store ("← Weekday Fuel" bar, status text). While hidden it sets `descendantFocusability = FOCUS_BLOCK_DESCENDANTS`, and `FOCUS_AFTER_DESCENDANTS` while shown; this replaces the `isFocusable = false` flags on the Coles page so the Coles login can be typed into.
5. **Messages.** Page → host: `{type: "sendColesTrolley", lines: [{productId, quantity}]}`, `{type: "openColes", url}`, `{type: "colesCheckout"}`. Host → page: `{type: "colesTrolleyLogin"}`, `{type: "colesTrolleyDone", results: [{productId, added, reason?}]}`, `{type: "colesTrolleyError", message}`. The host accepts a line only if `productId` is a string of 4–7 digits and `quantity` a whole number from 0 to 99, deduplicated by `productId`; anything else gets `colesTrolleyError` without injecting. `openColes` opens the Coles screen on the URL if `ColesUrls.isColesPage` accepts it, else the Coles home page. `colesCheckout` opens the Coles screen on Coles' trolley page (`ColesUrls.TROLLEY_URL`, confirmed in Task 1).
6. **Page (`Weekday_Fuel.html`).** With Coles picked, the Send button reads "Send to Coles trolley" and posts `sendColesTrolley` with `colesCartLines` plus `colesRemovalLines` of the last Coles send. Progress: "Sending to Coles…". Summary: **Added N**, **Couldn't add M** (each opens its product page in the Coles screen), **Add these yourself K** (names from `manual`), **Checkout** (`colesCheckout`). New key `weekdayfuel.v1.colesSent` = `{at, fingerprint, lines: {[productId]: quantity}}`, same shape as the Woolworths `.sent` key, updated with `sentAfter` after a send. Coles product links in Shop item details post `openColes`. Every Coles-derived string goes through `esc`.
7. **Past orders (`orders.js`).** The `ordered` group's title follows the order's store: "Ordered on Coles" or "Ordered on Woolworths". A Coles shop's snapshot uses the `colesSent` lines keyed by `colesId`; Coles rows sent to the trolley go under `ordered` instead of `buy`. Stored orders keep their shape.

## Error handling

- **Logged out, or logged out mid-send:** the Coles screen opens on the login page (status "Log in to Coles to send your shop"); the send resumes after login. Closing the screen cancels the send ("Coles login cancelled").
- **Some lines fail** (unavailable, out of stock, rejected): the others still go in; failures are listed with their product pages.
- **Every line fails, or Coles rejects the whole request:** the summary says the automation may be out of date and offers the product pages one by one (guided fallback).
- **Offline, page error or no answer within 60 s:** error with **Try again**. Re-sending is safe: quantities are set, not added.

## Task 1 is a go/no-go check

On the owner's account, logged in to Coles in a Cursor browser tab (the owner logs in; the agent never sees the password):

1. Read the trolley with the request above.
2. Add one cheap catalogue item with quantity 1, change it to 2, then set it to 0, so the trolley ends as it started. The owner is told exactly what was done.
3. Confirm the headers the request needs and the response shape for success, an unknown product and a logged-out call.

Then, after the session and screen are built, on the phone: login works in the Coles screen and survives an app restart, and checkout reaches the payment step.

If 1–3 fail, stop and revisit the design before further tasks.

## Guardrails

- Coles pages never get a JavaScript bridge; only the app origin messages the host.
- The Coles login lives only in the app's WebView cookies. The Coles key is read at run time and never stored, logged or committed.
- Nothing in CI talks to Coles or Woolworths.
- Existing `localStorage` keys and stored orders keep their shape; the only new key is `weekdayfuel.v1.colesSent`.

## Verification

Automated (CI):

- `cart.js`: Coles lines for a packed item, a ticked item and a "have it" item skipped, a Woolworths-only item and a Coles-unavailable item in `manual`, removals of items no longer in the shop, `sentAfter` with Coles results.
- `trolley.js` against a fake `fetch`: logged out (401 → `needsLogin`), an existing item sent with its `orderItemId`, a removal (quantity 0), a partial failure, a rejected request, and the key never appearing in `state()`.
- `orders.js`: a Coles shop with sent lines saves them under `ordered`, titled "Ordered on Coles".
- Kotlin: line validation (bad IDs, quantities, duplicates), script state parsing, host messages.

Browser check (controller, fake host): the button follows the store, the posted lines, progress, login, summary, checkout message, `colesSent`, and Coles links posting `openColes`.

On the phone (owner):

- [ ] Log in once in the Coles screen; restart the app; still logged in.
- [ ] Starter shop with Coles picked, send: the Coles trolley matches the Buy lines.
- [ ] Send again: quantities unchanged. Remove a meal and send: its items are removed.
- [ ] Checkout reaches the payment step (placing an order optional).
- [ ] Save the order: the sent items are under "Ordered on Coles".
- [ ] Live Coles prices show your own store's name.

## Out of scope

Weekday Fuel's own Coles checkout screens (delivery times, order summary, booking); Coles specials boosts; choosing a Coles store; cheapest mix across stores.

## Release note

Send your shop to your Coles trolley too, then check out with Coles without leaving the app.
