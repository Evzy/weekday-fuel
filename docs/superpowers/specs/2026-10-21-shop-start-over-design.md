# Shop: Start over — design

Date: 2026-10-21. From Evan's acceptance testing: "We need a way to completely reset the cart and empty it if we want to restart." Choices (chat): empty what the app put in the store trolley; also clear the unbought meals.

## Behaviour

- **Where:** Shop, under the step bar on every step: a quiet "Start over" button. Hidden when there is nothing to reset (no sent record for either store with products to empty, no `state.trolley`, no unbought meals from today on, no ticks).
- **Confirm:** two-tap (existing `armed` pattern). The armed label is built from `startOverStoreOrder()` (current store first, then the other): it names exactly the store trolleys that will be emptied — e.g. "Tap again: empty the Coles trolley", "Tap again: empty the Woolworths and Coles trolleys", or no trolley wording when none will be sent — plus "and clear {n} unbought meals" when {n} > 0 (omit the meal phrase when zero).
- **Paid shops:** when **either** store's sent record has `paidAt`, the button reads "Paid — Finish this shop instead" and is disabled (not only the current store).
- **Emptying the store trolley (host present):** for each store in `startOverStoreOrder()`, send removal lines (quantity 0) for every code in `sent.lines` with quantity > 0, through the normal trolley send path (`TROLLEY[s].send`), showing send progress while each store runs. Only codes the app itself sent are touched. Stores are emptied one after the other (current store first). Failed removals are recorded by product **name** (from the sent removal lines, not the host result payload). The app-side reset still completes; failures appear in the note, not a trolley "done" result panel.
- **Send error during start over:** the error step offers "Try again" and **"Reset the app anyway"** (same app-side reset and note, including any failure detail accumulated so far).
- **No host (browser / in-store):** skip trolley writes.
- **App side, after the removals are posted (or immediately without a host):**
  - delete both sent records (`weekdayfuel.v1.sent`, `.colesSent`), `state.trolley`, `state.checkout`, shop ticks (`.shop`), and any pantry `haveIt`;
  - clear every meal from today on that isn't bought (`WeekdayFuelBought.clearUnbought` with no skip keys), keeping bought, eaten and past meals and day extras/staple toggles;
  - keep `settings.packPick`, specials choices and stock;
  - go to Review (`shopViewStep = null`).
- **Note (single hint under the step bar):** "Shop reset." without a host; with a host, "Emptied {n} product(s)…" counts **successful** removals only (per store when relevant). Append "Couldn't remove: …" with product names when any removal failed. Shown once — not duplicated and not the normal trolley result view.

## Owner-account writes

Only quantity-0 updates for products in the app's own sent record. Harmless and reversible (re-send restores them). Mention in the release notes.

## Testing

- Pure helper `WeekdayFuelCart.emptyLines(sentLines, store)` → removal lines for every positive code (Woolworths `{stockcode, quantity: 0}`, Coles `{productId, quantity: 0}`), with tests.
- Browser check without host: Start over clears meals, sent records, ticks; bought meals stay; two-tap; paid on either store disables.
- Host path: stand-in host receives removal sends; armed label matches stores to empty; paid on either store disables.

## Release

v0.27.2 (with any fix found for the trolley shortfall).
