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

  function mealKey(date, index, id) {
    return date + "|" + index + "|" + id;
  }

  function parseMealKey(k) {
    if (typeof k !== "string") return null;
    var parts = k.split("|");
    if (parts.length !== 3) return null;
    var index = +parts[1];
    if (!parts[0] || !parts[2] || !isFinite(index)) return null;
    return { date: parts[0], index: index, id: parts[2] };
  }

  function toBuyKeys(days, dates, isBoughtFn) {
    var isBought = typeof isBoughtFn === "function" ? isBoughtFn : isBought;
    var keys = [];
    (Array.isArray(dates) ? dates : []).forEach(function (date) {
      var day = days && days[date];
      if (!day || !Array.isArray(day.meals)) return;
      day.meals.forEach(function (m, i) {
        if (!m || !m.id) return;
        if (isBought(m) || m.shop === false) return;
        keys.push(mealKey(date, i, m.id));
      });
    });
    keys.sort();
    return keys;
  }

  function mealIdentity(k) {
    var p = parseMealKey(k);
    return p ? p.date + "\0" + p.id : null;
  }

  function identityCounts(keys) {
    var out = Object.create(null);
    (Array.isArray(keys) ? keys : []).forEach(function (k) {
      var id = mealIdentity(k);
      if (!id) return;
      out[id] = (out[id] || 0) + 1;
    });
    return out;
  }

  function sameIdentities(a, b) {
    var A = identityCounts(a);
    var B = identityCounts(b);
    var seen = Object.create(null);
    Object.keys(A).forEach(function (k) {
      seen[k] = true;
    });
    Object.keys(B).forEach(function (k) {
      seen[k] = true;
    });
    var keys = Object.keys(seen);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if ((A[k] || 0) !== (B[k] || 0)) return false;
    }
    return true;
  }

  function markBoughtKeys(days, keys, orderId) {
    if (!days || typeof days !== "object" || typeof orderId !== "string" || !orderId || !Array.isArray(keys)) {
      return { days: days, changed: [] };
    }
    var matched = Object.create(null);
    var marks = [];
    keys.forEach(function (k) {
      var p = parseMealKey(k);
      if (!p) return;
      var day = days[p.date];
      if (!day || !Array.isArray(day.meals)) return;
      var idx = -1;
      var m = day.meals[p.index];
      var slotKey = p.date + "\0" + p.index;
      if (m && m.id === p.id && !isBought(m) && !matched[slotKey]) idx = p.index;
      else {
        for (var i = 0; i < day.meals.length; i++) {
          var sk = p.date + "\0" + i;
          if (matched[sk]) continue;
          var mi = day.meals[i];
          if (mi && mi.id === p.id && !isBought(mi)) {
            idx = i;
            break;
          }
        }
      }
      if (idx < 0) return;
      matched[p.date + "\0" + idx] = true;
      marks.push({ date: p.date, index: idx });
    });
    var byDate = Object.create(null);
    marks.forEach(function (mk) {
      if (!byDate[mk.date]) byDate[mk.date] = Object.create(null);
      byDate[mk.date][mk.index] = true;
    });
    var out = days;
    var changed = [];
    Object.keys(byDate).forEach(function (date) {
      var day = days[date];
      if (!day || !Array.isArray(day.meals)) return;
      var want = byDate[date];
      var touched = false;
      var meals = day.meals.map(function (m, i) {
        if (!m || !want[i] || isBought(m)) return m;
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

  function sameKeys(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function changedSince(sentKeys, nowKeys) {
    return !sameIdentities(sentKeys, nowKeys);
  }

  function addedSince(sentKeys, nowKeys) {
    var sent = identityCounts(sentKeys);
    var now = identityCounts(nowKeys);
    var n = 0;
    Object.keys(now).forEach(function (id) {
      var diff = now[id] - (sent[id] || 0);
      if (diff > 0) n += diff;
    });
    return n;
  }

  function clearUnbought(days, skipDates, todayIso) {
    if (!days || typeof days !== "object") return { days: days, changed: [], cleared: 0 };
    var skip = skipDateSet(skipDates);
    var out = days;
    var changed = [];
    var cleared = 0;
    Object.keys(days).forEach(function (date) {
      if (date === "__proto__") return;
      if (typeof todayIso === "string" && todayIso && date < todayIso) return;
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
    markBoughtKeys: markBoughtKeys,
    unmarkBought: unmarkBought,
    backfillBought: backfillBought,
    clearUnbought: clearUnbought,
    mealKey: mealKey,
    parseMealKey: parseMealKey,
    toBuyKeys: toBuyKeys,
    sameKeys: sameKeys,
    changedSince: changedSince,
    addedSince: addedSince,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelBought = api;
})(this);
