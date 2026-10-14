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
| Quantity 0 removes the product? | Yes |
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
