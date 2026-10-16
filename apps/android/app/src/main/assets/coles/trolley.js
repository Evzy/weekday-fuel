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
