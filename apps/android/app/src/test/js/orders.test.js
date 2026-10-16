process.env.TZ = "Australia/Melbourne";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const O = require("../../main/assets/weekday_fuel/orders.js");

const P = (stockcode, name, price, extra = {}) => ({ stockcode, name, price, ...extra });
const LINE = (product, quantity, cost, buy) => ({ product, quantity, cost, buy });
const ROW = (id, sec, woolies, coles, extra = {}) => ({ id, sec, name: id, unit: "g", need: 1, used: ["toasty"], days: [], woolies, coles, wooliesUnavailable: null, ...extra });

const bread = ROW("bread", 1, LINE(P(100, "Wholemeal bread", 4), 1, 4, "1 loaf"), LINE({ name: "Coles bread", price: 3.5 }, 1, 3.5, "1 loaf"));
const ham = ROW("ham", 1, LINE(P(175734, "Deli ham", 28, { perKg: true }), 0.2, 5.6, "200g from the deli"), null);
const milk = ROW("milk", 1, LINE(P(200, "Milk 2L", 3.1), 1, 3.1, "1 bottle"), LINE({ name: "Coles milk", price: 3 }, 1, 3, "1 bottle"));
const rice = ROW("rice", 2, LINE(P(300, "Rice 1kg", 2.5), 1, 2.5, "1 bag"), null);
const breast = ROW("breast", 1, null, LINE({ name: "Coles chicken breast", price: 12 }, 1, 12, "1 pack"));
const evap = ROW("evap", 1, null, null, { name: "Evaporated milk" });
const yog = ROW("yog", 1, null, LINE({ name: "Coles yoghurt", price: 5 }, 1, 5, "1 tub"), { wooliesUnavailable: P(400, "Chobani 907g", 6) });

const OPTS = {
  at: "2026-10-15T07:30:00.000Z",
  store: "woolies",
  days: ["2026-10-20"],
  meals: [{ name: "Toasty", serves: 2 }],
  delivery: "Tue 20 Oct, 7am - 10am",
  wooliesTotal: 145.43,
  forText: (r) => "For " + r.used.join(", "),
  product: (code) => (code === 999 ? { name: "Old cheese", price: 5 } : null),
};
const item = (name, buy, cost, store, note = null, f = "For toasty") => ({ name, buy, cost, store, note, for: f });

test("sent products are ordered, ticked items already had, unsent pantry presumed at home, the rest to buy yourself", () => {
  const o = O.snapshot([bread, ham, milk, rice, breast, evap], { milk: true }, { 100: 1, 175734: 0.2 }, OPTS);
  assert.deepEqual(
    { v: o.v, id: o.id, at: o.at, store: o.store, days: o.days, meals: o.meals, delivery: o.delivery, wooliesTotal: o.wooliesTotal },
    { v: 1, id: OPTS.at, at: OPTS.at, store: "woolies", days: ["2026-10-20"], meals: [{ name: "Toasty", serves: 2 }], delivery: "Tue 20 Oct, 7am - 10am", wooliesTotal: 145.43 },
  );
  assert.deepEqual(o.groups, {
    ordered: [item("Wholemeal bread", "1 loaf", 4, "woolies"), item("Deli ham", "200g from the deli", 5.6, "woolies")],
    had: [item("Milk 2L", "1 bottle", 3.1, "woolies")],
    pantry: [item("Rice 1kg", "1 bag", 2.5, "woolies")],
    buy: [item("Coles chicken breast", "1 pack", 12, "coles"), item("Evaporated milk", "", null, null, "no online store")],
  });
});

test("a ticked item that was sent counts as ordered, and a different sent amount is described from the product", () => {
  const o = O.snapshot([bread, ham, milk], { bread: true }, { 100: 2, 175734: 0.3, 200: 0 }, OPTS);
  assert.deepEqual(o.groups.ordered, [item("Wholemeal bread", "2 packs", 8, "woolies"), item("Deli ham", "300g", 8.4, "woolies")]);
  assert.deepEqual(o.groups.had, []);
  assert.deepEqual(o.groups.buy, [item("Milk 2L", "1 bottle", 3.1, "woolies")]);
});

test("a sent product the shop no longer uses is still ordered, and an unavailable one is noted", () => {
  const o = O.snapshot([yog], {}, { 999: 1, 400: 1, 555: 2 }, OPTS);
  assert.deepEqual(o.groups.ordered, [
    item("Chobani 907g", "1 pack", 6, "woolies", "was unavailable online"),
    item("Product 555", "2", null, "woolies", "not in this shop", ""),
    item("Old cheese", "1 pack", 5, "woolies", "not in this shop", ""),
  ]);
  const unsent = O.snapshot([yog], {}, {}, OPTS);
  assert.deepEqual(unsent.groups.buy, [item("Coles yoghurt", "1 tub", 5, "coles", "unavailable online at Woolworths")]);
});

test("a Coles shop buys everything at Coles unless it was sent, and odd options are cleaned", () => {
  const o = O.snapshot([bread, ham, breast, rice, null], {}, {}, { at: OPTS.at, store: "coles", days: ["x", "2026-10-21"], meals: [{ name: "Wrap", serves: 0 }, null, { name: "Bowl", serves: 1 }], delivery: "", wooliesTotal: NaN });
  assert.equal(o.store, "coles");
  assert.deepEqual(o.days, ["2026-10-21"]);
  assert.deepEqual(o.meals, [{ name: "Bowl", serves: 1 }]);
  assert.equal(o.delivery, null);
  assert.equal(o.wooliesTotal, null);
  assert.deepEqual(o.groups.ordered, []);
  assert.deepEqual(o.groups.buy, [item("Coles bread", "1 loaf", 3.5, "coles", null, ""), item("Deli ham", "200g from the deli", 5.6, "woolies", null, ""), item("Coles chicken breast", "1 pack", 12, "coles", null, "")]);
  assert.deepEqual(o.groups.pantry, [item("Rice 1kg", "1 bag", 2.5, "woolies", null, "")]);
});

test("isEmpty is true only with no rows besides the daily items and nothing sent", () => {
  const daily = { ...bread, id: "dare", sec: 0 };
  assert.equal(O.isEmpty([], {}), true);
  assert.equal(O.isEmpty(undefined, undefined), true);
  assert.equal(O.isEmpty([], { 100: 0 }), true);
  assert.equal(O.isEmpty([], { 100: 1 }), false);
  assert.equal(O.isEmpty([bread], {}), false);
  assert.equal(O.isEmpty([daily], {}), true);
  assert.equal(O.isEmpty([daily], { 100: 1 }), false);
  assert.equal(O.isEmpty([daily, bread], {}), false);
});

test("parseOrders keeps only well-formed orders; addOrder and removeOrder manage the list", () => {
  const o = O.snapshot([bread, ham, milk, rice, breast, evap], { milk: true }, { 100: 1, 175734: 0.2 }, OPTS);
  assert.deepEqual(O.parseOrders(JSON.stringify([o])), [o]);
  const bad = [
    { ...o, v: 2 },
    { ...o, days: ["x"] },
    { ...o, at: "never" },
    { ...o, groups: { ...o.groups, had: [{ name: "x", buy: "", cost: "4", store: null, note: null, for: "" }] } },
    { ...o, groups: { ordered: [] } },
    null,
    5,
  ];
  assert.deepEqual(O.parseOrders(JSON.stringify([o, ...bad])), [o]);
  assert.deepEqual(O.parseOrders("not json"), []);
  assert.deepEqual(O.parseOrders("{}"), []);
  assert.deepEqual(O.parseOrders(null), []);
  const list = Array.from({ length: 30 }, (_, i) => ({ id: "a" + i }));
  const added = O.addOrder(list, { id: "new" });
  assert.equal(added.length, 30);
  assert.equal(added[0].id, "new");
  assert.equal(added[29].id, "a28");
  assert.deepEqual(O.addOrder([{ id: "x", n: 1 }], { id: "x", n: 2 }), [{ id: "x", n: 2 }]);
  assert.deepEqual(O.addOrder(undefined, { id: "y" }), [{ id: "y" }]);
  assert.deepEqual(O.removeOrder([{ id: "x" }, { id: "y" }], "x"), [{ id: "y" }]);
});

test("every snapshot reads back, even with a nameless product, a missing time or a sent pantry item; the read list is capped and deduplicated", () => {
  const odd = O.snapshot([rice, bread, evap], {}, { 300: 1, 777: 1 }, { ...OPTS, at: undefined, product: () => ({ price: 2 }) });
  assert.ok(!isNaN(Date.parse(odd.at)));
  assert.equal(odd.id, odd.at);
  assert.deepEqual(odd.groups.ordered.map((i) => i.name), ["Rice 1kg", "Product 777"]);
  assert.deepEqual(odd.groups.pantry, []);
  for (const o of [odd, O.snapshot([bread, ham, milk, rice, breast, evap, yog], { milk: true }, { 100: 1, 999: 1 }, OPTS), O.snapshot([], {}, {}, {})]) {
    assert.deepEqual(O.parseOrders(JSON.stringify([o])), [o]);
  }
  const many = Array.from({ length: 40 }, (_, i) => ({ ...odd, id: "id" + i }));
  const read = O.parseOrders(JSON.stringify([...many, { ...odd, id: "id0" }]));
  assert.equal(read.length, 30);
  assert.equal(read[0].id, "id0");
  assert.equal(new Set(read.map((o) => o.id)).size, 30);
});

test("summaryLine gives the date, how many were ordered and the total", () => {
  const o = O.snapshot([bread, ham], {}, { 100: 1, 175734: 0.2 }, OPTS);
  assert.equal(O.summaryLine(o), "Thu 15 Oct · 2 ordered · $145.43");
  assert.equal(O.summaryLine({ ...o, wooliesTotal: null }), "Thu 15 Oct · 2 ordered · about $9.60");
  assert.equal(O.summaryLine(O.snapshot([rice], {}, {}, OPTS)), "Thu 15 Oct · nothing ordered");
});

test("in a Coles shop an item with no online store beats the Coles-unavailable note", () => {
  const gone = ROW("evap", 1, null, null, { name: "Evaporated milk", colesUnavailable: { name: "Coles evap", price: 3.45 } });
  const o = O.snapshot([gone], {}, {}, { at: OPTS.at, store: "coles" });
  assert.deepEqual(o.groups.buy, [item("Evaporated milk", "", null, null, "no online store", "")]);
});

test("in a Coles shop an item unavailable online at Coles is noted", () => {
  const gone = ROW("milk", 1, LINE(P(200, "Milk 2L", 3.1), 1, 3.1, "1 bottle"), null, { colesUnavailable: { name: "Coles milk", price: 3 } });
  const o = O.snapshot([gone], {}, {}, { at: OPTS.at, store: "coles" });
  assert.deepEqual(o.groups.buy, [item("Milk 2L", "1 bottle", 3.1, "woolies", "unavailable online at Coles", "")]);
  const w = O.snapshot([gone], {}, {}, { at: OPTS.at, store: "woolies" });
  assert.deepEqual(w.groups.buy, [item("Milk 2L", "1 bottle", 3.1, "woolies", null, "")]);
});

const CMAC = { name: "Coles Macaroni 500g", url: "https://www.coles.com.au/product/coles-macaroni-3329137", price: 1 };
const CBREAST = { name: "Coles chicken breast", url: "https://www.coles.com.au/product/coles-breast-2263179", price: 12 };
const cid = (p) => { const m = /-(\d{4,7})$/.exec((p && p.url) || ""); return m ? m[1] : null; };
const mac = ROW("mac", 2, null, LINE(CMAC, 1, 1, "1 pack"));
const cbreast = ROW("breast", 1, null, LINE(CBREAST, 1, 12, "1 pack"));
const COPTS = { ...OPTS, store: "coles", wooliesTotal: null, colesId: cid, colesProduct: (id) => (id === "8991361" ? { name: "Dare 500mL", price: 4.65 } : null) };

test("in a Coles shop, products sent to the Coles trolley are ordered, at Coles", () => {
  const o = O.snapshot([cbreast, mac, evap], {}, {}, { ...COPTS, colesSent: { 2263179: 2, 3329137: 0, 8991361: 1, 7777777: 3 } });
  assert.deepEqual(o.groups.ordered, [
    item("Coles chicken breast", "2 packs", 24, "coles"),
    item("Product 7777777", "3", null, "coles", "not in this shop", ""),
    item("Dare 500mL", "1 pack", 4.65, "coles", "not in this shop", ""),
  ]);
  assert.deepEqual(o.groups.pantry, [item("Coles Macaroni 500g", "1 pack", 1, "coles")]);
  assert.deepEqual(o.groups.buy, [item("Evaporated milk", "", null, null, "no online store")]);
});

test("a sent amount equal to the shop line keeps the shop's own description", () => {
  const o = O.snapshot([cbreast], {}, {}, { ...COPTS, colesSent: { 2263179: 1 } });
  assert.deepEqual(o.groups.ordered, [item("Coles chicken breast", "1 pack", 12, "coles")]);
});

test("isEmpty counts Coles sends, and groupTitle names the order's store", () => {
  assert.equal(O.isEmpty([], {}, { 3329137: 1 }), false);
  assert.equal(O.isEmpty([], {}, { 3329137: 0 }), true);
  assert.equal(O.groupTitle({ store: "coles" }, "ordered"), "Ordered on Coles");
  assert.equal(O.groupTitle({ store: "woolies" }, "ordered"), "Ordered on Woolworths");
  assert.equal(O.groupTitle({ store: "coles" }, "buy"), "Buy yourself");
});

test("Woolworths send marks the Coles product used so it is not listed again", () => {
  const dual = ROW("dual", 1, LINE(P(100, "Wholemeal bread", 4), 1, 4, "1 loaf"), LINE(CMAC, 1, 1, "1 pack"));
  const o = O.snapshot([dual], {}, { 100: 1 }, { ...OPTS, colesSent: { 3329137: 1 }, colesId: cid });
  assert.deepEqual(o.groups.ordered, [item("Wholemeal bread", "1 loaf", 4, "woolies")]);
  assert.ok(!o.groups.ordered.some((i) => i.note === "not in this shop"));
});

test("two rows sharing a sent Coles product produce one ordered line with combined quantity", () => {
  const mac1 = ROW("mac", 1, null, LINE(CMAC, 1, 1, "1 pack"));
  const mac2 = ROW("mac2", 1, null, LINE(CMAC, 2, 2, "2 packs"));
  const o = O.snapshot([mac1, mac2], {}, {}, { ...COPTS, colesSent: { 3329137: 3 } });
  assert.deepEqual(o.groups.ordered, [item("Coles Macaroni 500g", "3 packs", 3, "coles")]);
  assert.equal(o.groups.ordered[0].for, "For toasty");
  assert.deepEqual(o.groups.had, []);
  assert.deepEqual(o.groups.pantry, []);
  assert.deepEqual(o.groups.buy, []);
});

test("a sent colesUnavailable product is ordered at Coles with an unavailable note", () => {
  const gone = ROW("cheese", 1, null, null, { colesUnavailable: CBREAST });
  const o = O.snapshot([gone], {}, {}, { ...COPTS, colesSent: { 2263179: 1 } });
  assert.deepEqual(o.groups.ordered, [item("Coles chicken breast", "1 pack", 12, "coles", "was unavailable online")]);
});
