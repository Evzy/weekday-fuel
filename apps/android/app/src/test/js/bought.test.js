const { test } = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../main/assets/weekday_fuel/bought.js");

const meal = (id, extra = {}) => ({ id, slot: "lunch", t: "S", ...extra });
const day = (meals, extra = {}) => ({ fx: { dare: true, grenade: true }, meals, extras: [], track: false, ...extra });

test("isBought is true only for a non-empty bought string", () => {
  assert.equal(B.isBought({ bought: "ord1" }), true);
  assert.equal(B.isBought({ bought: "" }), false);
  assert.equal(B.isBought({}), false);
  assert.equal(B.isBought(null), false);
});

test("markBought sets bought on shop meals and skips shop false and already bought", () => {
  const days = {
    "2026-10-20": day([meal("bowl"), meal("toasty", { shop: false }), meal("wrap", { bought: "old" })]),
  };
  const r = B.markBought(days, ["2026-10-20"], "ord2");
  assert.deepEqual(r.changed, ["2026-10-20"]);
  assert.equal(r.days["2026-10-20"].meals[0].bought, "ord2");
  assert.equal(r.days["2026-10-20"].meals[1].bought, undefined);
  assert.equal(r.days["2026-10-20"].meals[2].bought, "old");
  assert.equal(days["2026-10-20"].meals[0].bought, undefined);
});

test("markBought ignores unknown dates and bad order ids", () => {
  const days = { "2026-10-20": day([meal("bowl")]) };
  assert.deepEqual(B.markBought(days, ["2026-10-21"], "ord1").changed, []);
  assert.deepEqual(B.markBought(days, ["2026-10-20"], "").changed, []);
  assert.equal(B.markBought(days, [], "ord1").days, days);
});

test("unmarkBought removes only matching order ids", () => {
  const days = {
    "2026-10-20": day([meal("bowl", { bought: "a" }), meal("wrap", { bought: "b" })]),
    "2026-10-21": day([meal("toasty", { bought: "a" })]),
  };
  const r = B.unmarkBought(days, "a");
  assert.deepEqual(r.changed.sort(), ["2026-10-20", "2026-10-21"]);
  assert.equal(r.days["2026-10-20"].meals[0].bought, undefined);
  assert.equal(r.days["2026-10-20"].meals[1].bought, "b");
  assert.equal(days["2026-10-20"].meals[0].bought, "a");
});

test("backfillBought applies orders oldest first and skips bad orders", () => {
  const days = { "2026-10-20": day([meal("bowl"), meal("wrap")]) };
  const orders = [
    { id: "o2", at: "2026-10-22T10:00:00.000Z", days: ["2026-10-20"] },
    { id: "o1", at: "2026-10-21T10:00:00.000Z", days: ["2026-10-20"] },
    { id: "", at: "2026-10-20T10:00:00.000Z", days: ["2026-10-20"] },
    { id: "nodays", at: "2026-10-19T10:00:00.000Z" },
  ];
  const r = B.backfillBought(days, orders);
  assert.deepEqual(r.changed, ["2026-10-20"]);
  assert.equal(r.days["2026-10-20"].meals[0].bought, "o1");
  assert.equal(r.days["2026-10-20"].meals[1].bought, "o1");
});

test("clearUnbought removes uneaten unbought meals and counts them", () => {
  const days = {
    "2026-10-20": day([meal("bowl", { bought: "o1" }), meal("wrap"), meal("toasty", { ate: "2026-10-20T08:00:00.000Z" })]),
    "2026-10-21": day([meal("bowl")]),
  };
  const r = B.clearUnbought(days);
  assert.equal(r.cleared, 2);
  assert.deepEqual(r.changed.sort(), ["2026-10-20", "2026-10-21"]);
  assert.equal(r.days["2026-10-20"].meals.length, 2);
  assert.equal(r.days["2026-10-21"].meals.length, 0);
  assert.equal(days["2026-10-20"].meals.length, 3);
});
