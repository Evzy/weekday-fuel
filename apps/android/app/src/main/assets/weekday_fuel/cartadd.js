/* Cart add: slot placement, cart days, flags and gaps. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var ORDER = ["breakfast", "lunch", "snack", "dinner"];

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

  function diffDays(aIso, bIso) {
    return Math.round((parse(bIso) - parse(aIso)) / 86400000);
  }

  function slotRank(slot) {
    var i = ORDER.indexOf(slot);
    return i < 0 ? ORDER.length : i;
  }

  function hasSlot(meals, slot) {
    for (var i = 0; i < meals.length; i++) {
      if (meals[i] && meals[i].slot === slot) return true;
    }
    return false;
  }

  function naturalSlot(meal, dayMeals) {
    var slots = (meal && meal.slots) || [];
    if (slots.indexOf("breakfast") >= 0) return "breakfast";
    if (slots.indexOf("main") >= 0) {
      if (!hasSlot(dayMeals, "lunch")) return "lunch";
      if (!hasSlot(dayMeals, "dinner")) return "dinner";
      return "lunch";
    }
    return "snack";
  }

  function firstInSlot(dayMeals, slot) {
    for (var i = 0; i < dayMeals.length; i++) {
      if (dayMeals[i] && dayMeals[i].slot === slot) return dayMeals[i];
    }
    return null;
  }

  function replaceOptions(meal, dayMeals, isBought, isEatenFn) {
    var slots = (meal && meal.slots) || [];
    var opts = [];
    var i;
    if (slots.indexOf("main") >= 0) {
      for (i = 0; i < dayMeals.length; i++) {
        var m = dayMeals[i];
        if (!m || (m.slot !== "lunch" && m.slot !== "dinner")) continue;
        if (!isLocked(m, isBought, isEatenFn)) opts.push({ slot: m.slot, existing: m, index: i });
      }
      return opts;
    }
    if (slots.indexOf("breakfast") >= 0) {
      for (i = 0; i < dayMeals.length; i++) {
        var b = dayMeals[i];
        if (!b || b.slot !== "breakfast") continue;
        if (!isLocked(b, isBought, isEatenFn)) opts.push({ slot: "breakfast", existing: b, index: i });
      }
    }
    return opts;
  }

  function defaultIsBought(m) {
    return m && typeof m.bought === "string" && m.bought !== "";
  }

  function defaultIsEaten(m) {
    return m && typeof m.ate === "string";
  }

  function isLocked(m, isBought, isEatenFn) {
    var eaten = isEatenFn || defaultIsEaten;
    return isBought(m) || eaten(m);
  }

  function place(meal, dayMeals, isBought, isEatenFn) {
    dayMeals = dayMeals || [];
    var slot = naturalSlot(meal, dayMeals);
    if (slot === "snack") return { action: "add", slot: slot };
    var existing = firstInSlot(dayMeals, slot);
    if (!existing) return { action: "add", slot: slot };
    var options = replaceOptions(meal, dayMeals, isBought, isEatenFn);
    if (isLocked(existing, isBought, isEatenFn)) {
      if (!options.length) return { action: "locked", slot: slot, existing: existing, options: options };
      return { action: "ask", slot: slot, existing: existing, options: options };
    }
    return { action: "ask", slot: slot, existing: existing, options: options };
  }

  function apply(dayMeals, mealId, slot, mode, isBought, isEatenFn, targetIndex) {
    var boughtFn = isBought || defaultIsBought;
    var eatenFn = isEatenFn || defaultIsEaten;
    var meals = (dayMeals || []).slice();
    if (mode === "replace") {
      var removed = false;
      if (typeof targetIndex === "number" && targetIndex >= 0 && targetIndex < meals.length) {
        var target = meals[targetIndex];
        if (target && target.slot === slot && !isLocked(target, boughtFn, eatenFn)) {
          meals.splice(targetIndex, 1);
          removed = true;
        }
      }
      if (!removed) {
        for (var i = 0; i < meals.length; i++) {
          var m = meals[i];
          if (m && m.slot === slot && !isLocked(m, boughtFn, eatenFn)) {
            meals.splice(i, 1);
            break;
          }
        }
      }
    }
    var added = { id: mealId, slot: slot, t: "S" };
    meals.push(added);
    var tagged = meals.map(function (m, idx) {
      return { m: m, idx: idx };
    });
    tagged.sort(function (a, b) {
      var ra = slotRank(a.m.slot),
        rb = slotRank(b.m.slot);
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    });
    return { meals: tagged.map(function (x) { return x.m; }), added: added };
  }

  function cartDays(daysMap, todayIso, isBought, mealExists) {
    if (!daysMap || typeof daysMap !== "object") return [];
    return Object.keys(daysMap)
      .filter(function (d) {
        if (d < todayIso) return false;
        var day = daysMap[d];
        var ms = (day && day.meals) || [];
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          if (m && mealExists(m.id) && !isBought(m) && m.shop !== false) return true;
        }
        return false;
      })
      .sort();
  }

  function dayFlags(dateIso, count, todayIso, isTrackedWeekend) {
    var few =
      count < 3 && (!isWeekend(dateIso) || isTrackedWeekend(dateIso)) ? count : null;
    var n = diffDays(todayIso, dateIso);
    var ahead = null;
    if (n > 7) {
      if (n % 7 === 0) ahead = "In " + n / 7 + " weeks";
      else ahead = "In " + n + " days";
    }
    return { few: few, ahead: ahead };
  }

  function logReplaceIndexes(meals, slot, isBought) {
    var boughtFn = isBought || defaultIsBought;
    var out = [];
    (meals || []).forEach(function (m, i) {
      if (!m || m.slot !== slot) return;
      if (boughtFn(m) || m.logged) return;
      out.push(i);
    });
    return out;
  }

  function logReplaceEntry(r) {
    if (typeof r === "number") return { index: r, id: null };
    if (r && typeof r.index === "number") {
      return { index: r.index, id: r.id != null ? String(r.id) : null };
    }
    return null;
  }

  function logMeal(dayMeals, opts, nowIso) {
    var boughtFn = (opts && opts.isBought) || defaultIsBought;
    var slot = opts && opts.slot;
    var meals = (dayMeals || []).slice();
    var remove = Object.create(null);
    (opts && opts.replace ? opts.replace : []).forEach(function (r) {
      var ent = logReplaceEntry(r);
      if (!ent || ent.index < 0 || ent.index >= meals.length) return;
      var m = meals[ent.index];
      if (!m || boughtFn(m) || m.logged) return;
      if (ent.id != null && String(m.id) !== ent.id) return;
      if (slot && m.slot !== slot) return;
      remove[ent.index] = true;
    });
    meals = meals.filter(function (_m, i) {
      return !remove[i];
    });
    var at =
      typeof nowIso === "string" && !isNaN(Date.parse(nowIso)) ? nowIso : new Date().toISOString();
    var added = {
      id: opts.id,
      slot: opts.slot,
      t: opts.t || "S",
      shop: false,
      ate: at,
      logged: true,
    };
    meals.push(added);
    var tagged = meals.map(function (m, idx) {
      return { m: m, idx: idx };
    });
    tagged.sort(function (a, b) {
      var ra = slotRank(a.m.slot),
        rb = slotRank(b.m.slot);
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    });
    return { meals: tagged.map(function (x) {
      return x.m;
    }), added: added };
  }

  function gapLabel(prevIso, nextIso, isTrackedWeekend) {
    var n = diffDays(prevIso, nextIso);
    if (n <= 1) return null;
    var d = parse(prevIso);
    d.setUTCDate(d.getUTCDate() + 1);
    while (fmt(d) < nextIso) {
      var iso = fmt(d);
      if (!isWeekend(iso) || isTrackedWeekend(iso)) return n + " days later";
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return null;
  }

  var api = {
    naturalSlot: naturalSlot,
    place: place,
    apply: apply,
    cartDays: cartDays,
    dayFlags: dayFlags,
    gapLabel: gapLabel,
    logMeal: logMeal,
    logReplaceIndexes: logReplaceIndexes,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCartAdd = api;
})(this);
