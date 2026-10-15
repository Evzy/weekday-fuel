/* Injected into woolworths.com.au by WoolworthsSession. Boosts every Everyday Rewards offer, reads delivery times and the order summary, and books a time, with the site's own requests. */
(function () {
  "use strict";
  if (window.__weekdayFuelCheckout) return;

  var URLS = {
    bootstrap: "/api/ui/v2/bootstrap",
    crnHash: "/api/v3/ui/shopper/rewards/crn/hash",
    offers: "https://prod.api-wr.com/wx-rtl-offer-v2/offers?filter[status]=ACTIVE",
    boost: "/api/v3/ui/rewards/offers/boost/",
    windows: "/api/v3/ui/fulfilment/windows",
    book: "/apis/ui/Fulfilment",
    summary: "/apis/ui/Checkout",
  };
  /* The site's own public client id for the offers service. */
  var CLIENT_ID = "IRfFJjr4Px9UY1XxKtSOAUYGTpelx0S0Q";
  var state = { phase: "idle", result: null, error: null };

  function message(e) {
    return String((e && e.message) || e);
  }

  async function getJson(url) {
    var r = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function section(read) {
    try {
      return await read();
    } catch (e) {
      return { error: message(e) };
    }
  }

  async function bootstrap() {
    var r = await fetch(URLS.bootstrap, { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("login check HTTP " + r.status);
    return r.json();
  }

  function delivery(boot) {
    var d = boot.GetDeliveryInfoRequest || {};
    var a = d.Address || {};
    var t = d.ReservedTime;
    return {
      method: d.DeliveryMethod || null,
      address: { addressId: a.AddressId, areaId: a.AreaId, suburbId: a.SuburbId },
      booked: t && t.Id ? { id: t.Id, start: t.StartDateTime, end: t.EndDateTime, label: t.TimeWindow, cutOff: t.CutOffDateTime || null } : null,
      minimumSpend: typeof d.MinimumSpend === "number" ? d.MinimumSpend : null,
    };
  }

  function trolleyCodes(boot) {
    var items = boot.TrolleyRequest && boot.TrolleyRequest.AvailableItems;
    return (Array.isArray(items) ? items : [])
      .map(function (i) { return i && i.Stockcode; })
      .filter(function (c) { return typeof c === "number"; });
  }

  function offer(o) {
    var a = o.attributes || {};
    var d = a.display || {};
    var c = (a.coupons || [])[0] || {};
    var red = (c.attributes && c.attributes.redemption) || {};
    return {
      id: o.id,
      couponId: c.id || null,
      heading: d.heading || "",
      description: (d.description && d.description.summary) || "",
      productId: Number.isFinite(Number(d.primaryProductId)) && Number(d.primaryProductId) > 0 ? Number(d.primaryProductId) : null,
      minimumSpend: typeof red.minimumSpend === "number" && red.minimumSpend > 0 ? red.minimumSpend / 100 : null,
      ends: red.endDateTime || null,
      outcome: a.boostState === "BOOSTED" ? "already" : null,
      reason: null,
    };
  }

  async function boost(o) {
    if (!o.couponId) {
      o.outcome = "failed";
      o.reason = "no coupon";
      return;
    }
    try {
      var r = await fetch(URLS.boost + encodeURIComponent(o.couponId), {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json, text/plain, */*", "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) {
        o.outcome = "failed";
        o.reason = "HTTP " + r.status;
      } else {
        o.outcome = "boosted";
      }
    } catch (e) {
      o.outcome = "failed";
      o.reason = message(e);
    }
  }

  async function readOffers(hash) {
    var r = await fetch(URLS.offers, {
      headers: {
        "customer-identity": hash,
        client_id: CLIENT_ID,
        "customer-timezone": "Australia/Sydney",
        channel: "WOW_WEB",
        "Content-Type": "application/json",
      },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    var list = await r.json();
    if (!list || !Array.isArray(list.data)) throw new Error("offers response has no list");
    return list.data;
  }

  async function boostAll() {
    var hash = await getJson(URLS.crnHash);
    if (typeof hash !== "string" || !hash) throw new Error("no rewards card");
    var offers = (await readOffers(hash)).filter(Boolean).map(offer);
    var tried = false;
    for (var i = 0; i < offers.length; i++) {
      if (offers[i].outcome) continue;
      await boost(offers[i]);
      tried = true;
    }
    if (tried) {
      try {
        var after = {};
        (await readOffers(hash)).filter(Boolean).forEach(function (o) {
          after[o.id] = o.attributes && o.attributes.boostState;
        });
        offers.forEach(function (o) {
          if (o.outcome === "already" || !(o.id in after)) return;
          if (after[o.id] === "BOOSTED") {
            o.outcome = "boosted";
            o.reason = null;
          } else if (o.outcome === "boosted") {
            o.outcome = "failed";
            o.reason = "still not boosted";
          }
        });
      } catch (e) {
        /* Without a second read the boost replies stand. */
      }
    }
    return { offers: offers };
  }

  async function windows(dlv) {
    if (!dlv.address.addressId || !dlv.address.areaId || !dlv.address.suburbId) throw new Error("no delivery address");
    var a = dlv.address;
    var w = await getJson(URLS.windows + "?areaId=" + a.areaId + "&fulfilmentMethod=Courier&addressId=" + a.addressId + "&suburbId=" + a.suburbId);
    if (!w || !Array.isArray(w.Days)) throw new Error("windows response has no days");
    return {
      days: w.Days.map(function (d) {
        return {
          date: String(d.Date).slice(0, 10),
          available: d.Available === true,
          closedText: d.ClosedText || "",
          slots: (d.Times || []).map(function (t) {
            return {
              id: t.Id,
              label: t.TimeWindow,
              start: t.StartDateTime,
              end: t.EndDateTime,
              price: typeof t.SalePrice === "number" ? t.SalePrice : t.Price,
              available: t.Available === true,
              eco: t.IsEcoWindow === true,
              express: t.IsExpress === true,
              cutOff: t.CutOffDateTime || null,
            };
          }),
        };
      }),
    };
  }

  async function summary() {
    var c = await getJson(URLS.summary);
    var m = c && c.Model;
    var o = m && m.Order;
    if (!o) throw new Error("summary response has no order");
    var names = function (list) {
      return (list || []).map(function (p) { return p.Name || p.Description || String(p.Stockcode); });
    };
    return {
      subtotal: o.Subtotal,
      savings: o.Savings,
      deliveryFee: o.DeliveryFee,
      deliveryFeeBefore: o.DeliveryFeeBeforeDiscount,
      bagFee: o.PackagingFee,
      bagLabel: o.PackagingFeeLabel || null,
      total: o.TotalIncludingGst,
      toPay: o.BalanceToPay,
      points: o.TotalRewardsPointsEarned,
      warning: typeof m.CheckoutSubtotalErrors === "string" ? m.CheckoutSubtotalErrors : "",
      unavailable: names(o.UnavailableProducts),
      restricted: names(o.RestrictedProducts),
    };
  }

  async function book(dlv, req) {
    if (dlv.method !== "Courier" || !dlv.address.addressId) return "not a delivery order";
    try {
      var r = await fetch(URLS.book, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: dlv.address.addressId,
          fulfilmentMethod: "Courier",
          timeslotId: req.timeslotId,
          tradingAccount: null,
          windowDate: req.windowDate,
        }),
      });
      if (!r.ok) return "HTTP " + r.status;
      var j = await r.json();
      return j && j.IsSuccessful === true ? null : (j && j.Message) || "not booked";
    } catch (e) {
      return message(e);
    }
  }

  async function run(req) {
    state = { phase: "running", result: null, error: null };
    try {
      var boot = await bootstrap();
      if (!boot || !boot.ShopperRequest || boot.ShopperRequest.IsGuest !== false) {
        state = { phase: "done", result: { action: req.action, loggedOut: true }, error: null };
        return;
      }
      var dlv = delivery(boot);
      var result = { action: req.action, loggedOut: false };
      if (req.action === "book") {
        result.bookError = await book(dlv, req);
        if (!result.bookError) {
          try {
            boot = await bootstrap();
            dlv = delivery(boot);
          } catch (e) {
            /* The booking went through; the earlier booked time is shown until the next load. */
          }
        }
      } else {
        result.boosts = await section(boostAll);
        result.windows = dlv.method === "Courier" ? await section(function () { return windows(dlv); }) : null;
      }
      result.method = dlv.method;
      result.booked = dlv.booked;
      result.minimumSpend = dlv.minimumSpend;
      result.trolley = trolleyCodes(boot);
      result.summary = await section(summary);
      state = { phase: "done", result: result, error: null };
    } catch (e) {
      state = { phase: "error", result: null, error: message(e) };
    }
  }

  window.__weekdayFuelCheckout = {
    start: function (req) {
      if (state.phase === "running") return false;
      if (!req || (req.action !== "load" && req.action !== "book")) return false;
      if (req.action === "book" && !(Number.isFinite(req.timeslotId) && req.timeslotId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(req.windowDate)))) return false;
      run(req);
      return true;
    },
    state: function () { return JSON.stringify(state); },
    urls: URLS,
  };
})();
