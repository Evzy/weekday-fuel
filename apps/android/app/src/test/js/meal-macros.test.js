const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PANELS } = require("../../main/assets/weekday_fuel/macros.js");
const { EXTRA_AMOUNTS } = require("../../main/assets/weekday_fuel/extra-amounts.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const { MEALS } = require("../../main/assets/weekday_fuel/meals.js");
const calc = require("../../main/assets/weekday_fuel/meal-calc.js");

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
