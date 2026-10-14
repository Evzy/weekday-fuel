/* Turns Build a shop rows into Woolworths trolley lines. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var PRODUCT = /^https:\/\/www\.woolworths\.com\.au\/shop\/productdetails\/(\d+)/;
  var PASTA_LABEL_FOR_MEAL = { bolognese: "Spaghetti", buffalomac: "Macaroni" };
  var DELI_NAME = { ham: "D'Orsogna Ham" };

  function stockcodeOf(url) {
    var m = PRODUCT.exec(url || "");
    return m ? Number(m[1]) : null;
  }

  /* Woolworths deli sells by 100 g, minimum 100 g. Round up so the owner never runs short. */
  function deliGrams(needGrams) {
    return Math.max(100, Math.ceil(needGrams / 100) * 100);
  }

  function lineName(row, label, several, quantity) {
    if (DELI_NAME[row.id]) return DELI_NAME[row.id] + " (deli, " + Math.round(quantity * 1000) + "g)";
    return several ? row.name + " (" + label + ")" : row.name;
  }

  function cartLines(rows, ticks, links) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id]) return;
      var all = links[row.id] || [];
      var woolies = all.filter(function (l) { return stockcodeOf(l[1]) !== null; });
      if (row.id === "pasta") {
        var wanted = (row.used || []).map(function (meal) { return PASTA_LABEL_FOR_MEAL[meal]; });
        woolies = woolies.filter(function (l) { return wanted.indexOf(l[0]) !== -1; });
      }
      if (!woolies.length) {
        manual.push({ itemId: row.id, name: row.name, reason: all.length ? "coles" : "nostore" });
        return;
      }
      var several = woolies.length > 1;
      var quantity = Math.round(row.n * 1000) / 1000;
      woolies.forEach(function (l) {
        lines.push({
          itemId: row.id,
          stockcode: stockcodeOf(l[1]),
          quantity: quantity,
          name: lineName(row, l[0], several, quantity),
          url: l[1],
        });
      });
    });
    return { lines: lines, manual: manual };
  }

  var api = { cartLines: cartLines, stockcodeOf: stockcodeOf, deliGrams: deliGrams };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
