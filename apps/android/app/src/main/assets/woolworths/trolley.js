/* Injected into woolworths.com.au by WoolworthsSession. Sets trolley quantities with the site's own requests. */
(function () {
  "use strict";
  if (window.__weekdayFuelTrolley) return;

  var LOGIN_STATUS_URL = "/api/ui/v2/bootstrap";
  var TROLLEY_UPDATE_URL = "/api/v3/ui/trolley/update";
  var state = { phase: "idle", total: 0, completed: 0, results: [], error: null };

  function isLoggedIn(json) {
    return Boolean(json && json.ShopperRequest && json.ShopperRequest.IsGuest === false);
  }

  function trolleyStockcodes(json) {
    var tr = json && json.TrolleyRequest;
    if (!tr) return [];
    var seen = {};
    var out = [];
    function push(items) {
      if (!items || !items.length) return;
      for (var i = 0; i < items.length; i++) {
        if (!items[i] || items[i].Stockcode == null) continue;
        var code = items[i].Stockcode;
        if (seen[code]) continue;
        seen[code] = true;
        out.push(code);
      }
    }
    push(tr.AvailableItems);
    push(tr.UnavailableItems);
    return out;
  }

  function allowedCodes(keep, lines) {
    var s = {};
    if (keep) {
      for (var i = 0; i < keep.length; i++) s[keep[i]] = true;
    }
    for (var j = 0; j < lines.length; j++) s[lines[j].stockcode] = true;
    return s;
  }

  function updatedItem(json, stockcode) {
    var items = (json && json.UpdatedItems) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].Stockcode === stockcode) return items[i];
    }
    return null;
  }

  function formatTrolleyQty(n) {
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return String(n);
  }

  function updateBody(line) {
    return {
      items: [{
        stockcode: line.stockcode,
        quantity: line.quantity,
        source: "ProductDetail",
        diagnostics: "0",
        searchTerm: null,
        evaluateRewardPoints: false,
        offerId: null,
        profileId: null,
        priceLevel: null,
      }],
    };
  }

  async function fetchBootstrap() {
    var r = await fetch(LOGIN_STATUS_URL, { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("login check HTTP " + r.status);
    return r.json();
  }

  async function setQuantity(line) {
    try {
      var r = await fetch(TROLLEY_UPDATE_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(updateBody(line)),
      });
      if (!r.ok) return { stockcode: line.stockcode, outcome: "failed", reason: "HTTP " + r.status };
      var json = await r.json();
      /* Woolworths answers a removal with an empty UpdatedItems, exactly like an unknown stockcode. */
      if (line.quantity === 0) return { stockcode: line.stockcode, outcome: "removed" };
      var hit = updatedItem(json, line.stockcode);
      if (!hit) return { stockcode: line.stockcode, outcome: "failed", reason: "not available" };
      var inTrolley = hit.QuantityInTrolley;
      /* Weighed lines are sent in kilograms; their QuantityInTrolley unit is unconfirmed, so only whole counts are checked. */
      if (Number.isInteger(line.quantity) && typeof inTrolley === "number" && isFinite(inTrolley) && Math.abs(inTrolley - line.quantity) > 1e-6) {
        return { stockcode: line.stockcode, outcome: "failed", reason: "trolley has " + formatTrolleyQty(inTrolley) };
      }
      return { stockcode: line.stockcode, outcome: "added" };
    } catch (e) {
      return { stockcode: line.stockcode, outcome: "failed", reason: String((e && e.message) || e) };
    }
  }

  async function run(lines, keep) {
    state = { phase: "checking", total: lines.length, completed: 0, results: [], error: null };
    try {
      var bootstrap = await fetchBootstrap();
      if (!isLoggedIn(bootstrap)) {
        state.phase = "loggedOut";
        return;
      }
      var extras = [];
      if (keep) {
        var ok = allowedCodes(keep, lines);
        var codes = trolleyStockcodes(bootstrap);
        for (var c = 0; c < codes.length; c++) {
          var code = codes[c];
          if (!ok[code]) extras.push({ stockcode: code, quantity: 0 });
        }
      }
      state.phase = "adding";
      state.total = extras.length + lines.length;
      state.completed = 0;
      var n = 0;
      for (var e = 0; e < extras.length; e++) {
        var er = await setQuantity(extras[e]);
        er.extra = true;
        state.results.push(er);
        n++;
        state.completed = n;
      }
      for (var i = 0; i < lines.length; i++) {
        state.results.push(await setQuantity(lines[i]));
        n++;
        state.completed = n;
      }
      state.phase = "done";
    } catch (e) {
      state.phase = "error";
      state.error = String((e && e.message) || e);
    }
  }

  window.__weekdayFuelTrolley = {
    start: function (lines, keep) {
      if (state.phase === "checking" || state.phase === "adding") return false;
      run(lines, keep);
      return true;
    },
    state: function () { return JSON.stringify(state); },
    urls: { loginStatus: LOGIN_STATUS_URL, trolleyUpdate: TROLLEY_UPDATE_URL },
  };
})();
