/* Close-the-gap suggestion maths. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var SNACKS = [
    { id: "grenade", label: "Grenade bar", items: [{ id: "grenade", amount: 1 }] },
    { id: "dare", label: "Dare iced coffee", items: [{ id: "dare", amount: 1 }] },
    { id: "yog-honey", label: "Yoghurt + honey", items: [{ id: "yog", amount: 200 }, { id: "honey", amount: 15 }] },
    { id: "eggs2", label: "2 boiled eggs", items: [{ id: "eggs", amount: 2 }] },
    { id: "ham-cheese", label: "Ham & cheese", items: [{ id: "ham", amount: 50 }, { id: "cheese", amount: 30 }] },
    { id: "yog-berry", label: "Yoghurt + berries", items: [{ id: "yog", amount: 200 }, { id: "fzberry", amount: 100 }] },
  ];

  function snackMacros(snack, macrosFor) {
    if (!snack || !snack.items || typeof macrosFor !== "function") return null;
    var k = 0;
    var p = 0;
    for (var i = 0; i < snack.items.length; i++) {
      var it = snack.items[i];
      var m = macrosFor(it.id, it.amount);
      if (!m || typeof m.k !== "number" || typeof m.p !== "number") return null;
      k += m.k;
      p += m.p;
    }
    return { k: k, p: p };
  }

  function gapScore(k, p, target) {
    return Math.abs(k - target.k) + Math.max(0, target.p - p) * 12;
  }

  function snackHasStock(snack, free) {
    var f = free || {};
    for (var i = 0; i < snack.items.length; i++) {
      var it = snack.items[i];
      var have = f[it.id];
      if ((have == null ? 0 : have) < it.amount) return false;
    }
    return true;
  }

  function snackOptions(opts) {
    opts = opts || {};
    var free = opts.free;
    var macrosFor = opts.macrosFor;
    var total = opts.total || { k: 0, p: 0 };
    var target = opts.target || { k: 0, p: 0 };
    var limit = opts.limit == null ? 3 : opts.limit;
    var current = gapScore(total.k, total.p, target);
    var out = [];
    for (var si = 0; si < SNACKS.length; si++) {
      var snack = SNACKS[si];
      if (!snackHasStock(snack, free)) continue;
      var macros = snackMacros(snack, macrosFor);
      if (!macros) continue;
      var after = { k: total.k + macros.k, p: total.p + macros.p };
      var score = gapScore(after.k, after.p, target);
      if (score >= current) continue;
      out.push({ snack: snack, k: macros.k, p: macros.p, after: after, score: score });
    }
    out.sort(function (a, b) {
      return a.score - b.score;
    });
    if (limit >= 0 && out.length > limit) out = out.slice(0, limit);
    return out;
  }

  function spreadSplit(gapK, dates) {
    if (!dates || !dates.length) return [];
    var n = dates.length;
    var base = Math.trunc(gapK / n);
    var rem = gapK - base * n;
    return dates.map(function (date, i) {
      return { date: date, k: base + (i === 0 ? rem : 0) };
    });
  }

  function forwardCandidates(opts) {
    opts = opts || {};
    var today = opts.today;
    var weekEnd = opts.weekEnd;
    var days = opts.days || {};
    var isBought = opts.isBought;
    var isEaten = opts.isEaten;
    if (typeof today !== "string" || typeof weekEnd !== "string") return [];
    var out = [];
    var dates = Object.keys(days).filter(function (d) {
      return d > today && d <= weekEnd;
    });
    dates.sort();
    dates.forEach(function (date) {
      var day = days[date];
      if (!day || !Array.isArray(day.meals)) return;
      day.meals.forEach(function (meal, index) {
        if (typeof isBought === "function" && !isBought(meal)) return;
        if (typeof isEaten === "function" && isEaten(meal)) return;
        out.push({ date: date, index: index, meal: meal });
      });
    });
    return out;
  }

  var api = {
    SNACKS: SNACKS,
    snackMacros: snackMacros,
    snackOptions: snackOptions,
    spreadSplit: spreadSplit,
    forwardCandidates: forwardCandidates,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelGap = api;
})(this);
