/* Plans: fixed preset weeks. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var SLOTS = ["breakfast", "lunch", "dinner"];
  var ORDER = ["breakfast", "lunch", "snack", "dinner"];

  function slotRank(slot) {
    if (!slot) return ORDER.length;
    var i = ORDER.indexOf(slot);
    return i < 0 ? ORDER.length : i;
  }

  var PLANS = [
    {
      id: "fewest",
      name: "Fewest items",
      blurb: "4 meals that share their ingredients, so the shopping list is as short as it gets.",
      days: [
        { breakfast: "toasty", lunch: "tenderwrap", dinner: "buffalomac" },
        { breakfast: "toasty", lunch: "burritobowl", dinner: "buffalomac" },
        { breakfast: "toasty", lunch: "tenderwrap", dinner: "burritobowl" },
        { breakfast: "toasty", lunch: "burritobowl", dinner: "buffalomac" },
        { breakfast: "toasty", lunch: "tenderwrap", dinner: "burritobowl" },
      ],
    },
  ];

  function byId(id) {
    for (var i = 0; i < PLANS.length; i++) if (PLANS[i].id === id) return PLANS[i];
    return null;
  }

  function parse(iso) {
    var p = String(iso).split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }

  function fmt(d) {
    return d.toISOString().slice(0, 10);
  }

  function isWeekend(iso) {
    var w = parse(iso).getUTCDay();
    return w === 0 || w === 6;
  }

  function weekdaysFrom(startIso, n) {
    var out = [];
    var d = parse(startIso);
    while (out.length < n) {
      var iso = fmt(d);
      if (!isWeekend(iso)) out.push(iso);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  function mealsOf(daysMap, iso) {
    var day = daysMap && daysMap[iso];
    return day && Array.isArray(day.meals) ? day.meals : [];
  }

  function hasSlot(meals, slot) {
    return meals.some(function (m) {
      return m && m.slot === slot;
    });
  }

  function defaultStart(todayIso, daysMap) {
    var days = weekdaysFrom(todayIso, 10);
    for (var i = 0; i < days.length; i++) {
      var meals = mealsOf(daysMap, days[i]);
      if (!SLOTS.some(function (sl) { return hasSlot(meals, sl); })) return days[i];
    }
    return days[0];
  }

  function fill(plan, startIso, daysMap) {
    var dates = weekdaysFrom(startIso, plan.days.length);
    var changes = {};
    var added = 0;
    var kept = 0;
    dates.forEach(function (iso, i) {
      var existing = mealsOf(daysMap, iso);
      var meals = existing.slice();
      var filled = [];
      SLOTS.forEach(function (sl) {
        if (hasSlot(existing, sl)) {
          kept += 1;
          return;
        }
        meals.push({ id: plan.days[i][sl], slot: sl, t: "S" });
        filled.push(sl);
        added += 1;
      });
      if (!filled.length) return;
      meals = meals
        .map(function (m, idx) { return { m: m, idx: idx }; })
        .sort(function (a, b) {
          var d = slotRank(a.m && a.m.slot) - slotRank(b.m && b.m.slot);
          return d || a.idx - b.idx;
        })
        .map(function (x) { return x.m; })
        .filter(function (m) { return m; });
      changes[iso] = { meals: meals, added: filled };
    });
    return { dates: dates, changes: changes, added: added, kept: kept };
  }

  function mealCounts(plan) {
    var out = {};
    plan.days.forEach(function (d) {
      SLOTS.forEach(function (sl) {
        out[d[sl]] = (out[d[sl]] || 0) + 1;
      });
    });
    return out;
  }

  function summary(plan, shopFn) {
    if (typeof shopFn !== "function") return { items: 0, costPerDay: 0 };
    var r = shopFn(mealCounts(plan)) || {};
    var items = r.items != null ? r.items : 0;
    var total = r.total != null ? r.total : 0;
    return { items: items, costPerDay: Math.round((total / plan.days.length) * 100) / 100 };
  }

  var api = {
    PLANS: PLANS,
    byId: byId,
    isWeekend: isWeekend,
    weekdaysFrom: weekdaysFrom,
    defaultStart: defaultStart,
    fill: fill,
    mealCounts: mealCounts,
    summary: summary,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelPlans = api;
})(this);
