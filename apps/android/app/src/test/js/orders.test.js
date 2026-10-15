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

test("isEmpty is true only with no rows and nothing sent", () => {
  assert.equal(O.isEmpty([], {}), true);
  assert.equal(O.isEmpty(undefined, undefined), true);
  assert.equal(O.isEmpty([], { 100: 0 }), true);
  assert.equal(O.isEmpty([], { 100: 1 }), false);
  assert.equal(O.isEmpty([bread], {}), false);
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

test("summaryLine gives the date, how many were ordered and the total", () => {
  const o = O.snapshot([bread, ham], {}, { 100: 1, 175734: 0.2 }, OPTS);
  assert.equal(O.summaryLine(o), "Thu 15 Oct · 2 ordered · $145.43");
  assert.equal(O.summaryLine({ ...o, wooliesTotal: null }), "Thu 15 Oct · 2 ordered · about $9.60");
  assert.equal(O.summaryLine(O.snapshot([rice], {}, {}, OPTS)), "Thu 15 Oct · nothing ordered");
});
