const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { create, colesId: catalogueColesId } = require("../../main/assets/weekday_fuel/catalogue.js");
const I = require("../../main/assets/weekday_fuel/inventory.js");

const ASSETS = path.join(__dirname, "../../main/assets/weekday_fuel");

const W = "https://www.woolworths.com.au/shop/productdetails/";
const C = "https://www.coles.com.au/product/";
const ITEMS = [
  { id: "dare", sec: 0, name: "Dare", unit: "bottles", note: "", same: true,
    coles: { name: "Dare", url: C + "dare-1", size: 1, price: 5, checked: "2026-10-15" },
    woolies: { name: "Dare", url: W + "72280", stockcode: 72280, size: 1, price: 5, checked: "2026-10-15" } },
  { id: "grenade", sec: 0, name: "Grenade", unit: "bars", note: "", same: true,
    coles: { name: "Grenade", url: C + "grenade-1", size: 1, price: 5, checked: "2026-10-15" },
    woolies: { name: "Grenade", url: W + "6027807", stockcode: 6027807, size: 1, price: 5, checked: "2026-10-15" } },
  { id: "breast", sec: 1, keeps: 3, name: "Breast", unit: "g", note: "", same: false,
    coles: { name: "Breast", url: C + "breast-1", size: 600, price: 8, checked: "2026-10-15" },
    woolies: { name: "Breast", url: W + "6078624", stockcode: 6078624, size: 650, price: 9, checked: "2026-10-15" } },
  { id: "ham", sec: 1, keeps: 5, name: "Ham", unit: "g", note: "", same: false,
    coles: null,
    woolies: { name: "Ham deli", url: W + "175734", stockcode: 175734, perKg: true, size: 1, price: 28, checked: "2026-10-15" } },
  { id: "yog", sec: 1, keeps: 14, name: "Yoghurt", unit: "g", note: "", same: true,
    coles: { name: "Yog", url: C + "yog-1", size: 907, price: 8, checked: "2026-10-15" },
    woolies: { name: "Yog", url: W + "717518", stockcode: 717518, size: 907, price: 8, checked: "2026-10-15" } },
  { id: "cheese", sec: 1, keeps: 21, name: "Cheese", unit: "g", note: "", same: false,
    coles: { name: "Cheese", url: C + "cheese-1", size: 500, price: 7, checked: "2026-10-15" },
    woolies: { name: "Cheese", url: W + "729008", stockcode: 729008, size: 500, price: 9, checked: "2026-10-15" } },
  { id: "rice", sec: 2, name: "Rice", unit: "pouches", note: "", same: true,
    coles: { name: "Rice", url: C + "rice-1", size: 1, price: 2, checked: "2026-10-15" },
    woolies: { name: "Rice", url: W + "123", stockcode: 123, size: 1, price: 2, checked: "2026-10-15" } },
  { id: "honey", sec: 2, name: "Honey", unit: "g", note: "", same: false,
    coles: { name: "Honey", url: C + "honey-1", size: 400, price: 4, checked: "2026-10-15" },
    woolies: { name: "Honey", url: W + "753976", stockcode: 753976, size: 375, price: 5, checked: "2026-10-15" } },
];
const AMOUNTS = {
  toasty: { ham: 100, cheese: { L: 10, S: 30, X: 50 } },
  tenderwrap: { breast: 200, cheese: 30 },
  bowl: { breast: 150, rice: 1 },
};
const cat = create(ITEMS, AMOUNTS);

const iso = (d) => d.toISOString();
const localMid = (y, m, d) => iso(new Date(y, m, d));
const START = iso(new Date(2026, 9, 10, 8, 0, 0));
const NOW = new Date(2026, 9, 20, 12, 0, 0);

function inv(events) {
  return { v: 1, start: START, events: events || [] };
}

const STAPLES_DG = [{ id: "dare", amount: 1 }, { id: "grenade", amount: 1 }];
function staplesNone() {
  return [];
}
function staplesAlways(list) {
  const items = list || STAPLES_DG;
  return function () {
    return items;
  };
}
function staplesOnDates(dates, list) {
  const set = dates instanceof Set ? dates : new Set(dates);
  const items = list || STAPLES_DG;
  return function (d) {
    return set.has(d) ? items : [];
  };
}

function amounts(st) {
  return Object.fromEntries(Object.entries(st).map(([k, v]) => [k, v.amount]));
}

function stockFlags(st) {
  return Object.fromEntries(
    Object.entries(st).map(([k, v]) => [k, { amount: v.amount, useSoon: v.useSoon, off: v.off }]),
  );
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("parse keeps valid inventory and drops bad events", () => {
  const good = {
    v: 1,
    start: START,
    events: [
      { id: "a", at: START, k: "buy", item: "breast", amount: 600, order: "o1" },
      { id: "b", at: START, k: "set", item: "breast", amount: 0, why: "used" },
      { id: "c", at: START, k: "add", item: "ham", amount: 200 },
    ],
  };
  assert.deepEqual(I.parse(JSON.stringify(good)), good);
  const bad = {
    v: 2,
    start: "nope",
    events: [
      { id: "", at: START, k: "buy", item: "x", amount: 1, order: "o" },
      { id: "x", at: START, k: "buy", item: "x", amount: 0, order: "o" },
      { id: "x", at: START, k: "set", item: "x", amount: -1, why: "count" },
      { id: "x", at: START, k: "set", item: "x", amount: 1, why: "bad" },
      { id: "x", at: START, k: "nope", item: "x", amount: 1 },
      null,
    ],
  };
  assert.equal(I.parse(JSON.stringify(bad)), null);
  assert.equal(I.parse(JSON.stringify({ v: 1, start: START, events: bad.events })).events.length, 0);
  assert.equal(I.parse("not json"), null);
  assert.equal(I.parse(JSON.stringify({ v: 1, start: "nope", events: [] })), null);
  assert.deepEqual(
    I.parse(
      JSON.stringify({
        v: 1,
        start: START,
        events: [
          { id: "a", at: START, k: "add", item: "ham", amount: 0 },
          { id: "b", at: START, k: "buy", item: "ham", amount: 1 },
        ],
      }),
    ).events.length,
    0,
  );
});

test("addEvents assigns ids and at; removeOrder strips buy events for that order", () => {
  const a = I.addEvents(null, [{ k: "buy", item: "breast", amount: 600, order: "ord1" }], START);
  assert.equal(a.start, START);
  assert.equal(a.events.length, 1);
  assert.equal(a.events[0].id, START + "#0");
  assert.equal(a.events[0].at, START);
  const b = I.addEvents(a, [{ k: "add", item: "ham", amount: 100, at: "2026-10-11T09:00:00.000Z" }], START);
  assert.equal(b.events.length, 2);
  assert.equal(b.events[1].id, START + "#1");
  assert.equal(b.events[1].at, "2026-10-11T09:00:00.000Z");
  assert.notEqual(a.events.length, b.events.length);
  const c = I.addEvents(b, [{ k: "buy", item: "cheese", amount: 500, order: "ord2" }], "2026-10-12T10:00:00.000Z");
  assert.equal(c.events[2].id, "2026-10-12T10:00:00.000Z#0");
  const removed = I.removeOrder(c, "ord1");
  assert.deepEqual(
    removed.events.map((e) => [e.k, e.order, e.item]),
    [
      ["add", undefined, "ham"],
      ["buy", "ord2", "cheese"],
    ],
  );
  assert.equal(I.removeOrder(null, "x"), null);
  const d = I.addEvents(null, [
    { k: "buy", item: "breast", amount: 100, order: "o1" },
    { k: "buy", item: "breast", amount: 50 },
    { k: "add", item: "ham", amount: 0 },
    { k: "add", item: "ham", amount: 20, at: "not-a-time" },
  ], START);
  assert.equal(d.events.length, 1);
  assert.equal(d.events[0].id, START + "#0");
});

test("prune is a no-op when nothing is older than KEEP_DAYS", () => {
  const base = inv([{ id: "1", at: START, k: "buy", item: "breast", amount: 600, order: "o1" }]);
  assert.equal(I.prune(base, NOW, {}, cat, staplesNone), base);
});

test("prune leaves stock amounts unchanged, including old honey with no set", () => {
  const invStart = iso(new Date(2026, 0, 5, 8, 0, 0));
  const honeyBuy = localMid(2026, 5, 1);
  const oldBreastBuy = localMid(2026, 4, 10);
  const oldMealAte = iso(new Date(2026, 4, 12, 13, 0, 0));
  const recentSet = iso(new Date(2026, 9, 5, 10, 0, 0));
  const recentBuy = iso(new Date(2026, 9, 8, 9, 0, 0));
  const full = {
    v: 1,
    start: invStart,
    events: [
      { id: "h1", at: honeyBuy, k: "buy", item: "honey", amount: 400, order: "o-old" },
      { id: "b1", at: oldBreastBuy, k: "buy", item: "breast", amount: 600, order: "o-old" },
      { id: "d1", at: localMid(2026, 4, 11), k: "buy", item: "dare", amount: 10, order: "o-old" },
      { id: "s1", at: recentSet, k: "set", item: "breast", amount: 300, why: "count" },
      { id: "b2", at: recentBuy, k: "buy", item: "breast", amount: 650, order: "o-new" },
    ],
  };
  const fxDays = new Set(["2026-04-11", "2026-04-12"]);
  const fx = staplesOnDates(fxDays);
  const days = {
    "2026-04-12": { meals: [{ id: "tenderwrap", name: "Wrap", serves: 1, t: "S", ate: oldMealAte }] },
    "2026-10-15": { meals: [{ id: "bowl", name: "Bowl", serves: 1, t: "S", ate: iso(new Date(2026, 9, 15, 12, 0, 0)) }] },
  };
  const pruned = I.prune(full, NOW, days, cat, fx);
  assert.notEqual(pruned, full);
  assert.deepEqual(amounts(I.stock(pruned, days, cat, NOW, fx)), amounts(I.stock(full, days, cat, NOW, fx)));
  assert.ok(pruned.events.some((e) => e.k === "set" && e.item === "honey" && e.why === "count"));
  assert.ok(!pruned.events.some((e) => e.id === "h1"));
  assert.equal(pruned.events[0].k, "set");
});

test("stock from buys and ticked meals; skipped and past auto-eaten meals", () => {
  const base = I.addEvents(null, [{ k: "buy", item: "breast", amount: 600, order: "o1" }], START);
  const ate = iso(new Date(2026, 9, 15, 13, 0, 0));
  const days = {
    "2026-10-15": {
      meals: [
        { id: "tenderwrap", name: "Wrap", serves: 1, t: "S", ate },
        { id: "bowl", name: "Bowl", serves: 1, t: "S", ate: false },
        { id: "toasty", name: "Toasty", serves: 1, t: "S" },
      ],
    },
  };
  const s = I.stock(base, days, cat, NOW, staplesNone);
  assert.equal(s.breast.amount, 400);
  assert.equal(s.cheese, undefined);
  const hamBase = I.addEvents(null, [{ k: "buy", item: "ham", amount: 200, order: "o1" }], START);
  const s2 = I.stock(hamBase, { "2026-10-15": { meals: [{ id: "toasty", name: "T", t: "S" }] } }, cat, NOW, staplesNone);
  assert.equal(s2.ham.amount, 100);
});

test("meals ticked before inventory start are ignored", () => {
  const base = I.addEvents(null, [{ k: "buy", item: "breast", amount: 600, order: "o1" }], START);
  const days = {
    "2026-10-09": {
      meals: [{ id: "tenderwrap", name: "Wrap", serves: 1, t: "S", ate: "2026-10-09T12:00:00.000Z" }],
    },
  };
  assert.equal(I.stock(base, days, cat, NOW, staplesNone).breast.amount, 600);
});

test("FIFO consumes oldest lots first", () => {
  const t1 = iso(new Date(2026, 9, 10, 10, 0, 0));
  const t2 = iso(new Date(2026, 9, 12, 10, 0, 0));
  const base = I.addEvents(null, [
    { k: "buy", item: "breast", amount: 100, order: "o1", at: t1 },
    { k: "buy", item: "breast", amount: 100, order: "o1", at: t2 },
  ], START);
  const ate = iso(new Date(2026, 9, 14, 12, 0, 0));
  const days = { "2026-10-14": { meals: [{ id: "bowl", name: "Bowl", serves: 1, t: "S", ate }] } };
  const s = I.stock(base, days, cat, NOW, staplesNone);
  assert.equal(s.breast.amount, 50);
  assert.deepEqual(s.breast.lots, [{ at: t2, amount: 50 }]);
});

test("set lower, higher, and to zero", () => {
  const t1 = iso(new Date(2026, 9, 10, 10, 0, 0));
  const t2 = iso(new Date(2026, 9, 11, 10, 0, 0));
  let base = I.addEvents(null, [
    { k: "buy", item: "breast", amount: 100, order: "o1", at: t1 },
    { k: "buy", item: "breast", amount: 100, order: "o1", at: t2 },
  ], START);
  base = I.addEvents(base, [{ k: "set", item: "breast", amount: 50, why: "count", at: iso(new Date(2026, 9, 13, 9, 0, 0)) }], START);
  let s = I.stock(base, {}, cat, NOW, staplesNone);
  assert.equal(s.breast.amount, 50);
  assert.deepEqual(s.breast.lots, [{ at: t2, amount: 50 }]);
  base = I.addEvents(base, [{ k: "set", item: "breast", amount: 80, why: "count", at: iso(new Date(2026, 9, 14, 9, 0, 0)) }], START);
  s = I.stock(base, {}, cat, new Date(2026, 9, 14, 10, 0, 0), staplesNone);
  assert.equal(s.breast.amount, 80);
  assert.equal(s.breast.lots.length, 2);
  base = I.addEvents(base, [{ k: "set", item: "breast", amount: 0, why: "used", at: iso(new Date(2026, 9, 15, 9, 0, 0)) }], START);
  assert.equal(Object.keys(I.stock(base, {}, cat, NOW, staplesNone)).length, 0);
});

test("fixtures use one dare and grenade per toggled day from start through today", () => {
  const base = I.addEvents(null, [
    { k: "buy", item: "dare", amount: 5, order: "o1" },
    { k: "buy", item: "grenade", amount: 5, order: "o1" },
  ], START);
  const fxDays = new Set(["2026-10-10", "2026-10-11", "2026-10-13"]);
  const s = I.stock(base, {}, cat, new Date(2026, 9, 13, 12, 0, 0), staplesOnDates(fxDays));
  assert.equal(s.dare.amount, 3);
  assert.equal(s.grenade.amount, 3);
});

test("stock never goes negative", () => {
  const base = I.addEvents(null, [{ k: "buy", item: "breast", amount: 100, order: "o1" }], START);
  const ate = iso(new Date(2026, 9, 12, 12, 0, 0));
  const days = { "2026-10-12": { meals: [{ id: "tenderwrap", name: "W", serves: 1, t: "S", ate }] } };
  assert.equal(I.stock(base, days, cat, NOW, staplesNone).breast, undefined);
});

test("useSoon and off boundaries for keeps 3 and 14", () => {
  const buyBreast = iso(new Date(2026, 9, 10, 8, 0, 0));
  const buyYog = iso(new Date(2026, 9, 5, 8, 0, 0));
  const base = I.addEvents(null, [
    { k: "buy", item: "breast", amount: 500, order: "o1", at: buyBreast },
    { k: "buy", item: "yog", amount: 907, order: "o1", at: buyYog },
  ], START);
  const dayAfterHalf = new Date(2026, 9, 12, 12, 0, 0);
  let s = I.stock(base, {}, cat, dayAfterHalf, staplesNone);
  assert.equal(s.breast.useSoon, true);
  assert.equal(s.breast.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 10, 23, 0, 0), staplesNone);
  assert.equal(s.breast.useSoon, false);
  assert.equal(s.breast.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 14, 12, 0, 0), staplesNone);
  assert.equal(s.breast.off, true);
  s = I.stock(base, {}, cat, new Date(2026, 9, 18, 12, 0, 0), staplesNone);
  assert.equal(s.yog.useSoon, true);
  assert.equal(s.yog.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 19, 12, 0, 0), staplesNone);
  assert.equal(s.yog.useSoon, true);
  assert.equal(s.yog.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 20, 12, 0, 0), staplesNone);
  assert.equal(s.yog.off, true);
  assert.equal(s.rice, undefined);
});

test("reserved is empty without inventory", () => {
  const empty = I.reserved(null, {}, cat, "2026-10-20", [], staplesAlways());
  assert.equal(Object.getPrototypeOf(empty), null);
  assert.equal(Object.keys(empty).length, 0);
  const base = inv([]);
  const r = I.reserved(base, {}, cat, "2026-10-20", ["2026-10-21"], staplesAlways());
  assert.equal(Object.getPrototypeOf(r), null);
});

test("reserved sums fixtures before the first shop day, not auto-eaten past meals", () => {
  const base = inv([]);
  const days = {
    "2026-10-11": { meals: [{ id: "tenderwrap", name: "W", t: "S" }] },
    "2026-10-19": { meals: [{ id: "bowl", name: "B", t: "S", ate: "2026-10-19T12:00:00.000Z" }, { id: "toasty", name: "T", t: "S" }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-18", ["2026-10-21"], staplesOnDates(new Set(["2026-10-19", "2026-10-20"])));
  assert.equal(r.breast, undefined);
  assert.equal(r.ham, 100);
  assert.equal(r.cheese, 30);
  assert.equal(r.dare, 2);
  assert.equal(r.grenade, 2);
});

test("reserved includes bought meals on future days with no shop days", () => {
  const base = inv([]);
  const days = {
    "2026-10-25": { meals: [{ id: "bowl", name: "B", t: "S", bought: "ord1" }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", [], staplesNone);
  assert.equal(r.breast, 150);
  assert.equal(r.rice, 1);
});

test("reserved includes bought meals after the last shop day", () => {
  const base = inv([]);
  const days = {
    "2026-10-23": { meals: [{ id: "bowl", name: "B", t: "S", bought: "ord1" }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", ["2026-10-21"], staplesNone);
  assert.equal(r.breast, 150);
  assert.equal(r.rice, 1);
});

test("reserved skips ticked and skipped bought meals", () => {
  const base = inv([]);
  const days = {
    "2026-10-21": {
      meals: [
        { id: "bowl", name: "B", t: "S", bought: "ord1", ate: "2026-10-21T12:00:00.000Z" },
        { id: "toasty", name: "T", t: "S", bought: "ord1", ate: false },
      ],
    },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", [], staplesNone);
  assert.equal(r.breast, undefined);
  assert.equal(r.ham, undefined);
});

test("reserved does not reserve bought meals on or before inventory start", () => {
  const base = inv([]);
  const days = {
    "2026-10-10": { meals: [{ id: "bowl", name: "B", t: "S", bought: "ord1" }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", [], staplesNone);
  assert.equal(r.breast, undefined);
});

test("reserved does not reserve held shop-false meals", () => {
  const base = inv([]);
  const days = {
    "2026-10-22": { meals: [{ id: "toasty", name: "T", t: "S", shop: false, held: true }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", ["2026-10-21"], staplesNone);
  assert.equal(r.ham, undefined);
  assert.equal(r.cheese, undefined);
});

test("reserved includes shop-false meals from today on when day is off the cart", () => {
  const base = inv([]);
  const days = {
    "2026-10-22": { meals: [{ id: "toasty", name: "T", t: "S", shop: false }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", ["2026-10-21"], staplesNone);
  assert.equal(r.ham, 100);
  assert.equal(r.cheese, 30);
});

test("reserved treats bought shop-day meals like shop false", () => {
  const base = inv([]);
  const days = {
    "2026-10-21": {
      meals: [
        { id: "bowl", name: "B", t: "S", bought: "ord1" },
        { id: "toasty", name: "T", t: "S" },
      ],
    },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", ["2026-10-21"], staplesNone);
  assert.equal(r.breast, 150);
  assert.equal(r.rice, 1);
  assert.equal(r.ham, undefined);
});

test("reserved skips ticked, skipped, pre-start and shop-day meals except shop false", () => {
  const base = inv([]);
  const days = {
    "2026-10-09": { meals: [{ id: "toasty", name: "T", t: "S" }] },
    "2026-10-12": { meals: [{ id: "bowl", name: "B", t: "S", ate: false }, { id: "tenderwrap", name: "W", t: "S" }] },
    "2026-10-21": {
      meals: [
        { id: "toasty", name: "T", t: "S" },
        { id: "bowl", name: "B", t: "S", shop: false },
      ],
    },
    "2026-10-22": { meals: [{ id: "toasty", name: "T", t: "S", shop: false }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-22", ["2026-10-21", "2026-10-22"], staplesNone);
  assert.equal(r.breast, undefined);
  assert.equal(r.ham, 100);
  assert.equal(r.cheese, 30);
  assert.equal(r.rice, undefined);
});

test("reserved with no shop days skips auto-eaten past meals", () => {
  const base = inv([]);
  const days = { "2026-10-15": { meals: [{ id: "bowl", name: "B", t: "S" }] } };
  const r = I.reserved(base, days, cat, "2026-10-20", [], staplesAlways());
  assert.equal(r.breast, undefined);
  assert.equal(r.rice, undefined);
  assert.equal(r.dare, undefined);
});

test("reserved excludes meals on the start date and on today without shop days", () => {
  const base = inv([]);
  const days = {
    "2026-10-10": { meals: [{ id: "bowl", name: "B", t: "S" }] },
    "2026-10-20": { meals: [{ id: "toasty", name: "T", t: "S" }] },
  };
  const r = I.reserved(base, days, cat, "2026-10-20", [], staplesAlways());
  assert.equal(r.breast, undefined);
  assert.equal(r.ham, undefined);
});

test("reserved after a stale first shop day skips auto-eaten past meals", () => {
  const base = inv([]);
  const days = { "2026-10-15": { meals: [{ id: "bowl", name: "B", t: "S" }] } };
  const r = I.reserved(base, days, cat, "2026-10-20", ["2026-10-10"], staplesNone);
  assert.equal(r.breast, undefined);
  assert.equal(r.rice, undefined);
});

test("reserved staples honour per-day list and skip today and first shop day", () => {
  const base = inv([]);
  const r = I.reserved(base, {}, cat, "2026-10-19", ["2026-10-21"], (d) => (d === "2026-10-20" ? [{ id: "dare", amount: 1 }] : []));
  assert.equal(r.dare, 1);
  assert.equal(r.grenade, undefined);
  const grenadeOnly = I.reserved(base, {}, cat, "2026-10-19", ["2026-10-21"], (d) => (d === "2026-10-20" ? [{ id: "grenade", amount: 1 }] : []));
  assert.equal(grenadeOnly.grenade, 1);
  assert.equal(grenadeOnly.dare, undefined);
  const onFirst = I.reserved(base, {}, cat, "2026-10-20", ["2026-10-21"], staplesAlways());
  assert.equal(onFirst.dare, undefined);
});

test("reserved staple loop stops at today plus 366 days before a far first shop day", () => {
  const base = inv([]);
  const r = I.reserved(base, {}, cat, "2026-10-20", ["2028-06-01"], staplesAlways([{ id: "dare", amount: 1 }]));
  assert.equal(r.dare, 366);
  assert.equal(r.grenade, undefined);
});

test("stock consumes staple amounts greater than one and non-fixture staples", () => {
  const base = I.addEvents(null, [
    { k: "buy", item: "dare", amount: 10, order: "o1" },
    { k: "buy", item: "yog", amount: 500, order: "o1" },
  ], START);
  const s = I.stock(
    base,
    {},
    cat,
    new Date(2026, 9, 11, 23, 0, 0),
    staplesOnDates(new Set(["2026-10-10", "2026-10-11"]), [{ id: "dare", amount: 2 }, { id: "yog", amount: 170 }]),
  );
  assert.equal(s.dare.amount, 8);
  assert.equal(s.yog.amount, 330);
});

test("reserved skips past meals between shop days once auto-eaten", () => {
  const base = inv([]);
  const days = { "2026-10-22": { meals: [{ id: "bowl", name: "B", t: "S" }] } };
  const r = I.reserved(base, days, cat, "2026-10-24", ["2026-10-25", "2026-10-21"], staplesNone);
  assert.equal(r.breast, undefined);
  assert.equal(r.rice, undefined);
});

test("reserved uses the earliest shop day when shopDays is unsorted", () => {
  const base = inv([]);
  const days = { "2026-10-20": { meals: [{ id: "bowl", name: "B", t: "S" }] } };
  const sorted = I.reserved(base, days, cat, "2026-10-23", ["2026-10-21", "2026-10-25"], staplesNone);
  const unsorted = I.reserved(base, days, cat, "2026-10-23", ["2026-10-25", "2026-10-21"], staplesNone);
  assert.equal(sorted.breast, unsorted.breast);
  assert.equal(sorted.breast, undefined);
});

test("freeForShop drops perishable lots that will be off by the first shop day", () => {
  const buyAt = localMid(2026, 9, 4);
  const base = inv([{ id: "a", at: buyAt, k: "buy", item: "breast", amount: 600, order: "o1" }]);
  const stMap = I.stock(base, {}, cat, new Date(2026, 9, 4, 12, 0, 0), staplesNone);
  assert.equal(I.freeForShop(stMap, {}, cat, "2026-10-13").breast, undefined);
  assert.equal(I.freeForShop(stMap, {}, cat, "2026-10-06").breast, 600);
});

test("freeForShop consumes reserved stock from oldest lots first", () => {
  const base = inv([
    { id: "a", at: localMid(2026, 9, 1), k: "buy", item: "breast", amount: 500, order: "o1" },
    { id: "b", at: localMid(2026, 9, 10), k: "buy", item: "breast", amount: 500, order: "o2" },
  ]);
  const stMap = I.stock(base, {}, cat, new Date(2026, 9, 11, 12, 0, 0), staplesNone);
  assert.equal(I.freeForShop(stMap, { breast: 600 }, cat, "2026-10-12").breast, 400);
});

test("freeForShop leaves items without keeps on plain free maths", () => {
  const base = inv([{ id: "a", at: START, k: "buy", item: "rice", amount: 2, order: "o1" }]);
  const stMap = I.stock(base, {}, cat, NOW, staplesNone);
  assert.equal(I.freeForShop(stMap, { rice: 1 }, cat, "2026-10-25").rice, 1);
});

test("reserved includes unticked meals on non-shop days between shop days", () => {
  const base = inv([]);
  const days = { "2026-10-23": { meals: [{ id: "bowl", name: "B", t: "S" }] } };
  const r = I.reserved(base, days, cat, "2026-10-20", ["2026-10-25", "2026-10-21"], staplesNone);
  assert.equal(r.breast, 150);
  assert.equal(r.rice, 1);
});

test("free subtracts reserved stock and drops zero items", () => {
  const stock = Object.assign(Object.create(null), {
    breast: { amount: 600, lots: [] },
    rice: { amount: 1, lots: [] },
  });
  assert.equal(Object.getPrototypeOf(I.free(stock, { breast: 200 })), null);
  assert.equal(I.free(stock, { breast: 200, rice: 1 }).breast, 400);
  assert.equal(I.free(stock, { breast: 800 }).breast, undefined);
  assert.equal(I.free(stock, { breast: 800 }).rice, 1);
  assert.equal(I.free(stock, null).breast, 600);
  assert.equal(I.free(stock, null).rice, 1);
  assert.equal(I.free(stock, { breast: -50 }).breast, 600);
});

test("pending is always empty (auto-eaten replaces the pending list)", () => {
  assert.deepEqual(I.pending(null, {}, "2026-10-20"), []);
  const base = inv([]);
  const days = {
    "2026-10-09": { meals: [{ id: "toasty", name: "T" }] },
    "2026-10-10": { meals: [{ id: "toasty", name: "T" }, { id: "bowl", name: "B", ate: false }] },
    "2026-10-11": { meals: [{ id: "tenderwrap", name: "W" }] },
    "2026-10-20": { meals: [{ id: "bowl", name: "B2" }] },
  };
  assert.deepEqual(I.pending(base, days, "2026-10-20"), []);
});

test("impliedAte and auto-eaten stock consumption", () => {
  const today = "2026-10-20";
  assert.equal(I.impliedAte({ ate: "2026-10-15T12:00:00.000Z" }, "2026-10-15", today), "2026-10-15T12:00:00.000Z");
  assert.equal(I.impliedAte({ ate: false }, "2026-10-15", today), null);
  const implied = I.impliedAte({}, "2026-10-15", today);
  assert.equal(implied, I.endOfDay("2026-10-15"));
  assert.equal(I.impliedAte({}, "2026-10-20", today), null);
  assert.equal(I.impliedAte({}, "2026-10-22", today), null);
  const base = I.addEvents(null, [{ k: "buy", item: "breast", amount: 600, order: "o1" }], START);
  const pastDay = "2026-10-18";
  const sPast = I.stock(base, { [pastDay]: { meals: [{ id: "tenderwrap", name: "W", t: "S" }] } }, cat, NOW, staplesNone);
  assert.equal(sPast.breast.amount, 400);
  const sToday = I.stock(base, { [today]: { meals: [{ id: "tenderwrap", name: "W", t: "S" }] } }, cat, NOW, staplesNone);
  assert.equal(sToday.breast.amount, 600);
  const r = I.reserved(base, { [pastDay]: { meals: [{ id: "tenderwrap", name: "W", t: "S" }] } }, cat, today, [], staplesNone);
  assert.equal(r.breast, undefined);
});

test("shopHaveIt prefers trolley haveIt, then the sent record", () => {
  assert.deepEqual(I.shopHaveIt({ haveIt: { rice: true } }, { haveIt: { ham: true } }), { rice: true });
  assert.deepEqual(I.shopHaveIt(null, { haveIt: { ham: true } }), { ham: true });
  assert.deepEqual(I.shopHaveIt({}, null), {});
});

test("buysFromRows handles deli, packs, missed store, ticks and haveIt", () => {
  const deli = { id: "ham", woolies: { product: { perKg: true, size: 1 }, quantity: 0.25, cost: 7, buy: "250g" }, coles: null };
  const pack = { id: "cheese", woolies: { product: { size: 500 }, quantity: 2, cost: 18, buy: "2 packs" }, coles: { product: { size: 500 }, quantity: 2, cost: 14, buy: "2 packs" } };
  const missed = { id: "breast", woolies: null, coles: { product: { size: 600 }, quantity: 1, cost: 8, buy: "1 pack" } };
  const none = { id: "rice", woolies: null, coles: null };
  const rows = [deli, pack, missed, none];
  assert.deepEqual(I.buysFromRows(rows, "woolies", {}, {}), [
    { item: "ham", amount: 250 },
    { item: "cheese", amount: 1000 },
    { item: "breast", amount: 600 },
  ]);
  assert.deepEqual(I.buysFromRows(rows, "coles", { cheese: true }, { ham: true }), [{ item: "breast", amount: 600 }]);
});

test("buysFromRows matches Past orders pantry and sent lines", () => {
  const pantry = {
    id: "honey",
    sec: 2,
    woolies: { product: { stockcode: 753976, size: 375 }, quantity: 1, cost: 5, buy: "1 jar" },
    coles: { product: { url: "https://www.coles.com.au/product/honey-1", size: 400 }, quantity: 1, cost: 4, buy: "1 jar" },
  };
  assert.deepEqual(I.buysFromRows([pantry], "woolies", {}, {}, { sent: {}, colesSent: {}, colesId: catalogueColesId }), []);
  assert.deepEqual(I.buysFromRows([pantry], "woolies", {}, {}, { sent: { 753976: 2 }, colesSent: {}, colesId: catalogueColesId }), [{ item: "honey", amount: 750 }]);
  assert.deepEqual(I.buysFromRows([pantry], "woolies", {}, { honey: true }, { sent: { 753976: 1 }, colesSent: {}, colesId: catalogueColesId }), [{ item: "honey", amount: 375 }]);
});

test("buysFromRows stocks colesUnavailable from colesSent", () => {
  const gone = {
    id: "yog",
    coles: null,
    colesUnavailable: { url: "https://www.coles.com.au/product/yog-1234567", size: 907, name: "Yog" },
    woolies: { product: { stockcode: 717518, size: 907 }, quantity: 1, cost: 8, buy: "1 tub" },
  };
  assert.deepEqual(I.buysFromRows([gone], "coles", {}, {}, { sent: {}, colesSent: { 1234567: 2 }, colesId: catalogueColesId }), [{ item: "yog", amount: 1814 }]);
  assert.deepEqual(I.buysFromRows([gone], "coles", { yog: true }, {}, { sent: {}, colesSent: { 1234567: 1 }, colesId: catalogueColesId }), [{ item: "yog", amount: 907 }]);
});

test("prune matches stock with post-cutoff buys and meal ticks (amounts and flags)", () => {
  const invStart = iso(new Date(2026, 0, 5, 8, 0, 0));
  const oldBuy = localMid(2026, 4, 1);
  const postBuy = iso(new Date(2026, 9, 12, 14, 0, 0));
  const postMeal = iso(new Date(2026, 9, 14, 13, 0, 0));
  const full = {
    v: 1,
    start: invStart,
    events: [
      { id: "o1", at: oldBuy, k: "buy", item: "breast", amount: 800, order: "old" },
      { id: "o2", at: oldBuy, k: "buy", item: "yog", amount: 907, order: "old" },
      { id: "n1", at: postBuy, k: "buy", item: "breast", amount: 200, order: "new" },
    ],
  };
  const days = { "2026-10-14": { meals: [{ id: "tenderwrap", name: "W", serves: 1, t: "S", ate: postMeal }] } };
  const pruned = I.prune(full, NOW, days, cat, staplesNone);
  assert.deepEqual(stockFlags(I.stock(pruned, days, cat, NOW, staplesNone)), stockFlags(I.stock(full, days, cat, NOW, staplesNone)));
});

test("prune matches stock across many random histories", () => {
  const invStart = iso(new Date(2026, 0, 1, 8, 0, 0));
  const rand = mulberry32(42);
  const now = new Date(2026, 9, 25, 15, 0, 0);
  for (let i = 0; i < 200; i++) {
    const events = [];
    let t = new Date(2026, 0, 2 + (i % 40), 8, 0, 0);
    for (let j = 0; j < 8; j++) {
      t = new Date(t.getTime() + Math.floor(rand() * 5) * 86400000 + Math.floor(rand() * 8) * 3600000);
      const item = ["breast", "ham", "yog", "honey"][Math.floor(rand() * 4)];
      if (rand() < 0.7) {
        events.push({ id: "e" + j, at: iso(t), k: "buy", item, amount: 100 + Math.floor(rand() * 400), order: "o" + i });
      } else {
        events.push({ id: "e" + j, at: iso(t), k: "set", item, amount: Math.floor(rand() * 300), why: "count" });
      }
    }
    const full = { v: 1, start: invStart, events };
    const days = {};
    if (rand() > 0.5) {
      days["2026-10-16"] = { meals: [{ id: "tenderwrap", name: "W", serves: 1, t: "S", ate: iso(new Date(2026, 9, 16, 12, 0, 0)) }] };
    }
    const pruned = I.prune(full, now, days, cat, staplesNone);
    assert.deepEqual(amounts(I.stock(pruned, days, cat, now, staplesNone)), amounts(I.stock(full, days, cat, now, staplesNone)));
  }
});

test("prune does not double-deduct the cutoff-day fixture", () => {
  const when = new Date(2026, 9, 20, 12, 0, 0);
  const cutoff = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  cutoff.setDate(cutoff.getDate() - I.KEEP_DAYS);
  const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const invStart = iso(new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate() - 5, 8, 0, 0));
  const oldBuy = iso(new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate() - 3, 10, 0, 0));
  const full = {
    v: 1,
    start: invStart,
    events: [{ id: "d1", at: oldBuy, k: "buy", item: "dare", amount: 10, order: "o1" }],
  };
  const fx = (d) => (d === cutoffDate ? [{ id: "dare", amount: 1 }] : []);
  const pruned = I.prune(full, when, {}, cat, fx);
  assert.equal(I.stock(full, {}, cat, when, fx).dare.amount, I.stock(pruned, {}, cat, when, fx).dare.amount);
});

test("a set higher than stock dates its lot at the set time for FIFO and flags", () => {
  const t1 = iso(new Date(2026, 8, 1, 10, 0, 0));
  const tSet = iso(new Date(2026, 8, 10, 11, 0, 0));
  const tBuy = iso(new Date(2026, 8, 20, 11, 0, 0));
  const base = {
    v: 1,
    start: t1,
    events: [
      { id: "1", at: t1, k: "buy", item: "yog", amount: 100, order: "o1" },
      { id: "2", at: tSet, k: "set", item: "yog", amount: 150, why: "count" },
      { id: "3", at: tBuy, k: "buy", item: "yog", amount: 50, order: "o2" },
    ],
  };
  const yogCat = create(ITEMS, { ...AMOUNTS, yogsnack: { yog: 120 } });
  const ate = iso(new Date(2026, 8, 25, 12, 0, 0));
  const days = { "2026-09-25": { meals: [{ id: "yogsnack", name: "Y", serves: 1, t: "S", ate }] } };
  const s = I.stock(base, days, yogCat, new Date(2026, 8, 25, 14, 0, 0), staplesNone);
  assert.equal(s.yog.amount, 80);
  assert.deepEqual(s.yog.lots.map((l) => [l.at, l.amount]), [[tSet, 30], [tBuy, 50]]);
  const flags = I.stock(base, {}, cat, new Date(2026, 8, 14, 12, 0, 0), staplesNone);
  assert.equal(flags.yog.useSoon, true);
  assert.equal(flags.yog.off, false);
});

test("ageDays uses whole calendar days across DST in Sydney (CI subprocess)", () => {
  const script = `
    const { create } = require(${JSON.stringify(path.join(ASSETS, "catalogue.js"))});
    const I = require(${JSON.stringify(path.join(ASSETS, "inventory.js"))});
    const W = "https://www.woolworths.com.au/shop/productdetails/";
    const C = "https://www.coles.com.au/product/";
    const cat = create(
      [{
        id: "yog", sec: 1, keeps: 14, name: "Yoghurt", unit: "g", note: "", same: true,
        coles: { name: "Yog", url: C + "yog-1", size: 907, price: 8, checked: "2026-10-15" },
        woolies: { name: "Yog", url: W + "717518", stockcode: 717518, size: 907, price: 8, checked: "2026-10-15" },
      }],
      {},
    );
    const buy = new Date(2027, 2, 25, 10, 0, 0).toISOString();
    const base = { v: 1, start: buy, events: [{ id: "1", at: buy, k: "buy", item: "yog", amount: 907, order: "o1" }] };
    const s = I.stock(base, {}, cat, new Date(2027, 3, 8, 12, 0, 0), () => []);
    process.stdout.write(JSON.stringify({ off: s.yog.off, useSoon: s.yog.useSoon }));
  `;
  const out = execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: "Australia/Sydney" },
    encoding: "utf8",
  });
  assert.deepEqual(JSON.parse(out), { off: false, useSoon: true });
});

test("invalid now or start returns {} without hanging", () => {
  const base = inv([{ id: "1", at: START, k: "buy", item: "breast", amount: 100, order: "o1" }]);
  assert.deepEqual(I.stock(base, {}, cat, "not-a-date", staplesNone), {});
  assert.deepEqual(I.stock({ v: 1, start: "nope", events: [] }, {}, cat, NOW, staplesNone), {});
});

test("at the same instant a set runs before a buy", () => {
  const at = iso(new Date(2026, 9, 15, 12, 0, 0));
  const base = {
    v: 1,
    start: START,
    events: [
      { id: "1", at, k: "buy", item: "breast", amount: 100, order: "o1" },
      { id: "2", at, k: "set", item: "breast", amount: 50, why: "count" },
    ],
  };
  assert.equal(I.stock(base, {}, cat, NOW, staplesNone).breast.amount, 150);
});

test("mixed-offset set and buy at the same instant order by time, not string", () => {
  const prior = iso(new Date(2026, 9, 10, 8, 0, 0));
  const setAt = "2026-10-15T22:00:00.000+11:00";
  const buyAt = "2026-10-15T11:00:00.000Z";
  assert.equal(Date.parse(setAt), Date.parse(buyAt));
  assert.ok(setAt > buyAt);
  const base = {
    v: 1,
    start: START,
    events: [
      { id: "0", at: prior, k: "buy", item: "breast", amount: 100, order: "o0" },
      { id: "2", at: buyAt, k: "buy", item: "breast", amount: 25, order: "o1" },
      { id: "1", at: setAt, k: "set", item: "breast", amount: 50, why: "count" },
    ],
  };
  assert.equal(I.stock(base, {}, cat, NOW, staplesNone).breast.amount, 75);
});

test("events order by instant, not string", () => {
  const early = "2026-10-15T20:00:00.000+10:00";
  const late = "2026-10-15T12:00:00.000Z";
  assert.ok(Date.parse(early) < Date.parse(late));
  assert.ok(early > late);
  const base = {
    v: 1,
    start: START,
    events: [
      { id: "2", at: late, k: "buy", item: "breast", amount: 100, order: "o1" },
      { id: "1", at: early, k: "buy", item: "breast", amount: 50, order: "o1" },
    ],
  };
  const s = I.stock(base, {}, cat, NOW, staplesNone);
  assert.deepEqual(s.breast.lots, [
    { at: early, amount: 50 },
    { at: late, amount: 100 },
  ]);
});

test("meal tiers L, S, X and unknown tier fall back to S", () => {
  const base = I.addEvents(null, [{ k: "buy", item: "cheese", amount: 500, order: "o1" }], START);
  const ate = iso(new Date(2026, 9, 12, 12, 0, 0));
  const mk = (t) => ({ id: "toasty", name: "T", serves: 1, t, ate });
  assert.equal(I.stock(base, { "2026-10-12": { meals: [mk("L")] } }, cat, NOW, staplesNone).cheese.amount, 490);
  assert.equal(I.stock(base, { "2026-10-12": { meals: [mk("S")] } }, cat, NOW, staplesNone).cheese.amount, 470);
  assert.equal(I.stock(base, { "2026-10-12": { meals: [mk("X")] } }, cat, NOW, staplesNone).cheese.amount, 450);
  assert.equal(I.stock(base, { "2026-10-12": { meals: [mk("Z")] } }, cat, NOW, staplesNone).cheese.amount, 470);
});

test("unknown meals and catalogue gaps do not crash", () => {
  const base = I.addEvents(null, [{ k: "buy", item: "breast", amount: 100, order: "o1" }], START);
  const ate = iso(new Date(2026, 9, 12, 12, 0, 0));
  const days = {
    "2026-10-12": {
      meals: [
        { id: "missing", name: "?", serves: 1, t: "S", ate },
        { id: "bowl", name: "B", serves: 1, t: "S", ate },
      ],
    },
  };
  const weird = create(ITEMS, { ...AMOUNTS, ghost: { notInCat: 5 } });
  assert.equal(I.stock(base, days, weird, NOW, staplesNone).breast, undefined);
  const p = I.addEvents(null, [{ k: "buy", item: "__proto__", amount: 9, order: "o1" }], START);
  const protoStock = I.stock(p, {}, { AMOUNTS: {}, item: () => null, amountFor: () => 0 }, NOW, staplesNone);
  assert.equal(Object.getOwnPropertyDescriptor(protoStock, "__proto__").value.amount, 9);
});

test("useSoon and off follow the oldest lot", () => {
  const old = iso(new Date(2026, 8, 1, 8, 0, 0));
  const fresh = iso(new Date(2026, 9, 19, 8, 0, 0));
  const base = {
    v: 1,
    start: old,
    events: [
      { id: "1", at: old, k: "buy", item: "yog", amount: 100, order: "o1" },
      { id: "2", at: fresh, k: "buy", item: "yog", amount: 100, order: "o2" },
    ],
  };
  const s = I.stock(base, {}, cat, NOW, staplesNone);
  assert.equal(s.yog.off, true);
  assert.equal(s.yog.useSoon, true);
});

test("meals before start are ignored even with pre-start buys in the log", () => {
  const start = iso(new Date(2026, 9, 10, 8, 0, 0));
  const pre = iso(new Date(2026, 9, 5, 10, 0, 0));
  const base = {
    v: 1,
    start,
    events: [{ id: "1", at: pre, k: "buy", item: "breast", amount: 600, order: "o1" }],
  };
  const days = {
    "2026-10-09": { meals: [{ id: "tenderwrap", name: "W", serves: 1, t: "S", ate: iso(new Date(2026, 9, 9, 12, 0, 0)) }] },
    "2026-10-15": { meals: [{ id: "tenderwrap", name: "W", serves: 1, t: "S", ate: iso(new Date(2026, 9, 15, 12, 0, 0)) }] },
  };
  assert.equal(I.stock(base, days, cat, NOW, staplesNone).breast.amount, 400);
});

test("prune keeps an event exactly at the cutoff and drops one millisecond before", () => {
  const when = new Date(2026, 9, 20, 12, 0, 0);
  const cutoff = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  cutoff.setDate(cutoff.getDate() - I.KEEP_DAYS);
  const atCutoff = cutoff.toISOString();
  const before = new Date(cutoff.getTime() - 1).toISOString();
  const full = {
    v: 1,
    start: iso(new Date(2026, 0, 1, 8, 0, 0)),
    events: [
      { id: "old", at: before, k: "buy", item: "honey", amount: 400, order: "o1" },
      { id: "edge", at: atCutoff, k: "buy", item: "breast", amount: 100, order: "o2" },
    ],
  };
  const pruned = I.prune(full, when, {}, cat, staplesNone);
  assert.ok(!pruned.events.some((e) => e.id === "old"));
  assert.ok(pruned.events.some((e) => e.id === "edge"));
  assert.ok(pruned.events.some((e) => e.k === "set" && e.item === "honey"));
});
