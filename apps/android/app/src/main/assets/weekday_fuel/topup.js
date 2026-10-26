/* Delivery-minimum top-up helpers. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var DELIVERY_MIN = { woolies: 50, coles: 50 };
  var DATE = /^\d{4}-\d{2}-\d{2}$/;

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  function parseLocal(date) {
    var p = date.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function addDays(date, n) {
    if (!DATE.test(date)) return date;
    var d = parseLocal(date);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function compareDate(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function isWeekday(date) {
    if (!DATE.test(date)) return false;
    var g = parseLocal(date).getDay();
    return g !== 0 && g !== 6;
  }

  function gapToMin(total, min) {
    var t = typeof total === "number" && isFinite(total) ? total : 0;
    var m = typeof min === "number" && isFinite(min) ? min : 0;
    var gap = t >= m ? 0 : round2(m - t);
    return { total: round2(t), min: m, gap: gap, under: gap > 0 };
  }

  function nextPlanDay(opts) {
    var cartDays = (opts && opts.cartDays) || [];
    var today = opts && opts.today;
    var isTracked = opts && opts.isTracked;
    var hasMeals = opts && opts.hasMeals;
    var step = (opts && opts.addDays) || addDays;
    var max = (opts && opts.maxLookahead) || 90;
    if (!today || !DATE.test(today) || typeof isTracked !== "function" || typeof hasMeals !== "function") return null;
    var anchor = cartDays.length ? cartDays[cartDays.length - 1] : today;
    var start = cartDays.length ? step(anchor, 1) : step(today, 1);
    var i;
    for (i = 0; i < max; i++) {
      var d = step(start, i);
      if (compareDate(d, today) < 0) continue;
      if (!isTracked(d)) continue;
      if (hasMeals(d)) continue;
      return d;
    }
    return null;
  }

  function cartDaysWithPlanDay(cartDays, planDate) {
    var cart = (cartDays || []).slice().filter(function (d) {
      return DATE.test(d);
    });
    if (planDate && DATE.test(planDate) && cart.indexOf(planDate) < 0) cart.push(planDate);
    cart.sort();
    return cart;
  }

  function stapleSpanExtraFromPlanDay(cartDays, planDate, aheadN, spanDatesFn, step) {
    var fn = spanDatesFn || function (d) {
      return d;
    };
    var st = step || addDays;
    var before = spanDatesIncludingAhead(cartDays, aheadN || 0, fn, st);
    var afterCart = cartDaysWithPlanDay(cartDays, planDate);
    var after = spanDatesIncludingAhead(afterCart, aheadN || 0, fn, st);
    var set = Object.create(null);
    before.forEach(function (d) {
      set[d] = true;
    });
    return after.filter(function (d) {
      return !set[d];
    });
  }

  function extraStapleDates(cartDays, n, step) {
    if (!n || !cartDays || !cartDays.length) return [];
    var last = cartDays[cartDays.length - 1];
    var out = [];
    var i;
    for (i = 1; i <= n; i++) out.push(step(last, i));
    return out;
  }

  function spanDatesIncludingAhead(cartDays, aheadN, spanDatesFn, step) {
    if (!cartDays || !cartDays.length) return [];
    if (!aheadN) return spanDatesFn(cartDays);
    var last = cartDays[cartDays.length - 1];
    var extended = cartDays.slice();
    var i;
    for (i = 1; i <= aheadN; i++) extended.push(step(last, i));
    return spanDatesFn(extended);
  }

  function pickStapleAheadN(gap, deltaForN) {
    if (!(gap > 0) || typeof deltaForN !== "function") return 3;
    var n;
    for (n = 1; n <= 3; n++) {
      if (deltaForN(n) + 1e-9 >= gap) return n;
    }
    return 3;
  }

  function visibleSuggestions(list, max) {
    var cap = max == null ? 3 : max;
    return (list || [])
      .filter(function (s) {
        return s && typeof s.cost === "number" && s.cost > 0;
      })
      .sort(function (a, b) {
        return a.cost - b.cost;
      })
      .slice(0, cap);
  }

  function stapleNeedDelta(base, ahead) {
    var out = {};
    var id;
    var b = base || {};
    var a = ahead || {};
    Object.keys(a).forEach(function (id) {
      var d = a[id] - (b[id] || 0);
      if (d > 0) out[id] = d;
    });
    return out;
  }

  function storeTotalDelta(before, after) {
    return round2(after - before);
  }

  function sameDayMealIds(mealIds, candidate) {
    return (mealIds || []).indexOf(candidate) >= 0;
  }

  var api = {
    DELIVERY_MIN: DELIVERY_MIN,
    addDays: addDays,
    compareDate: compareDate,
    isWeekday: isWeekday,
    gapToMin: gapToMin,
    nextPlanDay: nextPlanDay,
    cartDaysWithPlanDay: cartDaysWithPlanDay,
    stapleSpanExtraFromPlanDay: stapleSpanExtraFromPlanDay,
    extraStapleDates: extraStapleDates,
    spanDatesIncludingAhead: spanDatesIncludingAhead,
    pickStapleAheadN: pickStapleAheadN,
    visibleSuggestions: visibleSuggestions,
    stapleNeedDelta: stapleNeedDelta,
    storeTotalDelta: storeTotalDelta,
    sameDayMealIds: sameDayMealIds,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelTopup = api;
})(this);
