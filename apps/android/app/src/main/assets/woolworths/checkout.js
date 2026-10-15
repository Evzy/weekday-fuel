/* Injected into woolworths.com.au by WoolworthsSession. Boosts every Everyday Rewards offer, reads delivery times, options, addresses and the order summary, and books a time, saves substitutions and delivery options, and switches the delivery address, with the site's own requests. */
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
    options: "/apis/ui/Delivery/Options",
    addresses: "/apis/ui/address",
    subs: "/apis/ui/Checkout/substitution",
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

  async function postJson(url, body) {
    var r = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
    var w = await getJson(URLS.windows + "?areaId=" + encodeURIComponent(a.areaId) + "&fulfilmentMethod=Courier&addressId=" + encodeURIComponent(a.addressId) + "&suburbId=" + encodeURIComponent(a.suburbId));
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
      items: (Array.isArray(o.Products) ? o.Products : [])
        .filter(Boolean)
        .map(function (p) {
          var attrs = p.AdditionalAttributes || {};
          return {
            stockcode: p.Stockcode,
            name: [p.DisplayName, p.Name].find(function (n) { return typeof n === "string" && n; }) || String(p.Stockcode),
            allow: p.AllowSubstitution === true,
            fixed: attrs.isexcludedfromsubstitution === "True",
          };
        })
        .filter(function (i) { return typeof i.stockcode === "number"; }),
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

  function deliveryOptions(o) {
    if (!o || typeof o !== "object") throw new Error("options response has no options");
    if (typeof o.DeliveryInstructions !== "string" && o.DeliveryInstructions !== null) throw new Error("options response has no driver note");
    return {
      instructions: o.DeliveryInstructions || "",
      leaveUnattended: o.CanLeaveUnattended === true,
      offerUnattended: o.ShouldShowCanLeaveUnattendedPreference !== false,
    };
  }

  async function readOptions() {
    return deliveryOptions(await getJson(URLS.options));
  }

  async function readAddresses(dlv) {
    var a = await getJson(URLS.addresses);
    if (!a || !Array.isArray(a.Address)) throw new Error("addresses response has no list");
    return {
      current: dlv.address.addressId || null,
      list: a.Address.filter(Boolean)
        .map(function (x) {
          return { id: x.AddressId, text: typeof x.AddressText === "string" ? x.AddressText.replace(/\s+/g, " ").trim() : "", primary: x.IsPrimary === true };
        })
        .filter(function (x) { return typeof x.id === "number" && x.id > 0; }),
    };
  }

  async function saveSubs(req) {
    try {
      var j = await postJson(URLS.subs, {
        Items: req.items.map(function (i) { return { Stockcode: i.stockcode, AllowSubstitution: i.allow }; }),
      });
      return j && j.Success === true ? null : (j && j.ErrorMessage) || "not saved";
    } catch (e) {
      return message(e);
    }
  }

  /* The pick-up note is read first and sent back as it is; without it nothing is sent. */
  async function saveOptions(req) {
    try {
      var current = await getJson(URLS.options);
      if (!current || typeof current !== "object" || (typeof current.PickupInstructions !== "string" && current.PickupInstructions !== null)) {
        return { error: "couldn't read your delivery options", options: null };
      }
      var offer = current.ShouldShowCanLeaveUnattendedPreference !== false;
      var unattended = offer ? req.leaveUnattended : current.CanLeaveUnattended === true;
      var saved = await postJson(URLS.options, {
        CanLeaveUnattended: unattended,
        PickupInstructions: current.PickupInstructions,
        DeliveryInstructions: req.instructions,
      });
      var o = saved && typeof saved === "object" && typeof saved.DeliveryInstructions === "string" ? deliveryOptions(saved) : { instructions: req.instructions, leaveUnattended: unattended };
      o.offerUnattended = offer;
      return { error: null, options: o };
    } catch (e) {
      return { error: message(e), options: null };
    }
  }

  /* `sent` says the switch reached Woolworths, so the delivery details must be re-read whatever the answer. */
  async function switchAddress(req) {
    var sent = false;
    try {
      var a = await getJson(URLS.addresses);
      var known = a && Array.isArray(a.Address) && a.Address.some(function (x) { return x && x.AddressId === req.addressId; });
      if (!known) return { error: "not one of your saved addresses", sent: false };
      sent = true;
      var j = await postJson(URLS.book, { fulfilmentMethod: "Courier", addressId: req.addressId });
      return { error: j && j.IsSuccessful === true ? null : (j && j.Message) || "not switched", sent: true };
    } catch (e) {
      return { error: message(e), sent: sent };
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
      var stale = false;
      var courier = dlv.method === "Courier";
      if (req.action === "load") {
        result.boosts = await section(boostAll);
        result.windows = courier ? await section(function () { return windows(dlv); }) : null;
        result.options = courier ? await section(readOptions) : null;
        result.addresses = courier ? await section(function () { return readAddresses(dlv); }) : null;
      } else if (req.action === "book") {
        result.bookError = await book(dlv, req);
        if (!result.bookError) {
          try {
            var nb = await bootstrap();
            if (nb && nb.ShopperRequest && nb.ShopperRequest.IsGuest === false) {
              var nd = delivery(nb);
              boot = nb;
              dlv = nd;
            }
          } catch (e) {
            /* The booking went through; the earlier booked time is shown until the next load. */
          }
        }
      } else if (!courier) {
        result.saveError = "not a delivery order";
      } else if (req.action === "subs") {
        result.saveError = await saveSubs(req);
      } else if (req.action === "options") {
        var saved = await saveOptions(req);
        result.saveError = saved.error;
        if (saved.options) result.options = saved.options;
      } else {
        var sw = await switchAddress(req);
        result.saveError = sw.error;
        if (sw.sent) {
          var fresh = await section(async function () {
            var b = await bootstrap();
            if (!b || !b.ShopperRequest || b.ShopperRequest.IsGuest !== false) throw new Error("logged out");
            boot = b;
            dlv = delivery(boot);
            return true;
          });
          stale = !!fresh.error;
          result.windows = fresh.error ? fresh : await section(function () { return windows(dlv); });
          result.addresses = fresh.error ? fresh : await section(function () { return readAddresses(dlv); });
          result.options = fresh.error ? fresh : await section(readOptions);
        }
      }
      result.method = dlv.method;
      result.booked = stale ? null : dlv.booked;
      result.minimumSpend = dlv.minimumSpend;
      result.trolley = trolleyCodes(boot);
      result.summary = await section(summary);
      state = { phase: "done", result: result, error: null };
    } catch (e) {
      state = { phase: "error", result: null, error: message(e) };
    }
  }

  function validRequest(req) {
    if (!req) return false;
    switch (req.action) {
      case "load":
        return true;
      case "book":
        return Number.isSafeInteger(req.timeslotId) && req.timeslotId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(req.windowDate));
      case "subs": {
        if (!Array.isArray(req.items) || req.items.length < 1 || req.items.length > 200) return false;
        var items = Array.from(req.items);
        var ok = items.every(function (i) { return i && Number.isSafeInteger(i.stockcode) && i.stockcode > 0 && typeof i.allow === "boolean"; });
        return ok && new Set(items.map(function (i) { return i.stockcode; })).size === items.length;
      }
      case "options":
        return typeof req.instructions === "string" && req.instructions.length <= 500 && typeof req.leaveUnattended === "boolean";
      case "address":
        return Number.isSafeInteger(req.addressId) && req.addressId > 0;
      default:
        return false;
    }
  }

  window.__weekdayFuelCheckout = {
    start: function (req) {
      if (state.phase === "running") return false;
      if (!validRequest(req)) return false;
      run(req);
      return true;
    },
    state: function () { return JSON.stringify(state); },
    urls: URLS,
  };
})();
