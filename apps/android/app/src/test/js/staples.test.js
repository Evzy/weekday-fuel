const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../main/assets/weekday_fuel/staples.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const I = require("../../main/assets/weekday_fuel/inventory.js");
const { PANELS } = require("../../main/assets/weekday_fuel/macros.js");
const calc = require("../../main/assets/weekday_fuel/meal-calc.js");
const MC = calc.create({ panels: PANELS, amounts: cat.AMOUNTS, extraAmounts: {}, item: (id) => cat.item(id) });
const macroCtx = (store) => ({ store: store || "woolies", stapleMacros: (id, amt, st, swap) => MC.stapleMacros(id, amt, st || store || "woolies", swap) });

const staple = (id, amount, days, extra) => Object.assign({ id, amount, days: days || "weekdays" }, extra || {});

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

test("parse of a non-array uses defaults", () => {
  assert.deepEqual(S.parse("nope", cat), S.parse(S.DEFAULTS, cat));
  assert.deepEqual(S.parse({}, cat), S.parse(S.DEFAULTS, cat));
});

test("parse keeps from and until and allows same id when ranges do not overlap", () => {
  const list = [
    staple("dare", 1, "weekdays", { until: "2026-10-18" }),
    staple("dare", 2, "weekdays", { from: "2026-10-19" }),
  ];
  const p = S.parse(list, cat);
  assert.equal(p.length, 2);
  assert.equal(p[0].until, "2026-10-18");
  assert.equal(p[1].from, "2026-10-19");
});

test("parse drops overlapping ranges for the same id", () => {
  const list = [staple("dare", 1, "weekdays"), staple("dare", 2, "weekdays", { from: "2026-10-01" })];
  assert.equal(S.parse(list, cat).length, 1);
});

test("onDay follows weekday, weekend, track, skip and date range rules", () => {
  const s = staple("dare", 1, "weekdays");
  assert.equal(S.onDay(s, "2026-10-19", {}), true);
  assert.equal(S.onDay(s, "2026-10-18", {}), false);
  assert.equal(S.onDay(s, "2026-10-18", { track: true }), true);
  assert.equal(S.onDay(s, "2026-10-19", { fx: { dare: false } }), false);
  assert.equal(S.onDay(s, "2026-10-18", { fx: { dare: true } }), true);
  assert.equal(S.onDay(staple("dare", 1, "weekdays", { from: "2026-10-20" }), "2026-10-19", {}), false);
  assert.equal(S.onDay(staple("dare", 1, "weekdays", { until: "2026-10-18" }), "2026-10-19", {}), false);
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
  const dare = S.macros("dare", 1, cat, macroCtx());
  assert.ok(dare);
  assert.equal(dare.k, 296.5);
  assert.equal(dare.p, 30);
  const yog = S.macros("yog", 170, cat, macroCtx());
  assert.equal(yog.k, 95);
  assert.equal(S.macros("nope", 1, cat, macroCtx()), null);
});

test("macros null when counted item has no unitSize", () => {
  const fake = {
    item: (id) => (id === "x" ? { id: "x", unit: "bars" } : cat.item(id)),
  };
  assert.equal(S.macros("x", 1, fake, macroCtx()), null);
});

test("cost uses store pack price with fallback", () => {
  const w = S.cost("dare", 1, cat, "woolies");
  const c = S.cost("dare", 1, cat, "coles");
  assert.ok(w > 0 && c > 0);
  assert.equal(S.cost("nope", 1, cat, "woolies"), null);
  assert.ok(S.cost("wraps", 1, cat, "coles") > 0);
});

test("cost uses deli perKg pricing", () => {
  assert.ok(S.cost("ham", 100, cat, "woolies") > 0);
});

test("spanDates fills every calendar day from first to last shop day", () => {
  assert.deepEqual(S.spanDates([]), []);
  assert.deepEqual(S.spanDates(["2026-10-23"]), ["2026-10-23"]);
  assert.deepEqual(S.spanDates(["2026-10-23", "2026-10-19"]), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
});

test("needs counts weekday staples on gap days inside the shop span", () => {
  const staples = S.parse(S.DEFAULTS, cat);
  const shopOnly = S.needs(staples, ["2026-10-20", "2026-10-22"], {});
  const withGap = S.needs(staples, S.spanDates(["2026-10-20", "2026-10-22"]), {});
  assert.equal(shopOnly.dare, 2);
  assert.equal(withGap.dare, 3);
  assert.equal(withGap.grenade, 3);
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

test("adding yog today does not change past stock", () => {
  const START = new Date(2026, 9, 10, 8, 0, 0).toISOString();
  const base = I.addEvents(null, [{ k: "buy", item: "yog", amount: 2000, order: "o1" }], START);
  const staplesOn = (d) => S.forDay(S.parse(S.applyAdd(S.DEFAULTS, { id: "yog", amount: 170, days: "all" }, "2026-10-19", cat), cat), d, {});
  const before = I.stock(base, {}, cat, new Date(2026, 9, 18, 12, 0, 0), staplesOn);
  const after = I.stock(base, {}, cat, new Date(2026, 9, 18, 12, 0, 0), staplesOn);
  assert.equal(before.yog && before.yog.amount, after.yog && after.yog.amount);
  assert.equal(before.yog.amount, 2000);
});

test("removing dare does not refund past days", () => {
  const START = new Date(2026, 9, 10, 8, 0, 0).toISOString();
  const base = I.addEvents(null, [{ k: "buy", item: "dare", amount: 10, order: "o1" }], START);
  const fxDays = new Set(["2026-10-10", "2026-10-11", "2026-10-13"]);
  const staplesOnOld = (d) => (fxDays.has(d) ? [{ id: "dare", amount: 1 }] : []);
  const sOld = I.stock(base, {}, cat, new Date(2026, 9, 13, 12, 0, 0), staplesOnOld);
  const list = S.applyRemove(S.DEFAULTS, "dare", "2026-10-14", cat);
  const staplesOnNew = (d) => S.forDay(list, d, {});
  const sNew = I.stock(base, {}, cat, new Date(2026, 9, 13, 12, 0, 0), staplesOnNew);
  assert.equal(sOld.dare.amount, sNew.dare.amount);
});

test("editing amount keeps old days at the old amount", () => {
  const list = S.applyEdit(S.DEFAULTS, "dare", { amount: 2, days: "weekdays" }, "2026-10-19", cat);
  const dareOn = (date) => S.forDay(list, date, {}).find((s) => s.id === "dare");
  assert.equal(dareOn("2026-10-16").amount, 1);
  assert.equal(dareOn("2026-10-19").amount, 2);
});

test("day totals for past dates unchanged after edits", () => {
  const list = S.applyEdit(S.DEFAULTS, "dare", { amount: 2, days: "weekdays" }, "2026-10-19", cat);
  const kOld = S.forDay(list, "2026-10-17", {}).reduce((a, s) => a + S.macros(s.id, s.amount, cat, macroCtx()).k, 0);
  const kPast = S.forDay(S.parse(S.DEFAULTS, cat), "2026-10-17", {}).reduce((a, s) => a + S.macros(s.id, s.amount, cat, macroCtx()).k, 0);
  assert.equal(kOld, kPast);
});

test("reserved sums staples with amount greater than one", () => {
  const START = "2026-10-10T08:00:00.000Z";
  const base = I.addEvents(null, [{ k: "buy", item: "yog", amount: 500, order: "o1" }], START);
  const staples = S.parse([staple("yog", 2, "all", { from: "2026-10-10" })], cat);
  const staplesOn = (d) => S.forDay(staples, d, {});
  const r = I.reserved(base, {}, cat, "2026-10-18", ["2026-10-21"], staplesOn);
  assert.equal(r.yog, 4);
});

test("applyAdd edits when id is already active on that date", () => {
  const today = "2026-10-19";
  const parsed = S.parse(S.DEFAULTS, cat);
  const next = S.applyAdd(parsed, { id: "dare", amount: 2, days: "all" }, today, cat);
  const dare = S.activeStaples(next, today).find((s) => s.id === "dare");
  assert.equal(dare.amount, 2);
  assert.equal(dare.days, "all");
  assert.equal(next.filter((s) => s.id === "dare").length, 2);
});

test("parse keeps out only when true and round-trips applyEdit", () => {
  const withOut = S.parse([staple("dare", 1, "weekdays", { out: true }), staple("grenade", 1, "weekdays", { out: "yes" })], cat);
  assert.equal(withOut.length, 2);
  assert.equal(withOut[0].out, true);
  assert.equal(withOut[1].out, undefined);
  const edited = S.applyEdit(S.DEFAULTS, "dare", { amount: 1, days: "weekdays", out: true }, "2026-10-19", cat);
  const dare = S.activeStaples(edited, "2026-10-19").find((s) => s.id === "dare");
  assert.equal(dare.out, true);
  const cleared = S.applyEdit(edited, "dare", { amount: 1, days: "weekdays", out: false }, "2026-10-20", cat);
  const dare2 = S.activeStaples(cleared, "2026-10-20").find((s) => s.id === "dare");
  assert.equal(dare2.out, undefined);
});

test("needs skips out staples", () => {
  const staples = S.parse([staple("dare", 1, "weekdays", { out: true }), staple("grenade", 1, "weekdays")], cat);
  const n = S.needs(staples, ["2026-10-19", "2026-10-20"], {});
  assert.equal(n.dare, undefined);
  assert.equal(n.grenade, 2);
});

test("choiceMacros uses swap per times amount with c/f fallback", () => {
  const dare750 = S.choiceMacros("dare", 1, "dare-750", cat, macroCtx());
  assert.equal(dare750.k, 444);
  assert.equal(dare750.p, 45);
  assert.equal(dare750.c, 38.3);
  assert.equal(dare750.f, 12);
  const base = S.macros("dare", 1, cat, macroCtx());
  const mocha = S.choiceMacros("dare", 1, "dare-mocha", cat, macroCtx());
  assert.equal(mocha.k, 292);
  assert.ok(Math.abs(mocha.c - base.c * (292 / base.k)) < 0.05);
  assert.equal(S.choiceMacros("dare", 1, "nope", cat, macroCtx()).k, base.k);
  const two = S.choiceMacros("dare", 2, "dare-750", cat, macroCtx());
  assert.equal(two.k, 888);
  assert.equal(two.p, 90);
});

test("out staples are not reserved from stock", () => {
  const START = "2026-10-10T08:00:00.000Z";
  const base = I.addEvents(null, [{ k: "buy", item: "dare", amount: 10, order: "o1" }], START);
  const staples = S.parse([staple("dare", 1, "weekdays", { out: true, from: "2026-10-10" })], cat);
  const staplesOn = (d) => S.forDay(staples, d, {});
  const r = I.reserved(base, {}, cat, "2026-10-18", ["2026-10-21"], staplesOn);
  assert.equal(r.dare, undefined);
});

test("migrateLegacyFx strips default fx flags only", () => {
  const days = {
    "2026-10-19": { meals: [], fx: { dare: true, grenade: true } },
    "2026-10-18": { meals: [], track: false, fx: { dare: false, grenade: false } },
    "2026-10-20": { meals: [], fx: { dare: false } },
    "2026-10-25": { meals: [], track: false, fx: { dare: true } },
    "2026-10-24": { meals: [], track: true, fx: { dare: true, grenade: true } },
  };
  const r = S.migrateLegacyFx(days);
  assert.equal(r.changed, true);
  assert.equal(r.days["2026-10-19"].fx, undefined);
  assert.equal(r.days["2026-10-18"].fx, undefined);
  assert.equal(r.days["2026-10-20"].fx.dare, false);
  assert.equal(r.days["2026-10-25"].fx.dare, true);
  assert.equal(r.days["2026-10-24"].fx.dare, true);
});
