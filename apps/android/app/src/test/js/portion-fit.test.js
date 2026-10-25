const { test } = require("node:test");
const assert = require("node:assert/strict");
const PF = require("../../main/assets/weekday_fuel/portion-fit.js");

const MEAL = {
  bowl: { t: { L: { k: 400, p: 30 }, S: { k: 500, p: 35 }, X: { k: 650, p: 40 } } },
  wrap: { t: { L: { k: 350, p: 28 }, S: { k: 450, p: 32 }, X: { k: 550, p: 38 } } },
};

function baseFromMeals(meals) {
  let k = 0;
  let p = 0;
  meals.forEach((m) => {
    const v = MEAL[m.id].t[m.t];
    k += v.k;
    p += v.p;
  });
  return { k, p };
}

const ctx = {
  mealKnown: (id) => !!MEAL[id],
  mealImpliedAte: () => false,
  isBought: () => false,
  dayUnlocked: () => false,
  mealMacros: (id, t) => MEAL[id].t[t],
  dayBaseTotals: (day, date, fixedMeals) => baseFromMeals(fixedMeals),
  defaultTarget: () => ({ k: 900, p: 65 }),
};

test("planDay picks tiers closest to target", () => {
  const day = {
    meals: [
      { id: "bowl", slot: "lunch", t: "X" },
      { id: "wrap", slot: "dinner", t: "X" },
    ],
  };
  const plan = PF.planDay(day, 0, "2026-10-27", { bought: true }, ctx);
  assert.equal(plan.lines.length, 2);
  assert.equal(plan.picks.length, 2);
  assert.deepEqual(
    plan.picks.map((p) => p.t).sort(),
    plan.lines.map((l) => l.toT).sort(),
  );
});

test("planDay respects tierBy you when respectTierBy is true", () => {
  const day = {
    meals: [{ id: "bowl", slot: "lunch", t: "X", tierBy: "you" }],
  };
  const plan = PF.planDay(day, 0, "2026-10-27", { bought: true, respectTierBy: true }, ctx);
  assert.equal(plan.lines.length, 0);
  assert.deepEqual(plan.picks, [{ index: 0, t: "X" }]);
});

test("planDay can refit tierBy you when respectTierBy is false", () => {
  const lowTargetCtx = Object.assign({}, ctx, { defaultTarget: () => ({ k: 450, p: 30 }) });
  const day = {
    meals: [{ id: "bowl", slot: "lunch", t: "X", tierBy: "you" }],
  };
  const plan = PF.planDay(day, 0, "2026-10-27", { bought: true, respectTierBy: false }, lowTargetCtx);
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.lines[0].toT, "L");
  assert.equal(plan.lines[0].tierByYou, true);
});

test("planDay includes unknown fixed meals in base totals", () => {
  const ctxWithBase = Object.assign({}, ctx, {
    dayBaseTotals: (day, date, fixedMeals) => {
      assert.equal(fixedMeals.length, 1);
      assert.equal(fixedMeals[0].id, "legacy");
      return baseFromMeals(fixedMeals.filter((m) => MEAL[m.id]));
    },
  });
  const day = {
    meals: [
      { id: "legacy", slot: "lunch", t: "S" },
      { id: "bowl", slot: "dinner", t: "X" },
    ],
  };
  PF.planDay(day, 1, "2026-10-27", { bought: true }, ctxWithBase);
});

test("planDay leaves bought meals fixed when bought option is off", () => {
  const boughtCtx = Object.assign({}, ctx, { isBought: (m) => m.id === "bowl" });
  const day = {
    meals: [
      { id: "bowl", slot: "lunch", t: "X", bought: "ord" },
      { id: "wrap", slot: "dinner", t: "X" },
    ],
  };
  const plan = PF.planDay(day, 0, "2026-10-27", {}, boughtCtx);
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.lines[0].index, 1);
});
