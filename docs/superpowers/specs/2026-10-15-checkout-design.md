# Checkout in the app — design

**Status:** approved 2026-10-15; v0.5.0 released 2026-10-15, owner phone checks pending
**Scope:** roadmap spec 4 of 5 (see `2026-10-15-deli-ham-trolley-design.md`), first half: boost every Everyday Rewards offer, pick and book a delivery time, see the order summary, then pay on Woolworths
**Release:** v0.5.0, after Suggest a day to the trolley (v0.4.0). v0.5.1 adds substitutions, driver notes and leave unattended, delivery or pick-up and the address.

## Goal

After sending the shop to the Woolworths trolley, **Checkout** opens an in-app Checkout panel instead of the Woolworths site. Opening it boosts every Everyday Rewards offer for maximum points, shows the delivery times for the next 7 days to pick from, and shows what the order will cost and earn. **Pay on Woolworths** then opens the real checkout with all of that already set, and the owner taps Place order there.

Single user (the owner).

## Decisions

| Question | Decision |
| --- | --- |
| How far checkout goes | Everything before payment. The app never places the order; **Pay on Woolworths** opens `https://www.woolworths.com.au/checkout`. |
| Releases | v0.5.0: boosts, delivery time, order summary, Pay on Woolworths. v0.5.1: substitutions, driver notes / leave unattended, delivery vs pick-up and address. |
| Promo codes | Not wanted. |
| Boosts | Automatic every time the Checkout panel opens: every offer whose `boostState` is `NOT_BOOSTED` is boosted, one request at a time. The panel lists all active offers and marks the ones for a product in the trolley. |
| Delivery time picker | Booked slot at the top with **Change**; day tabs (7 days, each with its price range); that day's slots with price; the cheapest available slot of each day marked; full or closed slots greyed. Tapping a slot books it straight away. |
| "View on Woolworths" | Each section has one; it opens `https://www.woolworths.com.au/checkout`, the page that holds all three on the site. |
| Pick-up orders | v0.5.0 shows the booked pick-up time and summary but does not list pick-up slots; the Delivery time section says "Change pick-up times on Woolworths" with View on Woolworths. |

Rejected:

- **Native requests from Kotlin with the WebView's cookies:** copies the login out of the WebView and risks Woolworths' bot protection (Akamai sensor requests are sent on checkout clicks).
- **Driving the real checkout page by clicking for the owner:** breaks whenever the page layout changes.
- **A Boost all button:** the owner wants every boost on every time; there is nothing to decide.

## Facts (Woolworths, 2026-10-15, owner logged in)

Recorded in `docs/woolworths-requests.md` by the first task. All requests are made from a `www.woolworths.com.au` page with `credentials: "include"`.

| What | Request | Notes |
| --- | --- | --- |
| Login, address, booked time, minimum spend, trolley | `GET /api/ui/v2/bootstrap` | `ShopperRequest.IsGuest`; `GetDeliveryInfoRequest.DeliveryMethod` (`"Courier"` for delivery), `.Address.{AddressId, AreaId, SuburbId}`, `.ReservedTime` (`null` or `{Id, StartDateTime, EndDateTime, TimeWindow "5:00am - 10:00am", CutOffDateTime}`), `.MinimumSpend`; `TrolleyRequest.AvailableItems[].Stockcode` |
| Hashed rewards card | `GET /api/v3/ui/shopper/rewards/crn/hash` | A 64-character JSON string |
| Active offers | `GET https://prod.api-wr.com/wx-rtl-offer-v2/offers?filter[status]=ACTIVE` | Headers `customer-identity: <hash>`, `client_id: IRfFJjr4Px9UY1XxKtSOAUYGTpelx0S0Q` (the site's public id), `customer-timezone: Australia/Sydney`, `channel: WOW_WEB`, `Content-Type: application/json`; no cookies. `data[]`: `id`, `attributes.boostState` (`BOOSTED` / `NOT_BOOSTED`), `attributes.display.heading` ("Collect 60 points"), `.display.description.summary`, `.display.primaryProductId` (a stockcode string), `attributes.coupons[0].id`, `.coupons[0].attributes.redemption.{endDateTime, minimumSpend}` (minimum spend in cents). 12 active, 2 boosted. |
| Boost one offer | `POST /api/v3/ui/rewards/offers/boost/<couponId>`, body `{}` | `200`, body `true`; the offer then reads `BOOSTED`. Verified with the 60-point tomatoes offer. |
| Delivery times | `GET /api/v3/ui/fulfilment/windows?areaId=&fulfilmentMethod=Courier&addressId=&suburbId=` | `Days[7]`: `Date`, `Available`, `ClosedText`, `Times[]`: `Id`, `Available`, `TimeWindow` ("5am - 10am"), `StartDateTime`, `EndDateTime`, `Price`, `SalePrice`, `IsEcoWindow`, `IsExpress`, `CutOffDateTime` |
| Book a time | `POST /apis/ui/Fulfilment`, body `{"addressId":<AddressId>,"fulfilmentMethod":"Courier","timeslotId":<slot Id>,"tradingAccount":null,"windowDate":"2026-10-21"}` (`windowDate` is the slot's day) | `200` `{"IsSuccessful":true,"Message":null,...}`. Booking replaces any earlier booking. |
| Order summary | `GET /apis/ui/Checkout` | `Model.Order`: `Subtotal`, `Savings`, `DeliveryFee`, `DeliveryFeeBeforeDiscount`, `PackagingFee`, `PackagingFeeLabel` ("Paper bags"), `TotalIncludingGst`, `BalanceToPay`, `TotalRewardsPointsEarned`, `UnavailableProducts[]`, `RestrictedProducts[]`; `Model.CheckoutSubtotalErrors` (text, empty when fine) |

## Components

1. **Checkout script (`assets/woolworths/checkout.js`, new).** Runs in the hidden Woolworths screen like `prices.js`: `window.__weekdayFuelCheckout.start(request)` and `.state()`. Two requests:
   - `{action: "load"}`: bootstrap (stop with `loggedOut` if `IsGuest`); offers, then boost each `NOT_BOOSTED` one in turn; windows (delivery only); summary. Each section is read separately, so one failing leaves the others.
   - `{action: "book", timeslotId, windowDate}`: book, then re-read bootstrap (booked time) and summary.
   - Result: `{phase: "done", loggedOut, boosts, windows, booked, summary}`, where a section that failed is `{error: "..."}` (HTTP status or "not available"). `phase: "error"` only when bootstrap itself fails.
2. **Host (Kotlin).** `WoolworthsSession` gains `checkout(requestJson)` and `cancelCheckout()`, run like prices (load the shop page if needed, inject, poll, watchdog 60 s). `MainActivity` handles page messages `checkoutLoad` and `checkoutBook` and replies `checkoutDone` (the script result) or `checkoutError` (message). The existing `checkout` message (open the Woolworths site) is replaced by `openWoolworths` with the checkout URL. `WoolworthsUrls.CHECKOUT_URL = "https://www.woolworths.com.au/checkout"`.
3. **Checkout panel (`Weekday_Fuel.html`).** Opened by the trolley results' **Checkout** button. Shop tab view with three sections and **Pay on Woolworths**. A small pure helper module (`checkoutview.js`) shapes the script result for display: offer rows with "In your trolley", slots grouped by day with price range and cheapest, money lines; it is what the Node tests cover.

## Flows

**Open.** Tap **Checkout** in the trolley results. The panel shows "Boosting offers and loading delivery times…" and posts `checkoutLoad`. On `checkoutDone`:

- Logged out: "Log in to Woolworths, then tap Try again" with **Log in** (opens the login page in the Woolworths screen) and **Try again**.
- **Boosts:** "Boosted N offers · M were already on". Rows: heading, description, "Min spend $3" when set, "In your trolley" when `primaryProductId` matches a trolley stockcode. Offers whose boost failed: "Couldn't boost" with the reason. **View on Woolworths**.
- **Delivery time:** the booked slot ("Wed 21 Oct, 5:00am - 10:00am, book by Tue 9 pm") with **Change**, or "No time booked". Day tabs show the date and price range ("$2 - $14"); the chosen day lists its slots with price, "Cheapest" on the lowest-priced available slot, "Eco" on eco windows, unavailable slots greyed. **View on Woolworths**.
- **Order summary:** Subtotal, Savings, Delivery fee (with "was $15" when discounted), bag fee with its label, Total, "You'll collect N points". `CheckoutSubtotalErrors` shown as a hint (minimum order and similar). Unavailable and restricted products listed by name. **View on Woolworths**.
- **Pay on Woolworths** opens the checkout URL in the Woolworths screen. With no time booked, a hint above it says "Book a delivery time first, or pick one on Woolworths". **Done** closes the panel back to the trolley results.

**Book.** Tap a slot. It shows "Booking…" and posts `checkoutBook`. On `checkoutDone` the booked slot and summary refresh (delivery fee changes with the slot). A failed booking shows "Couldn't book that time: <message>" and keeps the old booking.

**Change.** **Change** scrolls to the day tabs, on the booked day.

**Busy.** While a load or booking runs, slot taps and Try again are ignored; replies arriving after the panel is closed are ignored.

## Error handling

- Bootstrap fails (offline, timeout): the panel says "Couldn't reach Woolworths. Check your connection, then tap Try again" with **View on Woolworths**.
- A section fails: that section says "Couldn't load <boosts / delivery times / the order summary>" and **View on Woolworths**; the rest still shows. A 4xx answer adds "Woolworths may have changed their website", as the trolley does.
- Some boosts fail: listed under "Couldn't boost"; the rest still count.
- Pick-up (`DeliveryMethod` not `"Courier"`): no slot list; booked time and summary still show; "Change pick-up times on Woolworths".
- Empty trolley: the summary shows $0 and Woolworths' own message; Pay on Woolworths still works.

## Testing

- `checkout.test.js` (Node, fake `fetch`): logged out stops before any boost; only `NOT_BOOSTED` offers are boosted, by coupon id, one at a time; a failed boost is reported and the others continue; offers headers carry the hash; windows request uses the bootstrap address ids and is skipped for pick-up; each section's failure leaves the others; `book` sends the recorded body and re-reads booked time and summary.
- `checkoutview.test.js`: "In your trolley" matching; day price ranges and cheapest slot (ignoring unavailable); money lines with and without delivery discount; min spend in dollars.
- Kotlin unit tests: `HostMessages` for `checkoutDone` / `checkoutError`; parsing the page's `checkoutBook` (rejects a missing timeslot id or bad date).
- Controller browser check with the stand-in host: open, boosts list, day tabs, book a slot, section error, logged out, Pay on Woolworths posts the checkout URL.
- Owner phone checks: opening Checkout boosts every offer (the Everyday Rewards app shows them all boosted); booking a time in the app shows that time on Woolworths' checkout; Pay on Woolworths opens the checkout with the time set; the totals match the site.

## Out of scope

Placing the order or paying in the app; promo codes; substitutions, driver notes, leave unattended, pick-up slots and changing the address (v0.5.1); the orders page (roadmap 5); a Coles checkout.
