/* Bought meals: mark, unmark, backfill and clear. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  function isBought(meal) {
    return !!meal && typeof meal.bought === "string" && meal.bought !== "";
  }

  function cloneDay(day) {
    return JSON.parse(JSON.stringify(day));
  }

  function cloneMeal(m) {
    var o = {};
    Object.keys(m).forEach(function (k) {
      o[k] = m[k];
    });
    return o;
  }

  function markBought(days, dates, orderId) {
    if (!days || typeof days !== "object" || typeof orderId !== "string" || !orderId) {
      return { days: days, changed: [] };
    }
    var out = days;
    var changed = [];
    (Array.isArray(dates) ? dates : []).forEach(function (date) {
      var day = days[date];
      if (!day || !Array.isArray(day.meals)) return;
      var touched = false;
      var meals = day.meals.map(function (m) {
        if (!m || m.shop === false || isBought(m)) return m;
        touched = true;
        var copy = cloneMeal(m);
        copy.bought = orderId;
        return copy;
      });
      if (!touched) return;
      if (out === days) out = Object.assign({}, days);
      var newDay = cloneDay(day);
      newDay.meals = meals;
      out[date] = newDay;
      changed.push(date);
    });
    return { days: out, changed: changed };
  }

  function unmarkBought(days, orderId) {
    if (!days || typeof days !== "object" || typeof orderId !== "string" || !orderId) {
      return { days: days, changed: [] };
    }
    var out = days;
    var changed = [];
    Object.keys(days).forEach(function (date) {
      if (date === "__proto__") return;
      var day = days[date];
      if (!day || !Array.isArray(day.meals)) return;
      var touched = false;
      var meals = day.meals.map(function (m) {
        if (!m || m.bought !== orderId) return m;
        touched = true;
        var copy = cloneMeal(m);
        delete copy.bought;
        return copy;
      });
      if (!touched) return;
      if (out === days) out = Object.assign({}, days);
      var newDay = cloneDay(day);
      newDay.meals = meals;
      out[date] = newDay;
      changed.push(date);
    });
    return { days: out, changed: changed };
  }

  function backfillBought(days, orders) {
    var cur = days;
    var changed = [];
    var seen = Object.create(null);
    var list = Array.isArray(orders) ? orders.slice() : [];
    list.sort(function (a, b) {
      var ta = a && typeof a.at === "string" ? Date.parse(a.at) : NaN;
      var tb = b && typeof b.at === "string" ? Date.parse(b.at) : NaN;
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return ta - tb;
    });
    list.forEach(function (order) {
      if (!order || typeof order.id !== "string" || !order.id || !Array.isArray(order.days)) return;
      var r = markBought(cur, order.days, order.id);
      cur = r.days;
      r.changed.forEach(function (d) {
        if (!seen[d]) {
          seen[d] = true;
          changed.push(d);
        }
      });
    });
    return { days: cur, changed: changed };
  }

  function skipDateSet(skipDates) {
    if (!skipDates) return null;
    var set = Object.create(null);
    if (Array.isArray(skipDates)) {
      skipDates.forEach(function (d) {
        if (typeof d === "string" && d) set[d] = true;
      });
    } else if (typeof skipDates === "object") {
      Object.keys(skipDates).forEach(function (d) {
        if (d !== "__proto__" && skipDates[d]) set[d] = true;
      });
    }
    return Object.keys(set).length ? set : null;
  }

  function clearUnbought(days, skipDates) {
    if (!days || typeof days !== "object") return { days: days, changed: [], cleared: 0 };
    var skip = skipDateSet(skipDates);
    var out = days;
    var changed = [];
    var cleared = 0;
    Object.keys(days).forEach(function (date) {
      if (date === "__proto__") return;
      if (skip && skip[date]) return;
      var day = days[date];
      if (!day || !Array.isArray(day.meals)) return;
      var kept = [];
      day.meals.forEach(function (m) {
        if (!m) return;
        if (isBought(m) || typeof m.ate === "string") kept.push(m);
        else cleared += 1;
      });
      if (kept.length === day.meals.length) return;
      if (out === days) out = Object.assign({}, days);
      var newDay = cloneDay(day);
      newDay.meals = kept;
      out[date] = newDay;
      changed.push(date);
    });
    return { days: out, changed: changed, cleared: cleared };
  }

  var api = {
    isBought: isBought,
    markBought: markBought,
    unmarkBought: unmarkBought,
    backfillBought: backfillBought,
    clearUnbought: clearUnbought,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelBought = api;
})(this);
