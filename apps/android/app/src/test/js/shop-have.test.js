const { test } = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../../main/assets/weekday_fuel/catalogue.js");
const { shopScore } = require("../../main/assets/weekday_fuel/planner.js");

const W = "https://www.woolworths.com.au/shop/productdetails/";
const C = "https://www.coles.com.au/product/";
const ITEMS = [
  {
    id: "dare",
    sec: 0,
    name: "Dare",
    unit: "bottles",
    coles: { name: "Dare", url: C + "dare-1", size: 1, price: 5.5, checked: "2026-10-15" },
    woolies: { name: "Dare", url: W + "72280", stockcode: 72280, size: 1, price: 5, checked: "2026-10-15" },
  },
  {
    id: "grenade",
    sec: 0,
    name: "Grenade",
    unit: "bars",
    coles: { name: "Grenade", url: C + "grenade-1", size: 1, price: 4, checked: "2026-10-15" },
    woolies: { name: "Grenade", url: W + "6027807", stockcode: 6027807, size: 1, price: 4, checked: "2026-10-15" },
  },
  {
    id: "breast",
    sec: 1,
    name: "Breast",
    unit: "g",
    coles: { name: "Breast", url: C + "breast-1", size: 600, price: 8, checked: "2026-10-15" },
    woolies: { name: "Breast", url: W + "6078624", stockcode: 6078624, size: 650, price: 9, checked: "2026-10-15" },
  },
  {
    id: "rice",
    sec: 2,
    name: "Rice",
    unit: "pouches",
    coles: { name: "Rice", url: C + "rice-1", size: 1, price: 2, checked: "2026-10-15" },
    woolies: { name: "Rice", url: W + "123", stockcode: 123, size: 1, price: 2, checked: "2026-10-15" },
  },
];
const AMOUNTS = { wrap: { breast: 200 }, bowl: { breast: 150, rice: 1 } };
const cat = create(ITEMS, AMOUNTS);
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

test("no have, empty have and unrelated keys match today's shopList", () => {
  const picks = { wrap: 2 };
  const dayMeals = [{ day: "2026-10-20", meal: "bowl" }];
  const baseline = cat.shopList(picks, 3, dayMeals);
  assert.deepEqual(cat.shopList(picks, 3, dayMeals, undefined), baseline);
  assert.deepEqual(cat.shopList(picks, 3, dayMeals, {}), baseline);
  assert.deepEqual(cat.shopList(picks, 3, dayMeals, { honey: 500, __proto__: 1 }), baseline);
  assert.deepEqual(cat.coveredList(picks, 3, dayMeals, {}), []);
});

test("partly covered rows keep need, set have, and size store lines for the remainder", () => {
  const rows = cat.shopList({ wrap: 2 }, 0, [], { breast: 250 });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.need, 400);
  assert.equal(r.have, 250);
  assert.equal(r.woolies.quantity * r.woolies.product.size, 650);
  assert.ok(r.woolies.buy.includes("650") || r.woolies.buy.includes("g"));
});

test("fully covered and over-covered rows appear only in coveredList", () => {
  const picks = { wrap: 1 };
  assert.deepEqual(cat.shopList(picks, 0, [], { breast: 200 }), []);
  assert.deepEqual(cat.coveredList(picks, 0, [], { breast: 200 }), [
    {
      id: "breast",
      sec: 1,
      name: "Breast",
      unit: "g",
      need: 200,
      have: 200,
      used: ["wrap"],
      days: [],
      covered: true,
    },
  ]);
  assert.deepEqual(cat.shopList(picks, 0, [], { breast: 999 }), []);
  assert.equal(cat.coveredList(picks, 0, [], { breast: 999 })[0].have, 200);
});

test("fixtures are covered by Dare and Grenade stock", () => {
  assert.deepEqual(
    cat.coveredList({}, 5, [], { dare: 5, grenade: 5 }),
    [
      { id: "dare", sec: 0, name: "Dare", unit: "bottles", need: 5, have: 5, used: [], days: [], covered: true },
      { id: "grenade", sec: 0, name: "Grenade", unit: "bars", need: 5, have: 5, used: [], days: [], covered: true },
    ],
  );
  const rows = cat.shopList({}, 5, [], { dare: 2, grenade: 5 });
  assert.deepEqual(rows.map((r) => r.id), ["dare"]);
  assert.equal(rows[0].need, 5);
  assert.equal(rows[0].have, 2);
});

test("bad have values are ignored", () => {
  const baseline = cat.shopList({ wrap: 1 }, 0);
  assert.deepEqual(cat.shopList({ wrap: 1 }, 0, [], { breast: -1 }), baseline);
  assert.deepEqual(cat.shopList({ wrap: 1 }, 0, [], { breast: NaN }), baseline);
  assert.deepEqual(cat.shopList({ wrap: 1 }, 0, [], { breast: "250" }), baseline);
});

test("shopScore drops covered rows and uses the remainder for fresh leftovers", () => {
  const dm = [{ day: "2026-10-20", meal: "bowl" }];
  assert.ok(shopScore(cat, dm, "woolies") > 0);
  assert.equal(shopScore(cat, dm, "woolies", { rice: 1, breast: 150 }), 0);
  const wrap = [{ day: "2026-10-20", meal: "wrap" }];
  assert.equal(shopScore(cat, wrap, "woolies", { breast: 200 }), 0);
  const partial = shopScore(cat, wrap, "woolies", { breast: 100 });
  const full = shopScore(cat, wrap, "woolies");
  assert.notEqual(partial, full);
});
