/* Turns Build a shop rows into Woolworths trolley lines. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  function cartLines(rows, ticks) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id]) return;
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

  var api = { cartLines: cartLines };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
