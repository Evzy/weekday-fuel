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
    if (typeof it.keeps === "number") {
      assert.ok(Number.isInteger(it.keeps) && it.keeps > 0, it.id + " keeps");
    } else {
      assert.equal(it.keeps, undefined, it.id + " keeps must be a positive integer when set");
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

test("pack-size alternates are only on meat and the researched smaller-shop items", () => {
  const withPacks = new Set(["breast", "thigh", "mince", "ham", "eggs", "yog", "cheese", "spinach", "potato", "passata", "fzpeas"]);
  for (const it of cat.ITEMS) {
    for (const store of ["coles", "woolies"]) {
      const p = it[store];
      if (!p || !p.packs) continue;
      assert.ok(withPacks.has(it.id), it.id + " has " + store + " packs");
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

test("swaps are well formed and pass the nutrition guard", () => {
  const items = cat.ITEMS;
  const seenW = new Set();
  const seenC = new Set();
  items.forEach((it) => {
    [it.woolies, ...((it.woolies && it.woolies.packs) || [])].filter(Boolean).forEach((p) => seenW.add(p.stockcode));
    [it.coles, ...((it.coles && it.coles.packs) || [])].filter(Boolean).forEach((p) => seenC.add(cat.colesId(p)));
  });
  items.filter((it) => it.swaps).forEach((it) => {
    assert.ok(it.per && it.per.k > 0 && it.per.p > 0, it.id + " has per");
    const ids = new Set();
    it.swaps.forEach((s) => {
      assert.ok(s.id && !ids.has(s.id), it.id + " unique swap id " + s.id);
      ids.add(s.id);
      assert.ok(typeof s.name === "string" && s.name);
      assert.ok(Number.isInteger(s.serves) && s.serves >= 1, s.id + " serves");
      assert.ok(s.per && s.per.k > 0 && s.per.p > 0, s.id + " per");
      assert.ok(s.per.p >= it.per.p - 5 && s.per.k <= it.per.k + 150, s.id + " passes guard");
      assert.ok(typeof s.short === "string" && s.short.length > 0 && s.short.length <= 12, s.id + " short");
      assert.ok(s.woolies || s.coles, s.id + " has a store");
      if (s.woolies) {
        assert.ok(Number.isInteger(s.woolies.stockcode) && s.woolies.stockcode > 0);
        assert.equal(s.woolies.size, s.serves);
        assert.ok(s.woolies.price > 0 && s.woolies.url.includes(String(s.woolies.stockcode)));
        assert.ok(!seenW.has(s.woolies.stockcode), s.id + " stockcode not reused");
        seenW.add(s.woolies.stockcode);
      }
      if (s.coles) {
        const cid = cat.colesId(s.coles);
        assert.match(String(cid), /^\d{4,7}$/, s.id + " coles id");
        assert.equal(s.coles.size, s.serves);
        assert.ok(s.coles.price > 0);
        assert.ok(!seenC.has(cid), s.id + " coles id not reused");
        seenC.add(cid);
      }
    });
  });
  const dare = items.find((i) => i.id === "dare");
  const gren = items.find((i) => i.id === "grenade");
  assert.deepEqual(dare.swaps.map((s) => s.id), ["dare-mocha", "pauls-dec", "rokeby-de", "oak-sc", "icebreak", "dare-750"]);
  assert.deepEqual(gren.swaps.map((s) => s.id), ["gr-oreo", "gr-white-oreo", "gr-cookie", "mu-vancar", "mu-wcsc", "mu-cc", "bsc-cc"]);
  assert.equal(cat.create(cat.ITEMS).item("dare").swaps.length, 6);
});

test("every swap has a short label at most 12 characters", () => {
  const swaps = cat.ITEMS.flatMap((it) => it.swaps || []);
  assert.ok(swaps.length > 0);
  swaps.forEach((s) => {
    assert.ok(typeof s.short === "string" && s.short.length > 0 && s.short.length <= 12, s.id);
  });
});

test("approved swap catalogue values match the spec", () => {
  const approved = {
    "dare-mocha": { W: 6074551, C: "1608570", k: 292, p: 30 },
    "pauls-dec": { W: 6049883, C: "1439928", k: 270, p: 30 },
    "rokeby-de": { W: 771267, C: "6258498", k: 292, p: 30.2 },
    "oak-sc": { W: 6048422, C: "1043778", k: 304, p: 30 },
    icebreak: { W: null, C: "7850783", k: 347, p: 30 },
    "dare-750": { W: 6020777, C: "1045886", k: 444, p: 45 },
    "gr-oreo": { W: 286090, C: "6509780", k: 253, p: 20.9 },
    "gr-white-oreo": { W: 6028961, C: "9968718", k: 253, p: 20.7 },
    "gr-cookie": { W: 6043930, C: null, k: 208, p: 21 },
    "mu-vancar": { W: 153264, C: "4292429", k: 239, p: 20.1 },
    "mu-wcsc": { W: 6014680, C: "9958500", k: 256, p: 21.3 },
    "mu-cc": { W: 555158, C: "7875897", k: 256, p: 20.7 },
    "bsc-cc": { W: null, C: "3125148", k: 207, p: 19.2 },
  };
  const retiredW = new Set(Object.keys(cat.RETIRED.woolies));
  const retiredC = new Set(Object.keys(cat.RETIRED.coles));
  const items = cat.ITEMS;
  const swaps = items.flatMap((it) => (it.swaps || []).map((s) => ({ item: it.id, swap: s })));
  assert.equal(swaps.length, 13);
  swaps.forEach(({ swap: s }) => {
    const exp = approved[s.id];
    assert.ok(exp, s.id + " in approved table");
    assert.equal(s.per.k, exp.k, s.id + " k");
    assert.equal(s.per.p, exp.p, s.id + " p");
    const wCode = s.woolies ? s.woolies.stockcode : null;
    const cId = s.coles ? cat.colesId(s.coles) : null;
    assert.equal(wCode, exp.W, s.id + " W");
    assert.equal(cId, exp.C, s.id + " C");
    if (wCode != null) assert.ok(!retiredW.has(String(wCode)), s.id + " W not retired");
    if (cId != null) assert.ok(!retiredC.has(String(cId)), s.id + " C not retired");
  });
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
