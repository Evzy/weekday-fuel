# Recipe extras on Shop, weigh liquids in grams

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every real recipe extra (spray, butter, mayo, spices, oils, sauces, seeds, sourdough, avocado, tasty) is a shop item, and Evan can tap a liquid on a recipe, enter the grams he weighed, and every recipe using that product switches to grams.

**Architecture:** Promote extras into `catalogue.js` `ITEMS` + `AMOUNTS` so Shop and Kitchen work unchanged. A small `weigh.js` stores one `{ml,g}` sample per product in `settings.weighG` and converts recipe/kitchen amounts. Macros never assume 1 mL = 1 g.

**Tech Stack:** Existing weekday_fuel JS modules, Node test runner, Android WebView HTML. No new native code.

## Global Constraints

- Commit straight to `main`. No version bump until a separate release task.
- Stage by explicit path. Never stage the CRLF-only `prices.js` / Kotlin / `coles-prices.test.js` / `prices.test.js` files.
- Never `git stash`, `git clean` or `git reset --hard`. Don't commit `.superpowers/`.
- HTML stays UTF-8 without BOM. Dynamic strings go through `esc`.
- localStorage shapes additive only (`settings.weighG` plus a device-local inventory flag).
- Meal ids never change. No estimated nutrition: no 1 mL = 1 g. Grams only after a weighed sample.
- New catalogue products must be the ones already in `docs/research/labels-c.json` extra rows (name, url, productId, price in notes). Don't invent products.
- New JS test files go on the list in `.github/workflows/release-android.yml`.
- `node --test "apps/android/app/src/test/js/*.test.js"` and last-`<script>` `node --check` of `Weekday_Fuel.html` after each task.
- Push after each commit; CI is public. Don't kill processes you didn't start.

---

### Task 1: Catalogue products and AMOUNTS

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` (`ITEMS` after garlic/sesame pantry block, `AMOUNTS` per meal)
- Modify: `apps/android/app/src/test/js/catalogue-data.test.js` (new assertions)
- Modify: `apps/android/app/src/test/js/shop-have.test.js` (update `NO_HAVE_LITERAL` and any frozen shop-list snapshots once AMOUNTS grow)
- Modify: `.cursor/rules/meals.mdc` (extras that are products now go in AMOUNTS)

**Interfaces:**
- Consumes: extra product rows in `docs/research/labels-c.json` (`item`, `productName`, `productId`, `url`, `notes` with `$` price, `checked`)
- Produces: `CAT.item("spray"|"butter"|"lightmayo"|"kewpie"|"paprika"|"olive"|"fishsauce"|"vegoil"|"tomsauce"|"sesameseed"|"sourdough"|"avocado"|"tasty")`; `AMOUNTS` keys matching today's `EXTRA_AMOUNTS` plus `buffalomac.garlic: 5`

- [ ] **Step 1: Write the failing test**

In `catalogue-data.test.js` add:

```js
const EXTRA_IDS = ["spray","butter","lightmayo","kewpie","paprika","olive","fishsauce","vegoil","tomsauce","sesameseed","sourdough","avocado","tasty"];

test("former extras are catalogue items used by meals", () => {
  for (const id of EXTRA_IDS) {
    const it = cat.item(id);
    assert.ok(it, id);
    assert.ok(it.coles && it.woolies, id + " both stores");
  }
  assert.equal(cat.AMOUNTS.eggmuffin.spray.L, 1);
  assert.equal(cat.AMOUNTS.toasty.butter.S, 5);
  assert.equal(cat.AMOUNTS.tenderwrap.lightmayo.X, 15);
  assert.equal(cat.AMOUNTS.buffalomac.paprika, 1);
  assert.equal(cat.AMOUNTS.buffalomac.garlic, 5);
  assert.equal(cat.AMOUNTS.redcurry.fishsauce, 5);
  const rows = cat.shopList({}, 0, [{ day: "2026-10-28", meal: "eggmuffin", t: "S" }]);
  assert.ok(rows.some((r) => r.id === "spray"), "spray on shop list");
  assert.ok(!rows.some((r) => r.id === "water"));
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test apps/android/app/src/test/js/catalogue-data.test.js`

Expected: FAIL (`cat.item("spray")` is null)

- [ ] **Step 3: Add ITEMS and AMOUNTS**

Copy product name, url, id, price, pack size from `labels-c.json` extra rows (Woolworths + Coles). `sec: 2` (pantry) except `avocado` and `sourdough` (`sec: 1` fresh). Units: `olive`/`fishsauce`/`vegoil`/`tomsauce` = `mL`; the rest `g`. `same: true` when both stores' product is the same SKU family.

Merge today's `extra-amounts.js` specs into `AMOUNTS` (drop `_ml`; the item's `unit` carries that). Fold garlic: `buffalomac.garlic = 5` (already 0 in AMOUNTS — add it). Spray 1 g stays 1 g of the can, not "2 sprays" as the shop amount.

- [ ] **Step 4: Update shop-have snapshots if they fail, then all tests**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`

Expected: pass. If `shop-have.test.js` literals fail, rewrite them from the new `shopList` output, don't weaken the test.

- [ ] **Step 5: Commit**

```
git add apps/android/app/src/main/assets/weekday_fuel/catalogue.js apps/android/app/src/test/js/catalogue-data.test.js apps/android/app/src/test/js/shop-have.test.js .cursor/rules/meals.mdc
git commit -m "Shop: recipe extras are catalogue items"
git push
```

---

### Task 2: Stop double-counting extras

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/extra-amounts.js` (empty object, or only leftover non-shop extras — there should be none with energy)
- Modify: `scripts/build-extra-amounts.mjs` (skip items that now live in `AMOUNTS`, keep the generator valid)
- Modify: `apps/android/app/src/main/assets/weekday_fuel/meal-calc.js` (`EXTRA_UNITS` can stay as a fallback for unknown ids, but spray/butter/etc. resolve via `itemFn`)
- Modify: `apps/android/app/src/main/assets/weekday_fuel/meals.js` (recipe `extras` arrays: keep salt, pepper, water, splash of water; drop lines that are now AMOUNTS items — cooking `steps` still mention butter/spray)
- Test: `apps/android/app/src/test/js/meal-macros.test.js` (totals must not jump 2×)

**Interfaces:**
- Consumes: Task 1 AMOUNTS
- Produces: `portion()` macros unchanged vs v0.33.1 (one count per extra, not AMOUNTS + EXTRA_AMOUNTS)

- [ ] **Step 1: Write a failing guard**

```js
test("spray is counted once (AMOUNTS, not extra-amounts)", () => {
  const { EXTRA_AMOUNTS } = require("../../main/assets/weekday_fuel/extra-amounts.js");
  assert.equal(EXTRA_AMOUNTS.eggmuffin && EXTRA_AMOUNTS.eggmuffin.spray, undefined);
  const mc = calc.create({ panels: PANELS, amounts: cat.AMOUNTS, extraAmounts: EXTRA_AMOUNTS, item: (id) => cat.item(id) });
  const p = mc.portion("eggmuffin", "S", "woolies");
  assert.ok(p.k > 0);
});
```

- [ ] **Step 2: Run it — expect FAIL while extra-amounts still has spray**

- [ ] **Step 3: Clear moved keys from EXTRA_AMOUNTS / builder; trim meals.js extras**

Regenerate extra-amounts via the builder if you change it. Keep `meals.js` `extras` only for salt/pepper/water. Ingredient lists on the recipe card already use `AMOUNTS` (`recipeLines`).

- [ ] **Step 4: Run meal-macros + meal-rules + full JS tests**

- [ ] **Step 5: Commit** `Macros: extras shopped once via AMOUNTS`

---

### Task 3: weigh.js conversion

**Files:**
- Create: `apps/android/app/src/main/assets/weekday_fuel/weigh.js`
- Create: `apps/android/app/src/test/js/weigh.test.js`
- Modify: `.github/workflows/release-android.yml` (add `weigh.test.js`)

**Interfaces:**
- Consumes: `settings.weighG` map `{ [itemId]: { ml: number, g: number } }`
- Produces:
  - `parseSample(ml, g) -> {ml,g} | null` (both finite, `ml > 0`, `g > 0`)
  - `gramsForMl(sample, ml) -> number` (round 1 decimal)
  - `mlForGrams(sample, g) -> number`
  - `has(weighG, id) -> bool`
  - `displayAmount(item, amount, weighG) -> { amount, unit, origMl? }`
  - `apply(weighG, id, sample) / clear(weighG, id)` return new object, don't mutate
  - `convertStockMlToG(events, id, sample) -> events` multiply `amount` on events for that item (only if item events look like mL, i.e. we convert once via the caller flag)

- [ ] **Step 1: Write failing tests** covering parse reject 0/NaN, 40 mL → 46 g ⇒ 20 mL → 23 g, display without sample stays mL, with sample shows g + origMl, apply/clear immutability

- [ ] **Step 2: Run `node --test apps/android/app/src/test/js/weigh.test.js` — FAIL (module missing)**

- [ ] **Step 3: Implement `weigh.js` IIFE (`WeekdayFuelWeigh` / `module.exports`)**

- [ ] **Step 4: Tests pass; add to CI list**

- [ ] **Step 5: Commit** `Weigh: per-item mL to grams conversion`

---

### Task 4: Recipe tap, Kitchen grams, macros

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`
  - `<script src="weigh.js"></script>` before the last inline script
  - `recipeLines` / amount text: if `item.unit==="mL"` and `S().weighG[id]`, show grams via `WeekdayFuelWeigh.displayAmount`; line is a button `data-act="weigh" data-v="{id}" data-ml="{portionMl}"`
  - Sheet `weigh:{id}:{ml}`: copy as spec ("Soy sauce · this portion is 40 mL. What did 40 mL weigh?"), number input, Save / Clear
  - Save writes `state.settings.weighG` through `saveSettings()` (additive)
  - `initMealCalc` / `portion`: when sample exists and panel `per==="100g"`, pass grams mass (treat as g); when panel is `100mL`, keep mL
  - Kitchen Set amount label uses `displayAmount` unit; `runWeighStockIfNeeded` after `runProduceGramsMigratedIfNeeded`: for each `weighG` id, if device-local `weekdayfuel.inventory.weighG.{id}` is unset, convert that item's inventory events mL→g and set the flag
- Modify: `apps/android/app/src/main/assets/weekday_fuel/meal-calc.js` if a `massOverride` / unit switch is cleaner than stuffing it in HTML
- Test: extend `weigh.test.js` + a meal-macros case: soy 40 mL with sample 46 g changes kcal vs unweighed when panel is per 100g

**Interfaces:**
- Consumes: Task 3 API, `S().weighG`
- Produces: recipe UI and kitchen units in grams after a sample; shop pack sizes still mL/g of the bottle

- [ ] **Step 1: Failing test** that `gramsForMl` of soy 40→46 applied to macros differs from raw 40 mL on a per-100g panel (use the real soy panel). If soy panels are per 100mL, assert kcal unchanged and kitchen still converts stock.

- [ ] **Step 2: Run — FAIL until meal-calc/HTML wired**

- [ ] **Step 3: Wire HTML + meal-calc.** Escape all dynamic strings. Don't call weigh helpers before `S` exists (same class of bug as v0.33.0).

- [ ] **Step 4: Full JS tests + last-script `node --check`**

- [ ] **Step 5: Commit** `Recipe: tap a liquid to store weighed grams`

---

### Task 5: Review gate and stop

Do not bump the version. Stop for reviewer. After approval, a separate release task ships v0.33.2 (or next).

---

## Spec coverage

- Extras as catalogue items → Task 1
- Buffalo mac garlic folded in → Task 1
- Salt/pepper/water not on Shop → Task 1 test + Task 2 extras trim
- No double macros → Task 2
- Per-item weigh from recipe, stored in `settings.weighG` → Tasks 3–4
- Recipes show g + original mL → Task 4
- Macros: 100g panel uses grams; 100mL panel keeps mL → Task 4
- Shop still buys the bottle → Task 4 (no pack-size change)
- Kitchen Set amount in grams + one-time event conversion, device-local flag → Task 4
- Clear goes back to mL, stock not converted back → Task 4
- No estimated density → Task 3 parse requires both ml and g
