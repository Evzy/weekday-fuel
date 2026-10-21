/* Weekly weigh-in trend verdict. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function parseIso(s) {
    var p = s.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function iso(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function addDays(s, n) {
    var d = parseIso(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  function weightSeries(weights) {
    var w = weights || {};
    return Object.keys(w)
      .filter(function (k) {
        return w[k] && isFinite(w[k].kg);
      })
      .sort()
      .map(function (k) {
        return { d: k, kg: +w[k].kg };
      });
  }

  function avgWindow(weights, endDate, days) {
    var start = addDays(endDate, -(days - 1));
    var v = weightSeries(weights).filter(function (x) {
      return x.d >= start && x.d <= endDate;
    });
    if (!v.length) return null;
    return { avg: v.reduce(function (a, b) { return a + b.kg; }, 0) / v.length, n: v.length };
  }

  function verdict(weights, today, modeKey, modes, changed, opts) {
    opts = opts || {};
    var fmtDay = typeof opts.fmtDay === "function" ? opts.fmtDay : function (s) { return s; };
    var cur = avgWindow(weights, today, 7);
    var prev = avgWindow(weights, addDays(today, -7), 7);
    var mode = modes[modeKey];
    if (!cur || cur.n < 3) {
      return {
        state: "wait",
        head: "Keep weighing in",
        body: "Log at least 3 weigh-ins this week and the trend will show here. Weigh first thing in the morning, after the toilet, before food or the Dare.",
      };
    }
    if (!prev || prev.n < 3) {
      return {
        state: "wait",
        head: "7-day average: " + cur.avg.toFixed(1) + " kg",
        body: "You need one more week of weigh-ins to compare against. Keep logging.",
      };
    }
    var delta = cur.avg - prev.avg;
    var adj = 0;
    var head;
    var st = "good";
    if (delta < mode.lo) {
      adj = +150;
      st = "bad";
      head = "Dropping faster than planned";
    } else if (delta > mode.hi) {
      adj = -150;
      st = "bad";
      head = modeKey === "bulk" ? "Gaining faster than planned" : "Trending up";
    } else if (modeKey === "cut" && delta > -0.25) {
      adj = -150;
      st = "bad";
      head = "Cut has stalled";
    } else if (modeKey === "bulk" && delta < 0.1) {
      adj = +150;
      st = "bad";
      head = "Not gaining yet";
    } else {
      head = "On track for " + mode.label.toLowerCase();
    }
    var hold = null;
    if (changed && changed.at && today < addDays(changed.at, 7)) {
      hold = { at: changed.at, by: changed.by, next: addDays(changed.at, 7) };
      adj = 0;
    }
    var base =
      "This week averaged " +
      cur.avg.toFixed(1) +
      " kg vs " +
      prev.avg.toFixed(1) +
      " kg last week (" +
      (delta >= 0 ? "+" : "") +
      delta.toFixed(2) +
      " kg). Target pace for " +
      mode.label.toLowerCase() +
      " is " +
      (mode.rate > 0 ? "+" : "") +
      mode.rate.toFixed(2) +
      " kg/week.";
    var tail;
    if (hold) {
      tail =
        " Changed " +
        (hold.by > 0 ? "+" : "") +
        hold.by +
        " kcal on " +
        fmtDay(hold.at) +
        "; next check from " +
        fmtDay(hold.next) +
        ".";
    } else if (adj) {
      tail = " Suggest moving weekday calories " + (adj > 0 ? "up" : "down") + " " + Math.abs(adj) + " kcal.";
    } else {
      tail = " Keep weekdays where they are.";
    }
    var out = { state: st, head: head, body: base + tail, adj: adj, delta: delta };
    if (hold) out.hold = hold;
    return out;
  }

  var api = { verdict: verdict, weightSeries: weightSeries, avgWindow: avgWindow };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelTrend = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
