/* Kitchen stock: event history, stock maths, shop stock-in. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var KEY = "weekdayfuel.inventory";
  var KEEP_DAYS = 120;
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var WHY = { count: true, used: true, toss: true };

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function toLocalDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseLocalDate(s) {
    var p = String(s).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function localMidnightFromIso(iso) {
    var d = new Date(iso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function nextDate(s) {
    var d = parseLocalDate(s);
    d.setDate(d.getDate() + 1);
    return toLocalDate(d);
  }

  function compareDate(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function isStart(s) {
    return typeof s === "string" && !isNaN(Date.parse(s));
  }

  function validEvent(e) {
    if (!e || typeof e !== "object") return false;
    if (typeof e.id !== "string" || !e.id) return false;
    if (typeof e.at !== "string" || isNaN(Date.parse(e.at))) return false;
    if (typeof e.item !== "string" || !e.item) return false;
    if (e.k === "buy") {
      return typeof e.order === "string" && typeof e.amount === "number" && isFinite(e.amount) && e.amount > 0;
    }
    if (e.k === "add") {
      return typeof e.amount === "number" && isFinite(e.amount) && e.amount > 0;
    }
    if (e.k === "set") {
      return typeof e.amount === "number" && isFinite(e.amount) && e.amount >= 0 && WHY[e.why];
    }
    return false;
  }

  function parse(json) {
    var raw;
    try {
      raw = typeof json === "string" ? JSON.parse(json) : json;
    } catch (e) {
      return null;
    }
    if (!raw || typeof raw !== "object" || raw.v !== 1 || !isStart(raw.start) || !Array.isArray(raw.events)) return null;
    var events = raw.events.filter(validEvent);
    return { v: 1, start: raw.start, events: events };
  }

  function nextCounter(events, now) {
    var prefix = now + "#";
    var n = 0;
    (events || []).forEach(function (e) {
      if (e.id.indexOf(prefix) === 0) {
        var x = parseInt(e.id.slice(prefix.length), 10);
        if (!isNaN(x) && x >= n) n = x + 1;
      }
    });
    return n;
  }

  function addEvents(inv, events, now) {
    var at = typeof now === "string" && !isNaN(Date.parse(now)) ? now : new Date().toISOString();
    var base = inv
      ? { v: inv.v, start: inv.start, events: inv.events.slice() }
      : { v: 1, start: at, events: [] };
    var n = nextCounter(base.events, at);
    var prefix = at + "#";
    (Array.isArray(events) ? events : []).forEach(function (ev) {
      if (!ev || typeof ev !== "object") return;
      var copy = {};
      Object.keys(ev).forEach(function (k) {
        copy[k] = ev[k];
      });
      if (!copy.at) copy.at = at;
      copy.id = prefix + n;
      n += 1;
      base.events.push(copy);
    });
    return base;
  }

  function removeOrder(inv, orderId) {
    if (!inv) return inv;
    return {
      v: inv.v,
      start: inv.start,
      events: inv.events.filter(function (e) {
        return !(e.k === "buy" && e.order === orderId);
      }),
    };
  }

  function prune(inv, now, days, cat, fixtureOn) {
    if (!inv) return inv;
    var when = now instanceof Date ? now : new Date(now);
    var cutoff = new Date(when.getFullYear(), when.getMonth(), when.getDate());
    cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
    var cutoffTs = cutoff.getTime();
    var cutoffIso = cutoff.toISOString();
    var hasOld = inv.events.some(function (e) {
      return Date.parse(e.at) < cutoffTs;
    });
    if (!hasOld) return inv;
    var d = days || {};
    var fx = typeof fixtureOn === "function" ? fixtureOn : function () {
      return false;
    };
    var atCutoff = cat ? stock(inv, d, cat, cutoff, fx) : {};
    var kept = inv.events.filter(function (e) {
      return Date.parse(e.at) >= cutoffTs;
    });
    var sets = [];
    var n = 0;
    Object.keys(atCutoff).forEach(function (item) {
      var amount = atCutoff[item].amount;
      if (!(amount > 1e-9)) return;
      sets.push({
        id: cutoffIso + "#prune-" + n,
        at: cutoffIso,
        k: "set",
        item: item,
        amount: amount,
        why: "count",
      });
      n += 1;
    });
    return {
      v: inv.v,
      start: inv.start,
      events: sets.concat(kept),
    };
  }

  function sumLots(lots) {
    return lots.reduce(function (a, l) {
      return a + l.amount;
    }, 0);
  }

  function sortLotsAsc(lots) {
    lots.sort(function (a, b) {
      if (a.at < b.at) return -1;
      if (a.at > b.at) return 1;
      return 0;
    });
  }

  function addLot(lots, at, amount) {
    lots.push({ at: at, amount: amount });
    sortLotsAsc(lots);
  }

  function consumeLots(lots, amount) {
    var need = amount;
    while (need > 1e-9 && lots.length) {
      var lot = lots[0];
      var take = Math.min(lot.amount, need);
      lot.amount -= take;
      need -= take;
      if (lot.amount <= 1e-9) lots.shift();
    }
  }

  function applySet(lots, target, now) {
    var total = sumLots(lots);
    if (target > total + 1e-9) {
      addLot(lots, now.toISOString(), target - total);
      return;
    }
    if (target <= 1e-9) {
      lots.length = 0;
      return;
    }
    var sorted = lots.slice().sort(function (a, b) {
      if (a.at > b.at) return -1;
      if (a.at < b.at) return 1;
      return 0;
    });
    var kept = [];
    var rem = target;
    sorted.forEach(function (l) {
      if (rem <= 1e-9) return;
      var take = Math.min(l.amount, rem);
      if (take > 1e-9) {
        kept.push({ at: l.at, amount: take });
        rem -= take;
      }
    });
    lots.length = 0;
    kept.forEach(function (l) {
      lots.push(l);
    });
    sortLotsAsc(lots);
  }

  function ageDays(atIso, now) {
    var lotDay = localMidnightFromIso(atIso);
    var nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (nowDay - lotDay) / 86400000;
  }

  function flagsForItem(cat, item, oldestAt, now) {
    var it = cat.item(item);
    if (!it || typeof it.keeps !== "number" || !(it.keeps > 0)) return { useSoon: false, off: false };
    var age = ageDays(oldestAt, now);
    var keeps = it.keeps;
    var useSoon = keeps <= 3 ? age >= keeps / 2 : age >= keeps - 1;
    var off = age > keeps;
    return { useSoon: useSoon, off: off };
  }

  function stock(inv, days, cat, now, fixtureOn) {
    if (!inv) return {};
    var when = now instanceof Date ? now : new Date(now);
    var fx = typeof fixtureOn === "function" ? fixtureOn : function () {
      return false;
    };
    var startDate = toLocalDate(new Date(inv.start));
    var endDate = toLocalDate(when);
    var actions = [];

    inv.events.forEach(function (e) {
      actions.push({ at: e.at, kind: e.k, event: e });
    });

    Object.keys(days || {}).forEach(function (date) {
      if (!DATE.test(date)) return;
      var day = days[date];
      if (!day || !Array.isArray(day.meals)) return;
      day.meals.forEach(function (m, i) {
        if (!m || typeof m.ate !== "string" || m.ate < inv.start) return;
        if (!m.id) return;
        var tier = m.t || "S";
        var per = cat.AMOUNTS[m.id];
        if (!per) return;
        Object.keys(per).forEach(function (item) {
          var amt = cat.amountFor(m.id, item, tier);
          if (amt > 0) actions.push({ at: m.ate, kind: "use", item: item, amount: amt, meal: true });
        });
      });
    });

    var d = startDate;
    while (compareDate(d, endDate) <= 0) {
      var mid = parseLocalDate(d).toISOString();
      if (fx(d, "dare")) actions.push({ at: mid, kind: "use", item: "dare", amount: 1 });
      if (fx(d, "grenade")) actions.push({ at: mid, kind: "use", item: "grenade", amount: 1 });
      d = nextDate(d);
    }

    function kindRank(k) {
      if (k === "set") return 0;
      if (k === "buy" || k === "add") return 1;
      return 2;
    }

    actions.sort(function (a, b) {
      if (a.at < b.at) return -1;
      if (a.at > b.at) return 1;
      var ra = kindRank(a.kind);
      var rb = kindRank(b.kind);
      if (ra !== rb) return ra - rb;
      if (a.kind === "use" && b.kind !== "use") return 1;
      if (a.kind !== "use" && b.kind === "use") return -1;
      return 0;
    });

    var lotsByItem = {};
    function lots(item) {
      if (!lotsByItem[item]) lotsByItem[item] = [];
      return lotsByItem[item];
    }

    actions.forEach(function (a) {
      if (a.kind === "buy" || a.kind === "add") {
        addLot(lots(a.event.item), a.at, a.event.amount);
        return;
      }
      if (a.kind === "set") {
        applySet(lots(a.event.item), a.event.amount, when);
        return;
      }
      if (a.kind === "use") {
        consumeLots(lots(a.item), a.amount);
      }
    });

    var out = {};
    Object.keys(lotsByItem).forEach(function (item) {
      var lots = lotsByItem[item];
      var amount = sumLots(lots);
      if (amount <= 1e-9) return;
      var oldest = lots[0].at;
      var fl = flagsForItem(cat, item, oldest, when);
      out[item] = { amount: amount, lots: lots.map(function (l) {
        return { at: l.at, amount: l.amount };
      }), useSoon: fl.useSoon, off: fl.off };
    });
    return out;
  }

  function pending(inv, days, today) {
    if (!inv || typeof today !== "string" || !DATE.test(today)) return [];
    var startDate = toLocalDate(new Date(inv.start));
    var out = [];
    Object.keys(days || {})
      .filter(function (d) {
        return DATE.test(d) && compareDate(d, startDate) >= 0 && compareDate(d, today) < 0;
      })
      .sort()
      .forEach(function (date) {
        var day = days[date];
        if (!day || !Array.isArray(day.meals)) return;
        day.meals.forEach(function (m, i) {
          if (!m || m.ate !== undefined) return;
          out.push({ date: date, i: i, id: m.id });
        });
      });
    return out;
  }

  function buysFromRows(rows, store, ticks, haveIt) {
    var other = store === "coles" ? "woolies" : "coles";
    var t = ticks || {};
    var hi = haveIt || {};
    var out = [];
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      if (t[row.id]) return;
      if (hi[row.id]) return;
      var line = row[store] || row[other];
      if (!line || !line.product) return;
      var qty = line.quantity;
      if (!(typeof qty === "number" && isFinite(qty) && qty > 0)) return;
      var amount = line.product.perKg ? qty * 1000 : qty * line.product.size;
      out.push({ item: row.id, amount: amount });
    });
    return out;
  }

  var api = {
    KEY: KEY,
    KEEP_DAYS: KEEP_DAYS,
    parse: parse,
    addEvents: addEvents,
    removeOrder: removeOrder,
    prune: prune,
    stock: stock,
    pending: pending,
    buysFromRows: buysFromRows,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelInventory = api;
})(this);
