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

  function wasUpdated(json, stockcode) {
    var items = (json && json.UpdatedItems) || [];
    return items.some(function (item) { return item.Stockcode === stockcode; });
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

  async function checkLogin() {
    var r = await fetch(LOGIN_STATUS_URL, { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("login check HTTP " + r.status);
    return isLoggedIn(await r.json());
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
      if (wasUpdated(await r.json(), line.stockcode)) return { stockcode: line.stockcode, outcome: "added" };
      return { stockcode: line.stockcode, outcome: "failed", reason: "not available" };
    } catch (e) {
      return { stockcode: line.stockcode, outcome: "failed", reason: String((e && e.message) || e) };
    }
  }

  async function run(lines) {
    state = { phase: "checking", total: lines.length, completed: 0, results: [], error: null };
    try {
      if (!(await checkLogin())) {
        state.phase = "loggedOut";
        return;
      }
      state.phase = "adding";
      for (var i = 0; i < lines.length; i++) {
        state.results.push(await setQuantity(lines[i]));
        state.completed = i + 1;
      }
      state.phase = "done";
    } catch (e) {
      state.phase = "error";
      state.error = String((e && e.message) || e);
    }
  }

  window.__weekdayFuelTrolley = {
    start: function (lines) { run(lines); return true; },
    state: function () { return JSON.stringify(state); },
    urls: { loginStatus: LOGIN_STATUS_URL, trolleyUpdate: TROLLEY_UPDATE_URL },
  };
})();
