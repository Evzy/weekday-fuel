/* Coles and Woolworths products for every Shop item, and the shopping maths. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  /* A small pack is used while the need is at most this much over its size (in the item's unit). */
  var SMALL_PACK_SLACK = 50;

  /* Filled from docs/catalogue-research.md in Task 3. */
  var ITEMS = [];
  var AMOUNTS = {};

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  /* Deli counters sell by 100 g, minimum 100 g. Round up so the owner never runs short. */
  function deliGrams(needGrams) {
    return Math.max(100, Math.ceil(needGrams / 100) * 100);
  }

  function packLabel(product, unit) {
    return product.size + (/^(g|mL)$/.test(unit) ? unit : " " + unit);
  }

  function storeLine(item, product, need) {
    if (product.perKg) {
      var grams = deliGrams(need);
      return { product: product, quantity: grams / 1000, cost: round2((grams / 1000) * product.price), buy: grams + "g from the deli" };
    }
    var useSmall = product.small && need <= product.small.size + SMALL_PACK_SLACK;
    var chosen = useSmall ? product.small : product;
    var packs = useSmall ? 1 : Math.max(1, Math.ceil(need / chosen.size - 1e-9));
    return {
      product: chosen,
      quantity: packs,
      cost: round2(packs * chosen.price),
      buy: chosen.size === 1 ? packs + " " + item.unit : packs + " × " + packLabel(chosen, item.unit),
    };
  }

  function create(items, amounts) {
    var byId = {};
    items.forEach(function (it) {
      byId[it.id] = it;
    });

    function shopList(picks, fixtureDays) {
      var need = {};
      var used = {};
      Object.keys(picks).forEach(function (meal) {
        var serves = picks[meal];
        var per = amounts[meal];
        if (!serves || !per) return;
        Object.keys(per).forEach(function (id) {
          need[id] = (need[id] || 0) + per[id] * serves;
          (used[id] = used[id] || []).push(meal);
        });
      });
      if (fixtureDays > 0) {
        items.forEach(function (it) {
          if (it.sec === 0) need[it.id] = fixtureDays;
        });
      }
      return items
        .filter(function (it) {
          return need[it.id] > 0;
        })
        .map(function (it) {
          var n = need[it.id];
          return {
            id: it.id,
            sec: it.sec,
            name: it.name,
            unit: it.unit,
            need: n,
            used: used[it.id] || [],
            coles: it.coles ? storeLine(it, it.coles, n) : null,
            woolies: it.woolies ? storeLine(it, it.woolies, n) : null,
          };
        });
    }

    function storeTotals(rows, store, ticks) {
      var t = { total: 0, left: 0, missed: [] };
      rows.forEach(function (r) {
        var line = r[store];
        if (!line) {
          t.missed.push(r.id);
          return;
        }
        t.total += line.cost;
        if (!ticks[r.id]) t.left += line.cost;
      });
      t.total = round2(t.total);
      t.left = round2(t.left);
      return t;
    }

    function mealCost(meal, store) {
      var per = amounts[meal];
      if (!per) return null;
      var other = store === "coles" ? "woolies" : "coles";
      var sum = 0;
      Object.keys(per).forEach(function (id) {
        var it = byId[id];
        var p = it && (it[store] || it[other]);
        if (!p) return;
        sum += p.perKg ? (per[id] / 1000) * p.price : (per[id] / p.size) * p.price;
      });
      return round2(sum);
    }

    function usedIn(id) {
      return Object.keys(amounts).filter(function (meal) {
        return id in amounts[meal];
      });
    }

    function colesChecked() {
      var dates = [];
      items.forEach(function (it) {
        if (!it.coles) return;
        dates.push(it.coles.checked);
        if (it.coles.small) dates.push(it.coles.small.checked);
      });
      return dates.sort()[0] || null;
    }

    return {
      ITEMS: items,
      AMOUNTS: amounts,
      item: function (id) {
        return byId[id];
      },
      deliGrams: deliGrams,
      shopList: shopList,
      storeTotals: storeTotals,
      mealCost: mealCost,
      usedIn: usedIn,
      colesChecked: colesChecked,
    };
  }

  var api = create(ITEMS, AMOUNTS);
  api.create = create;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCatalogue = api;
})(this);
