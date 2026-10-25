/* Best-fit L/S/X for a day without mutating. Pure: no DOM or storage. */
(function (root) {
  "use strict";

  var TIERS = ["L", "S", "X"];

  function planDay(day, locked, date, opts, ctx) {
    if (!ctx || typeof ctx !== "object") return { picks: [], lines: [] };
    var all = (day && day.meals) || [];
    var lk = locked || 0;
    var respectTierBy = !!(opts && opts.respectTierBy);
    var unlocked = (date && ctx.dayUnlocked(date)) || !!(opts && opts.bought);
    function fixed(m, i) {
      if (i < lk) return true;
      if (ctx.mealImpliedAte(m, date)) return true;
      if (ctx.isBought(m) && !unlocked) return true;
      if (respectTierBy && m.tierBy === "you") return true;
      return false;
    }
    var baseMeals = [];
    var unfixed = [];
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (!m) continue;
      if (fixed(m, i)) baseMeals.push(m);
      else if (ctx.mealKnown(m.id)) unfixed.push({ m: m, i: i });
    }
    if (!unfixed.length) {
      var fixedPicks = [];
      for (var fi = 0; fi < all.length; fi++) {
        var fm = all[fi];
        if (fm && ctx.mealKnown(fm.id) && fixed(fm, fi)) fixedPicks.push({ index: fi, t: fm.t });
      }
      return { picks: fixedPicks, lines: [] };
    }
    var base = ctx.dayBaseTotals(day, date, baseMeals);
    var tg = opts && opts.target ? opts.target : ctx.defaultTarget(date);
    var n = unfixed.length;
    var combos = Math.pow(3, n);
    var best = null;
    for (var ci = 0; ci < combos; ci++) {
      var k = base.k;
      var p = base.p;
      var x = ci;
      var pick = [];
      for (var j = 0; j < n; j++) {
        var t = TIERS[x % 3];
        x = Math.floor(x / 3);
        pick.push(t);
        var v = ctx.mealMacros(unfixed[j].m.id, t);
        k += v.k;
        p += v.p;
      }
      var score = Math.abs(k - tg.k) + Math.max(0, tg.p - p) * 12;
      if (!best || score < best.score) best = { score: score, pick: pick };
    }
    var picks = [];
    var lines = [];
    for (var u = 0; u < unfixed.length; u++) {
      var toT = best.pick[u];
      var meal = unfixed[u].m;
      var idx = unfixed[u].i;
      picks.push({ index: idx, t: toT });
      if (meal.t !== toT) {
        lines.push({
          index: idx,
          slot: meal.slot,
          fromT: meal.t,
          toT: toT,
          tierByYou: meal.tierBy === "you",
        });
      }
    }
    return { picks: picks, lines: lines };
  }

  var api = { planDay: planDay };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelPortionFit = api;
})(this);
