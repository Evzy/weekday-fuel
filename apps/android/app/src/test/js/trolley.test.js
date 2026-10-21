const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/woolworths/trolley.js");
const LOGGED_IN = { ShopperRequest: { IsGuest: false } };
const LOGGED_OUT = { ShopperRequest: { IsGuest: true } };
const LINES = [{ stockcode: 717518, quantity: 2 }, { stockcode: 72280, quantity: 5 }];

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function accepted(init) {
  const item = JSON.parse(init.body).items[0];
  return response(200, {
    UpdatedItems: [{ Stockcode: item.stockcode, Quantity: item.quantity, QuantityInTrolley: item.quantity }],
  });
}

function load(handler) {
  const calls = [];
  globalThis.window = {};
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, globalThis.window.__weekdayFuelTrolley.urls);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelTrolley, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "checking" && s.phase !== "adding") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("trolley script did not settle");
}

test("stops at loggedOut without touching the trolley", async () => {
  const { api, calls } = load(() => response(200, LOGGED_OUT));
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "loggedOut");
  assert.equal(calls.length, 1);
});

test("sets each line's quantity in order", async () => {
  const { api, calls } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : accepted(init)));
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(s.completed, 2);
  const updates = calls.slice(1);
  assert.deepEqual(updates.map((c) => [c.url, c.init.method]), [["/api/v3/ui/trolley/update", "POST"], ["/api/v3/ui/trolley/update", "POST"]]);
  assert.deepEqual(updates.map((c) => JSON.parse(c.init.body).items[0]).map((i) => [i.stockcode, i.quantity]), [[717518, 2], [72280, 5]]);
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "added" }, { stockcode: 72280, outcome: "added" }]);
});

test("a rejected line is reported and the rest still go in", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    return JSON.parse(init.body).items[0].stockcode === 717518 ? response(500, {}) : accepted(init);
  });
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "failed", reason: "HTTP 500" }, { stockcode: 72280, outcome: "added" }]);
});

test("a line Woolworths silently drops is reported as not available", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    return JSON.parse(init.body).items[0].stockcode === 717518 ? response(200, { UpdatedItems: [] }) : accepted(init);
  });
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "failed", reason: "not available" }, { stockcode: 72280, outcome: "added" }]);
});

test("a network error on a line is reported as failed", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    throw new Error("offline");
  });
  api.start([LINES[0]]);
  const s = await settle(api);
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "failed", reason: "offline" }]);
});

test("a failing login check ends in error", async () => {
  const { api } = load(() => response(403, {}));
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "error");
  assert.equal(s.error, "login check HTTP 403");
});

test("ignores start() while a run is in progress", async () => {
  const { api, calls } = load((url, init, urls) =>
    url === urls.loginStatus ? response(200, LOGGED_IN) : accepted(init),
  );
  assert.equal(api.start(LINES), true);
  assert.equal(api.start(LINES), false);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(s.completed, 2);
  assert.equal(s.results.length, 2);
  assert.equal(calls.length, 3);
});

test("a weighed line is sent with its kilogram quantity unchanged", async () => {
  const { api, calls } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : accepted(init)));
  api.start([{ stockcode: 175734, quantity: 0.3 }]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(JSON.parse(calls[1].init.body).items[0].quantity, 0.3);
  assert.deepEqual(s.results, [{ stockcode: 175734, outcome: "added" }]);
});

test("a quantity 0 line that Woolworths accepts counts as removed", async () => {
  const { api, calls } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : response(200, { UpdatedItems: [] })));
  api.start([{ stockcode: 198763, quantity: 0 }, { stockcode: 717518, quantity: 2 }]);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(JSON.parse(calls[1].init.body).items[0].quantity, 0);
  assert.deepEqual(s.results, [{ stockcode: 198763, outcome: "removed" }, { stockcode: 717518, outcome: "failed", reason: "not available" }]);
});

test("a removal Woolworths rejects is reported as failed", async () => {
  const { api } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : response(500, {})));
  api.start([{ stockcode: 198763, quantity: 0 }]);
  const s = await settle(api);
  assert.deepEqual(s.results, [{ stockcode: 198763, outcome: "failed", reason: "HTTP 500" }]);
});

test("when QuantityInTrolley differs from the requested quantity the line fails with trolley has N", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    const item = JSON.parse(init.body).items[0];
    if (item.stockcode === 717518) {
      return response(200, { UpdatedItems: [{ Stockcode: 717518, Quantity: 2, QuantityInTrolley: 1 }] });
    }
    return accepted(init);
  });
  api.start(LINES);
  const s = await settle(api);
  assert.deepEqual(s.results, [
    { stockcode: 717518, outcome: "failed", reason: "trolley has 1" },
    { stockcode: 72280, outcome: "added" },
  ]);
});

test("when QuantityInTrolley is missing the line still counts as added", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    const item = JSON.parse(init.body).items[0];
    return response(200, { UpdatedItems: [{ Stockcode: item.stockcode, Quantity: item.quantity }] });
  });
  api.start([LINES[0]]);
  const s = await settle(api);
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "added" }]);
});

test("a weighed line is not flagged when QuantityInTrolley uses another unit", async () => {
  const { api } = load((url, init, urls) =>
    url === urls.loginStatus
      ? response(200, LOGGED_IN)
      : response(200, { UpdatedItems: [{ Stockcode: 175734, Quantity: 300, QuantityInTrolley: 300 }] }));
  api.start([{ stockcode: 175734, quantity: 0.3 }]);
  const s = await settle(api);
  assert.deepEqual(s.results, [{ stockcode: 175734, outcome: "added" }]);
});
