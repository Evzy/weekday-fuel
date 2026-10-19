const { test } = require("node:test");
const assert = require("node:assert/strict");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");

const MEALS = require("../../main/assets/weekday_fuel/meals.js").MEALS.map((m) => m.id);
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

test("every counted-unit item has a positive unitSize", () => {
  for (const it of cat.ITEMS) {
    if (it.unit === "g" || it.unit === "mL") continue;
    assert.ok(it.unitSize > 0, it.id + " unitSize");
  }
});

test("every item is well formed", () => {
  const ids = new Set();
  for (const it of cat.ITEMS) {
    assert.ok(!ids.has(it.id), "duplicate " + it.id);
    ids.add(it.id);
    assert.ok([0, 1, 2].includes(it.sec), it.id + " sec");
    assert.ok(it.name && it.unit, it.id + " name/unit");
    if (it.sec === 1) {
      assert.ok(Number.isInteger(it.keeps) && it.keeps > 0, it.id + " keeps");
    } else {
      assert.equal(it.keeps, undefined, it.id + " keeps only on fresh items");
    }
    assert.ok(it.coles || it.woolies, it.id + " has at least one store");
    if (it.same) assert.ok(it.coles && it.woolies, it.id + " same needs both");
    for (const store of ["coles", "woolies"]) {
      const p = it[store];
      if (!p) continue;
      checkProduct(it.id + "." + store, p, store);
      if (p.packs) {
        assert.ok(Array.isArray(p.packs) && p.packs.length, it.id + "." + store + " packs");
        for (let i = 0; i < p.packs.length; i++) {
          checkProduct(it.id + "." + store + ".packs[" + i + "]", p.packs[i], store);
          if (p.packs[i].sizeLabel) {
            assert.ok(typeof p.packs[i].sizeLabel === "string" && p.packs[i].sizeLabel.length > 0, it.id + "." + store + ".packs[" + i + "] sizeLabel");
          }
        }
      }
    }
  }
});

test("every meal's items exist and every non-fixture item is used by a meal", () => {
  assert.deepEqual(Object.keys(cat.AMOUNTS).sort(), [...MEALS].sort());
  for (const meal of MEALS) {
    for (const [id, amount] of Object.entries(cat.AMOUNTS[meal])) {
      assert.ok(cat.item(id), meal + " uses unknown item " + id);
      assert.ok(typeof amount === "number" ? amount > 0 : ["L", "S", "X"].some((t) => amount[t] > 0), meal + "." + id + " amount");
    }
  }
  for (const it of cat.ITEMS) if (it.sec !== 0) assert.ok(cat.usedIn(it.id).length, it.id + " is never used");
});

test("only meat items use alternate packs", () => {
  const meat = new Set(["breast", "thigh", "mince", "ham"]);
  for (const it of cat.ITEMS) {
    for (const store of ["coles", "woolies"]) {
      const p = it[store];
      if (!p || !p.packs) continue;
      assert.ok(meat.has(it.id), it.id + " has " + store + " packs");
    }
  }
});

test("every Coles product URL ends with its id and all Coles ids are unique", () => {
  const ids = [];
  for (const it of cat.ITEMS) {
    const p = it.coles;
    if (!p) continue;
    for (const prod of [p].concat(p.packs || [])) {
      const id = cat.colesId(prod);
      assert.ok(id, it.id + " Coles id");
      assert.ok(prod.url.endsWith("-" + id), it.id + " url ends with id");
      ids.push(id);
    }
  }
  assert.equal(new Set(ids).size, ids.length);
});

test("every Woolworths stockcode is unique across main products and packs", () => {
  const codes = [];
  for (const it of cat.ITEMS) {
    const p = it.woolies;
    if (!p) continue;
    for (const prod of [p].concat(p.packs || [])) {
      assert.ok(prod.stockcode, it.id + " Woolworths stockcode");
      codes.push(prod.stockcode);
    }
  }
  assert.equal(new Set(codes).size, codes.length);
});

test("the Fewest items meals price at both stores", () => {
  const rows = cat.shopList({ toasty: 2, tenderwrap: 2, burritobowl: 2, buffalomac: 2 }, 5);
  for (const store of ["coles", "woolies"]) assert.ok(cat.storeTotals(rows, store, {}).total > 0, store);
  for (const meal of MEALS) for (const store of ["coles", "woolies"]) assert.ok(cat.mealCost(meal, store) > 0, meal + " " + store);
});

test("RETIRED keys are not current product ids and every entry has a name and url", () => {
  const colesIds = new Set();
  const wooliesCodes = new Set();
  for (const it of cat.ITEMS) {
    if (it.coles) {
      for (const p of [it.coles].concat(it.coles.packs || [])) colesIds.add(cat.colesId(p));
    }
    if (it.woolies) {
      for (const p of [it.woolies].concat(it.woolies.packs || [])) wooliesCodes.add(String(p.stockcode));
    }
  }
  for (const [id, entry] of Object.entries(cat.RETIRED.coles)) {
    assert.ok(!colesIds.has(id), "retired Coles id still in catalogue: " + id);
    assert.ok(entry.name && entry.url, "retired Coles " + id);
  }
  for (const [code, entry] of Object.entries(cat.RETIRED.woolies)) {
    assert.ok(!wooliesCodes.has(code), "retired Woolworths code still in catalogue: " + code);
    assert.ok(entry.name && entry.url, "retired Woolworths " + code);
  }
});
