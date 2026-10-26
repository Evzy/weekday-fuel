/* Compute meal portion k/p/c/f from catalogue AMOUNTS × per-store panels. */
(function (root) {
  "use strict";

  var TIERS = ["L", "S", "X"];

  var EXTRA_UNITS = {
    spray: { unit: "g" },
    butter: { unit: "g" },
    sourdough: { unit: "g" },
    lightmayo: { unit: "g" },
    avocado: { unit: "g" },
    sesameseed: { unit: "g" },
    kewpie: { unit: "g" },
    tasty: { unit: "g" },
    paprika: { unit: "g" },
    olive: { unit: "mL" },
    fishsauce: { unit: "mL" },
    tomsauce: { unit: "mL" },
    vegoil: { unit: "mL" },
  };

  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  function round0(x) {
    return Math.round(x);
  }

  function round2(x) {
    return Math.round(x * 100) / 100;
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

  function fallbackPanelKey(item, store) {
    if (!item) return null;
    var p = item[store];
    if (p && p.fallbackPanelKey) return p.fallbackPanelKey;
    if (item.coles && item.coles.fallback) return item.id + "-fallback";
    if (item.woolies && item.woolies.fallback) return item.id + "-fallback";
    return null;
  }

  function panelBag(panels, itemId, store, item, opts) {
    opts = opts || {};
    if (opts.useFallback && item) {
      var fbKey = fallbackPanelKey(item, store);
      if (fbKey && panels[fbKey]) return panels[fbKey];
    }
    return panels[itemId] || null;
  }

  function pickPanel(bag, store) {
    if (!bag) return null;
    if (bag[store]) return bag[store];
    if (bag.any) return bag.any;
    if (bag.woolies) return bag.woolies;
    if (bag.coles) return bag.coles;
    return null;
  }

  function panelForItem(panels, itemId, store, item, opts) {
    return pickPanel(panelBag(panels, itemId, store, item, opts), store);
  }

  function panelForSwap(panels, swapId, store) {
    var bag = panels[swapId];
    if (!bag) return null;
    if (bag[store]) return bag[store];
    if (bag.any) return bag.any;
    if (bag.woolies) return bag.woolies;
    if (bag.coles) return bag.coles;
    return null;
  }

  function massForAmount(amount, item, spec) {
    if (!(amount > 0)) return 0;
    if (spec && spec._ml) return amount;
    if (!item) return amount;
    var unit = item.unit;
    var unitSize = item.unitSize;
    if (unit === "eggs" || unit === "slices" || unit === "wraps" || unit === "muffins" || unit === "fillets" || unit === "bars" || unit === "bottles") {
      return amount * (unitSize || 1);
    }
    if (unit === "pouches") return amount * (unitSize || 250);
    if (unit === "mL") return amount;
    return amount;
  }

  function macrosFromPanel(panel, amount, item, spec) {
    if (!panel || !(amount > 0)) return { k: 0, p: 0, c: 0, f: 0, fib: 0 };
    var useDirectMl = (spec && spec._ml) || (item && item.unit === "mL");
    var mass = useDirectMl ? amount : massForAmount(amount, item, spec);
    var per = 100;
    var factor = mass / per;
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

  function resolveItem(id, itemFn) {
    var it = itemFn(id);
    if (it) return it;
    var ex = EXTRA_UNITS[id];
    if (ex) return { id: id, unit: ex.unit };
    return null;
  }

  function create(deps) {
    var panels = deps.panels;
    var amounts = deps.amounts;
    var extraAmounts = deps.extraAmounts || {};
    var itemFn = deps.item;
    var defaultStore = deps.defaultStore || "woolies";

    function servePer(mainItem, swap, store) {
      if (!mainItem) return null;
      store = store || defaultStore;
      var panel = swap ? panelForSwap(panels, swap.id, store) : panelForItem(panels, mainItem.id, store, mainItem, {});
      if (!panel) return null;
      var useMl = panel.per === "100mL" && (mainItem.unit === "bottles" || mainItem.unit === "mL");
      var spec = useMl ? { _ml: true } : null;
      var amt = 1;
      if (useMl) amt = mainItem.unitSize || 1;
      return macrosFromPanel(panel, amt, mainItem, spec);
    }

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
        var item = resolveItem(itemId, itemFn);
        var panel = panelForItem(panels, itemId, store, item, { useFallback: opts.useFallback });
        total = addMacros(total, macrosFromPanel(panel, amt, item, spec));
      });
      var extras = extraAmounts[mealId];
      if (extras) {
        Object.keys(extras).forEach(function (itemId) {
          var es = extras[itemId];
          if (!tierApplies(es, tier)) return;
          var amt = amountForTier(es, tier);
          if (!(amt > 0)) return;
          var item = resolveItem(itemId, itemFn);
          var panel = panelForItem(panels, itemId, store, item, {});
          total = addMacros(total, macrosFromPanel(panel, amt, item, es));
        });
      }
      total.k = round0(total.k);
      return total;
    }

    function stapleMacros(id, amount, store, swap) {
      var item = resolveItem(id, itemFn);
      if (!item || !(amount > 0)) return null;
      if (swap) {
        if (swap.hidden) return null;
        var perServe = servePer(item, swap, store);
        if (!perServe) return null;
        return {
          k: round2(perServe.k * amount),
          p: round2(perServe.p * amount),
          c: round2(perServe.c * amount),
          f: round2(perServe.f * amount),
        };
      }
      var panel = panelForItem(panels, id, store, item, {});
      return macrosFromPanel(panel, amount, item, null);
    }

    return {
      portion: portion,
      tierApplies: tierApplies,
      amountForTier: amountForTier,
      stapleMacros: stapleMacros,
      servePer: servePer,
      panelForItem: function (id, store, useFallback) {
        return panelForItem(panels, id, store, resolveItem(id, itemFn), { useFallback: useFallback });
      },
      panelBag: function (id, store, useFallback) {
        return panelBag(panels, id, store, resolveItem(id, itemFn), { useFallback: useFallback });
      },
    };
  }

  var api = { create: create, TIERS: TIERS, EXTRA_UNITS: EXTRA_UNITS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelMealCalc = api;
})(this);
