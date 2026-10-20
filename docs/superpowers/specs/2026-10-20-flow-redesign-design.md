# Flow redesign: Today, Week, Shop, Meals (v0.22.0 – v0.24.0)

Evan, 2026-10-20: "there's a lot of features in here now and they work, mostly, but we need to work out the best flow." Backup and restore ships first as v0.21.0 (its own spec); this redesign follows in three releases.

## Usability walkthrough (fresh data, 400×860, 2026-10-20)

What worked: "Suggest my week" fills the week in one tap and puts it in the cart; "This day lands on target"; the cart's day grouping.

Friction, worst first:

1. Seven ways to plan: Suggest my week, Suggest a day (twice when empty), New suggestion, "+ breakfast/lunch/dinner/snack" pickers, Start with a plan / Plans on Meals, Add on Meals, "Add to today as …" on Meals. Nothing says which to use.
2. Today does everything: week strip and tally, Suggest my week, Clear unbought meals, calories/protein, staples, meals with seven buttons each (Light, Standard, Loaded, Ate it, Swap, In shop, Remove), the Something else form.
3. No first run: targets silently default to 2500 kcal / 170 g; Targets is behind ⚙.
4. The tally reads wrong: "Planned weekdays so far: 904 of 2500 kcal (-1596)".
5. Shop is long (27 items, 4–6 lines each), two store totals plus a separate store switch, a pantry section to re-check every time, and Suggest my week quoted ~$147.68 while the cart said $186.
6. No sense of order in shopping (review → tick → send → check out → "Save order and start next shop"); the last step's name is unclear.
7. Kitchen's purpose is unclear ("Stock starts with your next saved order", a 45-item dropdown) yet it changes what the Shop buys.
8. Meals cards are heavy (five-column portion tables) and have two kinds of add button.
9. The daily loop is scattered (weigh-in tab, Ate it per meal).
10. "Clear unbought meals" sits under "Suggest my week".

## How Evan uses it (decisions)

- **One weekly sitting:** plan the week, shop it online, then eat to plan.
- **Between sittings:** log morning weight, glance at today's meals and recipes, occasionally swap or add something. He does **not** tick meals as eaten.
- **Leftovers:** assume planned meals were eaten; Kitchen stock follows from that with no ticking.
- **Structure:** option A, organised by when it's used: **Today / Week / Shop / Meals**, Targets behind ⚙. Weigh-in and Kitchen stop being tabs.

## Auto-eaten

- A planned meal on a date before today with no `ate` counts as eaten at the end of its day (local 23:59 of that date) for stock purposes. Meals with a recorded `ate` keep it. Removed meals are gone, so they aren't counted.
- Computed in `inventory.js` `stock()` (and anywhere else that reads `ate` to mean "consumed", e.g. `reserved()` filters): no stored data changes. Only meals on or after the Kitchen's `start` count, as now.
- The shop-list filter in `dayMeals()` deliberately still uses stored `ate` only (not `impliedAte`), so past days are not cart days and auto-eaten history does not shrink the live cart list.
- `ate` is no longer offered in the UI. Existing `ate` values stay valid.
- "Something else" entries have no recipe, so they don't touch stock (as now).

## Today (v0.22.0)

- **Weigh-in box** at the top: "Morning weight [__] kg · Save". Once today is logged it collapses to "84.6 kg today · 7-day avg 84.2 ↓0.3", which opens the full Weigh-in view (chart, trend, history: today's Weigh-in tab content, reached from here).
- **First run:** shown when `settings.setupDone` (new, additive) is not `true`. On load, if `setupDone` is absent and there are any stored days or weights, it's set to `true` silently (existing users never see the card). The card replaces the weigh-in box: phase chips, calories (prefilled from that phase's current value), protein, **Save**. Saving writes the targets, sets `setupDone: true`, and shows "Plan my week →" (to Week).
- **Today's meals:** one line each: slot, name, portion (and "Bought" if bought). Tap opens a small sheet: Recipe, Swap, portion (Light / Standard / Loaded), Remove. No Ate it.
- **Ate something else?** link opens the existing Something else form; logging it still fits the other meals.
- **Macros:** one compact line with two thin bars: "2434 / 2500 kcal · 208 / 170 g protein".
- **Staples:** small chips, tap to skip for today (as now).
- **Empty states:** weekend ("Weekend, eat how you like." plus the weigh-in box); nothing planned ("Nothing planned. Plan my week →").
- **Tabs:** Today, Week, Shop, Meals. Weigh-in and Kitchen tabs removed; stored `tab` values `weigh`/`kitchen` fall back to Today / Shop. In v0.22.0 Week is today's planning content (week strip, Suggest my week, the day's meal editor) moved as-is, so nothing is lost before v0.23.0.

## Week (v0.23.0)

- **Every day row** at the top: staples set once (Dare, Grenade, +), as today's chips and staple sheet.
- **Day tiles** from today forward (Mon–Sun of the current and next week), each with kcal and a colour: on target, under, over. **Tally:** "4 of 4 planned days on target", not a summed kcal comparison.
- **Empty:** one big **Plan my week** (today's `suggestWeek`), with a small "or use a plan: Fewest items" (today's Plans sheet). This is the only place generation lives.
- **Days listed** below, compact. Each meal is one line (slot, name, kcal, protein); tap opens the meal sheet: portion, Swap, Recipe, Leave out of cart / Put back in cart, Remove.
- **Per day:** "+ Add" (the day-and-slot picker from the cart work, preset to that day), "Fit portions" when off target, and a ⋯ menu: Re-suggest this day, Skip a staple today, Leave the day out of the cart.
- **Page ⋯ menu:** Clear unbought meals (two taps, as now).
- **Weekends** greyed "off"; tap to plan (sets `track`, as now).
- **Past days** aren't listed (they count as eaten).
- **Meals tab (same release):** browse only. Card = name, tags, kcal range, one **Add** (day-and-slot picker). Portion table moves into the recipe sheet. "Add to today as …" removed. Batch prep chip row stays. The Plans card moves to Week's empty state.
- Removed from Today/Week: Suggest a day / New suggestion buttons (now "Re-suggest this day" in the day menu), the "+ breakfast/lunch/dinner/snack" pickers (now "+ Add").

## Shop (v0.24.0)

### Bought or to buy (Evan, 2026-10-20)

"The idea of this cart and next cart seems weird; I've either bought the meals or not." The cart stops being its own thing:

- **To buy** = every planned meal from today on that isn't bought and isn't left out (`shop:false`). That is the whole Shop list, always; it's never frozen.
- **Sending a trolley** records which meals it covered: the sent record (`weekdayfuel.v1.sent` / `.colesSent`) gains an additive `meals: ["<date>|<index>|<mealId>", …]`, the to-buy meals at the moment of that send.
- **Planned after sending:** if the to-buy list now differs from what was sent, Review shows "2 meals added since you sent" (or "changed") and the button **Send these too**. It re-sends the whole list; the trolley scripts already set exact quantities (and 0 for lines no longer needed), so the store trolley ends up matching. The sent record's `meals` is replaced with the new set.
- **After "I've paid":** the store trolley can't change, so the button reads "Finish this shop first" (disabled), and new meals simply wait.
- **Finish this shop** marks bought exactly the meals in the sent record's `meals` that still exist with the same id (same rules as `markBought` today otherwise), saves the order, adds buys to stock. Meals not covered stay "to buy". With no trolley sent (shopping in store), it marks every to-buy meal bought (as today).
- **Removed:** frozen `settings.shopDays`, the freeze on Done, `held` / `holdMealForNextCart` / `releaseHeldMealsForNextCart`, the "Next cart" section and `NEXT_SHOP_NOTE`. Existing stored `held:true` meals are treated as plain to-buy (`delete shop` and `held` once on load where `held` is set). Existing `settings.shopDays` is ignored (left in storage). `shopDays()` is always the derived set.
- Meals added from Week / Meals / plans while a trolley is sent are normal to-buy meals (no hold).

A step bar at the top: **1 Review · 2 Send · 3 Check out · 4 Done**, derived from existing state (no trolley sent → Review; sending → Send; sent → Check out; checked out/paid → Done).

- **1 Review:**
  - Summary: "Tue 20 – Fri 23 · 12 meals · Woolworths $186.28" with one store switch showing the other store's total ("Coles $186.16 · 1 missing").
  - Cart days collapse to one line each ("Tue · 3 meals"), tap to expand (meals, Leave out). Flags and gap markers stay.
  - Items: one line each ("Chicken breast 1.5–2.2 kg · $24.20"); tap expands to what it's for, the other store, links, swaps.
  - **Already at home (n):** a collapsed line listing covered items (leftovers via stock, plus pantry) with a link to **At home** (today's Kitchen view, for corrections: "I've still got rice").
  - Ticks stay ("got it, don't send").
  - Button: **Send to {store} trolley**.
- **2 Send:** progress, then "Add these yourself", as now. Button: **Check out**.
- **3 Check out:** the existing in-app Woolworths checkout, or the Coles link. Button: **I've paid**.
- **4 Done:** **Finish this shop** (today's "Save order and start next shop": save the order, add the buys to stock, mark the sent meals bought, clear ticks and sent records). Past orders as a link.
- **Price consistency:** Suggest my week and Plans quote the cart total for the selected store, computed the same way as the cart.

## Unchanged

Storage shapes (only additive `settings.setupDone` and the sent record's `meals`), meal ids, catalogue, trolley/checkout host messages and the JS bridge rule, specials/swaps behaviour, staples data. (Held-meal and frozen-cart logic is removed in v0.24.0, above.)

## Testing

- `inventory.test.js`: auto-eaten (past meal without `ate` consumes at end of day; meals before `start` ignored; explicit `ate` respected; today's and future meals not consumed).
- Existing suite stays green; inline-script parse check.
- Each release: a browser walkthrough at 400×860 from fresh data repeating the journeys above (first run, plan a week, adjust a day, shop to Done, weigh in), counting taps for plan week / get to shopping list / log weight.
- Owner phone check after each release.
