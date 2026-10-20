const { test } = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../main/assets/weekday_fuel/backup.js");

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    keys() {
      return [...map.keys()];
    },
    get(k) {
      return map.has(k) ? map.get(k) : null;
    },
    set(k, v) {
      map.set(k, v);
    },
    remove(k) {
      map.delete(k);
    },
    snapshot() {
      return Object.fromEntries(map);
    },
  };
}

const MAIN = "weekdayfuel.v1";
const ORDERS = "weekdayfuel.v1.orders";
const INV = "weekdayfuel.inventory";
const PRICES = "weekdayfuel.v1.prices";
const COLES = "weekdayfuel.v1.colesPrices";
const BACKUP_META = "weekdayfuel.backup";
const BEFORE = "weekdayfuel.beforeRestore";

test("build round trip: parse recovers data", () => {
  const st = fakeStorage({
    [MAIN]: JSON.stringify({ days: { "2026-10-01": {} }, weights: { "2026-10-01": { kg: 80 } } }),
    [ORDERS]: JSON.stringify([{ id: "o1" }]),
    [INV]: JSON.stringify({ eggs: 6 }),
    [PRICES]: "{}",
    [COLES]: "{}",
    [BACKUP_META]: "{}",
    other: "nope",
  });
  const json = B.build(st, new Date("2026-10-20T00:00:00.000Z"), "0.20.0");
  const parsed = B.parse(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.backup.app, "weekdayfuel");
  assert.equal(parsed.backup.v, 1);
  assert.equal(parsed.backup.appVersion, "0.20.0");
  assert.deepEqual(Object.keys(parsed.backup.data).sort(), [INV, MAIN, ORDERS]);
  assert.equal(parsed.backup.data[MAIN], st.get(MAIN));
});

test("build excludes price caches and backup keys", () => {
  const st = fakeStorage({
    [MAIN]: "{}",
    [PRICES]: "p",
    [COLES]: "c",
    [BACKUP_META]: "b",
    [BEFORE]: "x",
  });
  const parsed = B.parse(B.build(st, new Date("2026-01-01T00:00:00.000Z"), "0.1.0"));
  assert.deepEqual(Object.keys(parsed.backup.data), [MAIN]);
});

test("parse: not JSON", () => {
  assert.deepEqual(B.parse("{"), { ok: false, error: "That file isn't JSON." });
});

test("parse: not a Weekday Fuel backup", () => {
  assert.deepEqual(B.parse('{"app":"other","v":1,"data":{}}'), {
    ok: false,
    error: "That isn't a Weekday Fuel backup.",
  });
  assert.deepEqual(B.parse('{"app":"weekdayfuel","v":0,"data":{}}'), {
    ok: false,
    error: "That isn't a Weekday Fuel backup.",
  });
});

test("parse: newer version refused", () => {
  assert.deepEqual(B.parse('{"app":"weekdayfuel","v":2,"data":{}}'), {
    ok: false,
    error: "This backup is from a newer version of the app. Update the app first.",
  });
});

test("parse: damaged data", () => {
  assert.deepEqual(B.parse('{"app":"weekdayfuel","v":1,"data":[]}'), {
    ok: false,
    error: "The backup's data is damaged.",
  });
  assert.deepEqual(B.parse('{"app":"weekdayfuel","v":1,"data":null}'), {
    ok: false,
    error: "The backup's data is damaged.",
  });
  assert.deepEqual(B.parse('{"app":"weekdayfuel","v":1,"data":{"weekdayfuel.v1":1}}'), {
    ok: false,
    error: "The backup's data is damaged.",
  });
});

test("parse: foreign and excluded keys dropped", () => {
  const raw = {
    app: "weekdayfuel",
    v: 1,
    exportedAt: "2026-10-01T00:00:00.000Z",
    appVersion: "0.15.0",
    data: {
      [MAIN]: "{}",
      "other.app": "x",
      [PRICES]: "skip",
      [BACKUP_META]: "skip",
    },
  };
  const r = B.parse(JSON.stringify(raw));
  assert.equal(r.ok, true);
  assert.deepEqual(r.backup.data, { [MAIN]: "{}" });
});

test("summary on real-shaped data", () => {
  const backup = {
    exportedAt: "2026-10-12T00:00:00.000Z",
    appVersion: "0.15.0",
    data: {
      [MAIN]: JSON.stringify({
        days: { a: 1, b: 2 },
        weights: { w1: {}, w2: {}, w3: {} },
      }),
      [ORDERS]: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      [INV]: "{}",
    },
  };
  assert.deepEqual(B.summary(backup), {
    exportedAt: "2026-10-12T00:00:00.000Z",
    appVersion: "0.15.0",
    days: 2,
    orders: 9,
    weighIns: 3,
    hasKitchen: true,
  });
});

test("summary on garbage counts zero", () => {
  const backup = {
    exportedAt: "x",
    appVersion: "0.1.0",
    data: {
      [MAIN]: "not json",
      [ORDERS]: "{}",
    },
  };
  assert.deepEqual(B.summary(backup), {
    exportedAt: "x",
    appVersion: "0.1.0",
    days: 0,
    orders: 0,
    weighIns: 0,
    hasKitchen: false,
  });
});

test("summaryText omits zeros except days; singulars", () => {
  const fmt = (iso) => (iso === "2026-10-12T00:00:00.000Z" ? "12 Oct" : iso);
  assert.equal(
    B.summaryText(
      { exportedAt: "2026-10-12T00:00:00.000Z", appVersion: "0.15.0", days: 46, orders: 9, weighIns: 30, hasKitchen: true },
      fmt
    ),
    "Backup from 12 Oct · v0.15.0 · 46 days · 9 orders · 30 weigh-ins · Kitchen stock"
  );
  assert.equal(
    B.summaryText({ exportedAt: "2026-10-12T00:00:00.000Z", appVersion: "0.15.0", days: 0, orders: 0, weighIns: 0, hasKitchen: false }, fmt),
    "Backup from 12 Oct · v0.15.0 · 0 days"
  );
  assert.equal(
    B.summaryText({ exportedAt: "2026-10-12T00:00:00.000Z", appVersion: "0.15.0", days: 1, orders: 1, weighIns: 1, hasKitchen: false }, fmt),
    "Backup from 12 Oct · v0.15.0 · 1 day · 1 order · 1 weigh-in"
  );
});

test("restorePlan removes stale keys; excluded storage keys untouched", () => {
  const st = fakeStorage({
    [MAIN]: "old",
    "weekdayfuel.v1.shop": "stale",
    [PRICES]: "keep",
    [COLES]: "keep",
    [BACKUP_META]: "keep",
  });
  const backup = { data: { [MAIN]: "new" } };
  const plan = B.restorePlan(st, backup);
  assert.deepEqual(plan.remove, ["weekdayfuel.v1.shop"]);
  assert.deepEqual(plan.set, { [MAIN]: "new" });
  B.applyPlan(st, plan);
  assert.equal(st.get(MAIN), "new");
  assert.equal(st.get("weekdayfuel.v1.shop"), null);
  assert.equal(st.get(PRICES), "keep");
  assert.equal(st.get(COLES), "keep");
  assert.equal(st.get(BACKUP_META), "keep");
});

test("applyPlan throws on first failure", () => {
  const st = {
    keys() {
      return [];
    },
    get() {
      return null;
    },
    set() {
      throw new Error("full");
    },
    remove() {},
  };
  assert.throws(() => B.applyPlan(st, { remove: [], set: { [MAIN]: "x" } }), /full/);
  let removed = false;
  const st2 = {
    keys() {
      return [MAIN];
    },
    get() {
      return "a";
    },
    set() {},
    remove() {
      removed = true;
      throw new Error("nope");
    },
  };
  assert.throws(() => B.applyPlan(st2, { remove: [MAIN], set: {} }), /nope/);
  assert.equal(removed, true);
});
