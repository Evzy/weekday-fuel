/* Shapes the checkout script's result for the Checkout panel. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function money(n) {
    return typeof n === "number" && isFinite(n) ? "$" + n.toFixed(2) : "–";
  }

  function dollars(n) {
    if (typeof n !== "number" || !isFinite(n)) return "–";
    return "$" + (n % 1 ? n.toFixed(2) : String(n));
  }

  /* Woolworths times are store-local; only the written date and clock are used, never the device time zone. */
  function dayLabel(iso) {
    if (typeof iso !== "string" || iso.length < 10) return "";
    var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
    return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  }

  function timeLabel(iso) {
    if (typeof iso !== "string" || iso.length < 16) return "";
    var h = +iso.slice(11, 13);
    var m = iso.slice(14, 16);
    return (h % 12 || 12) + (m === "00" ? "" : ":" + m) + (h < 12 ? "am" : "pm");
  }

  function bookedLabel(b) {
    return {
      when: dayLabel(b.start) + ", " + (b.label || timeLabel(b.start) + " - " + timeLabel(b.end)),
      cutOff: b.cutOff ? "Change by " + dayLabel(b.cutOff) + " " + timeLabel(b.cutOff) : null,
    };
  }

  function boostSummary(boosts, trolley) {
    var codes = {};
    (trolley || []).forEach(function (c) {
      codes[c] = true;
    });
    var rows = ((boosts && boosts.offers) || []).map(function (o, i) {
      return {
        heading: o.heading,
        description: o.description,
        minSpend: o.minimumSpend ? dollars(o.minimumSpend) : null,
        inTrolley: o.productId != null && codes[o.productId] === true,
        outcome: o.outcome,
        reason: o.reason || null,
        order: i,
      };
    });
    rows.sort(function (a, b) {
      return (a.inTrolley ? 0 : 1) - (b.inTrolley ? 0 : 1) || a.order - b.order;
    });
    function count(outcome) {
      return rows.filter(function (r) { return r.outcome === outcome; }).length;
    }
    return {
      boosted: count("boosted"),
      already: count("already"),
      rows: rows.filter(function (r) { return r.outcome !== "failed"; }),
      failed: rows.filter(function (r) { return r.outcome === "failed"; }),
    };
  }

  function dayTabs(windows) {
    return ((windows && windows.days) || []).map(function (d) {
      var open = d.available ? (d.slots || []).filter(function (s) { return s && s.available; }) : [];
      var priced = open.filter(function (s) { return Number.isFinite(s.price); });
      var prices = priced.map(function (s) { return s.price; });
      var min = prices.length ? Math.min.apply(null, prices) : null;
      var max = prices.length ? Math.max.apply(null, prices) : null;
      var cheapest = priced.filter(function (s) { return s.price === min; })[0];
      return {
        date: d.date,
        open: open.length > 0,
        priceRange: min == null ? null : min === max ? dollars(min) : dollars(min) + " - " + dollars(max),
        cheapestId: cheapest ? cheapest.id : null,
        closedText: d.closedText || "",
        slots: d.slots || [],
      };
    });
  }

  function summaryLines(s) {
    if (!s || s.error) return [];
    var lines = [
      { label: "Subtotal", value: money(s.subtotal), note: s.savings > 0 ? "you've saved " + money(s.savings) : null, strong: false },
      { label: "Delivery fee", value: money(s.deliveryFee), note: s.deliveryFeeBefore > s.deliveryFee ? "was " + money(s.deliveryFeeBefore) : null, strong: false },
    ];
    if (s.bagFee > 0) lines.push({ label: s.bagLabel || "Bag fee", value: money(s.bagFee), note: null, strong: false });
    lines.push({ label: "Total", value: money(s.total), note: null, strong: true });
    return lines;
  }

  function subsView(items, draft) {
    var d = draft || {};
    var rows = (items || []).map(function (i) {
      var shown = !i.fixed && Object.prototype.hasOwnProperty.call(d, i.stockcode) ? d[i.stockcode] === true : i.allow;
      return { stockcode: i.stockcode, name: i.name, allow: shown, fixed: i.fixed, changed: shown !== i.allow };
    });
    var open = rows.filter(function (r) { return !r.fixed; });
    return {
      rows: rows,
      allowed: open.filter(function (r) { return r.allow; }).length,
      choosable: open.length,
      changes: open.filter(function (r) { return r.changed; }).map(function (r) { return { stockcode: r.stockcode, allow: r.allow }; }),
    };
  }

  function allDraft(items, allow) {
    var d = {};
    (items || []).forEach(function (i) {
      if (!i.fixed && i.allow !== allow) d[i.stockcode] = allow;
    });
    return d;
  }

  function addressRows(addresses) {
    if (!addresses || !Array.isArray(addresses.list)) return [];
    return addresses.list.map(function (a) {
      return { id: a.id, text: a.text || "Address " + a.id, current: a.id === addresses.current, primary: a.primary === true };
    });
  }

  var api = {
    money: money,
    dollars: dollars,
    dayLabel: dayLabel,
    timeLabel: timeLabel,
    bookedLabel: bookedLabel,
    boostSummary: boostSummary,
    dayTabs: dayTabs,
    summaryLines: summaryLines,
    subsView: subsView,
    allDraft: allDraft,
    addressRows: addressRows,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCheckoutView = api;
})(this);
