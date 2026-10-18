const { test } = require("node:test");
const assert = require("node:assert/strict");
const { create, shopNeedLabel } = require("../../main/assets/weekday_fuel/catalogue.js");
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
    coles: { name: "Breast", url: C + "breast-1", size: 650, price: 8, checked: "2026-10-15" },
    woolies: { name: "Breast", url: W + "6078624", stockcode: 6078624, size: 650, price: 9, checked: "2026-10-15" },
  },
  {
    id: "ham",
    sec: 1,
    name: "Ham",
    unit: "g",
    coles: null,
    woolies: { name: "Ham deli", url: W + "175734", stockcode: 175734, perKg: true, size: 1, price: 28, checked: "2026-10-15" },
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
const AMOUNTS = { wrap: { breast: 200 }, bowl: { breast: 150, rice: 1 }, bulk: { breast: 1000 }, one: { breast: 650 }, toast: { ham: 100 } };
const cat = create(ITEMS, AMOUNTS);

const NO_HAVE_LITERAL = [
  { id: "dare", need: 3, used: [], days: [], woolies: { quantity: 3, buy: "3 bottles" } },
  { id: "grenade", need: 3, used: [], days: [], woolies: { quantity: 3, buy: "3 bars" } },
  {
    id: "breast",
    need: 550,
    used: ["wrap", "bowl"],
    days: ["2026-10-20"],
    woolies: { quantity: 1, buy: "1 × 650g" },
  },
  { id: "rice", need: 1, used: ["bowl"], days: ["2026-10-20"], woolies: { quantity: 1, buy: "1 pouch" } },
];

function slim(rows) {
  return rows.map((r) => {
    const o = {
      id: r.id,
      need: r.need,
      used: r.used,
      days: r.days,
      woolies: r.woolies ? { quantity: r.woolies.quantity, buy: r.woolies.buy } : null,
    };
    if (r.have > 0) o.have = r.have;
    return o;
  });
}

const oneUnit = (u) => u.replace(/(ch|sh|x)es$/, "$1").replace(/s$/, "");
const shopFmt = (v, u) =>
  /^(g|mL)$/.test(u)
    ? (v >= 1000 && u === "g" ? v / 1000 + "kg" : Math.round(v * 10) / 10 + u)
    : Math.round(v * 10) / 10 + " " + (v <= 1 ? oneUnit(u) : u);

test("shopNeedLabel keeps need prefix and adds have only when partly covered", () => {
  assert.equal(shopNeedLabel({ need: 3, unit: "bottles" }, shopFmt), "need 3 bottles");
  assert.equal(shopNeedLabel({ need: 400, have: 250, unit: "g" }, shopFmt), "need 400g · have 250g");
  assert.equal(shopNeedLabel({ need: 1, have: 1, unit: "pouches" }, shopFmt), "need 1 pouch · have 1 pouch");
  assert.equal(shopNeedLabel({ need: 1, have: 1, unit: "bars" }, shopFmt), "need 1 bar · have 1 bar");
});

test("no have, empty have and unrelated keys match literal pre-change shopList", () => {
  const picks = { wrap: 2 };
  const dayMeals = [{ day: "2026-10-20", meal: "bowl" }];
  const baseline = cat.shopList(picks, 3, dayMeals);
  assert.deepEqual(slim(baseline), NO_HAVE_LITERAL);
  baseline.forEach((r) => assert.equal("have" in r, false));
  assert.deepEqual(slim(cat.shopList(picks, 3, dayMeals, undefined)), NO_HAVE_LITERAL);
  assert.deepEqual(slim(cat.shopList(picks, 3, dayMeals, {})), NO_HAVE_LITERAL);
  assert.deepEqual(slim(cat.shopList(picks, 3, dayMeals, { honey: 500, __proto__: 1 })), NO_HAVE_LITERAL);
  assert.deepEqual(cat.coveredList(picks, 3, dayMeals, {}), []);
});

test("partly covered rows keep need, set have, and size store lines for the remainder", () => {
  const rows = cat.shopList({ wrap: 2 }, 0, [], { breast: 250 });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.need, 400);
  assert.equal(r.have, 250);
  assert.equal(r.woolies.quantity, 1);
  assert.equal(r.woolies.product.size, 650);
});

test("pack count drops when have covers part of a multi-pack need", () => {
  const full = cat.shopList({ bulk: 1 }, 0, []);
  const part = cat.shopList({ bulk: 1 }, 0, [], { breast: 400 });
  assert.equal(full[0].woolies.quantity, 2);
  assert.equal(part[0].woolies.quantity, 1);
});

test("deli lines show the rounded remainder grams", () => {
  const r = cat.shopList({ toast: 1 }, 0, [], { ham: 40 })[0];
  assert.equal(r.have, 40);
  assert.equal(r.woolies.buy, "100g from the deli");
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
  const atPack = cat.shopList({ one: 1 }, 0);
  assert.deepEqual(cat.shopList({ one: 1 }, 0, [], { breast: -1 }), atPack);
  assert.equal(atPack[0].need, 650);
});

test("a shortfall within 5% of need counts as covered with the real have amount", () => {
  assert.equal(cat.shopList({ one: 1 }, 0, [], { breast: 640 }).length, 0);
  const cov = cat.coveredList({ one: 1 }, 0, [], { breast: 640 })[0];
  assert.equal(cov.need, 650);
  assert.equal(cov.have, 640);
  const partial = cat.shopList({ one: 1 }, 0, [], { breast: 600 })[0];
  assert.equal(partial.need, 650);
  assert.equal(partial.have, 600);
  const boundary = 650 - 650 * 0.05;
  assert.equal(cat.shopList({ one: 1 }, 0, [], { breast: boundary }).length, 0);
  assert.equal(cat.coveredList({ one: 1 }, 0, [], { breast: boundary })[0].have, boundary);
});

test("tiny shortfalls and h zero stay on the no-have invariant", () => {
  const need = 200;
  assert.equal(cat.shopList({ wrap: 1 }, 0, [], { breast: need - 1e-10 }).length, 0);
  assert.equal(cat.coveredList({ wrap: 1 }, 0, [], { breast: need - 1e-10 }).length, 1);
  assert.equal(cat.shopList({ wrap: 1 }, 0, [], { breast: need - 11 }).length, 1);
  assert.equal(cat.coveredList({ wrap: 1 }, 0, [], { breast: need - 11 }).length, 0);
  assert.deepEqual(cat.shopList({ wrap: 1 }, 0, [], { breast: 0 }), cat.shopList({ wrap: 1 }, 0));
});

test("coles store lines size for partial cover remainder", () => {
  const r = cat.shopList({ wrap: 1 }, 0, [], { breast: 100 })[0];
  assert.equal(r.need, 200);
  assert.equal(r.have, 100);
  assert.equal(r.coles.quantity, 1);
  assert.equal(r.coles.product.size, 650);
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
