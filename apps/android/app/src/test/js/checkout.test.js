const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/woolworths/checkout.js");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

const DELIVERY = {
  DeliveryMethod: "Courier",
  Address: { AddressId: 111, AreaId: 222, SuburbId: 333 },
  ReservedTime: null,
  MinimumSpend: 50,
};
const BOOT = (delivery = {}) => ({
  ShopperRequest: { IsGuest: false },
  GetDeliveryInfoRequest: { ...DELIVERY, ...delivery },
  TrolleyRequest: { AvailableItems: [{ Stockcode: 134034 }, { Stockcode: 717518 }] },
});
const BOOKED = {
  Id: 948223,
  StartDateTime: "2026-10-21T05:00:00.0000000",
  EndDateTime: "2026-10-21T10:00:00.0000000",
  TimeWindow: "5:00am - 10:00am",
  CutOffDateTime: "2026-10-20T21:00:00.0000000+11:00",
};
const OFFER = (id, couponId, boostState, display = {}) => ({
  type: "STANDARD_OFFER",
  id,
  attributes: {
    boostState,
    status: "ACTIVE",
    display: { heading: "Collect 60 points", description: { summary: "Tomatoes (Minimum Spend $3)*" }, primaryProductId: "134034", ...display },
    coupons: [
      {
        id: couponId,
        attributes: { reward: { type: "POINTS_FIXED", value: 60 }, redemption: { endDateTime: "2026-10-20T23:59:59.000+11:00", minimumSpend: 300 } },
      },
    ],
  },
});
const SLOT = (Id, Available, TimeWindow, Price, SalePrice, IsEcoWindow) => ({
  Id, Available, TimeWindow, Price, SalePrice, IsEcoWindow, IsExpress: false,
  StartDateTime: "2026-10-21T05:00:00.0000000", EndDateTime: "2026-10-21T10:00:00.0000000",
  CutOffDateTime: "2026-10-20T21:00:00.0000000+11:00",
});
const WINDOWS = {
  Days: [
    {
      Date: "2026-10-21T00:00:00.0000000",
      Available: true,
      ClosedText: "All windows are full or have closed for today",
      Times: [SLOT(948201, true, "5am - 10am", 12, 12, false), SLOT(948307, false, "4am - 7am", 13, 2, true)],
    },
  ],
};
const CHECKOUT = {
  Model: {
    CheckoutSubtotalErrors: "",
    Order: {
      Subtotal: 131.43, Savings: 1.65, DeliveryFee: 12, DeliveryFeeBeforeDiscount: 15, PackagingFee: 2,
      PackagingFeeLabel: "Paper bags", TotalIncludingGst: 145.43, BalanceToPay: 145.43, TotalRewardsPointsEarned: 132,
      UnavailableProducts: [{ Stockcode: 198763, Description: "Soy sauce" }], RestrictedProducts: [],
      Products: [
        { Stockcode: 134034, DisplayName: "Tomatoes 500g", AllowSubstitution: true, AdditionalAttributes: { isexcludedfromsubstitution: "False" } },
        { Stockcode: 717518, DisplayName: "Fresh milk 2L", AllowSubstitution: false, AdditionalAttributes: { isexcludedfromsubstitution: "True" } },
        null,
      ],
    },
  },
};
const OPTIONS = {
  ShouldShowCanLeaveUnattendedPreference: true, DeliveryInstructions: "Front step", PickupInstructions: "Back door",
  CanLeaveUnattended: true, RestrictedItemsRecipient: "",
};
const ADDRESSES = {
  Address: [
    { AddressId: 111, AddressText: "U 2  94 Tennyson St, ELWOOD VIC 3184", IsPrimary: true, AreaId: 222, SuburbId: 333 },
    { AddressId: 999, AddressText: "4 Greta St, OAKLEIGH EAST VIC 3166", IsPrimary: false, AreaId: 4931, SuburbId: 4496 },
  ],
};
const HASH = "a".repeat(64);
const OFFERS_URL = "https://prod.api-wr.com/wx-rtl-offer-v2/offers?filter[status]=ACTIVE";

/* A fake woolworths.com.au. `over` replaces answers by "METHOD path" (path without the query); handlers also get the set of boosted coupon ids. */
function site(over = {}) {
  const boosted = new Set(["c2"]);
  const OFFERS = [["o1", "c1", {}], ["o2", "c2", {}], ["o3", "c3", { primaryProductId: "999" }]];
  return (url, init) => {
    const key = ((init && init.method) || "GET") + " " + url.split("?")[0];
    if (over[key]) return over[key](url, init, boosted);
    if (key === "GET /api/ui/v2/bootstrap") return response(200, BOOT());
    if (key === "GET /api/v3/ui/shopper/rewards/crn/hash") return response(200, HASH);
    if (key === "GET https://prod.api-wr.com/wx-rtl-offer-v2/offers")
      return response(200, { data: OFFERS.map(([id, c, d]) => OFFER(id, c, boosted.has(c) ? "BOOSTED" : "NOT_BOOSTED", d)) });
    if (key === "GET /api/v3/ui/fulfilment/windows") return response(200, WINDOWS);
    if (key === "GET /apis/ui/Checkout") return response(200, CHECKOUT);
    if (key === "POST /apis/ui/Fulfilment") return response(200, { IsSuccessful: true, Message: null });
    if (key.startsWith("POST /api/v3/ui/rewards/offers/boost/")) {
      boosted.add(decodeURIComponent(url.split("/").pop()));
      return response(200, true);
    }
    if (key === "GET /apis/ui/Delivery/Options") return response(200, OPTIONS);
    if (key === "POST /apis/ui/Delivery/Options") return response(200, { ...JSON.parse(init.body), RestrictedItemsRecipient: "" });
    if (key === "GET /apis/ui/address") return response(200, ADDRESSES);
    if (key === "POST /apis/ui/Checkout/substitution") return response(200, { Success: true, ErrorMessage: "" });
    return response(404, {});
  };
}

function load(handler) {
  const calls = [];
  globalThis.window = {};
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelCheckout, calls };
}

async function settle(api) {
  for (let i = 0; i < 500; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "running") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("checkout script did not settle");
}

const posts = (calls) => calls.filter((c) => c.init && c.init.method === "POST");

test("load boosts only NOT_BOOSTED offers by coupon id, one at a time, and reads times and summary", async () => {
  const { api, calls } = load(site());
  assert.equal(api.start({ action: "load" }), true);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(s.error, null);
  const boosts = posts(calls);
  assert.deepEqual(boosts.map((c) => c.url), ["/api/v3/ui/rewards/offers/boost/c1", "/api/v3/ui/rewards/offers/boost/c3"]);
  assert.equal(boosts[0].init.body, "{}");
  assert.equal(boosts[0].init.credentials, "include");
  assert.equal(calls.filter((c) => c.url === OFFERS_URL).length, 2);
  const r = s.result;
  assert.equal(r.action, "load");
  assert.equal(r.loggedOut, false);
  assert.deepEqual(r.boosts.offers.map((o) => [o.couponId, o.outcome]), [["c1", "boosted"], ["c2", "already"], ["c3", "boosted"]]);
  assert.deepEqual(r.boosts.offers[0], {
    id: "o1", couponId: "c1", heading: "Collect 60 points", description: "Tomatoes (Minimum Spend $3)*",
    productId: 134034, minimumSpend: 3, ends: "2026-10-20T23:59:59.000+11:00", outcome: "boosted", reason: null,
  });
  assert.deepEqual(r.trolley, [134034, 717518]);
  assert.equal(r.method, "Courier");
  assert.equal(r.booked, null);
  assert.equal(r.minimumSpend, 50);
  assert.equal(r.windows.days[0].date, "2026-10-21");
  assert.equal(r.windows.days[0].available, true);
  assert.equal(r.windows.days[0].closedText, "All windows are full or have closed for today");
  assert.deepEqual(r.windows.days[0].slots[0], {
    id: 948201, label: "5am - 10am", start: "2026-10-21T05:00:00.0000000", end: "2026-10-21T10:00:00.0000000",
    price: 12, available: true, eco: false, express: false, cutOff: "2026-10-20T21:00:00.0000000+11:00",
  });
  assert.deepEqual([r.windows.days[0].slots[1].price, r.windows.days[0].slots[1].available, r.windows.days[0].slots[1].eco], [2, false, true]);
  assert.deepEqual(r.summary, {
    subtotal: 131.43, savings: 1.65, deliveryFee: 12, deliveryFeeBefore: 15, bagFee: 2, bagLabel: "Paper bags",
    total: 145.43, toPay: 145.43, points: 132, warning: "", unavailable: ["Soy sauce"], restricted: [],
    items: [
      { stockcode: 134034, name: "Tomatoes 500g", allow: true, fixed: false },
      { stockcode: 717518, name: "Fresh milk 2L", allow: false, fixed: true },
    ],
  });
  assert.equal("bookError" in r, false);
});

test("the offers request carries the hashed card and the site's headers, and times use the bootstrap address", async () => {
  const { api, calls } = load(site());
  api.start({ action: "load" });
  await settle(api);
  const offers = calls.find((c) => c.url.startsWith("https://prod.api-wr.com/"));
  assert.equal(offers.url, OFFERS_URL);
  assert.equal(offers.init.headers["customer-identity"], HASH);
  assert.equal(offers.init.headers.client_id, "IRfFJjr4Px9UY1XxKtSOAUYGTpelx0S0Q");
  assert.equal(offers.init.headers["customer-timezone"], "Australia/Sydney");
  assert.equal(offers.init.headers.channel, "WOW_WEB");
  assert.equal(offers.init.credentials, undefined);
  const w = calls.find((c) => c.url.startsWith("/api/v3/ui/fulfilment/windows"));
  assert.equal(w.url, "/api/v3/ui/fulfilment/windows?areaId=222&fulfilmentMethod=Courier&addressId=111&suburbId=333");
  assert.equal(w.init.credentials, "include");
});

test("logged out stops before any boost", async () => {
  const { api, calls } = load(site({ "GET /api/ui/v2/bootstrap": () => response(200, { ShopperRequest: { IsGuest: true } }) }));
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual([s.phase, s.result, s.error], ["done", { action: "load", loggedOut: true }, null]);
  assert.equal(calls.length, 1);
});

test("a failed boost is reported and the others still go", async () => {
  const { api } = load(site({ "POST /api/v3/ui/rewards/offers/boost/c1": () => response(500, {}) }));
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual(
    s.result.boosts.offers.map((o) => [o.couponId, o.outcome, o.reason]),
    [["c1", "failed", "HTTP 500"], ["c2", "already", null], ["c3", "boosted", null]],
  );
});

test("the offers list decides: a boost answered false that Woolworths recorded counts, an accepted one it did not record fails", async () => {
  const { api } = load(
    site({
      "POST /api/v3/ui/rewards/offers/boost/c1": (url, init, boosted) => {
        boosted.add("c1");
        return response(200, false);
      },
      "POST /api/v3/ui/rewards/offers/boost/c3": () => response(200, true),
    }),
  );
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual(
    s.result.boosts.offers.map((o) => [o.couponId, o.outcome, o.reason]),
    [["c1", "boosted", null], ["c2", "already", null], ["c3", "failed", "still not boosted"]],
  );
});

test("when the second offers read fails the boost replies stand, and nothing is re-read when nothing needed boosting", async () => {
  let reads = 0;
  const { api } = load(
    site({
      "GET https://prod.api-wr.com/wx-rtl-offer-v2/offers": () => {
        reads += 1;
        return reads === 1 ? response(200, { data: [OFFER("o1", "c1", "NOT_BOOSTED")] }) : response(503, {});
      },
    }),
  );
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual(s.result.boosts.offers.map((o) => [o.couponId, o.outcome]), [["c1", "boosted"]]);
  assert.equal(reads, 2);

  const quiet = load(site({ "GET https://prod.api-wr.com/wx-rtl-offer-v2/offers": () => response(200, { data: [OFFER("o2", "c2", "BOOSTED")] }) }));
  quiet.api.start({ action: "load" });
  await settle(quiet.api);
  assert.equal(quiet.calls.filter((c) => c.url === OFFERS_URL).length, 1);
});

test("each section fails on its own", async () => {
  const { api } = load(
    site({
      "GET https://prod.api-wr.com/wx-rtl-offer-v2/offers": () => response(503, {}),
      "GET /api/v3/ui/fulfilment/windows": () => response(404, {}),
    }),
  );
  api.start({ action: "load" });
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(s.result.boosts, { error: "HTTP 503" });
  assert.deepEqual(s.result.windows, { error: "HTTP 404" });
  assert.equal(s.result.summary.total, 145.43);
});

test("a summary or offers response with the wrong shape is a section error", async () => {
  const { api } = load(
    site({
      "GET https://prod.api-wr.com/wx-rtl-offer-v2/offers": () => response(200, { offers: [] }),
      "GET /apis/ui/Checkout": () => response(200, { Model: null }),
    }),
  );
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual(s.result.boosts, { error: "offers response has no list" });
  assert.deepEqual(s.result.summary, { error: "summary response has no order" });
});

test("pick-up skips delivery times", async () => {
  const { api, calls } = load(site({ "GET /api/ui/v2/bootstrap": () => response(200, BOOT({ DeliveryMethod: "Pickup" })) }));
  api.start({ action: "load" });
  const s = await settle(api);
  assert.equal(s.result.method, "Pickup");
  assert.equal(s.result.windows, null);
  assert.equal(calls.some((c) => c.url.startsWith("/api/v3/ui/fulfilment/windows")), false);
});

test("a failed login check ends in error", async () => {
  const { api } = load(site({ "GET /api/ui/v2/bootstrap": () => response(503, {}) }));
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual([s.phase, s.result, s.error], ["error", null, "login check HTTP 503"]);
});

test("book sends the site's body, then re-reads the booked time and summary", async () => {
  let boots = 0;
  const { api, calls } = load(
    site({
      "GET /api/ui/v2/bootstrap": () => {
        boots += 1;
        return response(200, boots === 1 ? BOOT() : BOOT({ ReservedTime: BOOKED }));
      },
    }),
  );
  assert.equal(api.start({ action: "book", timeslotId: 948223, windowDate: "2026-10-21" }), true);
  const s = await settle(api);
  const book = calls.find((c) => c.url === "/apis/ui/Fulfilment");
  assert.equal(book.init.method, "POST");
  assert.equal(book.init.credentials, "include");
  assert.deepEqual(JSON.parse(book.init.body), { addressId: 111, fulfilmentMethod: "Courier", timeslotId: 948223, tradingAccount: null, windowDate: "2026-10-21" });
  const r = s.result;
  assert.equal(r.action, "book");
  assert.equal(r.bookError, null);
  assert.deepEqual(r.booked, {
    id: 948223, start: "2026-10-21T05:00:00.0000000", end: "2026-10-21T10:00:00.0000000",
    label: "5:00am - 10:00am", cutOff: "2026-10-20T21:00:00.0000000+11:00",
  });
  assert.equal(r.summary.total, 145.43);
  assert.equal("boosts" in r, false);
  assert.equal("windows" in r, false);
  assert.equal(posts(calls).length, 1);
  assert.equal(boots, 2);
});

test("a refused booking reports Woolworths' message and keeps the old booking", async () => {
  let boots = 0;
  const { api } = load(
    site({
      "GET /api/ui/v2/bootstrap": () => {
        boots += 1;
        return response(200, BOOT());
      },
      "POST /apis/ui/Fulfilment": () => response(200, { IsSuccessful: false, Message: "That time is full" }),
    }),
  );
  api.start({ action: "book", timeslotId: 948223, windowDate: "2026-10-21" });
  const s = await settle(api);
  assert.equal(s.result.bookError, "That time is full");
  assert.equal(s.result.booked, null);
  assert.equal(boots, 1);
});

test("a booking HTTP error is the book error", async () => {
  const { api } = load(site({ "POST /apis/ui/Fulfilment": () => response(500, {}) }));
  api.start({ action: "book", timeslotId: 948223, windowDate: "2026-10-21" });
  const s = await settle(api);
  assert.equal(s.result.bookError, "HTTP 500");
});

test("ignores start() while running and rejects unknown actions", async () => {
  const { api, calls } = load(site());
  assert.equal(api.start({ action: "pay" }), false);
  assert.equal(api.start(null), false);
  assert.equal(api.start({ action: "load" }), true);
  assert.equal(api.start({ action: "load" }), false);
  await settle(api);
  const n = calls.length;
  assert.equal(api.start({ action: "load" }), true);
  await settle(api);
  assert.ok(calls.length > n);
});

test("a book request without a valid slot id or date is refused before anything is sent", async () => {
  const { api, calls } = load(site());
  assert.equal(api.start({ action: "book" }), false);
  assert.equal(api.start({ action: "book", timeslotId: "948223", windowDate: "2026-10-21" }), false);
  assert.equal(api.start({ action: "book", timeslotId: 0, windowDate: "2026-10-21" }), false);
  assert.equal(api.start({ action: "book", timeslotId: 948223, windowDate: "21/10/2026" }), false);
  assert.equal(calls.length, 0);
});

test("booking on a pick-up order sends nothing and says why", async () => {
  const { api, calls } = load(site({ "GET /api/ui/v2/bootstrap": () => response(200, BOOT({ DeliveryMethod: "Pickup" })) }));
  api.start({ action: "book", timeslotId: 948223, windowDate: "2026-10-21" });
  const s = await settle(api);
  assert.equal(s.result.bookError, "not a delivery order");
  assert.equal(posts(calls).length, 0);
});

test("odd trolley items, a missing delivery address and an offer without a coupon don't break the run", async () => {
  const boot = { ...BOOT({ Address: { AddressId: 111 } }), TrolleyRequest: { AvailableItems: [null, { Stockcode: 134034 }, { Stockcode: "x" }] } };
  const noCoupon = OFFER("o9", "c9", "NOT_BOOSTED", { primaryProductId: "abc" });
  noCoupon.attributes.coupons = [];
  const { api } = load(
    site({
      "GET /api/ui/v2/bootstrap": () => response(200, boot),
      "GET https://prod.api-wr.com/wx-rtl-offer-v2/offers": () => response(200, { data: [null, noCoupon] }),
    }),
  );
  api.start({ action: "load" });
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(s.result.trolley, [134034]);
  assert.deepEqual(s.result.windows, { error: "no delivery address" });
  assert.deepEqual(s.result.boosts.offers.map((o) => [o.id, o.outcome, o.reason, o.productId]), [["o9", "failed", "no coupon", null]]);
});

test("a network error in the login check ends in error", async () => {
  const { api } = load(() => {
    throw new Error("offline");
  });
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error], ["error", "offline"]);
});

test("load reads delivery options and saved addresses for a delivery order, and neither for pick-up", async () => {
  let { api } = load(site());
  api.start({ action: "load" });
  let s = await settle(api);
  assert.deepEqual(s.result.options, { instructions: "Front step", leaveUnattended: true, offerUnattended: true });
  assert.deepEqual(s.result.addresses, {
    current: 111,
    list: [
      { id: 111, text: "U 2 94 Tennyson St, ELWOOD VIC 3184", primary: true },
      { id: 999, text: "4 Greta St, OAKLEIGH EAST VIC 3166", primary: false },
    ],
  });
  ({ api } = load(site({ "GET /api/ui/v2/bootstrap": () => response(200, BOOT({ DeliveryMethod: "Pickup" })) })));
  api.start({ action: "load" });
  s = await settle(api);
  assert.equal(s.result.options, null);
  assert.equal(s.result.addresses, null);
});

test("subs sends only the given items in the site's body, boosts nothing, and re-reads the summary", async () => {
  const { api, calls } = load(site());
  assert.equal(api.start({ action: "subs", items: [{ stockcode: 134034, allow: false }] }), true);
  const s = await settle(api);
  const sent = posts(calls);
  assert.deepEqual(sent.map((c) => c.url), ["/apis/ui/Checkout/substitution"]);
  assert.deepEqual(JSON.parse(sent[0].init.body), { Items: [{ Stockcode: 134034, AllowSubstitution: false }] });
  assert.equal(sent[0].init.credentials, "include");
  assert.equal(s.result.action, "subs");
  assert.equal(s.result.saveError, null);
  assert.equal(s.result.summary.items.length, 2);
  assert.equal("boosts" in s.result, false);
  assert.equal("windows" in s.result, false);
  for (const [answer, error] of [[response(200, { Success: false, ErrorMessage: "Nope" }), "Nope"], [response(200, { Success: false, ErrorMessage: "" }), "not saved"], [response(500, {}), "HTTP 500"]]) {
    const { api: a } = load(site({ "POST /apis/ui/Checkout/substitution": () => answer }));
    a.start({ action: "subs", items: [{ stockcode: 134034, allow: false }] });
    assert.equal((await settle(a)).result.saveError, error);
  }
});

test("options keeps the pick-up note, returns the saved options, and reports a failure", async () => {
  const { api, calls } = load(site());
  api.start({ action: "options", instructions: "Ring the bell", leaveUnattended: false });
  const s = await settle(api);
  const sent = posts(calls);
  assert.deepEqual(sent.map((c) => c.url), ["/apis/ui/Delivery/Options"]);
  assert.deepEqual(JSON.parse(sent[0].init.body), { CanLeaveUnattended: false, PickupInstructions: "Back door", DeliveryInstructions: "Ring the bell" });
  assert.equal(s.result.saveError, null);
  assert.deepEqual(s.result.options, { instructions: "Ring the bell", leaveUnattended: false, offerUnattended: true });
  const { api: a } = load(site({ "POST /apis/ui/Delivery/Options": () => response(400, {}) }));
  a.start({ action: "options", instructions: "x", leaveUnattended: true });
  const f = await settle(a);
  assert.equal(f.result.saveError, "HTTP 400");
  assert.equal("options" in f.result, false);
});

test("address refuses an id that isn't saved, and after a switch re-reads the booked time, times, addresses and summary", async () => {
  let { api, calls } = load(site());
  api.start({ action: "address", addressId: 555 });
  let s = await settle(api);
  assert.equal(s.result.saveError, "not one of your saved addresses");
  assert.equal(posts(calls).length, 0);
  let boots = 0;
  ({ api, calls } = load(
    site({
      "GET /api/ui/v2/bootstrap": () => {
        boots++;
        return response(200, BOOT(boots > 1 ? { Address: { AddressId: 999, AreaId: 4931, SuburbId: 4496 } } : {}));
      },
    }),
  ));
  api.start({ action: "address", addressId: 999 });
  s = await settle(api);
  const sent = posts(calls);
  assert.deepEqual(sent.map((c) => c.url), ["/apis/ui/Fulfilment"]);
  assert.deepEqual(JSON.parse(sent[0].init.body), { fulfilmentMethod: "Courier", addressId: 999 });
  assert.equal(boots, 2);
  assert.equal(s.result.saveError, null);
  assert.equal(s.result.addresses.current, 999);
  assert.equal(s.result.windows.days.length, 1);
  assert.ok(calls.some((c) => c.url.startsWith("/api/v3/ui/fulfilment/windows?areaId=4931&fulfilmentMethod=Courier&addressId=999&suburbId=4496")));
  assert.equal(s.result.summary.total, 145.43);
  ({ api } = load(site({ "POST /apis/ui/Fulfilment": () => response(200, { IsSuccessful: false, Message: "Not serviced" }) })));
  api.start({ action: "address", addressId: 999 });
  s = await settle(api);
  assert.equal(s.result.saveError, "Not serviced");
  assert.equal("windows" in s.result, false);
});

test("writes on a pick-up order send nothing", async () => {
  for (const req of [{ action: "subs", items: [{ stockcode: 1, allow: true }] }, { action: "options", instructions: "", leaveUnattended: false }, { action: "address", addressId: 999 }]) {
    const { api, calls } = load(site({ "GET /api/ui/v2/bootstrap": () => response(200, BOOT({ DeliveryMethod: "Pickup" })) }));
    api.start(req);
    const s = await settle(api);
    assert.equal(s.result.saveError, "not a delivery order");
    assert.equal(posts(calls).length, 0);
  }
});

test("malformed write requests are refused before anything is sent", async () => {
  const { api, calls } = load(site());
  const many = Array.from({ length: 201 }, (_, i) => ({ stockcode: i + 1, allow: true }));
  for (const req of [
    { action: "subs" },
    { action: "subs", items: [] },
    { action: "subs", items: many },
    { action: "subs", items: [{ stockcode: "134034", allow: true }] },
    { action: "subs", items: [{ stockcode: 1.5, allow: true }] },
    { action: "subs", items: [{ stockcode: 134034, allow: "yes" }] },
    { action: "subs", items: [null] },
    { action: "options", instructions: "x".repeat(501), leaveUnattended: true },
    { action: "options", instructions: "x", leaveUnattended: "true" },
    { action: "options", leaveUnattended: true },
    { action: "address", addressId: 0 },
    { action: "address", addressId: "999" },
    { action: "pay" },
  ]) assert.equal(api.start(req), false, JSON.stringify(req).slice(0, 80));
  assert.equal(calls.length, 0);
});
