# Woolworths requests and in-app checks

Evidence for the go/no-go checks in the Woolworths trolley spec. Values here are what `assets/woolworths/trolley.js` and `WoolworthsUrls.kt` must match.

## In-app checks (phone, v0.1.2+)

| Check | Result | Notes |
| --- | --- | --- |
| Woolworths product link opens in the in-app Woolworths screen | Pass | v0.1.2, 2026-10-15 |
| Log in works inside the in-app screen | Pass | No user-agent change needed |
| Still logged in after closing and reopening the app | Pass | |
| Trolley → checkout → pick a time reaches the payment step with the saved card | Pass | Backed out before paying |
| Login page URL | `https://www.woolworths.com.au/shop/securelogin` | Shows a Login button that goes to `auth.woolworths.com.au/u/login/identifier?...` (desktop, 2026-10-15) |
| Trolley/cart page URL | `https://www.woolworths.com.au/shop/checkout` | The cart panel's Checkout link; opens "Have You Forgotten", the first checkout step. `/shop/cart` redirects to the home page. |

## Login status request

Captured on desktop Chromium, 2026-10-15.

| Field | Value |
| --- | --- |
| URL | `/api/ui/v2/bootstrap` |
| Method | `GET`, `credentials: "include"` |
| JSON path that says logged in / out | `ShopperRequest.IsGuest`: `false` logged in, `true` logged out. There is no `IsLoggedIn` field. `ShopperDetailsRequest` is only present when logged in. |

## Set trolley quantity request

| Field | Value |
| --- | --- |
| URL | `/api/v3/ui/trolley/update` |
| Method | `POST`, `credentials: "include"`, `Content-Type: application/json` |
| Body for "Chobani 717518 quantity 2" | `{"items":[{"stockcode":717518,"quantity":2,"source":"ProductDetail","diagnostics":"0","searchTerm":null,"evaluateRewardPoints":false,"offerId":null,"profileId":null,"priceLevel":null}]}` (same shape the site's own Add to cart button sends) |
| Sending the same body twice leaves quantity 2 (set, not add)? | Yes. Trolley showed 2 after each of two sends. |
| Quantity 0 removes the product? | Yes. Checked again 2026-10-15 logged in with soy sauce 198763 (not in the trolley): set to 1, then 0; `TrolleyRequest` in `/api/ui/v2/bootstrap` listed it after the 1 and not after the 0. The owner's trolley was left as before. |
| Response for a removal (quantity 0) | `200` with `UpdatedItems: []`, the same as an unknown stockcode. Sending 0 again for a product no longer in the trolley gives the same answer. `trolley.js` counts a quantity-0 line answered with 2xx as `removed`. |
| Response status when it works | `200`, JSON with `UpdatedItems: [{ Stockcode, Quantity, QuantityInTrolley, IsAvailable, ... }]` |
| Response for an unknown stockcode | `200` with `UpdatedItems: []`. A line only counts as added when `UpdatedItems` contains its `Stockcode`. |
| Response when logged out | `200`, and the item goes into a separate guest trolley (the owner's trolley is untouched). Login must be checked first via the bootstrap request. |

## Deli ham (175734)

| Field | Value |
| --- | --- |
| Body the site sends when adding shaved ham | Same request and body shape, `quantity` in kilograms: `0.1` for the minimum 100 g. |
| Product facts (`/apis/ui/product/detail/175734`, 2026-10-15) | `Unit` `KG`, `MinimumQuantity` 0.1, `IncrementalMinimumQuantity` 100 g, `SupplyLimit` 10, $28.00/kg |
| Automated? | Yes, from v0.2.1: Build a shop rounds up to the next 100 g and sends the weight in kilograms. |

## Decision

Go / no-go: **Go**, 2026-10-15. In-app checks pass; the script request is accepted from page JavaScript and sets (not adds) the quantity.

## Product prices request (2026-10-15, logged out)

- `GET /apis/ui/products/<stockcode>,<stockcode>,...` from a woolworths.com.au page returns HTTP 200 and a JSON array, one product per known stockcode. All 45 catalogue stockcodes in one request returned 45 products; an unknown stockcode is silently left out. `prices.js` asks for 40 at a time.
- Fields used: `Stockcode`, `Price` (per kg when `Unit` is `"KG"`, e.g. ham 175734 at 28), `WasPrice` (equals `Price` when not reduced), `IsOnSpecial`, `IsAvailable`, `IsInStock`, `IsPurchasable`.
- Reduced products can have `WasPrice > Price` with `IsOnSpecial: false` (mince 577860: 9.8 was 10; wraps 919345: 5.6 was 6.6), so the app treats `WasPrice > Price` or `IsOnSpecial` as a special.
- No login needed.

## Checkout requests (2026-10-15, logged in)

Used by `assets/woolworths/checkout.js` (v0.5.0). All from a `www.woolworths.com.au` page with `credentials: "include"` unless noted.

| What | Request | Notes |
| --- | --- | --- |
| Login, address, booked time, minimum spend | `GET /api/ui/v2/bootstrap` | `GetDeliveryInfoRequest.DeliveryMethod` (`"Courier"` for delivery), `.Address.{AddressId, AreaId, SuburbId}`, `.ReservedTime` (`null` or `{Id, StartDateTime, EndDateTime, TimeWindow, CutOffDateTime}`), `.MinimumSpend` |
| Hashed rewards card | `GET /api/v3/ui/shopper/rewards/crn/hash` | A 64-character JSON string |
| Active Everyday Rewards offers | `GET https://prod.api-wr.com/wx-rtl-offer-v2/offers?filter[status]=ACTIVE` | No cookies. Headers `customer-identity: <hash>`, `client_id: IRfFJjr4Px9UY1XxKtSOAUYGTpelx0S0Q` (the site's public id), `customer-timezone: Australia/Sydney`, `channel: WOW_WEB`. `data[].attributes.boostState` is `BOOSTED` or `NOT_BOOSTED`; the coupon id is `data[].attributes.coupons[0].id`; `redemption.minimumSpend` is in cents. |
| Boost one offer | `POST /api/v3/ui/rewards/offers/boost/<couponId>`, body `{}` | `200`, body `true`. Checked with the 60-point tomatoes offer: `NOT_BOOSTED` before, `BOOSTED` after. There is no boost-all request on the shop site. |
| Delivery times | `GET /api/v3/ui/fulfilment/windows?areaId=&fulfilmentMethod=Courier&addressId=&suburbId=` | 7 `Days`, each with a flat `Times` list of slots: `Id`, `Available`, `TimeWindow` ("5am - 10am"), `Price`, `SalePrice`, `IsEcoWindow`, `CutOffDateTime` |
| Book a time | `POST /apis/ui/Fulfilment`, body `{"addressId":<AddressId>,"fulfilmentMethod":"Courier","timeslotId":<slot Id>,"tradingAccount":null,"windowDate":"YYYY-MM-DD"}` | `200` `{"IsSuccessful":true,...}`; `bootstrap` then shows the slot in `ReservedTime`. Captured from the site's own Continue button. |
| Order summary | `GET /apis/ui/Checkout` | `Model.Order` totals: `Subtotal` (after savings), `Savings`, `DeliveryFee`, `DeliveryFeeBeforeDiscount`, `PackagingFee` + `PackagingFeeLabel`, `TotalIncludingGst`, `BalanceToPay`, `TotalRewardsPointsEarned`; `UnavailableProducts`, `RestrictedProducts`; `Model.CheckoutSubtotalErrors` |
| Checkout page | `https://www.woolworths.com.au/checkout` | One page: address, date and time, driver notes, items, promo codes, totals, payment, Place order. The site's own clicks also send Akamai sensor requests. |
