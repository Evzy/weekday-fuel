# v0.24.0: Shop steps and "bought or to buy": implementation plan

Spec: `docs/superpowers/specs/2026-10-20-flow-redesign-design.md` → "Shop (v0.24.0)" including "Bought or to buy" (commit 89e0be9). Commit each task to `main` by explicit path (don't stage CRLF-only files); CI green before the next. Main file `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`; pure modules beside it; tests in `apps/android/app/src/test/js/`.

## Task 1: Bought or to buy (model)

Pure helpers in `bought.js` (tests in `bought.test.js`):

- `mealKey(date, index, id)` → `"<date>|<index>|<id>"`; `parseMealKey(k)`.
- `toBuyKeys(days, dates, isBought)` → keys for every meal on `dates` that isn't bought and isn't `shop === false` (sorted, stable).
- `markBoughtKeys(days, keys, orderId)` → `{ days, changed }`: marks bought each meal whose key still matches (same date, index and id); skips missing/changed ones. Same `bought` value shape as `markBought`.
- `sameKeys(a, b)` → boolean; `addedSince(sentKeys, nowKeys)` → count of keys in `nowKeys` not in `sentKeys` (for "N meals added since you sent"); `changedSince` → true when the sets differ at all.

Page:

- `shopDays()` is always the derived set (`WeekdayFuelCartAdd.cartDays`); remove the frozen branch, the freeze in the trolley Done handler, `trolley.days`, and the `settings.shopDays` writes/clears (leave the stored key alone).
- Remove `held` handling: `holdMealForNextCart`, `releaseHeldMealsForNextCart`, the frozen checks in `applyPlan` / `suggestWeek` / `suggestDay` / `swapMeal` / `doAddMeal` / `add`, `NEXT_SHOP_NOTE`, the "Next cart" section, `reserved()`'s `m.held` skip in `inventory.js` (and its test). One-time load migration: for every meal with `held`, `delete m.shop; delete m.held;` save those days (flag `settings.heldMigrated`).
- Sending (`sendTrolley`): store `meals: toBuyKeys(state.days, shopDays(), isBought)` on `state.trolley`; on Done write it into the sent record (`rec.meals`). Resend replaces it.
- `nextshop` (Finish): if a sent record with `meals` exists for the current store (or either store), use `markBoughtKeys` with the union of both stores' `meals`; otherwise (nothing sent) keep today's `markBought(state.days, shopDays(), orderId)`.
- Fingerprint/"out of date" logic: keep it, but the Review UI (Task 2) uses `changedSince(sent.meals, toBuyKeys(...))` for the "added since you sent" banner. Older sent records without `meals` fall back to the existing fingerprint check.
- Check `inventory.js` `reserved()`: with derived shop days, meals on to-buy days are on the list (not reserved); bought meals reserved; `shop:false` from today on reserved; past auto-eaten. Confirm tests still express this; adjust only where `held`/frozen semantics were assumed.
- Tests: the new `bought.js` helpers; inventory tests updated for no `held`.

## Task 2: Stepped Shop

- **Step bar** at the top: "1 Review · 2 Send · 3 Check out · 4 Done", current step bold. Derivation: `state.trolley` sending/login → Send; a sent record for the store and not paid → Check out; paid (`trolley.checkedOut` / `checkout.paid`) → Done; else Review. Each step label is tappable only for steps already reached (to look back); Review is always reachable.
- **Review:**
  - Summary line: "Tue 20 – Fri 23 · 12 meals" and the store switch as one control: "[Woolworths $186.28] [Coles $186.16 · 1 missing]" (the selected store highlighted). Remove the separate totals block.
  - Banner when a trolley was sent and `changedSince`: "2 meals added since you sent" (or "Your meals changed since you sent") + **Send these too** (= the existing send path). After paid: "Finish this shop first" disabled, plus a line "New meals will be in your next shop."
  - Days: one line each ("Tue 20 · 3 meals", flags and gap markers between lines), tap to expand to the existing day panel (meals, Leave out).
  - Items: one line each: "{short name} {buy text} · ${price}" with a tick box; tap the line to expand the existing detail (what it's for, the other store, links, swaps). Group headings (Staples, Fresh, Pantry & freezer) stay as small eyebrows. Drop "tap for details" text and the "Coles · Woolworths" double product lines from the collapsed row.
  - **Already at home (n)** collapsed line (the existing covered list + ticked items) with a link "At home" → Kitchen view.
  - Primary button: **Send to {store} trolley** (no host: "Shopping in store? Tick as you go, then Finish this shop." and the Finish button).
- **Send:** existing progress / "Add these yourself" UI under the step bar. Primary: **Check out**.
- **Check out:** existing Woolworths in-app checkout or Coles link; primary **I've paid** (sets the existing paid/checkedOut flags).
- **Done:** **Finish this shop** (existing `nextshop` two-tap) with a one-line explanation "Marks these meals bought and adds the food to At home." Past orders link.
- Remove: "Save order and start next shop" label (renamed), the old totals/store block, "Left to buy" line if redundant with the summary, the "Meals in this cart" heading wording → none (days list is self-explanatory).
- **Price consistency:** `suggestWeek` and the plan sheet/notes quote the selected store's cart total computed by the same function the Shop summary uses.
- Escape every store/meal/catalogue string with `esc`.

## Task 3: Review, walkthrough, release v0.24.0

- Review (default-model reviewer) of the whole v0.24.0 diff + browser walkthrough at 400×860 from fresh data (port 8783): plan week → Shop Review → expand an item → tick → (stub host) Send → Check out → I've paid → Finish → meals bought, cart empty; then plan more after a send → banner → Send these too; no-host path Finish marks all bought. Tap counts.
- Release: versionCode 33 → 34, versionName "0.23.0" → "0.24.0", "Release v0.24.0: Shop steps", CI green, APK present.
