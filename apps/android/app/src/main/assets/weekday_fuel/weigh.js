/* Per-item mL↔g conversion from a weighed sample. Pure: no DOM or storage. */
(function (root) {
  "use strict";

  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  function parseSample(ml, g) {
    var m = +ml;
    var gr = +g;
    if (!isFinite(m) || !isFinite(gr) || !(m > 0) || !(gr > 0)) return null;
    return { ml: m, g: gr };
  }

  function gramsForMl(sample, ml) {
    return round1((+ml * sample.g) / sample.ml);
  }

  function mlForGrams(sample, g) {
    return round1((+g * sample.ml) / sample.g);
  }

  function has(weighG, id) {
    if (!weighG || !id) return false;
    return parseSample(weighG[id] && weighG[id].ml, weighG[id] && weighG[id].g) !== null;
  }

  function sampleFor(weighG, id) {
    if (!has(weighG, id)) return null;
    return parseSample(weighG[id].ml, weighG[id].g);
  }

  function displayAmount(item, amount, weighG) {
    var unit = (item && item.unit) || "";
    var id = item && item.id;
    var sample = unit === "mL" && id ? sampleFor(weighG, id) : null;
    if (!sample) return { amount: amount, unit: unit };
    return { amount: gramsForMl(sample, amount), unit: "g", origMl: amount };
  }

  function cloneWeighG(weighG) {
    var src = weighG || {};
    var out = {};
    Object.keys(src).forEach(function (k) {
      out[k] = { ml: src[k].ml, g: src[k].g };
    });
    return out;
  }

  function apply(weighG, id, sample) {
    var parsed = parseSample(sample && sample.ml, sample && sample.g);
    if (!parsed || !id) return weighG || {};
    var next = cloneWeighG(weighG);
    next[id] = parsed;
    return next;
  }

  function clear(weighG, id) {
    var next = cloneWeighG(weighG);
    delete next[id];
    return next;
  }

  function convertStockMlToG(events, id, sample) {
    var parsed = parseSample(sample && sample.ml, sample && sample.g);
    if (!parsed || !id || !Array.isArray(events)) return events;
    var ratio = parsed.g / parsed.ml;
    var changed = false;
    var out = events.map(function (e) {
      if (!e || e.item !== id) return e;
      if (e.k !== "buy" && e.k !== "add" && e.k !== "set") return e;
      if (!(e.amount > 0) || !isFinite(e.amount)) return e;
      changed = true;
      var copy = {};
      Object.keys(e).forEach(function (k) {
        copy[k] = e[k];
      });
      copy.amount = round1(+e.amount * ratio);
      return copy;
    });
    return changed ? out : events;
  }

  function nearInt(x) {
    var r = Math.round(+x);
    return Math.abs(+x - r) < 0.05;
  }

  /** True when stock ledger amounts for id already look like weighed grams on disk. */
  function stockEventsInGramsOnDisk(events, id, sample) {
    var parsed = parseSample(sample && sample.ml, sample && sample.g);
    if (!parsed || !id || !Array.isArray(events)) return false;
    var saw = false;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (!e || e.item !== id) continue;
      if (e.k !== "buy" && e.k !== "add" && e.k !== "set") continue;
      if (!(e.amount > 0) || !isFinite(e.amount)) continue;
      saw = true;
      var impliedMl = mlForGrams(parsed, e.amount);
      if (!nearInt(impliedMl)) return false;
      var ml = Math.round(impliedMl);
      if (Math.abs(gramsForMl(parsed, ml) - +e.amount) > 0.05) return false;
    }
    return saw;
  }

  function convertBuyMlToStock(item, mlAmount, weighOpt) {
    if (!item || item.unit !== "mL" || !(mlAmount > 0)) return mlAmount;
    if (!weighOpt || typeof weighOpt.isStockInGrams !== "function") return mlAmount;
    if (!weighOpt.isStockInGrams(item.id)) return mlAmount;
    if (typeof weighOpt.mlToGrams !== "function") return mlAmount;
    return weighOpt.mlToGrams(item.id, mlAmount);
  }

  var api = {
    parseSample: parseSample,
    gramsForMl: gramsForMl,
    mlForGrams: mlForGrams,
    has: has,
    sampleFor: sampleFor,
    displayAmount: displayAmount,
    apply: apply,
    clear: clear,
    convertStockMlToG: convertStockMlToG,
    stockEventsInGramsOnDisk: stockEventsInGramsOnDisk,
    convertBuyMlToStock: convertBuyMlToStock,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelWeigh = api;
})(this);
