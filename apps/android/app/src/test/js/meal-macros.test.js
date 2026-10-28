const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PANELS } = require("../../main/assets/weekday_fuel/macros.js");
const { EXTRA_AMOUNTS } = require("../../main/assets/weekday_fuel/extra-amounts.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const { MEALS } = require("../../main/assets/weekday_fuel/meals.js");
const calc = require("../../main/assets/weekday_fuel/meal-calc.js");
const W = require("../../main/assets/weekday_fuel/weigh.js");

const MC = calc.create({
  panels: PANELS,
  amounts: cat.AMOUNTS,
  extraAmounts: EXTRA_AMOUNTS,
  item: (id) => cat.item(id),
});

test("meals.js does not hard-code k/p/c/f on portions", () => {
  for (const m of MEALS) {
    for (const t of ["L", "S", "X"]) {
      const v = m.t[t];
      assert.ok(v);
      for (const k of ["k", "p", "c", "f"]) assert.equal(v[k], undefined, `${m.id} ${t}.${k}`);
    }
  }
});

test("store switch can change computed macros when panels differ", () => {
  const w = MC.portion("toasty", "S", "woolies");
  const c = MC.portion("toasty", "S", "coles");
  assert.notDeepEqual(w, c);
});

test("bought meal uses order store panels via meal ref pattern", () => {
  const w = MC.portion("burritobowl", "S", "woolies");
  const c = MC.portion("burritobowl", "S", "coles");
  assert.notEqual(w.k, c.k);
});

test("bread fallback panel differs from primary", () => {
  assert.ok(PANELS["bread-fallback"]);
  const primary = MC.portion("toasty", "S", "woolies");
  const fb = MC.portion("toasty", "S", "woolies", { useFallback: true });
  assert.notEqual(primary.k, fb.k);
});

test("soy weighG keeps kcal on per-100mL panel (friedrice S)", () => {
  const base = MC.portion("friedrice", "S", "woolies");
  const mcW = calc.create({
    panels: PANELS,
    amounts: cat.AMOUNTS,
    extraAmounts: EXTRA_AMOUNTS,
    item: (id) => cat.item(id),
    weigh: W,
    weighG: { soy: { ml: 40, g: 46 } },
  });
  assert.equal(mcW.portion("friedrice", "S", "woolies").k, base.k);
});

test("soy weighG uses grams on per-100g panel", () => {
  const panels = structuredClone(PANELS);
  panels.soy = { woolies: { ...PANELS.soy.woolies, per: "100g" } };
  const mcBase = calc.create({
    panels,
    amounts: cat.AMOUNTS,
    extraAmounts: EXTRA_AMOUNTS,
    item: (id) => cat.item(id),
  });
  const mcW = calc.create({
    panels,
    amounts: cat.AMOUNTS,
    extraAmounts: EXTRA_AMOUNTS,
    item: (id) => cat.item(id),
    weigh: W,
    weighG: { soy: { ml: 40, g: 46 } },
  });
  const base = mcBase.portion("friedrice", "S", "woolies");
  const weighed = mcW.portion("friedrice", "S", "woolies");
  assert.notEqual(weighed.k, base.k);
  assert.ok(weighed.k > base.k);
});

test("spray is counted once (AMOUNTS, not extra-amounts)", () => {
  assert.equal(EXTRA_AMOUNTS.eggmuffin && EXTRA_AMOUNTS.eggmuffin.spray, undefined);
  const mc = calc.create({ panels: PANELS, amounts: cat.AMOUNTS, extraAmounts: EXTRA_AMOUNTS, item: (id) => cat.item(id) });
  const p = mc.portion("eggmuffin", "S", "woolies");
  assert.ok(p.k > 0);

  const dupExtras = structuredClone(EXTRA_AMOUNTS);
  dupExtras.eggmuffin = { spray: { L: 1, S: 1, X: 1 } };
  const mcDup = calc.create({
    panels: PANELS,
    amounts: cat.AMOUNTS,
    extraAmounts: dupExtras,
    item: (id) => cat.item(id),
  });
  const pDup = mcDup.portion("eggmuffin", "S", "woolies");
  assert.ok(pDup.k > p.k, "extra-amount spray would double-count macros on top of AMOUNTS");
});
