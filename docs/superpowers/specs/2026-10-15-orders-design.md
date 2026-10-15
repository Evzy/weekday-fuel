# Past orders — design

**Status:** approved 2026-10-15
**Scope:** roadmap spec 5 of 5 (see `2026-10-15-deli-ham-trolley-design.md`): finishing a shop saves it as an order, and Build a shop lists past orders
**Release:** v0.6.0

## Goal

When the owner finishes a shop, the app keeps a record of it: what was ordered on Woolworths, and what wasn't ordered and why (already had it, pantry stock presumed at home, or still to buy by hand). Past orders are history to look back on, not a to-do list.

Single user (the owner). Everything stays on the phone; nothing new is read from Woolworths.

## Decisions

| Question | Decision |
| --- | --- |
| What an order is | A frozen copy (snapshot) of the shop at the moment it is saved: names, amounts, prices and the meals each item was for. Later price or catalogue changes never rewrite an order. |
| When it is saved | The two-tap **Start next shop** becomes **Save order and start next shop**. The second tap saves the order, then clears days, meals, ticks and the sent record exactly as before. With no shop rows and nothing sent, the button keeps its old text and saves nothing. |
| Groups | **Ordered on Woolworths**, **Already had**, **Pantry, presumed at home**, **Buy yourself** (rules below). No tick boxes: the order is a record. |
| Where | A **Past orders** panel at the bottom of Build a shop, newest first, also shown when the shop is empty. Not in Full list. No new tab. |
| Keeping | The last 30 orders. Each can be deleted with two taps. |

Rejected:

- **Reading the placed order from Woolworths** (status, items not delivered): more research and requests for little gain; the owner wants the app's own record.
- **An active "left to get" checklist:** the owner wants history.
- **A sixth tab:** the bottom bar is full; orders sit with the shop they came from.
- **Storing only the inputs (picks, days, ticks) and rebuilding on view:** old orders would change when prices or recipes change.

## Group rules

Inputs at save time: the Build a shop rows (`CAT.shopList`), the Shop ticks, the sent record (`weekdayfuel.v1.sent`: stockcode → quantity the app last put in the Woolworths trolley) and the store setting. Each row goes in exactly one group, checked in this order:

1. **Ordered on Woolworths:** the row's Woolworths product (`row.woolies.product.stockcode`) has a positive quantity in the sent record. The amount is the sent quantity.
2. **Already had:** the row is ticked in Shop.
3. **Pantry, presumed at home:** a pantry and freezer row (`sec` 2).
4. **Buy yourself:** everything else, with where to get it: the chosen store's product when it has one, otherwise the other store's, otherwise "no online store". This covers Coles-only items, items Woolworths has unavailable online, items that couldn't be added, items never sent, and the whole list when the store is Coles.

A product in the sent record that no shop row uses (the shop changed after the last send) is still in the trolley, so it is listed under **Ordered on Woolworths** with the note "not in this shop", named from the catalogue (or "Product <stockcode>").

## Components

1. **`assets/weekday_fuel/orders.js` (new, pure, no DOM or storage).**
   - `snapshot(rows, ticks, sentLines, opts)` returns an order `{v: 1, id, at, store, days, meals, delivery, wooliesTotal, groups: {ordered, had, pantry, buy}}`. `opts` gives `at` (ISO time), `store` ("woolies" or "coles"), `days` (ISO dates), `meals` (`[{name, serves}]`), `delivery` (text or null), `wooliesTotal` (number or null), `forText(row)` (the "For Tue · Toasty" label) and `product(stockcode)` (`{name, price, perKg}` or null). Each group item is `{name, buy, cost, store, note, for}`; `store` is "woolies", "coles" or null. Amounts for ordered items use the row's own `buy` text and cost when the sent quantity equals the row's quantity; otherwise "<g>g" (by weight) or "<n> pack(s)" at the product price.
   - `isEmpty(rows, sentLines)`: true when there are no rows and nothing in the sent record, so there is nothing to save.
   - `parseOrders(json)` reads the stored list defensively (bad JSON, non-arrays and malformed orders are dropped) and `addOrder(list, order)` puts the new order first and keeps 30.
   - `summaryLine(order)`: "Thu 15 Oct · 23 ordered · $145.43" (`wooliesTotal` when known, else the ordered items' cost with "about").
2. **Storage.** A new key `weekdayfuel.v1.orders` (JSON array, newest first). Existing keys keep their shape. If writing fails (storage full), the shop is not cleared and Shop shows "Couldn't save the order. Nothing was cleared."
3. **Shop (`Weekday_Fuel.html`).** The button text and the save on the second tap; the **Past orders** panel; `delivery` and `wooliesTotal` come from the Checkout panel's last result in this session (booked time label and summary total; kept when the panel is closed with Done) when there is one, else null.

## Flows

**Save.** Tap **Save order and start next shop**: it arms ("Tap again to save this order and clear days, meals and ticks"). The second tap builds the snapshot, writes the list, then clears the shop. Past orders shows the new order first.

**Look back.** Past orders lists one line per order. Tapping a line expands it: days and meals covered, the delivery time if known, then the four groups (empty groups hidden), each item "name · amount · $cost" with its "For …" line and, for Buy yourself, the store in its colour. Tapping again collapses it.

**Delete.** In an expanded order, **Delete** arms ("Tap again to delete this order"); the second tap removes it.

## Error handling

- Stored orders that fail to parse are skipped; the rest still show. A wholly unreadable list shows as no past orders and is not overwritten until the next save.
- Every order-derived string goes through `esc`.
- Save failure: as in Components 2.

## Testing

- `orders.test.js`: each group rule (sent, ticked, pantry, the rest), the order of precedence (a ticked item that was sent counts as ordered), the sent-quantity-differs amount, a stray sent product, a Coles shop (nothing ordered unless sent; buy at Coles), `isEmpty`, `parseOrders` with bad input, `addOrder` keeping 30, `summaryLine` with and without a total.
- Controller browser check: Save arms then saves; the shop clears; Past orders shows and expands the order with its groups; Delete; a failed storage write leaves the shop untouched; escaping.
- Owner phone checks: after a real Woolworths order, Save order and start next shop; the order shows what went in the trolley and what didn't; it survives closing and reopening the app.

## Out of scope

Reading orders from Woolworths; reordering a past order; editing an order; Coles orders beyond the Buy yourself group; exporting.
