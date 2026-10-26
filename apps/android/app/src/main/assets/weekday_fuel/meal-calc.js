/* Compute meal portion k/p/c/f from catalogue AMOUNTS × per-store panels. */
(function (root) {
  "use strict";

  var TIERS = ["L", "S", "X"];

  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  function round0(x) {
    return Math.round(x);
  }

  function tierApplies(spec, tier) {
    if (!spec) return false;
    if (typeof spec === "number") return spec > 0;
    if (typeof spec !== "object") return false;
    return (spec[tier] || 0) > 0;
  }

  function amountForTier(spec, tier) {
    if (spec == null) return 0;
    if (typeof spec === "number") return spec;
    return spec[tier] || 0;
  }

  function panelForItem(panels, itemId, store, item, useFallback) {
    var p = panels[itemId];
    if (!p) return null;
    if (useFallback && item && item.coles && item.coles.fallback && store === "coles") {
      /* Fallback product uses its own panel when present (bread Helga's). */
      var fb = item.coles.fallback.panelKey || "bread-fallback";
      if (panels[fb]) return panels[fb].any || panels[fb].coles || panels[fb].woolies;
    }
    if (p[store]) return p[store];
    if (p.any) return p.any;
    if (p.woolies) return p.woolies;
    if (p.coles) return p.coles;
    return null;
  }

  function macrosFromPanel(panel, amount, item) {
    if (!panel || !(amount > 0)) return { k: 0, p: 0, c: 0, f: 0, fib: 0 };
    var unit = item && item.unit;
    var unitSize = item && item.unitSize;
    var grams = amount;
    if (unit === "eggs" || unit === "slices" || unit === "wraps" || unit === "muffins" || unit === "fillets" || unit === "bars" || unit === "bottles") {
      grams = amount * (unitSize || 1);
    } else if (unit === "pouches") {
      grams = amount * (unitSize || 250);
    } else if (unit === "cucumbers" || unit === "capsicums") {
      grams = amount * (unitSize || 1);
    }
    var per = panel.per === "100mL" ? 100 : 100;
    var factor = grams / per;
    if (unit === "mL" || (item && item.id && panel.per === "100mL" && unit === "g")) {
      factor = amount / per;
    }
    return {
      k: round1((panel.k || 0) * factor),
      p: round1((panel.p || 0) * factor),
      c: round1((panel.c || 0) * factor),
      f: round1((panel.f || 0) * factor),
      fib: round1((panel.fib || 0) * factor),
    };
  }

  function addMacros(a, b) {
    return {
      k: round1(a.k + b.k),
      p: round1(a.p + b.p),
      c: round1(a.c + b.c),
      f: round1(a.f + b.f),
      fib: round1((a.fib || 0) + (b.fib || 0)),
    };
  }

  function create(deps) {
    var panels = deps.panels;
    var amounts = deps.amounts;
    var extraAmounts = deps.extraAmounts || {};
    var itemFn = deps.item;
    var defaultStore = deps.defaultStore || "woolies";

    function portion(mealId, tier, store, opts) {
      opts = opts || {};
      store = store || opts.store || defaultStore;
      var mealAmounts = amounts[mealId];
      if (!mealAmounts) return { k: 0, p: 0, c: 0, f: 0, fib: 0 };
      var total = { k: 0, p: 0, c: 0, f: 0, fib: 0 };
      Object.keys(mealAmounts).forEach(function (itemId) {
        var spec = mealAmounts[itemId];
        var amt = amountForTier(spec, tier);
        if (!(amt > 0)) return;
        var item = itemFn(itemId);
        var panel = panelForItem(panels, itemId, store, item, opts.useFallback);
        total = addMacros(total, macrosFromPanel(panel, amt, item));
      });
      var extras = extraAmounts[mealId];
      if (extras) {
        Object.keys(extras).forEach(function (itemId) {
          var es = extras[itemId];
          if (!tierApplies(es, tier)) return;
          var amt = amountForTier(es, tier);
          if (!(amt > 0)) return;
          var item = itemFn(itemId);
          var panel = panelForItem(panels, itemId, store, item, false);
          total = addMacros(total, macrosFromPanel(panel, amt, item));
        });
      }
      total.k = round0(total.k);
      return total;
    }

    function portionKcal(mealId, tier, store, opts) {
      return portion(mealId, tier, store, opts).k;
    }

    return { portion: portion, portionKcal: portionKcal, tierApplies: tierApplies, amountForTier: amountForTier };
  }

  var api = { create: create, TIERS: TIERS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelMealCalc = api;
})(this);
