/* Turns Build a shop rows into Woolworths trolley lines. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var PRODUCT = /^https:\/\/www\.woolworths\.com\.au\/shop\/productdetails\/(\d+)/;
  var PASTA_LABEL_FOR_MEAL = { bolognese: "Spaghetti", buffalomac: "Macaroni" };

  function stockcodeOf(url) {
    var m = PRODUCT.exec(url || "");
    return m ? Number(m[1]) : null;
  }

  function cartLines(rows, ticks, links) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id]) return;
      if (row.id === "ham") {
        manual.push({ itemId: row.id, name: row.name, reason: "deli" });
        return;
      }
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
      woolies.forEach(function (l) {
        lines.push({
          itemId: row.id,
          stockcode: stockcodeOf(l[1]),
          quantity: row.n,
          name: several ? row.name + " (" + l[0] + ")" : row.name,
          url: l[1],
        });
      });
    });
    return { lines: lines, manual: manual };
  }

  var api = { cartLines: cartLines, stockcodeOf: stockcodeOf };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
