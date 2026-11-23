# Mac & cheese slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buffalo chicken mac & cheese uses processed cheese slices (2 / 3 / 4) instead of light shredded and full-fat tasty, with per-store slice weights counted correctly.

**Architecture:** `meal-calc.js` learns an optional per-store `unitG` on a MACROS panel for count units. `catalogue.js` gains a `cheeseslice` item and loses `tasty`; `macros.js` gets the slice panels; `meals.js` gets the new portion text, costs, steps and note.

**Tech Stack:** Plain JS assets (UMD modules), `node --test`.

Spec: `docs/superpowers/specs/2026-11-23-mac-cheese-slices-design.md`.

## Global Constraints

- Commit straight to `main`; stage files by explicit path only. Never `git stash`, `git clean`, `git reset --hard`.
- Do not stage these CRLF-only working-tree changes: `apps/android/app/src/main/assets/coles/prices.js`, `apps/android/app/src/main/assets/woolworths/prices.js`, any `*.kt`, `apps/android/app/src/test/js/coles-prices.test.js`, `apps/android/app/src/test/js/prices.test.js`.
- Don't touch `platra/`, keystore, `local.properties`, `docs/seed/`, `.superpowers/` (never commit it).
- No version bump (release is a separate task).
- Meal ids never change. No estimated nutrition: label values only.
- Full suite: `node --test "apps/android/app/src/test/js/*.test.js"` must pass at the end of each task. New test files must be added to `.github/workflows/release-android.yml` (this plan adds tests only to existing files).

---

### Task 1: Per-store slice weight (`unitG`) in meal-calc

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/meal-calc.js` (`massForAmount`, `macrosFromPanel`)
- Test: `apps/android/app/src/test/js/meal-macros.test.js` (append)

**Interfaces:**
- Produces: a MACROS store panel may carry `unitG` (number, grams per counted unit). For count units (`eggs`, `slices`, `wraps`, `muffins`, `fillets`, `bars`, `bottles`) the mass is `amount * panel.unitG` when present, else `amount * item.unitSize` as today. Task 2 sets `unitG: 20.8` on the Coles `cheeseslice` panel.

- [ ] **Step 1: Write the failing test** (append to `meal-macros.test.js`)

```js
test("panel unitG overrides item unitSize for count units, per store", () => {
  const panels = {
    sl: {
      woolies: { k: 100, p: 10, c: 0, f: 0, per: "100g" },
      coles: { k: 100, p: 10, c: 0, f: 0, per: "100g", unitG: 20 },
    },
  };
  const items = { sl: { id: "sl", unit: "slices", unitSize: 10 } };
  const mc = calc.create({ panels, amounts: { m: { sl: 3 } }, item: (id) => items[id] });
  assert.equal(mc.portion("m", "S", "woolies").k, 30);
  assert.equal(mc.portion("m", "S", "coles").k, 60);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test apps/android/app/src/test/js/meal-macros.test.js`
Expected: FAIL, coles portion is 30, not 60.

- [ ] **Step 3: Implement**

In `meal-calc.js`, give `massForAmount` the panel and use `unitG`:

```js
  function massForAmount(amount, item, spec, panel) {
    if (!(amount > 0)) return 0;
    if (spec && spec._ml) return amount;
    if (!item) return amount;
    var unit = item.unit;
    var unitSize = panel && panel.unitG > 0 ? panel.unitG : item.unitSize;
    if (unit === "eggs" || unit === "slices" || unit === "wraps" || unit === "muffins" || unit === "fillets" || unit === "bars" || unit === "bottles") {
      return amount * (unitSize || 1);
    }
    if (unit === "pouches") return amount * (unitSize || 250);
    if (unit === "mL") return amount;
    return amount;
  }
```

In `macroMass`, change `return massForAmount(amount, item, spec);` to `return massForAmount(amount, item, spec, panel);`. In `macrosFromPanel`, change the final branch `: massForAmount(amount, item, spec);` to `: massForAmount(amount, item, spec, panel);`. No other callers exist.

- [ ] **Step 4: Run the file, then the full suite**

Run: `node --test apps/android/app/src/test/js/meal-macros.test.js` → PASS.
Run: `node --test "apps/android/app/src/test/js/*.test.js"` → all pass (no panel has `unitG` yet, so nothing else moves).

- [ ] **Step 5: Commit**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/meal-calc.js apps/android/app/src/test/js/meal-macros.test.js
git commit -m "Meal macros: per-store unit weight for counted items"
```

---

### Task 2: Cheese slices in the buffalo mac, retire tasty

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` (ITEMS: add `cheeseslice`, delete `tasty`; RETIRED; AMOUNTS.buffalomac)
- Modify: `apps/android/app/src/main/assets/weekday_fuel/macros.js` (add `cheeseslice`, delete `tasty`)
- Modify: `apps/android/app/src/main/assets/weekday_fuel/meal-calc.js` (remove `tasty` from `EXTRA_UNITS`)
- Modify: `apps/android/app/src/main/assets/weekday_fuel/meals.js` (buffalomac `t`, steps 3–4, note)
- Modify: `apps/android/app/src/test/js/catalogue-data.test.js` (drop `tasty` from `EXTRA_IDS` and the two `tasty` unconfirmed asserts; add slice tests)
- Test: `apps/android/app/src/test/js/meal-macros.test.js` (append)

**Interfaces:**
- Consumes: `unitG` from Task 1.
- Produces: catalogue item id `cheeseslice` (`unit: "slices"`, `unitSize: 18`).

- [ ] **Step 1: Find the Coles product page**

Look up "Coles Simply Sandwich Slices 24 Pack 500g" on coles.com.au (WebSearch for `coles.com.au/product coles-simply-sandwich-slices-24-pack-500g`, or WebFetch the product page). You need the exact URL ending in `-<id>`. Do not guess an id. If you can't confirm it, Coles is `null` in Step 3 and the Coles panel is left out of Step 4. Report which way you went.

- [ ] **Step 2: Write the failing tests**

Append to `catalogue-data.test.js`:

```js
test("buffalomac uses cheese slices, not shredded cheese", () => {
  const a = cat.AMOUNTS.buffalomac;
  assert.deepEqual(a.cheeseslice, { L: 2, S: 3, X: 4 });
  assert.equal(a.cheese, undefined);
  assert.equal(a.tasty, undefined);
  assert.equal(cat.item("tasty"), null);
  const it = cat.item("cheeseslice");
  assert.equal(it.unit, "slices");
  assert.equal(it.unitSize, 18);
  assert.equal(it.woolies.stockcode, 791364);
  assert.ok(cat.RETIRED.woolies["729026"]);
  assert.ok(cat.RETIRED.coles["8145335"]);
});
```

(If `cat.item` returns `undefined` rather than `null` for unknown ids, use `assert.ok(!cat.item("tasty"))` instead; check `catalogue.js`'s `item` function first.)

Append to `meal-macros.test.js`:

```js
test("buffalomac Standard cheese slices: 3 Kraft slices at Woolworths", () => {
  const slice = PANELS.cheeseslice.woolies;
  assert.equal(slice.unitG, undefined);
  const only = calc.create({
    panels: PANELS,
    amounts: { m: { cheeseslice: 3 } },
    item: (id) => cat.item(id),
  });
  assert.equal(only.portion("m", "S", "woolies").p, Math.round(19.1 * 0.54 * 10) / 10);
});
```

If Coles was confirmed in Step 1, also append:

```js
test("buffalomac cheese slices at Coles count 20.8 g a slice", () => {
  assert.equal(PANELS.cheeseslice.coles.unitG, 20.8);
  const only = calc.create({
    panels: PANELS,
    amounts: { m: { cheeseslice: 3 } },
    item: (id) => cat.item(id),
  });
  assert.equal(only.portion("m", "S", "coles").p, Math.round(18.9 * 0.624 * 10) / 10);
});
```

- [ ] **Step 3: Run and confirm they fail**

Run: `node --test apps/android/app/src/test/js/catalogue-data.test.js apps/android/app/src/test/js/meal-macros.test.js`
Expected: FAIL (`cheeseslice` missing).

- [ ] **Step 4: Catalogue changes**

In `catalogue.js` ITEMS, delete the whole `tasty` item and add, near the other `sec: 1` cheese item:

```js
    {
      id: "cheeseslice", sec: 1, keeps: 28, name: "Cheese slices", short: "Slices", unit: "slices", unitSize: 18, note: "Individually wrapped processed slices. They melt smoothly into a sauce and don't go stringy", same: false,
      coles: { name: "Coles Simply Sandwich Slices 24 Pack 500g", url: "<exact URL from Step 1>", size: 24, price: 4.25, checked: "2026-11-23", unconfirmed: true },
      woolies: { name: "Kraft Singles Original 432g", url: "https://www.woolworths.com.au/shop/productdetails/791364/kraft-singles-original-original", stockcode: 791364, size: 24, price: 9.6, checked: "2026-11-23" },
    },
```

If Coles wasn't confirmed: `coles: null,` and append to the note: `. Coles doesn't list Kraft Singles; its own slices page couldn't be confirmed`.

Add to `RETIRED.coles`: `"8145335": { name: "Coles Cheese Shredded Tasty 700g", url: "https://www.coles.com.au/product/coles-cheese-shredded-tasty-700g-8145335" },`
Add to `RETIRED.woolies`: `"729026": { name: "Woolworths Tasty Shredded Cheese 500g", url: "https://www.woolworths.com.au/shop/productdetails/729026/woolworths-tasty-shredded-cheese" },`

Replace `AMOUNTS.buffalomac` with:

```js
    buffalomac: { breast: 200, freshpasta: { L: 50, S: 80, X: 110 }, evap: 80, cheeseslice: { L: 2, S: 3, X: 4 }, franks: 50, fzbroc: 100, paprika: 1, garlic: 5 },
```

In `meal-calc.js` remove the `tasty: { unit: "g" },` line from `EXTRA_UNITS`.

In `catalogue-data.test.js` remove `"tasty"` from `EXTRA_IDS` and delete the two lines asserting `cat.item("tasty")...unconfirmed`.

- [ ] **Step 5: Macros**

In `macros.js` delete the whole `"tasty"` entry and add:

```js
  "cheeseslice": {
    "woolies": {
      "k": 272.5,
      "p": 19.1,
      "c": 3.5,
      "f": 20.8,
      "per": "100g",
      "src": "label",
      "product": "Kraft Singles Original 432g",
      "id": "791364",
      "checked": "2026-11-23",
      "note": "Woolworths product page (text NIP). 1140 kJ per 100g. Per 18g slice: 205 kJ, 3.4g P, 3.7g F, sodium 234mg. as sold"
    },
    "coles": {
      "k": 293,
      "p": 18.9,
      "c": 3.9,
      "f": 22.6,
      "per": "100g",
      "src": "label",
      "unitG": 20.8,
      "product": "Coles Simply Sandwich Slices 24 Pack 500g",
      "id": "<Coles id from Step 1>",
      "checked": "2026-11-23",
      "note": "1226 kJ per 100g; serving 20.8g (one slice), sodium 1190mg. Two versions of this label circulate (the other: 289 kcal, 18.2g P, 22.5g F, 4.1g C); confirm on pack.",
      "photo": "Which label is on the pack: 293 or 289 kcal per 100g?",
      "confirm": "Two label versions exist; check the pack."
    }
  },
```

Leave out the `coles` block if Coles was not confirmed.

- [ ] **Step 6: Meal text**

In `meals.js` buffalomac, set `t` (costs from the per-serve deltas below), steps 3 and 4, and the note:

```js
      t: {
        L: { cost: 6.9, what: "Small serve of fettuccine, 2 cheese slices" },
        S: { cost: 7.68, what: "Fettuccine, 3 cheese slices" },
        X: { cost: 8.4, what: "Big serve of fettuccine, 4 cheese slices" },
      },
```

Cost working (averaged over both stores): old cheese L 0.38 / S 0.60 / X 0.75; new slices (W $9.60/24, C $4.25/24) L 0.58 / S 0.87 / X 1.15. If Coles is `null`, use Woolworths alone: new L 0.80 / S 1.20 / X 1.60 against old Woolworths L 0.42 / S 0.66 / X 0.83, giving L 7.08, S 7.95, X 8.77.

Steps 3 and 4:

```js
        "Cook the fettuccine for 2 min, then drain it and return it to the pot on low with the evaporated milk. Warm for 30 sec.",
        "Tear in the cheese slices and stir for 1 min until smooth and glossy. Fold through the chicken and broccoli for 1 min until hot, then finish with the rest of the Frank's.",
```

Note:

```js
      note: "Evaporated milk and processed cheese slices make a smooth sauce that won't split or go stringy, even reheated. The rest of the can goes in the schnitzel mash within a few days.",
```

- [ ] **Step 7: Run the full suite and the page parse check**

Run: `node --test "apps/android/app/src/test/js/*.test.js"` → all pass. If `meal-rules.test.js` reports a guideline or kcal-band issue for buffalomac, report the numbers; don't change other amounts.
Run the existing parse check of the last `<script>` in `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` via `node --check` (unchanged file, should pass).
Print `MC.portion("buffalomac", t, store)` for L/S/X at both stores and include it in your report.

- [ ] **Step 8: Commit**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/catalogue.js apps/android/app/src/main/assets/weekday_fuel/macros.js apps/android/app/src/main/assets/weekday_fuel/meal-calc.js apps/android/app/src/main/assets/weekday_fuel/meals.js apps/android/app/src/test/js/catalogue-data.test.js apps/android/app/src/test/js/meal-macros.test.js
git commit -m "Buffalo mac: processed cheese slices instead of shredded"
```
