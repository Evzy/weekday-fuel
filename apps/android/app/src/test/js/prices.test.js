const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/woolworths/prices.js");

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const P = (Stockcode, Price, WasPrice, extra = {}) => ({
  Stockcode, Price, WasPrice, IsOnSpecial: false, IsAvailable: true, IsInStock: true, IsPurchasable: true, ...extra,
});

function load(handler) {
  const calls = [];
  globalThis.window = {};
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelPrices, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "fetching") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("price script did not settle");
}

test("reads every stockcode in one request and maps price, was, special and availability", async () => {
  const { api, calls } = load(() =>
    response(200, [
      P(6013278, 6.7, 6.7),
      P(919345, 5.6, 6.6),
      P(43974, 2.3, 2.3, { IsOnSpecial: true }),
      P(175734, 28, 28, { Unit: "KG" }),
      P(729008, 8.3, 8.3, { IsAvailable: false }),
      P(46795, 6.8, 6.8, { IsInStock: false }),
      P(98046, null, null),
    ]),
  );
  assert.equal(api.start([6013278, 919345, 43974, 175734, 729008, 46795, 98046]), true);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/apis/ui/products/6013278,919345,43974,175734,729008,46795,98046");
  assert.equal(calls[0].init.credentials, "include");
  assert.deepEqual(s.prices, {
    6013278: { price: 6.7, was: null, special: false, available: true },
    919345: { price: 5.6, was: 6.6, special: true, available: true },
    43974: { price: 2.3, was: null, special: true, available: true },
    175734: { price: 28, was: null, special: false, available: true },
    729008: { price: 8.3, was: null, special: false, available: false },
    46795: { price: 6.8, was: null, special: false, available: false },
    98046: { price: null, was: null, special: false, available: false },
  });
  assert.ok(!Number.isNaN(Date.parse(s.at)));
  assert.equal(s.error, null);
});

test("splits long lists into requests of 40 stockcodes", async () => {
  const codes = Array.from({ length: 85 }, (_, i) => 1000 + i);
  const { api, calls } = load((url) => {
    const asked = url.slice("/apis/ui/products/".length).split(",").map(Number);
    return response(200, asked.map((c) => P(c, 1, 1)));
  });
  api.start(codes);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(calls.map((c) => c.url.split(",").length), [40, 40, 5]);
  assert.equal(Object.keys(s.prices).length, 85);
});

test("a stockcode Woolworths leaves out is simply missing from the prices", async () => {
  const { api } = load(() => response(200, [P(6013278, 6.7, 6.7)]));
  api.start([6013278, 1]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(Object.keys(s.prices), ["6013278"]);
});

test("an HTTP error ends in error with no prices", async () => {
  const { api } = load(() => response(503, {}));
  api.start([6013278]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error, s.prices, s.at], ["error", "prices HTTP 503", {}, null]);
});

test("a response that is not a list ends in error", async () => {
  const { api } = load(() => response(200, { Products: [] }));
  api.start([6013278]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error], ["error", "prices response is not a list"]);
});

test("a network error ends in error", async () => {
  const { api } = load(() => {
    throw new Error("offline");
  });
  api.start([6013278]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error], ["error", "offline"]);
});

test("ignores start() while fetching, and can run again after", async () => {
  const { api, calls } = load(() => response(200, [P(6013278, 6.7, 6.7)]));
  assert.equal(api.start([6013278]), true);
  assert.equal(api.start([6013278]), false);
  await settle(api);
  assert.equal(calls.length, 1);
  assert.equal(api.start([6013278]), true);
  await settle(api);
  assert.equal(calls.length, 2);
});
