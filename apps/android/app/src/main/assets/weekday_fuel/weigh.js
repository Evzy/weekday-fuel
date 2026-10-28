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

  /* Kitchen stock still in mL: small leftovers, or round bottle sizes before conversion. */
  function looksLikeMlStock(amount, sample) {
    if (!(amount > 0) || !isFinite(amount) || !sample) return false;
    if (amount > 2000) return false;
    var sg = sample.g > 0 ? sample.g : 1;
    if (amount < sg) return true;
    if (amount % 50 === 0) return true;
    if (amount % 10 === 0 && amount < 1000) return true;
    return false;
  }

  function convertStockMlToG(events, id, sample) {
    var parsed = parseSample(sample && sample.ml, sample && sample.g);
    if (!parsed || !id || !Array.isArray(events)) return events;
    var ratio = parsed.g / parsed.ml;
    var changed = false;
    var out = events.map(function (e) {
      if (!e || e.item !== id || !looksLikeMlStock(e.amount, parsed)) return e;
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

  var api = {
    parseSample: parseSample,
    gramsForMl: gramsForMl,
    mlForGrams: mlForGrams,
    has: has,
    displayAmount: displayAmount,
    apply: apply,
    clear: clear,
    convertStockMlToG: convertStockMlToG,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelWeigh = api;
})(this);
