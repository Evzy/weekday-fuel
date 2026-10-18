const { test } = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../../main/assets/weekday_fuel/catalogue.js");
const I = require("../../main/assets/weekday_fuel/inventory.js");

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
];
const AMOUNTS = {
  toasty: { ham: 100, cheese: 30 },
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
});

test("prune drops old events but keeps the latest set and newer buys per item", () => {
  const old = localMid(2026, 4, 1);
  const events = [
    { id: "1", at: old, k: "buy", item: "breast", amount: 600, order: "o-old" },
    { id: "2", at: old, k: "set", item: "breast", amount: 400, why: "count" },
    { id: "3", at: START, k: "buy", item: "breast", amount: 200, order: "o-new" },
    { id: "4", at: START, k: "set", item: "breast", amount: 500, why: "count" },
    { id: "5", at: old, k: "add", item: "ham", amount: 100 },
  ];
  const pruned = I.prune(inv(events), new Date(2026, 9, 20));
  const ids = pruned.events.map((e) => e.id).sort();
  assert.deepEqual(ids, ["3", "4"]);
});

test("stock from buys and ticked meals; skipped and unanswered meals do not use stock", () => {
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
  const s = I.stock(base, days, cat, NOW, () => false);
  assert.equal(s.breast.amount, 400);
  assert.equal(s.cheese, undefined);
});

test("meals ticked before inventory start are ignored", () => {
  const base = I.addEvents(null, [{ k: "buy", item: "breast", amount: 600, order: "o1" }], START);
  const days = {
    "2026-10-09": {
      meals: [{ id: "tenderwrap", name: "Wrap", serves: 1, t: "S", ate: "2026-10-09T12:00:00.000Z" }],
    },
  };
  assert.equal(I.stock(base, days, cat, NOW, () => false).breast.amount, 600);
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
  const s = I.stock(base, days, cat, NOW, () => false);
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
  let s = I.stock(base, {}, cat, NOW, () => false);
  assert.equal(s.breast.amount, 50);
  assert.deepEqual(s.breast.lots, [{ at: t2, amount: 50 }]);
  base = I.addEvents(base, [{ k: "set", item: "breast", amount: 80, why: "count", at: iso(new Date(2026, 9, 14, 9, 0, 0)) }], START);
  s = I.stock(base, {}, cat, new Date(2026, 9, 14, 10, 0, 0), () => false);
  assert.equal(s.breast.amount, 80);
  assert.equal(s.breast.lots.length, 2);
  base = I.addEvents(base, [{ k: "set", item: "breast", amount: 0, why: "used", at: iso(new Date(2026, 9, 15, 9, 0, 0)) }], START);
  assert.deepEqual(I.stock(base, {}, cat, NOW, () => false), {});
});

test("fixtures use one dare and grenade per toggled day from start through today", () => {
  const base = I.addEvents(null, [
    { k: "buy", item: "dare", amount: 5, order: "o1" },
    { k: "buy", item: "grenade", amount: 5, order: "o1" },
  ], START);
  const fxDays = new Set(["2026-10-10", "2026-10-11", "2026-10-13"]);
  const s = I.stock(base, {}, cat, new Date(2026, 9, 13, 12, 0, 0), (d, k) => fxDays.has(d) && (k === "dare" || k === "grenade"));
  assert.equal(s.dare.amount, 3);
  assert.equal(s.grenade.amount, 3);
});

test("stock never goes negative", () => {
  const base = I.addEvents(null, [{ k: "buy", item: "breast", amount: 100, order: "o1" }], START);
  const ate = iso(new Date(2026, 9, 12, 12, 0, 0));
  const days = { "2026-10-12": { meals: [{ id: "tenderwrap", name: "W", serves: 1, t: "S", ate }] } };
  assert.equal(I.stock(base, days, cat, NOW, () => false).breast, undefined);
});

test("useSoon and off boundaries for keeps 3 and 14", () => {
  const buyBreast = iso(new Date(2026, 9, 10, 8, 0, 0));
  const buyYog = iso(new Date(2026, 9, 5, 8, 0, 0));
  const base = I.addEvents(null, [
    { k: "buy", item: "breast", amount: 500, order: "o1", at: buyBreast },
    { k: "buy", item: "yog", amount: 907, order: "o1", at: buyYog },
  ], START);
  const dayAfterHalf = new Date(2026, 9, 12, 12, 0, 0);
  let s = I.stock(base, {}, cat, dayAfterHalf, () => false);
  assert.equal(s.breast.useSoon, true);
  assert.equal(s.breast.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 10, 23, 0, 0), () => false);
  assert.equal(s.breast.useSoon, false);
  assert.equal(s.breast.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 14, 12, 0, 0), () => false);
  assert.equal(s.breast.off, true);
  s = I.stock(base, {}, cat, new Date(2026, 9, 18, 12, 0, 0), () => false);
  assert.equal(s.yog.useSoon, true);
  assert.equal(s.yog.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 19, 12, 0, 0), () => false);
  assert.equal(s.yog.useSoon, true);
  assert.equal(s.yog.off, false);
  s = I.stock(base, {}, cat, new Date(2026, 9, 20, 12, 0, 0), () => false);
  assert.equal(s.yog.off, true);
  assert.equal(s.rice, undefined);
});

test("pending lists unanswered past meals since start", () => {
  assert.deepEqual(I.pending(null, {}, "2026-10-20"), []);
  const base = inv([]);
  const days = {
    "2026-10-09": { meals: [{ id: "toasty", name: "T" }] },
    "2026-10-10": { meals: [{ id: "toasty", name: "T" }, { id: "bowl", name: "B", ate: false }] },
    "2026-10-11": { meals: [{ id: "tenderwrap", name: "W" }] },
    "2026-10-20": { meals: [{ id: "bowl", name: "B2" }] },
  };
  assert.deepEqual(I.pending(base, days, "2026-10-20"), [
    { date: "2026-10-10", i: 0, id: "toasty" },
    { date: "2026-10-11", i: 0, id: "tenderwrap" },
  ]);
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
