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
