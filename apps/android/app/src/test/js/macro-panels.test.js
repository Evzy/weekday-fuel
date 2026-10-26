const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PANELS } = require("../../main/assets/weekday_fuel/macros.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const { EXTRA_AMOUNTS } = require("../../main/assets/weekday_fuel/extra-amounts.js");
const calc = require("../../main/assets/weekday_fuel/meal-calc.js");

const STORES = ["coles", "woolies"];

function panelValid(p) {
  assert.ok(p.src === "label" || p.src === "fsanz", "src " + p.src);
  assert.ok(typeof p.k === "number" && p.k >= 0);
  assert.ok(typeof p.p === "number" && p.p >= 0);
  assert.ok(typeof p.c === "number" && p.c >= 0);
  assert.ok(typeof p.f === "number" && p.f >= 0);
  assert.ok(p.per === "100g" || p.per === "100mL");
  if (p.src === "label") {
    assert.ok(typeof p.product === "string");
    assert.ok(typeof p.id === "string");
    assert.ok(typeof p.checked === "string" && p.checked.length >= 8);
  } else {
    assert.ok(typeof p.food === "string" && p.food.length > 0);
    assert.ok(typeof p.name === "string" && p.name.length > 0);
  }
}

test("panels match how recipes weigh the item (as sold, not cooked or made up)", () => {
  for (const sk of STORES) {
    assert.ok(PANELS.freshpasta[sk].k > 300, "fresh pasta per 100g as sold " + sk);
    assert.equal(PANELS.gravy[sk].per, "100g", "gravy per 100g powder " + sk);
    assert.ok(PANELS.gravy[sk].k > 250, "gravy powder " + sk);
  }
});

test("every panel store has a valid source (no typical)", () => {
  for (const id of Object.keys(PANELS)) {
    for (const sk of Object.keys(PANELS[id])) {
      panelValid(PANELS[id][sk]);
      assert.notEqual(PANELS[id][sk].src, "typical", id + " " + sk);
    }
  }
});

test("every catalogue AMOUNTS ingredient has a panel", () => {
  const ids = new Set();
  Object.values(cat.AMOUNTS).forEach((row) => Object.keys(row).forEach((k) => ids.add(k)));
  for (const id of ids) {
    assert.ok(PANELS[id], "missing panel for AMOUNTS item " + id);
    const p = PANELS[id];
    assert.ok(p.woolies || p.coles || p.any, id);
  }
});

test("meal-calc returns macros for a fixture meal at both stores", () => {
  const MC = calc.create({
    panels: PANELS,
    amounts: cat.AMOUNTS,
    extraAmounts: EXTRA_AMOUNTS,
    item: (id) => cat.item(id),
  });
  const w = MC.portion("toasty", "S", "woolies");
  const c = MC.portion("toasty", "S", "coles");
  assert.ok(w.k > 0 && w.p > 0);
  assert.ok(c.k > 0 && c.p > 0);
  assert.notDeepEqual(w, c);
});

test("coles breast uses woolworths panel per Evan decision", () => {
  const c = PANELS.breast.coles;
  const w = PANELS.breast.woolies;
  assert.equal(c.k, w.k);
  assert.match(c.note, /Woolworths panel/i);
});

test("every panel whose note asks to confirm has a confirm flag", () => {
  for (const id of Object.keys(PANELS)) {
    for (const sk of Object.keys(PANELS[id])) {
      const p = PANELS[id][sk];
      if (!p || !p.note) continue;
      const n = p.note.toLowerCase();
      if (n.includes("confirm on pack") || n.includes("confirm on the") || n.includes("values conflict") || n.includes("confirm before")) {
        assert.ok(typeof p.confirm === "string" && p.confirm.length > 0, id + " " + sk + " needs confirm");
      }
    }
  }
});

test("main potato uses FSANZ not baby-potato pack panels", () => {
  assert.ok(PANELS.potato.any);
  assert.equal(PANELS.potato.woolies, undefined);
  assert.equal(PANELS.potato.coles, undefined);
  assert.ok(PANELS["potato-pack"].woolies);
});
