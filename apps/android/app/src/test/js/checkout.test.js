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
    },
  },
};
const HASH = "a".repeat(64);
const OFFERS_URL = "https://prod.api-wr.com/wx-rtl-offer-v2/offers?filter[status]=ACTIVE";

/* A fake woolworths.com.au. `over` replaces answers by "METHOD path" (path without the query). */
function site(over = {}) {
  return (url, init) => {
    const key = ((init && init.method) || "GET") + " " + url.split("?")[0];
    if (over[key]) return over[key](url, init);
    if (key === "GET /api/ui/v2/bootstrap") return response(200, BOOT());
    if (key === "GET /api/v3/ui/shopper/rewards/crn/hash") return response(200, HASH);
    if (key === "GET https://prod.api-wr.com/wx-rtl-offer-v2/offers")
      return response(200, {
        data: [OFFER("o1", "c1", "NOT_BOOSTED"), OFFER("o2", "c2", "BOOSTED"), OFFER("o3", "c3", "NOT_BOOSTED", { primaryProductId: "999" })],
      });
    if (key === "GET /api/v3/ui/fulfilment/windows") return response(200, WINDOWS);
    if (key === "GET /apis/ui/Checkout") return response(200, CHECKOUT);
    if (key === "POST /apis/ui/Fulfilment") return response(200, { IsSuccessful: true, Message: null });
    if (key.startsWith("POST /api/v3/ui/rewards/offers/boost/")) return response(200, true);
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

test("a failed or refused boost is reported and the others still go", async () => {
  const { api } = load(
    site({
      "POST /api/v3/ui/rewards/offers/boost/c1": () => response(500, {}),
      "POST /api/v3/ui/rewards/offers/boost/c3": () => response(200, false),
    }),
  );
  api.start({ action: "load" });
  const s = await settle(api);
  assert.deepEqual(
    s.result.boosts.offers.map((o) => [o.couponId, o.outcome, o.reason]),
    [["c1", "failed", "HTTP 500"], ["c2", "already", null], ["c3", "failed", "refused"]],
  );
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
