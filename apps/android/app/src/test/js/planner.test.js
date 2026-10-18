const { test } = require("node:test");
const assert = require("node:assert/strict");
const { weekDays, planWeek, shopScore } = require("../../main/assets/weekday_fuel/planner.js");
const real = require("../../main/assets/weekday_fuel/catalogue.js");
const { MEALS } = require("../../main/assets/weekday_fuel/meals.js");
const { create } = real;

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = (size, price) => ({ name: "p", url: "u", size, price, checked: "2026-10-18" });
const ITEMS = [
  { id: "chick", sec: 1, name: "Chicken", unit: "g", coles: P(1000, 10), woolies: P(1000, 10) },
  { id: "rice", sec: 2, name: "Rice", unit: "pouches", coles: P(1, 2), woolies: P(1, 2) },
  { id: "pasta", sec: 2, name: "Pasta", unit: "g", coles: P(500, 2), woolies: P(500, 2) },
  { id: "spin", sec: 1, name: "Spinach", unit: "g", coles: P(120, 3), woolies: P(120, 3) },
  { id: "toms", sec: 1, name: "Tomatoes", unit: "g", coles: P(250, 4), woolies: P(250, 4) },
  { id: "bread", sec: 2, name: "Bread", unit: "slices", coles: P(10, 4), woolies: P(10, 4) },
  { id: "eggs", sec: 1, name: "Eggs", unit: "eggs", coles: P(12, 6), woolies: P(12, 6) },
  { id: "wo", sec: 2, name: "Woolworths only", unit: "bottles", coles: null, woolies: P(1, 7) },
];
const AMOUNTS = {
  b1: { eggs: 3, bread: 2 }, b2: { eggs: 2, spin: 20 }, b3: { bread: 2, toms: 50 },
  l1: { chick: 200, rice: 1 }, l2: { chick: 200, spin: 30 }, l3: { chick: 200, toms: 50 },
  d1: { pasta: 100, toms: 100 }, d2: { pasta: 100, chick: 180 }, d3: { rice: 1, spin: 40 }, d4: { pasta: 100, spin: 60 },
  sa: { spin: 20 }, st: { toms: 50 }, sp: { pasta: 100 }, sw: { wo: 1 },
};
const CAT = create(ITEMS, AMOUNTS);
const POOLS = { breakfast: ["b1", "b2", "b3"], lunch: ["l1", "l2", "l3"], dinner: ["d1", "d2", "d3", "d4"] };
const WEEK = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
const fitS = (calls) => (date, meals, locked) => {
  if (calls) calls.push([date, locked]);
  meals.slice(locked).forEach((m) => (m.t = "S"));
};
const opts = (o) => Object.assign({ dates: WEEK, before: {}, kept: {}, pools: POOLS, fit: fitS(), score: (dm) => shopScore(CAT, dm, "coles"), tries: 200 }, o);

function checkRules(res, o) {
  const count = {};
  const on = {};
  const add = (d, id) => {
    count[id] = (count[id] || 0) + 1;
    (on[d] = on[d] || new Set()).add(id);
  };
  Object.entries(o.before || {}).forEach(([d, ms]) => ms.forEach((m) => add(d, m.id)));
  for (const d of o.dates) {
    const ms = res.days[d];
    for (const slot of ["breakfast", "lunch", "dinner"]) assert.equal(ms.filter((m) => m.slot === slot).length, 1, d + " " + slot);
    ms.forEach((m) => add(d, m.id));
  }
  for (const [id, n] of Object.entries(count)) assert.ok(n <= 2, id + " " + n + " times");
  const ds = Object.keys(on).sort();
  for (let i = 1; i < ds.length; i++) {
    const gap = (Date.parse(ds[i]) - Date.parse(ds[i - 1])) / 864e5;
    if (gap === 1) for (const id of on[ds[i]]) assert.ok(!on[ds[i - 1]].has(id), id + " on " + ds[i - 1] + " and " + ds[i]);
  }
}

test("weekDays plans the viewed week from today on, or the next week when none are left", () => {
  assert.deepEqual(weekDays("2026-10-21", "2026-10-21"), { dates: ["2026-10-21", "2026-10-22", "2026-10-23"], before: ["2026-10-19", "2026-10-20"], label: "Suggest my week" });
  assert.deepEqual(weekDays("2026-10-23", "2026-10-23"), { dates: ["2026-10-23"], before: ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"], label: "Suggest my week" });
  for (const day of ["2026-10-24", "2026-10-25"]) {
    assert.deepEqual(weekDays(day, day), { dates: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"], before: [], label: "Suggest next week" });
  }
  assert.deepEqual(weekDays("2026-10-12", "2026-10-21"), { dates: ["2026-10-21", "2026-10-22", "2026-10-23"], before: ["2026-10-19", "2026-10-20"], label: "Suggest this week" });
  assert.deepEqual(weekDays("2026-11-04", "2026-10-21"), { dates: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"], before: [], label: "Suggest my week" });
});

test("a planned week follows the rules: one breakfast, lunch and dinner a day, lunches from the lunch pool, at most twice, never on consecutive days", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const o = opts({ rng: seeded(seed) });
    const res = planWeek(o);
    checkRules(res, o);
    for (const d of WEEK) {
      assert.ok(POOLS.lunch.includes(res.days[d].find((m) => m.slot === "lunch").id));
      assert.ok(POOLS.breakfast.includes(res.days[d].find((m) => m.slot === "breakfast").id));
      assert.ok(POOLS.dinner.includes(res.days[d].find((m) => m.slot === "dinner").id));
      res.days[d].forEach((m) => assert.equal(m.t, "S"));
    }
    assert.equal(res.distinct, new Set(WEEK.flatMap((d) => res.days[d].map((m) => m.id))).size);
  }
});

test("kept meals stay as the same objects with their portions, only empty slots are filled, and full days aren't refitted", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const keptDinner = { id: "d1", slot: "dinner", t: "X" };
    const full = [{ id: "b1", slot: "breakfast", t: "L" }, { id: "l1", slot: "lunch", t: "S" }, { id: "d2", slot: "dinner", t: "X" }];
    const calls = [];
    const o = opts({ rng: seeded(seed), kept: { "2026-10-20": [keptDinner], "2026-10-22": full }, fit: fitS(calls) });
    const res = planWeek(o);
    checkRules(res, o);
    assert.equal(res.days["2026-10-20"][0], keptDinner);
    assert.equal(keptDinner.t, "X");
    assert.equal(res.days["2026-10-20"].filter((m) => m.slot === "dinner").length, 1);
    assert.deepEqual(res.days["2026-10-22"], full);
    full.forEach((m, i) => assert.equal(res.days["2026-10-22"][i], m));
    assert.ok(!calls.some(([d]) => d === "2026-10-22"));
    assert.ok(calls.some(([d, locked]) => d === "2026-10-20" && locked === 1));
  }
});

test("earlier days of the week count towards the twice-a-week limit", () => {
  const o = opts({ dates: WEEK.slice(2), before: { "2026-10-19": [{ id: "l1", slot: "lunch", t: "S" }], "2026-10-20": [{ id: "l2", slot: "lunch", t: "S" }] }, rng: seeded(3) });
  for (let seed = 1; seed <= 10; seed++) {
    o.rng = seeded(seed);
    const res = planWeek(o);
    checkRules(res, o);
    assert.notEqual(res.days["2026-10-21"].find((m) => m.slot === "lunch").id, "l2");
  }
});

test("when the rules can't be met they are relaxed instead of failing", () => {
  const res = planWeek(opts({ pools: { breakfast: ["b1", "b2", "b3"], lunch: ["l1"], dinner: ["d1", "d2", "d3", "d4"] }, rng: seeded(5) }));
  for (const d of WEEK) assert.equal(res.days[d].find((m) => m.slot === "lunch").id, "l1");
});

test("shopScore is the whole-pack cost plus the unused part of fresh packs, using the other store when one lacks the product", () => {
  const dm = (...ids) => ids.map((meal) => ({ day: "2026-10-19", meal, t: "S" }));
  assert.equal(shopScore(CAT, dm("sa"), "coles"), 5.5);
  assert.equal(shopScore(CAT, dm("sa", "sa"), "coles"), 5);
  assert.equal(shopScore(CAT, dm("sp"), "coles"), 2);
  assert.equal(shopScore(CAT, dm("sw"), "coles"), 7);
  assert.ok(shopScore(CAT, dm("sa", "sa"), "coles") < shopScore(CAT, dm("sa", "st"), "coles"));
});

test("with near 0 the chosen week is the best-scoring one found", () => {
  const d1s = (dm) => dm.filter((x) => x.meal === "d1").length;
  const res = planWeek(opts({ rng: seeded(11), tries: 400, near: 0, score: (dm) => -d1s(dm) }));
  assert.equal(res.score, -2);
});

test("on the real meals, a planned week follows the rules and its shop is no dearer than the median of single random weeks", () => {
  const chicken = (m) => (m.batch || []).includes("chicken");
  const pools = {
    breakfast: MEALS.filter((m) => m.slots.includes("breakfast") && m.id !== "yogbowl").map((m) => m.id),
    lunch: MEALS.filter((m) => m.slots.includes("main") && chicken(m)).map((m) => m.id),
    dinner: MEALS.filter((m) => m.slots.includes("main") && !chicken(m)).map((m) => m.id),
  };
  const o = { dates: WEEK, before: {}, kept: {}, pools, fit: fitS(), score: (dm) => shopScore(real, dm, "coles"), rng: seeded(21), tries: 300 };
  const res = planWeek(o);
  checkRules(res, o);
  const random = [];
  for (let seed = 200; seed < 250; seed++) random.push(planWeek(Object.assign({}, o, { rng: seeded(seed), tries: 1 })).score);
  random.sort((a, b) => a - b);
  assert.ok(res.score <= random[25], res.score + " vs median " + random[25]);
});
