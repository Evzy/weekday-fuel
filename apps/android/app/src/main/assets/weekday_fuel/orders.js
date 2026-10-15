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

  function isDate(d) {
    return typeof d === "string" && DATE.test(d);
  }

  function validMeal(m) {
    return !!m && typeof m.name === "string" && isQty(m.serves);
  }

  function amount(product, qty) {
    if (product.perKg) return Math.round(qty * 1000) + "g";
    return qty + (qty === 1 ? " pack" : " packs");
  }

  /* `line` is the shop's own line for this product, used when the sent amount matches it. */
  function orderedItem(line, product, qty, note, forText) {
    var same = !!line && Math.abs(qty - line.quantity) < 1e-9;
    return {
      name: String(product.name),
      buy: same ? line.buy : amount(product, qty),
      cost: same ? line.cost : typeof product.price === "number" ? round2(qty * product.price) : null,
      store: "woolies",
      note: note,
      for: forText,
    };
  }

  function snapshot(rows, ticks, sentLines, opts) {
    var o = opts || {};
    var at = typeof o.at === "string" && !isNaN(Date.parse(o.at)) ? o.at : new Date().toISOString();
    var sent = sentLines || {};
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
      if (w && isQty(sent[w.product.stockcode])) {
        groups.ordered.push(orderedItem(w, w.product, sent[w.product.stockcode], null, f));
        return;
      }
      if (gone && isQty(sent[gone.stockcode])) {
        groups.ordered.push(orderedItem(null, gone, sent[gone.stockcode], "was unavailable online", f));
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
        groups.buy.push(it);
      }
    });
    Object.keys(sent).forEach(function (code) {
      if (used[code] || !isQty(sent[code])) return;
      var p = typeof o.product === "function" ? o.product(Number(code)) : null;
      if (!p || typeof p.name !== "string" || !p.name) p = null;
      groups.ordered.push(
        p ? orderedItem(null, p, sent[code], "not in this shop", "") : { name: "Product " + code, buy: String(sent[code]), cost: null, store: "woolies", note: "not in this shop", for: "" },
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

  function isEmpty(rows, sentLines) {
    var s = sentLines || {};
    var real = Array.isArray(rows) && rows.some(function (r) { return !!r && r.sec !== 0; });
    return !real && !Object.keys(s).some(function (k) { return isQty(s[k]); });
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
    var parts = [DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]];
    if (!items.length) return parts.concat("nothing ordered").join(" · ");
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
    isEmpty: isEmpty,
    parseOrders: parseOrders,
    addOrder: addOrder,
    removeOrder: removeOrder,
    summaryLine: summaryLine,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelOrders = api;
})(this);
