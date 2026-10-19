/* Daily staples: parse, day rules, macros, cost and shop needs. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var DEFAULTS = [
    { id: "dare", amount: 1, days: "weekdays" },
    { id: "grenade", amount: 1, days: "weekdays" },
  ];

  var DATE = /^\d{4}-\d{2}-\d{2}$/;

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  function parseLocalDate(date) {
    var p = date.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function isWeekend(date) {
    if (!DATE.test(date)) return false;
    var d = parseLocalDate(date).getDay();
    return d === 0 || d === 6;
  }

  function isMassUnit(unit) {
    return unit === "g" || unit === "mL";
  }

  function parse(list, cat) {
    var src = list == null ? DEFAULTS : list;
    var out = [];
    var seen = Object.create(null);
    if (!Array.isArray(src)) return parse(DEFAULTS, cat);
    src.forEach(function (s) {
      if (!s || typeof s.id !== "string" || !s.id || seen[s.id]) return;
      if (!cat || typeof cat.item !== "function" || !cat.item(s.id)) return;
      var amount = s.amount;
      if (typeof amount !== "number" || !isFinite(amount) || !(amount > 0)) return;
      if (s.days !== "all" && s.days !== "weekdays") return;
      seen[s.id] = true;
      out.push({ id: s.id, amount: amount, days: s.days });
    });
    return out;
  }

  function onDay(staple, date, day) {
    if (!staple || !(staple.amount > 0) || !DATE.test(date)) return false;
    day = day || {};
    if (day.fx && day.fx[staple.id] === false) return false;
    if (staple.days === "all") return true;
    if (staple.days === "weekdays") {
      if (!isWeekend(date)) return true;
      if (day.track) return true;
    }
    return false;
  }

  function forDay(staples, date, day) {
    var out = [];
    (staples || []).forEach(function (s) {
      if (onDay(s, date, day)) out.push({ id: s.id, amount: s.amount });
    });
    return out;
  }

  function macros(id, amount, cat, macroTable) {
    var row = macroTable && macroTable[id];
    var it = cat && typeof cat.item === "function" ? cat.item(id) : null;
    if (!row || !it || !(amount > 0)) return null;
    var mass;
    if (isMassUnit(it.unit)) {
      mass = amount;
    } else {
      if (!(it.unitSize > 0)) return null;
      mass = amount * it.unitSize;
    }
    return {
      k: round2((mass / 100) * row[0]),
      p: round2((mass / 100) * row[1]),
      c: round2((mass / 100) * row[2]),
      f: round2((mass / 100) * row[3]),
    };
  }

  function lineCost(product, amount) {
    if (!product || !(amount > 0)) return null;
    if (product.perKg) return round2((amount / 1000) * product.price);
    if (!(product.size > 0)) return null;
    return round2((amount / product.size) * product.price);
  }

  function cost(id, amount, cat, store) {
    var it = cat && typeof cat.item === "function" ? cat.item(id) : null;
    if (!it || !(amount > 0)) return null;
    var primary = store === "coles" ? "coles" : "woolies";
    var fallback = primary === "coles" ? "woolies" : "coles";
    var p = it[primary] || it[fallback];
    if (!p) return null;
    return lineCost(p, amount);
  }

  function needs(staples, dates, daysMap) {
    var out = Object.create(null);
    (Array.isArray(dates) ? dates : []).forEach(function (date) {
      if (!DATE.test(date)) return;
      var day = (daysMap && daysMap[date]) || {};
      forDay(staples, date, day).forEach(function (s) {
        out[s.id] = (out[s.id] || 0) + s.amount;
      });
    });
    return out;
  }

  var api = {
    DEFAULTS: DEFAULTS,
    parse: parse,
    onDay: onDay,
    forDay: forDay,
    macros: macros,
    cost: cost,
    needs: needs,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelStaples = api;
})(this);
