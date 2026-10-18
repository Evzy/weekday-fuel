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

  function atMs(at) {
    return Date.parse(at);
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
      return typeof e.order === "string" && e.order && typeof e.amount === "number" && isFinite(e.amount) && e.amount > 0;
    }
    if (e.k === "add") {
      return typeof e.amount === "number" && isFinite(e.amount) && e.amount > 0;
    }
    if (e.k === "set") {
      return typeof e.amount === "number" && isFinite(e.amount) && e.amount >= 0 && WHY[e.why];
    }
    return false;
  }

  function validIncoming(e) {
    if (!e || typeof e !== "object") return false;
    if (e.at != null && e.at !== "") {
      if (typeof e.at !== "string" || isNaN(Date.parse(e.at))) return false;
    }
    var at =
      typeof e.at === "string" && e.at && !isNaN(Date.parse(e.at)) ? e.at : "2020-01-01T00:00:00.000Z";
    return validEvent({
      id: "x",
      at: at,
      k: e.k,
      item: e.item,
      amount: e.amount,
      order: e.order,
      why: e.why,
    });
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
      if (!validIncoming(ev)) return;
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
    if (isNaN(when.getTime())) return inv;
    var cutoff = new Date(when.getFullYear(), when.getMonth(), when.getDate());
    cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
    var cutoffTs = cutoff.getTime();
    var cutoffIso = cutoff.toISOString();
    var hasOld = inv.events.some(function (e) {
      return atMs(e.at) < cutoffTs;
    });
    if (!hasOld) return inv;
    var d = days || {};
    var fx = typeof fixtureOn === "function" ? fixtureOn : function () {
      return false;
    };
    var atCutoff = cat ? stock(inv, d, cat, new Date(cutoffTs - 1), fx) : {};
    var kept = inv.events.filter(function (e) {
      return atMs(e.at) >= cutoffTs;
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
      return atMs(a.at) - atMs(b.at);
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

  function applySet(lots, target, atDate) {
    var atIso = atDate instanceof Date ? atDate.toISOString() : atDate;
    var total = sumLots(lots);
    if (target > total + 1e-9) {
      addLot(lots, atIso, target - total);
      return;
    }
    if (target <= 1e-9) {
      lots.length = 0;
      return;
    }
    var sorted = lots.slice().sort(function (a, b) {
      return atMs(b.at) - atMs(a.at);
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
    var lot = new Date(atIso);
    var lotDay = new Date(lot.getFullYear(), lot.getMonth(), lot.getDate());
    var nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((nowDay - lotDay) / 86400000);
  }

  function flagsForItem(cat, item, oldestAt, now) {
    if (!cat || typeof cat.item !== "function") return { useSoon: false, off: false };
    var it = cat.item(item);
    if (!it || typeof it.keeps !== "number" || !(it.keeps > 0)) return { useSoon: false, off: false };
    var age = ageDays(oldestAt, now);
    var keeps = it.keeps;
    var useSoon = keeps <= 3 ? age >= keeps / 2 : age >= keeps - 1;
    var off = age > keeps;
    return { useSoon: useSoon, off: off };
  }

  function mealTier(m) {
    return m.t === "L" || m.t === "X" ? m.t : "S";
  }

  function stock(inv, days, cat, now, fixtureOn) {
    if (!inv || !isStart(inv.start)) return {};
    var startMs = atMs(inv.start);
    if (isNaN(startMs)) return {};
    var when = now instanceof Date ? now : new Date(now);
    if (isNaN(when.getTime())) return {};
    var nowTs = when.getTime();
    var fx = typeof fixtureOn === "function" ? fixtureOn : function () {
      return false;
    };
    var startDate = toLocalDate(new Date(startMs));
    var endDate = toLocalDate(when);
    var actions = [];

    inv.events.forEach(function (e) {
      var ts = atMs(e.at);
      if (isNaN(ts) || ts > nowTs) return;
      actions.push({ ts: ts, at: e.at, kind: e.k, event: e });
    });

    Object.keys(days || {}).forEach(function (date) {
      if (!DATE.test(date)) return;
      var day = days[date];
      if (!day || !Array.isArray(day.meals)) return;
      day.meals.forEach(function (m) {
        if (!m || typeof m.ate !== "string") return;
        var ateMs = atMs(m.ate);
        if (isNaN(ateMs) || ateMs > nowTs || ateMs < startMs) return;
        if (!m.id) return;
        var tier = mealTier(m);
        var per = cat && cat.AMOUNTS ? cat.AMOUNTS[m.id] : null;
        if (!per) return;
        Object.keys(per).forEach(function (item) {
          var amt = cat.amountFor(m.id, item, tier);
          if (amt > 0) actions.push({ ts: ateMs, at: m.ate, kind: "use", item: item, amount: amt, meal: true });
        });
      });
    });

    var d = startDate;
    while (compareDate(d, endDate) <= 0) {
      var mid = parseLocalDate(d).toISOString();
      var midTs = atMs(mid);
      if (midTs <= nowTs) {
        if (fx(d, "dare")) actions.push({ ts: midTs, at: mid, kind: "use", item: "dare", amount: 1 });
        if (fx(d, "grenade")) actions.push({ ts: midTs, at: mid, kind: "use", item: "grenade", amount: 1 });
      }
      d = nextDate(d);
    }

    function kindRank(k) {
      if (k === "set") return 0;
      if (k === "buy" || k === "add") return 1;
      return 2;
    }

    actions.sort(function (a, b) {
      if (a.ts !== b.ts) return a.ts - b.ts;
      var ra = kindRank(a.kind);
      var rb = kindRank(b.kind);
      if (ra !== rb) return ra - rb;
      if (a.kind === "use" && b.kind !== "use") return 1;
      if (a.kind !== "use" && b.kind === "use") return -1;
      return 0;
    });

    var lotsByItem = Object.create(null);
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
        applySet(lots(a.event.item), a.event.amount, new Date(a.ts));
        return;
      }
      if (a.kind === "use") {
        consumeLots(lots(a.item), a.amount);
      }
    });

    var out = Object.create(null);
    Object.keys(lotsByItem).forEach(function (item) {
      var itemLots = lotsByItem[item];
      var amount = sumLots(itemLots);
      if (amount <= 1e-9) return;
      var oldest = itemLots[0].at;
      var fl = flagsForItem(cat, item, oldest, when);
      out[item] = {
        amount: amount,
        lots: itemLots.map(function (l) {
          return { at: l.at, amount: l.amount };
        }),
        useSoon: fl.useSoon,
        off: fl.off,
      };
    });
    return out;
  }

  function nullMap() {
    return Object.create(null);
  }

  function addReserve(out, item, amount) {
    if (!(amount > 0)) return;
    out[item] = (out[item] || 0) + amount;
  }

  function reserveMeal(out, cat, m) {
    if (!m || m.ate !== undefined) return;
    var per = cat.AMOUNTS && cat.AMOUNTS[m.id];
    if (!per) return;
    var tier = m.t === "L" || m.t === "X" ? m.t : "S";
    Object.keys(per).forEach(function (item) {
      var a = cat.amountFor(m.id, item, tier);
      if (a > 0) addReserve(out, item, a);
    });
  }

  function reserved(inv, days, cat, today, shopDays, fixtureOn) {
    var out = nullMap();
    if (!inv) return out;
    if (typeof today !== "string" || !DATE.test(today)) return out;
    var startDate = toLocalDate(new Date(inv.start));
    var shopArr = (Array.isArray(shopDays) ? shopDays.slice() : [])
      .filter(function (d) {
        return DATE.test(d);
      })
      .sort();
    var first = shopArr.length ? shopArr[0] : null;
    var shopDaySet = nullMap();
    shopArr.forEach(function (d) {
      shopDaySet[d] = true;
    });
    Object.keys(days || {}).forEach(function (d) {
      if (d === "__proto__" || !DATE.test(d) || compareDate(d, startDate) <= 0) return;
      var day = days[d];
      if (!day || !Array.isArray(day.meals)) return;
      var inPendingWindow = first ? compareDate(d, first) < 0 : compareDate(d, today) < 0;
      day.meals.forEach(function (m) {
        if (shopDaySet[d] && m && m.shop === false) {
          reserveMeal(out, cat, m);
          return;
        }
        if (!inPendingWindow) return;
        if (shopDaySet[d]) return;
        reserveMeal(out, cat, m);
      });
    });
    if (first && typeof fixtureOn === "function") {
      var fd = nextDate(today);
      while (compareDate(fd, first) < 0) {
        if (fixtureOn(fd, "dare")) addReserve(out, "dare", 1);
        if (fixtureOn(fd, "grenade")) addReserve(out, "grenade", 1);
        fd = nextDate(fd);
      }
    }
    return out;
  }

  function free(stockMap, reservedMap) {
    var out = nullMap();
    if (!stockMap || typeof stockMap !== "object") return out;
    Object.keys(stockMap).forEach(function (item) {
      if (item === "__proto__") return;
      var st = stockMap[item];
      var amount = st && typeof st.amount === "number" ? st.amount : 0;
      var res = reservedMap && reservedMap[item];
      res = typeof res === "number" && isFinite(res) ? res : 0;
      var f = amount - res;
      if (f > 1e-9) out[item] = f;
    });
    return out;
  }

  function pending(inv, days, today) {
    if (!inv || typeof today !== "string" || !DATE.test(today)) return [];
    var startDate = toLocalDate(new Date(inv.start));
    var out = [];
    Object.keys(days || {})
      .filter(function (d) {
        return DATE.test(d) && compareDate(d, startDate) > 0 && compareDate(d, today) < 0;
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

  function shopHaveIt(trolley, sent) {
    if (trolley && trolley.haveIt && typeof trolley.haveIt === "object") return trolley.haveIt;
    if (sent && sent.haveIt && typeof sent.haveIt === "object") return sent.haveIt;
    return {};
  }

  function isQty(q) {
    return typeof q === "number" && isFinite(q) && q > 0;
  }

  function buyAmount(product, qty) {
    if (product.perKg) return qty * 1000;
    return qty * product.size;
  }

  /* Same sent-line checks as orders.snapshot: if the trolley sent this row, stock that amount. */
  function amountFromSent(row, sent, colesSent, colesId) {
    var w = row.woolies;
    var gone = row.wooliesUnavailable;
    var c = row.coles;
    var cGone = row.colesUnavailable;
    var cId = c ? colesId(c.product) : null;
    var cGoneId = cGone ? colesId(cGone) : null;
    if (w && isQty(sent[w.product.stockcode])) return buyAmount(w.product, sent[w.product.stockcode]);
    if (w && w.alts) {
      for (var ai = 0; ai < w.alts.length; ai++) {
        var wAlt = w.alts[ai];
        if (isQty(sent[wAlt.stockcode])) return buyAmount(wAlt, sent[wAlt.stockcode]);
      }
    }
    if (gone && isQty(sent[gone.stockcode])) return buyAmount(gone, sent[gone.stockcode]);
    if (cId && isQty(colesSent[cId])) return buyAmount(c.product, colesSent[cId]);
    if (c && c.alts) {
      for (var ci = 0; ci < c.alts.length; ci++) {
        var cAlt = c.alts[ci];
        var altId = colesId(cAlt);
        if (altId && isQty(colesSent[altId])) return buyAmount(cAlt, colesSent[altId]);
      }
    }
    if (cGoneId && isQty(colesSent[cGoneId])) return buyAmount(cGone, colesSent[cGoneId]);
    return null;
  }

  function buysFromRows(rows, store, ticks, haveIt, opts) {
    var o = opts || {};
    var sent = o.sent && typeof o.sent === "object" ? o.sent : {};
    var colesSent = o.colesSent && typeof o.colesSent === "object" ? o.colesSent : {};
    var colesId = typeof o.colesId === "function" ? o.colesId : function () { return null; };
    var other = store === "coles" ? "woolies" : "coles";
    var t = ticks || {};
    var hi = haveIt || {};
    var out = [];
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var fromSent = amountFromSent(row, sent, colesSent, colesId);
      if (fromSent != null) {
        out.push({ item: row.id, amount: fromSent });
        return;
      }
      if (hi[row.id]) return;
      if (t[row.id]) return;
      if (row.sec === 2) return;
      var line = row[store] || row[other];
      if (!line || !line.product) return;
      var qty = line.quantity;
      if (!isQty(qty)) return;
      out.push({ item: row.id, amount: buyAmount(line.product, qty) });
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
    reserved: reserved,
    free: free,
    buysFromRows: buysFromRows,
    shopHaveIt: shopHaveIt,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelInventory = api;
})(this);
