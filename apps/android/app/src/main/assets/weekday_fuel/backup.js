/* Backup: build, parse, summary, restore plan. Pure: no DOM, no real storage. */
(function (root) {
  "use strict";

  var PREFIX = "weekdayfuel.";
  var EXCLUDE = [
    "weekdayfuel.v1.prices",
    "weekdayfuel.v1.colesPrices",
    "weekdayfuel.backup",
    "weekdayfuel.beforeRestore",
  ];

  function isExcluded(k) {
    for (var i = 0; i < EXCLUDE.length; i++) {
      if (EXCLUDE[i] === k) return true;
    }
    return false;
  }

  function appKeys(storage) {
    var keys = storage.keys();
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.indexOf(PREFIX) !== 0) continue;
      if (isExcluded(k)) continue;
      out.push(k);
    }
    out.sort();
    return out;
  }

  function build(storage, now, appVersion) {
    var data = {};
    var keys = appKeys(storage);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      data[key] = storage.get(key);
    }
    var obj = {
      app: "weekdayfuel",
      v: 1,
      exportedAt: now.toISOString(),
      appVersion: appVersion,
      data: data,
    };
    return JSON.stringify(obj, null, 2);
  }

  function parse(text) {
    var raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: "That file isn't JSON." };
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "That isn't a Weekday Fuel backup." };
    }
    if (raw.app !== "weekdayfuel") {
      return { ok: false, error: "That isn't a Weekday Fuel backup." };
    }
    if (typeof raw.v === "number" && raw.v > 1) {
      return {
        ok: false,
        error: "This backup is from a newer version of the app. Update the app first.",
      };
    }
    if (raw.v !== 1) {
      return { ok: false, error: "That isn't a Weekday Fuel backup." };
    }
    if (!raw.data || typeof raw.data !== "object" || Array.isArray(raw.data)) {
      return { ok: false, error: "The backup's data is damaged." };
    }
    var data = {};
    var dk = Object.keys(raw.data);
    for (var i = 0; i < dk.length; i++) {
      var k = dk[i];
      if (k.indexOf(PREFIX) !== 0) continue;
      if (isExcluded(k)) continue;
      var v = raw.data[k];
      if (typeof v !== "string") {
        return { ok: false, error: "The backup's data is damaged." };
      }
      data[k] = v;
    }
    return {
      ok: true,
      backup: {
        app: raw.app,
        v: raw.v,
        exportedAt: raw.exportedAt,
        appVersion: raw.appVersion,
        data: data,
      },
    };
  }

  function countKeys(obj) {
    if (!obj || typeof obj !== "object") return 0;
    return Object.keys(obj).length;
  }

  function summary(backup) {
    var data = (backup && backup.data) || {};
    var exportedAt = backup && backup.exportedAt;
    var appVersion = backup && backup.appVersion;
    var days = 0;
    var weighIns = 0;
    var orders = 0;
    var hasKitchen = typeof data["weekdayfuel.inventory"] === "string";

    try {
      var main = data["weekdayfuel.v1"];
      if (typeof main === "string") {
        var st = JSON.parse(main);
        days = countKeys(st && st.days);
        weighIns = countKeys(st && st.weights);
      }
    } catch (e) {
      days = 0;
      weighIns = 0;
    }

    try {
      var ord = data["weekdayfuel.v1.orders"];
      if (typeof ord === "string") {
        var arr = JSON.parse(ord);
        orders = Array.isArray(arr) ? arr.length : 0;
      }
    } catch (e) {
      orders = 0;
    }

    return {
      exportedAt: exportedAt,
      appVersion: appVersion,
      days: days,
      orders: orders,
      weighIns: weighIns,
      hasKitchen: hasKitchen,
    };
  }

  function plural(n, sing, plur) {
    return n === 1 ? "1 " + sing : n + " " + plur;
  }

  function summaryText(sum, fmtDate) {
    var parts = [];
    parts.push("Backup from " + fmtDate(sum.exportedAt));
    if (sum.appVersion != null && sum.appVersion !== "") {
      parts.push("v" + sum.appVersion);
    }
    parts.push(plural(sum.days, "day", "days"));
    if (sum.orders) parts.push(plural(sum.orders, "order", "orders"));
    if (sum.weighIns) parts.push(plural(sum.weighIns, "weigh-in", "weigh-ins"));
    if (sum.hasKitchen) parts.push("Kitchen stock");
    return parts.join(" · ");
  }

  function restorePlan(storage, backup) {
    var data = (backup && backup.data) || {};
    var backupKeys = Object.keys(data).sort();
    var current = appKeys(storage);
    var remove = [];
    for (var i = 0; i < current.length; i++) {
      var k = current[i];
      if (!Object.prototype.hasOwnProperty.call(data, k)) remove.push(k);
    }
    remove.sort();
    var set = {};
    for (var j = 0; j < backupKeys.length; j++) {
      var key = backupKeys[j];
      set[key] = data[key];
    }
    return { remove: remove, set: set };
  }

  function applyPlan(storage, plan) {
    var i;
    var remove = plan.remove || [];
    for (i = 0; i < remove.length; i++) {
      storage.remove(remove[i]);
    }
    var set = plan.set || {};
    var keys = Object.keys(set);
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      storage.set(k, set[k]);
    }
  }

  var api = {
    PREFIX: PREFIX,
    EXCLUDE: EXCLUDE,
    appKeys: appKeys,
    build: build,
    parse: parse,
    summary: summary,
    summaryText: summaryText,
    restorePlan: restorePlan,
    applyPlan: applyPlan,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelBackup = api;
})(this);
