const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../../main/assets/weekday_fuel/plans.js");
const { MEALS } = require("../../main/assets/weekday_fuel/meals.js");

const MEAL = Object.fromEntries(MEALS.map((m) => [m.id, m]));
const SLOTS = ["breakfast", "lunch", "dinner"];
const fewest = P.byId("fewest");

test("every plan day has breakfast, lunch and dinner with valid meals", () => {
  assert.ok(P.PLANS.length >= 1);
  P.PLANS.forEach((plan) => {
    assert.ok(plan.id && plan.name && plan.blurb);
    assert.ok(plan.days.length >= 1);
    plan.days.forEach((d) => {
      SLOTS.forEach((sl) => {
        const m = MEAL[d[sl]];
        assert.ok(m, plan.id + " " + sl + " " + d[sl] + " exists");
        const kind = sl === "breakfast" ? "breakfast" : "main";
        assert.ok(m.slots.includes(kind), d[sl] + " suits " + sl);
      });
    });
  });
});

test("fewest items is the approved 5-day menu", () => {
  assert.deepEqual(fewest.days, [
    { breakfast: "toasty", lunch: "tenderwrap", dinner: "buffalomac" },
    { breakfast: "toasty", lunch: "burritobowl", dinner: "buffalomac" },
    { breakfast: "toasty", lunch: "tenderwrap", dinner: "burritobowl" },
    { breakfast: "toasty", lunch: "burritobowl", dinner: "buffalomac" },
    { breakfast: "toasty", lunch: "tenderwrap", dinner: "burritobowl" },
  ]);
  assert.equal(P.byId("nope"), null);
});

test("weekdaysFrom skips weekends and crosses month ends", () => {
  assert.deepEqual(P.weekdaysFrom("2026-10-19", 5), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  assert.deepEqual(P.weekdaysFrom("2026-10-24", 2), ["2026-10-26", "2026-10-27"]);
  assert.deepEqual(P.weekdaysFrom("2026-10-29", 3), ["2026-10-29", "2026-10-30", "2026-11-02"]);
  assert.equal(P.isWeekend("2026-10-25"), true);
  assert.equal(P.isWeekend("2026-10-26"), false);
});

test("defaultStart picks the first fully empty weekday", () => {
  const days = {
    "2026-10-19": { meals: [{ id: "toasty", slot: "breakfast", t: "S" }] },
    "2026-10-20": { meals: [{ id: "yogbowl", slot: "snack", t: "S" }] },
  };
  assert.equal(P.defaultStart("2026-10-19", days), "2026-10-20");
  assert.equal(P.defaultStart("2026-10-24", {}), "2026-10-26");
});

test("defaultStart falls back to the first weekday when 14 days are planned", () => {
  const days = {};
  P.weekdaysFrom("2026-10-19", 10).forEach((d) => {
    days[d] = { meals: SLOTS.map((sl) => ({ id: "x", slot: sl, t: "S" })) };
  });
  assert.equal(P.defaultStart("2026-10-19", days), "2026-10-19");
  assert.equal(P.defaultStart("2026-10-25", days), "2026-11-02");
});

test("fill adds the plan to empty days in slot order", () => {
  const r = P.fill(fewest, "2026-10-19", {});
  assert.deepEqual(r.dates, ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  assert.equal(r.added, 15);
  assert.equal(r.kept, 0);
  assert.deepEqual(r.changes["2026-10-19"].meals, [
    { id: "toasty", slot: "breakfast", t: "S" },
    { id: "tenderwrap", slot: "lunch", t: "S" },
    { id: "buffalomac", slot: "dinner", t: "S" },
  ]);
  assert.deepEqual(r.changes["2026-10-19"].added, ["breakfast", "lunch", "dinner"]);
});

test("fill keeps existing and bought slots and leaves snacks alone", () => {
  const bought = { id: "oats", slot: "breakfast", t: "L", bought: "2026-10-18T01:00:00.000Z" };
  const snack = { id: "yogbowl", slot: "snack", t: "S" };
  const days = { "2026-10-19": { meals: [snack, bought], extras: [], track: false } };
  const r = P.fill(fewest, "2026-10-19", days);
  const c = r.changes["2026-10-19"];
  assert.deepEqual(c.added, ["lunch", "dinner"]);
  assert.deepEqual(c.meals, [
    bought,
    { id: "tenderwrap", slot: "lunch", t: "S" },
    snack,
    { id: "buffalomac", slot: "dinner", t: "S" },
  ]);
  assert.equal(r.kept, 1);
  assert.equal(r.added, 14);
  assert.deepEqual(days["2026-10-19"].meals, [snack, bought], "input not mutated");
});

test("fill skips a fully planned day", () => {
  const full = { meals: SLOTS.map((sl) => ({ id: "x", slot: sl, t: "S" })) };
  const r = P.fill(fewest, "2026-10-19", { "2026-10-19": full });
  assert.equal(r.changes["2026-10-19"], undefined);
  assert.equal(r.kept, 3);
  assert.equal(r.added, 12);
});

test("fill on a weekend start begins on Monday", () => {
  const r = P.fill(fewest, "2026-10-24", {});
  assert.equal(r.dates[0], "2026-10-26");
});

test("mealCounts and summary", () => {
  assert.deepEqual(P.mealCounts(fewest), { toasty: 5, tenderwrap: 3, buffalomac: 3, burritobowl: 4 });
  let seen = null;
  const s = P.summary(fewest, (counts) => {
    seen = counts;
    return { items: 14, total: 101.03 };
  });
  assert.deepEqual(seen, P.mealCounts(fewest));
  assert.deepEqual(s, { items: 14, costPerDay: 20.21 });
});
