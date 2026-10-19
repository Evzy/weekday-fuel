/* Specials: suggest and apply approved swap products when on special. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var round2 = function (x) {
    return Math.round(x * 100) / 100;
  };
  var round1 = function (x) {
    return Math.round(x * 10) / 10;
  };

  function cloneProduct(p, live) {
    if (!p) return p;
    var o = {};
    Object.keys(p).forEach(function (k) {
      o[k] = p[k];
    });
    if (!live) return o;
    if (live.price > 0) o.price = live.price;
    o.was = live.was > o.price ? live.was : null;
    o.special = !!live.special;
    o.available = live.available !== false;
    o.live = true;
    return o;
  }

  function cloneSwap(s, wPrices, cPrices, colesId) {
    var out = {
      id: s.id,
      name: s.name,
      serves: s.serves,
      per: { k: s.per.k, p: s.per.p },
    };
    if (s.woolies) {
      var wl = wPrices && s.woolies.stockcode != null ? wPrices[s.woolies.stockcode] : null;
      out.woolies = cloneProduct(s.woolies, wl);
    }
    if (s.coles) {
      var cid = colesId(s.coles);
      var cl = cPrices && cid ? cPrices[cid] : null;
      out.coles = cloneProduct(s.coles, cl);
    }
    return out;
  }

  function swapIds(items, colesId) {
    var stockcodes = [];
    var colesIds = [];
    (items || []).forEach(function (it) {
      if (!it || !it.swaps) return;
      it.swaps.forEach(function (s) {
        if (s.woolies && s.woolies.stockcode) stockcodes.push(s.woolies.stockcode);
        if (s.coles) {
          var id = colesId(s.coles);
          if (id) colesIds.push(String(id));
        }
      });
    });
    return { stockcodes: stockcodes, colesIds: colesIds };
  }

  function applySwapPrices(items, wPrices, cPrices, colesId) {
    if (!wPrices && !cPrices) return items;
    return (items || []).map(function (it) {
      if (!it || !it.swaps || !it.swaps.length) return it;
      var out = {};
      Object.keys(it).forEach(function (k) {
        if (k !== "swaps") out[k] = it[k];
      });
      out.swaps = it.swaps.map(function (s) {
        return cloneSwap(s, wPrices, cPrices, colesId);
      });
      return out;
    });
  }

  function passesGuard(main, swap) {
    if (!main || !main.per || !swap || !swap.per) return false;
    return swap.per.p >= main.per.p - 5 && swap.per.k <= main.per.k + 80;
  }

  function isMuted(muted, key) {
    if (!muted) return false;
    if (typeof muted.has === "function") return muted.has(key);
    return muted.indexOf(key) >= 0;
  }

  function suggest(row, item, store, muted, onlyId) {
    if (!row || !item || !item.swaps || !item.per) return null;
    var remaining = Math.max(0, row.need - (row.have || 0));
    if (!(remaining > 0)) return null;
    var mainLine = row[store];
    var mainCost = mainLine && typeof mainLine.cost === "number" ? mainLine.cost : Infinity;
    var best = null;
    item.swaps.forEach(function (swap) {
      if (onlyId && swap.id !== onlyId) return;
      if (!onlyId && isMuted(muted, item.id + ":" + swap.id)) return;
      if (!passesGuard(item, swap)) return;
      var product = swap[store];
      if (!product) return;
      if (!product.special) return;
      if (product.available === false) return;
      var quantity = Math.ceil(remaining / swap.serves);
      var cost = round2(quantity * product.price);
      if (!(cost < mainCost)) return;
      if (!best || cost < best.cost) {
        best = {
          swap: swap,
          product: product,
          quantity: quantity,
          cost: cost,
          saving: mainCost === Infinity ? null : round2(mainCost - cost),
          dk: swap.per.k - item.per.k,
          dp: round1(swap.per.p - item.per.p),
        };
      }
    });
    return best;
  }

  function useSwap(row, store, s) {
    var out = {};
    Object.keys(row).forEach(function (k) {
      out[k] = row[k];
    });
    out[store] = {
      product: s.product,
      quantity: s.quantity,
      cost: s.cost,
      buy: s.quantity + " × " + s.swap.name,
      swap: s.swap.id,
    };
    return out;
  }

  function applyChoices(rows, items, store, choices, muted) {
    choices = choices || {};
    var byId = {};
    (items || []).forEach(function (it) {
      if (it && it.id) byId[it.id] = it;
    });
    var used = {};
    var outRows = (rows || []).map(function (row) {
      if (!row || !row.id) return row;
      var ch = choices[row.id];
      if (!ch || !ch.use) return row;
      var it = byId[row.id];
      if (!it) return row;
      var s = suggest(row, it, store, muted, ch.use);
      if (!s) return row;
      used[row.id] = ch.use;
      return useSwap(row, store, s);
    });
    return { rows: outRows, used: used };
  }

  var api = {
    swapIds: swapIds,
    applySwapPrices: applySwapPrices,
    passesGuard: passesGuard,
    suggest: suggest,
    useSwap: useSwap,
    applyChoices: applyChoices,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelSpecials = api;
})(this);
