/* Turns Build a shop rows into Woolworths and Coles trolley lines. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  function wooliesPartLines(row, line) {
    var out = [];
    if (line.parts && line.parts.length) {
      line.parts.forEach(function (part) {
        var p = part.product;
        var quantity = Math.round(part.quantity * 1000) / 1000;
        out.push({
          itemId: row.id,
          stockcode: p.stockcode,
          quantity: quantity,
          name: p.perKg ? p.name + " (" + Math.round(quantity * 1000) + "g)" : p.name,
          url: p.url,
        });
      });
      return out;
    }
    var p = line.product;
    var quantity = Math.round(line.quantity * 1000) / 1000;
    out.push({
      itemId: row.id,
      stockcode: p.stockcode,
      quantity: quantity,
      name: p.perKg ? p.name + " (" + Math.round(quantity * 1000) + "g)" : p.name,
      url: p.url,
    });
    return out;
  }

  function mergeWooliesLines(lines, add) {
    add.forEach(function (l) {
      var found = null;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].stockcode === l.stockcode) {
          found = lines[i];
          break;
        }
      }
      if (found) found.quantity = Math.round((found.quantity + l.quantity) * 1000) / 1000;
      else lines.push(l);
    });
  }

  function cartLines(rows, ticks, haveIt) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id] || (haveIt && haveIt[row.id])) return;
      var line = row.woolies;
      if (!line) {
        if (row.wooliesUnavailable) manual.push({ itemId: row.id, name: row.wooliesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.coles ? row.coles.product.name : row.name, reason: row.coles ? "coles" : "nostore" });
        return;
      }
      mergeWooliesLines(lines, wooliesPartLines(row, line));
    });
    return { lines: lines, manual: manual };
  }

  function markWooliesKeep(keep, row) {
    var line = row.woolies;
    if (line && line.parts && line.parts.length) {
      line.parts.forEach(function (part) {
        keep[part.product.stockcode] = true;
      });
    } else if (line && line.product) keep[line.product.stockcode] = true;
    if (row.wooliesUnavailable) keep[row.wooliesUnavailable.stockcode] = true;
  }

  function removalLines(lastLines, rows) {
    var keep = {};
    rows.forEach(function (row) {
      markWooliesKeep(keep, row);
    });
    return Object.keys(lastLines || {})
      .filter(function (code) {
        return !keep[code];
      })
      .map(function (code) {
        return { stockcode: Number(code), quantity: 0 };
      });
  }

  function shopFingerprint(picks, dayMeals, fixtureDays) {
    var p = Object.keys(picks || {})
      .filter(function (meal) {
        return picks[meal] > 0;
      })
      .sort()
      .map(function (meal) {
        return meal + "x" + picks[meal];
      });
    var d = (dayMeals || [])
      .map(function (dm) {
        return dm.day + ":" + dm.meal + (dm.t === "L" || dm.t === "X" ? ":" + dm.t : "");
      })
      .sort();
    var extra;
    if (typeof fixtureDays === "number") extra = { fixtureDays: fixtureDays || 0 };
    else if (fixtureDays && typeof fixtureDays === "object" && !Array.isArray(fixtureDays)) {
      var keys = Object.keys(fixtureDays)
        .filter(function (k) {
          return k !== "__proto__";
        })
        .sort();
      extra = { staples: keys.map(function (k) {
        return [k, fixtureDays[k]];
      }) };
    } else extra = { staples: [] };
    return JSON.stringify(Object.assign({ picks: p, days: d }, extra));
  }

  var COLES_MAX_QTY = 99;

  function colesManualLimit(row, part, remainder) {
    return { itemId: row.id, name: part.product.name + " (add " + remainder + " yourself)", reason: "limit" };
  }

  function colesAddQty(byId, lines, manual, row, part, pid, addQty) {
    if (byId[pid]) {
      var room = COLES_MAX_QTY - byId[pid].quantity;
      if (room <= 0) {
        if (addQty > 0) manual.push(colesManualLimit(row, part, addQty));
        return;
      }
      var take = Math.min(addQty, room);
      byId[pid].quantity += take;
      var rem = addQty - take;
      if (rem > 0) manual.push(colesManualLimit(row, part, rem));
      return;
    }
    if (addQty > COLES_MAX_QTY) {
      byId[pid] = { itemId: row.id, productId: pid, quantity: COLES_MAX_QTY, name: part.product.name, url: part.product.url };
      lines.push(byId[pid]);
      manual.push(colesManualLimit(row, part, addQty - COLES_MAX_QTY));
      return;
    }
    byId[pid] = { itemId: row.id, productId: pid, quantity: addQty, name: part.product.name, url: part.product.url };
    lines.push(byId[pid]);
  }

  /* Coles trolley lines, keyed by Coles product ID (idOf = catalogue colesId). Rows that share a product are merged. */
  function colesCartLines(rows, ticks, haveIt, idOf) {
    var lines = [];
    var byId = {};
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id] || (haveIt && haveIt[row.id])) return;
      var line = row.coles;
      if (!line) {
        if (row.colesUnavailable) manual.push({ itemId: row.id, name: row.colesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.woolies ? row.woolies.product.name : row.name, reason: row.woolies ? "woolies" : "nostore" });
        return;
      }
      var parts = line.parts && line.parts.length ? line.parts : [{ product: line.product, quantity: line.quantity }];
      var added = false;
      parts.forEach(function (part) {
        var pid = idOf(part.product);
        if (!pid) return;
        added = true;
        colesAddQty(byId, lines, manual, row, part, pid, part.quantity);
      });
      if (!added) {
        if (row.colesUnavailable) manual.push({ itemId: row.id, name: row.colesUnavailable.name, reason: "unavailable" });
        else manual.push({ itemId: row.id, name: row.woolies ? row.woolies.product.name : row.name, reason: row.woolies ? "woolies" : "nostore" });
      }
    });
    return { lines: lines, manual: manual };
  }

  function markColesKeep(keep, row, idOf) {
    var line = row.coles;
    if (line && line.parts && line.parts.length) {
      line.parts.forEach(function (part) {
        var id = idOf(part.product);
        if (id) keep[id] = true;
      });
    } else if (line && line.product) {
      var a = idOf(line.product);
      if (a) keep[a] = true;
    }
    var b = row.colesUnavailable && idOf(row.colesUnavailable);
    if (b) keep[b] = true;
  }

  function colesRemovalLines(lastLines, rows, idOf) {
    var keep = {};
    rows.forEach(function (row) {
      markColesKeep(keep, row, idOf);
    });
    return Object.keys(lastLines || {})
      .filter(function (id) {
        return !keep[id];
      })
      .map(function (id) {
        return { productId: id, quantity: 0 };
      });
  }

  function emptyLines(sentLines, store) {
    var lines = sentLines && typeof sentLines === "object" ? sentLines : {};
    return Object.keys(lines)
      .filter(function (code) {
        var q = lines[code];
        return typeof q === "number" && isFinite(q) && q > 0;
      })
      .map(function (code) {
        if (store === "coles") return { productId: String(code), quantity: 0 };
        return { stockcode: Number(code), quantity: 0 };
      });
  }

  function planCodes(rows, store, idOf) {
    var seen = {};
    var out = [];
    function addCode(code) {
      var key = store === "coles" ? String(code) : Number(code);
      if (seen[key]) return;
      seen[key] = true;
      out.push(key);
    }
    (rows || []).forEach(function (row) {
      if (store === "woolies") {
        var line = row.woolies;
        if (line && line.parts && line.parts.length) {
          line.parts.forEach(function (part) {
            if (part.product && part.product.stockcode != null) addCode(part.product.stockcode);
          });
        } else if (line && line.product && line.product.stockcode != null) addCode(line.product.stockcode);
        if (row.wooliesUnavailable && row.wooliesUnavailable.stockcode != null) addCode(row.wooliesUnavailable.stockcode);
        return;
      }
      if (store === "coles") {
        var cl = row.coles;
        if (cl && cl.parts && cl.parts.length) {
          cl.parts.forEach(function (part) {
            var id = idOf && idOf(part.product);
            if (id) addCode(id);
          });
        } else if (cl && cl.product) {
          var pid = idOf && idOf(cl.product);
          if (pid) addCode(pid);
        }
        if (row.colesUnavailable && idOf) {
          var uid = idOf(row.colesUnavailable);
          if (uid) addCode(uid);
        }
      }
    });
    return out;
  }

  function planExtraStats(results) {
    var removed = 0;
    var fail = 0;
    (results || []).forEach(function (r) {
      if (!r.extra) return;
      if (r.added) removed++;
      else fail++;
    });
    return { removed: removed, fail: fail };
  }

  function lineResults(results) {
    return (results || []).filter(function (r) {
      return !r.extra;
    });
  }

  function planRemovedPhrase(n) {
    if (!n) return "";
    return n === 1 ? "Removed 1 item that wasn't in your plan" : "Removed " + n + " items that weren't in your plan";
  }

  function planRemoveFailPhrase(n, storeLabel) {
    if (!n) return "";
    var store = storeLabel || "the store";
    return n === 1
      ? "Couldn't remove 1 item not in your plan — remove it on " + store + "."
      : "Couldn't remove " + n + " items not in your plan — remove them on " + store + ".";
  }

  function checkoutCleanNoteFromExtras(results, nameByStockcode) {
    var x = planExtraStats(results);
    var names = [];
    (results || []).forEach(function (r) {
      if (!r.extra || !r.added) return;
      var key = r.stockcode != null ? String(r.stockcode) : r.productId != null ? String(r.productId) : null;
      if (!key) return;
      var nm = nameByStockcode && nameByStockcode[key];
      if (nm) names.push(nm);
    });
    return { removed: x.removed, fail: x.fail, names: names };
  }

  function normalizeSentMap(map) {
    var out = {};
    Object.keys(map || {}).forEach(function (k) {
      var q = map[k];
      if (typeof q === "number" && isFinite(q) && q > 0) out[String(k)] = q;
    });
    return out;
  }

  function sentMapsEqual(a, b) {
    var A = normalizeSentMap(a);
    var B = normalizeSentMap(b);
    var keys = {};
    Object.keys(A).forEach(function (k) {
      keys[k] = true;
    });
    Object.keys(B).forEach(function (k) {
      keys[k] = true;
    });
    var list = Object.keys(keys);
    for (var i = 0; i < list.length; i++) {
      var id = list[i];
      if ((A[id] || 0) !== (B[id] || 0)) return false;
    }
    return true;
  }

  function projectSentLines(sentLines, sendLines, lineKey) {
    var key = lineKey || "stockcode";
    var out = Object.assign({}, sentLines || {});
    (sendLines || []).forEach(function (l) {
      if (!l || l[key] == null) return;
      var id = String(l[key]);
      if (l.quantity === 0) delete out[id];
      else out[id] = l.quantity;
    });
    return out;
  }

  function sentLinesForCompare(sentLines, sendFailed) {
    var out = normalizeSentMap(sentLines);
    Object.keys(sendFailed || {}).forEach(function (k) {
      var q = sendFailed[k];
      if (q === 0) return;
      if (typeof q === "number" && isFinite(q) && q > 0) out[String(k)] = q;
    });
    return out;
  }

  function planCodeSet(planCodes) {
    var set = Object.create(null);
    (planCodes || []).forEach(function (c) {
      set[String(c)] = true;
    });
    return set;
  }

  function pruneSendFailed(failed, planCodes, sentLines) {
    var out = Object.assign({}, failed || {});
    var set = planCodeSet(planCodes);
    var sent = normalizeSentMap(sentLines);
    Object.keys(out).forEach(function (k) {
      if (out[k] === 0) {
        if (sent[k] > 0) return;
        delete out[k];
        return;
      }
      if (!planCodes || !planCodes.length) return;
      if (!set[k]) delete out[k];
    });
    return out;
  }

  function updateSendFailed(prevFailed, lines, results, lineKey, planCodes, sentLines) {
    var key = lineKey || "stockcode";
    var out = Object.assign({}, prevFailed || {});
    (results || []).forEach(function (r) {
      if (r.extra) return;
      var id = r[key] != null ? String(r[key]) : null;
      if (!id) return;
      if (r.added) {
        delete out[id];
        return;
      }
      var line = (lines || []).find(function (l) {
        return l && String(l[key]) === id;
      });
      if (!line) return;
      if (line.quantity === 0) out[id] = 0;
      else if (line.quantity > 0) out[id] = line.quantity;
    });
    return pruneSendFailed(out, planCodes, sentLines);
  }

  function linesDiffer(sentLines, sendLines, store, lineKey, sendFailed) {
    var key = lineKey || (store === "coles" ? "productId" : "stockcode");
    var sf = sendFailed || {};
    var filtered = (sendLines || []).filter(function (l) {
      if (!l || l[key] == null) return false;
      var id = String(l[key]);
      return !(l.quantity === 0 && sf[id] === 0);
    });
    var base = sentLinesForCompare(sentLines, sendFailed);
    var projected = projectSentLines(base, filtered, key);
    return !sentMapsEqual(base, projected);
  }

  function sentAfter(lastLines, lines, results, key) {
    var k = key || "stockcode";
    var out = Object.assign({}, lastLines || {});
    var done = {};
    (results || []).forEach(function (r) {
      if (r.extra) return;
      if (r.added) done[r[k]] = true;
    });
    lines.forEach(function (l) {
      if (!done[l[k]]) return;
      if (l.quantity === 0) delete out[l[k]];
      else out[l[k]] = l.quantity;
    });
    return out;
  }

  var api = {
    cartLines: cartLines,
    removalLines: removalLines,
    colesCartLines: colesCartLines,
    colesRemovalLines: colesRemovalLines,
    shopFingerprint: shopFingerprint,
    sentAfter: sentAfter,
    emptyLines: emptyLines,
    planCodes: planCodes,
    planExtraStats: planExtraStats,
    lineResults: lineResults,
    planRemovedPhrase: planRemovedPhrase,
    planRemoveFailPhrase: planRemoveFailPhrase,
    checkoutCleanNoteFromExtras: checkoutCleanNoteFromExtras,
    normalizeSentMap: normalizeSentMap,
    projectSentLines: projectSentLines,
    linesDiffer: linesDiffer,
    sentLinesForCompare: sentLinesForCompare,
    updateSendFailed: updateSendFailed,
    pruneSendFailed: pruneSendFailed,
    planCodeSet: planCodeSet,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
