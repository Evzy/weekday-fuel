const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../../main/assets/weekday_fuel/targets.js");

const base = () => ({ mode: "cut", kcal: { cut: 1900, recomp: 2250, bulk: 2550 }, protein: 170, adjust: 0, gymBonus: 250, restTargets: true });

test("rest day is the mode kcal plus adjust", () => {
  const s = Object.assign(base(), { adjust: -150 });
  assert.deepEqual(T.forDay(s, {}), { k: 1750, p: 170 });
  assert.deepEqual(T.forDay(s, null), { k: 1750, p: 170 });
});

test("gym day adds the bonus, and per-day adj still applies", () => {
  const s = base();
  assert.equal(T.forDay(s, { gym: true }).k, 2150);
  assert.equal(T.forDay(s, { gym: true, adj: { k: -100 } }).k, 2050);
  assert.equal(T.forDay(s, { gym: false }).k, 1900);
  assert.equal(T.forDay(Object.assign(base(), { gymBonus: undefined }), { gym: true }).k, 2150);
});

test("non-number per-day adj and gymBonus are ignored, as before", () => {
  assert.equal(T.forDay(base(), { adj: { k: "100" } }).k, 1900);
  assert.equal(T.forDay(Object.assign(base(), { gymBonus: "300" }), { gym: true }).k, 2150);
});

test("gym label shows the actual bonus", () => {
  assert.equal(T.gymLabel(base(), { gym: true }), " · +250 gym");
  assert.equal(T.gymLabel(Object.assign(base(), { gymBonus: 300 }), { gym: true }), " · +300 gym");
  assert.equal(T.gymLabel(base(), {}), "");
});

test("migrate moves old defaults to rest-day defaults", () => {
  const r = T.migrate({ mode: "cut", kcal: { cut: 2150, recomp: 2500, bulk: 2800 }, protein: 170, adjust: 0 });
  assert.deepEqual(r.settings.kcal, { cut: 1900, recomp: 2250, bulk: 2550 });
  assert.equal(r.settings.gymBonus, 250);
  assert.equal(r.settings.restTargets, true);
  assert.equal(r.changed, true);
  assert.equal(r.note, null);
});

test("migrate keeps custom values and returns the check note", () => {
  const r = T.migrate({ mode: "cut", kcal: { cut: 2000, recomp: 2500, bulk: 2800 }, protein: 170, adjust: 0 });
  assert.deepEqual(r.settings.kcal, { cut: 2000, recomp: 2250, bulk: 2550 });
  assert.equal(r.note, "Your kcal targets are now rest-day targets; gym days add 250. Check your numbers in Targets.");
});

test("migrate treats the new defaults as not custom, so a fresh install gets no note", () => {
  const r = T.migrate({ mode: "recomp", kcal: { cut: 1900, recomp: 2250, bulk: 2550 }, protein: 170, adjust: 0, gymBonus: 250 });
  assert.equal(r.changed, true);
  assert.equal(r.note, null);
  assert.deepEqual(r.settings.kcal, { cut: 1900, recomp: 2250, bulk: 2550 });
});

test("migrate is a no-op once restTargets is set", () => {
  const s = Object.assign(base(), { kcal: { cut: 2150, recomp: 2500, bulk: 2800 } });
  const r = T.migrate(s);
  assert.equal(r.changed, false);
  assert.deepEqual(r.settings.kcal, s.kcal);
});

test("migrate does not mutate its input", () => {
  const s = { mode: "cut", kcal: { cut: 2150, recomp: 2500, bulk: 2800 }, protein: 170, adjust: 0 };
  T.migrate(s);
  assert.equal(s.kcal.cut, 2150);
  assert.equal(s.restTargets, undefined);
});

test("refit note wording", () => {
  assert.equal(T.refitNote(true, 2150, 2), "Gym day: portions re-fitted to 2150 kcal.");
  assert.equal(T.refitNote(false, 1900, 1), "Rest day: portions re-fitted to 1900 kcal.");
  assert.equal(T.refitNote(true, 2150, 0), "Portions already fit 2150 kcal.");
  assert.equal(T.refitNote(true, 2150, -1), "Gym day: target 2150 kcal.");
});

test("refit note when every meal is already set", () => {
  assert.equal(T.refitNote(true, 2150, -2), "Gym day: target 2150 kcal; meals are already set.");
  assert.equal(T.refitNote(false, 1900, -2), "Rest day: target 1900 kcal; meals are already set.");
});
