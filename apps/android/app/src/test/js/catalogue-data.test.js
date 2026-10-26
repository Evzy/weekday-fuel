const { test } = require("node:test");
const assert = require("node:assert/strict");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const { PANELS } = require("../../main/assets/weekday_fuel/macros.js");
const calc = require("../../main/assets/weekday_fuel/meal-calc.js");
const MC = calc.create({ panels: PANELS, amounts: cat.AMOUNTS, item: (id) => cat.item(id) });

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
      if (p.fallback) checkProduct(it.id + "." + store + ".fallback", p.fallback, store);
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
  const withPacks = new Set(["breast", "mince", "ham", "eggs", "yog", "cheese", "spinach", "potato", "passata", "fzpeas"]);
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
    for (const prod of [p].concat(p.packs || [], p.fallback ? [p.fallback] : [])) {
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
    for (const prod of [p].concat(p.packs || [], p.fallback ? [p.fallback] : [])) {
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
    const mainW = MC.servePer(it, null, "woolies");
    const mainC = MC.servePer(it, null, "coles");
    assert.ok(mainW && mainW.k > 0 && mainW.p > 0, it.id + " has panel serve woolies");
    assert.ok(mainC && mainC.k > 0 && mainC.p > 0, it.id + " has panel serve coles");
    const ids = new Set();
    it.swaps.forEach((s) => {
      if (s.hidden) return;
      assert.ok(s.id && !ids.has(s.id), it.id + " unique swap id " + s.id);
      ids.add(s.id);
      assert.ok(typeof s.name === "string" && s.name);
      assert.ok(Number.isInteger(s.serves) && s.serves >= 1, s.id + " serves");
      assert.ok(s.serveMl != null || s.serveG != null, s.id + " serveMl or serveG");
      const sp = MC.servePer(it, s, "woolies") || MC.servePer(it, s, "coles");
      assert.ok(sp && sp.k > 0 && sp.p > 0, s.id + " panel per serve");
      assert.ok(sp.p >= mainW.p - 5 && (s.todayOnly || sp.k <= mainW.k + 80), s.id + " passes guard woolies");
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

function round1Swap(x) {
  return Math.round(x * 10) / 10;
}

function panelServeFromPanel(panel, amount) {
  const f = amount / 100;
  return {
    k: round1Swap((panel.k || 0) * f),
    p: round1Swap((panel.p || 0) * f),
    c: round1Swap((panel.c || 0) * f),
    f: round1Swap((panel.f || 0) * f),
  };
}

function pickSwapPanel(bag, store) {
  if (!bag) return null;
  return bag[store] || bag.any || bag.woolies || bag.coles || null;
}

test("each swap serve matches panel times size in its product name", () => {
  const mlRe = /(\d+)\s*mL/i;
  const gRe = /(\d+)\s*g\b/i;
  for (const it of cat.ITEMS) {
    if (!it.swaps) continue;
    for (const s of it.swaps) {
      if (s.hidden) continue;
      const ml = mlRe.exec(s.name);
      const g = gRe.exec(s.name);
      if (ml) assert.equal(s.serveMl, Number(ml[1]), s.id + " serveMl matches name");
      else if (g) assert.equal(s.serveG, Number(g[1]), s.id + " serveG matches name");
      else assert.fail(s.id + " name has no mL or g size");
      const amount = s.serveMl != null ? s.serveMl : s.serveG;
      for (const store of ["woolies", "coles"]) {
        const panel = pickSwapPanel(PANELS[s.id], store);
        if (!panel) continue;
        const exp = panelServeFromPanel(panel, amount);
        const got = MC.servePer(it, s, store);
        assert.ok(got, s.id + " " + store);
        assert.equal(got.k, exp.k, s.id + " k " + store);
        assert.equal(got.p, exp.p, s.id + " p " + store);
        assert.equal(got.c, exp.c, s.id + " c " + store);
        assert.equal(got.f, exp.f, s.id + " f " + store);
      }
    }
  }
});

test("every swap has a short label at most 12 characters", () => {
  const swaps = cat.ITEMS.flatMap((it) => it.swaps || []);
  assert.ok(swaps.length > 0);
  swaps.forEach((s) => {
    assert.ok(typeof s.short === "string" && s.short.length > 0 && s.short.length <= 12, s.id);
  });
});

test("approved swap ids and store links match the spec", () => {
  const approved = {
    "dare-mocha": { W: 6074551, C: "1608570" },
    "pauls-dec": { W: 6049883, C: "1439928" },
    "rokeby-de": { W: 771267, C: "6258498" },
    "oak-sc": { W: 6048422, C: "1043778" },
    icebreak: { W: null, C: "7850783" },
    "dare-750": { W: 6020777, C: "1045886" },
    "gr-oreo": { W: 286090, C: "6509780" },
    "gr-white-oreo": { W: 6028961, C: "9968718" },
    "gr-cookie": { W: 6043930, C: null },
    "mu-vancar": { W: 153264, C: "4292429" },
    "mu-wcsc": { W: 6014680, C: "9958500" },
    "mu-cc": { W: 555158, C: "7875897" },
    "bsc-cc": { W: null, C: "3125148" },
  };
  const retiredW = new Set(Object.keys(cat.RETIRED.woolies));
  const retiredC = new Set(Object.keys(cat.RETIRED.coles));
  const items = cat.ITEMS;
  const swaps = items.flatMap((it) => (it.swaps || []).map((s) => ({ main: it, swap: s })));
  assert.equal(swaps.length, 13);
  swaps.forEach(({ main, swap: s }) => {
    const exp = approved[s.id];
    assert.ok(exp, s.id + " in approved table");
    if (!s.hidden) {
      const sp = MC.servePer(main, s, "woolies") || MC.servePer(main, s, "coles");
      assert.ok(sp && sp.k > 0, s.id + " has computed k from panel");
    }
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
      for (const p of [it.coles].concat(it.coles.packs || [], it.coles.fallback ? [it.coles.fallback] : [])) colesIds.add(cat.colesId(p));
    }
    if (it.woolies) {
      for (const p of [it.woolies].concat(it.woolies.packs || [], it.woolies.fallback ? [it.woolies.fallback] : [])) wooliesCodes.add(String(p.stockcode));
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
