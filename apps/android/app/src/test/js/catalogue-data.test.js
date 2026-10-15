const { test } = require("node:test");
const assert = require("node:assert/strict");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");

const MEALS = ["toasty", "eggmuffin", "yogbowl", "brekwrap", "tenderwrap", "burritobowl", "teriyaki", "buffalomac", "schnitzel", "koreanbeef", "bolognese", "redcurry", "friedrice", "snackplate"];
const WOOLIES = /^https:\/\/www\.woolworths\.com\.au\/shop\/productdetails\/(\d+)/;
const COLES = /^https:\/\/www\.coles\.com\.au\/product\//;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkProduct(where, p, store) {
  assert.ok(p.name, where + " name");
  assert.match(p.url, store === "coles" ? COLES : WOOLIES, where + " url");
  assert.ok(p.price > 0, where + " price");
  assert.match(p.checked, DATE, where + " checked");
  assert.ok(p.perKg ? p.size === 1 : p.size > 0, where + " size");
  if (store === "woolies") assert.equal(p.stockcode, Number(WOOLIES.exec(p.url)[1]), where + " stockcode matches url");
  if (store === "coles") assert.ok(cat.colesId(p), where + " has a Coles product id at the end of its url");
}

test("every item is well formed", () => {
  const ids = new Set();
  for (const it of cat.ITEMS) {
    assert.ok(!ids.has(it.id), "duplicate " + it.id);
    ids.add(it.id);
    assert.ok([0, 1, 2].includes(it.sec), it.id + " sec");
    assert.ok(it.name && it.unit, it.id + " name/unit");
    assert.ok(it.coles || it.woolies, it.id + " has at least one store");
    if (it.same) assert.ok(it.coles && it.woolies, it.id + " same needs both");
    for (const store of ["coles", "woolies"]) {
      const p = it[store];
      if (!p) continue;
      checkProduct(it.id + "." + store, p, store);
      if (p.small) checkProduct(it.id + "." + store + ".small", p.small, store);
    }
  }
});

test("every meal's items exist and every non-fixture item is used by a meal", () => {
  assert.deepEqual(Object.keys(cat.AMOUNTS).sort(), [...MEALS].sort());
  for (const meal of MEALS) {
    for (const [id, amount] of Object.entries(cat.AMOUNTS[meal])) {
      assert.ok(cat.item(id), meal + " uses unknown item " + id);
      assert.ok(amount > 0, meal + "." + id + " amount");
    }
  }
  for (const it of cat.ITEMS) if (it.sec !== 0) assert.ok(cat.usedIn(it.id).length, it.id + " is never used");
});

test("every Coles product URL ends with its id and all Coles ids are unique", () => {
  const ids = [];
  for (const it of cat.ITEMS) {
    const p = it.coles;
    if (!p) continue;
    for (const prod of [p, p.small]) {
      if (!prod) continue;
      const id = cat.colesId(prod);
      assert.ok(id, it.id + " Coles id");
      assert.ok(prod.url.endsWith("-" + id), it.id + " url ends with id");
      ids.push(id);
    }
  }
  assert.equal(new Set(ids).size, ids.length);
});

test("the starter shop prices at both stores", () => {
  const rows = cat.shopList({ toasty: 2, tenderwrap: 2, burritobowl: 2, buffalomac: 2 }, 5);
  for (const store of ["coles", "woolies"]) assert.ok(cat.storeTotals(rows, store, {}).total > 0, store);
  for (const meal of MEALS) for (const store of ["coles", "woolies"]) assert.ok(cat.mealCost(meal, store) > 0, meal + " " + store);
});
