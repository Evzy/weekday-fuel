# Coles Trolley Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-16-coles-trolley-design.md`](../specs/2026-10-16-coles-trolley-design.md) (read its Research section: the request shapes there are verified on the owner's account).

**Goal:** With Coles picked in Build a shop, "Send to Coles trolley" sets the owner's Coles trolley to what's left to buy (and takes out what the last send put in that the shop no longer needs), with login and checkout in an in-app Coles screen, and saved orders list the sent items under "Ordered on Coles".

**Architecture:** A new injected script `assets/coles/trolley.js` reads the Coles trolley (`GET /api/bff/trolley/store/<store>`) and sends one `PATCH` with set-quantity actions, using each existing item's `orderItemId`. `cart.js` gains Coles line and removal functions; `orders.js` saves Coles sends. The existing `ColesSession` (hidden Coles WebView, prices) gains `send(lines)`, and `WoolworthsScreen` becomes a store-neutral `StoreScreen` so the Coles page can be shown for login, product pages and checkout. `Weekday_Fuel.html` runs the same trolley panel for either store.

**Tech Stack:** plain browser JS, Node built-in test runner (`node --test`), Kotlin (Android WebView, JUnit with org.json), GitHub Actions.

## Global Constraints

- Coles and Woolworths pages never get a JavaScript bridge; only the app origin `https://appassets.androidplatform.net` messages the host.
- The Coles login lives only in the app's WebView cookies. The Coles key is read from the page at run time and never stored, logged, put in script state or committed.
- Messages: page → host `{type: "sendColesTrolley", lines: [{productId: "3329137", quantity: 2, ...}]}`, `{type: "openColes", url}`, `{type: "colesCheckout"}`; host → page `{type: "colesTrolleyLogin"}`, `{type: "colesTrolleyDone", results: [{productId, added, reason?}]}`, `{type: "colesTrolleyError", message}`. Default failure text: "Couldn't send to the Coles trolley."
- Existing `localStorage` keys and stored orders keep their shape; the only new key is `weekdayfuel.v1.colesSent` = `{at, fingerprint, lines: {[productId]: quantity}}`.
- Every Coles-derived string inserted into HTML (text or attribute) goes through `esc`.
- Commit straight to `main` with the prefix `coles:` (release commit: `release: v0.8.0`). After each push CI must be green before the next task.
- There is no local Android SDK: Kotlin compiles and its tests run only in CI. JS tests run locally with `node --test "apps/android/app/src/test/js/*.test.js"` (keep the quotes); 112 pass before this plan.
- Nothing in CI talks to Coles or Woolworths.
- Bump the version only in Task 5.
- Do not touch `platra/`, the keystore, `local.properties` or `docs/seed/`. Do not stage anything under `.superpowers/`; stage files by explicit path.

### Watching CI after a push (PowerShell)

```powershell
Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status *> $null; "CI $id exit $LASTEXITCODE"
```

`exit 0` means green. Otherwise read `gh run view $id -R Evzy/weekday-fuel --log-failed`, fix, push again.

### Inline-script parse check (PowerShell)

```powershell
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

---

### Task 1: Coles trolley script

**Files:**
- Create: `apps/android/app/src/main/assets/coles/trolley.js`
- Create: `apps/android/app/src/test/js/coles-trolley.test.js`
- Modify: `.github/workflows/release-android.yml` (append `apps/android/app/src/test/js/coles-trolley.test.js` to the `node --test` file list, after `coles-prices.test.js`)
- Modify: `README.md` (row after the `coles/prices.js` row: `` | `apps/android/app/src/main/assets/coles/trolley.js` | Script that sets the Coles trolley | ``)

**Interfaces:**
- Produces: `window.__weekdayFuelColesTrolley = {start(lines) → boolean, state() → JSON string}`; `lines` = `[{productId: "<4-7 digits>", quantity: <0..99>}]`; state `{phase: "idle"|"fetching"|"notReady"|"needsLogin"|"done"|"error", results: [{productId, added: true} | {productId, added: false, reason}], error: string|null}`. `results` follow the order of `lines`.

- [ ] **Step 1: Write the failing tests** — `apps/android/app/src/test/js/coles-trolley.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/coles/trolley.js");
const COOKIE = "a=1; fulfillmentStoreId=7674; sessionId=s-1; visitorId=v-2; dsch-ccpuserid=u-3";

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

const ITEM = (productId, quantity, orderItemId) => ({ productId, quantity, orderItemId, product: { name: "x" } });
const trolley = (items) => ({ orderId: "1", items });
const patched = (actioned, failed = []) => ({ results: [{ actionedItems: actioned, failedItems: failed }], totalQuantity: 1 });

function load(handlers, page = {}) {
  const calls = [];
  globalThis.window = { __RUNTIME_CONFIG__: "config" in page ? page.config : { BFF_API_SUBSCRIPTION_KEY: "k123" }, crypto: { randomUUID: () => "uuid-1" } };
  globalThis.document = { cookie: "cookie" in page ? page.cookie : COOKIE };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    const h = (init.method || "GET") === "PATCH" ? handlers.patch : handlers.get;
    return h(url, init);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelColesTrolley, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "fetching") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("coles trolley script did not settle");
}

test("reads the trolley, then sets new and existing products and removes old ones in one request", async () => {
  const { api, calls } = load({
    get: () => response(200, trolley([ITEM(3329137, 1, "9157373864"), ITEM(132045, 2, "111"), ITEM(5077283, 1, "222")])),
    patch: () =>
      response(200, patched([
        { productId: "8991361", orderItemId: "333", quantity: 4, action: "ADD" },
        { productId: "3329137", orderItemId: "9157373864", quantity: 2, action: "UPDATE" },
        { productId: "5077283", quantity: 0, action: "DELETE" },
      ])),
  });
  const lines = [
    { productId: "8991361", quantity: 4 },
    { productId: "3329137", quantity: 2 },
    { productId: "132045", quantity: 2 },
    { productId: "5077283", quantity: 0 },
    { productId: "4834736", quantity: 0 },
  ];
  assert.equal(api.start(lines), true);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/bff/trolley/store/7674");
  assert.equal(calls[0].init.method || "GET", "GET");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers["x-api-version"], "3");
  assert.equal(calls[1].url, "/api/bff/trolley/store/7674");
  assert.equal(calls[1].init.method, "PATCH");
  assert.equal(calls[1].init.credentials, "include");
  for (const c of calls) {
    assert.equal(c.init.headers["Ocp-Apim-Subscription-Key"], "k123");
    assert.equal(c.init.headers["cusp-session-id"], "s-1");
    assert.equal(c.init.headers["cusp-visitor-id"], "v-2");
    assert.equal(c.init.headers["cusp-user-id"], "u-3");
    assert.equal(c.init.headers["cusp-correlation-id"], "uuid-1");
  }
  assert.deepEqual(calls[1].body, {
    ageGateVerified: false,
    swapBehaviour: false,
    items: [{ actions: [
      { productId: "8991361", quantity: 4 },
      { productId: "3329137", quantity: 2, orderItemId: "9157373864" },
      { productId: "5077283", quantity: 0, orderItemId: "222" },
    ] }],
  });
  assert.deepEqual(s.results, [
    { productId: "8991361", added: true },
    { productId: "3329137", added: true },
    { productId: "132045", added: true },
    { productId: "5077283", added: true },
    { productId: "4834736", added: true },
  ]);
  assert.equal(s.error, null);
  assert.doesNotMatch(api.state(), /k123/);
});

test("failed products carry Coles' message, and products missing from the answer fail too", async () => {
  const { api } = load({
    get: () => response(200, trolley([])),
    patch: () =>
      response(200, patched(
        [{ productId: "8991361", orderItemId: "333", quantity: 1, action: "ADD" }],
        [{ productId: "9999999", quantity: 1, action: "ADD", error: { errorCode: "unavailable", message: "Product is unavailable" } }],
      )),
  });
  api.start([{ productId: "8991361", quantity: 1 }, { productId: "9999999", quantity: 1 }, { productId: "1234567", quantity: 1 }]);
  const s = await settle(api);
  assert.deepEqual(s.results, [
    { productId: "8991361", added: true },
    { productId: "9999999", added: false, reason: "Product is unavailable" },
    { productId: "1234567", added: false, reason: "no answer for this product" },
  ]);
});

test("nothing to change sends no PATCH", async () => {
  const { api, calls } = load({ get: () => response(200, trolley([ITEM(3329137, 2, "1")])), patch: () => assert.fail("no PATCH expected") });
  api.start([{ productId: "3329137", quantity: 2 }, { productId: "132045", quantity: 0 }]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 1);
  assert.deepEqual(s.results, [{ productId: "3329137", added: true }, { productId: "132045", added: true }]);
});

test("401 or 403 from either request means log in, and a logged-out read sends nothing", async () => {
  let r = load({ get: () => response(401, { errorCode: "401", message: "UNAUTHORIZED" }), patch: () => assert.fail("no PATCH expected") });
  r.api.start([{ productId: "3329137", quantity: 1 }]);
  let s = await settle(r.api);
  assert.deepEqual([s.phase, s.results, s.error], ["needsLogin", [], null]);
  assert.equal(r.calls.length, 1);
  r = load({ get: () => response(200, trolley([])), patch: () => response(403, {}) });
  r.api.start([{ productId: "3329137", quantity: 1 }]);
  s = await settle(r.api);
  assert.equal(s.phase, "needsLogin");
});

test("HTTP errors, unreadable replies and a reply with no items end in error", async () => {
  const cases = [
    [{ get: () => response(500, {}) }, "coles trolley HTTP 500"],
    [{ get: () => response(200, null, true) }, "Unexpected token <"],
    [{ get: () => response(200, { errors: [] }) }, "coles trolley response has no items"],
    [{ get: () => response(200, trolley([])), patch: () => response(400, {}) }, "coles trolley HTTP 400"],
    [{ get: () => { throw new Error("offline"); } }, "offline"],
  ];
  for (const [handlers, message] of cases) {
    const { api } = load(handlers);
    api.start([{ productId: "3329137", quantity: 1 }]);
    const s = await settle(api);
    assert.deepEqual([s.phase, s.error, s.results], ["error", message, []]);
    assert.doesNotMatch(api.state(), /k123/);
  }
});

test("without the key or a store the page is not ready and nothing is requested", async () => {
  for (const page of [{ config: undefined }, { config: { BFF_API_SUBSCRIPTION_KEY: "" } }, { cookie: "sessionId=s-1" }]) {
    const { api, calls } = load({ get: () => response(200, trolley([])) }, page);
    assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), true);
    assert.equal(JSON.parse(api.state()).phase, "notReady");
    assert.equal(calls.length, 0);
  }
});

test("ignores start() while fetching, can run again after, and re-injecting keeps the same API", async () => {
  const { api, calls } = load({ get: () => response(200, trolley([])), patch: () => response(200, patched([{ productId: "3329137", quantity: 1, action: "ADD" }])) });
  assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), true);
  assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), false);
  await settle(api);
  assert.equal(calls.length, 2);
  const before = api.state();
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  assert.equal(globalThis.window.__weekdayFuelColesTrolley, api);
  assert.equal(api.state(), before);
  assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), true);
  await settle(api);
  assert.equal(calls.length, 4);
});
```

- [ ] **Step 2: Run to see them fail.** `node --test apps/android/app/src/test/js/coles-trolley.test.js` → fails (cannot find `trolley.js`).

- [ ] **Step 3: Write the script** — `apps/android/app/src/main/assets/coles/trolley.js`:

```js
/* Injected into coles.com.au by ColesSession. Sets trolley quantities with the site's own trolley requests. */
(function () {
  "use strict";
  if (window.__weekdayFuelColesTrolley) return;

  var LOGIN = {};
  var state = { phase: "idle", results: [], error: null };

  function pageKey() {
    var c = window.__RUNTIME_CONFIG__;
    var k = c && c.BFF_API_SUBSCRIPTION_KEY;
    return typeof k === "string" && k ? k : null;
  }

  function cookie(name) {
    var m = new RegExp("(?:^|;\\s*)" + name + "=([^;]*)").exec(String(document.cookie || ""));
    if (!m) return "";
    try {
      return decodeURIComponent(m[1]);
    } catch (e) {
      return m[1];
    }
  }

  function pageStore() {
    var id = cookie("fulfillmentStoreId");
    return /^\d+$/.test(id) ? id : null;
  }

  function uuid() {
    var c = window.crypto;
    return c && typeof c.randomUUID === "function" ? c.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  /* The cusp-* headers are what the site sends; Coles doesn't require them today. */
  function headers(key, extra) {
    var h = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": key,
      "cusp-session-id": cookie("sessionId"),
      "cusp-visitor-id": cookie("visitorId"),
      "cusp-user-id": cookie("dsch-ccpuserid"),
      "cusp-correlation-id": uuid(),
    };
    Object.keys(extra || {}).forEach(function (k) {
      h[k] = extra[k];
    });
    return h;
  }

  async function call(url, init) {
    var r = await fetch(url, init);
    if (r.status === 401 || r.status === 403) throw LOGIN;
    if (!r.ok) throw new Error("coles trolley HTTP " + r.status);
    return r.json();
  }

  /* productId -> {orderItemId, quantity} for what's in the trolley now. */
  async function readTrolley(url, key) {
    var body = await call(url, { credentials: "include", headers: headers(key, { "x-api-version": "3" }) });
    if (!body || !Array.isArray(body.items)) throw new Error("coles trolley response has no items");
    var have = {};
    body.items.forEach(function (i) {
      if (i && i.productId != null && i.orderItemId != null) have[String(i.productId)] = { orderItemId: String(i.orderItemId), quantity: i.quantity };
    });
    return have;
  }

  async function run(lines, key, storeId) {
    state = { phase: "fetching", results: [], error: null };
    var url = "/api/bff/trolley/store/" + storeId;
    try {
      var have = await readTrolley(url, key);
      var results = {};
      var actions = [];
      lines.forEach(function (l) {
        var h = have[l.productId];
        if (l.quantity === 0 ? !h : !!h && h.quantity === l.quantity) {
          results[l.productId] = { productId: l.productId, added: true };
          return;
        }
        // Without orderItemId Coles adds to a product already in the trolley instead of setting it.
        var a = { productId: l.productId, quantity: l.quantity };
        if (h) a.orderItemId = h.orderItemId;
        actions.push(a);
      });
      if (actions.length) {
        var body = await call(url, {
          method: "PATCH",
          credentials: "include",
          headers: headers(key),
          body: JSON.stringify({ ageGateVerified: false, swapBehaviour: false, items: [{ actions: actions }] }),
        });
        var ok = {};
        var bad = {};
        ((body && body.results) || []).forEach(function (g) {
          ((g && g.actionedItems) || []).forEach(function (i) {
            if (i && i.productId != null) ok[String(i.productId)] = true;
          });
          ((g && g.failedItems) || []).forEach(function (i) {
            if (i && i.productId != null) bad[String(i.productId)] = (i.error && typeof i.error.message === "string" && i.error.message) || "not added";
          });
        });
        actions.forEach(function (a) {
          results[a.productId] = ok[a.productId] ? { productId: a.productId, added: true } : { productId: a.productId, added: false, reason: bad[a.productId] || "no answer for this product" };
        });
      }
      state = { phase: "done", results: lines.map(function (l) { return results[l.productId]; }), error: null };
    } catch (e) {
      state = e === LOGIN ? { phase: "needsLogin", results: [], error: null } : { phase: "error", results: [], error: String((e && e.message) || e) };
    }
  }

  window.__weekdayFuelColesTrolley = {
    start: function (lines) {
      if (state.phase === "fetching") return false;
      var key = pageKey();
      var storeId = pageStore();
      if (!key || !storeId) {
        state = { phase: "notReady", results: [], error: null };
        return true;
      }
      run(lines, key, storeId);
      return true;
    },
    state: function () { return JSON.stringify(state); },
  };
})();
```

- [ ] **Step 4: Run the tests.** `node --test "apps/android/app/src/test/js/*.test.js"` → 119 pass, 0 fail.

- [ ] **Step 5: CI list and README** as listed under Files.

- [ ] **Step 6: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add apps/android/app/src/main/assets/coles/trolley.js apps/android/app/src/test/js/coles-trolley.test.js .github/workflows/release-android.yml README.md
git commit -m "coles: trolley script reads the Coles trolley and sets quantities in one request"
git push
```

---

### Task 2: Coles cart lines and Coles orders

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/cart.js`
- Modify: `apps/android/app/src/main/assets/weekday_fuel/orders.js`
- Test: `apps/android/app/src/test/js/cart.test.js`, `apps/android/app/src/test/js/orders.test.js`

**Interfaces:**
- Consumes: Build a shop rows from `catalogue.js` `shopList`: `{id, sec, name, coles: {product, quantity, cost, buy} | null, woolies: … | null, colesUnavailable: product | null, wooliesUnavailable: product | null, …}`; `colesId(product)` from `catalogue.js` (string of 4–7 digits or null), passed in as `idOf`.
- Produces (cart.js): `colesCartLines(rows, ticks, haveIt, idOf)` → `{lines: [{itemId, productId, quantity, name, url}], manual: [{itemId, name, reason: "woolies"|"unavailable"|"nostore"}]}`; `colesRemovalLines(lastLines, rows, idOf)` → `[{productId, quantity: 0}]`; `sentAfter(lastLines, lines, results, key)` with `key` default `"stockcode"`.
- Produces (orders.js): `snapshot(rows, ticks, sentLines, opts)` also reads `opts.colesSent` (`{[productId]: quantity}`), `opts.colesId(product)` and `opts.colesProduct(productId)`; `isEmpty(rows, sentLines, colesSent)`; `groupTitle(order, key)`.

- [ ] **Step 1: Failing tests — append to `cart.test.js`** (extend the `require` at the top to also take `colesCartLines, colesRemovalLines`):

```js
const CB = { name: "Coles Chicken Breast Large", url: "https://www.coles.com.au/product/coles-breast-large-2263179", price: 16.8 };
const CM = { name: "Coles Macaroni 500g", url: "https://www.coles.com.au/product/coles-macaroni-3329137", price: 1 };
const idOf = (p) => { const m = /-(\d{4,7})$/.exec((p && p.url) || ""); return m ? m[1] : null; };

test("a Coles line becomes a trolley line keyed by its Coles product ID", () => {
  const { lines, manual } = colesCartLines([row("breast", null, { product: CB, quantity: 2 })], {}, {}, idOf);
  assert.deepEqual(lines, [{ itemId: "breast", productId: "2263179", quantity: 2, name: CB.name, url: CB.url }]);
  assert.deepEqual(manual, []);
});

test("Coles lines skip ticked and 'I have it' items and merge rows that share a product", () => {
  const rows = [row("mac", null, { product: CM, quantity: 1 }), row("mac2", null, { product: CM, quantity: 2 }), row("breast", null, { product: CB, quantity: 1 }), row("yog", YOG_ROW_W, { product: CB, quantity: 1 })];
  const { lines } = colesCartLines(rows, { breast: true }, { yog: true }, idOf);
  assert.deepEqual(lines, [{ itemId: "mac", productId: "3329137", quantity: 3, name: CM.name, url: CM.url }]);
});

test("items Coles doesn't have online go to the do-it-yourself list with their reason", () => {
  const unavailable = { ...row("cheese", { product: YOG, quantity: 1 }), colesUnavailable: { name: "Coles Light Tasty 500g" } };
  const { lines, manual } = colesCartLines([row("yog", { product: YOG, quantity: 1 }), unavailable, row("mystery", null)], {}, {}, idOf);
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [
    { itemId: "yog", name: YOG.name, reason: "woolies" },
    { itemId: "cheese", name: "Coles Light Tasty 500g", reason: "unavailable" },
    { itemId: "mystery", name: "Plain mystery", reason: "nostore" },
  ]);
});

test("colesRemovalLines sets to 0 only Coles products the shop no longer needs", () => {
  const rows = [row("mac", null, { product: CM, quantity: 1 }), { ...row("breast", null), colesUnavailable: CB }];
  assert.deepEqual(colesRemovalLines({ 3329137: 1, 2263179: 1, 5077283: 2 }, rows, idOf), [{ productId: "5077283", quantity: 0 }]);
  assert.deepEqual(colesRemovalLines(null, rows, idOf), []);
});

test("sentAfter can key Coles lines by productId", () => {
  const lines = [{ productId: "3329137", quantity: 2 }, { productId: "5077283", quantity: 0 }, { productId: "2263179", quantity: 1 }];
  const results = [{ productId: "3329137", added: true }, { productId: "5077283", added: true }, { productId: "2263179", added: false }];
  assert.deepEqual(sentAfter({ 5077283: 2, 1111: 1 }, lines, results, "productId"), { 1111: 1, 3329137: 2 });
});
```

Where `YOG_ROW_W` is `{ product: YOG, quantity: 1 }` (define it next to `CB`).

- [ ] **Step 2: Failing tests — append to `orders.test.js`:**

```js
const CMAC = { name: "Coles Macaroni 500g", url: "https://www.coles.com.au/product/coles-macaroni-3329137", price: 1 };
const CBREAST = { name: "Coles chicken breast", url: "https://www.coles.com.au/product/coles-breast-2263179", price: 12 };
const cid = (p) => { const m = /-(\d{4,7})$/.exec((p && p.url) || ""); return m ? m[1] : null; };
const mac = ROW("mac", 2, null, LINE(CMAC, 1, 1, "1 pack"));
const cbreast = ROW("breast", 1, null, LINE(CBREAST, 1, 12, "1 pack"));
const COPTS = { ...OPTS, store: "coles", wooliesTotal: null, colesId: cid, colesProduct: (id) => (id === "8991361" ? { name: "Dare 500mL", price: 4.65 } : null) };

test("in a Coles shop, products sent to the Coles trolley are ordered, at Coles", () => {
  const o = O.snapshot([cbreast, mac, evap], {}, {}, { ...COPTS, colesSent: { 2263179: 2, 3329137: 0, 8991361: 1, 7777777: 3 } });
  assert.deepEqual(o.groups.ordered, [
    item("Coles chicken breast", "2 packs", 24, "coles"),
    item("Product 7777777", "3", null, "coles", "not in this shop", ""),
    item("Dare 500mL", "1 pack", 4.65, "coles", "not in this shop", ""),
  ]);
  assert.deepEqual(o.groups.pantry, [item("Coles Macaroni 500g", "1 pack", 1, "coles")]);
  assert.deepEqual(o.groups.buy, [item("Evaporated milk", "", null, null, "no online store")]);
});

test("a sent amount equal to the shop line keeps the shop's own description", () => {
  const o = O.snapshot([cbreast], {}, {}, { ...COPTS, colesSent: { 2263179: 1 } });
  assert.deepEqual(o.groups.ordered, [item("Coles chicken breast", "1 pack", 12, "coles")]);
});

test("isEmpty counts Coles sends, and groupTitle names the order's store", () => {
  assert.equal(O.isEmpty([], {}, { 3329137: 1 }), false);
  assert.equal(O.isEmpty([], {}, { 3329137: 0 }), true);
  assert.equal(O.groupTitle({ store: "coles" }, "ordered"), "Ordered on Coles");
  assert.equal(O.groupTitle({ store: "woolies" }, "ordered"), "Ordered on Woolworths");
  assert.equal(O.groupTitle({ store: "coles" }, "buy"), "Buy yourself");
});
```

- [ ] **Step 3: Run to see them fail.** `node --test "apps/android/app/src/test/js/*.test.js"`.

- [ ] **Step 4: Implement `cart.js`.** Add before `var api = …`:

```js
  /* Coles trolley lines, keyed by Coles product ID (idOf = catalogue colesId). Rows that share a product are merged. */
  function colesCartLines(rows, ticks, haveIt, idOf) {
    var lines = [];
    var byId = {};
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id] || (haveIt && haveIt[row.id])) return;
      var line = row.coles;
      var id = line ? idOf(line.product) : null;
      if (!id) {
        if (row.colesUnavailable) manual.push({ itemId: row.id, name: row.colesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.woolies ? row.woolies.product.name : row.name, reason: row.woolies ? "woolies" : "nostore" });
        return;
      }
      if (byId[id]) {
        byId[id].quantity += line.quantity;
        return;
      }
      byId[id] = { itemId: row.id, productId: id, quantity: line.quantity, name: line.product.name, url: line.product.url };
      lines.push(byId[id]);
    });
    return { lines: lines, manual: manual };
  }

  function colesRemovalLines(lastLines, rows, idOf) {
    var keep = {};
    rows.forEach(function (row) {
      var a = row.coles && idOf(row.coles.product);
      var b = row.colesUnavailable && idOf(row.colesUnavailable);
      if (a) keep[a] = true;
      if (b) keep[b] = true;
    });
    return Object.keys(lastLines || {})
      .filter(function (id) {
        return !keep[id];
      })
      .map(function (id) {
        return { productId: id, quantity: 0 };
      });
  }
```

Change `sentAfter` to take a key (Woolworths callers pass nothing):

```js
  function sentAfter(lastLines, lines, results, key) {
    var k = key || "stockcode";
    var out = Object.assign({}, lastLines || {});
    var done = {};
    (results || []).forEach(function (r) {
      if (r.added) done[r[k]] = true;
    });
    lines.forEach(function (l) {
      if (!done[l[k]]) return;
      if (l.quantity === 0) delete out[l[k]];
      else out[l[k]] = l.quantity;
    });
    return out;
  }
```

and export both new functions: `var api = { cartLines: cartLines, removalLines: removalLines, colesCartLines: colesCartLines, colesRemovalLines: colesRemovalLines, shopFingerprint: shopFingerprint, sentAfter: sentAfter };`. Update the file's top comment to "Turns Build a shop rows into Woolworths and Coles trolley lines."

- [ ] **Step 5: Implement `orders.js`.**

`orderedItem` gains a store (default Woolworths):

```js
  function orderedItem(line, product, qty, note, forText, store) {
    var same = !!line && Math.abs(qty - line.quantity) < 1e-9;
    return {
      name: String(product.name),
      buy: same ? line.buy : amount(product, qty),
      cost: same ? line.cost : typeof product.price === "number" ? round2(qty * product.price) : null,
      store: store || "woolies",
      note: note,
      for: forText,
    };
  }
```

In `snapshot`, after `var sent = sentLines || {};` add:

```js
    var colesSent = o.colesSent && typeof o.colesSent === "object" ? o.colesSent : {};
    var colesId = typeof o.colesId === "function" ? o.colesId : function () { return null; };
    var usedColes = {};
```

In the row loop, right after the `if (gone && isQty(sent[gone.stockcode])) {…}` block, add:

```js
      var c = row.coles;
      var cGone = row.colesUnavailable;
      var cId = c ? colesId(c.product) : null;
      var cGoneId = cGone ? colesId(cGone) : null;
      if (cId) usedColes[cId] = true;
      if (cGoneId) usedColes[cGoneId] = true;
      if (cId && isQty(colesSent[cId])) {
        groups.ordered.push(orderedItem(c, c.product, colesSent[cId], null, f, "coles"));
        return;
      }
      if (cGoneId && isQty(colesSent[cGoneId])) {
        groups.ordered.push(orderedItem(null, cGone, colesSent[cGoneId], "was unavailable online", f, "coles"));
        return;
      }
```

After the existing `Object.keys(sent).forEach(…)` block, add:

```js
    Object.keys(colesSent).forEach(function (id) {
      if (usedColes[id] || !isQty(colesSent[id])) return;
      var p = typeof o.colesProduct === "function" ? o.colesProduct(id) : null;
      if (!p || typeof p.name !== "string" || !p.name) p = null;
      groups.ordered.push(
        p ? orderedItem(null, p, colesSent[id], "not in this shop", "", "coles") : { name: "Product " + id, buy: String(colesSent[id]), cost: null, store: "coles", note: "not in this shop", for: "" },
      );
    });
```

Replace `isEmpty`:

```js
  function isEmpty(rows, sentLines, colesSent) {
    var real = Array.isArray(rows) && rows.some(function (r) { return !!r && r.sec !== 0; });
    var any = function (s) {
      return Object.keys(s || {}).some(function (k) { return isQty(s[k]); });
    };
    return !real && !any(sentLines) && !any(colesSent);
  }
```

Add, and export as `groupTitle`:

```js
  function groupTitle(order, key) {
    if (key === "ordered") return order && order.store === "coles" ? "Ordered on Coles" : "Ordered on Woolworths";
    return GROUP_TITLES[key];
  }
```

- [ ] **Step 6: Run the tests.** `node --test "apps/android/app/src/test/js/*.test.js"` → 127 pass, 0 fail (the existing Woolworths tests must pass unchanged).

- [ ] **Step 7: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add apps/android/app/src/main/assets/weekday_fuel/cart.js apps/android/app/src/main/assets/weekday_fuel/orders.js apps/android/app/src/test/js/cart.test.js apps/android/app/src/test/js/orders.test.js
git commit -m "coles: cart lines and removals for the Coles trolley; saved orders list Coles sends"
git push
```

---

### Task 3: Host sends to the Coles trolley, with a Coles screen

**Files:**
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesTrolleyModels.kt`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/StoreScreen.kt` (moved from `woolworths/WoolworthsScreen.kt`, which is deleted with `git mv`)
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesSession.kt`, `coles/ColesUrls.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt`
- Modify: `apps/android/app/src/main/res/values/strings.xml`
- Test: `apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesTrolleyJsonTest.kt` (new), `woolworths/HostMessagesTest.kt`, `coles/ColesUrlsTest.kt`

**Interfaces:**
- Consumes: `assets/coles/trolley.js` (Task 1) API and state shape.
- Produces: host handling of `sendColesTrolley`, `openColes`, `colesCheckout`; replies `colesTrolleyLogin`, `colesTrolleyDone`, `colesTrolleyError`. Coles product links clicked in the app page (`<a href>` to `https://www.coles.com.au/...`) open in the Coles screen.

- [ ] **Step 1: Models** — `coles/ColesTrolleyModels.kt`:

```kotlin
package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

data class ColesTrolleyLine(val productId: String, val quantity: Int)

enum class ColesTrolleyPhase { IDLE, FETCHING, NOT_READY, NEEDS_LOGIN, DONE, ERROR }

data class ColesTrolleyResult(val productId: String, val added: Boolean, val reason: String?)

data class ColesTrolleyState(val phase: ColesTrolleyPhase, val results: List<ColesTrolleyResult>, val error: String?)

object ColesTrolleyJson {
    private val ID = Regex("^\\d{4,7}$")
    const val MAX_QUANTITY = 99

    /**
     * Null when any entry isn't `{productId: "<4-7 digits>", quantity: <whole number 0..99>}`; the lines go into injected
     * script, so nothing else is let through. A product's later duplicates are dropped.
     */
    fun parseLines(lines: JSONArray): List<ColesTrolleyLine>? {
        val out = LinkedHashMap<String, ColesTrolleyLine>()
        for (i in 0 until lines.length()) {
            val o = lines.opt(i) as? JSONObject ?: return null
            val id = o.opt("productId") as? String ?: return null
            if (!ID.matches(id)) return null
            val q = (o.opt("quantity") as? Number)?.toDouble() ?: return null
            if (q != Math.floor(q) || q < 0 || q > MAX_QUANTITY) return null
            out.putIfAbsent(id, ColesTrolleyLine(id, q.toInt()))
        }
        return out.values.toList()
    }

    fun linesToJson(lines: List<ColesTrolleyLine>): String =
        JSONArray().apply { lines.forEach { put(JSONObject().put("productId", it.productId).put("quantity", it.quantity)) } }.toString()

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelColesTrolley.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): ColesTrolleyState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        val results = o.optJSONArray("results") ?: JSONArray()
        return ColesTrolleyState(
            phase =
                when (o.optString("phase")) {
                    "fetching" -> ColesTrolleyPhase.FETCHING
                    "notReady" -> ColesTrolleyPhase.NOT_READY
                    "needsLogin" -> ColesTrolleyPhase.NEEDS_LOGIN
                    "done" -> ColesTrolleyPhase.DONE
                    "error" -> ColesTrolleyPhase.ERROR
                    else -> ColesTrolleyPhase.IDLE
                },
            results =
                (0 until results.length()).mapNotNull { i ->
                    val r = results.optJSONObject(i) ?: return@mapNotNull null
                    ColesTrolleyResult(r.optString("productId"), r.optBoolean("added"), if (r.isNull("reason")) null else r.optString("reason"))
                },
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
```

- [ ] **Step 2: Model tests** — `coles/ColesTrolleyJsonTest.kt`:

```kotlin
package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ColesTrolleyJsonTest {
    @Test
    fun parseLinesKeepsValidLinesAndDropsLaterDuplicates() {
        val lines = ColesTrolleyJson.parseLines(JSONArray("""[{"productId":"3329137","quantity":2,"name":"Macaroni"},{"productId":"5077283","quantity":0},{"productId":"3329137","quantity":5}]"""))
        assertEquals(listOf(ColesTrolleyLine("3329137", 2), ColesTrolleyLine("5077283", 0)), lines)
        assertEquals(emptyList<ColesTrolleyLine>(), ColesTrolleyJson.parseLines(JSONArray("[]")))
    }

    @Test
    fun parseLinesRejectsAnythingElse() {
        for (bad in listOf(
            """[{"productId":3329137,"quantity":1}]""",
            """[{"productId":"12","quantity":1}]""",
            """[{"productId":"3329137\"]);alert(1);//","quantity":1}]""",
            """[{"productId":"3329137","quantity":1.5}]""",
            """[{"productId":"3329137","quantity":-1}]""",
            """[{"productId":"3329137","quantity":100}]""",
            """[{"productId":"3329137","quantity":"2"}]""",
            """[{"productId":"3329137"}]""",
            """["3329137"]""",
            """[null]""",
        )) assertNull(bad, ColesTrolleyJson.parseLines(JSONArray(bad)))
    }

    @Test
    fun linesToJsonIsPlain() {
        assertEquals("""[{"productId":"3329137","quantity":2}]""", ColesTrolleyJson.linesToJson(listOf(ColesTrolleyLine("3329137", 2))))
    }

    @Test
    fun parsesScriptStates() {
        assertNull(ColesTrolleyJson.parseScriptState(null))
        assertNull(ColesTrolleyJson.parseScriptState("null"))
        val done = ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"done","results":[{"productId":"3329137","added":true},{"productId":"9999999","added":false,"reason":"Product is unavailable"}],"error":null}"""))!!
        assertEquals(ColesTrolleyPhase.DONE, done.phase)
        assertEquals(listOf(ColesTrolleyResult("3329137", true, null), ColesTrolleyResult("9999999", false, "Product is unavailable")), done.results)
        assertEquals(ColesTrolleyPhase.NEEDS_LOGIN, ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"needsLogin","results":[],"error":null}"""))!!.phase)
        assertEquals(ColesTrolleyPhase.NOT_READY, ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"notReady","results":[],"error":null}"""))!!.phase)
        val err = ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"error","results":[],"error":"coles trolley HTTP 500"}"""))!!
        assertEquals(ColesTrolleyPhase.ERROR, err.phase)
        assertEquals("coles trolley HTTP 500", err.error)
        assertEquals(ColesTrolleyPhase.IDLE, ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"odd"}"""))!!.phase)
    }
}
```

- [ ] **Step 3: Host messages.** In `HostMessages.kt` add (import `dev.weekdayfuel.app.coles.ColesTrolleyPhase` and `ColesTrolleyState`; add `private const val COLES_TROLLEY_FAILURE = "Couldn't send to the Coles trolley."` next to the other defaults):

```kotlin
    fun colesTrolleyLogin(): String = JSONObject().put("type", "colesTrolleyLogin").toString()

    fun colesTrolley(state: ColesTrolleyState): String {
        if (state.phase != ColesTrolleyPhase.DONE) return colesTrolleyFailure(state.error ?: COLES_TROLLEY_FAILURE)
        val results =
            JSONArray().apply {
                state.results.forEach {
                    put(JSONObject().put("productId", it.productId).put("added", it.added).apply { if (it.reason != null) put("reason", it.reason) })
                }
            }
        return JSONObject().put("type", "colesTrolleyDone").put("results", results).toString()
    }

    fun colesTrolleyFailure(message: String): String = JSONObject().put("type", "colesTrolleyError").put("message", message).toString()
```

Tests appended to `HostMessagesTest.kt` (import `dev.weekdayfuel.app.coles.ColesTrolleyPhase`, `ColesTrolleyResult`, `ColesTrolleyState`):

```kotlin
    @Test
    fun colesTrolleyMessages() {
        assertEquals("colesTrolleyLogin", JSONObject(HostMessages.colesTrolleyLogin()).getString("type"))
        val done = JSONObject(HostMessages.colesTrolley(ColesTrolleyState(ColesTrolleyPhase.DONE, listOf(ColesTrolleyResult("3329137", true, null), ColesTrolleyResult("9999999", false, "Product is unavailable")), null)))
        assertEquals("colesTrolleyDone", done.getString("type"))
        val r = done.getJSONArray("results")
        assertEquals("3329137", r.getJSONObject(0).getString("productId"))
        assertTrue(r.getJSONObject(0).getBoolean("added"))
        assertFalse(r.getJSONObject(0).has("reason"))
        assertEquals("Product is unavailable", r.getJSONObject(1).getString("reason"))
        val err = JSONObject(HostMessages.colesTrolley(ColesTrolleyState(ColesTrolleyPhase.ERROR, emptyList(), null)))
        assertEquals("colesTrolleyError", err.getString("type"))
        assertEquals("Couldn't send to the Coles trolley.", err.getString("message"))
        assertEquals("Coles took too long.", JSONObject(HostMessages.colesTrolleyFailure("Coles took too long.")).getString("message"))
    }
```

- [ ] **Step 4: URLs and strings.** In `ColesUrls.kt` add `const val CHECKOUT_URL = "https://www.coles.com.au/checkout"` next to `HOME_URL`, and in `ColesUrlsTest.kt` add a test `checkoutIsOnTheColesSite` asserting `ColesUrls.CHECKOUT_URL.startsWith(ColesUrls.HOME_URL)` (create the test file in `src/test/java/dev/weekdayfuel/app/coles/` if it doesn't exist). In `strings.xml` add:

```xml
    <string name="coles_login_status">Log in to Coles to send your shop</string>
    <string name="coles_login_cancelled">Log in to Coles, then tap Send again.</string>
    <string name="coles_bad_lines">Couldn\'t read the shop list to send to Coles. Try again.</string>
```

- [ ] **Step 5: `StoreScreen`.** `git mv apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsScreen.kt apps/android/app/src/main/java/dev/weekdayfuel/app/StoreScreen.kt`; change the package to `dev.weekdayfuel.app`, the class name to `StoreScreen`, the doc comment's first line to `"← Weekday Fuel" bar above a store's session WebView (Woolworths or Coles).`, and add focus blocking:

```kotlin
    val view: LinearLayout =
        LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(context.getColor(R.color.page_background))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            // Hidden underneath the app page, the store page must not take keyboard focus.
            descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
            // ...bar and sessionView exactly as before...
        }

    fun show() {
        isShowing = true
        view.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        appView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        view.bringToFront()
    }

    fun hide() {
        isShowing = false
        setStatus(null)
        view.findFocus()?.clearFocus()
        view.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
        appView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        appView.bringToFront()
    }
```

In `MainActivity.kt` replace the import `dev.weekdayfuel.app.woolworths.WoolworthsScreen` (it is now the same package, so just remove it) and the type `WoolworthsScreen` with `StoreScreen`. Search the repo for any other `WoolworthsScreen` reference (README, docs other than specs/plans) and update it.

- [ ] **Step 6: `ColesSession` sends.** Changes to `coles/ColesSession.kt`:

Listener:

```kotlin
    interface Listener {
        /** Phase is [ColesPricesPhase.DONE] or [ColesPricesPhase.ERROR]. */
        fun onColesPrices(state: ColesPricesState)

        fun onColesTrolleyNeedsLogin()

        /** Phase is [ColesTrolleyPhase.DONE] or [ColesTrolleyPhase.ERROR]. */
        fun onColesTrolley(state: ColesTrolleyState)
    }
```

New fields (next to the price fields):

```kotlin
    private val trolleyScript: String by lazy {
        context.assets.open(TROLLEY_ASSET).bufferedReader().use { it.readText() }
    }
    private var pendingSend: List<ColesTrolleyLine>? = null
    private var sendPolling = false
    private var loginNotified = false
    private var clearHistoryOnLoad = false
    private val sendPoller = Runnable { pollSend() }
    private val sendRetry = Runnable { retrySend() }
    private val sendWatchdog =
        Runnable {
            needsFreshPage = true
            failSend(context.getString(R.string.coles_timeout))
        }

    /** True while the Coles screen is up: the page is then the owner's, so refreshes neither navigate nor unload it. */
    var visible = false
        set(value) {
            field = value
            if (!value) unloadIfIdle()
        }

    val hasPendingSend: Boolean get() = pendingSend != null
```

Public methods:

```kotlin
    /** Loads a page for the owner; Back from it closes the screen instead of returning to background loads. */
    fun load(url: String) {
        if (destroyed) return
        clearHistoryOnLoad = true
        webView.loadUrl(url)
    }

    fun send(lines: List<ColesTrolleyLine>) {
        if (destroyed) return
        pendingSend = lines
        sendPolling = false
        loginNotified = false
        handler.removeCallbacks(sendPoller)
        handler.removeCallbacks(sendRetry)
        armSendWatchdog()
        when {
            needsFreshPage || !onColesPage() -> webView.loadUrl(ColesUrls.HOME_URL)
            !pageLoading -> startSend()
        }
    }

    fun cancelSend() {
        clearSend()
        unloadIfIdle()
    }
```

In `refreshPrices`, only navigate when the page isn't the owner's or a send's:

```kotlin
        when {
            !visible && pendingSend == null && (needsFreshPage || !onColesPage()) -> webView.loadUrl(ColesUrls.HOME_URL)
            !pageLoading -> start()
        }
```

In `destroy()`, call `clearSend()` after `cancel()`. Replace `finish(state)`'s `webView.loadUrl(BLANK_URL)` with `unloadIfIdle()` (keep `cancel()` first and the listener call last), and add:

```kotlin
    /** Unloads the page between uses (refreshes are hours apart) so Coles' scripts don't run in the background. */
    private fun unloadIfIdle() {
        if (!destroyed && !visible && pending == null && pendingSend == null) webView.loadUrl(BLANK_URL)
    }

    private fun clearSend() {
        pendingSend = null
        sendPolling = false
        loginNotified = false
        handler.removeCallbacks(sendPoller)
        handler.removeCallbacks(sendRetry)
        handler.removeCallbacks(sendWatchdog)
    }

    private fun armSendWatchdog() {
        handler.removeCallbacks(sendWatchdog)
        handler.postDelayed(sendWatchdog, SEND_TIMEOUT_MS)
    }

    private fun startSend() {
        val lines = pendingSend ?: return
        // The script's relative /api/bff requests only exist on www.coles.com.au, not on the login pages.
        if (pageLoading || !onColesPage()) return
        handler.removeCallbacks(sendRetry)
        handler.removeCallbacks(sendPoller)
        sendPolling = true
        webView.evaluateJavascript("$trolleyScript\nwindow.__weekdayFuelColesTrolley.start(${ColesTrolleyJson.linesToJson(lines)});", null)
        handler.postDelayed(sendPoller, POLL_MS)
    }

    private fun retrySend() {
        if (pendingSend == null) return
        if (pageLoading || !onColesPage()) {
            handler.postDelayed(sendRetry, LOGIN_RETRY_MS)
            return
        }
        if (loginNotified) armSendWatchdog()
        startSend()
    }

    private fun pollSend() {
        if (!sendPolling) return
        webView.evaluateJavascript(TROLLEY_STATE_EXPRESSION) { result ->
            if (!sendPolling) return@evaluateJavascript
            val state = runCatching { ColesTrolleyJson.parseScriptState(result) }.getOrNull()
            when (state?.phase) {
                null -> {
                    // A new document dropped the script; onPageFinished or this restarts it.
                    sendPolling = false
                    if (!pageLoading) startSend()
                }
                ColesTrolleyPhase.IDLE, ColesTrolleyPhase.FETCHING -> handler.postDelayed(sendPoller, POLL_MS)
                ColesTrolleyPhase.NOT_READY -> {
                    sendPolling = false
                    handler.postDelayed(sendRetry, RETRY_MS)
                }
                ColesTrolleyPhase.NEEDS_LOGIN -> {
                    sendPolling = false
                    // No time limit while the owner logs in; re-check until it works or the screen is closed.
                    handler.removeCallbacks(sendWatchdog)
                    handler.postDelayed(sendRetry, LOGIN_RETRY_MS)
                    if (!loginNotified) listener?.onColesTrolleyNeedsLogin()
                    loginNotified = true
                }
                ColesTrolleyPhase.DONE, ColesTrolleyPhase.ERROR -> {
                    clearSend()
                    listener?.onColesTrolley(state)
                    unloadIfIdle()
                }
            }
        }
    }

    private fun failSend(message: String) {
        if (pendingSend == null) return
        clearSend()
        needsFreshPage = true
        listener?.onColesTrolley(ColesTrolleyState(ColesTrolleyPhase.ERROR, emptyList(), message))
        unloadIfIdle()
    }
```

In `SessionClient.onPageFinished`, after `pageLoading = false`:

```kotlin
            if (clearHistoryOnLoad) {
                clearHistoryOnLoad = false
                view.clearHistory()
            }
```

and after the existing price start line:

```kotlin
            if (pendingSend != null && !sendPolling && coles) {
                if (loginNotified) armSendWatchdog()
                startSend()
            }
```

In `onReceivedError` (main frame), after `fail(context.getString(R.string.coles_offline))` add `failSend(context.getString(R.string.coles_offline))`. Companion: add `const val TROLLEY_ASSET = "coles/trolley.js"`, `const val TROLLEY_STATE_EXPRESSION = "window.__weekdayFuelColesTrolley ? window.__weekdayFuelColesTrolley.state() : null"`, `const val LOGIN_RETRY_MS = 2_000L`, `const val SEND_TIMEOUT_MS = 60_000L`. Update the class doc comment to: `Owns a coles.com.au WebView, shown only in the Coles screen, that reads Coles prices and sets the Coles trolley. No JavaScript bridge.`

- [ ] **Step 7: `MainActivity`.**

Fields: `private lateinit var colesScreen: StoreScreen` and `private var loginShownForColesSend = false`.

In `onCreate`, replace the block that adds `coles.webView` to `root` (the comment line, the `coles.webView.apply { … }` block and `root.addView(coles.webView, …)`) with:

```kotlin
        colesScreen = StoreScreen(this, coles.webView, webView, onClose = ::hideColes)
        root.addView(colesScreen.view, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
```

(it stays the first child, under the Woolworths screen and the app page).

Back handling — add before the Woolworths cases in `handleOnBackPressed`:

```kotlin
                        colesScreen.isShowing && coles.webView.canGoBack() -> coles.webView.goBack()
                        colesScreen.isShowing -> hideColes()
```

`onHostMessage` — add cases:

```kotlin
            "sendColesTrolley" -> {
                val lines = msg.optJSONArray("lines")?.let { runCatching { ColesTrolleyJson.parseLines(it) }.getOrNull() }
                if (lines.isNullOrEmpty()) {
                    replyToPage(HostMessages.colesTrolleyFailure(getString(R.string.coles_bad_lines)))
                    return
                }
                coles.send(lines)
            }
            "openColes" -> {
                val uri = Uri.parse(msg.optString("url"))
                showColes(if (ColesUrls.isColesPage(uri.scheme, uri.host)) uri.toString() else ColesUrls.HOME_URL)
            }
            "colesCheckout" -> showColes(ColesUrls.CHECKOUT_URL)
```

Show/hide:

```kotlin
    private fun showColes(url: String) {
        coles.visible = true
        coles.load(url)
        colesScreen.show()
    }

    private fun hideColes() {
        colesScreen.hide()
        if (loginShownForColesSend) {
            loginShownForColesSend = false
            if (coles.hasPendingSend) {
                coles.cancelSend()
                replyToPage(HostMessages.colesTrolleyFailure(getString(R.string.coles_login_cancelled)))
            }
        }
        coles.visible = false
    }
```

`ColesListener` gains:

```kotlin
        override fun onColesTrolleyNeedsLogin() {
            if (!colesScreen.isShowing) showColes(ColesUrls.HOME_URL)
            loginShownForColesSend = true
            colesScreen.setStatus(getString(R.string.coles_login_status))
            replyToPage(HostMessages.colesTrolleyLogin())
        }

        override fun onColesTrolley(state: ColesTrolleyState) {
            if (loginShownForColesSend) {
                loginShownForColesSend = false
                colesScreen.hide()
                coles.visible = false
            }
            replyToPage(HostMessages.colesTrolley(state))
        }
```

`HostWebViewClient.shouldOverrideUrlLoading` — before `openExternally(request.url)`:

```kotlin
            if (ColesUrls.isColesPage(request.url.scheme, request.url.host)) {
                showColes(request.url.toString())
                return true
            }
```

Imports: `dev.weekdayfuel.app.coles.ColesTrolleyJson`, `dev.weekdayfuel.app.coles.ColesTrolleyState`, `dev.weekdayfuel.app.coles.ColesUrls`. Update the README row for `MainActivity.kt` to: `WebView host: JS + DOM storage on; Woolworths and Coles links open in in-app store screens, other links externally`.

- [ ] **Step 8: Commit, push, watch CI** (Kotlin compiles and tests only there; fix and re-push until green).

```powershell
git pull --rebase origin main
git add -A apps/android/app/src/main/java apps/android/app/src/test/java apps/android/app/src/main/res/values/strings.xml README.md
git status --short
git commit -m "coles: host sends the shop to the Coles trolley, with login, product pages and checkout in a Coles screen"
git push
```

(`git add -A` is limited to those paths so the `git mv` is recorded; check `git status --short` shows nothing under `.superpowers/`.)

---

### Task 4: Shop sends to whichever store is picked

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: Task 2 `WeekdayFuelCart.colesCartLines/colesRemovalLines/sentAfter(…, key)`, `WeekdayFuelOrders.snapshot(…, {colesSent, colesId, colesProduct})/isEmpty(rows, sent, colesSent)/groupTitle`; Task 3 messages.

- [ ] **Step 1: Coles sent record and helpers.** After `function lsSetSent(s){…}` add:

```js
const COLES_SENT=LS+".colesSent";
function lsColesSent(){try{const s=JSON.parse(localStorage.getItem(COLES_SENT)||"null");return s&&typeof s.fingerprint==="string"&&s.lines&&typeof s.lines==="object"?s:null}catch(e){return null}}
function lsSetColesSent(s){try{s?localStorage.setItem(COLES_SENT,JSON.stringify(s)):localStorage.removeItem(COLES_SENT)}catch(e){}}
const sentFor=s=>s==="coles"?lsColesSent():lsSent();
const setSentFor=(s,v)=>s==="coles"?lsSetColesSent(v):lsSetSent(v);
const TROLLEY={woolies:{key:"stockcode",send:"sendTrolley",open:"openwoolies"},coles:{key:"productId",send:"sendColesTrolley",open:"opencoles"}};
```

Next to `wooliesProduct` add:

```js
function colesProduct(id){const W=WeekdayFuelCatalogue;for(const i of W.ITEMS){if(!i.coles)continue;for(const p of [i.coles,i.coles.small])if(p&&W.colesId(p)===String(id))return p}return null}
```

Add `woolies:"Woolworths only"` to `MANUAL_WHY`.

- [ ] **Step 2: Store-aware send.** Replace `trolleySend` and `sendTrolley`:

```js
/* A send: what's left to buy minus "I have it", plus quantity 0 for products the last send put in that the shop no longer needs */
function trolleySend(rows,haveIt,s){
  const sent=sentFor(s);
  if(s==="coles"){
    const W=WeekdayFuelCatalogue,c=WeekdayFuelCart.colesCartLines(rows,lsTicks(),haveIt,W.colesId);
    const rm=WeekdayFuelCart.colesRemovalLines(sent&&sent.lines,rows,W.colesId).map(l=>{const p=colesProduct(l.productId);return Object.assign({},l,{name:p?p.name:"Product "+l.productId,url:p?p.url:null})});
    return {lines:c.lines.concat(rm),manual:c.manual};
  }
  const c=WeekdayFuelCart.cartLines(rows,lsTicks(),haveIt);
  const rm=WeekdayFuelCart.removalLines(sent&&sent.lines,rows).map(l=>{const p=wooliesProduct(l.stockcode);return Object.assign({},l,{name:p?p.name:"Product "+l.stockcode,url:p?p.url:null})});
  return {lines:c.lines.concat(rm),manual:c.manual};
}
function sendTrolley(haveIt){
  const s=store(),t=trolleySend(shopRows(),haveIt,s);if(!t.lines.length)return;
  state.trolley={store:s,phase:"adding",completed:0,total:t.lines.length,lines:t.lines,manual:t.manual,fingerprint:WeekdayFuelCart.shopFingerprint(picks(),dayMeals(),fxDays())};
  WeekdayFuelHost.postMessage(JSON.stringify({type:TROLLEY[s].send,lines:t.lines}));
}
```

- [ ] **Step 3: Store-aware panel.** Change `renderTrolley(rows,ticks)` to `renderTrolley(rows,ticks,s)` with these edits (everything else unchanged):
  - `const t=state.trolley&&state.trolley.store===s?state.trolley:null,sent=sentFor(s),N=STORE_NAME[s],k=TROLLEY[s].key;`
  - Title: `<h3>${N} trolley</h3>`.
  - Idle: `trolleySend(rows,{},s)`; text `Puts the ${adds} ${N} product${…}`; button label `${sent?"Send again":"Send to "+N+" trolley"}`.
  - Pantry: `trolleySend(rows,t.haveIt,s)`; product name `const l=r[s]||r[other(s)];const name=r[s]?r[s].product.name:r.name;`.
  - Login: `Log in to ${N} in the window that opened. Sending carries on by itself once you're in.`
  - Adding: `s==="coles"?`<div class="small">Sending to Coles…</div>`:`<div class="small num">Adding ${t.completed} of ${t.total}…</div>``.
  - Done: `const byCode=Object.fromEntries(t.lines.map(l=>[l[k],l]));`, `isRm=r=>!!byCode[r[k]]&&byCode[r[k]].quantity===0;`, `const siteChanged=s==="coles"||failed.every(…existing…);`, the site-changed hint says `${N} may have changed their website…`, `lineRow` uses `byCode[r[k]]||{name:String(r[k])}` and its Open button uses `data-act="${TROLLEY[s].open}"`, and the Checkout button is `s==="coles"?`<button class="btn" data-act="colescheckout">Checkout</button>`:`<button class="btn" data-act="checkout">Checkout</button>``.

In `renderShop`, replace `if(st==="woolies")h+=renderTrolley(rows,ticks);` with `h+=renderTrolley(rows,ticks,st);`.

- [ ] **Step 4: Actions.** In the click handler:
  - `case "store":if(trolleyBusy())break;state.settings.store=v;saveSettings();if(state.trolley&&state.trolley.store!==v)state.trolley=null;break;`
  - `pantrycheck`: `case "pantrycheck":{const rows=shopRows(),s=store();if(pantryRows(rows,lsTicks()).length||trolleySend(rows,{},s).lines.some(l=>l.quantity===0))state.trolley={store:s,phase:"pantry",haveIt:{}};else sendTrolley({});break}` (every `state.trolley` now carries its store).
  - `sendtrolley` and `haveit` are unchanged; `sendTrolley` reads `store()`, which can't change while a trolley is open in the pantry phase because the store switch clears a trolley for the other store.
  - Add `case "colescheckout":if(state.trolley)state.trolley.checkedOut=true;WeekdayFuelHost.postMessage(JSON.stringify({type:"colesCheckout"}));break;`
  - Add `case "opencoles":WeekdayFuelHost.postMessage(JSON.stringify({type:"openColes",url:v}));return;`
  - `nextshop`: after `lsSetSent(null);` add `lsSetColesSent(null);`.

- [ ] **Step 5: Messages.** In the host message listener replace the trolley block with:

```js
    const t=state.trolley;if(!t)return;
    const live=(t.phase==="adding"||t.phase==="login")&&Array.isArray(t.lines);
    const s=t.store==="coles"?"coles":"woolies",pre=s==="coles"?"colesTrolley":"trolley";
    if(typeof m.type!=="string"||!m.type.startsWith(pre))return;
    const ty=m.type.slice(pre.length);
    if(ty==="Login"){if(!live)return;t.phase="login"}
    else if(ty==="Progress"){if(t.phase!=="adding"&&t.phase!=="login")return;t.phase="adding";t.completed=m.completed;t.total=m.total}
    else if(ty==="Done"){if(!live)return;t.phase="done";t.results=Array.isArray(m.results)?m.results:[];const old=sentFor(s);setSentFor(s,{at:new Date().toISOString(),fingerprint:t.fingerprint,lines:WeekdayFuelCart.sentAfter(old&&old.lines,t.lines,t.results,TROLLEY[s].key)})}
    else if(ty==="Error"){if(!live)return;t.phase="error";t.message=m.message}
    else return;
    if(state.tab==="shop")render();
```

(Woolworths `trolley*` messages only act on a Woolworths send and `colesTrolley*` messages only on a Coles send; `"colesTrolleyDone".startsWith("trolley")` is false.)

- [ ] **Step 6: Orders.** In `nextShopBtn`: `save=!WeekdayFuelOrders.isEmpty(shopRows(),(lsSent()||{}).lines,(lsColesSent()||{}).lines)`. In `trySaveOrder`: `const colesLines=(lsColesSent()||{}).lines||{};`, `if(WeekdayFuelOrders.isEmpty(rows,lines,colesLines))return true;`, and add to the snapshot options `colesSent:colesLines,colesId:WeekdayFuelCatalogue.colesId,colesProduct:colesProduct`. In the `renderShop` empty-list check, also require `!Object.keys((lsColesSent()||{lines:{}}).lines).length`. In `renderPastOrders`, use `O.groupTitle(o,k)` instead of `O.GROUP_TITLES[k]`, and show the store prefix on an ordered item when it differs from the order's store: `(k==="buy"||(k==="ordered"&&i.store!==(o.store==="coles"?"coles":"woolies")))&&i.store?…`.

- [ ] **Step 7: Run JS tests and the parse check** (both commands above): 127 pass; `node --check` silent.

- [ ] **Step 8: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "coles: Build a shop sends to the Coles trolley when Coles is picked, with login, summary, checkout and saved orders"
git push
```

- [ ] **Step 9 (controller): browser check with a fake host.** Serve `apps/android/app/src/main/assets` on `127.0.0.1:8123`, inject a fake `WeekdayFuelHost` before `catalogue.js`, use the starter shop:
  - Woolworths picked: the Woolworths panel and its send message are unchanged (`sendTrolley`, stockcodes).
  - Coles picked: the panel reads "Coles trolley", "Send to Coles trolley"; after the pantry step it posts one `sendColesTrolley` whose lines are `{productId: digits, quantity: whole number, name, url, itemId}`; "Sending to Coles…" shows; switching store is ignored while sending.
  - Reply `colesTrolleyLogin`: the login text; then `colesTrolleyDone` with one failed product: summary Added/Couldn't add (Open posts `openColes` with the product URL), "Add these yourself" lists Woolworths-only items as "Woolworths only"; `weekdayfuel.v1.colesSent` holds the added lines; a `trolleyDone` (Woolworths) reply now changes nothing.
  - Checkout posts `colesCheckout`; then Save order: the past order shows "Ordered on Coles" with the sent items.
  - Remove a meal: the panel offers to take out its products (quantity 0 lines) on the next send.
  - A Coles product name containing `<img src=x onerror=alert(1)>` renders as text.

---

### Task 5: Release v0.8.0

**Files:**
- Modify: `apps/android/app/build.gradle.kts` (`versionCode`, `versionName`)
- Modify: `docs/superpowers/specs/2026-10-16-coles-trolley-design.md` (status line)

- [ ] **Step 1:** In `build.gradle.kts` change `versionCode = 13` to `versionCode = 14` and `versionName = "0.7.1"` to `versionName = "0.8.0"`.
- [ ] **Step 2:** In the spec, change `**Status:** approved 2026-10-16` to `**Status:** approved 2026-10-16; v0.8.0 released 2026-10-16, owner phone checks pending`.
- [ ] **Step 3: Commit, push, watch CI, check the release.**

```powershell
git add apps/android/app/build.gradle.kts docs/superpowers/specs/2026-10-16-coles-trolley-design.md
git commit -m "release: v0.8.0"
git push
```

Watch CI, then `gh release view v0.8.0 -R Evzy/weekday-fuel-releases --json tagName,assets --jq '.tagName, .assets[].name'` → `v0.8.0` and `WeekdayFuel-v0.8.0-debug.apk`.
