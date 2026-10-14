# Woolworths requests and in-app checks

Evidence for the go/no-go checks in the Woolworths trolley spec. Values here are what `assets/woolworths/trolley.js` and `WoolworthsUrls.kt` must match.

## In-app checks (phone, v0.1.2+)

| Check | Result | Notes |
| --- | --- | --- |
| Woolworths product link opens in the in-app Woolworths screen | Pass | v0.1.2, 2026-10-15 |
| Log in works inside the in-app screen | Pass | No user-agent change needed |
| Still logged in after closing and reopening the app | Pass | |
| Trolley → checkout → pick a time reaches the payment step with the saved card | Pass | Backed out before paying |
| Login page URL | Not recorded | Confirm from desktop in Task 2 |
| Trolley/cart page URL | Not recorded | Confirm from desktop in Task 2 |

## Login status request

| Field | Value |
| --- | --- |
| URL | |
| Method | |
| JSON path that says logged in / out | |

## Set trolley quantity request

| Field | Value |
| --- | --- |
| URL | |
| Method | |
| Body for "Chobani 717518 quantity 2" | |
| Sending the same body twice leaves quantity 2 (set, not add)? | |
| Quantity 0 removes the product? | |
| Response status when it works | |
| Response when logged out | |

## Deli ham (175734)

| Field | Value |
| --- | --- |
| Body the site sends when adding shaved ham | |
| Can it be set by the same request? | |

## Decision

Go / no-go: in-app checks (part A) **go**, 2026-10-15. Request capture (part B) pending.
