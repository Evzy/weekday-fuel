const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../main/assets/weekday_fuel/staples.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const { MACROS } = require("../../main/assets/weekday_fuel/macros.js");

const staple = (id, amount, days) => ({ id, amount, days: days || "weekdays" });

test("parse keeps valid staples and drops bad rows", () => {
  const list = [
    staple("dare", 1),
    staple("dare", 2),
    staple("nope", 1),
    staple("grenade", 0),
    staple("yog", 170, "all"),
    { id: "eggs", amount: 2, days: "sometimes" },
  ];
  const p = S.parse(list, cat);
  assert.deepEqual(p, [
    { id: "dare", amount: 1, days: "weekdays" },
    { id: "yog", amount: 170, days: "all" },
  ]);
});

test("parse defaults when list is null", () => {
  assert.deepEqual(S.parse(null, cat), S.parse(S.DEFAULTS, cat));
});

test("onDay follows weekday, weekend, track and skip rules", () => {
  const s = staple("dare", 1, "weekdays");
  assert.equal(S.onDay(s, "2026-10-19", {}), true);
  assert.equal(S.onDay(s, "2026-10-18", {}), false);
  assert.equal(S.onDay(s, "2026-10-18", { track: true }), true);
  assert.equal(S.onDay(s, "2026-10-19", { fx: { dare: false } }), false);
  const all = staple("yog", 170, "all");
  assert.equal(S.onDay(all, "2026-10-18", {}), true);
});

test("forDay lists staples on for that date", () => {
  const staples = S.parse(S.DEFAULTS, cat);
  const mon = S.forDay(staples, "2026-10-19", {});
  assert.deepEqual(mon.map((x) => x.id).sort(), ["dare", "grenade"]);
  assert.equal(S.forDay(staples, "2026-10-18", {}).length, 0);
});

test("macros for counted and mass units", () => {
  const dare = S.macros("dare", 1, cat, MACROS);
  assert.ok(dare);
  assert.equal(dare.k, 295);
  assert.equal(dare.p, 30);
  const yog = S.macros("yog", 170, cat, MACROS);
  assert.equal(yog.k, 95.2);
  assert.equal(S.macros("nope", 1, cat, MACROS), null);
});

test("cost uses store pack price with fallback", () => {
  const w = S.cost("dare", 1, cat, "woolies");
  const c = S.cost("dare", 1, cat, "coles");
  assert.ok(w > 0 && c > 0);
  assert.equal(S.cost("nope", 1, cat, "woolies"), null);
});

test("needs sums staple amounts over shop dates", () => {
  const staples = S.parse(S.DEFAULTS, cat);
  const days = {
    "2026-10-19": {},
    "2026-10-20": {},
    "2026-10-21": {},
    "2026-10-24": {},
    "2026-10-25": { track: true },
  };
  const n = S.needs(staples, ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-24", "2026-10-25"], days);
  assert.equal(n.dare, 4);
  assert.equal(n.grenade, 4);
});

test("shopList staple map matches sec-0 fixture day count", () => {
  const byNumber = cat.shopList({}, 5);
  const byMap = cat.shopList({}, { dare: 5, grenade: 5 });
  assert.deepEqual(
    byMap.map((r) => ({ id: r.id, need: r.need })).sort((a, b) => a.id.localeCompare(b.id)),
    byNumber.map((r) => ({ id: r.id, need: r.need })).sort((a, b) => a.id.localeCompare(b.id)),
  );
});

test("shopList with no shop days omits staples when need map is empty", () => {
  assert.deepEqual(cat.shopList({}, {}), []);
});

test("shopList adds staple needs to meal needs for the same item", () => {
  const rows = cat.shopList({}, { yog: 170 }, [{ day: "2026-10-20", meal: "yogbowl", t: "S" }]);
  const yog = rows.find((r) => r.id === "yog");
  assert.ok(yog);
  assert.equal(yog.need, 420);
});
