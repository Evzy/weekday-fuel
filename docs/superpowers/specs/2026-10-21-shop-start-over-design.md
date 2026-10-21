# Shop: Start over — design

Date: 2026-10-21. From Evan's acceptance testing: "We need a way to completely reset the cart and empty it if we want to restart." Choices (chat): empty what the app put in the store trolley; also clear the unbought meals.

## Behaviour

- **Where:** Shop, under the step bar on every step: a quiet "Start over" button. Hidden when there is nothing to reset (no sent record for either store, no `state.trolley`, no unbought meals from today on, no ticks).
- **Confirm:** two-tap (existing `armed` pattern): "Tap again: empty the {store} trolley and clear {n} unbought meals". If a trolley for the *other* store was also sent, the label adds "and the {other} trolley" and both are emptied.
- **Paid shops:** when `shopPaid()` for the current store, the button reads "Paid — Finish this shop instead" and is disabled.
- **Emptying the store trolley (host present):** for each store with a sent record, send removal lines (quantity 0) for every code in `sent.lines` with quantity > 0, through the normal trolley send path (`TROLLEY[s].send`), showing the normal progress and result. Only codes the app itself sent are touched; anything Evan added by hand stays. Stores are emptied one after the other (current store first). If a removal fails, the result view lists it ("Couldn't remove: …") and the reset still completes on the app side.
- **No host (browser / in-store):** skip trolley writes.
- **App side, after the removals are posted (or immediately without a host):**
  - delete both sent records (`weekdayfuel.v1.sent`, `.colesSent`), `state.trolley`, `state.checkout`, shop ticks (`.shop`), and any pantry `haveIt`;
  - clear every meal from today on that isn't bought (`WeekdayFuelBought.clearUnbought` with no skip keys), keeping bought, eaten and past meals and day extras/staple toggles;
  - keep `settings.packPick`, specials choices and stock;
  - go to Review (`shopViewStep = null`).
- **Note:** "Shop reset. Emptied 9 products from your Woolworths trolley." (or "Shop reset." without a host).

## Owner-account writes

Only quantity-0 updates for products in the app's own sent record. Harmless and reversible (re-send restores them). Mention in the release notes.

## Testing

- Pure helper `WeekdayFuelCart.emptyLines(sentLines, store)` → removal lines for every positive code (Woolworths `{stockcode, quantity: 0}`, Coles `{productId, quantity: 0}`), with tests.
- Browser check without host: Start over clears meals, sent records, ticks; bought meals stay; two-tap; paid disables.
- Host path: stand-in host (as earlier browser checks did) receives the removal send for the store(s).

## Release

v0.27.2 (with any fix found for the trolley shortfall).
