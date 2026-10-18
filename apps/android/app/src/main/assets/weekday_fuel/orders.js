/* Past orders: the snapshot saved when a shop is finished, and the stored list. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var KEEP = 30;
  var GROUPS = ["ordered", "had", "pantry", "buy"];
  var GROUP_TITLES = { ordered: "Ordered on Woolworths", had: "Already had", pantry: "Pantry, presumed at home", buy: "Buy yourself" };
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DATE = /^\d{4}-\d{2}-\d{2}$/;

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function money(n) {
    return "$" + n.toFixed(2);
  }

  function isQty(q) {
    return typeof q === "number" && isFinite(q) && q > 0;
  }

  /* Same sent-line checks as snapshot / inventory stock-in. Returns { product, qty } or null. */
  function sentLineQty(row, sent, colesSent, colesId) {
    if (!row || typeof row !== "object") return null;
    var w = row.woolies;
    var gone = row.wooliesUnavailable;
    var c = row.coles;
    var cGone = row.colesUnavailable;
    var idFn = typeof colesId === "function" ? colesId : function () { return null; };
    var cId = c ? idFn(c.product) : null;
    var cGoneId = cGone ? idFn(cGone) : null;
    var s = sent || {};
    var cs = colesSent || {};
    if (w && isQty(s[w.product.stockcode])) return { product: w.product, qty: s[w.product.stockcode] };
    if (w && w.alts) {
      for (var ai = 0; ai < w.alts.length; ai++) {
        var wAlt = w.alts[ai];
        if (isQty(s[wAlt.stockcode])) return { product: wAlt, qty: s[wAlt.stockcode] };
      }
    }
    if (gone && isQty(s[gone.stockcode])) return { product: gone, qty: s[gone.stockcode] };
    if (cId && isQty(cs[cId])) return { product: c.product, qty: cs[cId] };
    if (c && c.alts) {
      for (var ci = 0; ci < c.alts.length; ci++) {
        var cAlt = c.alts[ci];
        var altId = idFn(cAlt);
        if (altId && isQty(cs[altId])) return { product: cAlt, qty: cs[altId] };
      }
    }
    if (cGoneId && isQty(cs[cGoneId])) return { product: cGone, qty: cs[cGoneId] };
    return null;
  }

  function rowHasSentLine(row, sent, colesSent, colesId) {
    return sentLineQty(row, sent, colesSent, colesId) !== null;
  }

  function isDate(d) {
    return typeof d === "string" && DATE.test(d);
  }

  function validMeal(m) {
    return !!m && typeof m.name === "string" && isQty(m.serves);
  }

  function amount(product, qty) {
    if (product.perKg) return Math.round(qty * 1000) + "g";
    if (product.sizeLabel && String(product.sizeLabel).length) return qty + " × " + product.sizeLabel;
    return qty + (qty === 1 ? " pack" : " packs");
  }

  /* `line` is the shop's own line for this product, used when the sent amount matches it. */
  function orderedItem(line, product, qty, note, forText, store) {
    var same = !!line && Math.abs(qty - line.quantity) < 1e-9;
    return {
      name: String(product.name),
      buy: same ? line.buy : amount(product, qty),
      cost: same ? line.cost : typeof product.price === "number" ? round2(qty * product.price) : null,
      store: store || "woolies",
      note: note,
      for: forText,
    };
  }

  function snapshot(rows, ticks, sentLines, opts) {
    var o = opts || {};
    var at = typeof o.at === "string" && !isNaN(Date.parse(o.at)) ? o.at : new Date().toISOString();
    var sent = sentLines || {};
    var colesSent = o.colesSent && typeof o.colesSent === "object" ? o.colesSent : {};
    var colesId = typeof o.colesId === "function" ? o.colesId : function () { return null; };
    var usedColes = {};
    var colesOrdered = {};
    var t = ticks || {};
    var store = o.store === "coles" ? "coles" : "woolies";
    var other = store === "coles" ? "woolies" : "coles";
    var forText = typeof o.forText === "function" ? o.forText : function () { return ""; };
    var groups = { ordered: [], had: [], pantry: [], buy: [] };
    var used = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var f = String(forText(row) || "");
      var w = row.woolies;
      var gone = row.wooliesUnavailable;
      if (w) used[w.product.stockcode] = true;
      if (gone) used[gone.stockcode] = true;
      var c = row.coles;
      var cGone = row.colesUnavailable;
      var cId = c ? colesId(c.product) : null;
      var cGoneId = cGone ? colesId(cGone) : null;
      if (cId) usedColes[cId] = true;
      if (cGoneId) usedColes[cGoneId] = true;
      if (w && isQty(sent[w.product.stockcode])) {
        groups.ordered.push(orderedItem(w, w.product, sent[w.product.stockcode], null, f));
        return;
      }
      if (w && w.alts) {
        for (var ai = 0; ai < w.alts.length; ai++) {
          var wAlt = w.alts[ai];
          if (isQty(sent[wAlt.stockcode])) {
            used[wAlt.stockcode] = true;
            groups.ordered.push(orderedItem(null, wAlt, sent[wAlt.stockcode], "pack size changed since sending", f));
            return;
          }
        }
      }
      if (gone && isQty(sent[gone.stockcode])) {
        groups.ordered.push(orderedItem(null, gone, sent[gone.stockcode], "was unavailable online", f));
        return;
      }
      if (cId && isQty(colesSent[cId])) {
        if (colesOrdered[cId]) return;
        colesOrdered[cId] = true;
        groups.ordered.push(orderedItem(c, c.product, colesSent[cId], null, f, "coles"));
        return;
      }
      if (c && c.alts) {
        for (var ci = 0; ci < c.alts.length; ci++) {
          var cAlt = c.alts[ci];
          var altId = colesId(cAlt);
          if (altId && isQty(colesSent[altId])) {
            if (colesOrdered[altId]) return;
            colesOrdered[altId] = true;
            usedColes[altId] = true;
            groups.ordered.push(orderedItem(null, cAlt, colesSent[altId], "pack size changed since sending", f, "coles"));
            return;
          }
        }
      }
      if (cGoneId && isQty(colesSent[cGoneId])) {
        if (colesOrdered[cGoneId]) return;
        colesOrdered[cGoneId] = true;
        groups.ordered.push(orderedItem(null, cGone, colesSent[cGoneId], "was unavailable online", f, "coles"));
        return;
      }
      var where = row[store] ? store : row[other] ? other : null;
      var line = where ? row[where] : null;
      var it = { name: line ? line.product.name : String(row.name), buy: line ? line.buy : "", cost: line ? line.cost : null, store: where, note: null, for: f };
      if (t[row.id]) groups.had.push(it);
      else if (row.sec === 2) groups.pantry.push(it);
      else {
        if (!where) it.note = "no online store";
        else if (gone && store === "woolies") it.note = "unavailable online at Woolworths";
        else if (row.colesUnavailable && store === "coles") it.note = "unavailable online at Coles";
        groups.buy.push(it);
      }
    });
    (Array.isArray(o.covered) ? o.covered : []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var f = String(forText(row) || "");
      groups.had.push({
        name: String(row.name),
        buy: "",
        cost: null,
        store: null,
        note: "covered by what you have",
        for: f,
      });
    });
    Object.keys(sent).forEach(function (code) {
      if (used[code] || !isQty(sent[code])) return;
      var p = typeof o.product === "function" ? o.product(Number(code)) : null;
      if (!p || typeof p.name !== "string" || !p.name) p = null;
      groups.ordered.push(
        p ? orderedItem(null, p, sent[code], "not in this shop", "") : { name: "Product " + code, buy: String(sent[code]), cost: null, store: "woolies", note: "not in this shop", for: "" },
      );
    });
    Object.keys(colesSent).forEach(function (id) {
      if (usedColes[id] || !isQty(colesSent[id])) return;
      var p = typeof o.colesProduct === "function" ? o.colesProduct(id) : null;
      if (!p || typeof p.name !== "string" || !p.name) p = null;
      groups.ordered.push(
        p ? orderedItem(null, p, colesSent[id], "not in this shop", "", "coles") : { name: "Product " + id, buy: String(colesSent[id]), cost: null, store: "coles", note: "not in this shop", for: "" },
      );
    });
    return {
      v: 1,
      id: at,
      at: at,
      store: store,
      days: (Array.isArray(o.days) ? o.days : []).filter(isDate),
      meals: (Array.isArray(o.meals) ? o.meals : []).filter(validMeal).map(function (m) { return { name: m.name, serves: m.serves }; }),
      delivery: typeof o.delivery === "string" && o.delivery ? o.delivery : null,
      wooliesTotal: typeof o.wooliesTotal === "number" && isFinite(o.wooliesTotal) ? o.wooliesTotal : null,
      groups: groups,
    };
  }

  function isEmpty(rows, sentLines, colesSent) {
    var real = Array.isArray(rows) && rows.some(function (r) { return !!r && r.sec !== 0; });
    var any = function (s) {
      return Object.keys(s || {}).some(function (k) { return isQty(s[k]); });
    };
    return !real && !any(sentLines) && !any(colesSent);
  }

  function groupTitle(order, key) {
    if (key === "ordered") return order && order.store === "coles" ? "Ordered on Coles" : "Ordered on Woolworths";
    return GROUP_TITLES[key];
  }

  function validItem(i) {
    return (
      !!i && typeof i === "object" &&
      typeof i.name === "string" && typeof i.buy === "string" &&
      (i.cost === null || (typeof i.cost === "number" && isFinite(i.cost))) &&
      (i.store === null || i.store === "woolies" || i.store === "coles") &&
      (i.note === null || typeof i.note === "string") &&
      typeof i.for === "string"
    );
  }

  function validOrder(o) {
    return (
      !!o && typeof o === "object" && o.v === 1 &&
      typeof o.id === "string" && typeof o.at === "string" && !isNaN(Date.parse(o.at)) &&
      (o.store === "woolies" || o.store === "coles") &&
      Array.isArray(o.days) && o.days.every(isDate) &&
      Array.isArray(o.meals) && o.meals.every(validMeal) &&
      (o.delivery === null || typeof o.delivery === "string") &&
      (o.wooliesTotal === null || (typeof o.wooliesTotal === "number" && isFinite(o.wooliesTotal))) &&
      !!o.groups && typeof o.groups === "object" &&
      GROUPS.every(function (k) { return Array.isArray(o.groups[k]) && o.groups[k].every(validItem); })
    );
  }

  function parseOrders(json) {
    var list;
    try {
      list = JSON.parse(json);
    } catch (e) {
      return [];
    }
    if (!Array.isArray(list)) return [];
    var seen = {};
    return list
      .filter(function (o) {
        if (!validOrder(o) || seen[o.id]) return false;
        return (seen[o.id] = true);
      })
      .slice(0, KEEP);
  }

  function addOrder(list, order) {
    var rest = (Array.isArray(list) ? list : []).filter(function (o) { return o.id !== order.id; });
    return [order].concat(rest).slice(0, KEEP);
  }

  function removeOrder(list, id) {
    return (Array.isArray(list) ? list : []).filter(function (o) { return o.id !== id; });
  }

  function summaryLine(order) {
    var d = new Date(order.at);
    var items = order.groups.ordered;
    var covered = (order.groups.had || []).filter(function (i) {
      return i && i.note === "covered by what you have";
    });
    var parts = [DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]];
    if (!items.length) {
      if (covered.length) return parts.concat(covered.length + " covered").join(" · ");
      return parts.concat("nothing ordered").join(" · ");
    }
    parts.push(items.length + " ordered");
    if (order.wooliesTotal !== null) parts.push(money(order.wooliesTotal));
    else parts.push("about " + money(round2(items.reduce(function (a, i) { return a + (i.cost || 0); }, 0))));
    return parts.join(" · ");
  }

  var api = {
    GROUPS: GROUPS,
    GROUP_TITLES: GROUP_TITLES,
    KEEP: KEEP,
    snapshot: snapshot,
    sentLineQty: sentLineQty,
    rowHasSentLine: rowHasSentLine,
    isEmpty: isEmpty,
    parseOrders: parseOrders,
    addOrder: addOrder,
    removeOrder: removeOrder,
    summaryLine: summaryLine,
    groupTitle: groupTitle,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelOrders = api;
})(this);
