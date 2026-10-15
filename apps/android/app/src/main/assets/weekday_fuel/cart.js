/* Turns Build a shop rows into Woolworths trolley lines. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  function cartLines(rows, ticks, haveIt) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id] || (haveIt && haveIt[row.id])) return;
      var line = row.woolies;
      if (!line) {
        if (row.wooliesUnavailable) manual.push({ itemId: row.id, name: row.wooliesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.coles ? row.coles.product.name : row.name, reason: row.coles ? "coles" : "nostore" });
        return;
      }
      var p = line.product;
      var quantity = Math.round(line.quantity * 1000) / 1000;
      lines.push({
        itemId: row.id,
        stockcode: p.stockcode,
        quantity: quantity,
        name: p.perKg ? p.name + " (" + Math.round(quantity * 1000) + "g)" : p.name,
        url: p.url,
      });
    });
    return { lines: lines, manual: manual };
  }

  function removalLines(lastLines, rows) {
    var keep = {};
    rows.forEach(function (row) {
      if (row.woolies) keep[row.woolies.product.stockcode] = true;
      if (row.wooliesUnavailable) keep[row.wooliesUnavailable.stockcode] = true;
    });
    return Object.keys(lastLines || {})
      .filter(function (code) {
        return !keep[code];
      })
      .map(function (code) {
        return { stockcode: Number(code), quantity: 0 };
      });
  }

  function shopFingerprint(picks, dayMeals, fixtureDays) {
    var p = Object.keys(picks || {})
      .filter(function (meal) {
        return picks[meal] > 0;
      })
      .sort()
      .map(function (meal) {
        return meal + "x" + picks[meal];
      });
    var d = (dayMeals || [])
      .map(function (dm) {
        return dm.day + ":" + dm.meal;
      })
      .sort();
    return JSON.stringify({ picks: p, days: d, fixtureDays: fixtureDays || 0 });
  }

  function sentAfter(lastLines, lines, results) {
    var out = Object.assign({}, lastLines || {});
    var done = {};
    (results || []).forEach(function (r) {
      if (r.added) done[r.stockcode] = true;
    });
    lines.forEach(function (l) {
      if (!done[l.stockcode]) return;
      if (l.quantity === 0) delete out[l.stockcode];
      else out[l.stockcode] = l.quantity;
    });
    return out;
  }

  var api = { cartLines: cartLines, removalLines: removalLines, shopFingerprint: shopFingerprint, sentAfter: sentAfter };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
