const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/coles/prices.js");

function response(status, body, bad = false) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (bad) throw new SyntaxError("Unexpected token <");
      return body;
    },
  };
}

const R = (id, now, was, extra = {}) => ({ id, availability: true, pricing: { now, was, promotionType: null }, ...extra });
const reply = (results, store = { name: "Coles Local St Kilda" }) => ({ data: { productsInfo: { invalidProducts: [], results }, store } });

function load(handler, page = {}) {
  const calls = [];
  globalThis.window = {
    __RUNTIME_CONFIG__: "config" in page ? page.config : { BFF_API_SUBSCRIPTION_KEY: "k123" },
    __NEXT_DATA__: page.nextData,
  };
  globalThis.document = { cookie: "cookie" in page ? page.cookie : "a=1; fulfillmentStoreId=0668; b=2" };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return handler(url, init);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelColesPrices, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "fetching") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("coles price script did not settle");
}

test("asks for every product and the store in one request and maps price, was, special and availability", async () => {
  const { api, calls } = load(() =>
    response(200, reply([
      R(132045, 2.2, null),
      R(8991361, 3.3, 4.65, { pricing: { now: 3.3, was: 4.65, promotionType: "SPECIAL" } }),
      R(8112799, 9.8, null, { pricing: { now: 9.8, was: null, promotionType: "SPECIAL" } }),
      R(1435100, 8.8, null, { availability: false }),
      { id: 8566038, availability: false, pricing: null },
      R(7214862, 1.74, 1.74),
    ])),
  );
  assert.equal(api.start(["132045", "8991361", "8112799", "1435100", "8566038", "7214862"]), true);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/graphql");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers["Ocp-Apim-Subscription-Key"], "k123");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(calls[0].body.variables, { productIds: ["132045", "8991361", "8112799", "1435100", "8566038", "7214862"], brandedStoreId: "COL:0668" });
  assert.match(calls[0].body.query, /productsInfo\(/);
  assert.match(calls[0].body.query, /store\(id: \$brandedStoreId\)/);
  assert.deepEqual(s.store, { id: "0668", name: "Coles Local St Kilda" });
  assert.deepEqual(s.prices, {
    132045: { price: 2.2, was: null, special: false, available: true },
    8991361: { price: 3.3, was: 4.65, special: true, available: true },
    8112799: { price: 9.8, was: null, special: true, available: true },
    1435100: { price: 8.8, was: null, special: false, available: false },
    8566038: { price: null, was: null, special: false, available: false },
    7214862: { price: 1.74, was: null, special: false, available: true },
  });
  assert.ok(!Number.isNaN(Date.parse(s.at)));
  assert.equal(s.error, null);
});

test("splits long lists into requests of 30 and asks for the store only in the first", async () => {
  const ids = Array.from({ length: 46 }, (_, i) => String(1000000 + i));
  const { api, calls } = load((url, init) => {
    const asked = JSON.parse(init.body).variables.productIds;
    return response(200, reply(asked.map((id) => R(Number(id), 1, null))));
  });
  api.start(ids);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(calls.map((c) => c.body.variables.productIds.length), [30, 16]);
  assert.match(calls[0].body.query, /store\(/);
  assert.doesNotMatch(calls[1].body.query, /store\(/);
  assert.equal(Object.keys(s.prices).length, 46);
});

test("the store comes from initStoreId when the cookie is missing, and a missing store name is null", async () => {
  const { api, calls } = load(() => response(200, reply([R(132045, 2.2, null)], null)), {
    cookie: "a=1",
    nextData: { props: { pageProps: { initStoreId: "0584" } } },
  });
  api.start(["132045"]);
  const s = await settle(api);
  assert.equal(calls[0].body.variables.brandedStoreId, "COL:0584");
  assert.deepEqual(s.store, { id: "0584", name: null });
});

test("without the key or a store the page is not ready and nothing is requested", async () => {
  for (const page of [{ config: undefined }, { config: { BFF_API_SUBSCRIPTION_KEY: "" } }, { cookie: "", nextData: undefined }]) {
    const { api, calls } = load(() => response(200, reply([])), page);
    assert.equal(api.start(["132045"]), true);
    const s = JSON.parse(api.state());
    assert.equal(s.phase, "notReady");
    assert.equal(calls.length, 0);
  }
});

test("HTTP errors, GraphQL errors and unreadable replies end in error with no prices", async () => {
  const cases = [
    [response(401, { statusCode: 401 }), "coles prices HTTP 401"],
    [response(200, { errors: [{ message: "Argument Validation Error" }], data: null }), "coles prices response has no products"],
    [response(200, null, true), "Unexpected token <"],
  ];
  for (const [res, message] of cases) {
    const { api } = load(() => res);
    api.start(["132045"]);
    const s = await settle(api);
    assert.deepEqual([s.phase, s.error, s.prices, s.at, s.store], ["error", message, {}, null, null]);
  }
});

test("a network error ends in error", async () => {
  const { api } = load(() => {
    throw new Error("offline");
  });
  api.start(["132045"]);
  const s = await settle(api);
  assert.deepEqual([s.phase, s.error], ["error", "offline"]);
});

test("ignores start() while fetching, and can run again after", async () => {
  const { api, calls } = load(() => response(200, reply([R(132045, 2.2, null)])));
  assert.equal(api.start(["132045"]), true);
  assert.equal(api.start(["132045"]), false);
  await settle(api);
  assert.equal(calls.length, 1);
  assert.equal(api.start(["132045"]), true);
  await settle(api);
  assert.equal(calls.length, 2);
});
