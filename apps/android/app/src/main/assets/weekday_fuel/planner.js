/* Suggest my week: plans Mon–Fri so meals share ingredients and the whole-pack shop is cheap. Pure: no DOM or storage. */
(function (root) {
  "use strict";
  var SLOTS = ["breakfast", "lunch", "dinner"];
  /* Relaxed in order when kept meals make the rules impossible. */
  var LEVELS = [
    { max: 2, apart: true, unique: true },
    { max: 2, apart: false, unique: true },
    { max: Infinity, apart: false, unique: true },
    { max: Infinity, apart: false, unique: false },
  ];

  function parse(s) {
    var p = s.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }
  function iso(d) {
    return d.toISOString().slice(0, 10);
  }
  function addDays(s, n) {
    var d = parse(s);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  }
  function monday(s) {
    return addDays(s, -((parse(s).getUTCDay() + 6) % 7));
  }

  /* The weekdays of the viewed week from today on (never a past week); if none are left, next week's. */
  function weekDays(view, today) {
    var viewMon = monday(view);
    var todayMon = monday(today);
    var mon = viewMon < todayMon ? todayMon : viewMon;
    var dates = [];
    var i;
    for (i = 0; i < 5; i++) if (addDays(mon, i) >= today) dates.push(addDays(mon, i));
    if (!dates.length) {
      mon = addDays(mon, 7);
      for (i = 0; i < 5; i++) dates.push(addDays(mon, i));
    }
    var before = [];
    for (i = 0; i < 5; i++) if (addDays(mon, i) < dates[0]) before.push(addDays(mon, i));
    var label = mon === viewMon ? "Suggest my week" : mon > todayMon ? "Suggest next week" : "Suggest this week";
    return { dates: dates, before: before, label: label };
  }

  /* Whole-pack cost at the store (the other store's product when it lacks one) plus the unused part of fresh (sec 1) packs. */
  function shopScore(cat, dayMeals, store, have) {
    var other = store === "coles" ? "woolies" : "coles";
    var total = 0;
    cat.shopList({}, 0, dayMeals, have).forEach(function (r) {
      var line = r[store] || r[other];
      if (!line) return;
      total += line.cost;
      var p = line.product;
      if (r.sec === 1 && !p.perKg) {
        var buyNeed = r.need - (r.have || 0);
        var left = line.quantity * p.size - buyNeed;
        if (left > 0) total += (left / p.size) * p.price;
      }
    });
    return Math.round(total * 100) / 100;
  }

  function buildWeek(o, level, rng, nb) {
    var count = {};
    var on = {};
    function note(date, id) {
      count[id] = (count[id] || 0) + 1;
      (on[date] = on[date] || {})[id] = true;
    }
    function onDay(date, id) {
      return !!(on[date] && on[date][id]);
    }
    Object.keys(o.before || {}).forEach(function (d) {
      (o.before[d] || []).forEach(function (m) {
        note(d, m.id);
      });
    });
    o.dates.forEach(function (d) {
      ((o.kept || {})[d] || []).forEach(function (m) {
        note(d, m.id);
      });
    });
    function dayKey(meals) {
      return meals.map(function (m) { return m.id; }).sort().join("+");
    }
    var seen = {};
    Object.keys(o.before || {}).forEach(function (d) {
      seen[dayKey(o.before[d] || [])] = true;
    });
    o.dates.forEach(function (d) {
      var kept = (o.kept || {})[d] || [];
      var full = SLOTS.every(function (s) {
        return kept.some(function (m) { return m.slot === s; });
      });
      if (full) seen[dayKey(kept)] = true;
    });
    var days = {};
    var dayMeals = [];
    for (var i = 0; i < o.dates.length; i++) {
      var d = o.dates[i];
      var prev = nb[d][0];
      var next = nb[d][1];
      var kept = (o.kept || {})[d] || [];
      var have = {};
      kept.forEach(function (m) {
        have[m.slot] = true;
      });
      var added = [];
      for (var s = 0; s < SLOTS.length; s++) {
        var slot = SLOTS[s];
        if (have[slot]) continue;
        var pool = (o.pools[slot] || []).filter(function (id) {
          if ((count[id] || 0) >= level.max || onDay(d, id)) return false;
          return !(level.apart && (onDay(prev, id) || onDay(next, id)));
        });
        if (!pool.length) return null;
        var id = pool[Math.floor(rng() * pool.length)];
        note(d, id);
        added.push({ id: id, slot: slot, t: "S" });
      }
      var meals = kept.concat(added);
      if (added.length) {
        var key = dayKey(meals);
        if (level.unique && seen[key]) return null;
        seen[key] = true;
        o.fit(d, meals, kept.length);
      }
      days[d] = meals;
      meals.forEach(function (m) {
        dayMeals.push({ day: d, meal: m.id, t: m.t });
      });
    }
    return { days: days, score: o.score(dayMeals) };
  }

  /* opts: dates, before {[date]: meals}, kept {[date]: meals}, pools {breakfast, lunch, dinner: ids},
     fit(date, meals, lockedCount) sets t on the meals after the locked ones, score(dayMeals) lower is better,
     rng, tries (2000), near (0.03: pick at random among weeks within 3% of the best). */
  function planWeek(o) {
    var rng = o.rng || Math.random;
    var tries = o.tries || 2000;
    var near = o.near == null ? 0.03 : o.near;
    var nb = {};
    o.dates.forEach(function (d) {
      nb[d] = [addDays(d, -1), addDays(d, 1)];
    });
    for (var l = 0; l < LEVELS.length; l++) {
      var found = [];
      for (var i = 0; i < tries; i++) {
        var w = buildWeek(o, LEVELS[l], rng, nb);
        if (w) found.push(w);
      }
      if (!found.length) continue;
      var best = Math.min.apply(null, found.map(function (x) { return x.score; }));
      var close = found.filter(function (x) { return x.score <= best + Math.abs(best) * near + 1e-9; });
      var pick = close[Math.floor(rng() * close.length)];
      var ids = {};
      o.dates.forEach(function (d) {
        pick.days[d].forEach(function (m) {
          ids[m.id] = true;
        });
      });
      return { days: pick.days, score: pick.score, distinct: Object.keys(ids).length };
    }
    return null;
  }

  var api = { weekDays: weekDays, planWeek: planWeek, shopScore: shopScore };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelPlanner = api;
})(this);
