# Checkout in the app, part 2 — design

**Status:** approved 2026-10-15; v0.5.1 released 2026-10-15, owner phone checks passed 2026-10-16; done
**Scope:** roadmap spec 4 of 5, second half: substitutions, driver note and leave unattended, and the delivery address, in the Checkout panel from `2026-10-15-checkout-design.md`
**Release:** v0.5.1, after v0.5.0 (boosts, delivery time, order summary, Pay on Woolworths)

## Goal

Everything the owner sets on Woolworths' checkout page before paying can be set in the app's Checkout panel. **Pay on Woolworths** then only needs Place order.

Single user (the owner).

## Decisions

| Question | Decision |
| --- | --- |
| Pick-up | Dropped. Delivery only; a pick-up order keeps v0.5.0's "Change pick-up on Woolworths" and gets no part-2 sections. |
| Substitutions | Each trolley item with a substitute on/off switch, plus **Allow all** and **None**. **Save** sends only the items whose switch changed, in one request. Items Woolworths excludes from substitution show as "No substitutes" without a switch. No per-item shopper notes. |
| Driver note and leave unattended | A text box (the note to the driver) and a **Leave unattended** checkbox, saved together with **Save**. The checkbox shows only when Woolworths offers it (`ShouldShowCanLeaveUnattendedPreference`). The pick-up note is sent back unchanged. |
| Address | The owner's saved addresses as a choice above the delivery times, the current one selected. Choosing another switches the delivery address straight away, then delivery times and the summary reload. A hint says switching may clear the booked time. No adding or editing addresses in the app. |
| Boosts on a write | Not re-run. Boosts run on every load (Checkout opened, Refresh, Try again), as in v0.5.0. |

Rejected:

- **Pick-up in the app** (remembered store or store search): the owner uses delivery; it needs a store search and pick-up time slots.
- **Setting substitutions from the meal plan:** the owner wants a plain list.
- **Saving the note on every keystroke:** one request per word; an explicit Save is clearer.

## Facts (Woolworths, 2026-10-15, owner logged in)

Recorded in `docs/woolworths-requests.md` by the first task. Same rules as part 1: requests from a `www.woolworths.com.au` page, `credentials: "include"`, JSON.

| What | Request | Notes |
| --- | --- | --- |
| Delivery options | `GET /apis/ui/Delivery/Options` | `{ShouldShowCanLeaveUnattendedPreference: true, DeliveryInstructions: "On the front step is fine, but I should be around to assist :)", PickupInstructions: "", CanLeaveUnattended: true, RestrictedItemsRecipient: ""}` |
| Save delivery options | `POST /apis/ui/Delivery/Options`, body `{CanLeaveUnattended, PickupInstructions, DeliveryInstructions}` (the site's own body) | `200`, the saved options (same shape as the GET without `ShouldShow…`). Verified by saving the current values (no change), 95 ms. |
| Saved addresses | `GET /apis/ui/address` | `{Address: [{AddressId: 35846303, AddressText: "U 2  94 Tennyson St, ELWOOD VIC 3184", IsPrimary: true, SuburbId, SuburbName, AreaId, PostalCode, Street1, Street2}, {AddressId: 23480611, AddressText: "4 Greta St, OAKLEIGH EAST VIC 3166", IsPrimary: false, …}]}` |
| Switch delivery address | `POST /apis/ui/Fulfilment`, body `{fulfilmentMethod: "Courier", addressId: <AddressId>}` (the site's body when an address is chosen) | Answer as for booking: `{IsSuccessful, Message}`. Not tried on the owner's account (it would change it); the booked time may be dropped when the area changes. |
| Trolley items and their substitution flag | `GET /apis/ui/Checkout` (already read for the summary) | `Model.Order.Products[]`: `Stockcode`, `DisplayName` ("Edgell Corn Kernels 420g"), `AllowSubstitution` (bool), `AdditionalAttributes.isexcludedfromsubstitution` (`"True"` / `"False"`). `Model.Order.AllowSubstitutions`: true when all are allowed. 19 items, all allowed. |
| Save substitutions | `POST /apis/ui/Checkout/substitution`, body `{Items: [{Stockcode, AllowSubstitution}]}` | `200` `{"Success": true, "ErrorMessage": ""}`. Verified by setting one item to its current value (no change), 222 ms. |

## Components

1. **Checkout script (`assets/woolworths/checkout.js`).** New result sections and three new requests:
   - Load also reads `options` (`{instructions, leaveUnattended, offerUnattended}`, delivery only) and `addresses` (`{current, list: [{id, text, primary}]}`); the summary section gains `items: [{stockcode, name, allow, fixed}]` from the same Checkout read.
   - `{action: "subs", items: [{stockcode, allow}]}`: one substitution POST; then the summary (with items) is re-read. Error: `ErrorMessage` or "not saved".
   - `{action: "options", instructions, leaveUnattended}`: reads the current options (to keep `PickupInstructions`), POSTs, and returns the saved options. Not sent for a pick-up order.
   - `{action: "address", addressId}`: refuses an id that isn't in the saved list; POSTs the switch; then re-reads bootstrap (booked time), windows, addresses and the summary.
   - Every write returns `saveError` (`null` when it worked) and only the sections it re-read; the page merges what is present.
   - `start()` validates each request shape before anything is sent.
2. **Host (Kotlin).** Page messages `checkoutSubs {items}`, `checkoutOptions {instructions, leaveUnattended}`, `checkoutAddress {addressId}`, each validated by `CheckoutJson` (stockcodes positive whole numbers, 1–200 items, booleans; note at most 500 characters; address id positive) and run like `checkoutBook`. Every request other than load is a write: never re-sent after a page swap, and a timeout or lost connection reports "Couldn't confirm the change with Woolworths. Tap Refresh to check."
3. **Checkout panel (`Weekday_Fuel.html` + `checkoutview.js`).** Three new parts in the panel, delivery orders only: the address choice at the top of Delivery time; a **Delivery options** section; a **Substitutions** section. `checkoutview.js` gains the pure helpers: the changed-items list for Save, the switch counts, and the address label.

## Flows

**Open / Refresh.** As v0.5.0; the panel also shows the address choice, Delivery options and Substitutions from the load.

**Substitutions.** Rows: item name and a switch (on = "Substitute OK"). Header: "N of M can be substituted", **Allow all**, **None**. Switch taps change only the panel; **Save** (enabled when something changed) posts `checkoutSubs` with the changed items, shows "Saving…", and on reply shows the re-read list. A failure shows "Couldn't save substitutions: <reason>" and keeps the unsaved switches.

**Delivery options.** The text box holds the current note; the checkbox the current leave-unattended setting. **Save** (enabled when either changed) posts `checkoutOptions`, shows "Saving…", then "Saved" or "Couldn't save: <reason>".

**Address.** A list of saved addresses, current one selected, with the hint "Switching may clear your delivery time". Choosing another posts `checkoutAddress` and shows "Switching address…"; on reply the booked time, day tabs, address list and summary refresh. A failure shows "Couldn't switch address: <reason>".

**Busy.** One write at a time: while any load or write runs, every Save, Book, address choice, View on Woolworths, Pay and Refresh is disabled; replies for another request are ignored.

## Error handling

- A part-2 section that failed to load says "Couldn't load <delivery options / addresses>" with **View on Woolworths**; the rest still shows. Substitutions come with the summary, so they fail with it.
- A write whose reply is lost (timeout, connection, page reload): "Couldn't confirm the change with Woolworths. Tap Refresh to check." Nothing is re-sent.
- Pick-up order: no address, options or substitutions sections; "Change pick-up on Woolworths" as before.

## Testing

- `checkout.test.js`: load returns options, addresses and items; `subs` sends only the given items in the recorded body and re-reads the summary; `options` keeps `PickupInstructions` and returns the saved options; `address` refuses an unknown id without sending, and after a switch re-reads bootstrap, windows, addresses and summary; every write's failure sets `saveError`; `start()` refuses malformed write requests.
- `checkoutview.test.js`: the changed-items list; counts; address labels.
- Kotlin: `CheckoutJson` validation of the three messages (bad stockcode, empty or oversized list, non-boolean, note over 500 characters, bad address id).
- Controller browser check with the stand-in host: each section, Save posts only changes, busy disabling, a write error, a write reply after Done ignored.
- Owner phone checks: a substitution switched off in the app shows off on Woolworths' checkout; the driver note and leave unattended saved in the app show on Woolworths; switching address in the app shows the new address on Woolworths (and switching back).

## Out of scope

Pick-up; adding or editing addresses; per-item shopper notes; the orders page (roadmap 5); placing the order.
