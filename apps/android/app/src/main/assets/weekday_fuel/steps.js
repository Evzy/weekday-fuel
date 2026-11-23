/* Daily step counts from the host (Health Connect), cached on this device. */
(function (root) {
  "use strict";

  var STATUSES = ["ok", "noPermission", "unavailable", "updateRequired", "error"];
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var KEEP_DAYS = 60;

  function pad(n) { return String(n).padStart(2, "0"); }
  function parse(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }

  function mergeReply(cache, reply, nowIso) {
    if (!reply || reply.type !== "steps" || STATUSES.indexOf(reply.status) < 0) return cache;
    if (reply.status === "noPermission" || reply.status === "unavailable") {
      return { days: {}, status: reply.status, at: nowIso };
    }
    var days = Object.assign({}, (cache && cache.days) || {});
    var src = reply.days && typeof reply.days === "object" && !Array.isArray(reply.days) ? reply.days : {};
    Object.keys(src).forEach(function (k) {
      var v = src[k];
      if (DATE.test(k) && typeof v === "number" && Number.isInteger(v) && v >= 0) days[k] = v;
    });
    var keys = Object.keys(days).filter(function (k) { return DATE.test(k); }).sort();
    if (keys.length) {
      var oldest = addDays(keys[keys.length - 1], -KEEP_DAYS);
      Object.keys(days).forEach(function (k) { if (!DATE.test(k) || k < oldest) delete days[k]; });
    }
    return { days: days, status: reply.status, at: nowIso };
  }

  function countFor(cache, date) {
    var v = cache && cache.days ? cache.days[date] : undefined;
    return typeof v === "number" ? v : null;
  }

  function avg7(cache, endDate) {
    var sum = 0, n = 0;
    for (var i = 0; i < 7; i++) {
      var v = countFor(cache, addDays(endDate, -i));
      if (v != null) { sum += v; n++; }
    }
    if (n < 4) return null;
    return Math.round(sum / n / 10) * 10;
  }

  function rangeToRead(todayIso) { return { from: addDays(todayIso, -7), to: todayIso }; }

  function format(n) { return Number(n).toLocaleString("en-AU"); }

  var api = { STATUSES: STATUSES, addDays: addDays, mergeReply: mergeReply, countFor: countFor, avg7: avg7, rangeToRead: rangeToRead, format: format };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelSteps = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
