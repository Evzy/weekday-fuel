/* Turns Build a shop rows into Woolworths and Coles trolley lines. Pure: no DOM, no storage. */
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
        return dm.day + ":" + dm.meal + (dm.t === "L" || dm.t === "X" ? ":" + dm.t : "");
      })
      .sort();
    var extra;
    if (typeof fixtureDays === "number") extra = { fixtureDays: fixtureDays || 0 };
    else if (fixtureDays && typeof fixtureDays === "object" && !Array.isArray(fixtureDays)) {
      var keys = Object.keys(fixtureDays)
        .filter(function (k) {
          return k !== "__proto__";
        })
        .sort();
      extra = { staples: keys.map(function (k) {
        return [k, fixtureDays[k]];
      }) };
    } else extra = { staples: [] };
    return JSON.stringify(Object.assign({ picks: p, days: d }, extra));
  }

  /* Coles trolley lines, keyed by Coles product ID (idOf = catalogue colesId). Rows that share a product are merged. */
  function colesCartLines(rows, ticks, haveIt, idOf) {
    var lines = [];
    var byId = {};
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id] || (haveIt && haveIt[row.id])) return;
      var line = row.coles;
      var id = line ? idOf(line.product) : null;
      if (!id) {
        if (row.colesUnavailable) manual.push({ itemId: row.id, name: row.colesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.woolies ? row.woolies.product.name : row.name, reason: row.woolies ? "woolies" : "nostore" });
        return;
      }
      if (byId[id]) {
        byId[id].quantity += line.quantity;
        return;
      }
      byId[id] = { itemId: row.id, productId: id, quantity: line.quantity, name: line.product.name, url: line.product.url };
      lines.push(byId[id]);
    });
    return { lines: lines, manual: manual };
  }

  function colesRemovalLines(lastLines, rows, idOf) {
    var keep = {};
    rows.forEach(function (row) {
      var a = row.coles && idOf(row.coles.product);
      var b = row.colesUnavailable && idOf(row.colesUnavailable);
      if (a) keep[a] = true;
      if (b) keep[b] = true;
    });
    return Object.keys(lastLines || {})
      .filter(function (id) {
        return !keep[id];
      })
      .map(function (id) {
        return { productId: id, quantity: 0 };
      });
  }

  function sentAfter(lastLines, lines, results, key) {
    var k = key || "stockcode";
    var out = Object.assign({}, lastLines || {});
    var done = {};
    (results || []).forEach(function (r) {
      if (r.added) done[r[k]] = true;
    });
    lines.forEach(function (l) {
      if (!done[l[k]]) return;
      if (l.quantity === 0) delete out[l[k]];
      else out[l[k]] = l.quantity;
    });
    return out;
  }

  var api = { cartLines: cartLines, removalLines: removalLines, colesCartLines: colesCartLines, colesRemovalLines: colesRemovalLines, shopFingerprint: shopFingerprint, sentAfter: sentAfter };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
