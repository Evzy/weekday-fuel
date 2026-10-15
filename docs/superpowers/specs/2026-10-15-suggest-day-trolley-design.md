# Suggest a day to the trolley — design

**Status:** draft 2026-10-15, awaiting owner review
**Scope:** roadmap spec 3 of 5 (see `2026-10-15-deli-ham-trolley-design.md`): add a planned day, or some of its meals, to the shop and the Woolworths trolley, with a pantry check every send and each item labelled with the days and meals it is for
**Release:** v0.4.0, after live Woolworths prices (v0.3.1)

## Goal

From Today, the owner adds a whole planned day, or only some of its meals, to the shop. The Shop list combines every added day with the Build a shop picks, works out packs on the combined need, and says which days and meals each item is for, so the owner can swap a meal instead of buying something. Sending to the Woolworths trolley first asks which pantry and freezer items are already at home (every time), so spices and sauces are not bought every shop.

Single user (the owner).

## Decisions

| Question | Decision |
| --- | --- |
| Several days sent one after another | Combined: the shop remembers its days and works out packs on the combined need (one 500 g cheese pack can cover Monday and Tuesday). |
| Where an added day goes | Into the same Shop list as Build a shop picks: one list, one total per store, one trolley send. |
| What can be added | A whole day, or chosen meals of that day; before sending, single items can still be left out by ticking them on the Shop list. |
| Day labels | Every item row says which days and meals it is for, e.g. "for Mon 19, Tue 20 · toasty, buffalo mac", in Build a shop and in the trolley panel. |
| Pantry check | Every send lists the shop's pantry and freezer items (section 2) not already ticked, with days and meals. Each starts as "buy"; the owner ticks "I have it". Answers apply to that send only. |
| Fixtures | Adding a day never adds Dare or Grenade; the existing "Dare + Grenade for how many days" setting stays the only source. |
| Changing a day after adding it | The shop follows the day: a swapped meal replaces the old one in the list. If the trolley was already sent, Shop shows "Trolley out of date" with **Send again**. |
| Send again | Sets the trolley to the new combined quantities and sets to 0 any product sent last time that the shop no longer needs at all. Products ticked on the Shop list or answered "I have it" are never removed. |
| Next shop | **Start next shop** clears shop days, meal picks, ticks and the last-send record. Shown on the Shop tab, and offered in the trolley panel after Checkout is opened. |
| Portion size | Shop quantities use each meal's Standard amounts whatever portion (Light/Standard/Loaded) the day uses. |
| Store | Days and labels work for both stores' lists; the trolley stays Woolworths-only. |

Rejected:

- **Copying a day's meals into the shop when added:** every swap on Today would have to find and fix the copies; conflicts with "the shop follows the day".
- **A separate days list merged only at send time:** two lists whose totals disagree with the trolley.
- **Adding each send's packs on top of the trolley:** buys a second cheese pack when one covers both days.
- **Remembering pantry answers between sends:** the owner wants to be asked every time.

## Components

1. **Catalogue (`catalogue.js`).** `shopList(picks, fixtureDays, dayMeals)` gains a third argument, `dayMeals: [{ day: "2026-10-19", meal: "toasty" }, ...]`. Need is summed across picks and day meals, packs are rounded once on the total, and each row gains `days` (sorted unique ISO dates) alongside the existing `used` (meal ids). Rows are unchanged when `dayMeals` is empty.
2. **Cart (`cart.js`).**
   - `cartLines(rows, ticks, haveIt)` also skips items answered "I have it" (`haveIt`, a set of item ids for this send).
   - `removalLines(lastSent, rows)` returns `{stockcode, quantity: 0}` for each stockcode in the last send whose item is no longer in `rows`. Items still in `rows` (ticked or not) are never removed.
   - `shopFingerprint(picks, dayMeals, fixtureDays)` returns a stable string of the plan, used for "Trolley out of date". Ticks are left out: ticking things off while shopping must not mark the trolley out of date.
3. **Today tab (`Weekday_Fuel.html`).** A planned day gets **Add day to shop** (or **In shop** with a remove option once added). Each meal card gets an "In shop" toggle when its day is in the shop.
4. **Shop tab (`Weekday_Fuel.html`).** A "Days in this shop" panel (one line per day: date and in-shop meals, a remove button; "no meals planned" when empty). Item rows gain the "for ..." label. **Start next shop** button.
5. **Trolley panel (`Weekday_Fuel.html`).** New first phase, **Pantry check**, before the existing send; "Trolley out of date" with **Send again**; after Checkout is opened, "Finished this shop? Start next shop".
6. **Trolley script (`assets/woolworths/trolley.js`).** Quantity 0 lines use the same set-quantity request. What counts as a successful removal is recorded first (see Research).

## Data

Saved data keeps its shape, with these additions:

- `settings.shopDays`: `{ "2026-10-19": true, ... }`. Missing means an empty shop (existing installs).
- Day meal entries (`days[date].meals[i]`) may carry `shop: false`, meaning that meal is left out of the shop. Missing means in. `swapMeal` keeps the flag.
- New key `weekdayfuel.v1.sent`: `{ at: ISO time, fingerprint: string, lines: { [stockcode]: quantity } }`, written when a send finishes. Missing means never sent.

`dayMeals` is built from `shopDays`: for each date, the meals of `days[date]` without `shop: false`.

## Flows

**Add a day.** Today, a day with meals: tap **Add day to shop**. The date goes into `shopDays`; all its meals are in. Toggle a meal's "In shop" to leave it out. Remove the day from Today or from the Days panel.

**Build the list.** Shop calls `shopList(picks(), fxDays(), dayMeals())`. Totals, Left to buy, Missed at <store>, the Full list and meal costs are unchanged apart from the extra need.

**Send.**

1. Tap **Send to Woolworths trolley**. The panel shows **Pantry check**: each unticked section-2 row with its "for ..." label and an "I have it" tick, all unticked. Buttons: **Send** and **Cancel**.
2. **Send** posts `sendTrolley` with `cartLines(rows, ticks, haveIt)` plus `removalLines(lastSent, rows)`.
3. On `trolleyDone`, `weekdayfuel.v1.sent` is written with the current fingerprint and, per stockcode, the quantity now in the trolley: lines added at their new quantity, products from the last send that were not re-sent (ticked or "I have it") kept at their old quantity, and removed products dropped.
4. The results list shows each line's "for ..." label; removals show as "Removed (no longer needed)".

**Out of date.** When `weekdayfuel.v1.sent` exists and its fingerprint differs from the current plan, the trolley panel shows "Trolley out of date: your shop changed since you sent it at 1:40 pm" and **Send again** (which runs the same Send flow, pantry check included).

**Next shop.** **Start next shop** asks for confirmation, then clears `shopDays`, meal picks, ticks and `weekdayfuel.v1.sent`. Day plans themselves are not touched.

## Research (first task)

With the owner logged in (as for the trolley capture in `docs/woolworths-requests.md`):

- Does `POST /api/v3/ui/trolley/update` with `quantity: 0` remove the product from the trolley?
- What does the response contain for a removal (is the stockcode in `UpdatedItems`, a removed list, or neither)?

Record the answers in `docs/woolworths-requests.md`. If quantity 0 does not remove, removals are dropped from the send and the result lists "Remove these from the trolley yourself" with each product's link.

## Error handling

- A shop day with no meals (or all left out) shows "no meals planned" in the Days panel and adds nothing.
- Unknown meal ids in a day are skipped, as Build a shop does today.
- A removal that fails shows in the results like any failed line.
- Opening the app on an install without the new keys: empty shop, never sent, no "out of date".
- Clearing a day's meals on Today while the day is in the shop: the day stays listed with "no meals planned"; its items drop out of the list and become removals on the next send.

## Testing

- `catalogue.test.js`: day meals combine with picks and with each other (one pack covers two days); `days` labels; empty `dayMeals` leaves rows unchanged; a meal left out adds nothing.
- `cart.test.js`: `haveIt` skips items; `removalLines` gives 0 only for products no longer in the list, never for ticked or "I have it" items; `shopFingerprint` changes when days, in-shop meals, picks or fixture days change, and not when ticks or key order change.
- `trolley.test.js`: a quantity 0 line counts as removed per the recorded response.
- Controller browser check (plain browser, no host): Add day to shop, In shop toggles, Days panel, "for ..." labels, a swap on Today changes the list, Start next shop.
- Owner phone checks: pantry check every send; send two days and confirm one cheese pack; swap a meal and **Send again** removes the old meal's unneeded product.

## Out of scope

Per-portion (Light/Loaded) ingredient amounts; remembering pantry answers; adding fixtures per day; a Coles trolley; checkout (roadmap 4) and the orders page (roadmap 5).
