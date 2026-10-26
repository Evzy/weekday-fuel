/* Kitchen stock: event history, stock maths, shop stock-in. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var ord = typeof module === "object" && module.exports ? require("./orders.js") : root.WeekdayFuelOrders;
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

  function endOfDay(dateStr) {
    var d = parseLocalDate(dateStr);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  function impliedAte(m, date, today) {
    if (!m) return null;
    if (typeof m.ate === "string") return m.ate;
    if (m.ate === false) return null;
    if (m.ate === undefined && compareDate(date, today) < 0) return endOfDay(date);
    return null;
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

  var PRODUCE_LEGACY_COUNT_G = { cucumber: 160, capsicum: 220 };

  function looksLikeLegacyProduceCount(amount) {
    if (!(amount > 0) || amount > 10) return false;
    var doubled = amount * 2;
    return Math.abs(doubled - Math.round(doubled)) < 1e-9;
  }

  /* Before unit g: amounts were whole cucumbers/capsicums. After: grams (usually >= 80). */
  function migrateProduceCountsToGrams(inv) {
    if (!inv || !Array.isArray(inv.events)) return inv;
    var changed = false;
    var events = inv.events.map(function (e) {
      var g = PRODUCE_LEGACY_COUNT_G[e.item];
      if (!g || !looksLikeLegacyProduceCount(e.amount)) return e;
      changed = true;
      var copy = {};
      Object.keys(e).forEach(function (k) {
        copy[k] = e[k];
      });
      copy.amount = Math.round(e.amount * g * 10) / 10;
      return copy;
    });
    return changed ? { v: inv.v, start: inv.start, events: events } : inv;
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

  function prune(inv, now, days, cat, staplesOn) {
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
    var staplesCb = typeof staplesOn === "function" ? staplesOn : function () {
      return [];
    };
    var atCutoff = cat ? stock(inv, d, cat, new Date(cutoffTs - 1), staplesCb) : {};
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

  function orderBuyMs(inv, orderId) {
    if (!inv || !Array.isArray(inv.events) || typeof orderId !== "string" || !orderId) return null;
    var ms = null;
    inv.events.forEach(function (e) {
      if (e.k !== "buy" || e.order !== orderId) return;
      var t = atMs(e.at);
      if (!isNaN(t) && (ms == null || t > ms)) ms = t;
    });
    return ms;
  }

  function stock(inv, days, cat, now, staplesOn) {
    if (!inv || !isStart(inv.start)) return {};
    var startMs = atMs(inv.start);
    if (isNaN(startMs)) return {};
    var when = now instanceof Date ? now : new Date(now);
    if (isNaN(when.getTime())) return {};
    var nowTs = when.getTime();
    var staplesCb = typeof staplesOn === "function" ? staplesOn : function () {
      return [];
    };
    var startDate = toLocalDate(new Date(startMs));
    var endDate = toLocalDate(when);
    var todayDate = toLocalDate(when);
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
        if (m && m.logged === true) return;
        var ateAt = impliedAte(m, date, todayDate);
        if (!ateAt) return;
        var ateMs = atMs(ateAt);
        if (typeof m.bought === "string" && m.bought) {
          var buyMs = orderBuyMs(inv, m.bought);
          if (buyMs != null && buyMs > ateMs) {
            ateMs = buyMs;
            ateAt = new Date(buyMs).toISOString();
          }
        }
        if (isNaN(ateMs) || ateMs > nowTs || ateMs < startMs) return;
        if (!m.id) return;
        var tier = mealTier(m);
        var per = cat && cat.AMOUNTS ? cat.AMOUNTS[m.id] : null;
        if (!per) return;
        Object.keys(per).forEach(function (item) {
          var amt = cat.amountFor(m.id, item, tier);
          if (amt > 0) actions.push({ ts: ateMs, at: ateAt, kind: "use", item: item, amount: amt, meal: true });
        });
      });
    });

    Object.keys(days || {}).forEach(function (date) {
      if (!DATE.test(date)) return;
      var dayExtras = days[date];
      if (!dayExtras || !Array.isArray(dayExtras.extras)) return;
      var useAt = endOfDay(date);
      var useMs = atMs(useAt);
      if (isNaN(useMs) || useMs > nowTs || useMs < startMs) return;
      dayExtras.extras.forEach(function (extra) {
        if (!extra || !Array.isArray(extra.uses)) return;
        extra.uses.forEach(function (u) {
          if (!u || typeof u.id !== "string" || !(u.amount > 0)) return;
          actions.push({ ts: useMs, at: useAt, kind: "use", item: u.id, amount: u.amount });
        });
      });
    });

    var d = startDate;
    while (compareDate(d, endDate) <= 0) {
      var mid = parseLocalDate(d).toISOString();
      var midTs = atMs(mid);
      if (midTs <= nowTs) {
        var dayStaples = staplesCb(d);
        if (Array.isArray(dayStaples)) {
          var dayRec = days && days[d];
          dayStaples.forEach(function (s) {
            if (!s || !s.id || !(s.amount > 0) || s.out) return;
            if (validStapleSwapChoice(cat, s.id, dayRec)) return;
            actions.push({ ts: midTs, at: mid, kind: "use", item: s.id, amount: s.amount });
          });
        }
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

  function validStapleSwapChoice(cat, stapleId, dayRec) {
    if (!dayRec || !dayRec.stapleChoice) return false;
    var swapId = dayRec.stapleChoice[stapleId];
    if (!swapId) return false;
    var it = cat && typeof cat.item === "function" ? cat.item(stapleId) : null;
    if (!it || !Array.isArray(it.swaps)) return false;
    for (var i = 0; i < it.swaps.length; i++) {
      if (it.swaps[i].id === swapId) return true;
    }
    return false;
  }

  function reserveMeal(out, cat, m, date, today) {
    if (!m || m.logged === true || m.ate === false) return;
    if (impliedAte(m, date, today)) return;
    if (m.ate !== undefined) return;
    var per = cat.AMOUNTS && cat.AMOUNTS[m.id];
    if (!per) return;
    var tier = m.t === "L" || m.t === "X" ? m.t : "S";
    Object.keys(per).forEach(function (item) {
      var a = cat.amountFor(m.id, item, tier);
      if (a > 0) addReserve(out, item, a);
    });
  }

  function reserveExtraUses(out, extras) {
    if (!Array.isArray(extras)) return;
    extras.forEach(function (extra) {
      if (!extra || !Array.isArray(extra.uses)) return;
      extra.uses.forEach(function (u) {
        if (u && typeof u.id === "string" && u.amount > 0) addReserve(out, u.id, u.amount);
      });
    });
  }

  function reserveMealsForDay(out, cat, day, d, today, shopDaySet, first, last, startDate) {
    if (!day || !Array.isArray(day.meals)) return;
    if (compareDate(d, startDate) <= 0) return;
    day.meals.forEach(function (m) {
      var bought = m && typeof m.bought === "string" && m.bought !== "";
      if (bought) {
        reserveMeal(out, cat, m, d, today);
        return;
      }
      if (m && m.shop === false) {
        if (compareDate(d, today) >= 0 || shopDaySet[d]) {
          reserveMeal(out, cat, m, d, today);
          return;
        }
      }
      if (shopDaySet[d]) return;
      var past = compareDate(d, today) < 0;
      var beforeFirst = first && compareDate(d, first) < 0;
      var betweenShops = first && last && compareDate(d, first) >= 0 && compareDate(d, last) <= 0;
      if (past || beforeFirst || betweenShops) reserveMeal(out, cat, m, d, today);
    });
  }

  function gapSpareReserved(inv, days, cat, today, weekEnd, shopDays, staplesOn) {
    var out = nullMap();
    if (!inv) return out;
    if (typeof today !== "string" || !DATE.test(today)) return out;
    var end = typeof weekEnd === "string" && DATE.test(weekEnd) ? weekEnd : today;
    if (compareDate(end, today) < 0) return out;
    var startDate = toLocalDate(new Date(inv.start));
    var shopArr = (Array.isArray(shopDays) ? shopDays.slice() : [])
      .filter(function (d) {
        return DATE.test(d);
      })
      .sort();
    var first = shopArr.length ? shopArr[0] : null;
    var last = shopArr.length ? shopArr[shopArr.length - 1] : null;
    var shopDaySet = nullMap();
    shopArr.forEach(function (d) {
      shopDaySet[d] = true;
    });
    var d = today;
    while (compareDate(d, end) <= 0) {
      var day = days && days[d];
      reserveMealsForDay(out, cat, day, d, today, shopDaySet, first, last, startDate);
      if (typeof staplesOn === "function" && compareDate(d, today) > 0) {
        var dayStaples = staplesOn(d);
        var dayRec = days && days[d];
        if (Array.isArray(dayStaples)) {
          dayStaples.forEach(function (s) {
            if (!s || !s.id || !(s.amount > 0) || s.out) return;
            if (validStapleSwapChoice(cat, s.id, dayRec)) return;
            addReserve(out, s.id, s.amount);
          });
        }
      }
      d = nextDate(d);
    }
    var todayDay = days && days[today];
    if (todayDay) reserveExtraUses(out, todayDay.extras);
    Object.keys(days || {}).forEach(function (d) {
      if (d === "__proto__" || !DATE.test(d)) return;
      if (compareDate(d, end) <= 0) return;
      if (compareDate(d, startDate) <= 0) return;
      var day = days[d];
      if (!day || !Array.isArray(day.meals)) return;
      day.meals.forEach(function (m) {
        var bought = m && typeof m.bought === "string" && m.bought !== "";
        if (bought) reserveMeal(out, cat, m, d, today);
      });
    });
    return out;
  }

  function reserved(inv, days, cat, today, shopDays, staplesOn) {
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
    var last = shopArr.length ? shopArr[shopArr.length - 1] : null;
    var shopDaySet = nullMap();
    shopArr.forEach(function (d) {
      shopDaySet[d] = true;
    });
    Object.keys(days || {}).forEach(function (d) {
      if (d === "__proto__" || !DATE.test(d) || compareDate(d, startDate) <= 0) return;
      var day = days[d];
      if (!day || !Array.isArray(day.meals)) return;
      day.meals.forEach(function (m) {
        var bought = m && typeof m.bought === "string" && m.bought !== "";
        if (bought) {
          reserveMeal(out, cat, m, d, today);
          return;
        }
        if (m && m.shop === false) {
          if (compareDate(d, today) >= 0 || shopDaySet[d]) {
            reserveMeal(out, cat, m, d, today);
            return;
          }
        }
        /* Meals on shop days are on the shop list, not reserved from stock. */
        if (shopDaySet[d]) return;
        var past = compareDate(d, today) < 0;
        var beforeFirst = first && compareDate(d, first) < 0;
        var betweenShops = first && last && compareDate(d, first) >= 0 && compareDate(d, last) <= 0;
        if (past || beforeFirst || betweenShops) reserveMeal(out, cat, m, d, today);
      });
    });
    Object.keys(days || {}).forEach(function (d) {
      if (compareDate(d, today) < 0) return;
      var day = days[d];
      if (day) reserveExtraUses(out, day.extras);
    });
    if (first && typeof staplesOn === "function") {
      var capD = parseLocalDate(today);
      capD.setDate(capD.getDate() + 366);
      var capDate = toLocalDate(capD);
      var fd = nextDate(today);
      while (compareDate(fd, first) < 0 && compareDate(fd, capDate) <= 0) {
        var dayStaples = staplesOn(fd);
        var dayRec = days && days[fd];
        if (Array.isArray(dayStaples)) dayStaples.forEach(function (s) {
          if (!s || !s.id || !(s.amount > 0) || s.out) return;
          if (validStapleSwapChoice(cat, s.id, dayRec)) return;
          addReserve(out, s.id, s.amount);
        });
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
      res = typeof res === "number" && isFinite(res) ? Math.max(0, res) : 0;
      var f = amount - res;
      if (f > 1e-9) out[item] = f;
    });
    return out;
  }

  function targetDayDate(targetDate) {
    if (typeof targetDate === "string" && DATE.test(targetDate)) return parseLocalDate(targetDate);
    if (targetDate instanceof Date && !isNaN(targetDate.getTime())) {
      return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    }
    return null;
  }

  /* Shop have: subtract reserved oldest-first, then drop lots that will be off by targetDate (first shop day, or today). */
  function freeForShop(stockMap, reservedMap, cat, targetDate) {
    var out = nullMap();
    if (!stockMap || typeof stockMap !== "object") return out;
    var when = targetDayDate(targetDate);
    if (!when) return free(stockMap, reservedMap);
    Object.keys(stockMap).forEach(function (item) {
      if (item === "__proto__") return;
      var st = stockMap[item];
      var amount = st && typeof st.amount === "number" ? st.amount : 0;
      var res = reservedMap && reservedMap[item];
      res = typeof res === "number" && isFinite(res) ? Math.max(0, res) : 0;
      var it = cat && typeof cat.item === "function" ? cat.item(item) : null;
      if (!it || typeof it.keeps !== "number" || !(it.keeps > 0) || !st.lots || !st.lots.length) {
        var plain = amount - res;
        if (plain > 1e-9) out[item] = plain;
        return;
      }
      var lots = st.lots.map(function (l) {
        return { at: l.at, amount: l.amount };
      });
      sortLotsAsc(lots);
      if (res > 1e-9) consumeLots(lots, res);
      var keeps = it.keeps;
      var sum = 0;
      lots.forEach(function (l) {
        if (l.amount <= 1e-9) return;
        if (ageDays(l.at, when) <= keeps) sum += l.amount;
      });
      if (sum > 1e-9) out[item] = sum;
    });
    return out;
  }

  function pending(inv, days, today) {
    return [];
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

  function amountFromSent(row, sent, colesSent, colesId) {
    if (!ord || !ord.sentLineQty) return null;
    var parts = ord.sentLineQty(row, sent, colesSent, colesId);
    if (!parts || !parts.length) return null;
    var sum = 0;
    for (var i = 0; i < parts.length; i++) sum += buyAmount(parts[i].product, parts[i].qty);
    return sum;
  }

  function productCode(product, store, colesId) {
    if (!product) return null;
    if (store === "coles") {
      var idFn = typeof colesId === "function" ? colesId : function () { return null; };
      var cid = idFn(product);
      return cid == null ? null : String(cid);
    }
    if (product.stockcode == null) return null;
    return String(product.stockcode);
  }

  function wooliesRowSentParts(row, sent) {
    var out = [];
    var seen = {};
    var s = sent || {};
    function tryAdd(prod) {
      if (!prod || prod.stockcode == null || seen[prod.stockcode]) return;
      if (!isQty(s[prod.stockcode])) return;
      seen[prod.stockcode] = true;
      out.push({ product: prod, qty: s[prod.stockcode] });
    }
    var w = row && row.woolies;
    if (w) {
      if (w.parts && w.parts.length) w.parts.forEach(function (p) { tryAdd(p.product); });
      else tryAdd(w.product);
      if (w.alts) {
        for (var ai = 0; ai < w.alts.length; ai++) tryAdd(w.alts[ai]);
      }
    }
    if (row && row.wooliesUnavailable) tryAdd(row.wooliesUnavailable);
    return out;
  }

  function colesRowSentParts(row, colesSent, colesId) {
    var out = [];
    var seen = {};
    var cs = colesSent || {};
    var idFn = typeof colesId === "function" ? colesId : function () { return null; };
    function tryAdd(prod) {
      if (!prod) return;
      var id = idFn(prod);
      if (id == null || seen[id]) return;
      if (!isQty(cs[id])) return;
      seen[id] = true;
      out.push({ product: prod, qty: cs[id] });
    }
    var c = row && row.coles;
    if (c) {
      if (c.parts && c.parts.length) c.parts.forEach(function (p) { tryAdd(p.product); });
      else tryAdd(c.product);
      if (c.alts) {
        for (var ci = 0; ci < c.alts.length; ci++) tryAdd(c.alts[ci]);
      }
    }
    if (row && row.colesUnavailable) tryAdd(row.colesUnavailable);
    return out;
  }

  /* Codes consumed by finish rows on the store being finished (Woolworths stockcodes or Coles ids only). */
  function sentCodesUsedByRows(rows, store, sent, colesSent, colesId) {
    var used = nullMap();
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      var parts = store === "coles" ? colesRowSentParts(row, colesSent, colesId) : wooliesRowSentParts(row, sent);
      parts.forEach(function (p) {
        var code = productCode(p.product, store, colesId);
        if (code != null) used[code] = true;
      });
    });
    return used;
  }

  function eachCatalogProduct(cat, fn) {
    var items = cat && cat.ITEMS ? cat.ITEMS : [];
    items.forEach(function (it) {
      function walk(prod) {
        if (prod) fn(it.id, prod);
      }
      walk(it.woolies);
      walk(it.coles);
      if (it.woolies && it.woolies.fallback) walk(it.woolies.fallback);
      if (it.coles && it.coles.fallback) walk(it.coles.fallback);
      if (it.woolies && it.woolies.packs) it.woolies.packs.forEach(walk);
      if (it.coles && it.coles.packs) it.coles.packs.forEach(walk);
      if (it.swaps) {
        it.swaps.forEach(function (sw) {
          walk(sw.woolies);
          walk(sw.coles);
        });
      }
      walk(it.wooliesUnavailable);
      walk(it.colesUnavailable);
    });
  }

  function lookupItemProduct(cat, code, store, colesId) {
    var hit = null;
    eachCatalogProduct(cat, function (itemId, prod) {
      if (hit) return;
      if (productCode(prod, store, colesId) === String(code)) hit = { item: itemId, product: prod };
    });
    return hit;
  }

  /* sentLines = sent record for the store being finished only (Woolworths lines or Coles lines). */
  function buysFromUnmatchedSent(sentLines, rows, cat, store, colesId, rowCtx) {
    var lines = sentLines && typeof sentLines === "object" ? sentLines : {};
    var ctx = rowCtx || {};
    var wSent = ctx.sent && typeof ctx.sent === "object" ? ctx.sent : {};
    var cSent = ctx.colesSent && typeof ctx.colesSent === "object" ? ctx.colesSent : {};
    var idFn = typeof colesId === "function" ? colesId : function () { return null; };
    var used = sentCodesUsedByRows(rows, store, wSent, cSent, idFn);
    var out = [];
    Object.keys(lines).forEach(function (code) {
      var qty = lines[code];
      if (!isQty(qty)) return;
      if (used[String(code)]) return;
      var hit = lookupItemProduct(cat, code, store, idFn);
      if (!hit) return;
      out.push({ item: hit.item, amount: buyAmount(hit.product, qty) });
    });
    return out;
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
      if (row.sec === 2) {
        var keepIt = o.cat && typeof o.cat.item === "function" ? o.cat.item(row.id) : null;
        if (!keepIt || typeof keepIt.keeps !== "number" || !(keepIt.keeps > 0)) return;
      }
      var line = row[store] || row[other];
      if (!line || !line.product) return;
      var amount = 0;
      if (line.parts && line.parts.length) {
        line.parts.forEach(function (pt) {
          if (isQty(pt.quantity)) amount += buyAmount(pt.product, pt.quantity);
        });
      } else if (isQty(line.quantity)) amount = buyAmount(line.product, line.quantity);
      if (!(amount > 0)) return;
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
    reserved: reserved,
    gapSpareReserved: gapSpareReserved,
    free: free,
    freeForShop: freeForShop,
    buysFromRows: buysFromRows,
    buysFromUnmatchedSent: buysFromUnmatchedSent,
    shopHaveIt: shopHaveIt,
    migrateProduceCountsToGrams: migrateProduceCountsToGrams,
    impliedAte: impliedAte,
    endOfDay: endOfDay,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelInventory = api;
})(this);
