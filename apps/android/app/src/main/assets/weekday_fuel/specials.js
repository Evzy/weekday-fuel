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
    o.special = !!live.special;
    o.available = live.available !== false;
    if (typeof live.price === "number" && live.price > 0) {
      o.price = live.price;
      o.was = typeof live.was === "number" && live.was > live.price ? live.was : null;
      o.live = true;
    }
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

  function singularUnit(unit) {
    if (/^(g|mL)$/.test(unit)) return unit;
    return unit.replace(/(ch|sh|x)es$/, "$1").replace(/s$/, "");
  }

  function swapBuyText(quantity, serves, unit) {
    unit = unit || "items";
    if (serves === 1) {
      return quantity + " " + (quantity <= 1 ? singularUnit(unit) : unit);
    }
    return quantity + " × " + serves + " " + unit;
  }

  function keepBlocksStore(ch, store) {
    if (!ch || !ch.keep) return false;
    if (ch.keep === true) return true;
    return !!(ch.keep && typeof ch.keep === "object" && ch.keep[store]);
  }

  function hasAnyKeep(ch) {
    if (!ch || !ch.keep) return false;
    if (ch.keep === true) return true;
    if (typeof ch.keep !== "object") return false;
    return Object.keys(ch.keep).some(function (k) {
      return ch.keep[k];
    });
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
      var quantity = Math.ceil(remaining / swap.serves - 1e-9);
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

  function idInSent(sentIds, id) {
    if (id == null || !sentIds) return false;
    var key = String(id);
    if (typeof sentIds.has === "function") return sentIds.has(key);
    for (var i = 0; i < sentIds.length; i++) {
      if (String(sentIds[i]) === key) return true;
    }
    return false;
  }

  function productSentId(product, store, colesId) {
    if (!product) return null;
    if (store === "woolies") return product.stockcode != null ? product.stockcode : null;
    return colesId ? colesId(product) : null;
  }

  function resolveUseChoice(row, item, store, swapId, muted, sentIds, colesId) {
    var s = suggest(row, item, store, muted, swapId);
    if (s) return s;
    if (!sentIds) return null;
    var remaining = Math.max(0, row.need - (row.have || 0));
    if (!(remaining > 0)) return null;
    var swap = null;
    (item.swaps || []).forEach(function (sw) {
      if (sw.id === swapId) swap = sw;
    });
    if (!swap) return null;
    var product = swap[store];
    if (!product || product.available === false) return null;
    if (!idInSent(sentIds, productSentId(product, store, colesId))) return null;
    var quantity = Math.ceil(remaining / swap.serves - 1e-9);
    return {
      swap: swap,
      product: product,
      quantity: quantity,
      cost: round2(quantity * product.price),
      saving: null,
      dk: swap.per.k - item.per.k,
      dp: round1(swap.per.p - item.per.p),
    };
  }

  function useSwap(row, store, s, unit) {
    var out = {};
    Object.keys(row).forEach(function (k) {
      out[k] = row[k];
    });
    out[store] = {
      product: s.product,
      quantity: s.quantity,
      cost: s.cost,
      buy: swapBuyText(s.quantity, s.swap.serves, unit),
      swap: s.swap.id,
      saved: s.saving,
    };
    return out;
  }

  function applyChoices(rows, items, store, choices, muted, sentIds, colesId) {
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
      if (ch.useStore && ch.useStore !== store) return row;
      var it = byId[row.id];
      if (!it) return row;
      var s = resolveUseChoice(row, it, store, ch.use, muted, sentIds, colesId);
      if (!s) return row;
      used[row.id] = ch.use;
      return useSwap(row, store, s, it.unit);
    });
    return { rows: outRows, used: used };
  }

  var api = {
    swapIds: swapIds,
    applySwapPrices: applySwapPrices,
    passesGuard: passesGuard,
    suggest: suggest,
    swapBuyText: swapBuyText,
    keepBlocksStore: keepBlocksStore,
    hasAnyKeep: hasAnyKeep,
    useSwap: useSwap,
    applyChoices: applyChoices,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelSpecials = api;
})(this);
