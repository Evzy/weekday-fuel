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
  return response(200, { UpdatedItems: [{ Stockcode: item.stockcode, Quantity: item.quantity }] });
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
