# Send the shop to the Woolworths trolley — design

**Status:** done (v0.2.0)
**Scope:** fill the Woolworths trolley from Build a shop, then check out in an in-app Woolworths screen

## Goal

From the Shop tab, one tap puts everything still left to buy into the owner's Woolworths online trolley, with the right products and pack counts. The owner then picks a delivery/pickup time and pays (saved card) without leaving Weekday Fuel.

Single user (the owner). No multi-user auth concerns.

## Decisions

| Question | Decision |
| --- | --- |
| Where it runs | On the phone, inside the app. No PC script, no server. |
| How far automation goes | Fill the trolley only. The owner chooses the slot and pays. |
| Which store | Woolworths only. Coles-only items are listed for the owner to add manually. |
| What is sent | Build a shop rows that are **not ticked** ("Left to buy"). |
| Products already in the trolley | **Set** to the app's quantity (no doubling on re-send); unrelated trolley items untouched. |
| Mechanism | The app runs a script inside a logged-in woolworths.com.au page that sends the same "set quantity in trolley" requests the website itself uses. |
| Checkout | Woolworths' own checkout pages, shown in an in-app Woolworths screen. |

Rejected:

- **Driving the website UI (Playwright-style tapping):** ~35 page loads, slow, and breaks whenever page layout changes.
- **Guided manual stepping through product pages:** does not meet "do the adding for me". Kept as the fallback when automation fails (see Error handling).
- **Desktop Playwright / server:** Playwright cannot run on Android, and a server breaks the no-backend rule.

## Direction (not in this spec)

The long-term aim is for the whole flow to happen inside Weekday Fuel's own screens, with Woolworths working in the background: Weekday Fuel's own slot picker, order summary, and place-order with the saved card. This spec builds the background session those later specs will drive. Each later step gets its own spec once Woolworths' checkout requests are understood.

## Components

1. **Send button (HTML, Shop tab).** "Send to Woolworths trolley" under the Build a shop list. Computes cart lines and posts them to the Android host. Progress and the result summary are also rendered by the HTML, in the existing Shop styling (the HTML stays the app).
2. **Cart-line calculation (HTML).** A pure function in its own file, `apps/android/app/src/main/assets/weekday_fuel/cart.js`, loaded by `Weekday_Fuel.html`. Input: Build a shop rows (with a numeric pack count per row, see Data), ticks, and `LINKS`. Output: Woolworths lines `{stockcode, quantity, name, itemId}` plus a "do it yourself" list. `buildList()` gains a numeric pack count per row without changing its existing text output.
3. **Woolworths session (Kotlin, `dev.weekdayfuel.app.woolworths`).** Owns a WebView on woolworths.com.au independently of whether it is visible. Detects logged-in vs logged-out, runs the trolley script, and reports progress/results. Later specs add slot reading and order placement here.
4. **Trolley script (JS asset, e.g. `assets/woolworths/trolley.js`).** Runs inside the Woolworths page. For each line, sends the site's own set-quantity trolley request with the page's session; returns a per-line result (`added`, or `failed` with a reason such as the HTTP status; out-of-stock and unavailable products surface as `failed`).
5. **Woolworths screen (Kotlin).** Shows the session's WebView full-screen with a slim top bar ("← Weekday Fuel"). Shown only for login and checkout, and when the owner taps a Woolworths product link.
6. **Page-to-host channel.** `WebViewCompat.addWebMessageListener` on the Weekday Fuel WebView, restricted to origin `https://appassets.androidplatform.net`. Only Weekday Fuel's page can ask the host to send a trolley or open the Woolworths screen. Woolworths pages get no bridge to Weekday Fuel or its saved data; their results come back through `evaluateJavascript` on the session WebView only.

## Flow

1. Owner taps **Send to Woolworths trolley**. The page computes cart lines and posts them to the host.
2. The host's Woolworths session loads woolworths.com.au in the background.
   - Not logged in: the Woolworths screen opens on the login page; once login is detected, sending resumes automatically.
3. The trolley script sets each line; the page shows progress ("Adding 18 of 31…").
4. The page shows a summary: **Added N**, **Couldn't add M** (each opens its product page in the Woolworths screen), **Add these yourself K**, and a **Checkout** button.
5. **Checkout** opens the Woolworths screen on the trolley/checkout page; the owner picks a time and pays there. "← Weekday Fuel" returns to the app.

Woolworths product links in Shop item details open in the Woolworths screen (logged in) instead of the external browser. Coles links still open externally.

## Data

Cart lines are computed from Build a shop rows that are not ticked. Quantities are whole packs, the same numbers behind each row's "Buy:" text. The Woolworths stockcode is parsed from the existing `LINKS` URLs (`/shop/productdetails/<stockcode>`), so there is no second ID list.

| Item type | Trolley lines |
| --- | --- |
| Packed items with a `PACK` entry (eggs, yoghurt, cheese, frozen veg, …) | Pack count `n` from the existing `Math.ceil(amount / pack size)` |
| Dare, Grenade | One per fixture day |
| Pasta | Spaghetti and/or macaroni × 1 each, depending on picked meals (same rule as the "Buy:" text) |
| Items with two Woolworths links (`sauces1`, `salsa`, `paste`) | × 1 of each linked product |
| "Lasts many meals" items (no `PACK` entry, Woolworths link) | × 1 |
| Deli ham (`ham`) | Not sent in this spec; listed under "Add these yourself" (sold by weight). Task 1 checks whether it can be automated. |
| Coles-only items (`breast`, `mince`, `wraps`) and items with no link (`evap`, `curry`) | Not sent; listed under "Add these yourself" |

## Error handling

- **Logged out mid-send:** treated like not logged in: show login, resume after.
- **Some lines fail** (out of stock, unavailable at the selected store, discontinued): the others still go in; failures are listed with their product pages.
- **All lines fail the same way** (most likely Woolworths changed the request): the summary says the automation is out of date and offers the product pages one by one (guided fallback).
- **No network / timeout:** summary shows the error with **Try again**. Re-sending is safe because lines set quantities rather than add.

## Task 1 is a go/no-go check

Before building the rest, confirm on the owner's logged-in account:

1. Login works inside the app's WebView, and the session survives an app restart.
2. The exact request(s) the website uses to set a product's trolley quantity, and that the same request works from a script in the page.
3. Checkout (slot selection through to the payment step) works inside the WebView with the saved card.
4. Whether deli items sold by weight can be set the same way.

If 1–3 fail, stop and revisit the design before further tasks.

## Guardrail changes

- **Network:** the no-backend rule gains one allowed destination: `woolworths.com.au`, only after the owner taps Send, Checkout, or a Woolworths link. Traffic goes directly from the phone; no server.
- **Frozen HTML:** this is the first spec that changes `Weekday_Fuel.html`, so the CI step "Shipped HTML matches frozen seed" is removed. `docs/seed/Weekday_Fuel.html` stays as the historical v0.
- **Credentials:** the Woolworths login exists only in the app's WebView cookie storage on the phone. Nothing is sent anywhere else. Logging out in the Woolworths screen clears it.

## Data impact

None. Cart lines are computed on each send and not stored; the shape of saved `localStorage` data does not change.

## Verification

Automated (CI):

- `cart.js` unit tests with Node's built-in test runner (`node --test`), using rows shaped like `buildList()` output and a verbatim subset of `LINKS`: a packed item, a ticked item excluded, Dare days, pasta with one or both pasta meals, two-link items, deli/Coles-only/unlinked items routed to "Add these yourself". The full starter shop is checked on the phone.
- JVM tests for parsing the trolley script's per-line results in Kotlin.
- The existing Android 15 launch smoke test still passes.
- Nothing in CI talks to the real Woolworths site.

On the phone (owner's account):

- [ ] Log in once in the Woolworths screen; restart the app; still logged in.
- [ ] Use the starter shop and send; trolley on woolworths.com.au matches the Buy lines.
- [ ] Send again; quantities unchanged (no doubling).
- [ ] Tick one item, change a serve count, send; the ticked item is unchanged in the trolley and the changed item's quantity follows.
- [ ] "Add these yourself" lists chicken breast, mince, wraps, ham, evaporated milk, curry paste when relevant.
- [ ] Checkout reaches the payment step with the saved card (placing an order optional).
- [ ] A Woolworths product link from Shop opens in the Woolworths screen, logged in.

## Out of scope

- Coles trolley.
- Weekday Fuel's own slot picker / payment / order placement (future specs).
- Price or availability sync back into the app.
- Shopping-list editing beyond existing ticks and serves.

## Release note

Send your shopping list straight to your Woolworths trolley, then check out without leaving the app.
