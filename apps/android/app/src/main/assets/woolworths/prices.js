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
