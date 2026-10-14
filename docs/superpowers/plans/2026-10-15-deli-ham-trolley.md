# Deli Ham Trolley Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-15-deli-ham-trolley-design.md`](../specs/2026-10-15-deli-ham-trolley-design.md)

**Goal:** "Send to Woolworths trolley" also sends the shaved deli ham, by weight in kilograms, instead of listing it under "Add these yourself".

**Architecture:** Build a shop rounds the ham up to the next 100 g with a pure `deliGrams` helper in `cart.js` and stores the weight in kilograms as the row's numeric `n`. `cartLines` turns that into a normal trolley line (stockcode 175734, quantity 0.3 for 300 g). The Android side carries quantities as `Double` so decimals survive; the in-page `trolley.js` already passes the quantity straight into Woolworths' set-quantity request.

**Tech Stack:** Kotlin 2.0.21, `org.json`, plain browser JS, Node built-in test runner (`node --test`), JUnit 4, GitHub Actions.

## Global Constraints

- `applicationId` stays `dev.weekdayfuel.app`; the signing key does not change.
- Woolworths pages never get a JavaScript bridge into the app. Only origin `https://appassets.androidplatform.net` may message the host.
- Saved `localStorage` data does not change shape (cart lines are computed per send, never stored).
- Ham weight: `max(100, ceil(needGrams / 100) * 100)` grams; sent as kilograms (`grams / 1000`); price $2.80 per 100 g.
- Nothing in CI talks to the real Woolworths site.
- Commit straight to `main`, message prefix `deli-ham:` (release commit: `release: v0.2.1`). After each push, CI must be green before starting the next task.
- There is no local Android SDK: Kotlin is verified by CI. JS tests run locally with Node 24 (`node --test`).
- Release (version bump) only in Task 3.
- Do not touch `platra/`, the keystore, `local.properties`, or `docs/seed/`.

### Watching CI after a push (PowerShell)

```powershell
git push
Start-Sleep 8
$id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'
gh run watch $id -R Evzy/weekday-fuel --exit-status
```

Expected: exits 0, all steps ✓. If it fails, read `gh run view $id -R Evzy/weekday-fuel --log-failed`, fix, push again.

## File Structure

| Path | Change |
| --- | --- |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt` | `TrolleyLine.quantity` becomes `Double` |
| `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt` | Decimal and whole-number quantity tests |
| `apps/android/app/src/test/js/trolley.test.js` | Decimal quantity reaches the request body |
| `apps/android/app/src/main/assets/weekday_fuel/cart.js` | `deliGrams`; ham becomes a trolley line |
| `apps/android/app/src/test/js/cart.test.js` | Ham tests |
| `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` | `buildList()` ham row, `SHOP` ham entry, `MANUAL_WHY` |
| `docs/woolworths-requests.md` | Deli section updated |
| `apps/android/app/build.gradle.kts` | Version 0.2.1 (Task 3) |

---

### Task 1: Decimal trolley quantities on Android

**Files:**
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt`
- Test: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt`
- Test: `apps/android/app/src/test/js/trolley.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `data class TrolleyLine(val stockcode: Long, val quantity: Double)`. `TrolleyJson.parseLines(JSONArray): List<TrolleyLine>` reads `quantity` with `getDouble` and drops lines with `quantity <= 0`. `TrolleyJson.linesToJson(List<TrolleyLine>): String` writes whole quantities as integers (`2`) and decimals as-is (`0.3`).

- [ ] **Step 1: Write the failing Kotlin tests**

In `TrolleyJsonTest.kt`, replace the two tests `parseLinesKeepsPositiveQuantities` and `linesToJsonRoundTrips` with:

```kotlin
    @Test
    fun parseLinesKeepsPositiveQuantities() {
        val lines =
            TrolleyJson.parseLines(
                JSONArray("""[{"stockcode":717518,"quantity":2,"name":"Chobani"},{"stockcode":72280,"quantity":0},{"stockcode":1,"quantity":-1}]"""),
            )
        assertEquals(listOf(TrolleyLine(717518L, 2.0)), lines)
    }

    @Test
    fun parseLinesKeepsDecimalWeights() {
        val lines = TrolleyJson.parseLines(JSONArray("""[{"stockcode":175734,"quantity":0.3}]"""))
        assertEquals(listOf(TrolleyLine(175734L, 0.3)), lines)
    }

    @Test
    fun linesToJsonRoundTrips() {
        val lines = listOf(TrolleyLine(717518L, 2.0), TrolleyLine(72280L, 5.0), TrolleyLine(175734L, 0.3))
        assertEquals(lines, TrolleyJson.parseLines(JSONArray(TrolleyJson.linesToJson(lines))))
    }

    @Test
    fun linesToJsonWritesWholeQuantitiesWithoutDecimals() {
        val json = TrolleyJson.linesToJson(listOf(TrolleyLine(717518L, 2.0), TrolleyLine(175734L, 0.3)))
        assertTrue(json, Regex(""""quantity":2[,}]""").containsMatchIn(json))
        assertTrue(json, json.contains(""""quantity":0.3"""))
        assertFalse(json, json.contains("2.0"))
    }
```

Add the imports `org.junit.Assert.assertFalse` and `org.junit.Assert.assertTrue`. (Key order inside a `JSONObject` is not guaranteed, so the test checks fragments, not the whole string.)

- [ ] **Step 2: Write the guard JS test**

`trolley.js` already passes `quantity` through; this test pins it. Append to `apps/android/app/src/test/js/trolley.test.js`:

```js
test("a weighed line is sent with its kilogram quantity unchanged", async () => {
  const { api, calls } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : accepted(init)));
  api.start([{ stockcode: 175734, quantity: 0.3 }]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(JSON.parse(calls[1].init.body).items[0].quantity, 0.3);
  assert.deepEqual(s.results, [{ stockcode: 175734, outcome: "added" }]);
});
```

Run: `node --test apps/android/app/src/test/js/`
Expected: all 15 tests pass (this new one included; it guards existing behaviour).

- [ ] **Step 3: Make quantities decimal**

In `TrolleyModels.kt`:

```kotlin
data class TrolleyLine(val stockcode: Long, val quantity: Double)
```

and in `TrolleyJson`:

```kotlin
    fun parseLines(lines: JSONArray): List<TrolleyLine> =
        (0 until lines.length())
            .map { i -> lines.getJSONObject(i).let { TrolleyLine(it.getLong("stockcode"), it.getDouble("quantity")) } }
            .filter { it.quantity > 0 }

    fun linesToJson(lines: List<TrolleyLine>): String =
        JSONArray().apply {
            lines.forEach {
                val quantity: Number = if (it.quantity % 1.0 == 0.0) it.quantity.toLong() else it.quantity
                put(JSONObject().put("stockcode", it.stockcode).put("quantity", quantity))
            }
        }.toString()
```

Writing whole numbers as `Long` keeps `2` (not `2.0`) on both Android's `org.json` and the JVM test dependency.

- [ ] **Step 4: Check nothing else uses `quantity` as an `Int`**

Run: `rg -n "quantity" apps/android/app/src/main/java`
Expected: only `TrolleyModels.kt`. If any other file treats `TrolleyLine.quantity` as `Int`, change it to `Double` in the same way.

- [ ] **Step 5: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt apps/android/app/src/test/js/trolley.test.js
git commit -m "deli-ham: carry trolley quantities as decimals"
```

Then the "Watching CI after a push" commands. Expected: green; `TrolleyJsonTest` runs 7 tests; "JS unit tests" ✓. No release.

---

### Task 2: Ham becomes a trolley line

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/cart.js`
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` (lines ~354, ~843, ~864)
- Test: `apps/android/app/src/test/js/cart.test.js`

**Interfaces:**
- Consumes: Task 1's decimal `TrolleyLine.quantity` (the host now keeps 0.3).
- Produces: `WeekdayFuelCart.deliGrams(needGrams: number): number`. `cartLines` emits ham as `{itemId: "ham", stockcode: 175734, quantity: <kg, 3 decimals>, name: "D'Orsogna Ham (deli, <g>g)", url}` and never puts ham in `manual`. Manual reasons are now only `"coles"` and `"nostore"`.

- [ ] **Step 1: Write the failing tests**

In `cart.test.js`, change the import line to:

```js
const { cartLines, stockcodeOf, deliGrams } = require("../../main/assets/weekday_fuel/cart.js");
```

Replace the last test ("deli ham, Coles-only and unlinked items go to the do-it-yourself list") with:

```js
test("Coles-only and unlinked items go to the do-it-yourself list", () => {
  const { lines, manual } = cartLines([row("breast", 1, "Chicken breast"), row("evap", 1, "Evaporated milk")], {}, LINKS);
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [
    { itemId: "breast", name: "Chicken breast", reason: "coles" },
    { itemId: "evap", name: "Evaporated milk", reason: "nostore" },
  ]);
});

test("deliGrams rounds up to the next 100 g, at least 100 g", () => {
  assert.equal(deliGrams(250), 300);
  assert.equal(deliGrams(60), 100);
  assert.equal(deliGrams(300), 300);
  assert.equal(deliGrams(0), 100);
});

test("deli ham is sent by weight in kilograms", () => {
  const { lines, manual } = cartLines([row("ham", 0.3, "D'Orsogna Ham Leg Triple Smoked 97% Fat Free (deli)")], {}, LINKS);
  assert.deepEqual(lines, [{ itemId: "ham", stockcode: 175734, quantity: 0.3, name: "D'Orsogna Ham (deli, 300g)", url: LINKS.ham[0][1] }]);
  assert.deepEqual(manual, []);
});

test("ham weight has floating-point noise removed", () => {
  const { lines } = cartLines([row("ham", 0.30000000000000004, "Ham")], {}, LINKS);
  assert.equal(lines[0].quantity, 0.3);
  assert.equal(lines[0].name, "D'Orsogna Ham (deli, 300g)");
});

test("ticked ham is left out", () => {
  const { lines, manual } = cartLines([row("ham", 0.3, "Ham")], { ham: true }, LINKS);
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/android/app/src/test/js/`
Expected: FAIL — `deliGrams is not a function`, and the ham test gets ham in `manual` with reason `"deli"`.

- [ ] **Step 3: Implement in `cart.js`**

Replace the whole file with:

```js
/* Turns Build a shop rows into Woolworths trolley lines. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var PRODUCT = /^https:\/\/www\.woolworths\.com\.au\/shop\/productdetails\/(\d+)/;
  var PASTA_LABEL_FOR_MEAL = { bolognese: "Spaghetti", buffalomac: "Macaroni" };
  var DELI_NAME = { ham: "D'Orsogna Ham" };

  function stockcodeOf(url) {
    var m = PRODUCT.exec(url || "");
    return m ? Number(m[1]) : null;
  }

  /* Woolworths deli sells by 100 g, minimum 100 g. Round up so the owner never runs short. */
  function deliGrams(needGrams) {
    return Math.max(100, Math.ceil(needGrams / 100) * 100);
  }

  function lineName(row, label, several, quantity) {
    if (DELI_NAME[row.id]) return DELI_NAME[row.id] + " (deli, " + Math.round(quantity * 1000) + "g)";
    return several ? row.name + " (" + label + ")" : row.name;
  }

  function cartLines(rows, ticks, links) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id]) return;
      var all = links[row.id] || [];
      var woolies = all.filter(function (l) { return stockcodeOf(l[1]) !== null; });
      if (row.id === "pasta") {
        var wanted = (row.used || []).map(function (meal) { return PASTA_LABEL_FOR_MEAL[meal]; });
        woolies = woolies.filter(function (l) { return wanted.indexOf(l[0]) !== -1; });
      }
      if (!woolies.length) {
        manual.push({ itemId: row.id, name: row.name, reason: all.length ? "coles" : "nostore" });
        return;
      }
      var several = woolies.length > 1;
      var quantity = Math.round(row.n * 1000) / 1000;
      woolies.forEach(function (l) {
        lines.push({
          itemId: row.id,
          stockcode: stockcodeOf(l[1]),
          quantity: quantity,
          name: lineName(row, l[0], several, quantity),
          url: l[1],
        });
      });
    });
    return { lines: lines, manual: manual };
  }

  var api = { cartLines: cartLines, stockcodeOf: stockcodeOf, deliGrams: deliGrams };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/android/app/src/test/js/`
Expected: PASS, 19 tests (11 cart, 8 trolley).

- [ ] **Step 5: Update `Weekday_Fuel.html`**

a) `buildList()` ham branch (currently line ~843):

```js
    else if(id==="ham"){const g=WeekdayFuelCart.deliGrams(amt);qty=fmtAmt(amt,"g");buy=g+"g shaved from the deli";cost=g/100*2.8;n=g/1000;}
```

b) `SHOP` ham entry (currently line ~354):

```js
  ["ham","D'Orsogna Ham Leg Triple Smoked 97% Fat Free, shaved at the deli, 300g",8.4,"ok","Woolworths deli $2.80/100g, sold in 100g steps. In store, ask for 300g shaved"],
```

c) `MANUAL_WHY` (currently line ~864):

```js
const MANUAL_WHY={coles:"Coles only",nostore:"no online store page"};
```

Then check nothing else still says "Ask the deli" or uses the `deli` reason:

Run: `rg -n "Ask the deli|reason:\"deli\"|MANUAL_WHY.deli|2\.6\b" apps/android/app/src/main/assets`
Expected: no matches.

- [ ] **Step 6: Check the page in a browser**

Run: `npx --yes http-server apps/android/app/src/main/assets -p 8123 -s` in the background, open `http://localhost:8123/weekday_fuel/Weekday_Fuel.html`, go to Shop → Build a shop → "Use the starter shop".
Expected: the starter shop's only ham meal is 2 toasties × 100 g, so the ham row reads "200g shaved from the deli" at $5.60. Add one serve of Egg & ham breakfast muffins (50 g): it becomes "300g shaved from the deli" at $8.40. No console errors. (The trolley panel only renders inside the app, where `WeekdayFuelHost` exists.) Stop the server.

- [ ] **Step 7: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/cart.js apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html apps/android/app/src/test/js/cart.test.js
git commit -m "deli-ham: send shaved ham to the trolley by weight"
```

Then the "Watching CI after a push" commands. Expected: green; "JS unit tests" ✓; launch smoke test passes. No release.

---

### Task 3: Docs, release v0.2.1, phone checks

**Files:**
- Modify: `docs/woolworths-requests.md` (section "Deli ham (175734)")
- Modify: `apps/android/app/build.gradle.kts`
- Modify: `docs/superpowers/specs/2026-10-15-deli-ham-trolley-design.md` (status)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: release `v0.2.1` on `Evzy/weekday-fuel-releases`.

- [ ] **Step 1: Update the deli section**

In `docs/woolworths-requests.md`, replace the whole "## Deli ham (175734)" section (its table) with:

```markdown
## Deli ham (175734)

| Field | Value |
| --- | --- |
| Body the site sends when adding shaved ham | Same request and body shape, `quantity` in kilograms: `0.1` for the minimum 100 g. |
| Product facts (`/apis/ui/product/detail/175734`, 2026-10-15) | `Unit` `KG`, `MinimumQuantity` 0.1, `IncrementalMinimumQuantity` 100 g, `SupplyLimit` 10, $28.00/kg |
| Automated? | Yes, from v0.2.1: Build a shop rounds up to the next 100 g and sends the weight in kilograms. |
```

- [ ] **Step 2: Bump the version**

In `apps/android/app/build.gradle.kts`:

```kotlin
        versionCode = 5
        versionName = "0.2.1"
```

- [ ] **Step 3: Commit, push, watch CI**

```powershell
git add docs/woolworths-requests.md apps/android/app/build.gradle.kts
git commit -m "release: v0.2.1"
```

Then the "Watching CI after a push" commands. Expected: green, and `v0.2.1` with `WeekdayFuel-v0.2.1-debug.apk` appears on https://github.com/Evzy/weekday-fuel-releases/releases.

- [ ] **Step 4 (OWNER, phone): checks from the spec**

Accept the update prompt on launch, then:

- [ ] Starter shop: Shop shows ham as "<g>g shaved from the deli"; after Send, the Woolworths trolley shows the ham at that weight.
- [ ] Send again: the ham weight is unchanged (set, not added).
- [ ] Tick the ham, send: the ham in the trolley is unchanged.
- [ ] "Add these yourself" no longer lists ham.
- [ ] The ham's product link (Shop → ham → product page) opens in the Woolworths screen. If it shows a 404, report it; the link gets fixed in a follow-up.

Any failure: fix in a follow-up commit with a test where possible, release `0.2.2`.

- [ ] **Step 5: Mark the spec done**

In `docs/superpowers/specs/2026-10-15-deli-ham-trolley-design.md`, replace `**Status:** approved 2026-10-15` with `**Status:** done (v0.2.1)`.

```powershell
git add docs/superpowers/specs/2026-10-15-deli-ham-trolley-design.md
git commit -m "deli-ham: done"
git push
```
