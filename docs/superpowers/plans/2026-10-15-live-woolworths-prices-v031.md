# Live Woolworths prices (v0.3.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-15-both-stores-design.md`](../specs/2026-10-15-both-stores-design.md), sections "Live Woolworths prices (v0.3.1)", "Error handling", "Testing", "Release and phone checks" (v0.3.1).

**Goal:** Shop, meal costs and the trolley panel use Woolworths' current shelf prices (specials included), read in the background from woolworths.com.au, cached for 12 hours, with a "Refresh prices" button.

**Architecture:** A small in-page script `assets/woolworths/prices.js` (like `trolley.js`) reads every catalogue stockcode with Woolworths' own batch product request and exposes its state. `WoolworthsSession` injects and polls it; `MainActivity` relays `refreshPrices` from the page and replies `pricesDone` / `pricesError`. The page caches the result under `weekdayfuel.v1.prices` and rebuilds its catalogue with a pure `applyLivePrices(items, prices)` from `catalogue.js`, so every existing total, meal cost and trolley line picks the live prices up unchanged.

**Tech Stack:** Plain JS (ES5-style IIFEs, Node `node:test`), Kotlin + Android WebView, `org.json`, GitHub Actions CI.

## Global Constraints

- Woolworths pages never get a JavaScript bridge. Only origin `https://appassets.androidplatform.net` may message the host.
- Nothing in CI talks to the real Coles or Woolworths sites.
- Live prices are cached under a new key `weekdayfuel.v1.prices`: `{ at: ISO time, prices: { [stockcode]: { price, was, special, available } } }`.
- When Shop opens inside the app and `weekdayfuel.v1.prices.at` is missing or over 12 hours old, the page posts `{type: "refreshPrices", stockcodes: [...]}`; "Refresh prices" posts the same.
- The host replies `{type: "pricesDone", at, prices}` or `{type: "pricesError", message}`.
- Live prices replace the catalogue's Woolworths prices for display, totals, meal costs and the trolley panel.
- Refresh fails: keep the last prices; Shop shows "Couldn't update Woolworths prices" under the price label. No automatic retry until the next Shop open after 12 hours, or the button.
- A product missing from the response keeps its cached or catalogue price. Unreadable cache: ignored. Outside the app (plain browser): no live prices, no Refresh button.
- A Woolworths product on special shows "Special, was $X"; one unavailable online counts as missed at Woolworths with "unavailable online now".
- Store names shown to the owner: "Coles" and "Woolworths". Internal keys: `coles`, `woolies`.
- Commit straight to `main` with the prefix `live-prices:`; the release commit is `release: v0.3.1`. CI green before the next task. There is no local Android SDK: Kotlin is compiled and tested only by CI.
- Bump the version only in Task 5. Do not touch `platra/`, the keystore, `local.properties`, `docs/seed/`, or the untracked `.superpowers/` files.

## Facts (recorded by the controller, 2026-10-15, logged out, from a woolworths.com.au page)

- `GET /apis/ui/products/<stockcode>,<stockcode>,...` returns HTTP 200 and a JSON **array** of products, one per known stockcode. All 45 catalogue stockcodes in one request: 45 products back. An unknown stockcode is silently left out.
- Fields used: `Stockcode` (number), `Price` (number, per kg for ham 175734 where `Unit` is `"KG"`), `WasPrice` (number; equals `Price` when not reduced), `IsOnSpecial`, `IsAvailable`, `IsInStock`, `IsPurchasable` (booleans).
- Some reduced products have `WasPrice > Price` with `IsOnSpecial: false` (mince 577860: 9.8 was 10; wraps 919345: 5.6 was 6.6). So "special" = `WasPrice > Price` or `IsOnSpecial`.

## File map

| File | Change |
| --- | --- |
| `apps/android/app/src/main/assets/woolworths/prices.js` | Create: in-page price reader |
| `apps/android/app/src/test/js/prices.test.js` | Create |
| `docs/woolworths-requests.md` | Add "Product prices request" |
| `.github/workflows/release-android.yml` | Add `prices.test.js` to the JS test step |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/PricesModels.kt` | Create: script state parsing |
| `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/PricesJsonTest.kt` | Create |
| `.../woolworths/HostMessages.kt`, `HostMessagesTest.kt` | `prices()` / `pricesFailure()` |
| `.../woolworths/WoolworthsSession.kt` | `refreshPrices()`, `cancelPrices()`, `Listener.onPrices` |
| `.../MainActivity.kt` | `refreshPrices` message, `onPrices` reply |
| `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` | `applyLivePrices`, `checked(store)`, rows carry `wooliesUnavailable` |
| `apps/android/app/src/main/assets/weekday_fuel/cart.js` | `unavailable` manual reason |
| `apps/android/app/src/test/js/catalogue.test.js`, `cart.test.js` | New tests |
| `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` | Cache, refresh, labels, special, unavailable |
| `apps/android/app/build.gradle.kts` | Task 5 only: version |

---

### Task 1: Price script

**Files:**
- Create: `apps/android/app/src/main/assets/woolworths/prices.js`
- Create: `apps/android/app/src/test/js/prices.test.js`
- Modify: `docs/woolworths-requests.md` (append a section)
- Modify: `.github/workflows/release-android.yml` (JS unit tests step)

**Interfaces:**
- Produces: `window.__weekdayFuelPrices = { start(stockcodes: number[]): boolean, state(): string, urls: { products: "/apis/ui/products/" } }`. `state()` is `JSON.stringify({ phase: "idle"|"fetching"|"done"|"error", at: string|null, prices: { [stockcode]: { price: number|null, was: number|null, special: boolean, available: boolean } }, error: string|null })`. Task 2 polls it with the expression `window.__weekdayFuelPrices ? window.__weekdayFuelPrices.state() : null`.

- [ ] **Step 1: Write the failing tests** — create `apps/android/app/src/test/js/prices.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/woolworths/prices.js");

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const P = (Stockcode, Price, WasPrice, extra = {}) => ({
  Stockcode, Price, WasPrice, IsOnSpecial: false, IsAvailable: true, IsInStock: true, IsPurchasable: true, ...extra,
});

function load(handler) {
  const calls = [];
  globalThis.window = {};
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelPrices, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "fetching") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("price script did not settle");
}

test("reads every stockcode in one request and maps price, was, special and availability", async () => {
  const { api, calls } = load(() =>
    response(200, [
      P(6013278, 6.7, 6.7),
      P(919345, 5.6, 6.6),
      P(43974, 2.3, 2.3, { IsOnSpecial: true }),
      P(175734, 28, 28, { Unit: "KG" }),
      P(729008, 8.3, 8.3, { IsAvailable: false }),
      P(46795, 6.8, 6.8, { IsInStock: false }),
      P(98046, null, null),
    ]),
  );
  assert.equal(api.start([6013278, 919345, 43974, 175734, 729008, 46795, 98046]), true);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/apis/ui/products/6013278,919345,43974,175734,729008,46795,98046");
  assert.equal(calls[0].init.credentials, "include");
  assert.deepEqual(s.prices, {
    6013278: { price: 6.7, was: null, special: false, available: true },
    919345: { price: 5.6, was: 6.6, special: true, available: true },
    43974: { price: 2.3, was: null, special: true, available: true },
    175734: { price: 28, was: null, special: false, available: true },
    729008: { price: 8.3, was: null, special: false, available: false },
    46795: { price: 6.8, was: null, special: false, available: false },
    98046: { price: null, was: null, special: false, available: false },
  });
  assert.ok(!Number.isNaN(Date.parse(s.at)));
  assert.equal(s.error, null);
});

test("splits long lists into requests of 40 stockcodes", async () => {
  const codes = Array.from({ length: 85 }, (_, i) => 1000 + i);
  const { api, calls } = load((url) => {
    const asked = url.slice("/apis/ui/products/".length).split(",").map(Number);
    return response(200, asked.map((c) => P(c, 1, 1)));
  });
  api.start(codes);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(calls.map((c) => c.url.split(",").length), [40, 40, 5]);
  assert.equal(Object.keys(s.prices).length, 85);
});

test("a stockcode Woolworths leaves out is simply missing from the prices", async () => {
  const { api } = load(() => response(200, [P(6013278, 6.7, 6.7)]));
  api.start([6013278, 1]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(Object.keys(s.prices), ["6013278"]);
});

test("an HTTP error ends in error with no prices", async () => {
  const { api } = load(() => response(503, {}));
  api.start([6013278]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error, s.prices, s.at], ["error", "prices HTTP 503", {}, null]);
});

test("a response that is not a list ends in error", async () => {
  const { api } = load(() => response(200, { Products: [] }));
  api.start([6013278]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error], ["error", "prices response is not a list"]);
});

test("a network error ends in error", async () => {
  const { api } = load(() => {
    throw new Error("offline");
  });
  api.start([6013278]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error], ["error", "offline"]);
});

test("ignores start() while fetching, and can run again after", async () => {
  const { api, calls } = load(() => response(200, [P(6013278, 6.7, 6.7)]));
  assert.equal(api.start([6013278]), true);
  assert.equal(api.start([6013278]), false);
  await settle(api);
  assert.equal(calls.length, 1);
  assert.equal(api.start([6013278]), true);
  await settle(api);
  assert.equal(calls.length, 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test "apps/android/app/src/test/js/prices.test.js"`
Expected: FAIL (`Cannot find module` for `prices.js`).

- [ ] **Step 3: Write the script** — create `apps/android/app/src/main/assets/woolworths/prices.js`:

```js
/* Injected into woolworths.com.au by WoolworthsSession. Reads current prices with the site's own product request. */
(function () {
  "use strict";
  if (window.__weekdayFuelPrices) return;

  var PRODUCTS_URL = "/apis/ui/products/";
  var CHUNK = 40;
  var state = { phase: "idle", at: null, prices: {}, error: null };

  function entry(p) {
    var price = typeof p.Price === "number" && p.Price > 0 ? p.Price : null;
    var was = price != null && typeof p.WasPrice === "number" && p.WasPrice > price ? p.WasPrice : null;
    return {
      price: price,
      was: was,
      special: was != null || p.IsOnSpecial === true,
      available: price != null && p.IsAvailable !== false && p.IsInStock !== false && p.IsPurchasable !== false,
    };
  }

  async function fetchChunk(codes, into) {
    var r = await fetch(PRODUCTS_URL + codes.join(","), { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("prices HTTP " + r.status);
    var list = await r.json();
    if (!Array.isArray(list)) throw new Error("prices response is not a list");
    list.forEach(function (p) {
      if (p && typeof p.Stockcode === "number") into[p.Stockcode] = entry(p);
    });
  }

  async function run(codes) {
    state = { phase: "fetching", at: null, prices: {}, error: null };
    var prices = {};
    try {
      for (var i = 0; i < codes.length; i += CHUNK) await fetchChunk(codes.slice(i, i + CHUNK), prices);
      state = { phase: "done", at: new Date().toISOString(), prices: prices, error: null };
    } catch (e) {
      state = { phase: "error", at: null, prices: {}, error: String((e && e.message) || e) };
    }
  }

  window.__weekdayFuelPrices = {
    start: function (codes) {
      if (state.phase === "fetching") return false;
      run(codes);
      return true;
    },
    state: function () { return JSON.stringify(state); },
    urls: { products: PRODUCTS_URL },
  };
})();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test "apps/android/app/src/test/js/prices.test.js"`
Expected: 7 tests pass.

- [ ] **Step 5: Record the request** — append to `docs/woolworths-requests.md`:

```markdown
## Product prices request (2026-10-15, logged out)

- `GET /apis/ui/products/<stockcode>,<stockcode>,...` from a woolworths.com.au page returns HTTP 200 and a JSON array, one product per known stockcode. All 45 catalogue stockcodes in one request returned 45 products; an unknown stockcode is silently left out. `prices.js` asks for 40 at a time.
- Fields used: `Stockcode`, `Price` (per kg when `Unit` is `"KG"`, e.g. ham 175734 at 28), `WasPrice` (equals `Price` when not reduced), `IsOnSpecial`, `IsAvailable`, `IsInStock`, `IsPurchasable`.
- Reduced products can have `WasPrice > Price` with `IsOnSpecial: false` (mince 577860: 9.8 was 10; wraps 919345: 5.6 was 6.6), so the app treats `WasPrice > Price` or `IsOnSpecial` as a special.
- No login needed.
```

- [ ] **Step 6: Add the test file to CI** — in `.github/workflows/release-android.yml`, the "JS unit tests" step's `run:` line gains ` apps/android/app/src/test/js/prices.test.js` at the end (after `catalogue-data.test.js`).

- [ ] **Step 7: Run every JS test**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: 31 tests pass (24 before + 7).

- [ ] **Step 8: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/woolworths/prices.js apps/android/app/src/test/js/prices.test.js docs/woolworths-requests.md .github/workflows/release-android.yml
git commit -m "live-prices: in-page Woolworths price reader"
git push; Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status
```

Expected: CI green.

---

### Task 2: Host runs the price script

**Files:**
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/PricesModels.kt`
- Create: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/PricesJsonTest.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt`
- Modify: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/HostMessagesTest.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsSession.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt`

**Interfaces:**
- Consumes: Task 1's `window.__weekdayFuelPrices` (`start(stockcodes)`, `state()`), asset path `woolworths/prices.js`.
- Produces: page message in `{type:"refreshPrices", stockcodes:[number...]}`; host replies `{type:"pricesDone", at:string, prices:{[stockcode]:{price,was,special,available}}}` or `{type:"pricesError", message:string}`. Task 4 relies on exactly these.

- [ ] **Step 1: Write the failing tests** — create `PricesJsonTest.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PricesJsonTest {
    @Test
    fun missingScriptGivesNull() {
        assertNull(PricesJson.parseScriptState(null))
        assertNull(PricesJson.parseScriptState("null"))
    }

    @Test
    fun parsesDoneStateWithPrices() {
        val raw =
            """{"phase":"done","at":"2026-10-15T02:40:00.000Z","prices":{"919345":{"price":5.6,"was":6.6,"special":true,"available":true}},"error":null}"""
        val state = PricesJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(PricesPhase.DONE, state.phase)
        assertEquals("2026-10-15T02:40:00.000Z", state.at)
        assertEquals(5.6, state.prices.getJSONObject("919345").getDouble("price"), 0.0)
        assertNull(state.error)
    }

    @Test
    fun parsesFetchingAndError() {
        val fetching = PricesJson.parseScriptState(JSONObject.quote("""{"phase":"fetching","at":null,"prices":{},"error":null}"""))!!
        assertEquals(PricesPhase.FETCHING, fetching.phase)
        assertNull(fetching.at)
        val error = PricesJson.parseScriptState(JSONObject.quote("""{"phase":"error","at":null,"prices":{},"error":"prices HTTP 503"}"""))!!
        assertEquals(PricesPhase.ERROR, error.phase)
        assertEquals("prices HTTP 503", error.error)
    }

    @Test
    fun parseStockcodesKeepsPositiveUniqueCodes() {
        assertEquals(listOf(6013278L, 919345L), PricesJson.parseStockcodes(JSONArray("[6013278,919345,6013278,0,-4]")))
    }

    @Test
    fun stockcodesToJsonIsAPlainArray() {
        assertEquals("[6013278,919345]", PricesJson.stockcodesToJson(listOf(6013278L, 919345L)))
    }
}
```

Add to `HostMessagesTest.kt` (inside the class, after `loginMessage`):

```kotlin
    @Test
    fun pricesDoneCarriesTimeAndPrices() {
        val prices = JSONObject("""{"919345":{"price":5.6,"was":6.6,"special":true,"available":true}}""")
        val json = JSONObject(HostMessages.prices(PricesScriptState(PricesPhase.DONE, "2026-10-15T02:40:00.000Z", prices, null)))
        assertEquals("pricesDone", json.getString("type"))
        assertEquals("2026-10-15T02:40:00.000Z", json.getString("at"))
        assertEquals(6.6, json.getJSONObject("prices").getJSONObject("919345").getDouble("was"), 0.0)
    }

    @Test
    fun pricesErrorCarriesMessage() {
        val json = JSONObject(HostMessages.prices(PricesScriptState(PricesPhase.ERROR, null, JSONObject(), "prices HTTP 503")))
        assertEquals("pricesError", json.getString("type"))
        assertEquals("prices HTTP 503", json.getString("message"))
        val fallback = JSONObject(HostMessages.prices(PricesScriptState(PricesPhase.ERROR, null, JSONObject(), null)))
        assertEquals("Couldn't update Woolworths prices.", fallback.getString("message"))
    }
```

- [ ] **Step 2: Create `PricesModels.kt`**

```kotlin
package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

enum class PricesPhase { IDLE, FETCHING, DONE, ERROR }

/** [prices] is the script's `{ "<stockcode>": {price, was, special, available} }` object, passed to the page as it is. */
data class PricesScriptState(val phase: PricesPhase, val at: String?, val prices: JSONObject, val error: String?)

object PricesJson {
    fun parseStockcodes(codes: JSONArray): List<Long> = (0 until codes.length()).map { codes.getLong(it) }.filter { it > 0 }.distinct()

    fun stockcodesToJson(codes: List<Long>): String = JSONArray().apply { codes.forEach { put(it) } }.toString()

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelPrices.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): PricesScriptState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        return PricesScriptState(
            phase =
                when (o.optString("phase")) {
                    "fetching" -> PricesPhase.FETCHING
                    "done" -> PricesPhase.DONE
                    "error" -> PricesPhase.ERROR
                    else -> PricesPhase.IDLE
                },
            at = if (o.isNull("at")) null else o.optString("at"),
            prices = o.optJSONObject("prices") ?: JSONObject(),
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
```

- [ ] **Step 3: Add the messages** — in `HostMessages.kt`, add below `failure`:

```kotlin
    fun prices(state: PricesScriptState): String {
        if (state.phase != PricesPhase.DONE) return pricesFailure(state.error ?: PRICES_FAILURE)
        return JSONObject().put("type", "pricesDone").put("at", state.at ?: JSONObject.NULL).put("prices", state.prices).toString()
    }

    fun pricesFailure(message: String): String = JSONObject().put("type", "pricesError").put("message", message).toString()
```

and next to `GENERIC_FAILURE`:

```kotlin
    private const val PRICES_FAILURE = "Couldn't update Woolworths prices."
```

- [ ] **Step 4: Run the price script from the session** — in `WoolworthsSession.kt`:

Add to `Listener`:

```kotlin
        fun onPrices(state: PricesScriptState)
```

Add fields after `private val watchdog = ...`:

```kotlin
    private val pricesScript: String by lazy {
        context.assets.open(PRICES_ASSET).bufferedReader().use { it.readText() }
    }
    private var pendingPrices: List<Long>? = null
    private var pricesPolling = false
    private val pricesPoller = Runnable { pollPrices() }
    private val pricesWatchdog =
        Runnable {
            // A hung request leaves the script "fetching", which refuses start(); reload the page before the next refresh.
            needsFreshPage = true
            failPrices(context.getString(R.string.woolworths_timeout))
        }
```

Add the public functions after `cancel()`:

```kotlin
    /** Reads current prices in the background page. A running send keeps control of navigation; prices start once its shop page is up. */
    fun refreshPrices(stockcodes: List<Long>) {
        pendingPrices = stockcodes
        pricesPolling = false
        handler.removeCallbacks(pricesPoller)
        handler.removeCallbacks(pricesWatchdog)
        handler.postDelayed(pricesWatchdog, PRICES_TIMEOUT_MS)
        when {
            pending == null && (needsFreshPage || !onShopPage()) -> webView.loadUrl(WoolworthsUrls.HOME_URL)
            !pageLoading -> startPrices()
        }
    }

    fun cancelPrices() {
        pendingPrices = null
        pricesPolling = false
        handler.removeCallbacks(pricesPoller)
        handler.removeCallbacks(pricesWatchdog)
    }
```

Add the private functions after `fail(...)`:

```kotlin
    private fun startPrices() {
        val codes = pendingPrices ?: return
        if (pageLoading || !onShopPage()) return
        handler.removeCallbacks(pricesPoller)
        pricesPolling = true
        webView.evaluateJavascript("$pricesScript\nwindow.__weekdayFuelPrices.start(${PricesJson.stockcodesToJson(codes)});", null)
        handler.postDelayed(pricesPoller, POLL_MS)
    }

    private fun pollPrices() {
        if (!pricesPolling) return
        webView.evaluateJavascript(PRICES_STATE_EXPRESSION) { result ->
            if (!pricesPolling) return@evaluateJavascript
            val state = runCatching { PricesJson.parseScriptState(result) }.getOrNull()
            when (state?.phase) {
                null -> {
                    // A new document dropped the script; onPageFinished or this restarts it.
                    pricesPolling = false
                    if (!pageLoading) startPrices()
                }
                PricesPhase.IDLE, PricesPhase.FETCHING -> handler.postDelayed(pricesPoller, POLL_MS)
                PricesPhase.DONE, PricesPhase.ERROR -> {
                    cancelPrices()
                    listener?.onPrices(state)
                }
            }
        }
    }

    private fun failPrices(message: String) {
        if (pendingPrices == null) return
        cancelPrices()
        listener?.onPrices(PricesScriptState(PricesPhase.ERROR, null, JSONObject(), message))
    }
```

In `SessionClient.onPageFinished`, after the existing `if (pending != null && !polling && shop) { ... }` block, add:

```kotlin
            if (pendingPrices != null && !pricesPolling && shop) startPrices()
```

In `SessionClient.onReceivedError`, inside `if (request.isForMainFrame) { ... }`, after `fail(...)`, add:

```kotlin
                failPrices(context.getString(R.string.woolworths_offline))
```

In the companion object add:

```kotlin
        const val PRICES_ASSET = "woolworths/prices.js"
        const val PRICES_STATE_EXPRESSION = "window.__weekdayFuelPrices ? window.__weekdayFuelPrices.state() : null"
        const val PRICES_TIMEOUT_MS = 30_000L
```

Add the import `import org.json.JSONObject`.

- [ ] **Step 5: Relay messages in `MainActivity.kt`**

In `onHostMessage`'s `when`, add after `"checkout" -> ...`:

```kotlin
            "refreshPrices" -> {
                val codes = runCatching { PricesJson.parseStockcodes(msg.optJSONArray("stockcodes") ?: JSONArray()) }.getOrNull()
                if (codes.isNullOrEmpty()) {
                    replyToPage(HostMessages.pricesFailure(getString(R.string.woolworths_bad_request)))
                    return
                }
                woolworths.refreshPrices(codes)
            }
```

In `TrolleyListener`, add:

```kotlin
        override fun onPrices(state: PricesScriptState) {
            replyToPage(HostMessages.prices(state))
        }
```

In `onDestroy`, after `woolworths.cancel()`, add `woolworths.cancelPrices()`.

Add imports `dev.weekdayfuel.app.woolworths.PricesJson` and `dev.weekdayfuel.app.woolworths.PricesScriptState` (keep the import list sorted).

- [ ] **Step 6: Check JS tests still pass** (Kotlin is checked by CI)

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: 31 pass.

- [ ] **Step 7: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/PricesModels.kt apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/PricesJsonTest.kt apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/HostMessagesTest.kt apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsSession.kt apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt
git commit -m "live-prices: host reads Woolworths prices on request"
git push; Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status
```

Expected: CI green, including `PricesJsonTest` and the two new `HostMessagesTest` tests. A Kotlin compile error shows in the "Unit tests + debug APK" step: fix and push again.

---

### Task 3: Catalogue applies live prices

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js`
- Modify: `apps/android/app/src/main/assets/weekday_fuel/cart.js`
- Test: `apps/android/app/src/test/js/catalogue.test.js`, `apps/android/app/src/test/js/cart.test.js`

**Interfaces:**
- Produces:
  - `WeekdayFuelCatalogue.applyLivePrices(items, prices) → items`: a new array; items are unchanged (same object) unless their Woolworths product has a live entry. Live entry with `available === false`: the copy has `woolies: null` and `wooliesUnavailable: <the catalogue Woolworths product>`. Live entry with a positive `price`: the copy's `woolies` is the product with `price` replaced, `was` (number when higher than the live price, else `null`) and `live: true`. Input is never mutated. `prices` null/undefined returns the items as they are.
  - `create(...).checked(store) → "YYYY-MM-DD" | null`: oldest `checked` date of that store's products (small packs included). `colesChecked()` stays and equals `checked("coles")`.
  - `shopList` rows gain `wooliesUnavailable` (the product, or `null`).
  - `cartLines` manual reason `"unavailable"` for rows with `wooliesUnavailable`, named after that Woolworths product.

- [ ] **Step 1: Write the failing tests** — in `catalogue.test.js`, change the require line to:

```js
const { create, deliGrams, applyLivePrices } = require("../../main/assets/weekday_fuel/catalogue.js");
```

and append:

```js
test("live prices replace Woolworths prices without changing the catalogue", () => {
  const live = applyLivePrices(ITEMS, {
    729008: { price: 7.5, was: 9, special: true, available: true },
    175734: { price: 30, was: null, special: false, available: true },
    123456: { price: 13, was: 13, special: false, available: true },
  });
  const cheese = live.find((i) => i.id === "cheese");
  assert.deepEqual([cheese.woolies.price, cheese.woolies.was, cheese.woolies.live, cheese.woolies.name], [7.5, 9, true, "Woolworths Light Tasty 500g"]);
  assert.equal(cheese.coles, ITEMS[3].coles);
  assert.equal(ITEMS[3].woolies.price, 9);
  assert.equal(live.find((i) => i.id === "breast").woolies.was, null);
  assert.equal(live.find((i) => i.id === "dare"), ITEMS[0]);
  const c = create(live, AMOUNTS);
  assert.equal(byId(c.shopList({ toasty: 1 }, 0)).ham.woolies.cost, 3);
  assert.equal(c.mealCost("toasty", "woolies"), 3.45);
});

test("no live prices, or an unusable price, leaves items as they are", () => {
  assert.deepEqual(applyLivePrices(ITEMS, null), ITEMS);
  const live = applyLivePrices(ITEMS, { 729008: { price: null, was: null, special: false, available: true } });
  assert.equal(live.find((i) => i.id === "cheese"), ITEMS[3]);
});

test("a product unavailable online counts as missed at Woolworths", () => {
  const live = applyLivePrices(ITEMS, { 729008: { price: 9, was: null, special: false, available: false } });
  const cheese = live.find((i) => i.id === "cheese");
  assert.equal(cheese.woolies, null);
  assert.equal(cheese.wooliesUnavailable.stockcode, 729008);
  const c = create(live, AMOUNTS);
  const rows = c.shopList({ toasty: 1 }, 0);
  assert.equal(byId(rows).cheese.woolies, null);
  assert.equal(byId(rows).cheese.wooliesUnavailable.name, "Woolworths Light Tasty 500g");
  assert.equal(byId(rows).ham.wooliesUnavailable, null);
  assert.deepEqual(c.storeTotals(rows, "woolies", {}).missed, ["cheese"]);
  assert.equal(c.mealCost("toasty", "woolies"), 3.25);
});

test("checked gives each store's oldest price date", () => {
  assert.equal(cat.checked("coles"), "2026-10-12");
  assert.equal(cat.checked("woolies"), "2026-10-15");
});
```

In `cart.test.js`, append:

```js
test("a product unavailable online goes to the do-it-yourself list with its reason", () => {
  const r = { ...row("cheese", null, { product: { name: "Coles Light Tasty 500g" }, quantity: 1 }), wooliesUnavailable: { name: "Woolworths Light Tasty 500g" } };
  const { lines, manual } = cartLines([r], {});
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [{ itemId: "cheese", name: "Woolworths Light Tasty 500g", reason: "unavailable" }]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test "apps/android/app/src/test/js/catalogue.test.js" "apps/android/app/src/test/js/cart.test.js"`
Expected: FAIL (`applyLivePrices is not a function`, `cat.checked is not a function`, cart reason `"coles"` instead of `"unavailable"`).

- [ ] **Step 3: Implement in `catalogue.js`**

Above `function create(items, amounts) {` add:

```js
  /* prices: { [stockcode]: { price, was, special, available } } read live from Woolworths. */
  function applyLivePrices(items, prices) {
    if (!prices) return items;
    return items.map(function (it) {
      var p = it.woolies;
      var live = p && prices[p.stockcode];
      if (!live) return it;
      if (live.available === false) return Object.assign({}, it, { woolies: null, wooliesUnavailable: p });
      if (!(typeof live.price === "number" && live.price > 0)) return it;
      var was = typeof live.was === "number" && live.was > live.price ? live.was : null;
      return Object.assign({}, it, { woolies: Object.assign({}, p, { price: live.price, was: was, live: true }) });
    });
  }
```

In `shopList`'s returned row object, after `woolies: ...`, add:

```js
            wooliesUnavailable: it.wooliesUnavailable || null,
```

Replace `function colesChecked() { ... }` with:

```js
    function checked(store) {
      var dates = [];
      items.forEach(function (it) {
        var p = it[store];
        if (!p) return;
        dates.push(p.checked);
        if (p.small) dates.push(p.small.checked);
      });
      return dates.sort()[0] || null;
    }
```

In the returned object replace `colesChecked: colesChecked,` with:

```js
      checked: checked,
      colesChecked: function () {
        return checked("coles");
      },
```

After `api.create = create;` add:

```js
  api.applyLivePrices = applyLivePrices;
```

- [ ] **Step 4: Implement in `cart.js`** — replace the `manual.push(...)` line with:

```js
        if (row.wooliesUnavailable) manual.push({ itemId: row.id, name: row.wooliesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.coles ? row.coles.product.name : row.name, reason: row.coles ? "coles" : "nostore" });
```

- [ ] **Step 5: Run every JS test**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: 36 pass (31 + 4 catalogue + 1 cart).

- [ ] **Step 6: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/catalogue.js apps/android/app/src/main/assets/weekday_fuel/cart.js apps/android/app/src/test/js/catalogue.test.js apps/android/app/src/test/js/cart.test.js
git commit -m "live-prices: catalogue applies live Woolworths prices"
git push; Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status
```

---

### Task 4: Shop uses, refreshes and labels live prices

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: Task 2's messages (`refreshPrices` out; `pricesDone {at, prices}` / `pricesError {message}` in); Task 3's `WeekdayFuelCatalogue.applyLivePrices`, `CAT.checked(store)`, row `wooliesUnavailable`, cart reason `"unavailable"`.

- [ ] **Step 1: Rebuild the catalogue from the cache** — replace

```js
/* Shop data and maths live in catalogue.js */
const CAT=WeekdayFuelCatalogue;
```

with

```js
/* Shop data and maths live in catalogue.js; cached live Woolworths prices replace its Woolworths prices */
const PRICES_KEY="weekdayfuel.v1.prices",LIVE_MAX_AGE=12*3600e3;
function livePrices(){try{const c=JSON.parse(localStorage.getItem(PRICES_KEY)||"null");return c&&typeof c.at==="string"&&c.prices&&typeof c.prices==="object"?c:null}catch(e){return null}}
function buildCat(){const W=WeekdayFuelCatalogue,lp=livePrices();return W.create(lp?W.applyLivePrices(W.ITEMS,lp.prices):W.ITEMS,W.AMOUNTS)}
let CAT=buildCat();
```

- [ ] **Step 2: Refresh requests** — add `prices:null,pricesTried:0` to the `state` object (after `trolley:null`). Below `function lsSetTicks(t){...}` add:

```js
/* state.prices: null, "busy" or "error" */
function refreshPrices(){
  if(!window.WeekdayFuelHost||state.prices==="busy")return;
  state.prices="busy";state.pricesTried=Date.now();
  WeekdayFuelHost.postMessage(JSON.stringify({type:"refreshPrices",stockcodes:WeekdayFuelCatalogue.ITEMS.filter(i=>i.woolies).map(i=>i.woolies.stockcode)}));
}
function maybeRefreshPrices(){
  const lp=livePrices();const fresh=lp&&Date.now()-Date.parse(lp.at)<=LIVE_MAX_AGE;
  if(!fresh&&!(state.pricesTried&&Date.now()-state.pricesTried<LIVE_MAX_AGE))refreshPrices();
}
function onPrices(m){
  if(m.type==="pricesDone"&&typeof m.at==="string"&&m.prices&&typeof m.prices==="object"){
    const old=livePrices();
    try{localStorage.setItem(PRICES_KEY,JSON.stringify({at:m.at,prices:Object.assign({},old&&old.prices,m.prices)}))}catch(e){}
    CAT=buildCat();state.prices=null;
  }else state.prices="error";
}
```

In the click handler, replace `case "tab":state.tab=v;state.adding=null;window.scrollTo(0,0);break;` with

```js
    case "tab":state.tab=v;state.adding=null;window.scrollTo(0,0);if(v==="shop")maybeRefreshPrices();break;
```

and add a case after `case "store":...`:

```js
    case "refreshprices":refreshPrices();break;
```

In the host message listener, replace

```js
    let m;try{m=JSON.parse(e.data)}catch(_){return}
    const t=state.trolley;if(!t)return;
```

with

```js
    let m;try{m=JSON.parse(e.data)}catch(_){return}
    if(m.type==="pricesDone"||m.type==="pricesError"){onPrices(m);if(state.tab==="shop")render();return}
    const t=state.trolley;if(!t)return;
```

- [ ] **Step 3: Price label** — add after `function productLinks(...){...}`:

```js
function priceLabel(){
  const lp=livePrices(),t=lp&&new Date(lp.at);
  const time=d=>d.toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"});
  const w=t&&!isNaN(t)?"from "+(iso(t)===iso(new Date())?time(t)+" today":fmtShort(iso(t))+" "+time(t)):"checked "+fmtShort(CAT.checked("woolies"));
  let h=`Coles prices checked ${fmtShort(CAT.checked("coles"))} · Woolworths prices ${w}.`;
  if(window.WeekdayFuelHost)h+=state.prices==="busy"?` Updating Woolworths prices…`:` <button class="ghost" data-act="refreshprices">Refresh prices</button>`;
  if(state.prices==="error")h+=`<span style="display:block;color:var(--bad)">Couldn't update Woolworths prices</span>`;
  return h;
}
```

Replace both occurrences of `Coles prices checked ${fmtShort(CAT.colesChecked())}.` (Build a shop summary line and Full list intro) with `${priceLabel()}`.

- [ ] **Step 4: Specials and unavailable products** — add CSS next to `.sp.none{...}`:

```css
.was{font-size:.75rem;font-weight:600;color:var(--warn);margin-left:6px;white-space:nowrap}
```

Add after `function storePrice(...)`:

```js
const wasNote=p=>p&&p.was?`<span class="was">Special, was ${money(p.was)}${p.perKg?"/kg":""}</span>`:"";
const noProduct=(it,s)=>s==="woolies"&&it.wooliesUnavailable?esc(it.wooliesUnavailable.name)+" · unavailable online now":"Not at "+STORE_NAME[s];
```

Replace the body of `productsBlock` with:

```js
  if(it.same&&pr.coles&&pr.woolies)return `<span>${esc(pr.woolies.name)}</span><span class="prices">${STORES.map(s=>storePrice(s,prices[s])+(s==="woolies"?wasNote(pr.woolies):"")).join("")}</span>`;
  return STORES.map(s=>`<span class="pl ${s}"><span class="grow">${pr[s]?esc(pr[s].name):noProduct(it,s)}${s==="woolies"?wasNote(pr[s]):""}</span>${prices[s]!=null?`<span class="p">${money(prices[s])}</span>`:""}</span>`).join("");
```

Replace `productLinks` so an unavailable Woolworths product still links to its page:

```js
function productLinks(it,pr){
  return `<div class="stack" style="gap:6px;margin-top:8px">${STORES.map(s=>{const p=pr[s]||(s==="woolies"&&it.wooliesUnavailable);return p?`<a class="ghost link ${s}" href="${esc(p.url)}" target="_blank" rel="noopener">${STORE_NAME[s]} product page ↗</a>`:`<span class="small muted">Not at ${STORE_NAME[s]}</span>`}).join("")}</div>`;
}
```

In the "Missed at" panel (its rows show the other store's product), after `${esc(o?o.product.name:r.name)}` add:

```js
${st==="woolies"&&r.wooliesUnavailable?` <span class="muted">· Woolworths' ${esc(r.wooliesUnavailable.name)} is unavailable online now</span>`:""}
```

Change `const MANUAL_WHY={coles:"Coles only",nostore:"no online store page"};` to

```js
const MANUAL_WHY={coles:"Coles only",nostore:"no online store page",unavailable:"unavailable online now"};
```

- [ ] **Step 5: Run every JS test**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: 36 pass.

- [ ] **Step 6: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "live-prices: Shop uses, refreshes and labels live Woolworths prices"
git push; Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status
```

- [ ] **Step 7 (controller): browser check** — serve `apps/android/app/src/main/assets` with `npx --yes http-server <assets> -p 8123 -s -c-1`, open `/weekday_fuel/Weekday_Fuel.html` and:
  - No cache: Shop label reads "Coles prices checked 12 Oct · Woolworths prices checked 15 Oct." (dates from the catalogue), no Refresh button (plain browser).
  - Set `localStorage["weekdayfuel.v1.prices"]` to `{"at":"<now ISO>","prices":{"919345":{"price":5.6,"was":6.6,"special":true,"available":true},"729008":{"price":8.3,"was":null,"special":false,"available":false}}}` and reload: label "Woolworths prices from <time> today"; wraps show "Special, was $6.60"; cheese shows "… · unavailable online now" and, with the starter shop on Woolworths, sits under "Missed at Woolworths"; the Woolworths total counts 1 missed.
  - Set the key to `not json` and reload: no errors, catalogue prices.
  - No console errors. Remove the key afterwards.

---

### Task 5: Release v0.3.1 and phone checks

**Files:**
- Modify: `apps/android/app/build.gradle.kts`

- [ ] **Step 1: Bump the version**

```kotlin
        versionCode = 7
        versionName = "0.3.1"
```

- [ ] **Step 2: Commit, push, watch CI**

```powershell
git add apps/android/app/build.gradle.kts
git commit -m "release: v0.3.1"
git push; Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status
```

Expected: green, and `v0.3.1` with `WeekdayFuel-v0.3.1-debug.apk` on https://github.com/Evzy/weekday-fuel-releases/releases.

- [ ] **Step 3 (OWNER, phone): checks from the spec**

- [ ] Opening Shop shows "Woolworths prices from <time>"; Refresh prices updates it.
- [ ] A product on special shows "Special, was $X" matching woolworths.com.au.
- [ ] Airplane mode + Refresh shows "Couldn't update Woolworths prices" and keeps the old prices.

All pass: mark the both-stores spec `done (v0.3.1)`. Any failure: fix in a follow-up commit with a test where possible and release it as v0.3.2.
