/* Daily staples: parse, day rules, macros, cost and shop needs. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var DEFAULTS = [
    { id: "dare", amount: 1, days: "weekdays" },
    { id: "grenade", amount: 1, days: "weekdays" },
  ];

  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var MIN_DATE = "0000-01-01";
  var MAX_DATE = "9999-12-31";

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  function parseLocalDate(date) {
    var p = date.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toIsoDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function addDays(date, n) {
    if (!DATE.test(date)) return date;
    var d = parseLocalDate(date);
    d.setDate(d.getDate() + n);
    return toIsoDate(d);
  }

  function compareDate(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function isWeekend(date) {
    if (!DATE.test(date)) return false;
    var d = parseLocalDate(date).getDay();
    return d === 0 || d === 6;
  }

  function isMassUnit(unit) {
    return unit === "g" || unit === "mL";
  }

  function validOptionalDate(v) {
    return typeof v === "string" && DATE.test(v) ? v : null;
  }

  function rangeEnd(s) {
    return s.until || MAX_DATE;
  }

  function rangeStart(s) {
    return s.from || MIN_DATE;
  }

  function rangesOverlap(a, b) {
    if (a.id !== b.id) return false;
    return compareDate(rangeStart(a), rangeEnd(b)) <= 0 && compareDate(rangeStart(b), rangeEnd(a)) <= 0;
  }

  function copyEntry(s) {
    var e = { id: s.id, amount: s.amount, days: s.days };
    if (s.from) e.from = s.from;
    if (s.until) e.until = s.until;
    if (s.out === true) e.out = true;
    return e;
  }

  function normalizeRow(s, cat) {
    if (!s || typeof s.id !== "string" || !s.id) return null;
    if (!cat || typeof cat.item !== "function" || !cat.item(s.id)) return null;
    var amount = s.amount;
    if (typeof amount !== "number" || !isFinite(amount) || !(amount > 0)) return null;
    if (s.days !== "all" && s.days !== "weekdays") return null;
    var from = validOptionalDate(s.from);
    var until = validOptionalDate(s.until);
    if (from && until && compareDate(from, until) > 0) return null;
    var e = { id: s.id, amount: amount, days: s.days };
    if (from) e.from = from;
    if (until) e.until = until;
    if (s.out === true) e.out = true;
    return e;
  }

  function parse(list, cat) {
    var src = list == null ? DEFAULTS : list;
    if (!Array.isArray(src)) return parse(DEFAULTS, cat);
    var out = [];
    src.forEach(function (s) {
      var e = normalizeRow(s, cat);
      if (!e) return;
      var bad = false;
      for (var i = 0; i < out.length; i++) {
        if (rangesOverlap(out[i], e)) {
          bad = true;
          break;
        }
      }
      if (!bad) out.push(e);
    });
    return out;
  }

  function inDateRange(staple, date) {
    if (staple.from && compareDate(date, staple.from) < 0) return false;
    if (staple.until && compareDate(date, staple.until) > 0) return false;
    return true;
  }

  function isActiveOn(staple, today) {
    if (!DATE.test(today)) return false;
    if (staple.from && compareDate(today, staple.from) < 0) return false;
    if (staple.until && compareDate(today, staple.until) > 0) return false;
    return true;
  }

  function findActiveIndex(list, id, today) {
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.id === id && isActiveOn(s, today)) return i;
    }
    return -1;
  }

  function activeStaples(list, today) {
    var byId = Object.create(null);
    var order = [];
    (list || []).forEach(function (s) {
      if (!isActiveOn(s, today)) return;
      if (!byId[s.id]) order.push(s.id);
      byId[s.id] = s;
    });
    return order.map(function (id) {
      return byId[id];
    });
  }

  function applyAdd(list, entry, today, cat) {
    if (!DATE.test(today)) return parse(list, cat);
    if (!entry || !entry.id) return parse(list, cat);
    var raw = Array.isArray(list) ? list.map(copyEntry) : [];
    if (findActiveIndex(raw, entry.id, today) >= 0) {
      return applyEdit(raw, entry.id, { amount: entry.amount, days: entry.days }, today, cat);
    }
    var out = raw.slice();
    var e = copyEntry(entry);
    e.from = today;
    delete e.until;
    out.push(e);
    return parse(out, cat);
  }

  function applyEdit(list, id, patch, today, cat) {
    if (!DATE.test(today)) return parse(list, cat);
    var raw = Array.isArray(list) ? list.map(copyEntry) : [];
    var idx = findActiveIndex(raw, id, today);
    var y = addDays(today, -1);
    if (idx < 0) {
      var neu = { id: id, amount: patch.amount, days: patch.days, from: today };
      if (patch.out === true) neu.out = true;
      raw.push(neu);
      return parse(raw, cat);
    }
    var old = raw[idx];
    var next = {
      id: id,
      amount: typeof patch.amount === "number" ? patch.amount : old.amount,
      days: patch.days || old.days,
      from: today,
    };
    if (patch.out === true) next.out = true;
    else if (patch.out === false) { /* leave out unset */ }
    else if (old.out === true) next.out = true;
    if (old.from && compareDate(old.from, today) >= 0) {
      raw[idx] = Object.assign({}, old, next);
      if (patch.out === false) delete raw[idx].out;
      delete raw[idx].until;
    } else {
      raw[idx] = Object.assign({}, old, { until: y });
      raw.push(next);
    }
    return parse(raw, cat);
  }

  function applyRemove(list, id, today, cat) {
    if (!DATE.test(today)) return parse(list, cat);
    var raw = Array.isArray(list) ? list.map(copyEntry) : [];
    var idx = findActiveIndex(raw, id, today);
    if (idx < 0) return parse(raw, cat);
    var old = raw[idx];
    if (old.from && compareDate(old.from, today) >= 0) raw.splice(idx, 1);
    else raw[idx] = Object.assign({}, old, { until: addDays(today, -1) });
    return parse(raw, cat);
  }

  function onDay(staple, date, day) {
    if (!staple || !(staple.amount > 0) || !DATE.test(date)) return false;
    if (!inDateRange(staple, date)) return false;
    day = day || {};
    if (day.fx && day.fx[staple.id] === false) return false;
    if (day.fx && day.fx[staple.id] === true) return true;
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
      if (onDay(s, date, day)) {
        var row = { id: s.id, amount: s.amount };
        if (s.out === true) row.out = true;
        out.push(row);
      }
    });
    return out;
  }

  function findSwap(item, swapId) {
    if (!item || !Array.isArray(item.swaps) || typeof swapId !== "string" || !swapId) return null;
    for (var i = 0; i < item.swaps.length; i++) {
      if (item.swaps[i].id === swapId) return item.swaps[i];
    }
    return null;
  }

  function choiceMacros(id, amount, swapId, cat, macroCtx) {
    var it = cat && typeof cat.item === "function" ? cat.item(id) : null;
    if (!it || !(amount > 0)) return null;
    var calc = macroCtx && macroCtx.stapleMacros;
    if (typeof calc !== "function") return null;
    var store = macroCtx.store === "coles" ? "coles" : "woolies";
    var swap = swapId ? findSwap(it, swapId) : null;
    if (swapId && (!swap || !swap.per)) return calc(id, amount, store, null);
    return calc(id, amount, store, swap);
  }

  function macros(id, amount, cat, macroCtx) {
    return choiceMacros(id, amount, null, cat, macroCtx);
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

  var LEGACY_FX_IDS = ["dare", "grenade"];

  function legacyFxDefault(id, date, day) {
    if (LEGACY_FX_IDS.indexOf(id) < 0) return null;
    if (!isWeekend(date)) return true;
    if (day && day.track) return null;
    return false;
  }

  function migrateLegacyFx(days) {
    var src = days && typeof days === "object" ? days : {};
    var out = Object.assign({}, src);
    var changed = false;
    var changedDates = [];
    Object.keys(src).forEach(function (date) {
      if (!DATE.test(date)) return;
      var day = src[date];
      if (!day || !day.fx || typeof day.fx !== "object") return;
      var nextFx = Object.assign({}, day.fx);
      var fxChanged = false;
      LEGACY_FX_IDS.forEach(function (id) {
        if (!(id in day.fx)) return;
        var def = legacyFxDefault(id, date, day);
        if (def === null) return;
        if (day.fx[id] === def) {
          delete nextFx[id];
          fxChanged = true;
        }
      });
      if (!fxChanged) return;
      changed = true;
      changedDates.push(date);
      var nextDay = Object.assign({}, day);
      if (Object.keys(nextFx).length) nextDay.fx = nextFx;
      else delete nextDay.fx;
      out[date] = nextDay;
    });
    return { days: out, changed: changed, changedDates: changedDates };
  }

  function spanDates(dates) {
    var list = (Array.isArray(dates) ? dates : []).filter(function (d) {
      return DATE.test(d);
    });
    if (!list.length) return [];
    list.sort();
    var first = list[0];
    var last = list[list.length - 1];
    var out = [];
    var d = first;
    while (compareDate(d, last) <= 0) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }

  function needs(staples, dates, daysMap) {
    var out = Object.create(null);
    (Array.isArray(dates) ? dates : []).forEach(function (date) {
      if (!DATE.test(date)) return;
      var day = (daysMap && daysMap[date]) || {};
      forDay(staples, date, day).forEach(function (s) {
        if (s.out) return;
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
    choiceMacros: choiceMacros,
    cost: cost,
    needs: needs,
    activeStaples: activeStaples,
    applyAdd: applyAdd,
    applyEdit: applyEdit,
    applyRemove: applyRemove,
    addDays: addDays,
    spanDates: spanDates,
    migrateLegacyFx: migrateLegacyFx,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelStaples = api;
})(this);
