/* Rest-day / gym-day calorie targets and the one-time rest-target settings update. */
(function (root) {
  "use strict";

  var OLD_DEFAULTS = { cut: 2150, recomp: 2500, bulk: 2800 };
  var NEW_DEFAULTS = { cut: 1900, recomp: 2250, bulk: 2550 };
  var GYM_BONUS = 250;
  var NOTE = "Your kcal targets are now rest-day targets; gym days add 250. Check your numbers in Targets.";

  function bonus(settings) {
    var b = settings && settings.gymBonus;
    return typeof b === "number" && isFinite(b) ? b : GYM_BONUS;
  }

  function forDay(settings, day) {
    var k = settings.kcal[settings.mode] + (settings.adjust || 0);
    if (day && day.gym === true) k += bonus(settings);
    if (day && day.adj && typeof day.adj.k === "number" && isFinite(day.adj.k)) k += day.adj.k;
    return { k: k, p: settings.protein };
  }

  function gymLabel(settings, day) {
    return day && day.gym === true ? " · +" + bonus(settings) + " gym" : "";
  }

  function migrate(settings) {
    var s = JSON.parse(JSON.stringify(settings || {}));
    if (s.restTargets === true) return { settings: s, changed: false, note: null };
    var custom = false;
    s.kcal = s.kcal || {};
    Object.keys(OLD_DEFAULTS).forEach(function (m) {
      if (s.kcal[m] === OLD_DEFAULTS[m] || s.kcal[m] == null) s.kcal[m] = NEW_DEFAULTS[m];
      else if (s.kcal[m] !== NEW_DEFAULTS[m]) custom = true;
    });
    if (!(typeof s.gymBonus === "number" && isFinite(s.gymBonus))) s.gymBonus = GYM_BONUS;
    s.restTargets = true;
    return { settings: s, changed: true, note: custom ? NOTE : null };
  }

  /* changed < 0 means the day has no meals to fit */
  function refitNote(gym, k, changed) {
    var kind = gym ? "Gym day" : "Rest day";
    if (changed < 0) return kind + ": target " + k + " kcal.";
    if (changed === 0) return "Portions already fit " + k + " kcal.";
    return kind + ": portions re-fitted to " + k + " kcal.";
  }

  var api = { OLD_DEFAULTS: OLD_DEFAULTS, NEW_DEFAULTS: NEW_DEFAULTS, GYM_BONUS: GYM_BONUS, forDay: forDay, gymLabel: gymLabel, migrate: migrate, refitNote: refitNote };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelTargets = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
