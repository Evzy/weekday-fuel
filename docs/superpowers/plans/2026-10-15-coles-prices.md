# Live Coles Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-15-coles-prices-design.md`](../specs/2026-10-15-coles-prices-design.md)

**Goal:** Coles prices, specials and availability refresh in the background together with Woolworths prices, read from a hidden Coles page with the site's own batch product request.

**Architecture:** A new injected script `assets/coles/prices.js` makes one `productsInfo` GraphQL request per 30 products on coles.com.au (key and store read from the page). A new `ColesSession` (Kotlin) owns a never-shown Coles WebView, injects the script, polls it and reports `colesPricesDone`/`colesPricesError` to the page through `MainActivity`. `catalogue.js` gains `colesId` and `applyColesPrices`; `Weekday_Fuel.html` caches Coles prices under `weekdayfuel.v1.colesPrices`, asks for them with every price refresh and shows them; `orders.js` notes Coles-unavailable items.

**Tech Stack:** plain browser JS, Node built-in test runner (`node --test`), Kotlin (Android WebView, JUnit with org.json), GitHub Actions.

## Global Constraints

- Coles and Woolworths pages never get a JavaScript bridge; only the app origin `https://appassets.androidplatform.net` messages the host.
- Nothing is written to Coles; no login. The Coles key is read from the page at run time and never stored, logged or committed.
- Existing `localStorage` keys keep their shape; Coles prices use the new key `weekdayfuel.v1.colesPrices`: `{at, store: {id, name}, prices: {[id]: {price, was, special, available}}}`.
- Every Coles-derived string inserted into HTML (product and store names, text or attribute) goes through `esc`.
- Messages: page → host `{type: "refreshPrices", stockcodes: [...], colesIds: ["8991361", ...]}`; host → page `{type: "colesPricesDone", at, store: {id, name}, prices}` or `{type: "colesPricesError", message}`. Default failure text: "Couldn't update Coles prices."
- Commit straight to `main` with the prefix `coles:` (release commit: `release: v0.7.0`). After each push CI must be green before the next task.
- There is no local Android SDK: Kotlin compiles and its tests run only in CI. JS tests run locally with `node --test "apps/android/app/src/test/js/*.test.js"` (keep the quotes).
- Nothing in CI talks to Coles or Woolworths.
- Bump the version only in Task 5.
- Do not touch `platra/`, the keystore, `local.properties` or `docs/seed/`. Do not stage anything under `.superpowers/`; stage files by explicit path.

### Watching CI after a push (PowerShell)

```powershell
git push
Start-Sleep 8
$id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'
gh run watch $id -R Evzy/weekday-fuel --exit-status
```

Expected: exits 0. If it fails, read `gh run view $id -R Evzy/weekday-fuel --log-failed`, fix, push again.

## File Structure

| Path | Change |
| --- | --- |
| `apps/android/app/src/main/assets/coles/prices.js` | New: price script injected into coles.com.au |
| `apps/android/app/src/test/js/coles-prices.test.js` | New: tests for the Coles price script |
| `.github/workflows/release-android.yml` | List `coles-prices.test.js` in the JS unit test step |
| `README.md` | Row for `coles/prices.js` |
| `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` | `colesId`, `applyColesPrices`, `colesUnavailable` on rows |
| `apps/android/app/src/test/js/catalogue.test.js`, `catalogue-data.test.js` | Tests for the above |
| `apps/android/app/src/main/assets/weekday_fuel/orders.js`, `apps/android/app/src/test/js/orders.test.js` | "unavailable online at Coles" note |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesUrls.kt` | New: Coles home URL and page check |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesPricesModels.kt` | New: script state and ID parsing |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesSession.kt` | New: hidden Coles WebView that runs the script |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt` | `colesPrices`, `colesPricesFailure` |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt` | Create the session, route `colesIds`, reply, destroy |
| `apps/android/app/src/main/res/values/strings.xml` | `coles_timeout`, `coles_offline`, `coles_bad_request` |
| `apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesPricesJsonTest.kt`, `ColesUrlsTest.kt` | New Kotlin tests |
| `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/HostMessagesTest.kt` | Tests for the Coles messages |
| `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` | Cache, refresh, reply handling, label, Coles specials and unavailable |
| `apps/android/app/build.gradle.kts`, the spec | Task 5 only |

---

### Task 1: Coles price script

**Files:**
- Create: `apps/android/app/src/main/assets/coles/prices.js`
- Create: `apps/android/app/src/test/js/coles-prices.test.js`
- Modify: `.github/workflows/release-android.yml` (the `node --test` line in the "JS unit tests" step)
- Modify: `README.md` (file table, after the `woolworths/prices.js` row)

**Interfaces:**
- Produces: `window.__weekdayFuelColesPrices = { start(ids: string[]): boolean, state(): string }`. `state()` is JSON `{phase: "idle"|"fetching"|"notReady"|"done"|"error", at: string|null, store: {id, name}|null, prices: {[id]: {price, was, special, available}}, error: string|null}`. Used by `ColesSession` (Task 3) via `window.__weekdayFuelColesPrices.start([...])` and `window.__weekdayFuelColesPrices.state()`.

- [ ] **Step 1: Write the failing tests** — `apps/android/app/src/test/js/coles-prices.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/coles/prices.js");

function response(status, body, bad = false) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (bad) throw new SyntaxError("Unexpected token <");
      return body;
    },
  };
}

const R = (id, now, was, extra = {}) => ({ id, availability: true, pricing: { now, was, promotionType: null }, ...extra });
const reply = (results, store = { name: "Coles Local St Kilda" }) => ({ data: { productsInfo: { invalidProducts: [], results }, store } });

function load(handler, page = {}) {
  const calls = [];
  globalThis.window = {
    __RUNTIME_CONFIG__: "config" in page ? page.config : { BFF_API_SUBSCRIPTION_KEY: "k123" },
    __NEXT_DATA__: page.nextData,
  };
  globalThis.document = { cookie: "cookie" in page ? page.cookie : "a=1; fulfillmentStoreId=0668; b=2" };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return handler(url, init);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelColesPrices, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "fetching") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("coles price script did not settle");
}

test("asks for every product and the store in one request and maps price, was, special and availability", async () => {
  const { api, calls } = load(() =>
    response(200, reply([
      R(132045, 2.2, null),
      R(8991361, 3.3, 4.65, { pricing: { now: 3.3, was: 4.65, promotionType: "SPECIAL" } }),
      R(8112799, 9.8, null, { pricing: { now: 9.8, was: null, promotionType: "SPECIAL" } }),
      R(1435100, 8.8, null, { availability: false }),
      { id: 8566038, availability: false, pricing: null },
      R(7214862, 1.74, 1.74),
    ])),
  );
  assert.equal(api.start(["132045", "8991361", "8112799", "1435100", "8566038", "7214862"]), true);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/graphql");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers["Ocp-Apim-Subscription-Key"], "k123");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(calls[0].body.variables, { productIds: ["132045", "8991361", "8112799", "1435100", "8566038", "7214862"], brandedStoreId: "COL:0668" });
  assert.match(calls[0].body.query, /productsInfo\(/);
  assert.match(calls[0].body.query, /store\(id: \$brandedStoreId\)/);
  assert.deepEqual(s.store, { id: "0668", name: "Coles Local St Kilda" });
  assert.deepEqual(s.prices, {
    132045: { price: 2.2, was: null, special: false, available: true },
    8991361: { price: 3.3, was: 4.65, special: true, available: true },
    8112799: { price: 9.8, was: null, special: true, available: true },
    1435100: { price: 8.8, was: null, special: false, available: false },
    8566038: { price: null, was: null, special: false, available: false },
    7214862: { price: 1.74, was: null, special: false, available: true },
  });
  assert.ok(!Number.isNaN(Date.parse(s.at)));
  assert.equal(s.error, null);
});

test("splits long lists into requests of 30 and asks for the store only in the first", async () => {
  const ids = Array.from({ length: 46 }, (_, i) => String(1000000 + i));
  const { api, calls } = load((url, init) => {
    const asked = JSON.parse(init.body).variables.productIds;
    return response(200, reply(asked.map((id) => R(Number(id), 1, null))));
  });
  api.start(ids);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(calls.map((c) => c.body.variables.productIds.length), [30, 16]);
  assert.match(calls[0].body.query, /store\(/);
  assert.doesNotMatch(calls[1].body.query, /store\(/);
  assert.equal(Object.keys(s.prices).length, 46);
});

test("the store comes from initStoreId when the cookie is missing, and a missing store name is null", async () => {
  const { api, calls } = load(() => response(200, reply([R(132045, 2.2, null)], null)), {
    cookie: "a=1",
    nextData: { props: { pageProps: { initStoreId: "0584" } } },
  });
  api.start(["132045"]);
  const s = await settle(api);
  assert.equal(calls[0].body.variables.brandedStoreId, "COL:0584");
  assert.deepEqual(s.store, { id: "0584", name: null });
});

test("without the key or a store the page is not ready and nothing is requested", async () => {
  for (const page of [{ config: undefined }, { config: { BFF_API_SUBSCRIPTION_KEY: "" } }, { cookie: "", nextData: undefined }]) {
    const { api, calls } = load(() => response(200, reply([])), page);
    assert.equal(api.start(["132045"]), true);
    const s = JSON.parse(api.state());
    assert.equal(s.phase, "notReady");
    assert.equal(calls.length, 0);
  }
});

test("HTTP errors, GraphQL errors and unreadable replies end in error with no prices", async () => {
  const cases = [
    [response(401, { statusCode: 401 }), "coles prices HTTP 401"],
    [response(200, { errors: [{ message: "Argument Validation Error" }], data: null }), "coles prices response has no products"],
    [response(200, null, true), "Unexpected token <"],
  ];
  for (const [res, message] of cases) {
    const { api } = load(() => res);
    api.start(["132045"]);
    const s = await settle(api);
    assert.deepEqual([s.phase, s.error, s.prices, s.at, s.store], ["error", message, {}, null, null]);
  }
});

test("a network error ends in error", async () => {
  const { api } = load(() => {
    throw new Error("offline");
  });
  api.start(["132045"]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error], ["error", "offline"]);
});

test("ignores start() while fetching, and can run again after", async () => {
  const { api, calls } = load(() => response(200, reply([R(132045, 2.2, null)])));
  assert.equal(api.start(["132045"]), true);
  assert.equal(api.start(["132045"]), false);
  await settle(api);
  assert.equal(calls.length, 1);
  assert.equal(api.start(["132045"]), true);
  await settle(api);
  assert.equal(calls.length, 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test apps/android/app/src/test/js/coles-prices.test.js`
Expected: FAIL (cannot find module `.../assets/coles/prices.js`).

- [ ] **Step 3: Implement** — `apps/android/app/src/main/assets/coles/prices.js`:

```js
/* Injected into coles.com.au by ColesSession. Reads current prices with the site's own batch product request. */
(function () {
  "use strict";
  if (window.__weekdayFuelColesPrices) return;

  var GRAPHQL_URL = "/api/graphql";
  var CHUNK = 30;
  var PRODUCTS =
    "productsInfo(productIds: $productIds, brandedStoreId: $brandedStoreId) { invalidProducts results { id availability pricing { now was promotionType } } }";
  var QUERY = "query WeekdayFuelPrices($productIds: [String!]!, $brandedStoreId: BrandedId!) { " + PRODUCTS + " }";
  var QUERY_WITH_STORE =
    "query WeekdayFuelPrices($productIds: [String!]!, $brandedStoreId: BrandedId!) { " + PRODUCTS + " store(id: $brandedStoreId) { name } }";
  var state = { phase: "idle", at: null, store: null, prices: {}, error: null };

  function pageKey() {
    var c = window.__RUNTIME_CONFIG__;
    var k = c && c.BFF_API_SUBSCRIPTION_KEY;
    return typeof k === "string" && k ? k : null;
  }

  function pageStore() {
    var m = /(?:^|;\s*)fulfillmentStoreId=(\d+)/.exec(String(document.cookie || ""));
    if (m) return m[1];
    var n = window.__NEXT_DATA__;
    var id = n && n.props && n.props.pageProps && n.props.pageProps.initStoreId;
    return typeof id === "string" && /^\d+$/.test(id) ? id : null;
  }

  function entry(p) {
    var pr = p.pricing;
    var price = pr && typeof pr.now === "number" && pr.now > 0 ? pr.now : null;
    var was = price != null && typeof pr.was === "number" && pr.was > price ? pr.was : null;
    return {
      price: price,
      was: was,
      special: was != null || (!!pr && pr.promotionType === "SPECIAL"),
      available: price != null && p.availability !== false,
    };
  }

  /* Returns the store name when withStore, else undefined. */
  async function fetchChunk(ids, withStore, key, storeId, into) {
    var r = await fetch(GRAPHQL_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Ocp-Apim-Subscription-Key": key },
      body: JSON.stringify({ query: withStore ? QUERY_WITH_STORE : QUERY, variables: { productIds: ids, brandedStoreId: "COL:" + storeId } }),
    });
    if (!r.ok) throw new Error("coles prices HTTP " + r.status);
    var body = await r.json();
    var info = body && body.data && body.data.productsInfo;
    if (!info || !Array.isArray(info.results)) throw new Error("coles prices response has no products");
    info.results.forEach(function (p) {
      if (p && (typeof p.id === "number" || typeof p.id === "string")) into[String(p.id)] = entry(p);
    });
    if (!withStore) return undefined;
    var s = body.data.store;
    return s && typeof s.name === "string" && s.name ? s.name : null;
  }

  async function run(ids, key, storeId) {
    state = { phase: "fetching", at: null, store: null, prices: {}, error: null };
    var prices = {};
    var name = null;
    try {
      for (var i = 0; i < ids.length; i += CHUNK) {
        var got = await fetchChunk(ids.slice(i, i + CHUNK), i === 0, key, storeId, prices);
        if (i === 0) name = got;
      }
      state = { phase: "done", at: new Date().toISOString(), store: { id: storeId, name: name }, prices: prices, error: null };
    } catch (e) {
      state = { phase: "error", at: null, store: null, prices: {}, error: String((e && e.message) || e) };
    }
  }

  window.__weekdayFuelColesPrices = {
    start: function (ids) {
      if (state.phase === "fetching") return false;
      var key = pageKey();
      var storeId = pageStore();
      if (!key || !storeId) {
        state = { phase: "notReady", at: null, store: null, prices: {}, error: null };
        return true;
      }
      run(ids, key, storeId);
      return true;
    },
    state: function () { return JSON.stringify(state); },
  };
})();
```

- [ ] **Step 4: Run the tests**

Run: `node --test apps/android/app/src/test/js/coles-prices.test.js` → all 7 pass. Then `node --test "apps/android/app/src/test/js/*.test.js"` → all pass (92 before this task, 99 after).

- [ ] **Step 5: CI list and README**

In `.github/workflows/release-android.yml`, append ` apps/android/app/src/test/js/coles-prices.test.js` to the end of the existing `node --test ...` line (after `orders.test.js`).

In `README.md`, after the row for `apps/android/app/src/main/assets/woolworths/prices.js`, add:

```markdown
| `apps/android/app/src/main/assets/coles/prices.js` | Script that reads live Coles prices |
```

- [ ] **Step 6: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/coles/prices.js apps/android/app/src/test/js/coles-prices.test.js .github/workflows/release-android.yml README.md
git commit -m "coles: price script reads current Coles prices with the site's batch product request"
```

Then push and watch CI (Global Constraints).

---

### Task 2: Catalogue and orders use live Coles prices

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/catalogue.js` (after `applyLivePrices` ~line 292; `shopList` row object ~line 350; exports ~line 424)
- Modify: `apps/android/app/src/test/js/catalogue.test.js` (fixture URLs lines 9–22; new tests)
- Modify: `apps/android/app/src/test/js/catalogue-data.test.js` (`checkProduct`)
- Modify: `apps/android/app/src/main/assets/weekday_fuel/orders.js` (buy note ~line 80)
- Modify: `apps/android/app/src/test/js/orders.test.js` (new test)

**Interfaces:**
- Produces: `WeekdayFuelCatalogue.colesId(product) -> string|null`; `WeekdayFuelCatalogue.applyColesPrices(items, prices) -> items` (prices keyed by Coles product ID string, values `{price, was, special, available}`); `shopList` rows gain `colesUnavailable` (catalogue Coles product or null); items may carry `colesUnavailable`. Used by the page in Task 4.

- [ ] **Step 1: Give the catalogue test fixtures real-shaped Coles IDs.** In `catalogue.test.js` change only these URL suffixes: `C + "dare-1"` → `C + "dare-8991361"`, `C + "breast-large-2"` → `C + "breast-large-2263179"`, `C + "breast-small-3"` → `C + "breast-small-2263168"`, `C + "cheese-4"` → `C + "cheese-8145346"`, `C + "evap-5"` → `C + "evap-1234567"`. Change the require on line 3 to:

```js
const { create, deliGrams, applyLivePrices, applyColesPrices, colesId } = require("../../main/assets/weekday_fuel/catalogue.js");
```

- [ ] **Step 2: Write the failing tests.** Append to `catalogue.test.js`:

```js
test("colesId is the 4 to 7 digit number at the end of a Coles product URL", () => {
  assert.equal(colesId({ url: C + "dare-8991361" }), "8991361");
  assert.equal(colesId({ url: C + "abbott's-bakery-farmhouse-wholemeal-bread-750g-7226034" }), "7226034");
  assert.equal(colesId({ url: C + "dare" }), null);
  assert.equal(colesId({ url: C + "x-12" }), null);
  assert.equal(colesId({}), null);
  assert.equal(colesId(null), null);
});

test("live Coles prices replace catalogue prices, with was-prices for specials", () => {
  const live = applyColesPrices(ITEMS, {
    8145346: { price: 6, was: 7.5, special: true, available: true },
    8991361: { price: 5.5, was: 5.5, special: false, available: true },
  });
  const cheese = live.find((i) => i.id === "cheese");
  assert.deepEqual([cheese.coles.price, cheese.coles.was, cheese.coles.live, cheese.coles.name], [6, 7.5, true, "Coles Light Tasty 500g"]);
  assert.equal(cheese.woolies, ITEMS[3].woolies);
  assert.equal(ITEMS[3].coles.price, 7.5);
  assert.equal(live.find((i) => i.id === "dare").coles.was, null);
  assert.equal(live.find((i) => i.id === "evap"), ITEMS[4]);
  assert.equal(live.find((i) => i.id === "ham"), ITEMS[2]);
  assert.equal(byId(create(live, AMOUNTS).shopList({ toasty: 1 }, 0)).cheese.coles.cost, 6);
});

test("no Coles prices, a product left out, or no price keeps the catalogue item", () => {
  assert.deepEqual(applyColesPrices(ITEMS, null), ITEMS);
  const live = applyColesPrices(ITEMS, { 8145346: { price: null, was: null, special: false, available: true } });
  assert.equal(live.find((i) => i.id === "cheese"), ITEMS[3]);
  assert.equal(live.find((i) => i.id === "breast"), ITEMS[1]);
});

test("a Coles product unavailable online counts as missed at Coles", () => {
  const live = applyColesPrices(ITEMS, { 8145346: { price: 7.5, was: null, special: false, available: false } });
  const cheese = live.find((i) => i.id === "cheese");
  assert.equal(cheese.coles, null);
  assert.equal(cheese.colesUnavailable.name, "Coles Light Tasty 500g");
  const c = create(live, AMOUNTS);
  const rows = c.shopList({ toasty: 1 }, 0);
  assert.equal(byId(rows).cheese.coles, null);
  assert.equal(byId(rows).cheese.colesUnavailable.name, "Coles Light Tasty 500g");
  assert.equal(byId(rows).ham.colesUnavailable, null);
  assert.deepEqual(c.storeTotals(rows, "coles", {}).missed, ["ham", "cheese"]);
});

test("an unavailable large Coles pack falls back to the small pack, and an unavailable small pack is dropped", () => {
  const large = applyColesPrices(ITEMS, { 2263179: { price: 16.8, was: null, special: false, available: false } });
  const b1 = large.find((i) => i.id === "breast");
  assert.equal(b1.coles.name, "Coles Chicken Breast Small");
  assert.equal(b1.coles.small, undefined);
  assert.equal(b1.colesUnavailable, undefined);
  const row1 = byId(create(large, AMOUNTS).shopList({ tenderwrap: 4 }, 0)).breast;
  assert.deepEqual([row1.coles.product.name, row1.coles.quantity], ["Coles Chicken Breast Small", 2]);

  const small = applyColesPrices(ITEMS, { 2263168: { price: 7.2, was: null, special: false, available: false } });
  const b2 = small.find((i) => i.id === "breast");
  assert.equal(b2.coles.name, "Coles Chicken Breast Large");
  assert.equal(b2.coles.small, undefined);
  assert.equal(ITEMS[1].coles.small.name, "Coles Chicken Breast Small");
  assert.equal(byId(create(small, AMOUNTS).shopList({ tenderwrap: 1 }, 0)).breast.coles.product.name, "Coles Chicken Breast Large");

  const both = applyColesPrices(ITEMS, {
    2263179: { price: 15, was: null, special: false, available: true },
    2263168: { price: 7, was: 8, special: true, available: true },
  });
  const b3 = both.find((i) => i.id === "breast");
  assert.deepEqual([b3.coles.price, b3.coles.live, b3.coles.small.price, b3.coles.small.was, b3.coles.small.live], [15, true, 7, 8, true]);
});
```

In `catalogue-data.test.js`, inside `checkProduct`, after the `woolies` stockcode line add:

```js
  if (store === "coles") assert.ok(cat.colesId(p), where + " has a Coles product id at the end of its url");
```

Append to `orders.test.js`:

```js
test("in a Coles shop an item unavailable online at Coles is noted", () => {
  const gone = ROW("milk", 1, LINE(P(200, "Milk 2L", 3.1), 1, 3.1, "1 bottle"), null, { colesUnavailable: { name: "Coles milk", price: 3 } });
  const o = O.snapshot([gone], {}, {}, { at: OPTS.at, store: "coles" });
  assert.deepEqual(o.groups.buy, [item("Milk 2L", "1 bottle", 3.1, "woolies", "unavailable online at Coles", "")]);
  const w = O.snapshot([gone], {}, {}, { at: OPTS.at, store: "woolies" });
  assert.deepEqual(w.groups.buy, [item("Milk 2L", "1 bottle", 3.1, "woolies", null, "")]);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test "apps/android/app/src/test/js/*.test.js"`
Expected: FAIL (`colesId is not a function`, `applyColesPrices is not a function`, the orders note test).

- [ ] **Step 4: Implement.** In `catalogue.js`, after `applyLivePrices`:

```js
  function colesId(product) {
    var m = product && typeof product.url === "string" && /-(\d{4,7})$/.exec(product.url);
    return m ? m[1] : null;
  }

  function liveColes(p, live) {
    if (!(typeof live.price === "number" && live.price > 0)) return p;
    var was = typeof live.was === "number" && live.was > live.price ? live.was : null;
    return Object.assign({}, p, { price: live.price, was: was, live: true });
  }

  /* prices: { [Coles product id]: { price, was, special, available } } read live from Coles. */
  function applyColesPrices(items, prices) {
    if (!prices) return items;
    return items.map(function (it) {
      var p = it.coles;
      if (!p) return it;
      var live = prices[colesId(p)];
      var small = p.small || null;
      var liveSmall = small && prices[colesId(small)];
      if (small && liveSmall) small = liveSmall.available === false ? null : liveColes(small, liveSmall);
      if (live && live.available === false) {
        if (small) return Object.assign({}, it, { coles: small });
        return Object.assign({}, it, { coles: null, colesUnavailable: p });
      }
      var main = live ? liveColes(p, live) : p;
      if (small !== (p.small || null)) {
        main = Object.assign({}, main);
        if (small) main.small = small;
        else delete main.small;
      }
      return main === p ? it : Object.assign({}, it, { coles: main });
    });
  }
```

In `shopList`'s row object, after `wooliesUnavailable: it.wooliesUnavailable || null,` add:

```js
            colesUnavailable: it.colesUnavailable || null,
```

At the exports, after `api.applyLivePrices = applyLivePrices;` add:

```js
  api.applyColesPrices = applyColesPrices;
  api.colesId = colesId;
```

In `orders.js`, change:

```js
        else if (gone && store === "woolies") it.note = "unavailable online at Woolworths";
```

to:

```js
        else if (gone && store === "woolies") it.note = "unavailable online at Woolworths";
        else if (row.colesUnavailable && store === "coles") it.note = "unavailable online at Coles";
```

- [ ] **Step 5: Run the tests**

Run: `node --test "apps/android/app/src/test/js/*.test.js"` → all pass (105).

- [ ] **Step 6: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/catalogue.js apps/android/app/src/test/js/catalogue.test.js apps/android/app/src/test/js/catalogue-data.test.js apps/android/app/src/main/assets/weekday_fuel/orders.js apps/android/app/src/test/js/orders.test.js
git commit -m "coles: catalogue applies live Coles prices, specials and unavailable packs; orders note Coles-unavailable items"
```

Then push and watch CI.

---

### Task 3: Host runs the Coles price script (Kotlin)

**Files:**
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesUrls.kt`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesPricesModels.kt`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesSession.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt`
- Modify: `apps/android/app/src/main/res/values/strings.xml`
- Create: `apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesPricesJsonTest.kt`, `ColesUrlsTest.kt`
- Modify: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/HostMessagesTest.kt`

**Interfaces:**
- Consumes: `assets/coles/prices.js` from Task 1 (`window.__weekdayFuelColesPrices.start(ids)`, `.state()`).
- Produces: the host replies `colesPricesDone` / `colesPricesError` (Global Constraints) to `refreshPrices` messages that carry `colesIds`. Used by the page in Task 4.

- [ ] **Step 1: Write the failing Kotlin tests.**

`apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesUrlsTest.kt`:

```kotlin
package dev.weekdayfuel.app.coles

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ColesUrlsTest {
    @Test
    fun onlyHttpsColesShopHostIsAColesPage() {
        assertTrue(ColesUrls.isColesPage("https", "www.coles.com.au"))
        assertFalse(ColesUrls.isColesPage("http", "www.coles.com.au"))
        assertFalse(ColesUrls.isColesPage("https", "coles.com.au"))
        assertFalse(ColesUrls.isColesPage("https", "www.coles.com.au.evil.example"))
        assertFalse(ColesUrls.isColesPage("https", null))
    }
}
```

`apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesPricesJsonTest.kt`:

```kotlin
package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ColesPricesJsonTest {
    @Test
    fun missingScriptGivesNull() {
        assertNull(ColesPricesJson.parseScriptState(null))
        assertNull(ColesPricesJson.parseScriptState("null"))
    }

    @Test
    fun parsesDoneStateWithStoreAndPrices() {
        val raw =
            """{"phase":"done","at":"2026-10-15T09:40:00.000Z","store":{"id":"0668","name":"Coles Local St Kilda"},"prices":{"8991361":{"price":3.3,"was":4.65,"special":true,"available":true}},"error":null}"""
        val state = ColesPricesJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(ColesPricesPhase.DONE, state.phase)
        assertEquals("2026-10-15T09:40:00.000Z", state.at)
        assertEquals("Coles Local St Kilda", state.store!!.getString("name"))
        assertEquals(4.65, state.prices.getJSONObject("8991361").getDouble("was"), 0.0)
        assertNull(state.error)
    }

    @Test
    fun parsesFetchingNotReadyAndError() {
        val fetching = ColesPricesJson.parseScriptState(JSONObject.quote("""{"phase":"fetching","at":null,"store":null,"prices":{},"error":null}"""))!!
        assertEquals(ColesPricesPhase.FETCHING, fetching.phase)
        assertNull(fetching.store)
        val notReady = ColesPricesJson.parseScriptState(JSONObject.quote("""{"phase":"notReady","at":null,"store":null,"prices":{},"error":null}"""))!!
        assertEquals(ColesPricesPhase.NOT_READY, notReady.phase)
        val error = ColesPricesJson.parseScriptState(JSONObject.quote("""{"phase":"error","at":null,"store":null,"prices":{},"error":"coles prices HTTP 401"}"""))!!
        assertEquals(ColesPricesPhase.ERROR, error.phase)
        assertEquals("coles prices HTTP 401", error.error)
    }

    @Test
    fun parseIdsKeepsUniqueDigitStrings() {
        assertEquals(listOf("8991361", "132045"), ColesPricesJson.parseIds(JSONArray("""["8991361","132045","8991361"]""")))
        assertEquals(emptyList<String>(), ColesPricesJson.parseIds(JSONArray("[]")))
    }

    @Test
    fun parseIdsRejectsAnythingElse() {
        assertNull(ColesPricesJson.parseIds(JSONArray("""["8991361",132045]""")))
        assertNull(ColesPricesJson.parseIds(JSONArray("""["12"]""")))
        assertNull(ColesPricesJson.parseIds(JSONArray("""["12345678"]""")))
        assertNull(ColesPricesJson.parseIds(JSONArray("""["8991361\"]);alert(1);//"]""")))
    }

    @Test
    fun idsToJsonIsAPlainArrayOfStrings() {
        assertEquals("""["8991361","132045"]""", ColesPricesJson.idsToJson(listOf("8991361", "132045")))
    }
}
```

Append to `HostMessagesTest.kt` (inside the class; add `import dev.weekdayfuel.app.coles.ColesPricesPhase` and `import dev.weekdayfuel.app.coles.ColesPricesState` to the imports):

```kotlin
    @Test
    fun colesPricesDoneCarriesTimeStoreAndPrices() {
        val prices = JSONObject().put("8991361", JSONObject().put("price", 3.3))
        val store = JSONObject().put("id", "0668").put("name", "Coles Local St Kilda")
        val json = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.DONE, "2026-10-15T09:40:00.000Z", store, prices, null)))
        assertEquals("colesPricesDone", json.getString("type"))
        assertEquals("2026-10-15T09:40:00.000Z", json.getString("at"))
        assertEquals("Coles Local St Kilda", json.getJSONObject("store").getString("name"))
        assertEquals(3.3, json.getJSONObject("prices").getJSONObject("8991361").getDouble("price"), 0.0)
    }

    @Test
    fun colesPricesErrorCarriesMessageOrDefault() {
        val json = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.ERROR, null, null, JSONObject(), "coles prices HTTP 401")))
        assertEquals("colesPricesError", json.getString("type"))
        assertEquals("coles prices HTTP 401", json.getString("message"))
        val fallback = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.ERROR, null, null, JSONObject(), null)))
        assertEquals("Couldn't update Coles prices.", fallback.getString("message"))
    }
```

(There is no local Android SDK, so these run in CI only; Step 3's CI run is the check.)

- [ ] **Step 2: Implement the models, URLs and messages.**

`apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesUrls.kt`:

```kotlin
package dev.weekdayfuel.app.coles

object ColesUrls {
    const val HOME_URL = "https://www.coles.com.au/"
    const val SHOP_HOST = "www.coles.com.au"

    fun isColesPage(scheme: String?, host: String?): Boolean = scheme == "https" && host == SHOP_HOST
}
```

`apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesPricesModels.kt`:

```kotlin
package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

enum class ColesPricesPhase { IDLE, FETCHING, NOT_READY, DONE, ERROR }

/** [prices] is the script's `{ "<id>": {price, was, special, available} }` object and [store] its `{id, name}`, passed to the page as they are. */
data class ColesPricesState(val phase: ColesPricesPhase, val at: String?, val store: JSONObject?, val prices: JSONObject, val error: String?)

object ColesPricesJson {
    private val ID = Regex("^\\d{4,7}$")

    /** Null when any entry is not a string of 4 to 7 digits; the IDs go into injected script, so nothing else is let through. */
    fun parseIds(ids: JSONArray): List<String>? {
        val out = mutableListOf<String>()
        for (i in 0 until ids.length()) {
            val v = ids.opt(i) as? String ?: return null
            if (!ID.matches(v)) return null
            out += v
        }
        return out.distinct()
    }

    fun idsToJson(ids: List<String>): String = JSONArray().apply { ids.forEach { put(it) } }.toString()

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelColesPrices.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): ColesPricesState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        return ColesPricesState(
            phase =
                when (o.optString("phase")) {
                    "fetching" -> ColesPricesPhase.FETCHING
                    "notReady" -> ColesPricesPhase.NOT_READY
                    "done" -> ColesPricesPhase.DONE
                    "error" -> ColesPricesPhase.ERROR
                    else -> ColesPricesPhase.IDLE
                },
            at = if (o.isNull("at")) null else o.optString("at"),
            store = o.optJSONObject("store"),
            prices = o.optJSONObject("prices") ?: JSONObject(),
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
```

In `HostMessages.kt` add the import `import dev.weekdayfuel.app.coles.ColesPricesPhase` and `import dev.weekdayfuel.app.coles.ColesPricesState`, the constant `private const val COLES_PRICES_FAILURE = "Couldn't update Coles prices."` next to `PRICES_FAILURE`, and after `pricesFailure`:

```kotlin
    fun colesPrices(state: ColesPricesState): String {
        if (state.phase != ColesPricesPhase.DONE) return colesPricesFailure(state.error ?: COLES_PRICES_FAILURE)
        return JSONObject()
            .put("type", "colesPricesDone")
            .put("at", state.at ?: JSONObject.NULL)
            .put("store", state.store ?: JSONObject.NULL)
            .put("prices", state.prices)
            .toString()
    }

    fun colesPricesFailure(message: String): String = JSONObject().put("type", "colesPricesError").put("message", message).toString()
```

In `strings.xml`, after the `woolworths_checkout_bad_change` string:

```xml
    <string name="coles_timeout">Coles took too long to respond. Try again.</string>
    <string name="coles_offline">Couldn\'t reach Coles. Check your connection and try again.</string>
    <string name="coles_bad_request">Couldn\'t read the Coles products to price. Try again.</string>
```

- [ ] **Step 3: Implement the session** — `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesSession.kt`:

```kotlin
package dev.weekdayfuel.app.coles

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import dev.weekdayfuel.app.R
import org.json.JSONObject

/** Owns a coles.com.au WebView that is never shown, and reads Coles prices in it. No JavaScript bridge. */
@SuppressLint("SetJavaScriptEnabled")
class ColesSession(private val context: Context, private val openExternal: (Uri) -> Unit) {
    interface Listener {
        /** Phase is [ColesPricesPhase.DONE] or [ColesPricesPhase.ERROR]. */
        fun onColesPrices(state: ColesPricesState)
    }

    var listener: Listener? = null

    private val handler = Handler(Looper.getMainLooper())
    private val script: String by lazy {
        context.assets.open(SCRIPT_ASSET).bufferedReader().use { it.readText() }
    }
    private var pending: List<String>? = null
    private var polling = false
    private var pageLoading = false
    private var needsFreshPage = false
    private val poller = Runnable { poll() }
    private val retry = Runnable { if (pending != null && !polling && !pageLoading) start() }
    private val watchdog =
        Runnable {
            // A hung request leaves the script "fetching", which refuses start(); reload the page before the next refresh.
            needsFreshPage = true
            fail(context.getString(R.string.coles_timeout))
        }

    val webView: WebView =
        WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webViewClient = SessionClient()
        }

    private fun onColesPage(): Boolean =
        webView.url?.let(Uri::parse)?.let { ColesUrls.isColesPage(it.scheme, it.host) } == true

    fun refreshPrices(ids: List<String>) {
        pending = ids
        polling = false
        handler.removeCallbacks(poller)
        handler.removeCallbacks(retry)
        handler.removeCallbacks(watchdog)
        handler.postDelayed(watchdog, TIMEOUT_MS)
        when {
            needsFreshPage || !onColesPage() -> webView.loadUrl(ColesUrls.HOME_URL)
            !pageLoading -> start()
        }
    }

    fun cancel() {
        pending = null
        polling = false
        handler.removeCallbacks(poller)
        handler.removeCallbacks(retry)
        handler.removeCallbacks(watchdog)
    }

    fun destroy() {
        cancel()
        webView.destroy()
    }

    private fun start() {
        val ids = pending ?: return
        if (pageLoading || !onColesPage()) return
        handler.removeCallbacks(poller)
        handler.removeCallbacks(retry)
        polling = true
        webView.evaluateJavascript("$script\nwindow.__weekdayFuelColesPrices.start(${ColesPricesJson.idsToJson(ids)});", null)
        handler.postDelayed(poller, POLL_MS)
    }

    private fun poll() {
        if (!polling) return
        webView.evaluateJavascript(STATE_EXPRESSION) { result ->
            if (!polling) return@evaluateJavascript
            val state = runCatching { ColesPricesJson.parseScriptState(result) }.getOrNull()
            when (state?.phase) {
                null -> {
                    // A new document dropped the script; onPageFinished or this restarts it.
                    polling = false
                    if (!pageLoading) start()
                }
                ColesPricesPhase.NOT_READY -> {
                    // No key or store yet (e.g. a check page); try again shortly, until the watchdog gives up.
                    polling = false
                    handler.postDelayed(retry, RETRY_MS)
                }
                ColesPricesPhase.IDLE, ColesPricesPhase.FETCHING -> handler.postDelayed(poller, POLL_MS)
                ColesPricesPhase.DONE, ColesPricesPhase.ERROR -> {
                    cancel()
                    listener?.onColesPrices(state)
                }
            }
        }
    }

    private fun fail(message: String) {
        if (pending == null) return
        cancel()
        listener?.onColesPrices(ColesPricesState(ColesPricesPhase.ERROR, null, null, JSONObject(), message))
    }

    private inner class SessionClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val scheme = request.url.scheme
            if (scheme == "http" || scheme == "https") return false
            openExternal(request.url)
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            pageLoading = true
            needsFreshPage = false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            pageLoading = false
            val coles = url?.let(Uri::parse)?.let { ColesUrls.isColesPage(it.scheme, it.host) } == true
            if (pending != null && !polling && coles) start()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                needsFreshPage = true
                fail(context.getString(R.string.coles_offline))
            }
        }
    }

    private companion object {
        const val SCRIPT_ASSET = "coles/prices.js"
        const val STATE_EXPRESSION = "window.__weekdayFuelColesPrices ? window.__weekdayFuelColesPrices.state() : null"
        const val POLL_MS = 300L
        const val RETRY_MS = 1_000L
        const val TIMEOUT_MS = 30_000L
    }
}
```

- [ ] **Step 4: Wire it into `MainActivity.kt`.**
  - Imports: `android.view.View`, `dev.weekdayfuel.app.coles.ColesPricesJson`, `dev.weekdayfuel.app.coles.ColesPricesState`, `dev.weekdayfuel.app.coles.ColesSession`.
  - Field: `private lateinit var coles: ColesSession` next to `woolworths`.
  - In `onCreate`, right after `woolworths.listener = TrolleyListener()`:

```kotlin
        coles = ColesSession(this, ::openExternally)
        coles.listener = ColesListener()
        // Kept full size underneath everything (like the Woolworths page behind the app) so the page runs normally; never shown.
        coles.webView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        root.addView(coles.webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
```

  This must come before `root.addView(woolworthsScreen.view, ...)` so the Coles page sits at the bottom of the stack.
  - In `onDestroy`, before `woolworths.webView.destroy()`: `coles.destroy()`.
  - Replace the `"refreshPrices"` branch of `onHostMessage` with:

```kotlin
            "refreshPrices" -> {
                val codes = runCatching { PricesJson.parseStockcodes(msg.optJSONArray("stockcodes") ?: JSONArray()) }.getOrNull()
                val colesArray = msg.optJSONArray("colesIds")
                val colesIds = colesArray?.let { runCatching { ColesPricesJson.parseIds(it) }.getOrNull() }
                // The page waits for a Coles reply whenever it sent colesIds, so an unusable list still gets one.
                if (colesArray != null && colesIds.isNullOrEmpty()) replyToPage(HostMessages.colesPricesFailure(getString(R.string.coles_bad_request)))
                if (!colesIds.isNullOrEmpty()) coles.refreshPrices(colesIds)
                if (codes.isNullOrEmpty()) {
                    if (colesArray == null) replyToPage(HostMessages.pricesFailure(getString(R.string.woolworths_bad_request)))
                    return
                }
                woolworths.refreshPrices(codes)
            }
```

  (A request with no usable stockcodes but Coles IDs runs only Coles; with neither, the old Woolworths error is sent.)
  - Add an inner listener after `TrolleyListener`:

```kotlin
    private inner class ColesListener : ColesSession.Listener {
        override fun onColesPrices(state: ColesPricesState) {
            replyToPage(HostMessages.colesPrices(state))
        }
    }
```

- [ ] **Step 5: Run the JS tests, commit, push, watch CI** (CI compiles Kotlin and runs the new tests)

Run: `node --test "apps/android/app/src/test/js/*.test.js"` → all pass (no JS change).

```powershell
git add apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesUrls.kt apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesPricesModels.kt apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesSession.kt apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt apps/android/app/src/main/res/values/strings.xml apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesPricesJsonTest.kt apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesUrlsTest.kt apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/HostMessagesTest.kt
git commit -m "coles: host reads Coles prices in a hidden Coles page and replies colesPricesDone or colesPricesError"
```

Then push and watch CI. If CI fails on Kotlin, read the log, fix, and push again.

---

### Task 4: Shop shows live Coles prices

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: `WeekdayFuelCatalogue.applyColesPrices`, `WeekdayFuelCatalogue.colesId`, rows' `colesUnavailable` (Task 2); host messages `colesPricesDone` / `colesPricesError` (Task 3).

- [ ] **Step 1: Cache and catalogue.** Replace the `livePrices`/`buildCat` lines (~358–360) so they read:

```js
const PRICES_KEY="weekdayfuel.v1.prices",COLES_PRICES_KEY="weekdayfuel.v1.colesPrices",LIVE_MAX_AGE=12*3600e3;
function readPrices(key){try{const c=JSON.parse(localStorage.getItem(key)||"null");return c&&typeof c.at==="string"&&c.prices&&typeof c.prices==="object"?c:null}catch(e){return null}}
const livePrices=()=>readPrices(PRICES_KEY),colesPrices=()=>readPrices(COLES_PRICES_KEY);
function buildCat(){const W=WeekdayFuelCatalogue,lp=livePrices(),cp=colesPrices();let items=W.ITEMS;if(lp)items=W.applyLivePrices(items,lp.prices);if(cp)items=W.applyColesPrices(items,cp.prices);return W.create(items,W.AMOUNTS)}
```

Add `colesPrices:null` to the `state` object (next to `prices:null`).

- [ ] **Step 2: Refresh and replies.** Replace `refreshPrices`, `maybeRefreshPrices` and `onPrices` (~578–592) with:

```js
/* state.prices / state.colesPrices: null, "busy" or "error" */
function colesIds(){const W=WeekdayFuelCatalogue,ids=[];W.ITEMS.forEach(i=>{if(!i.coles)return;[i.coles,i.coles.small].forEach(p=>{const id=p&&W.colesId(p);if(id&&ids.indexOf(id)<0)ids.push(id)})});return ids}
function refreshPrices(){
  if(!window.WeekdayFuelHost||state.prices==="busy"||state.colesPrices==="busy")return;
  state.prices="busy";state.colesPrices="busy";state.pricesTried=Date.now();
  WeekdayFuelHost.postMessage(JSON.stringify({type:"refreshPrices",stockcodes:WeekdayFuelCatalogue.ITEMS.filter(i=>i.woolies).map(i=>i.woolies.stockcode),colesIds:colesIds()}));
}
function maybeRefreshPrices(){
  const fresh=c=>c&&Date.now()-Date.parse(c.at)<=LIVE_MAX_AGE;
  if(!(fresh(livePrices())&&fresh(colesPrices()))&&!(state.pricesTried&&Date.now()-state.pricesTried<LIVE_MAX_AGE))refreshPrices();
}
function onPrices(m){
  if(m.type==="pricesDone"&&typeof m.at==="string"&&m.prices&&typeof m.prices==="object"){
    const old=livePrices();
    try{localStorage.setItem(PRICES_KEY,JSON.stringify({at:m.at,prices:Object.assign({},old&&old.prices,m.prices)}))}catch(e){}
    CAT=buildCat();state.prices=null;
  }else state.prices="error";
}
function onColesPrices(m){
  if(m.type==="colesPricesDone"&&typeof m.at==="string"&&m.prices&&typeof m.prices==="object"){
    const old=colesPrices(),s=m.store&&typeof m.store==="object"?m.store:{};
    const store={id:typeof s.id==="string"?s.id:null,name:typeof s.name==="string"&&s.name?s.name:null};
    try{localStorage.setItem(COLES_PRICES_KEY,JSON.stringify({at:m.at,store,prices:Object.assign({},old&&old.prices,m.prices)}))}catch(e){}
    CAT=buildCat();state.colesPrices=null;
  }else state.colesPrices="error";
}
```

In the host message listener, after the `pricesDone`/`pricesError` line add:

```js
    if(m.type==="colesPricesDone"||m.type==="colesPricesError"){onColesPrices(m);if(state.tab==="shop")render();return}
```

- [ ] **Step 3: Price label.** Replace `priceLabel` with:

```js
function priceLabel(){
  const time=d=>d.toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"});
  const from=c=>{const t=c&&new Date(c.at);return t&&!isNaN(t)?"from "+(iso(t)===iso(new Date())?time(t)+" today":fmtShort(iso(t))+" "+time(t)):null};
  const lp=livePrices(),cp=colesPrices(),cf=from(cp);
  const c=cf?cf+(cp.store&&cp.store.name?` (${esc(cp.store.name)})`:""):"checked "+fmtShort(CAT.checked("coles"));
  let h=`Coles prices ${c} · Woolworths prices ${from(lp)||"checked "+fmtShort(CAT.checked("woolies"))}.`;
  if(window.WeekdayFuelHost)h+=state.prices==="busy"||state.colesPrices==="busy"?` Updating prices…`:` <button class="ghost" data-act="refreshprices">Refresh prices</button>`;
  if(state.colesPrices==="error")h+=`<span style="display:block;color:var(--bad)">Couldn't update Coles prices</span>`;
  if(state.prices==="error")h+=`<span style="display:block;color:var(--bad)">Couldn't update Woolworths prices</span>`;
  return h;
}
```

- [ ] **Step 4: Coles specials and unavailable products.** Replace `noProduct` (~848) with:

```js
const unavailable=(it,s)=>s==="woolies"?it.wooliesUnavailable:it.colesUnavailable;
const noProduct=(it,s)=>unavailable(it,s)?esc(unavailable(it,s).name)+" · unavailable online now":"Not at "+STORE_NAME[s];
```

In `productsBlock`, change `storePrice(s,prices[s])+(s==="woolies"?wasNote(pr.woolies):"")` to `storePrice(s,prices[s])+wasNote(pr[s])`, and `${s==="woolies"?wasNote(pr[s]):""}` to `${wasNote(pr[s])}`.

In `productLinks`, change `const p=pr[s]||(s==="woolies"&&it.wooliesUnavailable);` to `const p=pr[s]||unavailable(it,s);`.

In the "Missed at" panel (~995), replace `miss.some(r=>r.wooliesUnavailable)&&st==="woolies"` with `miss.some(r=>unavailable(r,st))`, and `${st==="woolies"&&r.wooliesUnavailable?` <span class="muted">· instead of ${esc(r.wooliesUnavailable.name)}, unavailable online now</span>`:""}` with `${unavailable(r,st)?` <span class="muted">· instead of ${esc(unavailable(r,st).name)}, unavailable online now</span>`:""}`.

- [ ] **Step 5: Checks**

Run: `node --test "apps/android/app/src/test/js/*.test.js"` → all pass. Extract and syntax-check the inline script:

```powershell
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

Expected: no output, exit 0.

- [ ] **Step 6: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "coles: Shop refreshes and shows live Coles prices, specials, unavailable items and the Coles store"
```

Then push and watch CI.

- [ ] **Step 7 (controller): browser check with a fake host.** Serve `apps/android/app/src/main/assets` on port 8123, inject a fake `WeekdayFuelHost` before `catalogue.js`, open Shop → Build a shop with the starter shop and check:
  - Opening Shop posts one `refreshPrices` with `stockcodes` and 46 `colesIds` (all digit strings); the label shows "Updating prices…".
  - Reply `colesPricesDone` with store `{id: "0668", name: "Coles Local St Kilda"}`, Dare `8991361` at 3.3 was 4.65, yoghurt `1435100` unavailable: label "Coles prices from <time> today (Coles Local St Kilda)"; Dare row shows Coles $3.30 and "Special, was $4.65"; with the store on Coles, yoghurt is in "Missed at Coles" as "unavailable online now"; the Coles total changes. The cache key `weekdayfuel.v1.colesPrices` holds the reply; reload keeps it.
  - Then reply `pricesDone` (Woolworths): the Refresh button returns.
  - Refresh, then `colesPricesError` + `pricesDone`: only "Couldn't update Coles prices" shows; Coles prices stay from the last reply.
  - A store name `<img src=x onerror=alert(1)>` renders as text.
  - Past orders: in a Coles shop save, the yoghurt sits in Buy yourself with "unavailable online at Coles".

---

### Task 5: Release v0.7.0

**Files:**
- Modify: `apps/android/app/build.gradle.kts` (`versionCode`, `versionName`)
- Modify: `docs/superpowers/specs/2026-10-15-coles-prices-design.md` (status line)

- [ ] **Step 1:** In `build.gradle.kts` change `versionCode = 11` to `versionCode = 12` and `versionName = "0.6.0"` to `versionName = "0.7.0"`.
- [ ] **Step 2:** In the spec, change `**Status:** approved 2026-10-15` to `**Status:** approved 2026-10-15; v0.7.0 released 2026-10-15, owner phone checks pending`.
- [ ] **Step 3: Commit, push, watch CI**

```powershell
git add apps/android/app/build.gradle.kts docs/superpowers/specs/2026-10-15-coles-prices-design.md
git commit -m "release: v0.7.0"
```

Push and watch CI, then check the release:

```powershell
gh release view v0.7.0 -R Evzy/weekday-fuel-releases --json tagName,assets --jq '.tagName, .assets[].name'
```

Expected: `v0.7.0` and `WeekdayFuel-v0.7.0-debug.apk`.
