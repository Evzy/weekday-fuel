const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/coles/trolley.js");
const COOKIE = "a=1; fulfillmentStoreId=7674; sessionId=s-1; visitorId=v-2; dsch-ccpuserid=u-3";

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

const ITEM = (productId, quantity, orderItemId) => ({ productId, quantity, orderItemId, product: { name: "x" } });
const trolley = (items) => ({ orderId: "1", items });
const patched = (actioned, failed = []) => ({ results: [{ actionedItems: actioned, failedItems: failed }], totalQuantity: 1 });

function load(handlers, page = {}) {
  const calls = [];
  globalThis.window = { __RUNTIME_CONFIG__: "config" in page ? page.config : { BFF_API_SUBSCRIPTION_KEY: "k123" }, crypto: { randomUUID: () => "uuid-1" } };
  globalThis.document = { cookie: "cookie" in page ? page.cookie : COOKIE };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    const h = (init.method || "GET") === "PATCH" ? handlers.patch : handlers.get;
    return h(url, init);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelColesTrolley, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "fetching") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("coles trolley script did not settle");
}

test("reads the trolley, then sets new and existing products and removes old ones in one request", async () => {
  const { api, calls } = load({
    get: () => response(200, trolley([ITEM(3329137, 1, "9157373864"), ITEM(132045, 2, "111"), ITEM(5077283, 1, "222")])),
    patch: () =>
      response(200, patched([
        { productId: "8991361", orderItemId: "333", quantity: 4, action: "ADD" },
        { productId: "3329137", orderItemId: "9157373864", quantity: 2, action: "UPDATE" },
        { productId: "5077283", quantity: 0, action: "DELETE" },
      ])),
  });
  const lines = [
    { productId: "8991361", quantity: 4 },
    { productId: "3329137", quantity: 2 },
    { productId: "132045", quantity: 2 },
    { productId: "5077283", quantity: 0 },
    { productId: "4834736", quantity: 0 },
  ];
  assert.equal(api.start(lines), true);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/bff/trolley/store/7674");
  assert.equal(calls[0].init.method || "GET", "GET");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers["x-api-version"], "3");
  assert.equal(calls[1].url, "/api/bff/trolley/store/7674");
  assert.equal(calls[1].init.method, "PATCH");
  assert.equal(calls[1].init.credentials, "include");
  for (const c of calls) {
    assert.equal(c.init.headers["Ocp-Apim-Subscription-Key"], "k123");
    assert.equal(c.init.headers["cusp-session-id"], "s-1");
    assert.equal(c.init.headers["cusp-visitor-id"], "v-2");
    assert.equal(c.init.headers["cusp-user-id"], "u-3");
    assert.equal(c.init.headers["cusp-correlation-id"], "uuid-1");
  }
  assert.deepEqual(calls[1].body, {
    ageGateVerified: false,
    swapBehaviour: false,
    items: [{ actions: [
      { productId: "8991361", quantity: 4 },
      { productId: "3329137", quantity: 2, orderItemId: "9157373864" },
      { productId: "5077283", quantity: 0, orderItemId: "222" },
    ] }],
  });
  assert.deepEqual(s.results, [
    { productId: "8991361", added: true },
    { productId: "3329137", added: true },
    { productId: "132045", added: true },
    { productId: "5077283", added: true },
    { productId: "4834736", added: true },
  ]);
  assert.equal(s.error, null);
  assert.doesNotMatch(api.state(), /k123/);
});

test("failed products carry Coles' message, and products missing from the answer fail too", async () => {
  const { api } = load({
    get: () => response(200, trolley([])),
    patch: () =>
      response(200, patched(
        [{ productId: "8991361", orderItemId: "333", quantity: 1, action: "ADD" }],
        [{ productId: "9999999", quantity: 1, action: "ADD", error: { errorCode: "unavailable", message: "Product is unavailable" } }],
      )),
  });
  api.start([{ productId: "8991361", quantity: 1 }, { productId: "9999999", quantity: 1 }, { productId: "1234567", quantity: 1 }]);
  const s = await settle(api);
  assert.deepEqual(s.results, [
    { productId: "8991361", added: true },
    { productId: "9999999", added: false, reason: "Product is unavailable" },
    { productId: "1234567", added: false, reason: "no answer for this product" },
  ]);
});

test("nothing to change sends no PATCH", async () => {
  const { api, calls } = load({ get: () => response(200, trolley([ITEM(3329137, 2, "1")])), patch: () => assert.fail("no PATCH expected") });
  api.start([{ productId: "3329137", quantity: 2 }, { productId: "132045", quantity: 0 }]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(calls.length, 1);
  assert.deepEqual(s.results, [{ productId: "3329137", added: true }, { productId: "132045", added: true }]);
});

test("401 or 403 from either request means log in, and a logged-out read sends nothing", async () => {
  let r = load({ get: () => response(401, { errorCode: "401", message: "UNAUTHORIZED" }), patch: () => assert.fail("no PATCH expected") });
  r.api.start([{ productId: "3329137", quantity: 1 }]);
  let s = await settle(r.api);
  assert.deepEqual([s.phase, s.results, s.error], ["needsLogin", [], null]);
  assert.equal(r.calls.length, 1);
  r = load({ get: () => response(200, trolley([])), patch: () => response(403, {}) });
  r.api.start([{ productId: "3329137", quantity: 1 }]);
  s = await settle(r.api);
  assert.equal(s.phase, "needsLogin");
});

test("a rejected PATCH becomes per-product HTTP failures and still finishes", async () => {
  const { api } = load({
    get: () => response(200, trolley([ITEM(132045, 2, "111")])),
    patch: () => response(400, {}),
  });
  api.start([
    { productId: "132045", quantity: 2 },
    { productId: "3329137", quantity: 1 },
  ]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(s.error, null);
  assert.deepEqual(s.results, [
    { productId: "132045", added: true },
    { productId: "3329137", added: false, reason: "HTTP 400" },
  ]);
  assert.doesNotMatch(api.state(), /k123/);
});

test("HTTP errors, unreadable replies and a reply with no items end in error", async () => {
  const cases = [
    [{ get: () => response(500, {}) }, "coles trolley HTTP 500"],
    [{ get: () => response(200, null, true) }, "Unexpected token <"],
    [{ get: () => response(200, { errors: [] }) }, "coles trolley response has no items"],
    [{ get: () => { throw new Error("offline"); } }, "offline"],
  ];
  for (const [handlers, message] of cases) {
    const { api } = load(handlers);
    api.start([{ productId: "3329137", quantity: 1 }]);
    const s = await settle(api);
    assert.deepEqual([s.phase, s.error, s.results], ["error", message, []]);
    assert.doesNotMatch(api.state(), /k123/);
  }
});

test("without the key or a store the page is not ready and nothing is requested", async () => {
  for (const page of [{ config: undefined }, { config: { BFF_API_SUBSCRIPTION_KEY: "" } }, { cookie: "sessionId=s-1" }]) {
    const { api, calls } = load({ get: () => response(200, trolley([])) }, page);
    assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), true);
    assert.equal(JSON.parse(api.state()).phase, "notReady");
    assert.equal(calls.length, 0);
  }
});

test("ignores start() while fetching, can run again after, and re-injecting keeps the same API", async () => {
  const { api, calls } = load({ get: () => response(200, trolley([])), patch: () => response(200, patched([{ productId: "3329137", quantity: 1, action: "ADD" }])) });
  assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), true);
  assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), false);
  await settle(api);
  assert.equal(calls.length, 2);
  const before = api.state();
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  assert.equal(globalThis.window.__weekdayFuelColesTrolley, api);
  assert.equal(api.state(), before);
  assert.equal(api.start([{ productId: "3329137", quantity: 1 }]), true);
  await settle(api);
  assert.equal(calls.length, 4);
});
