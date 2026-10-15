const { test } = require("node:test");
const assert = require("node:assert/strict");
const { create, deliGrams } = require("../../main/assets/weekday_fuel/catalogue.js");

const W = "https://www.woolworths.com.au/shop/productdetails/";
const C = "https://www.coles.com.au/product/";
const ITEMS = [
  { id: "dare", sec: 0, name: "Dare iced coffee", unit: "bottles", note: "", same: true,
    coles: { name: "Dare Double Espresso 500mL", url: C + "dare-1", size: 1, price: 5.5, checked: "2026-10-15" },
    woolies: { name: "Dare Double Espresso 500mL", url: W + "72280", stockcode: 72280, size: 1, price: 5, checked: "2026-10-15" } },
  { id: "breast", sec: 1, name: "Chicken breast", unit: "g", note: "", same: false,
    coles: { name: "Coles Chicken Breast Large", url: C + "breast-large-2", size: 1400, price: 16.8, checked: "2026-10-12",
      small: { name: "Coles Chicken Breast Small", url: C + "breast-small-3", size: 600, price: 7.2, checked: "2026-10-12" } },
    woolies: { name: "Woolworths Chicken Breast 1kg", url: W + "123456", stockcode: 123456, size: 1000, price: 13, checked: "2026-10-15" } },
  { id: "ham", sec: 1, name: "Shaved ham", unit: "g", note: "", same: false,
    coles: null,
    woolies: { name: "D'Orsogna Ham Shaved From The Deli", url: W + "175734", stockcode: 175734, perKg: true, size: 1, price: 28, checked: "2026-10-15" } },
  { id: "cheese", sec: 1, name: "Light tasty cheese", unit: "g", note: "", same: false,
    coles: { name: "Coles Light Tasty 500g", url: C + "cheese-4", size: 500, price: 7.5, checked: "2026-10-14" },
    woolies: { name: "Woolworths Light Tasty 500g", url: W + "729008", stockcode: 729008, size: 500, price: 9, checked: "2026-10-15" } },
  { id: "evap", sec: 2, name: "Evaporated milk", unit: "mL", note: "", same: false,
    coles: { name: "Carnation Light Evaporated Milk 375mL", url: C + "evap-5", size: 375, price: 2.5, checked: "2026-10-14" },
    woolies: null },
];
const AMOUNTS = {
  toasty: { ham: 100, cheese: 30 },
  eggmuffin: { ham: 50 },
  tenderwrap: { breast: 200, cheese: 30 },
  buffalomac: { breast: 180, cheese: 40, evap: 80 },
};
const cat = create(ITEMS, AMOUNTS);
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

test("deliGrams rounds up to the next 100 g, at least 100 g", () => {
  assert.equal(deliGrams(250), 300);
  assert.equal(deliGrams(60), 100);
  assert.equal(deliGrams(300), 300);
  assert.equal(deliGrams(0), 100);
});

test("shopList adds up each item's need across meals and serves, in catalogue order", () => {
  const rows = cat.shopList({ toasty: 2, tenderwrap: 2 }, 0);
  assert.deepEqual(rows.map((r) => [r.id, r.need]), [["breast", 400], ["ham", 200], ["cheese", 120]]);
  assert.deepEqual(byId(rows).cheese.used, ["toasty", "tenderwrap"]);
});

test("fixtures are one per day at each store", () => {
  const [dare] = cat.shopList({}, 5);
  assert.equal(dare.id, "dare");
  assert.deepEqual([dare.coles.quantity, dare.coles.cost, dare.coles.buy], [5, 27.5, "5 bottles"]);
  assert.equal(dare.woolies.cost, 25);
  assert.deepEqual(cat.shopList({}, 0), []);
  assert.equal(cat.shopList({}, 1)[0].coles.buy, "1 bottle");
  const pouch = create([{ ...ITEMS[0], id: "rice", unit: "pouches" }], { bowl: { rice: 1 } });
  assert.equal(pouch.shopList({ bowl: 1 }, 0)[0].woolies.buy, "1 pouch");
});

test("whole packs per store, from each store's own pack size", () => {
  const r = byId(cat.shopList({ buffalomac: 13 }, 0));
  assert.deepEqual([r.cheese.coles.quantity, r.cheese.coles.cost, r.cheese.coles.buy], [2, 15, "2 × 500g"]);
  assert.equal(r.cheese.woolies.cost, 18);
  assert.deepEqual([r.breast.coles.product.name, r.breast.coles.quantity, r.breast.coles.cost], ["Coles Chicken Breast Large", 2, 33.6]);
  assert.deepEqual([r.breast.woolies.quantity, r.breast.woolies.cost, r.breast.woolies.buy], [3, 39, "3 × 1000g"]);
  assert.deepEqual([r.evap.coles.quantity, r.evap.coles.buy], [3, "3 × 375mL"]);
  assert.equal(r.evap.woolies, null);
});

test("the small chicken pack is used while the need fits it (plus 50 g)", () => {
  const small = byId(cat.shopList({ tenderwrap: 3 }, 0)).breast.coles;
  assert.deepEqual([small.product.name, small.quantity, small.cost, small.buy], ["Coles Chicken Breast Small", 1, 7.2, "1 × 600g"]);
  const large = byId(cat.shopList({ tenderwrap: 4 }, 0)).breast.coles;
  assert.deepEqual([large.product.name, large.quantity, large.cost], ["Coles Chicken Breast Large", 1, 16.8]);
  const slackCat = create(ITEMS, { m650: { breast: 650 }, m651: { breast: 651 } });
  const at650 = byId(slackCat.shopList({ m650: 1 }, 0)).breast.coles;
  assert.deepEqual([at650.product.name, at650.quantity, at650.cost, at650.buy], ["Coles Chicken Breast Small", 1, 7.2, "1 × 600g"]);
  const at651 = byId(slackCat.shopList({ m651: 1 }, 0)).breast.coles;
  assert.deepEqual([at651.product.name, at651.quantity, at651.cost], ["Coles Chicken Breast Large", 1, 16.8]);
});

test("deli ham is bought by weight, rounded up to 100 g", () => {
  const ham = byId(cat.shopList({ toasty: 2, eggmuffin: 1 }, 0)).ham;
  assert.equal(ham.need, 250);
  assert.deepEqual([ham.woolies.quantity, ham.woolies.cost, ham.woolies.buy], [0.3, 8.4, "300g from the deli"]);
  assert.equal(ham.coles, null);
  const two = byId(cat.shopList({ toasty: 2 }, 0)).ham.woolies;
  assert.deepEqual([two.quantity, two.cost, two.buy], [0.2, 5.6, "200g from the deli"]);
});

test("storeTotals counts each store's packs, leaves out ticked items from Left to buy, and lists missed items", () => {
  const rows = cat.shopList({ buffalomac: 1 }, 0);
  assert.deepEqual(cat.storeTotals(rows, "coles", {}), { total: 17.2, left: 17.2, missed: [] });
  assert.deepEqual(cat.storeTotals(rows, "woolies", {}), { total: 22, left: 22, missed: ["evap"] });
  assert.equal(cat.storeTotals(rows, "coles", { cheese: true }).left, 9.7);
  assert.equal(cat.storeTotals(rows, "woolies", { cheese: true }).left, 13);
});

test("mealCost prices a Standard serve at the chosen store, using the other store where it has nothing", () => {
  assert.equal(cat.mealCost("buffalomac", "coles"), 3.29);
  assert.equal(cat.mealCost("buffalomac", "woolies"), 3.59);
  assert.equal(cat.mealCost("toasty", "woolies"), 3.34);
  assert.equal(cat.mealCost("toasty", "coles"), 3.25);
  assert.equal(cat.mealCost("nope", "coles"), null);
});

test("usedIn, item and colesChecked", () => {
  assert.deepEqual(cat.usedIn("cheese"), ["toasty", "tenderwrap", "buffalomac"]);
  assert.deepEqual(cat.usedIn("ham"), ["toasty", "eggmuffin"]);
  assert.equal(cat.item("cheese").name, "Light tasty cheese");
  assert.equal(cat.colesChecked(), "2026-10-12");
});
