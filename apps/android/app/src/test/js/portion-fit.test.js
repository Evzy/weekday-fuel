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
  mealMacros: (mOrId, t) => {
    const id = typeof mOrId === "string" ? mOrId : mOrId.id;
    return MEAL[id].t[t];
  },
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

test("gym then rest target re-fits only app-chosen, uneaten meals; hand picks stay", () => {
  const ateCtx = Object.assign({}, ctx, { mealImpliedAte: (m) => m.ate === true });
  const day = {
    meals: [
      { id: "bowl", slot: "breakfast", t: "L", ate: true },
      { id: "wrap", slot: "lunch", t: "L", tierBy: "you" },
      { id: "bowl", slot: "dinner", t: "L" },
    ],
  };
  const apply = (plan) => plan.lines.forEach((ln) => { day.meals[ln.index].t = ln.toT; });
  const opts = (k) => ({ bought: true, respectTierBy: true, target: { k, p: 0 } });
  const rest = PF.planDay(day, 0, "2026-10-27", opts(1250), ateCtx);
  apply(rest);
  const restT = day.meals[2].t;
  assert.equal(restT, "S");
  const gym = PF.planDay(day, 0, "2026-10-27", opts(1400), ateCtx);
  assert.deepEqual(gym.lines.map((l) => l.index), [2]);
  apply(gym);
  assert.equal(day.meals[2].t, "X");
  assert.equal(day.meals[0].t, "L");
  assert.equal(day.meals[1].t, "L");
  apply(PF.planDay(day, 0, "2026-10-27", opts(1250), ateCtx));
  assert.equal(day.meals[2].t, restT);
  assert.equal(day.meals[1].t, "L");
  assert.equal(day.meals[1].tierBy, "you");
});

test("planDay reports how many meals it was free to change", () => {
  const day = {
    meals: [
      { id: "bowl", slot: "lunch", t: "X", tierBy: "you" },
      { id: "wrap", slot: "dinner", t: "X" },
    ],
  };
  assert.equal(PF.planDay(day, 0, "2026-10-27", { bought: true, respectTierBy: true }, ctx).free, 1);
  assert.equal(PF.planDay(day, 2, "2026-10-27", { bought: true, respectTierBy: true }, ctx).free, 0);
  assert.equal(PF.planDay(day, 0, "2026-10-27", { bought: true }, ctx).free, 2);
});

test("handPickedOnlyDates lists days with only tierBy you changes and no rest lines", () => {
  const full = [
    { date: "2026-10-20", tierByYou: false },
    { date: "2026-10-21", tierByYou: true },
    { date: "2026-10-22", tierByYou: true },
  ];
  const rest = [{ date: "2026-10-20" }];
  assert.deepEqual(PF.handPickedOnlyDates(full, rest), ["2026-10-21", "2026-10-22"]);
  assert.deepEqual(PF.handPickedOnlyDates(full, []), ["2026-10-21", "2026-10-22"]);
});
