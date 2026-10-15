# Suggest a day to the trolley (v0.4.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-15-suggest-day-trolley-design.md`](../specs/2026-10-15-suggest-day-trolley-design.md)

**Goal:** From Today the owner adds a whole planned day, or some of its meals, to the shop; Shop combines those days with Build a shop picks, labels every item with the days and meals it is for, and the Woolworths trolley send asks which pantry items are already at home every time, keeps the trolley in step when the plan changes (Send again, removing what is no longer needed), and Start next shop clears it all.

**Architecture:** `catalogue.js` `shopList` takes a third argument `dayMeals` and returns `days` per row. `cart.js` gains `haveIt` in `cartLines`, plus `removalLines`, `shopFingerprint` and `sentAfter`. `trolley.js` treats an accepted quantity-0 line as `removed`, and the Kotlin host now passes quantity-0 lines through. `Weekday_Fuel.html` stores `settings.shopDays`, a per-meal `shop: false` flag and a new `weekdayfuel.v1.sent` record, and adds the Today buttons, the Days panel, the "For …" labels, the pantry check, the out-of-date state and Start next shop.

**Tech Stack:** Plain JS (ES5-style IIFEs in `catalogue.js` / `cart.js` / `trolley.js`, Node `node:test`), one-file HTML app, Kotlin + Android WebView, `org.json`, GitHub Actions CI.

## Global Constraints

- Several days sent one after another are combined: the shop remembers its days and works out packs on the combined need (one 500 g cheese pack can cover Monday and Tuesday).
- An added day goes into the same Shop list as Build a shop picks: one list, one total per store, one trolley send.
- Every item row says which days and meals it is for, e.g. "For Mon 19, Tue 20 · Loaded ham & cheese toasty, Buffalo chicken mac", in Build a shop and in the trolley panel.
- Pantry check: every send lists the shop's pantry and freezer items (section 2) not already ticked, with days and meals. Each starts as "buy"; the owner ticks "I have it". Answers apply to that send only.
- Adding a day never adds Dare or Grenade; "Dare + Grenade for how many days" stays the only source.
- The shop follows the day: a swapped meal replaces the old one in the list. If the trolley was already sent and the plan changed, the trolley panel shows "Trolley out of date: your shop changed since you sent it at 1:40 pm" with **Send again**.
- Send again sets the trolley to the new combined quantities and sets to 0 any product sent last time that the shop no longer needs at all. Products ticked on the Shop list or answered "I have it" are never removed.
- **Start next shop** (with a confirm tap) clears `shopDays`, meal picks, ticks and `weekdayfuel.v1.sent`. Day plans are not touched.
- Shop quantities use each meal's Standard amounts whatever portion the day uses.
- Saved data: `settings.shopDays` `{ "2026-10-19": true }` (missing = empty shop); day meal entries may carry `shop: false` (missing = in; `swapMeal` keeps it); new key `weekdayfuel.v1.sent` `{ at: ISO time, fingerprint: string, lines: { [stockcode]: quantity } }` (missing = never sent).
- Store names shown to the owner: "Coles" and "Woolworths". Internal keys: `coles`, `woolies`. The trolley stays Woolworths-only.
- Woolworths pages never get a JavaScript bridge. Only origin `https://appassets.androidplatform.net` may message the host. Nothing in CI talks to the real Coles or Woolworths sites.
- Commit straight to `main` with the prefix `suggest-day:`; the release commit is `release: v0.4.0`. CI green before the next task. There is no local Android SDK: Kotlin is compiled and tested only by CI.
- Bump the version only in Task 6. Do not touch `platra/`, the keystore, `local.properties`, `docs/seed/`, or the untracked `.superpowers/` files.

## Facts (recorded by the controller, 2026-10-15, logged in, desktop browser)

- Soy sauce 198763 was not in the owner's trolley. `POST /api/v3/ui/trolley/update` with `quantity: 1` returned 200 with `UpdatedItems: [{ Stockcode: 198763, Quantity: 1, QuantityInTrolley: 1, IsAvailable: true }]`, and `/api/ui/v2/bootstrap` `TrolleyRequest.AvailableItems` then listed it.
- The same request with `quantity: 0` returned **200 with `UpdatedItems: []`** (same top-level keys: `Message, UpdatedItems, DeliveryFee, PotentialOrderPromotions, Totals, TotalTrolleyItemQuantity, TotalWowDeliveryTrolleyItemQuantity, TrolleyItemCount`). Afterwards the product was gone from `TrolleyRequest`.
- Sending `quantity: 0` again for the product now not in the trolley: also 200 with `UpdatedItems: []`.
- So a removal looks exactly like an unknown stockcode in the response. A quantity-0 line counts as removed when the response is HTTP 2xx.
- The owner's trolley was left as it was before the check.

## File map

| File | Change |
| --- | --- |
| `docs/woolworths-requests.md` | Record the removal response |
| `apps/android/app/src/main/assets/woolworths/trolley.js` | Quantity 0 line → outcome `removed` |
| `apps/android/app/src/test/js/trolley.test.js` | Removal tests |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt` | Keep quantity 0 lines; `removed` counts as done |
| `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt` | Tests |
| `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` | `shopList(picks, fixtureDays, dayMeals)`, rows gain `days`, `used` unique |
| `apps/android/app/src/test/js/catalogue.test.js` | Tests |
| `apps/android/app/src/main/assets/weekday_fuel/cart.js` | `cartLines(rows, ticks, haveIt)`, `removalLines`, `shopFingerprint`, `sentAfter` |
| `apps/android/app/src/test/js/cart.test.js` | Tests |
| `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` | Task 4: days in the shop, labels, Start next shop. Task 5: pantry check, Send again, sent record |
| `apps/android/app/build.gradle.kts`, spec status | Task 6 only |

How to run the JS tests (all of them, as CI does): `node --test "apps/android/app/src/test/js/*.test.js"`. From PowerShell keep the quotes.

---

### Task 1: Trolley removals (script and host)

**Files:**
- Modify: `docs/woolworths-requests.md` (table "Set trolley quantity request")
- Modify: `apps/android/app/src/main/assets/woolworths/trolley.js` (`setQuantity`)
- Modify: `apps/android/app/src/test/js/trolley.test.js` (append tests)
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt` (`parseLines`, `parseScriptState`)
- Modify: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt`

**Interfaces:**
- Produces: `trolley.js` result outcome `"removed"` for a quantity-0 line answered with HTTP 2xx (`{ stockcode, outcome: "removed" }`); a failed removal stays `{ stockcode, outcome: "failed", reason }`.
- Produces: the host keeps quantity-0 lines (`TrolleyJson.parseLines` drops only negative quantities) and reports a `removed` outcome as `"added": true` in `trolleyDone` results. The page tells a removal from an add by the line it sent having `quantity: 0`.

- [ ] **Step 1: Write the failing JS tests** — append to `apps/android/app/src/test/js/trolley.test.js`:

```js
test("a quantity 0 line that Woolworths accepts counts as removed", async () => {
  const { api, calls } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : response(200, { UpdatedItems: [] })));
  api.start([{ stockcode: 198763, quantity: 0 }, { stockcode: 717518, quantity: 2 }]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(JSON.parse(calls[1].init.body).items[0].quantity, 0);
  assert.deepEqual(s.results, [{ stockcode: 198763, outcome: "removed" }, { stockcode: 717518, outcome: "failed", reason: "not available" }]);
});

test("a removal Woolworths rejects is reported as failed", async () => {
  const { api } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : response(500, {})));
  api.start([{ stockcode: 198763, quantity: 0 }]);
  const s = await settle(api);
  assert.deepEqual(s.results, [{ stockcode: 198763, outcome: "failed", reason: "HTTP 500" }]);
});
```

- [ ] **Step 2: Run them to see the first fail**

Run: `node --test apps/android/app/src/test/js/trolley.test.js`
Expected: the "counts as removed" test FAILS (outcome is `failed` / `not available`); the rejected-removal test passes already.

- [ ] **Step 3: Implement** — in `trolley.js` `setQuantity`, replace

```js
      if (!r.ok) return { stockcode: line.stockcode, outcome: "failed", reason: "HTTP " + r.status };
      if (wasUpdated(await r.json(), line.stockcode)) return { stockcode: line.stockcode, outcome: "added" };
```

with

```js
      if (!r.ok) return { stockcode: line.stockcode, outcome: "failed", reason: "HTTP " + r.status };
      /* Woolworths answers a removal with an empty UpdatedItems, exactly like an unknown stockcode. */
      if (line.quantity === 0) return { stockcode: line.stockcode, outcome: "removed" };
      if (wasUpdated(await r.json(), line.stockcode)) return { stockcode: line.stockcode, outcome: "added" };
```

- [ ] **Step 4: Run all JS tests**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: all pass (38 tests).

- [ ] **Step 5: Kotlin tests** — in `TrolleyJsonTest.kt` replace the test `parseLinesKeepsPositiveQuantities` with:

```kotlin
    @Test
    fun parseLinesKeepsZeroForRemovalsAndDropsNegatives() {
        val lines =
            TrolleyJson.parseLines(
                JSONArray("""[{"stockcode":717518,"quantity":2,"name":"Chobani"},{"stockcode":198763,"quantity":0},{"stockcode":1,"quantity":-1}]"""),
            )
        assertEquals(listOf(TrolleyLine(717518L, 2.0), TrolleyLine(198763L, 0.0)), lines)
    }

    @Test
    fun removedLineCountsAsDone() {
        val raw = """{"phase":"done","total":1,"completed":1,"results":[{"stockcode":198763,"outcome":"removed"}],"error":null}"""
        val state = TrolleyJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(listOf(TrolleyLineResult(198763L, true, null)), state.results)
    }
```

and in `linesToJsonRoundTrips` change the list to `listOf(TrolleyLine(717518L, 2.0), TrolleyLine(72280L, 5.0), TrolleyLine(175734L, 0.3), TrolleyLine(198763L, 0.0))`.

- [ ] **Step 6: Kotlin implementation** — in `TrolleyModels.kt`:

`parseLines`: change `.filter { it.quantity > 0 }` to `.filter { it.quantity >= 0 }`.

`parseScriptState`: change

```kotlin
                    TrolleyLineResult(r.getLong("stockcode"), r.optString("outcome") == "added", r.stringOrNull("reason"))
```

to

```kotlin
                    TrolleyLineResult(r.getLong("stockcode"), r.optString("outcome").let { it == "added" || it == "removed" }, r.stringOrNull("reason"))
```

(`TrolleyLineResult.added` now means "the trolley change went through"; `HostMessages.finished` is unchanged.)

- [ ] **Step 7: Record the facts** — in `docs/woolworths-requests.md`, in the "Set trolley quantity request" table, replace the row `| Quantity 0 removes the product? | Yes |` with:

```markdown
| Quantity 0 removes the product? | Yes. Checked again 2026-10-15 logged in with soy sauce 198763 (not in the trolley): set to 1, then 0; `TrolleyRequest` in `/api/ui/v2/bootstrap` listed it after the 1 and not after the 0. The owner's trolley was left as before. |
| Response for a removal (quantity 0) | `200` with `UpdatedItems: []`, the same as an unknown stockcode. Sending 0 again for a product no longer in the trolley gives the same answer. `trolley.js` counts a quantity-0 line answered with 2xx as `removed`. |
```

- [ ] **Step 8: Commit and push, watch CI**

```bash
git add apps/android/app/src/main/assets/woolworths/trolley.js apps/android/app/src/test/js/trolley.test.js apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt docs/woolworths-requests.md
git commit -m "suggest-day: trolley sends quantity 0 to remove a product"
git push
```

Then (PowerShell): `Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status`
Expected: CI green (Kotlin unit tests included).

---

### Task 2: Shop list from planned days

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` (`shopList` inside `create`)
- Modify: `apps/android/app/src/test/js/catalogue.test.js` (append tests)

**Interfaces:**
- Produces: `shopList(picks: {[mealId]: serves}, fixtureDays: number, dayMeals?: [{ day: "YYYY-MM-DD", meal: mealId }]) → rows`. Each day meal counts as one Standard serve. Need is summed over picks and day meals before packs are rounded. Each row gains `days: string[]` (sorted unique ISO dates of the day meals that use it; `[]` otherwise). `used` becomes unique meal ids, picks first, then day meals in the order given. Unknown meal ids add nothing. Fixture rows have `used: []`, `days: []`.

- [ ] **Step 1: Write the failing tests** — append to `apps/android/app/src/test/js/catalogue.test.js`:

```js
test("planned days combine with picks and with each other before packs are rounded", () => {
  const rows = cat.shopList({ tenderwrap: 1 }, 0, [
    { day: "2026-10-20", meal: "buffalomac" },
    { day: "2026-10-19", meal: "toasty" },
    { day: "2026-10-20", meal: "toasty" },
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.need]), [["breast", 380], ["ham", 200], ["cheese", 130], ["evap", 80]]);
  const r = byId(rows);
  assert.equal(r.cheese.woolies.quantity, 1);
  assert.deepEqual(r.cheese.days, ["2026-10-19", "2026-10-20"]);
  assert.deepEqual(r.cheese.used, ["tenderwrap", "buffalomac", "toasty"]);
  assert.deepEqual([r.ham.days, r.ham.used, r.ham.woolies.quantity], [["2026-10-19", "2026-10-20"], ["toasty"], 0.2]);
  assert.deepEqual(r.breast.days, ["2026-10-20"]);
});

test("the same meal on two days is one meal in used and one pack when it fits", () => {
  const [ham, cheese] = cat.shopList({}, 0, [{ day: "2026-10-19", meal: "toasty" }, { day: "2026-10-20", meal: "toasty" }]);
  assert.deepEqual([cheese.id, cheese.need, cheese.woolies.quantity, cheese.used], ["cheese", 60, 1, ["toasty"]]);
  assert.deepEqual([ham.id, ham.days], ["ham", ["2026-10-19", "2026-10-20"]]);
});

test("no planned days leaves the list as it was, with empty days", () => {
  const before = cat.shopList({ toasty: 2, tenderwrap: 2 }, 3);
  assert.deepEqual(cat.shopList({ toasty: 2, tenderwrap: 2 }, 3, []), before);
  assert.ok(before.every((r) => Array.isArray(r.days) && r.days.length === 0));
  assert.deepEqual(byId(before).dare.used, []);
});

test("an unknown meal in a planned day adds nothing", () => {
  assert.deepEqual(cat.shopList({}, 0, [{ day: "2026-10-19", meal: "nope" }]), []);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test apps/android/app/src/test/js/catalogue.test.js`
Expected: the first two FAIL (no `days`, need ignores day meals); the third fails on `r.days` being undefined; the fourth passes.

- [ ] **Step 3: Implement** — in `catalogue.js` replace the whole `shopList` function with:

```js
    function shopList(picks, fixtureDays, dayMeals) {
      var need = {};
      var used = {};
      var days = {};
      function addMeal(meal, serves, day) {
        var per = amounts[meal];
        if (!serves || !per) return;
        Object.keys(per).forEach(function (id) {
          need[id] = (need[id] || 0) + per[id] * serves;
          var u = (used[id] = used[id] || []);
          if (u.indexOf(meal) < 0) u.push(meal);
          if (day) (days[id] = days[id] || {})[day] = true;
        });
      }
      Object.keys(picks).forEach(function (meal) {
        addMeal(meal, picks[meal], null);
      });
      (dayMeals || []).forEach(function (dm) {
        addMeal(dm.meal, 1, dm.day);
      });
      if (fixtureDays > 0) {
        items.forEach(function (it) {
          if (it.sec === 0) need[it.id] = fixtureDays;
        });
      }
      return items
        .filter(function (it) {
          return need[it.id] > 0;
        })
        .map(function (it) {
          var n = need[it.id];
          return {
            id: it.id,
            sec: it.sec,
            name: it.name,
            unit: it.unit,
            need: n,
            used: used[it.id] || [],
            days: Object.keys(days[it.id] || {}).sort(),
            coles: it.coles ? storeLine(it, it.coles, n) : null,
            woolies: it.woolies ? storeLine(it, it.woolies, n) : null,
            wooliesUnavailable: it.wooliesUnavailable || null,
          };
        });
    }
```

- [ ] **Step 4: Run all JS tests**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: all pass (42 tests).

- [ ] **Step 5: Commit and push, watch CI**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/catalogue.js apps/android/app/src/test/js/catalogue.test.js
git commit -m "suggest-day: shop list combines planned days with picks and labels each row's days"
git push
```

Watch CI as in Task 1. Expected: green.

---

### Task 3: Trolley maths (pantry answers, removals, out of date, last send)

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/cart.js`
- Modify: `apps/android/app/src/test/js/cart.test.js` (change the `require` line, append tests)

**Interfaces:**
- Consumes: rows from Task 2 (`id`, `woolies: {product: {stockcode, ...}, quantity} | null`, `wooliesUnavailable: {stockcode, ...} | null`, `coles`).
- Produces (all on `WeekdayFuelCart` / `module.exports`):
  - `cartLines(rows, ticks, haveIt?) → { lines, manual }`: as before, and also skips rows whose id is truthy in `haveIt` (an object map `{ [itemId]: true }`, like `ticks`) — neither a line nor a manual entry.
  - `removalLines(lastLines: {[stockcode]: quantity} | null, rows) → [{ stockcode: number, quantity: 0 }]`: one per stockcode in `lastLines` that no row has as its Woolworths product (`row.woolies.product.stockcode`) or unavailable product (`row.wooliesUnavailable.stockcode`). Rows count whether ticked or not. Order: `Object.keys` order of `lastLines`.
  - `shopFingerprint(picks, dayMeals, fixtureDays) → string`: equal for the same plan regardless of key or list order; ignores picks with 0 serves; changes when serves, day meals or fixture days change.
  - `sentAfter(lastLines | null, lines: [{stockcode, quantity}], results: [{stockcode, added: boolean}]) → {[stockcode]: quantity}`: what the trolley now holds from our sends. Start from `lastLines`; for each line whose result has `added: true`, quantity 0 deletes the stockcode, otherwise sets it to the line's quantity. Failed lines leave the old value (or absence) alone.

- [ ] **Step 1: Write the failing tests** — in `cart.test.js` change line 3 to

```js
const { cartLines, removalLines, shopFingerprint, sentAfter } = require("../../main/assets/weekday_fuel/cart.js");
```

and append:

```js
test("items answered 'I have it' are left out of the trolley and the do-it-yourself list", () => {
  const rows = [row("yog", { product: YOG, quantity: 2 }), row("breast", null, { product: COLES_BREAST, quantity: 1 }), row("ham", { product: HAM, quantity: 0.2 })];
  const { lines, manual } = cartLines(rows, {}, { yog: true, breast: true });
  assert.deepEqual(lines.map((l) => l.stockcode), [175734]);
  assert.deepEqual(manual, []);
});

test("removalLines sets to 0 only products the shop no longer needs", () => {
  const rows = [row("yog", { product: YOG, quantity: 1 })];
  assert.deepEqual(removalLines({ 717518: 2, 72280: 5, 175734: 0.3 }, rows), [
    { stockcode: 72280, quantity: 0 },
    { stockcode: 175734, quantity: 0 },
  ]);
});

test("removalLines never removes an item still on the list, even unavailable online", () => {
  const unavailable = { ...row("cheese", null), wooliesUnavailable: { name: "Woolworths Light Tasty 500g", stockcode: 729008 } };
  assert.deepEqual(removalLines({ 717518: 2, 729008: 1 }, [row("yog", { product: YOG, quantity: 2 }), unavailable]), []);
  assert.deepEqual(removalLines(null, [row("yog", { product: YOG, quantity: 2 })]), []);
});

test("shopFingerprint follows the plan, not key order", () => {
  const days = [{ day: "2026-10-19", meal: "toasty" }, { day: "2026-10-20", meal: "buffalomac" }];
  const a = shopFingerprint({ toasty: 2, tenderwrap: 1 }, days, 5);
  assert.equal(shopFingerprint({ tenderwrap: 1, toasty: 2, eggmuffin: 0 }, [days[1], days[0]], 5), a);
  assert.notEqual(shopFingerprint({ toasty: 3, tenderwrap: 1 }, days, 5), a);
  assert.notEqual(shopFingerprint({ toasty: 2, tenderwrap: 1 }, [days[0]], 5), a);
  assert.notEqual(shopFingerprint({ toasty: 2, tenderwrap: 1 }, [days[0], { day: "2026-10-20", meal: "schnitzel" }], 5), a);
  assert.notEqual(shopFingerprint({ toasty: 2, tenderwrap: 1 }, days, 4), a);
  assert.equal(typeof a, "string");
});

test("sentAfter records what our sends left in the trolley", () => {
  const last = { 717518: 2, 72280: 5, 175734: 0.3, 729008: 1 };
  const lines = [
    { stockcode: 717518, quantity: 3 },
    { stockcode: 46795, quantity: 1 },
    { stockcode: 72280, quantity: 0 },
    { stockcode: 175734, quantity: 0 },
    { stockcode: 524322, quantity: 1 },
  ];
  const results = [
    { stockcode: 717518, added: true },
    { stockcode: 46795, added: true },
    { stockcode: 72280, added: true },
    { stockcode: 175734, added: false, reason: "HTTP 500" },
    { stockcode: 524322, added: false, reason: "not available" },
  ];
  assert.deepEqual(sentAfter(last, lines, results), { 717518: 3, 46795: 1, 175734: 0.3, 729008: 1 });
  assert.deepEqual(sentAfter(null, [{ stockcode: 46795, quantity: 1 }], [{ stockcode: 46795, added: true }]), { 46795: 1 });
  assert.deepEqual(last, { 717518: 2, 72280: 5, 175734: 0.3, 729008: 1 });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test apps/android/app/src/test/js/cart.test.js`
Expected: the new tests FAIL (`removalLines is not a function` etc.; the `haveIt` test fails because `yog` is still sent).

- [ ] **Step 3: Implement** — replace the body of `cart.js` from `function cartLines(rows, ticks) {` to `var api = { cartLines: cartLines };` (inclusive) with:

```js
  function cartLines(rows, ticks, haveIt) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id] || (haveIt && haveIt[row.id])) return;
      var line = row.woolies;
      if (!line) {
        if (row.wooliesUnavailable) manual.push({ itemId: row.id, name: row.wooliesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.coles ? row.coles.product.name : row.name, reason: row.coles ? "coles" : "nostore" });
        return;
      }
      var p = line.product;
      var quantity = Math.round(line.quantity * 1000) / 1000;
      lines.push({
        itemId: row.id,
        stockcode: p.stockcode,
        quantity: quantity,
        name: p.perKg ? p.name + " (" + Math.round(quantity * 1000) + "g)" : p.name,
        url: p.url,
      });
    });
    return { lines: lines, manual: manual };
  }

  function removalLines(lastLines, rows) {
    var keep = {};
    rows.forEach(function (row) {
      if (row.woolies) keep[row.woolies.product.stockcode] = true;
      if (row.wooliesUnavailable) keep[row.wooliesUnavailable.stockcode] = true;
    });
    return Object.keys(lastLines || {})
      .filter(function (code) {
        return !keep[code];
      })
      .map(function (code) {
        return { stockcode: Number(code), quantity: 0 };
      });
  }

  function shopFingerprint(picks, dayMeals, fixtureDays) {
    var p = Object.keys(picks || {})
      .filter(function (meal) {
        return picks[meal] > 0;
      })
      .sort()
      .map(function (meal) {
        return meal + "x" + picks[meal];
      });
    var d = (dayMeals || [])
      .map(function (dm) {
        return dm.day + ":" + dm.meal;
      })
      .sort();
    return JSON.stringify({ picks: p, days: d, fixtureDays: fixtureDays || 0 });
  }

  function sentAfter(lastLines, lines, results) {
    var out = Object.assign({}, lastLines || {});
    var done = {};
    (results || []).forEach(function (r) {
      if (r.added) done[r.stockcode] = true;
    });
    lines.forEach(function (l) {
      if (!done[l.stockcode]) return;
      if (l.quantity === 0) delete out[l.stockcode];
      else out[l.stockcode] = l.quantity;
    });
    return out;
  }

  var api = { cartLines: cartLines, removalLines: removalLines, shopFingerprint: shopFingerprint, sentAfter: sentAfter };
```

- [ ] **Step 4: Run all JS tests**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: all pass (47 tests).

- [ ] **Step 5: Commit and push, watch CI**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/cart.js apps/android/app/src/test/js/cart.test.js
git commit -m "suggest-day: pantry answers, removals, plan fingerprint and last-send record"
git push
```

Watch CI as in Task 1. Expected: green.

---

### Task 4: Days in the shop (Today, Shop list, labels, Start next shop)

All edits are in `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`. Each step gives the exact text to find and its replacement. Keep the file's one-line style.

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: `CAT.shopList(picks, fixtureDays, dayMeals)` and row `days` / `used` (Task 2).
- Produces (page-level, used by Task 5): `shopDays()`, `dayMeals()`, `shopRows()`, `forLabel(row)`, `forLine(row)`, `nextShopBtn()`, `SENT`, `lsSent()`, `lsSetSent(record|null)`, the `nextshop` action (two taps), `settings.shopDays`, meal `shop: false`.

- [ ] **Step 1: CSS for the In shop toggle** — find

```css
.ghost.warn{color:var(--bad);border-color:var(--bad)}
```

replace with

```css
.ghost.warn{color:var(--bad);border-color:var(--bad)}
.ghost[aria-pressed="true"]{color:var(--good);border-color:var(--good)}
```

- [ ] **Step 2: Default setting** — in `DEFAULT_SETTINGS` find `  trial:{},` and replace with

```js
  trial:{},
  shopDays:{},
```

- [ ] **Step 3: Shop helpers** — find

```js
const fxDays=()=>S().fixtureDays==null?5:S().fixtureDays;
```

replace with

```js
const fxDays=()=>S().fixtureDays==null?5:S().fixtureDays;
/* Planned days in the shop: settings.shopDays {date:true}; a day's meal with shop:false is left out */
const shopDays=()=>{const sd=S().shopDays||{};return Object.keys(sd).filter(d=>sd[d]).sort()};
function dayMeals(){return shopDays().flatMap(d=>((state.days[d]&&state.days[d].meals)||[]).filter(m=>m.shop!==false).map(m=>({day:d,meal:m.id})))}
function shopRows(){return CAT.shopList(picks(),fxDays(),dayMeals())}
const dayShort=d=>parse(d).toLocaleDateString("en-AU",{weekday:"short",day:"numeric"});
function forLabel(r){if(!r||!r.used||!r.used.length)return "";return "For "+(r.days&&r.days.length?r.days.map(dayShort).join(", ")+" · ":"")+r.used.map(m=>MEAL[m]?MEAL[m].name:m).join(", ")}
const forLine=r=>{const t=forLabel(r);return t?`<span class="small muted" style="display:block">${esc(t)}</span>`:""};
const nextShopBtn=()=>`<button class="ghost ${state.armed==="nextshop"?"warn":""}" data-act="nextshop">${state.armed==="nextshop"?"Tap again to clear days, meals and ticks":"Start next shop"}</button>`;
```

- [ ] **Step 4: Last-send storage** — find

```js
function lsSetTicks(t){try{localStorage.setItem(LS+".shop",JSON.stringify(t))}catch(e){}}
```

replace with

```js
function lsSetTicks(t){try{localStorage.setItem(LS+".shop",JSON.stringify(t))}catch(e){}}
/* Last trolley send: {at, fingerprint, lines: {stockcode: quantity now in the trolley}} */
const SENT=LS+".sent";
function lsSent(){try{const s=JSON.parse(localStorage.getItem(SENT)||"null");return s&&typeof s.fingerprint==="string"&&s.lines&&typeof s.lines==="object"?s:null}catch(e){return null}}
function lsSetSent(s){try{s?localStorage.setItem(SENT,JSON.stringify(s)):localStorage.removeItem(SENT)}catch(e){}}
```

- [ ] **Step 5: Swap keeps the In shop flag** — in `swapMeal` find

```js
  day.meals[idx]={id:n.id,slot:m.slot,t:m.t};saveDay(date);
```

replace with

```js
  day.meals[idx]=Object.assign({},m,{id:n.id});saveDay(date);
```

- [ ] **Step 6: Today — Add day to shop** — in `renderToday` find the line that starts

```js
  h+=`<div class="panel"><div class="row between" style="margin-bottom:8px"><h2>Meals</h2>
```

and insert **after** that whole line:

```js
  const inShop=!!(S().shopDays&&S().shopDays[date]);
  if((day.meals&&day.meals.length)||inShop)h+=`<div class="row between" style="margin-bottom:8px">${inShop?`<span class="small"><b>In this shop.</b> Tap a meal's In shop to leave it out.</span><button class="ghost" data-act="shopday">Remove from shop</button>`:`<span class="small muted">Buy this day's meals with your next shop.</span><button class="btn alt" data-act="shopday">Add day to shop</button>`}</div>`;
```

- [ ] **Step 7: Today — per-meal In shop toggle** — in `renderToday` find

```js
<button class="ghost" data-act="swap" data-i="${i}">Swap</button>
```

replace with

```js
<button class="ghost" data-act="swap" data-i="${i}">Swap</button>${inShop?`<button class="ghost" aria-pressed="${m.shop!==false}" data-act="mealshop" data-i="${i}">${m.shop!==false?"In shop":"Not in shop"}</button>`:""}
```

- [ ] **Step 8: Shop — Days panel and combined list** — in `renderShop`, inside `if(build){`, find

```js
    const pk=picks();const nMeals=Object.values(pk).reduce((a,b)=>a+(b||0),0);
```

replace with

```js
    const pk=picks();const nMeals=Object.values(pk).reduce((a,b)=>a+(b||0),0);
    const sdays=shopDays(),dm=dayMeals();
    if(sdays.length)h+=`<div class="panel stack"><h3>Days in this shop</h3>${sdays.map(d=>{const ms=((state.days[d]&&state.days[d].meals)||[]).filter(m=>m.shop!==false&&MEAL[m.id]);return `<div class="row between"><button class="pname" data-act="openday" data-v="${d}"><b>${fmtDay(d)}</b><span class="small muted">${ms.length?ms.map(m=>esc(MEAL[m.id].name)).join(", "):"no meals planned"}</span></button><button class="ghost" data-act="unshopday" data-v="${d}">Remove</button></div>`}).join("")}</div>`;
    else h+=`<div class="small muted">Planning days on Today? Tap <b>Add day to shop</b> there and that day's meals join this list.</div>`;
```

Then make these four replacements in the same function:

1. `if(!nMeals)h+=\`<div class="hint"><span>Not sure where to start?` → `if(!nMeals&&!dm.length)h+=\`<div class="hint"><span>Not sure where to start?` (only the condition changes).
2. `const st=store(),ot=other(st);const rows=CAT.shopList(pk,days);` → `const st=store(),ot=other(st);const rows=CAT.shopList(pk,days,dm);`
3. `if(!nMeals&&!rows.length){` → `if(!nMeals&&!dm.length&&!rows.length){`
4. `${nMeals} serve${nMeals===1?"":"s"} · ${rows.length} items.` → `${nMeals+dm.length} serve${nMeals+dm.length===1?"":"s"} · ${rows.length} items.`

- [ ] **Step 9: Shop — "For …" labels** — in `renderShop` find

```js
<span class="muted">· need ${esc(needLabel(r))}</span></span>`,{coles:
```

replace with

```js
<span class="muted">· need ${esc(needLabel(r))}</span></span>${forLine(r)}`,{coles:
```

and in the "Missed at" panel find

```js
${o?` <span class="muted">· ${esc(o.buy)}</span>`:""}</span>
```

replace with

```js
${o?` <span class="muted">· ${esc(o.buy)}</span>`:""}${forLine(r)}</span>
```

- [ ] **Step 10: Shop — Start next shop** — in `renderShop`, Build mode only, find

```js
    if(st==="woolies")h+=renderTrolley(rows,ticks);
    h+=`<div class="row"><button class="ghost" data-act="untickall">Clear ticks for next shop</button></div>`;
```

replace with

```js
    if(st==="woolies")h+=renderTrolley(rows,ticks);
    h+=`<div class="row"><button class="ghost" data-act="untickall">Clear ticks</button>${nextShopBtn()}</div>`;
```

(The Full list keeps its own "Clear ticks for next shop" button.)

- [ ] **Step 11: Events** — in the click handler find

```js
  if(act!=="rm"&&act!=="rmw")state.armed=null;
```

replace with

```js
  if(act!=="rm"&&act!=="rmw"&&act!=="nextshop")state.armed=null;
```

find

```js
    case "swap":swapMeal(date,i);break;
```

replace with

```js
    case "swap":swapMeal(date,i);break;
    case "shopday":{const sd=state.settings.shopDays=Object.assign({},S().shopDays);if(sd[date])delete sd[date];else{sd[date]=true;const d=ensureDay(date);(d.meals||[]).forEach(m=>delete m.shop);saveDay(date)}saveSettings();break}
    case "mealshop":{const d=ensureDay(date);const m=d.meals[i];if(m.shop===false)delete m.shop;else m.shop=false;saveDay(date);break}
    case "unshopday":{const sd=state.settings.shopDays=Object.assign({},S().shopDays);delete sd[v];saveSettings();break}
    case "openday":state.tab="today";state.date=v;state.adding=null;window.scrollTo(0,0);break;
    case "nextshop":if(state.armed!=="nextshop"){state.armed="nextshop";break}state.armed=null;state.settings.shopDays={};state.settings.trial={};saveSettings();lsSetTicks({});lsSetSent(null);state.trolley=null;break;
```

and in the `sendtrolley` case replace `CAT.shopList(picks(),fxDays())` with `shopRows()` (Task 5 rewrites this case; until then the trolley must match the list).

- [ ] **Step 12: Run the JS tests** (the page is not unit-tested; this guards the shared files)

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: all pass (47 tests).

- [ ] **Step 13: Commit and push, watch CI**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "suggest-day: add planned days to the shop, label items with their days and meals, Start next shop"
git push
```

Watch CI as in Task 1. Expected: green.

- [ ] **Step 14: Controller browser check (plain browser, no host)** — the controller does this, not the implementer.

Serve: `npx --yes http-server apps/android/app/src/main/assets -p 8123 -s -c-1` (background), open `http://localhost:8123/weekday_fuel/Weekday_Fuel.html`. Seed with Runtime.evaluate, then reload:

```js
localStorage.removeItem("weekdayfuel.v1.sent");localStorage.removeItem("weekdayfuel.v1.shop");
localStorage.setItem("weekdayfuel.v1",JSON.stringify({settings:{store:"woolies",shopMode:"build",trial:{},fixtureDays:0},weights:{},days:{
 "2026-10-19":{fx:{dare:true,grenade:true},extras:[],track:false,meals:[{id:"toasty",slot:"breakfast",t:"S"},{id:"tenderwrap",slot:"lunch",t:"S"},{id:"buffalomac",slot:"dinner",t:"L"}]},
 "2026-10-20":{fx:{dare:true,grenade:true},extras:[],track:false,meals:[{id:"toasty",slot:"breakfast",t:"S"},{id:"burritobowl",slot:"lunch",t:"S"},{id:"bolognese",slot:"dinner",t:"X"}]}}}));
```

Go to Monday 19 Oct (click `[data-act=shift][data-v="1"]` until the heading says Monday 19 October), tap **Add day to shop**; next day, tap **Add day to shop**. Check:
- Today shows "In this shop." and each meal has an **In shop** toggle.
- Shop (Build a shop) shows "Days in this shop" with both days and their meal names.
- The cheese row (Woolworths) says "Buy: 1 × 500g" (need 160g) and "For Mon 19, Tue 20 · Loaded ham & cheese toasty, …".
- Toggle Monday's chicken wrap to **Not in shop**: the wraps row disappears from Shop (burrito bowl and bolognese don't use wraps).
- **Swap** Tuesday's dinner on Today: the Shop list follows (bolognese-only items such as spaghetti go if the new meal doesn't use them).
- Dare/Grenade rows are absent (fixture days 0) — adding days didn't add fixtures.
- Tapping a day in the Days panel opens Today on that date.
- **Start next shop** → "Tap again to clear days, meals and ticks" → tap: Days panel and picks gone; Today's meals still planned.

---

### Task 5: Pantry check, Send again and the last-send record

All edits are in `Weekday_Fuel.html`.

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: Task 1 (quantity-0 lines reach the trolley; their results come back `added: true` on success), Task 3 (`cartLines(rows, ticks, haveIt)`, `removalLines`, `shopFingerprint`, `sentAfter`), Task 4 (`shopRows`, `dayMeals`, `forLabel`, `forLine`, `nextShopBtn`, `lsSent`, `lsSetSent`).
- Produces: trolley phases `null` (intro / out of date) → `pantry` → `adding`/`login` → `done` | `error`; `state.trolley = { phase, haveIt?, completed, total, lines, manual, fingerprint, results?, checkedOut? }`; on `trolleyDone` the page writes `weekdayfuel.v1.sent`.

- [ ] **Step 1: Send helpers** — find

```js
const MANUAL_WHY={coles:"Coles only",nostore:"no online store page",unavailable:"unavailable online now"};
```

replace with

```js
const MANUAL_WHY={coles:"Coles only",nostore:"no online store page",unavailable:"unavailable online now"};
function sentWhen(at){const t=new Date(at);if(isNaN(t))return "earlier";const tm=t.toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"});return iso(t)===iso(new Date())?tm:fmtShort(iso(t))+" "+tm}
function wooliesProduct(code){const it=WeekdayFuelCatalogue.ITEMS.find(i=>i.woolies&&i.woolies.stockcode===+code);return it?it.woolies:null}
const pantryRows=(rows,ticks)=>rows.filter(r=>r.sec===2&&!ticks[r.id]);
/* A send: what's left to buy minus "I have it", plus quantity 0 for products the last send put in that the shop no longer needs */
function trolleySend(rows,haveIt){
  const c=WeekdayFuelCart.cartLines(rows,lsTicks(),haveIt);const sent=lsSent();
  const rm=WeekdayFuelCart.removalLines(sent&&sent.lines,rows).map(l=>{const p=wooliesProduct(l.stockcode);return Object.assign({},l,{name:p?p.name:"Product "+l.stockcode,url:p?p.url:null})});
  return {lines:c.lines.concat(rm),manual:c.manual};
}
function sendTrolley(haveIt){
  const s=trolleySend(shopRows(),haveIt);if(!s.lines.length)return;
  state.trolley={phase:"adding",completed:0,total:s.lines.length,lines:s.lines,manual:s.manual,fingerprint:WeekdayFuelCart.shopFingerprint(picks(),dayMeals(),fxDays())};
  WeekdayFuelHost.postMessage(JSON.stringify({type:"sendTrolley",lines:s.lines}));
}
```

- [ ] **Step 2: Trolley panel** — replace the whole `function renderTrolley(rows,ticks){ … }` (from `function renderTrolley(rows,ticks){` to the closing `}` just before `function renderShop(){`) with:

```js
function renderTrolley(rows,ticks){
  if(!window.WeekdayFuelHost)return "";
  const t=state.trolley,sent=lsSent();
  let h=`<div class="panel stack"><h3>Woolworths trolley</h3>`;
  if(!t){
    const s=trolleySend(rows,{});const rms=s.lines.filter(l=>l.quantity===0).length,adds=s.lines.length-rms;
    if(sent&&sent.fingerprint!==WeekdayFuelCart.shopFingerprint(picks(),dayMeals(),fxDays()))h+=`<div class="hint"><span>Trolley out of date: your shop changed since you sent it at ${esc(sentWhen(sent.at))}.</span></div>`;
    else if(sent)h+=`<div class="small muted">Sent at ${esc(sentWhen(sent.at))}.</div>`;
    h+=`<div class="small muted">Puts the ${adds} Woolworths product${adds===1?"":"s"} still left to buy into your online trolley${rms?` and takes out ${rms} the shop no longer needs`:""}. Anything already there is set to these amounts, not doubled. First you tick off the pantry items you already have.</div>`;
    h+=`<div class="row"><button class="btn" data-act="pantrycheck" ${s.lines.length?"":"disabled"}>${sent?"Send again":"Send to Woolworths trolley"}</button></div>`;
  }else if(t.phase==="pantry"){
    const s=trolleySend(rows,t.haveIt);
    h+=`<div class="small"><b>Pantry check.</b> Tick anything you already have at home and it stays out of the trolley.</div>`;
    h+=pantryRows(rows,ticks).map(r=>{const l=r.woolies||r.coles;const name=r.woolies?r.woolies.product.name:r.name;return `<label class="si"><input type="checkbox" aria-label="I have ${esc(name)}" data-act="haveit" data-v="${r.id}" ${t.haveIt[r.id]?"checked":""}><span class="grow"><b>${esc(name)}</b><span class="small muted" style="display:block">I have it${l?` · otherwise buy ${esc(l.buy)}`:""}</span>${forLine(r)}</span></label>`}).join("");
    h+=`<div class="row"><button class="btn" data-act="sendtrolley" ${s.lines.length?"":"disabled"}>Send</button><button class="ghost" data-act="trolleyreset">Cancel</button></div>`;
  }else if(t.phase==="login"){
    h+=`<div class="small">Log in to Woolworths in the window that opened. Sending carries on by itself once you're in.</div>`;
  }else if(t.phase==="adding"){
    h+=`<div class="small num">Adding ${t.completed} of ${t.total}…</div>`;
  }else if(t.phase==="error"){
    h+=`<div class="small">${esc(t.message||"")}</div><div class="row"><button class="btn" data-act="pantrycheck">Try again</button><button class="ghost" data-act="trolleyreset">Close</button></div>`;
  }else{
    const byId=Object.fromEntries(rows.map(r=>[r.id,r]));
    const byCode=Object.fromEntries(t.lines.map(l=>[l.stockcode,l]));
    const isRm=r=>!!byCode[r.stockcode]&&byCode[r.stockcode].quantity===0;
    const adds=t.results.filter(r=>!isRm(r)),rms=t.results.filter(isRm);
    const added=adds.filter(r=>r.added),failed=adds.filter(r=>!r.added),removed=rms.filter(r=>r.added),stuck=rms.filter(r=>!r.added);
    const siteChanged=failed.every(r=>r.reason==="not available"||String(r.reason||"").startsWith("HTTP 4"));
    if(!added.length&&failed.length)h+=siteChanged?`<div class="hint"><span>Nothing could be added. Woolworths may have changed their website, so the automatic send is out of date. Open each product below to add it yourself.</span></div>`:`<div class="hint"><span>Nothing could be added. Check your connection, then tap Done and send again.</span></div>`;
    h+=`<div class="small"><b>Added ${added.length}</b> of ${adds.length}${rms.length?` · <b>removed ${removed.length}</b> of ${rms.length}`:""}.</div>`;
    const lineRow=(r,note)=>{const l=byCode[r.stockcode]||{name:String(r.stockcode)};const f=l.itemId?forLabel(byId[l.itemId]):"";return `<div class="row between"><span class="small grow">${esc(l.name)}${note?` <span class="muted">· ${esc(note)}</span>`:""}${f?`<span class="muted" style="display:block">${esc(f)}</span>`:""}</span>${!r.added&&l.url?`<button class="ghost" data-act="openwoolies" data-v="${esc(l.url)}">Open ↗</button>`:""}</div>`};
    if(added.length)h+=`<div class="eyebrow">In your trolley</div>${added.map(r=>lineRow(r,"")).join("")}`;
    if(removed.length)h+=`<div class="eyebrow">Taken out</div>${removed.map(r=>lineRow(r,"Removed (no longer needed)")).join("")}`;
    if(failed.length)h+=`<div class="eyebrow">Couldn't add</div>${failed.map(r=>lineRow(r,r.reason||"")).join("")}`;
    if(stuck.length)h+=`<div class="eyebrow">Couldn't take out, remove these yourself</div>${stuck.map(r=>lineRow(r,r.reason||"")).join("")}`;
    if(t.manual.length)h+=`<div class="eyebrow">Add these yourself</div>${t.manual.map(m=>`<div class="small">${esc(m.name)} <span class="muted">(${MANUAL_WHY[m.reason]||"add it yourself"})</span>${forLine(byId[m.itemId])}</div>`).join("")}`;
    h+=`<div class="row"><button class="btn" data-act="checkout">Checkout</button><button class="ghost" data-act="trolleyreset">Done</button></div>`;
    if(t.checkedOut)h+=`<div class="row between"><span class="small">Finished this shop?</span>${nextShopBtn()}</div>`;
  }
  return h+`</div>`;
}
```

- [ ] **Step 3: Events** — find the whole `case "sendtrolley":…` line (one line, starts `    case "sendtrolley":{const c=WeekdayFuelCart.cartLines(`) and replace it with:

```js
    case "pantrycheck":if(pantryRows(shopRows(),lsTicks()).length)state.trolley={phase:"pantry",haveIt:{}};else sendTrolley({});break;
    case "haveit":if(state.trolley&&state.trolley.phase==="pantry")state.trolley.haveIt[v]=el.checked;break;
    case "sendtrolley":sendTrolley(state.trolley&&state.trolley.haveIt||{});break;
```

find

```js
    case "checkout":WeekdayFuelHost.postMessage(JSON.stringify({type:"checkout"}));return;
```

replace with

```js
    case "checkout":if(state.trolley)state.trolley.checkedOut=true;WeekdayFuelHost.postMessage(JSON.stringify({type:"checkout"}));break;
```

- [ ] **Step 4: Record the send** — in the host message listener find

```js
    else if(m.type==="trolleyDone"){t.phase="done";t.results=Array.isArray(m.results)?m.results:[]}
```

replace with

```js
    else if(m.type==="trolleyDone"){t.phase="done";t.results=Array.isArray(m.results)?m.results:[];const old=lsSent();lsSetSent({at:new Date().toISOString(),fingerprint:t.fingerprint,lines:WeekdayFuelCart.sentAfter(old&&old.lines,t.lines,t.results)})}
```

- [ ] **Step 5: Run the JS tests**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: all pass (47 tests).

- [ ] **Step 6: Commit and push, watch CI**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "suggest-day: pantry check every send, Send again with removals, trolley out of date"
git push
```

Watch CI as in Task 1. Expected: green.

- [ ] **Step 7: Controller browser check with a stand-in host** — the controller does this.

Before loading the page, register a fake host with CDP `Page.addScriptToEvaluateOnNewDocument`, source:

```js
window.__posted=[];window.WeekdayFuelHost={postMessage:s=>window.__posted.push(JSON.parse(s)),addEventListener:(t,f)=>{window.__hostFn=f}};
```

(If that CDP method is denied: Runtime.evaluate `fetch(location.href).then(r=>r.text()).then(h=>{document.open();document.write(h.replace("<script src=\"catalogue.js\">","<script>window.__posted=[];window.WeekdayFuelHost={postMessage:s=>window.__posted.push(JSON.parse(s)),addEventListener:(t,f)=>{window.__hostFn=f}}<\/script><script src=\"catalogue.js\">"));document.close()})`.)

Seed as in Task 4 Step 14, add both days to the shop, open Shop (Woolworths). Then:
- Trolley panel says "Send to Woolworths trolley". Tap it: **Pantry check** lists section-2 items (e.g. macaroni, Frank's, taco mix) with "For …" labels, all unticked. Tick "I have it" on Frank's; tap **Send**. `__posted` last item is `sendTrolley` without Frank's stockcode 759137, with every other left-to-buy Woolworths line.
- Reply: `__hostFn({data:JSON.stringify({type:"trolleyDone",results:__posted.at(-1).lines.map(l=>({stockcode:l.stockcode,added:true,reason:null}))})})`. Results show "In your trolley" lines with "For …" labels. `localStorage["weekdayfuel.v1.sent"]` has `fingerprint` and `lines` with every sent stockcode and no 759137.
- Tap **Checkout**: "Finished this shop?" with **Start next shop** appears. Tap **Done**: the panel shows "Sent at <time>." and **Send again**.
- On Today swap Tuesday's dinner, back to Shop: "Trolley out of date: your shop changed since you sent it at <time>." Tap **Send again** → pantry check again (Frank's unticked again). Send: the posted lines include `quantity: 0` for products only the old meal needed (e.g. spaghetti 43974 if bolognese was swapped out), never for ticked items.
- Reply `trolleyDone` with all `added: true`: "Taken out" lists them as "Removed (no longer needed)"; the sent record no longer has those stockcodes.
- Tick an item on the Shop list: the panel does **not** say out of date.

Remove the fake host afterwards (`Page.removeScriptToEvaluateOnNewDocument` with the returned identifier, or close the tab) and stop the http-server.

---

### Task 6: Release v0.4.0

**Files:**
- Modify: `apps/android/app/build.gradle.kts` (`versionCode = 8`, `versionName = "0.4.0"`)
- Modify: `docs/superpowers/specs/2026-10-15-suggest-day-trolley-design.md` (status line)

- [ ] **Step 1: Bump the version** — in `build.gradle.kts` change `versionCode = 7` to `versionCode = 8` and `versionName = "0.3.1"` to `versionName = "0.4.0"`.

- [ ] **Step 2: Spec status** — change `**Status:** approved 2026-10-15` to `**Status:** approved 2026-10-15; v0.4.0 released 2026-10-15, owner phone checks pending`.

- [ ] **Step 3: Commit, push, watch CI, check the release**

```bash
git add apps/android/app/build.gradle.kts docs/superpowers/specs/2026-10-15-suggest-day-trolley-design.md
git commit -m "release: v0.4.0"
git push
```

Watch CI as in Task 1, then (PowerShell): `gh release view v0.4.0 -R Evzy/weekday-fuel-releases --json tagName,assets | ConvertFrom-Json | Select-Object tagName, @{n="assets";e={$_.assets.name}}`
Expected: tag `v0.4.0` with `WeekdayFuel-v0.4.0-debug.apk`.

- [ ] **Step 4: Owner phone checks** (the owner does these; record results in the ledger):
- Every send shows the pantry check; "I have it" items stay out of the trolley.
- Send two days that both use cheese: the Woolworths trolley has one 500g cheese pack.
- Swap a meal, **Send again**: the old meal's unneeded product is gone from the Woolworths trolley, and the results say "Removed (no longer needed)".
- Start next shop clears the Days panel and picks.

When they pass, change the spec status to `done (v0.4.0)`. A failure is fixed and released as v0.4.1.
