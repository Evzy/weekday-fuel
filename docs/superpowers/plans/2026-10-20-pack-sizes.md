# v0.25.0: Pack sizes for smaller shops — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

Spec: `docs/superpowers/specs/2026-10-20-pack-sizes-design.md` (commit 196c2c4).

**Goal:** Shop buys the cheapest pack combination for what this shop needs, with more pack sizes to choose from, and Review shows/switches the chosen pack.

**Architecture:** Catalogue data gains `packs` alternatives (existing shape). `storeLine` in `catalogue.js` scores by total cost, adds `leftover`, and honours an owner override passed down from `shopList`. The page stores overrides in `settings.packPick` and adds a pack sheet in Review.

**Tech stack:** Vanilla JS in an Android WebView; pure UMD modules beside `Weekday_Fuel.html`; `node --test` tests in `apps/android/app/src/test/js/`.

## Global constraints

- Commit straight to `main` by explicit path. Never stage the CRLF-only modified files (`coles/*.js`, `woolworths/*.js`, `cart.js`, the Kotlin files and tests listed in `git status`). Never `git stash` / `git clean` / `git reset --hard`.
- CI green before the next task. Version bump only in the release task.
- Nothing in CI talks to Coles or Woolworths. Store/catalogue/meal strings shown in HTML go through `esc`.
- Existing localStorage keys keep their shape; `settings.packPick` is additive and optional.
- Meal ids and meal figures (`AMOUNTS`, `per`) don't change. No new core ingredients.
- Edit the HTML with the file edit tools (UTF-8, no BOM).
- Tests: `node --test "apps/android/app/src/test/js/*.test.js"`; HTML parse check: extract the last `<script>` and `node --check` it.

---

## Task 1: Research pack sizes (docs only)

**Files:** Modify `docs/catalogue-research.md` (append a section "2026-10-20: pack sizes").

For each item below, at each store, find a product of the same kind (same brand family or the store brand already used, macros within ~5% of the item's current product), and record: store, product name, URL, Woolworths stockcode / Coles id (the trailing number in the URL), size in the item's unit, shelf price, check date. Use web search/fetch only; do not log in. Skip a size a store doesn't sell; say so in one line.

| Item id | Unit | Current | Look for |
| --- | --- | --- | --- |
| eggs | eggs | 12 | 6, 18, 30 |
| yog | g | 907 | ~500g tub, same brand |
| cheese | g | 700 C / 500 W | 250g, 1kg |
| bread | slices | 16 | smaller loaf of the same bread (record slice count) |
| spinach | g | 120 | 60g, 280g |
| potato | g | 2000 | 1kg bag; note if loose per-kg is sold online |
| mince | g | 500 | 1kg, same product line |
| toms | g | 250 | other punnet sizes |
| passata | g | 700 | ~400g |
| fzpeas, fzmix | g | 1000 | 500g |
| muesli | g | 1000 | ~500g |

End the section with a table of what will be added (item, store, size, price, id) and a list of anything rejected and why (e.g. macros differ). Commit: `Research: pack sizes for smaller shops`.

## Task 2: Cheapest-total pack choice, override, leftover

**Files:** Modify `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` (`storeLine`, `shopRow`, `shopList`, breast/thigh items). Test: `apps/android/app/src/test/js/catalogue.test.js`.

**Produces:**
- `shopList(picks, fixtureDays, dayMeals, have, packPick)` — `packPick` optional `{ woolies: { [itemId]: stockcode }, coles: { [itemId]: url } }`.
- Store line gains `leftover` (number, item unit, `q*size - need`, omitted when ≤ 0 or for `perKg`) and `candidates` (array of `{ product, quantity, cost }` for every candidate, main first) when the product has packs. `alts` unchanged.
- Items `breast` and `thigh` gain `approx: true`.

Steps:

- [ ] Write failing tests:
  - With a 6-pack ($4) and 12-pack ($6) egg item: need 4 → 1 × 6; need 10 → 1 × 12; need 13 → 1 × 18 if an 18 exists else 2 × 12 vs 3 × 6 by cost.
  - Ties (equal cost) choose less leftover, then the main product.
  - `packPick.woolies.eggs = <stockcode of the 6-pack>` with need 10 → 2 × 6; an unknown stockcode is ignored (auto choice).
  - `leftover` = 2 for need 4 with a 6-pack; absent when exact.
  - Slack: an item without `approx` and need 650 with a 650 pack → 1 pack; need 651 → 2. With `approx: true`, need 690 against a 650 pack → 1 (within `PACK_SLACK`).
- [ ] Run tests, see them fail.
- [ ] Implement in `storeLine(item, product, need, pickId)`:

```js
var slack = item.approx ? PACK_SLACK : 0;
function qtyFor(c) { return Math.max(1, Math.ceil((need - slack) / c.size - 1e-9)); }
// candidates = [product].concat(product.packs) when packs exist
// forced = candidate whose stockcode (woolies) or url (coles) === pickId
// otherwise choose min q*price; tie → min (q*size - need); tie → index 0
```

  Pass `pickId` from `shopRow` as `packPick && packPick.woolies && packPick.woolies[it.id]` (and the Coles equivalent with url). Keep the non-pack and `perKg` paths as they are.
- [ ] Update existing tests whose expectations relied on the old cost+waste score or global slack (tray tests: add `approx: true` to the test breast items). Don't loosen assertions that still hold.
- [ ] Run all tests; parse check not needed (no HTML change).
- [ ] Commit `catalogue.js` and `catalogue.test.js`: `Shop: pick the cheapest pack for this shop, with leftover and override`.

## Task 3: Add the researched packs to the catalogue

**Files:** Modify `catalogue.js` `ITEMS` (only `packs` arrays and, where a store had one size only, the new `packs` key). Test: `catalogue.test.js`.

**Consumes:** Task 1's "will be added" table.

- [ ] Write a failing sanity test over the real `ITEMS` (export them for tests as `api.ITEMS` if not already exposed): every `packs` entry has `size > 0`, `price > 0`, a `checked` date `YYYY-MM-DD`, a `name`; Woolworths packs have an integer `stockcode` that also appears at the end of their `url` path segment; Coles packs have a `https://www.coles.com.au/product/` URL ending in `-<digits>`; no two candidates in one store line share a size.
- [ ] Add the packs. Keep the item's existing main product as main.
- [ ] Add one behaviour test with the real catalogue: a 1-day plan's eggs line at Woolworths buys a smaller carton than 12 if a 6 was added (skip the assertion if research found none).
- [ ] Run all tests. Commit `catalogue.js`, `catalogue.test.js`: `Catalogue: more pack sizes for smaller shops`.

## Task 4: Review shows the pack and lets you switch

**Files:** Modify `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`.

**Consumes:** `shopList(..., packPick)`, line `leftover`, line `candidates`.

- [ ] Pass `S().packPick` as the 5th argument in the three `CAT.shopList(` calls (`shopRowsRaw`, `shopListNoHave`, the dated list near line 510).
- [ ] Review item row (around line 1550): after the buy text add ` · {leftover} left over` when `line.leftover > 0`, formatted with the item unit like other amounts (e.g. "2 eggs", "150g"). When `line.candidates && line.candidates.length > 1`, the buy text is a button `data-act="packsheet" data-v="{itemId}"`.
- [ ] Pack sheet (`state.sheet = "pack:" + itemId`): title = item short name; one `pick` button per candidate: "{quantity} × {packLabel} · {money(cost)}" with the chosen one marked "✓"; plus "Auto (cheapest)" (marked when no override). Actions: `packpick` with `data-v` = candidate id (Woolworths stockcode or Coles url) sets `state.settings.packPick[store][itemId]`; `packauto` deletes it (and the empty store object / `packPick` when empty). `saveSettings()`, close the sheet. Store is the currently selected Shop store.
- [ ] Escape every product name/label with `esc`.
- [ ] Run tests + parse check. Browser check: serve `apps/android/app/src/main/assets` on a free port, complete setup, plan one day, open Shop → Review, confirm an egg (or chicken) row shows leftover and the sheet switches packs and back to Auto; stop your server.
- [ ] Commit the HTML: `Shop Review: show the chosen pack and switch pack size`.

## Task 5: Release v0.25.0

- [ ] `apps/android/app/build.gradle.kts`: `versionCode = 36` → `37`, `versionName = "0.24.2"` → `"0.25.0"` (UTF-8 without BOM).
- [ ] Commit `Release v0.25.0: pack sizes`, push, watch CI, confirm `WeekdayFuel-v0.25.0-debug.apk` in `Evzy/weekday-fuel-releases`.
