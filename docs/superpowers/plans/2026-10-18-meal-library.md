# Meal Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-18-meal-library-design.md`](../specs/2026-10-18-meal-library-design.md)

**Goal:** Meals move into their own data file with full, portion-aware recipes and batch-prep recipes; the shop buys each planned day's meal at its planned portion; automatic checks enforce Evan's hard meal rules; a Cursor rule makes any agent session follow the meal-planning handover.

**Architecture:** `catalogue.js` learns per-portion amounts (`amountFor`, tier-aware `shopList`). A new pure-data `meals.js` holds `MEALS` (no free-text ingredient list; `prep`, `batch`, `extras`, rewritten steps) and `BATCHES`. `meal-rules.test.js` checks every meal. The page loads `meals.js` and renders recipes from the catalogue amounts for the chosen portion, with a Batch prep card. `.cursor/rules/meals.mdc` carries the rules and workflow.

**Tech Stack:** plain browser JS, Node built-in test runner, Cursor rules (`.mdc`), GitHub Actions.

## Global Constraints

- Meal ids never change. Existing `localStorage` keys and stored days, picks and orders keep their shape.
- Each meal's L/S/X numbers (`k p c f cost what`) stay exactly as they are, except fried rice Light `k` 640 → 608 and snack plate Light `k` 175 → 166.
- Build a shop picks (meal × serves, not tied to a day) are bought at Standard; planned days at their portion.
- Every meal-derived string inserted into HTML goes through `esc`.
- Commit straight to `main` with the prefix `meals:` (release commit: `release: v0.9.0`). After each push CI must be green before the next task. Bump the version only in Task 5.
- JS tests: `node --test "apps/android/app/src/test/js/*.test.js"` (keep the quotes); 131 pass before this plan.
- Do not touch `platra/`, the keystore, `local.properties` or `docs/seed/`. Do not stage anything under `.superpowers/`; stage files by explicit path. Never run `git stash`, `git clean` or `git reset --hard`.

### Watching CI after a push (PowerShell)

```powershell
Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status *> $null; "CI $id exit $LASTEXITCODE"
```

`exit 0` is green. Otherwise read `gh run view $id -R Evzy/weekday-fuel --log-failed`, fix, push again. A run cancelled by a concurrent run: `gh run rerun $id -R Evzy/weekday-fuel`.

### Inline-script parse check (PowerShell)

```powershell
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

---

### Task 1: Per-portion amounts in the catalogue and the shop

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js`
- Modify: `apps/android/app/src/main/assets/weekday_fuel/cart.js` (`shopFingerprint`)
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` (`dayMeals()` only)
- Test: `apps/android/app/src/test/js/catalogue.test.js`, `apps/android/app/src/test/js/cart.test.js`

**Interfaces:**
- Produces: `AMOUNTS[meal][item]` may be a number or `{L, S, X}` (numbers ≥ 0); `cat.amountFor(meal, item, tier = "S")` → number (0 when unused or unknown); `shopList(picks, fixtureDays, dayMeals)` with `dayMeals: [{day, meal, t?}]`.

- [ ] **Step 1: Failing tests — append to `catalogue.test.js`:**

```js
const TIERED = create(ITEMS, { mac: { breast: 180, cheese: { L: 25, S: 40, X: 0 }, evap: { L: 0, S: 0, X: 80 } } });

test("amountFor reads a fixed amount or the portion's amount, Standard by default, 0 when unused", () => {
  assert.equal(TIERED.amountFor("mac", "breast", "L"), 180);
  assert.equal(TIERED.amountFor("mac", "cheese"), 40);
  assert.equal(TIERED.amountFor("mac", "cheese", "X"), 0);
  assert.equal(TIERED.amountFor("mac", "ham", "S"), 0);
  assert.equal(TIERED.amountFor("nope", "breast", "S"), 0);
});

test("planned meals are bought at their portion, picks at Standard, and unused items are left out", () => {
  const picked = byId(TIERED.shopList({ mac: 1 }, 0));
  assert.deepEqual(Object.keys(picked), ["breast", "cheese"]);
  assert.equal(picked.cheese.need, 40);
  const loaded = byId(TIERED.shopList({}, 0, [{ day: "2026-10-20", meal: "mac", t: "X" }]));
  assert.deepEqual(Object.keys(loaded), ["breast", "evap"]);
  assert.equal(loaded.evap.need, 80);
  const mixed = byId(TIERED.shopList({}, 0, [{ day: "2026-10-20", meal: "mac", t: "L" }, { day: "2026-10-21", meal: "mac" }]));
  assert.equal(mixed.cheese.need, 65);
  assert.deepEqual(mixed.cheese.days, ["2026-10-20", "2026-10-21"]);
  assert.equal(mixed.evap, undefined);
});

test("mealCost prices Standard and usedIn counts a meal when any portion uses the item", () => {
  assert.equal(TIERED.mealCost("mac", "coles"), 2.76);
  assert.deepEqual(TIERED.usedIn("evap"), ["mac"]);
  assert.deepEqual(TIERED.usedIn("ham"), []);
});
```

(`mealCost`: 180/1400 × 16.8 = 2.16 breast + 40/500 × 7.5 = 0.60 cheese; evap is 0 at Standard.)

- [ ] **Step 2: Failing test — append to `cart.test.js`** (`shopFingerprint` is already imported there; if not, add it to the `require`):

```js
test("a planned meal's Light or Loaded portion is part of the fingerprint, and Standard keys are unchanged", () => {
  const base = shopFingerprint({}, [{ day: "2026-10-20", meal: "mac" }], 5);
  assert.equal(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "S" }], 5), base);
  assert.notEqual(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "X" }], 5), base);
  assert.notEqual(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "L" }], 5), shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "X" }], 5));
});
```

- [ ] **Step 3: Run to see them fail.** `node --test "apps/android/app/src/test/js/*.test.js"`.

- [ ] **Step 4: Implement in `catalogue.js`.** Above `function create(` add:

```js
  /* An AMOUNTS value is a number (every portion) or {L, S, X}; a portion amount of 0 means that portion doesn't use the item. */
  function tierAmount(v, tier) {
    if (typeof v === "number") return v;
    var a = v && v[tier || "S"];
    return typeof a === "number" ? a : 0;
  }
```

Inside `create`, add before `function shopList`:

```js
    function amountFor(meal, id, tier) {
      var per = amounts[meal];
      return per && Object.prototype.hasOwnProperty.call(per, id) ? tierAmount(per[id], tier) : 0;
    }
```

In `shopList`, change `addMeal` and its callers:

```js
      function addMeal(meal, serves, day, tier) {
        var per = amounts[meal];
        if (!serves || !per) return;
        Object.keys(per).forEach(function (id) {
          var a = tierAmount(per[id], tier);
          if (!(a > 0)) return;
          need[id] = (need[id] || 0) + a * serves;
          var u = (used[id] = used[id] || []);
          if (u.indexOf(meal) < 0) u.push(meal);
          if (day) (days[id] = days[id] || {})[day] = true;
        });
      }
      Object.keys(picks).forEach(function (meal) {
        addMeal(meal, picks[meal], null, "S");
      });
      (dayMeals || []).forEach(function (dm) {
        addMeal(dm.meal, 1, dm.day, dm.t === "L" || dm.t === "X" ? dm.t : "S");
      });
```

`mealCost` (Standard):

```js
      Object.keys(per).forEach(function (id) {
        var q = tierAmount(per[id], "S");
        var it = byId[id];
        var p = it && (it[store] || it[other]);
        if (!(q > 0) || !p) return;
        sum += p.perKg ? (q / 1000) * p.price : (q / p.size) * p.price;
      });
```

`usedIn`:

```js
    function usedIn(id) {
      return Object.keys(amounts).filter(function (meal) {
        var v = amounts[meal][id];
        return v !== undefined && ["L", "S", "X"].some(function (t) {
          return tierAmount(v, t) > 0;
        });
      });
    }
```

Add `amountFor: amountFor,` to the object `create` returns.

- [ ] **Step 5: Implement in `cart.js` `shopFingerprint`:** the day-meal key becomes

```js
        return dm.day + ":" + dm.meal + (dm.t === "L" || dm.t === "X" ? ":" + dm.t : "");
```

- [ ] **Step 6: Page.** In `Weekday_Fuel.html`, `dayMeals()` passes the portion:

```js
function dayMeals(){return shopDays().flatMap(d=>((state.days[d]&&state.days[d].meals)||[]).filter(m=>m.shop!==false).map(m=>({day:d,meal:m.id,t:m.t})))}
```

Search the page for other `shopFingerprint(` calls and `dayMeals()` uses; they take the same array, so nothing else changes.

- [ ] **Step 7: Run tests and the parse check.** 135 pass; `node --check` silent.

- [ ] **Step 8: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add apps/android/app/src/main/assets/weekday_fuel/catalogue.js apps/android/app/src/main/assets/weekday_fuel/cart.js apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html apps/android/app/src/test/js/catalogue.test.js apps/android/app/src/test/js/cart.test.js
git commit -m "meals: per-portion amounts; planned days are bought at their portion"
git push
```

---

### Task 2: Meal data file, per-portion amounts and the meal rule checks

**Files:**
- Create: `apps/android/app/src/main/assets/weekday_fuel/meals.js`
- Create: `apps/android/app/src/test/js/meal-rules.test.js`
- Modify: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` (`AMOUNTS` block only)
- Modify: `apps/android/app/src/test/js/catalogue-data.test.js`
- Modify: `.github/workflows/release-android.yml` (append `apps/android/app/src/test/js/meal-rules.test.js` to the `node --test` list)
- Modify: `README.md` (row after `catalogue.js`: `` | `apps/android/app/src/main/assets/weekday_fuel/meals.js` | Evan's meals (portions, recipes) and batch-prep recipes | ``)

**Interfaces:**
- Consumes: Task 1 `amountFor` and `{L, S, X}` amounts.
- Produces: `meals.js` exports `{MEALS, BATCHES}` (`module.exports` under Node, `window.WeekdayFuelMeals` in the page). The page does not load it yet (Task 3).

- [ ] **Step 1: Write `meals.js`** exactly:

```js
/* Evan's meals and batch-prep recipes. Pure data. The rules every meal follows: .cursor/rules/meals.mdc and test/js/meal-rules.test.js. Ingredient amounts per portion live in catalogue.js AMOUNTS. */
(function (root) {
  "use strict";
  /* k=kcal p=protein c=carbs f=fat (g), cost=AUD per serve (estimate). prep: assemble | quick | cook. extras: non-shop ingredients, a string (every portion) or {tiers, text}. */
  var MEALS = [
    {
      id: "toasty", name: "Loaded ham & cheese toasty", slots: ["breakfast"], cuisine: "Aussie", mins: 6, prep: "quick",
      core: "100g shaved ham",
      t: {
        L: { k: 390, p: 35, c: 38, f: 11, cost: 3.2, what: "2 wholemeal slices, 1 light cheese slice" },
        S: { k: 490, p: 41, c: 38, f: 19, cost: 3.5, what: "2 cheese slices + thin butter outside" },
        X: { k: 580, p: 41, c: 60, f: 18, cost: 3.9, what: "Thick sourdough, 2 cheese slices, butter" },
      },
      extras: [{ tiers: "X", text: "2 thick slices of sourdough (buy separately)" }, { tiers: "L", text: "Oil spray" }, { tiers: "SX", text: "Thin spread of butter for the outside" }],
      steps: [
        "Heat a sandwich press, or a frying pan on medium.",
        "Layer the ham, cheese, spinach and halved tomatoes between the bread.",
        "Butter or spray the outsides.",
        "Press 3–4 min, or fry 2 min each side, until golden and the cheese melts.",
      ],
    },
    {
      id: "eggmuffin", name: "Egg & ham breakfast muffins", slots: ["breakfast"], cuisine: "Café", mins: 7, prep: "quick",
      core: "3 eggs + 50g ham",
      t: {
        L: { k: 410, p: 34, c: 27, f: 18, cost: 2.7, what: "1 English muffin, no cheese" },
        S: { k: 600, p: 45, c: 52, f: 23, cost: 3.4, what: "2 muffins + 1 light cheese slice" },
        X: { k: 700, p: 51, c: 52, f: 32, cost: 3.9, what: "2 muffins, 2 cheese slices, butter" },
      },
      extras: ["Oil spray", "Hot sauce or tomato sauce, to taste", { tiers: "X", text: "Butter for the muffins" }],
      steps: [
        "Heat a non-stick pan on medium with oil spray. Crack in the eggs and fry 3 min (break the yolks if you like them firm).",
        "Toast the muffins while the eggs cook, and butter them on Loaded.",
        "Warm the ham in the pan for the last 30 sec.",
        "Stack muffin, cheese, ham, spinach and egg. Add sauce to taste.",
      ],
    },
    {
      id: "yogbowl", name: "Greek yoghurt berry bowl", slots: ["breakfast", "snack"], cuisine: "No-cook", mins: 2, prep: "assemble",
      core: "250g high-protein plain Greek yoghurt",
      t: {
        L: { k: 210, p: 26, c: 25, f: 0, cost: 2.9, what: "Yoghurt, 100g frozen berries, 1 tsp honey" },
        S: { k: 370, p: 30, c: 49, f: 5, cost: 3.3, what: "+ 40g muesli" },
        X: { k: 545, p: 36, c: 63, f: 16, cost: 3.7, what: "+ 60g muesli + 1 tbsp peanut butter" },
      },
      extras: [],
      steps: [
        "Microwave the berries in the bowl for 40 sec until jammy, or thaw them in the fridge overnight.",
        "Spoon the yoghurt over or alongside.",
        "Drizzle the honey, then add the muesli and peanut butter if your portion has them.",
      ],
    },
    {
      id: "brekwrap", name: "Scrambled egg breakfast wrap", slots: ["breakfast"], cuisine: "Mexican", mins: 6, prep: "quick",
      core: "3 eggs + 50g ham",
      t: {
        L: { k: 430, p: 38, c: 22, f: 21, cost: 2.8, what: "1 protein wrap, salsa, spinach" },
        S: { k: 490, p: 44, c: 22, f: 25, cost: 3.2, what: "+ 20g light grated cheese" },
        X: { k: 660, p: 56, c: 40, f: 32, cost: 4.0, what: "2 wraps, 30g cheese" },
      },
      extras: ["Salt and pepper", "Oil spray"],
      steps: [
        "Whisk the eggs with salt and pepper.",
        "Heat a non-stick pan on medium with oil spray. Scramble the eggs for 2 min, stirring, until just set.",
        "Fold in the torn ham and the spinach for the last 30 sec.",
        "Warm the wraps for 15 sec in the microwave. Fill with the eggs, cheese and salsa, and roll.",
      ],
    },
    {
      id: "tenderwrap", name: "Chicken tender wraps", slots: ["main"], cuisine: "Your go-to", mins: 5, prep: "assemble", batch: ["chicken"],
      core: "150g cooked chicken breast (Sunday batch)",
      t: {
        L: { k: 455, p: 53, c: 25, f: 14, cost: 3.55, what: "1 protein wrap, 20g light cheese" },
        S: { k: 625, p: 65, c: 43, f: 20, cost: 4.55, what: "2 wraps, 30g light cheese" },
        X: { k: 735, p: 71, c: 45, f: 30, cost: 5.05, what: "2 wraps, 50g cheese, light mayo" },
      },
      extras: [{ tiers: "X", text: "1 tbsp light mayo" }],
      steps: [
        "Take a portion of Sunday chicken and slice it.",
        "Warm it for 60–90 sec in the microwave, or 2 min in a hot pan for colour.",
        "Warm the wraps for 15 sec. Load them with the chicken, cheese, sliced cucumber, halved tomatoes, spinach and salsa (and the mayo on Loaded).",
        "Roll them up. Optional: 2 min in the sandwich press.",
      ],
      note: "Crumbed frozen tenders instead of plain chicken add roughly 150 kcal per serve. Deli BBQ chicken adds about $1.70 a serve.",
    },
    {
      id: "burritobowl", name: "Chicken burrito bowl", slots: ["main"], cuisine: "Mexican", mins: 5, prep: "assemble", batch: ["chicken"],
      core: "150g cooked chicken breast (Sunday batch)",
      t: {
        L: { k: 560, p: 50, c: 69, f: 8, cost: 3.7, what: "½ rice pouch, no cheese" },
        S: { k: 755, p: 61, c: 91, f: 15, cost: 4.4, what: "¾ pouch + 30g light cheese" },
        X: { k: 975, p: 64, c: 114, f: 27, cost: 5.8, what: "Whole pouch, cheese, ½ avocado" },
      },
      extras: ["Splash of water", { tiers: "X", text: "½ avocado (buy separately)" }],
      steps: [
        "Toss a portion of Sunday chicken with the taco seasoning and a splash of water. Microwave for 90 sec.",
        "Microwave the rice pouch for 90 sec and the drained corn for 2 min.",
        "Dice the capsicum.",
        "Bowl it: rice, chicken, corn, capsicum, salsa and a dollop of yoghurt as sour cream, then the cheese (and avocado on Loaded).",
      ],
    },
    {
      id: "teriyaki", name: "Teriyaki chicken rice bowl", slots: ["main"], cuisine: "Japanese", mins: 12, prep: "quick",
      core: "200g chicken thigh fillet",
      t: {
        L: { k: 600, p: 48, c: 65, f: 14, cost: 5.1, what: "½ rice pouch, stir-fry veg" },
        S: { k: 735, p: 51, c: 87, f: 17, cost: 5.55, what: "¾ pouch + sesame seeds" },
        X: { k: 940, p: 53, c: 109, f: 29, cost: 6.3, what: "Whole pouch + Kewpie drizzle" },
      },
      extras: ["Oil spray", { tiers: "SX", text: "1 tsp sesame seeds" }, { tiers: "X", text: "1 tbsp Kewpie mayo" }],
      steps: [
        "Slice the thigh into strips.",
        "Heat a frying pan on high with oil spray. Fry the chicken for 6–7 min until browned and cooked through.",
        "Add the frozen veg for 2 min, then the teriyaki. Let it bubble for 1 min until sticky.",
        "Microwave the rice pouch for 90 sec. Serve the chicken over the rice, topped with sesame seeds and Kewpie if your portion has them.",
      ],
    },
    {
      id: "buffalomac", name: "Buffalo chicken mac & cheese", slots: ["main"], cuisine: "American", mins: 15, prep: "cook", remake: "YES-style buffalo chicken mac",
      core: "180g chicken breast",
      t: {
        L: { k: 565, p: 64, c: 51, f: 10, cost: 3.9, what: "50g dry macaroni, 25g light cheese" },
        S: { k: 700, p: 71, c: 69, f: 14, cost: 4.1, what: "75g macaroni, 40g light cheese" },
        X: { k: 870, p: 74, c: 87, f: 21, cost: 4.5, what: "100g macaroni, 50g full-fat tasty" },
      },
      extras: ["Oil spray", "½ tsp garlic powder", "½ tsp paprika", { tiers: "X", text: "50g full-fat tasty cheese, grated (instead of the light cheese)" }],
      steps: [
        "Boil the macaroni in salted water for 9 min.",
        "Meanwhile dice the chicken. Pan-fry it on medium-high with oil spray, garlic powder and paprika for 6 min until cooked through.",
        "Take the pan off the heat and toss the chicken through most of the Frank's.",
        "Drain the pasta and return it to the pot on low. Add the evaporated milk and the cheese and stir for 1 min until glossy.",
        "Microwave the broccoli for 3 min. Fold the chicken and broccoli through and finish with the rest of the Frank's.",
      ],
      note: "Evaporated milk is the trick. It makes a creamy sauce that won't split, and the can lives in the pantry. Cook 2 serves and box one for tomorrow.",
    },
    {
      id: "schnitzel", name: "Chicken schnitzel, mash & peas", slots: ["main"], cuisine: "Pub classic", mins: 18, prep: "cook", remake: "YES-style chicken schnitzel",
      core: "180g chicken breast, crumbed",
      t: {
        L: { k: 550, p: 53, c: 51, f: 13, cost: 3.4, what: "100g potato mash" },
        S: { k: 650, p: 55, c: 73, f: 13, cost: 3.7, what: "200g mash + gravy" },
        X: { k: 810, p: 57, c: 91, f: 21, cost: 4.1, what: "300g mash with butter + gravy" },
      },
      extras: ["1 tsp oil + oil spray", "½ tsp paprika, salt and pepper", "Splash of milk for the mash", { tiers: "X", text: "Knob of butter for the mash" }],
      steps: [
        "Slice the breast in half horizontally, or bash it to about 1 cm thick.",
        "Beat the egg in one bowl and mix the panko with the paprika and salt in another. Dip the chicken in the egg, then press it into the crumbs.",
        "Pan-fry in the oil and spray on medium-high for 3 min each side until golden and cooked through (air fryer: 200 °C for 12 min).",
        "Meanwhile prick the potato and microwave it for 6–8 min until soft, then mash it with a fork and the milk (and butter on Loaded).",
        "Microwave the peas for 3 min. Make up the gravy with boiling water.",
      ],
      note: "Crumb 2–3 breasts at once and freeze them raw between baking paper. They go straight from freezer to pan.",
    },
    {
      id: "koreanbeef", name: "Korean beef mince bowl", slots: ["main"], cuisine: "Korean", mins: 10, prep: "quick",
      core: "200g lean beef mince",
      t: {
        L: { k: 595, p: 52, c: 57, f: 16, cost: 6.3, what: "½ rice pouch, less honey" },
        S: { k: 710, p: 59, c: 67, f: 21, cost: 6.85, what: "+ fried egg on top" },
        X: { k: 920, p: 63, c: 111, f: 22, cost: 8.3, what: "Whole pouch + fried egg" },
      },
      extras: ["Oil spray"],
      steps: [
        "Brown the mince in a hot pan for 5 min, breaking it up.",
        "Add the garlic and ginger paste, soy, honey and sesame oil. Cook for 2 min until glossy.",
        "Microwave the rice pouch for 90 sec and the broccoli for 3 min.",
        "On Standard or Loaded, fry the egg in oil spray for 2–3 min. Serve the beef over the rice with the broccoli (and the egg).",
      ],
      note: "4-star mince is cheaper and adds about 60 kcal.",
    },
    {
      id: "bolognese", name: "15-minute bolognese", slots: ["main"], cuisine: "Italian", mins: 15, prep: "cook",
      core: "200g lean beef mince",
      t: {
        L: { k: 615, p: 57, c: 64, f: 13, cost: 5.4, what: "60g spaghetti, 10g parmesan" },
        S: { k: 700, p: 60, c: 82, f: 14, cost: 5.45, what: "85g spaghetti" },
        X: { k: 870, p: 67, c: 100, f: 22, cost: 5.85, what: "110g spaghetti, 20g parmesan, olive oil" },
      },
      extras: ["1 tsp dried Italian herbs", { tiers: "X", text: "1 tsp olive oil" }],
      steps: [
        "Boil the spaghetti in salted water for 10 min.",
        "Meanwhile brown the mince with the garlic paste on high for 5 min.",
        "Add the frozen veg, the passata and the herbs. Simmer for 5 min.",
        "Drain the pasta and toss it through the sauce (with the olive oil on Loaded). Finish with the parmesan.",
      ],
      note: "Double the sauce and freeze half flat in a zip bag. It takes up little freezer space.",
    },
    {
      id: "redcurry", name: "Thai red curry chicken", slots: ["main"], cuisine: "Thai", mins: 12, prep: "quick",
      core: "180g chicken breast",
      t: {
        L: { k: 605, p: 50, c: 59, f: 17, cost: 5.4, what: "½ rice pouch" },
        S: { k: 710, p: 52, c: 81, f: 18, cost: 6.1, what: "¾ rice pouch" },
        X: { k: 860, p: 54, c: 103, f: 23, cost: 6.85, what: "Whole pouch, extra coconut milk" },
      },
      extras: ["Oil spray", "Water, the same amount as the coconut milk", "Splash of fish sauce (optional)"],
      steps: [
        "Slice the chicken thinly.",
        "Fry the curry paste in oil spray on medium-high for 30 sec until fragrant. Add the chicken and cook for 4 min.",
        "Add the frozen veg, the coconut milk and the same amount of water. Simmer for 4 min.",
        "Microwave the rice pouch for 90 sec. Add a splash of fish sauce to the curry and serve it over the rice.",
      ],
      note: "Ayam Light is still fairly rich (about 170 kcal per 100mL), so it's stretched with water. Freeze the rest of the can in an ice-cube tray.",
    },
    {
      id: "friedrice", name: "No-chop chicken fried rice", slots: ["main"], cuisine: "Chinese", mins: 8, prep: "quick", batch: ["chicken"],
      core: "120g cooked chicken breast + 2 eggs",
      t: {
        L: { k: 608, p: 52, c: 64, f: 16, cost: 5.3, what: "½ rice pouch, spray oil" },
        S: { k: 785, p: 54, c: 86, f: 21, cost: 6.0, what: "¾ pouch + sesame oil" },
        X: { k: 940, p: 56, c: 108, f: 27, cost: 6.8, what: "Whole pouch, 2 tsp oil" },
      },
      extras: [{ tiers: "LS", text: "Oil spray" }, { tiers: "X", text: "2 tsp vegetable oil" }],
      steps: [
        "Heat a large frying pan or wok on high with the oil. Scramble the eggs for 1 min and push them to the side.",
        "Add the frozen peas and the drained corn for 2 min.",
        "Add the rice straight from the pouch and a portion of Sunday chicken, torn up. Break the rice up as it heats.",
        "Add the soy, the oyster sauce and (on Standard and Loaded) the sesame oil. Toss on high for 2 min.",
      ],
    },
    {
      id: "snackplate", name: "Egg & salad snack plate", slots: ["snack"], cuisine: "No-cook", mins: 1, prep: "assemble", batch: ["eggs"],
      core: "2 hard-boiled eggs",
      t: {
        L: { k: 166, p: 14, c: 5, f: 10, cost: 1.6, what: "Eggs, cucumber, cherry tomatoes" },
        S: { k: 240, p: 20, c: 5, f: 15, cost: 1.9, what: "+ 1 light cheese slice" },
        X: { k: 315, p: 27, c: 5, f: 20, cost: 2.5, what: "3 eggs + cheese" },
      },
      extras: ["Salt and pepper"],
      steps: [
        "Peel the boiled eggs from your batch and halve them.",
        "Slice the cucumber and halve the tomatoes.",
        "Plate it all up with the cheese if your portion has it, and season.",
      ],
    },
  ];

  /* Cooked early in the week and reused. item = the catalogue item it's made from; ratio = cooked weight per raw weight. */
  var BATCHES = [
    {
      id: "chicken", name: "Sunday chicken", item: "breast", ratio: 0.75, as: "Sunday chicken, cooked",
      makes: "About 750g cooked from 1kg raw breast: 5 portions of 150g",
      keeps: "3–4 days in the fridge. Freeze the Thursday and Friday portions after cooking and thaw them overnight",
      steps: [
        "Heat the oven to 200 °C and line a tray with baking paper.",
        "Lay out 1kg of chicken breast, spray with oil and season with salt, pepper and paprika or garlic powder.",
        "Bake for 20–25 min until the thickest part is cooked through (no pink, juices run clear).",
        "Rest for 10 min, cool, then slice and split into 5 containers of about 150g.",
        "Fridge three and freeze two.",
      ],
    },
    {
      id: "eggs", name: "Boiled eggs", item: "eggs", ratio: 1, as: "hard-boiled, from your batch",
      makes: "6 hard-boiled eggs",
      keeps: "Up to 5 days in the fridge, unpeeled",
      steps: [
        "Bring a saucepan of water to the boil.",
        "Lower in 6 eggs and boil for 9 min.",
        "Move them to cold water for 5 min, then keep them in the fridge unpeeled.",
      ],
    },
  ];

  var api = { MEALS: MEALS, BATCHES: BATCHES };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelMeals = api;
})(this);
```

- [ ] **Step 2: Replace `catalogue.js` `AMOUNTS`** with:

```js
  var AMOUNTS = {
    toasty: { bread: { L: 2, S: 2, X: 0 }, ham: 100, cheese: { L: 20, S: 40, X: 40 }, spinach: 20, toms: 50 },
    eggmuffin: { eggs: 3, ham: 50, muffin: { L: 1, S: 2, X: 2 }, cheese: { L: 0, S: 20, X: 40 }, spinach: 20 },
    yogbowl: { yog: 250, fzberry: 100, honey: 7, muesli: { L: 0, S: 40, X: 60 }, pb: { L: 0, S: 0, X: 16 } },
    brekwrap: { eggs: 3, ham: 50, wraps: { L: 1, S: 1, X: 2 }, cheese: { L: 0, S: 20, X: 30 }, salsa: 30, spinach: 20 },
    tenderwrap: { breast: 200, wraps: { L: 1, S: 2, X: 2 }, cheese: { L: 20, S: 30, X: 50 }, salsa: 30, spinach: 20, cucumber: 0.5, toms: 50 },
    burritobowl: { rice: { L: 0.5, S: 0.75, X: 1 }, breast: 200, corn: 80, capsicum: 0.5, salsa: 30, taco: 4, yog: 50, cheese: { L: 0, S: 30, X: 30 } },
    teriyaki: { thigh: 200, teriyaki_sauce: 50, rice: { L: 0.5, S: 0.75, X: 1 }, fzasian: 150 },
    buffalomac: { breast: 180, macaroni: { L: 50, S: 75, X: 100 }, evap: 80, cheese: { L: 25, S: 40, X: 0 }, franks: 50, fzbroc: 100 },
    schnitzel: { breast: 180, eggs: 1, panko: 30, potato: { L: 100, S: 200, X: 300 }, fzpeas: 120, gravy: { L: 0, S: 10, X: 10 } },
    koreanbeef: { mince: 200, soy: 40, honey: { L: 14, S: 21, X: 21 }, sesame: 5, garlic: 5, ginger: 5, rice: { L: 0.5, S: 0.5, X: 1 }, eggs: { L: 0, S: 1, X: 1 }, fzbroc: 150 },
    bolognese: { mince: 200, spaghetti: { L: 60, S: 85, X: 110 }, passata: 200, fzmix: 100, garlic: 5, parm: { L: 10, S: 10, X: 20 } },
    redcurry: { breast: 180, curry: 15, coco: { L: 70, S: 70, X: 100 }, fzasian: 150, rice: { L: 0.5, S: 0.75, X: 1 } },
    friedrice: { breast: 160, eggs: 2, rice: { L: 0.5, S: 0.75, X: 1 }, fzpeas: 60, corn: 60, soy: 40, oyster: 20, sesame: { L: 0, S: 5, X: 5 } },
    snackplate: { eggs: { L: 2, S: 2, X: 3 }, cucumber: 0.5, toms: 50, cheese: { L: 0, S: 20, X: 20 } },
  };
```

(Standard amounts are unchanged except toasty cheese 30 → 40 g, two slices as its `what` says, and the yoghurt bowl no longer buys peanut butter at Standard. Batch meals keep the raw breast: 200 g raw = 150 g cooked, 160 g = 120 g.)

- [ ] **Step 3: Write `meal-rules.test.js`:**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MEALS, BATCHES } = require("../../main/assets/weekday_fuel/meals.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");

const TIERS = ["L", "S", "X"];
const SLOT_MIN = { breakfast: 30, main: 45, snack: 15 };
const PREP = ["assemble", "quick", "cook"];
const BANNED = /tuna|salmon|cottage cheese/i;
const BATCH = Object.fromEntries(BATCHES.map((b) => [b.id, b]));
const str = (s) => typeof s === "string" && s.trim().length > 0;
const extraText = (e) => (typeof e === "string" ? e : e.text);
const tiered = (m) => Object.values(cat.AMOUNTS[m.id] || {}).some((v) => typeof v !== "number");

test("every meal has the full shape", () => {
  const ids = new Set();
  for (const m of MEALS) {
    assert.match(m.id, /^[a-z][a-z0-9]*$/, "id " + m.id);
    assert.ok(!ids.has(m.id), "duplicate " + m.id);
    ids.add(m.id);
    for (const k of ["name", "cuisine", "core"]) assert.ok(str(m[k]), m.id + " " + k);
    assert.ok(Array.isArray(m.slots) && m.slots.length > 0 && m.slots.every((s) => s in SLOT_MIN), m.id + " slots");
    assert.ok(m.mins > 0, m.id + " mins");
    assert.ok(PREP.includes(m.prep), m.id + " prep");
    for (const t of TIERS) {
      const v = m.t && m.t[t];
      assert.ok(v, m.id + " " + t);
      for (const k of ["k", "p", "c", "f"]) assert.ok(typeof v[k] === "number" && v[k] >= 0, m.id + " " + t + "." + k);
      assert.ok(v.cost > 0, m.id + " " + t + " cost");
      assert.ok(str(v.what), m.id + " " + t + " what");
    }
    assert.ok(Array.isArray(m.extras), m.id + " extras");
    for (const e of m.extras) {
      const ok = typeof e === "string" ? str(e) : !!e && str(e.text) && /^(?!.*(.).*\1)[LSX]+$/.test(e.tiers || "");
      assert.ok(ok, m.id + " extra " + JSON.stringify(e));
    }
    assert.ok(Array.isArray(m.steps) && m.steps.length >= 3 && m.steps.every(str), m.id + " needs at least 3 steps");
    assert.ok(!("ing" in m), m.id + " ingredients come from catalogue amounts, not a free-text list");
  }
});

test("kcal are within 5% of 4 × protein + 4 × carbs + 9 × fat for every portion", () => {
  for (const m of MEALS) {
    for (const t of TIERS) {
      const v = m.t[t];
      const calc = 4 * v.p + 4 * v.c + 9 * v.f;
      assert.ok(Math.abs(v.k - calc) <= 0.05 * calc, `${m.id} ${t}: ${v.k} kcal vs ${calc} from macros`);
    }
  }
});

test("Standard protein meets the minimum for the meal's lowest slot", () => {
  for (const m of MEALS) {
    const min = Math.min(...m.slots.map((s) => SLOT_MIN[s]));
    assert.ok(m.t.S.p >= min, `${m.id} Standard ${m.t.S.p}g protein, needs ${min}g`);
  }
});

test("no meal uses a banned food", () => {
  for (const m of MEALS) {
    const texts = [m.name, m.core, m.note || "", ...TIERS.map((t) => m.t[t].what), ...m.extras.map(extraText), ...m.steps];
    for (const id of Object.keys(cat.AMOUNTS[m.id] || {})) {
      const it = cat.item(id);
      texts.push(it.name);
      for (const store of ["coles", "woolies"]) if (it[store]) texts.push(it[store].name);
    }
    for (const s of texts) assert.doesNotMatch(s, BANNED, m.id + ": " + s);
  }
});

test("every meal has shopping amounts, and every amount is a positive number or a portion set", () => {
  assert.deepEqual(Object.keys(cat.AMOUNTS).sort(), MEALS.map((m) => m.id).sort());
  for (const m of MEALS) {
    for (const [id, v] of Object.entries(cat.AMOUNTS[m.id])) {
      assert.ok(cat.item(id), m.id + " uses unknown item " + id);
      if (typeof v === "number") assert.ok(v > 0, m.id + "." + id);
      else {
        assert.ok(TIERS.every((t) => typeof v[t] === "number" && v[t] >= 0), m.id + "." + id + " needs L, S and X");
        assert.ok(TIERS.some((t) => v[t] > 0), m.id + "." + id + " is never used");
      }
    }
  }
});

test("steps never hard-code a gram or mL amount in a meal whose amounts change by portion", () => {
  for (const m of MEALS) if (tiered(m)) for (const s of m.steps) assert.doesNotMatch(s, /\d\s*(g|mL)\b/, m.id + ": " + s);
});

test("batches are complete, and meals only use real batches made from an item they buy", () => {
  for (const b of BATCHES) {
    for (const k of ["id", "name", "as", "makes", "keeps"]) assert.ok(str(b[k]), b.id + " " + k);
    assert.ok(cat.item(b.item), b.id + " item");
    assert.ok(b.ratio > 0 && b.ratio <= 1, b.id + " ratio");
    assert.ok(Array.isArray(b.steps) && b.steps.length >= 2 && b.steps.every(str), b.id + " steps");
  }
  for (const m of MEALS) {
    if (!("batch" in m)) continue;
    assert.ok(Array.isArray(m.batch) && m.batch.length > 0, m.id + " batch");
    for (const id of m.batch) {
      assert.ok(BATCH[id], m.id + " uses unknown batch " + id);
      assert.ok(BATCH[id].item in cat.AMOUNTS[m.id], m.id + " doesn't buy " + BATCH[id].item + " for " + id);
    }
  }
});
```

- [ ] **Step 4: Update `catalogue-data.test.js`.** Replace the hard-coded `const MEALS = [...]` with:

```js
const MEALS = require("../../main/assets/weekday_fuel/meals.js").MEALS.map((m) => m.id);
```

and in "every meal's items exist…" replace `assert.ok(amount > 0, meal + "." + id + " amount");` with:

```js
      assert.ok(typeof amount === "number" ? amount > 0 : ["L", "S", "X"].some((t) => amount[t] > 0), meal + "." + id + " amount");
```

- [ ] **Step 5: CI list and README** as listed under Files.

- [ ] **Step 6: Run all JS tests.** `node --test "apps/android/app/src/test/js/*.test.js"` → all pass (135 + 7 = 142). If a meal fails a rule, fix the data, never the rule, and say so in the report. The page is untouched in this task and still runs on its inline meals.

- [ ] **Step 7: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add apps/android/app/src/main/assets/weekday_fuel/meals.js apps/android/app/src/main/assets/weekday_fuel/catalogue.js apps/android/app/src/test/js/meal-rules.test.js apps/android/app/src/test/js/catalogue-data.test.js .github/workflows/release-android.yml README.md
git commit -m "meals: meal data file with full recipes and batch prep; per-portion amounts; meal rule checks"
git push
```

---

### Task 3: The page uses `meals.js`: portion-aware recipes and Batch prep

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: `window.WeekdayFuelMeals = {MEALS, BATCHES}` (Task 2); `CAT.amountFor(meal, item, tier)`, `CAT.item(id)`, `CAT.AMOUNTS` (Task 1).

- [ ] **Step 1: Load the data.** Add `<script src="meals.js"></script>` immediately before `<script src="catalogue.js"></script>`. Replace the whole inline block from the comment `/* k=kcal p=protein c=carbs f=fat (g), cost=AUD per serve (estimate) */` through the closing `];` of `const MEALS=[` with:

```js
const MEALS=WeekdayFuelMeals.MEALS,BATCHES=WeekdayFuelMeals.BATCHES;
const BATCH=Object.fromEntries(BATCHES.map(b=>[b.id,b]));
const PREP_LABEL={assemble:"Assemble",quick:"Quick cook",cook:"Full cook"};
```

(`const MEAL = Object.fromEntries(...)` stays.)

- [ ] **Step 2: Recipe helpers.** After `fmtAmt` add:

```js
const FRACTION={0.25:"¼",0.5:"½",0.75:"¾"};
const oneUnit=u=>u.replace(/(ch|sh|x)es$/,"$1").replace(/s$/,"");
function amountText(v,unit){if(/^(g|mL)$/.test(unit))return fmtAmt(v,unit);return (FRACTION[v]||String(Math.round(v*100)/100))+" "+(v<=1?oneUnit(unit):unit)}
/* One line per item the portion uses (batch items show as the batch), then that portion's extras */
function recipeLines(m,tier){
  const per=CAT.AMOUNTS[m.id]||{},st=store(),bs=(m.batch||[]).map(id=>BATCH[id]).filter(Boolean);
  const items=Object.keys(per).map(id=>{
    const v=CAT.amountFor(m.id,id,tier),it=CAT.item(id);if(!(v>0)||!it)return "";
    const b=bs.find(x=>x.item===id);
    if(b)return `<li><b>${esc(amountText(v*b.ratio,it.unit))}</b> ${esc(b.as)}</li>`;
    const p=it[st]||it[other(st)];
    return `<li><b>${esc(amountText(v,it.unit))}</b> ${esc(it.name)}${p?` <span class="muted">${esc(p.name)}</span>`:""}</li>`;
  }).join("");
  const ex=(m.extras||[]).filter(e=>typeof e==="string"||e.tiers.includes(tier)).map(e=>`<li>${esc(typeof e==="string"?e:e.text)}</li>`).join("");
  return items+ex;
}
function batchCard(b){
  const users=MEALS.filter(m=>(m.batch||[]).includes(b.id));
  return `<div class="card"><div class="row" style="gap:6px;margin-bottom:4px"><span class="tag">Batch prep</span></div><h3>${esc(b.name)}</h3><div class="small muted">${esc(b.makes)}</div><div class="hint"><span>Keeps ${esc(b.keeps)}.</span></div><div class="stack" style="gap:8px"><div class="eyebrow">Method</div><ol class="steps">${b.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>${users.length?`<div class="eyebrow">Used in</div><div class="chips">${users.map(m=>`<button class="chip" data-act="recipe" data-v="${m.id}">${esc(m.name)}</button>`).join("")}</div>`:""}</div></div>`;
}
```

- [ ] **Step 3: `mealCard(m,full,tier)`.** Change the signature to `function mealCard(m,full,tier){` and `const tr=tier||"S";`. In the tags row, after the minutes tag add `<span class="tag">${esc(PREP_LABEL[m.prep]||"")}</span>`. Replace the whole `full?`…`:""` recipe block (the one with `<div class="eyebrow">Shopping</div>` and `m.ing`) with:

```js
${full?`<div class="stack" style="gap:8px"><div class="row between"><div class="eyebrow">Ingredients</div><div class="dial" role="group" aria-label="Recipe portion">${TIERS.map(([k,l])=>`<button aria-pressed="${tr===k}" data-act="sheettier" data-v="${k}">${l}</button>`).join("")}</div></div><ul class="ing">${recipeLines(m,tr)}</ul>${(m.batch||[]).map(id=>BATCH[id]).filter(Boolean).map(b=>`<div class="row between"><span class="small">Uses ${esc(b.name)} from your batch prep</span><button class="ghost" data-act="batch" data-v="${b.id}">Batch prep</button></div>`).join("")}<div class="eyebrow">Method</div><ol class="steps">${m.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>${m.note?`<div class="hint"><span>${esc(m.note)}</span></div>`:""}</div>`:""}
```

- [ ] **Step 4: Sheet.** Replace `renderSheet` with:

```js
function renderSheet(){
  const root=$("#sheetroot");
  if(!state.sheet){root.innerHTML="";return}
  const isBatch=state.sheet.startsWith("batch:"),b=isBatch?BATCH[state.sheet.slice(6)]:null,m=isBatch?null:MEAL[state.sheet];
  if(!b&&!m){state.sheet=null;root.innerHTML="";return}
  const name=b?b.name:m.name;
  root.innerHTML=`<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(name)}"><div class="row between" style="margin-bottom:10px"><span class="eyebrow">${b?"Batch prep":"Recipe"}</span><button class="ghost" data-act="close">Close</button></div>${b?batchCard(b):mealCard(m,true,state.sheetTier)}</div></div>`;
}
```

- [ ] **Step 5: Actions and the Today link.** In the click handler: `case "recipe":state.sheet=v;state.sheetTier=TIERS.some(([k])=>k===el.dataset.t)?el.dataset.t:"S";break;`, add `case "sheettier":state.sheetTier=v;break;` and `case "batch":state.sheet="batch:"+v;break;`. In `renderToday`'s meal row, the name button gets the planned portion: `<button class="name" data-act="recipe" data-v="${meal.id}" data-t="${m.t}">`. (Check how the handler reads `el`: it must be the element carrying `data-act`; inner clicks in the sheet must not reach the scrim's `close`. Both already hold for the existing Recipe buttons; keep it that way.)

- [ ] **Step 6: Meals tab Batch prep card.** In `renderMeals`, right after the intro block and before the filter chips:

```js
  h+=`<div class="panel stack"><div class="eyebrow">Batch prep · cook once, eat all week</div>${BATCHES.map(b=>`<button class="pick" data-act="batch" data-v="${b.id}"><span><b>${esc(b.name)}</b><br><span class="small muted">${esc(b.makes)}</span></span><span class="small muted">Recipe</span></button>`).join("")}</div>`;
```

- [ ] **Step 7: Parse check, JS tests** (142 pass), and a grep that no `m.ing`/`.ing.` use remains in the page.

- [ ] **Step 8: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "meals: recipes with amounts for the chosen portion, prep labels and a Batch prep card"
git push
```

- [ ] **Step 9 (controller): browser check.** Serve `apps/android/app/src/main/assets` on `127.0.0.1:8123`:
  - Meals tab: 14 cards with prep tags; Batch prep card opens Sunday chicken and Boiled eggs recipes; "Used in" chips open recipes.
  - Buffalo mac recipe: Standard shows 75g macaroni and 40g cheese; Loaded 100g macaroni, no light cheese line, the full-fat tasty extra; Light 50g / 25g.
  - Tender wraps recipe shows "150g Sunday chicken, cooked" with a Batch prep button; snack plate shows "2 eggs hard-boiled, from your batch" (3 on Loaded).
  - Yoghurt bowl Light has no muesli or peanut butter; Loaded has both.
  - Today: plan a day, set buffalo mac to Loaded, open its recipe from Today → opens on Loaded; add the day to the shop → macaroni need reflects 100g; switch it to Light → trolley "out of date" if previously sent.
  - Fried rice Light shows 608 kcal, snack plate Light 166.
  - A meal-name XSS check isn't needed (data is ours), but recipe lines use `esc`.

---

### Task 4: The meal rule for agents

**Files:**
- Create: `.cursor/rules/meals.mdc`
- Modify: `README.md` (row: `` | `.cursor/rules/meals.mdc` | Meal-planning rules and workflow that agent sessions follow | ``)

- [ ] **Step 1: Write `.cursor/rules/meals.mdc`** exactly:

````markdown
---
description: Evan's meal-planning rules for Weekday Fuel. Use when adding, changing, removing or proposing meals, recipes, batch prep, portions or meal products.
globs: apps/android/app/src/main/assets/weekday_fuel/meals.js,apps/android/app/src/main/assets/weekday_fuel/catalogue.js
alwaysApply: false
---

# Meals for Evan's Weekday Fuel plan

You design the meals: what goes in them, macros, portions, ingredients, recipes. The app handles weight tracking, daily totals, day plans and the shopping list, and depends on the structure below. The 14 current meals are liked: keep, refine or extend them; don't throw them out.

## Who it's for

Evan, 30, Melbourne, 183 cm, ~83.5 kg. Push/pull/legs 5 days a week at lunch, plus 2 runs. Shops at Coles and Woolworths. Desk job; wants cheap meals that take little effort.

## Targets (weekdays only)

- Protein 170 g every day: fixed, comes first.
- Calories by phase: mini-cut ~2,150 kcal (current), recomp ~2,500, lean bulk ~2,800. Weekends aren't tracked. Weekday kcal get nudged ±150 from the 7-day weight trend.
- He doesn't count calories: he picks meals, the app (or "Suggest a day") picks portions to fit, and the app adds it up.
- Daily fixtures, counted every weekday: Dare Protein No Sugar Added Iced Coffee Double Espresso 500 mL (296 kcal, 30 g P, 25.5 g C, 8 g F) and Grenade Salted Caramel bar 60 g (244 kcal, 20.5 g P, 2.1 g C, 9.5 g F): ~540 kcal, ~50 g protein. Meals cover the other ~120 g protein: one breakfast, two lunch/dinner meals, maybe a snack.

## The idea: cheap, smart, little to no prep

- **Cook once, eat many.** Build around batch components cooked early in the week: the Sunday chicken (1 kg breast → ~750 g cooked, 5 × 150 g) and boiled eggs. A new batch component needs Evan's yes.
- **Shared ingredients.** Build new meals mainly from products already in `catalogue.js`, so a week's shop stays small and prep overlaps. Take the protein, carb and veg from the existing pool; get new flavour from cheap jars, pastes and spice mixes.
- **Prep labels.** Every meal is `assemble` (~5 min from batch or no-cook parts), `quick` (one pan, ≤12 min) or `cook` (≤20 min). Lean new meals to assemble and quick.
- **Cost.** Realistic Coles/Woolworths AUD prices; aim under $7 a serve.
- **Small fridge.** Frozen veg, long-life cans, pantry jars, raw meat frozen in single portions; no half-used perishables. Microwave, stovetop and oven available.

## Food rules

- Never: tuna, tinned salmon, cottage cheese.
- Avoid beans unless minor and hard to notice.
- Variety across cuisines (Mexican, Japanese, Korean, Thai, Chinese, Italian, Indian, Middle Eastern, American, Aussie pub); no variations of the same dish. Fine to eat a meal 2 days running, not for weeks.
- It has to taste good. Ready-meal remakes (like YES-style buffalo chicken mac and schnitzel, ~$13 in the shop) are a big win.
- Before building a meal around a core ingredient (protein, carb or veg) that isn't in the food decisions list, ask Evan yes/no, one food per question, and record the answer below.

### Food decisions

| Food | Decision | Date |
| --- | --- | --- |
| Chicken breast, chicken thigh, eggs, pre-cooked chicken (BBQ chook, deli chicken), beef mince, chicken mince, deli ham, Greek yoghurt | Yes (proteins) | 2026-10-18 |
| Microwave rice pouches, rice, potato, sweet potato, pasta, high-protein wraps, bread, English muffins, crumpets | Yes (carbs) | 2026-10-18 |
| Frozen mixed veg, frozen peas and corn, frozen broccoli, baby spinach, capsicum, carrot, cherry tomatoes, cucumber | Yes (veg) | 2026-10-18 |
| Tuna, tinned salmon, cottage cheese | No, never | 2026-10-18 |
| Beans (black beans and the like) | Avoid; only minor and hard to notice | 2026-10-18 |

## Meal structure

- A fixed protein core: the protein amount is the same at every portion.
- Three portions that change only carbs and fat (rice, pasta, bread, cheese, oil, sauce): L Light, S Standard, X Loaded, each with kcal, protein, carbs, fat, AUD cost per serve and a one-line `what`.
- **Hard rules (CI fails a meal that breaks them; `test/js/meal-rules.test.js`):** kcal within 5% of 4P + 4C + 9F for every portion; Standard protein ≥ the lowest slot minimum (breakfast 30 g, main 45 g, snack 15 g); no banned food anywhere; complete shape (id, slots, prep, mins, all three portions, extras, at least 3 steps); every shopping amount a positive number or `{L, S, X}` with a portion > 0; steps never contain a gram or mL amount when the meal's amounts change by portion; batches complete and used only by meals that buy their item.
- **Guidelines (report them when proposing; never block):** kcal bands L 400–600, S 550–750, X 750–950; protein maximum breakfast 45 g, main 65 g, snack 25 g; cost over $7; prep over 20 min; beans; a product at only one store; ingredient reuse (products added that no meal uses yet — aim for at most one, never a perishable that would be left half-used — and which meals share its protein, carb and veg).

## Recipe standard

- Every shop ingredient has an amount for each portion in `catalogue.js` `AMOUNTS[meal]`: a number when it's the same for every portion, otherwise `{L, S, X}` (0 = that portion doesn't use it). Amounts must match each portion's `what` and macros.
- Non-shop ingredients go in the meal's `extras` with amounts: a string for every portion, or `{tiers: "SX", text}`.
- Steps are numbered, give heat and times, and say "the macaroni" rather than an amount that changes by portion.
- A meal that uses a batch lists `batch: ["chicken"]` and buys the raw item (150 g cooked chicken = 200 g raw breast at ratio 0.75).

## Products

- Name real products stocked at Coles or Woolworths and look them up on the live sites. Give exact product-page URLs, never search URLs; if there's no exact page, say so.
- Use label values where you can. Mark every price checked or estimate.
- Record products in `catalogue.js` `ITEMS` like the existing ones: item `id`, `sec`, `name`, `unit`, `note`, `same`, and per store `name`, `url`, `price`, `size`, `checked` date (Woolworths also `stockcode`, which matches the URL; Coles URLs end with the product id).
- Label facts worth knowing: Chobani Natural Light per 100 g 56 kcal, 9.3 g P, 4 g C, 0.2 g F; Woolworths Light Tasty Shredded Cheese per 100 g 337 kcal, 29.7 g P, 24.2 g F; SunRice microwave pouch 250 g, 209 kcal per half pouch; Ayam Light Coconut Milk 172 kcal per 100 mL (use ~70 mL topped up with water).

## Where things go

- The meal object (portions, prep, batch, extras, steps, note) in `apps/android/app/src/main/assets/weekday_fuel/meals.js` `MEALS`; batch recipes in `BATCHES`.
- Shopping amounts in `catalogue.js` `AMOUNTS[meal]`, keyed by item id; new products as `ITEMS`.
- Meal ids never change (saved days, picks and orders use them).

## Workflow

1. Evan asks in chat, loosely or specifically.
2. Any needed food not in the food decisions list gets a yes/no question first, one food per question.
3. Propose each meal: cuisine, prep label and hands-on minutes, batch components, protein core, the L/S/X table (kcal, P, C, F, cost), ingredients with both stores' product links (checked/estimate), method, the ingredient-reuse report, guideline misses, assumptions and values you couldn't verify.
4. Evan approves, tweaks or rejects each meal.
5. Add approved meals to `meals.js` and `catalogue.js`, run `node --test "apps/android/app/src/test/js/*.test.js"`, check the Meals and Shop tabs in a browser, commit to `main`, wait for green CI, bump the version in `apps/android/app/build.gradle.kts` and release.
6. Record food answers in the food decisions table.

Removing a meal: delete it from `MEALS` and `AMOUNTS` (the app ignores saved picks and day plans for unknown meals).
````

- [ ] **Step 2: Confirm removal is safe.** Check that the page skips unknown meal ids in day plans (`renderToday` returns `""` for a missing `MEAL[m.id]`, `trySaveOrder` filters `MEAL[...]`, `forLabel` falls back to the id) and `catalogue.shopList` skips unknown meals (`if (!serves || !per) return;`). Search the page for other `MEAL[` uses that would throw on a missing meal (e.g. `fitTiers` reading `MEAL[ms[j].id].t`, `totals`, `suggestDay`/`swapMeal`) and add a guard where one would throw. If any guard is added, include `Weekday_Fuel.html` in this commit and run the parse check and tests.

- [ ] **Step 3: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add .cursor/rules/meals.mdc README.md
git commit -m "meals: meal-planning rule for agent sessions"
git push
```

---

### Task 5: Release v0.9.0

**Files:**
- Modify: `apps/android/app/build.gradle.kts`, `docs/superpowers/specs/2026-10-18-meal-library-design.md` (status)

- [ ] **Step 1:** `versionCode = 15` → `16`, `versionName = "0.8.1"` → `"0.9.0"`.
- [ ] **Step 2:** Spec status → `**Status:** approved 2026-10-18; v0.9.0 released 2026-10-18, owner phone checks pending`.
- [ ] **Step 3:** Commit `release: v0.9.0`, push, watch CI, then `gh release view v0.9.0 -R Evzy/weekday-fuel-releases --json tagName,assets --jq '.tagName, .assets[].name'` → `v0.9.0`, `WeekdayFuel-v0.9.0-debug.apk`.
