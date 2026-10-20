/* Past orders: the snapshot saved when a shop is finished, and the stored list. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var KEEP = 30;
  var GROUPS = ["ordered", "had", "pantry", "buy"];
  var GROUP_TITLES = { ordered: "Ordered on Woolworths", had: "Already had", pantry: "Pantry, presumed at home", buy: "Buy yourself" };
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DATE = /^\d{4}-\d{2}-\d{2}$/;

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function money(n) {
    return "$" + n.toFixed(2);
  }

  function isQty(q) {
    return typeof q === "number" && isFinite(q) && q > 0;
  }

  function productId(product, store, colesId) {
    if (!product) return null;
    if (store === "coles") {
      var idFn = typeof colesId === "function" ? colesId : function () { return null; };
      return idFn(product);
    }
    return product.stockcode;
  }

  function wooliesSentParts(w, gone, sent) {
    var out = [];
    var seen = {};
    var s = sent || {};
    function tryAdd(prod) {
      if (!prod || prod.stockcode == null || seen[prod.stockcode]) return;
      if (!isQty(s[prod.stockcode])) return;
      seen[prod.stockcode] = true;
      out.push({ product: prod, qty: s[prod.stockcode] });
    }
    if (w) {
      if (w.parts && w.parts.length) w.parts.forEach(function (p) { tryAdd(p.product); });
      else tryAdd(w.product);
      if (w.alts) {
        for (var ai = 0; ai < w.alts.length; ai++) tryAdd(w.alts[ai]);
      }
    }
    if (gone) tryAdd(gone);
    return out;
  }

  function colesSentParts(c, cGone, colesSent, colesId) {
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
    if (c) {
      if (c.parts && c.parts.length) c.parts.forEach(function (p) { tryAdd(p.product); });
      else tryAdd(c.product);
      if (c.alts) {
        for (var ci = 0; ci < c.alts.length; ci++) tryAdd(c.alts[ci]);
      }
    }
    if (cGone) tryAdd(cGone);
    return out;
  }

  /* Same sent-line checks as snapshot / inventory stock-in. Returns [{ product, qty }, …]. */
  function sentLineQty(row, sent, colesSent, colesId) {
    if (!row || typeof row !== "object") return [];
    var wParts = wooliesSentParts(row.woolies, row.wooliesUnavailable, sent);
    if (wParts.length) return wParts;
    return colesSentParts(row.coles, row.colesUnavailable, colesSent, colesId);
  }

  function rowHasSentLine(row, sent, colesSent, colesId) {
    return sentLineQty(row, sent, colesSent, colesId).length > 0;
  }

  function packChangedSinceSending(line, parts, store, colesId) {
    if (!line || !parts.length) return false;
    var plan = {};
    if (line.parts && line.parts.length) {
      line.parts.forEach(function (p) {
        var id = productId(p.product, store, colesId);
        if (id != null) plan[String(id)] = true;
      });
    } else if (line.product) {
      var pid = productId(line.product, store, colesId);
      if (pid != null) plan[String(pid)] = true;
    }
    var sentMap = {};
    parts.forEach(function (p) {
      var id = productId(p.product, store, colesId);
      if (id != null) sentMap[String(id)] = true;
    });
    var planKeys = Object.keys(plan).sort();
    var sentKeys = Object.keys(sentMap).sort();
    if (planKeys.length !== sentKeys.length) return true;
    for (var i = 0; i < planKeys.length; i++) if (planKeys[i] !== sentKeys[i]) return true;
    return false;
  }

  function orderedFromSentParts(line, parts, store, forText, colesId) {
    var changed = packChangedSinceSending(line, parts, store, colesId);
    var note = changed ? "pack size changed since sending" : null;
    if (!changed && line && parts.length === 1) {
      var oneId = productId(parts[0].product, store, colesId);
      var lineId = productId(line.product, store, colesId);
      if (oneId != null && String(oneId) === String(lineId)) return orderedItem(line, line.product, parts[0].qty, null, forText, store);
    }
    if (!changed && line && line.parts && line.parts.length === parts.length) {
      var exact = true;
      for (var i = 0; i < line.parts.length; i++) {
        var lp = line.parts[i];
        var lid = productId(lp.product, store, colesId);
        var sp = null;
        for (var j = 0; j < parts.length; j++) {
          if (String(productId(parts[j].product, store, colesId)) === String(lid)) {
            sp = parts[j];
            break;
          }
        }
        if (!sp || Math.abs(sp.qty - lp.quantity) > 1e-9) {
          exact = false;
          break;
        }
      }
      if (exact) return orderedItem(line, line.product, line.quantity, null, forText, store);
    }
    if (changed && parts.length === 1) {
      return orderedItem(null, parts[0].product, parts[0].qty, note, forText, store);
    }
    var buy = parts
      .map(function (p) {
        return amount(p.product, p.qty);
      })
      .join(" + ");
    var cost = round2(
      parts.reduce(function (sum, p) {
        return sum + p.qty * p.product.price;
      }, 0),
    );
    var name = line && line.product && (!changed || parts.length > 1) ? String(line.product.name) : String(parts[0].product.name);
    return { name: name, buy: buy, cost: cost, store: store, note: note, for: forText };
  }

  function mergeSentOrderRows(rows, haveFreeRows, sent, colesSent, colesId) {
    var out = Array.isArray(rows) ? rows.slice() : [];
    var seen = Object.create(null);
    out.forEach(function (r) {
      if (r && r.id) seen[r.id] = true;
    });
    (Array.isArray(haveFreeRows) ? haveFreeRows : []).forEach(function (r) {
      if (!r || !r.id || seen[r.id]) return;
      if (!rowHasSentLine(r, sent, colesSent, colesId)) return;
      seen[r.id] = true;
      out.push(r);
    });
    return out;
  }

  function isDate(d) {
    return typeof d === "string" && DATE.test(d);
  }

  function validMeal(m) {
    return !!m && typeof m.name === "string" && isQty(m.serves);
  }

  function amount(product, qty) {
    if (product.perKg) return Math.round(qty * 1000) + "g";
    if (product.sizeLabel && String(product.sizeLabel).length) return qty + " × " + product.sizeLabel;
    return qty + (qty === 1 ? " pack" : " packs");
  }

  /* `line` is the shop's own line for this product, used when the sent amount matches it. */
  function orderedItem(line, product, qty, note, forText, store) {
    var same = !!line && Math.abs(qty - line.quantity) < 1e-9;
    return {
      name: String(product.name),
      buy: same ? line.buy : amount(product, qty),
      cost: same ? line.cost : typeof product.price === "number" ? round2(qty * product.price) : null,
      store: store || "woolies",
      note: note,
      for: forText,
    };
  }

  function snapshot(rows, ticks, sentLines, opts) {
    var o = opts || {};
    var at = typeof o.at === "string" && !isNaN(Date.parse(o.at)) ? o.at : new Date().toISOString();
    var sent = sentLines || {};
    var colesSent = o.colesSent && typeof o.colesSent === "object" ? o.colesSent : {};
    var colesId = typeof o.colesId === "function" ? o.colesId : function () { return null; };
    var usedColes = {};
    var colesOrdered = {};
    var t = ticks || {};
    var store = o.store === "coles" ? "coles" : "woolies";
    var other = store === "coles" ? "woolies" : "coles";
    var forText = typeof o.forText === "function" ? o.forText : function () { return ""; };
    var groups = { ordered: [], had: [], pantry: [], buy: [] };
    var used = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var f = String(forText(row) || "");
      var w = row.woolies;
      var gone = row.wooliesUnavailable;
      var c = row.coles;
      var cGone = row.colesUnavailable;
      if (c && c.parts && c.parts.length) {
        c.parts.forEach(function (p) {
          var markId = colesId(p.product);
          if (markId) usedColes[markId] = true;
        });
      } else if (c && c.product) {
        var markColes = colesId(c.product);
        if (markColes) usedColes[markColes] = true;
      }
      var wParts = wooliesSentParts(w, null, sent);
      if (wParts.length) {
        wParts.forEach(function (p) {
          used[p.product.stockcode] = true;
        });
        if (!w && gone && wParts.length === 1 && wParts[0].product === gone) {
          groups.ordered.push(orderedItem(null, gone, wParts[0].qty, "was unavailable online", f));
        } else {
          groups.ordered.push(orderedFromSentParts(w, wParts, "woolies", f, colesId));
        }
        return;
      }
      if (gone && isQty(sent[gone.stockcode])) {
        used[gone.stockcode] = true;
        groups.ordered.push(orderedItem(null, gone, sent[gone.stockcode], "was unavailable online", f));
        return;
      }
      var cParts = colesSentParts(c, null, colesSent, colesId);
      if (cParts.length) {
        var skipColes = false;
        for (var ci = 0; ci < cParts.length; ci++) {
          var cid = colesId(cParts[ci].product);
          if (cid && colesOrdered[cid]) {
            skipColes = true;
            break;
          }
        }
        if (skipColes) return;
        cParts.forEach(function (p) {
          var id = colesId(p.product);
          if (id) {
            colesOrdered[id] = true;
            usedColes[id] = true;
          }
        });
        if (!c && cGone && cParts.length === 1 && cParts[0].product === cGone) {
          groups.ordered.push(orderedItem(null, cGone, cParts[0].qty, "was unavailable online", f, "coles"));
        } else {
          groups.ordered.push(orderedFromSentParts(c, cParts, "coles", f, colesId));
        }
        return;
      }
      var cGoneId = cGone ? colesId(cGone) : null;
      if (cGoneId && isQty(colesSent[cGoneId])) {
        if (colesOrdered[cGoneId]) return;
        colesOrdered[cGoneId] = true;
        usedColes[cGoneId] = true;
        groups.ordered.push(orderedItem(null, cGone, colesSent[cGoneId], "was unavailable online", f, "coles"));
        return;
      }
      var where = row[store] ? store : row[other] ? other : null;
      var line = where ? row[where] : null;
      var it = { name: line ? line.product.name : String(row.name), buy: line ? line.buy : "", cost: line ? line.cost : null, store: where, note: null, for: f };
      if (t[row.id]) groups.had.push(it);
      else if (row.sec === 2) groups.pantry.push(it);
      else {
        if (!where) it.note = "no online store";
        else if (gone && store === "woolies") it.note = "unavailable online at Woolworths";
        else if (row.colesUnavailable && store === "coles") it.note = "unavailable online at Coles";
        groups.buy.push(it);
      }
    });
    (Array.isArray(o.covered) ? o.covered : []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var f = String(forText(row) || "");
      groups.had.push({
        name: String(row.name),
        buy: "",
        cost: null,
        store: null,
        note: "covered by what you have",
        for: f,
      });
    });
    Object.keys(sent).forEach(function (code) {
      if (used[code] || !isQty(sent[code])) return;
      var p = typeof o.product === "function" ? o.product(Number(code)) : null;
      if (!p || typeof p.name !== "string" || !p.name) p = null;
      groups.ordered.push(
        p ? orderedItem(null, p, sent[code], "not in this shop", "") : { name: "Product " + code, buy: String(sent[code]), cost: null, store: "woolies", note: "not in this shop", for: "" },
      );
    });
    Object.keys(colesSent).forEach(function (id) {
      if (usedColes[id] || !isQty(colesSent[id])) return;
      var p = typeof o.colesProduct === "function" ? o.colesProduct(id) : null;
      if (!p || typeof p.name !== "string" || !p.name) p = null;
      groups.ordered.push(
        p ? orderedItem(null, p, colesSent[id], "not in this shop", "", "coles") : { name: "Product " + id, buy: String(colesSent[id]), cost: null, store: "coles", note: "not in this shop", for: "" },
      );
    });
    return {
      v: 1,
      id: at,
      at: at,
      store: store,
      days: (Array.isArray(o.days) ? o.days : []).filter(isDate),
      meals: (Array.isArray(o.meals) ? o.meals : []).filter(validMeal).map(function (m) { return { name: m.name, serves: m.serves }; }),
      delivery: typeof o.delivery === "string" && o.delivery ? o.delivery : null,
      wooliesTotal: typeof o.wooliesTotal === "number" && isFinite(o.wooliesTotal) ? o.wooliesTotal : null,
      groups: groups,
    };
  }

  function isEmpty(rows, sentLines, colesSent) {
    var real = Array.isArray(rows) && rows.some(function (r) { return !!r && r.sec !== 0; });
    var any = function (s) {
      return Object.keys(s || {}).some(function (k) { return isQty(s[k]); });
    };
    return !real && !any(sentLines) && !any(colesSent);
  }

  function groupTitle(order, key) {
    if (key === "ordered") return order && order.store === "coles" ? "Ordered on Coles" : "Ordered on Woolworths";
    return GROUP_TITLES[key];
  }

  function validItem(i) {
    return (
      !!i && typeof i === "object" &&
      typeof i.name === "string" && typeof i.buy === "string" &&
      (i.cost === null || (typeof i.cost === "number" && isFinite(i.cost))) &&
      (i.store === null || i.store === "woolies" || i.store === "coles") &&
      (i.note === null || typeof i.note === "string") &&
      typeof i.for === "string"
    );
  }

  function validOrder(o) {
    return (
      !!o && typeof o === "object" && o.v === 1 &&
      typeof o.id === "string" && typeof o.at === "string" && !isNaN(Date.parse(o.at)) &&
      (o.store === "woolies" || o.store === "coles") &&
      Array.isArray(o.days) && o.days.every(isDate) &&
      Array.isArray(o.meals) && o.meals.every(validMeal) &&
      (o.delivery === null || typeof o.delivery === "string") &&
      (o.wooliesTotal === null || (typeof o.wooliesTotal === "number" && isFinite(o.wooliesTotal))) &&
      !!o.groups && typeof o.groups === "object" &&
      GROUPS.every(function (k) { return Array.isArray(o.groups[k]) && o.groups[k].every(validItem); })
    );
  }

  function parseOrders(json) {
    var list;
    try {
      list = JSON.parse(json);
    } catch (e) {
      return [];
    }
    if (!Array.isArray(list)) return [];
    var seen = {};
    return list
      .filter(function (o) {
        if (!validOrder(o) || seen[o.id]) return false;
        return (seen[o.id] = true);
      })
      .slice(0, KEEP);
  }

  function addOrder(list, order) {
    var rest = (Array.isArray(list) ? list : []).filter(function (o) { return o.id !== order.id; });
    return [order].concat(rest).slice(0, KEEP);
  }

  function removeOrder(list, id) {
    return (Array.isArray(list) ? list : []).filter(function (o) { return o.id !== id; });
  }

  function summaryLine(order) {
    var d = new Date(order.at);
    var items = order.groups.ordered;
    var covered = (order.groups.had || []).filter(function (i) {
      return i && i.note === "covered by what you have";
    });
    var parts = [DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]];
    if (!items.length) {
      if (covered.length) return parts.concat(covered.length + " covered").join(" · ");
      return parts.concat("nothing ordered").join(" · ");
    }
    parts.push(items.length + " ordered");
    if (order.wooliesTotal !== null) parts.push(money(order.wooliesTotal));
    else parts.push("about " + money(round2(items.reduce(function (a, i) { return a + (i.cost || 0); }, 0))));
    return parts.join(" · ");
  }

  var api = {
    GROUPS: GROUPS,
    GROUP_TITLES: GROUP_TITLES,
    KEEP: KEEP,
    snapshot: snapshot,
    sentLineQty: sentLineQty,
    rowHasSentLine: rowHasSentLine,
    mergeSentOrderRows: mergeSentOrderRows,
    isEmpty: isEmpty,
    parseOrders: parseOrders,
    addOrder: addOrder,
    removeOrder: removeOrder,
    summaryLine: summaryLine,
    groupTitle: groupTitle,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelOrders = api;
})(this);
