const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../../main/assets/weekday_fuel/cartadd.js");

const B = { id: "toasty", slots: ["breakfast"] };
const M = { id: "tenderwrap", slots: ["main"] };
const SN = { id: "yogbowl", slots: ["snack"] };
const BS = { id: "oats", slots: ["breakfast", "snack"] };
const m = (id, slot, extra = {}) => ({ id, slot, t: "S", ...extra });
const isBought = (x) => typeof x.bought === "string" && x.bought !== "";
const noWeekend = () => false;

test("naturalSlot", () => {
  assert.equal(C.naturalSlot(B, []), "breakfast");
  assert.equal(C.naturalSlot(M, []), "lunch");
  assert.equal(C.naturalSlot(M, [m("a", "lunch")]), "dinner");
  assert.equal(C.naturalSlot(M, [m("a", "lunch"), m("b", "dinner")]), "lunch");
  assert.equal(C.naturalSlot(SN, [m("a", "snack")]), "snack");
  assert.equal(C.naturalSlot(BS, []), "breakfast");
});

test("place treats custom isEaten like stored ate", () => {
  const implied = (m) => m && m.implied;
  const breakfast = m("a", "breakfast", { implied: true });
  assert.deepEqual(C.place(B, [breakfast], isBought, implied), {
    action: "locked",
    slot: "breakfast",
    existing: breakfast,
    options: [],
  });
});

test("place: add, ask, locked, snack always adds", () => {
  assert.deepEqual(C.place(B, [], isBought), { action: "add", slot: "breakfast" });
  const lunch = m("a", "lunch"),
    dinner = m("b", "dinner");
  assert.deepEqual(C.place(M, [lunch, dinner], isBought), {
    action: "ask",
    slot: "lunch",
    existing: lunch,
    options: [
      { slot: "lunch", existing: lunch, index: 0 },
      { slot: "dinner", existing: dinner, index: 1 },
    ],
  });
  const boughtB = m("c", "breakfast", { bought: "o1" });
  assert.deepEqual(C.place(B, [boughtB], isBought), {
    action: "locked",
    slot: "breakfast",
    existing: boughtB,
    options: [],
  });
  const ateB = m("c", "breakfast", { ate: "2026-10-19" });
  assert.equal(C.place(B, [ateB], isBought).action, "locked");
  assert.deepEqual(C.place(SN, [m("x", "snack")], isBought), { action: "add", slot: "snack" });
});

test("place options: one main slot locked, breakfast unlocks, snack unaffected", () => {
  const lunch = m("a", "lunch", { bought: "o1" }),
    dinner = m("b", "dinner");
  assert.deepEqual(C.place(M, [lunch, dinner], isBought), {
    action: "ask",
    slot: "lunch",
    existing: lunch,
    options: [{ slot: "dinner", existing: dinner, index: 1 }],
  });
  const lunch2 = m("a", "lunch", { bought: "o1" }),
    dinner2 = m("b", "dinner", { ate: "2026-10-19" });
  assert.deepEqual(C.place(M, [lunch2, dinner2], isBought), {
    action: "locked",
    slot: "lunch",
    existing: lunch2,
    options: [],
  });
  const b1 = m("toasty", "breakfast"),
    b2 = m("eggmuffin", "breakfast");
  assert.deepEqual(C.place(B, [b1, b2], isBought), {
    action: "ask",
    slot: "breakfast",
    existing: b1,
    options: [
      { slot: "breakfast", existing: b1, index: 0 },
      { slot: "breakfast", existing: b2, index: 1 },
    ],
  });
  assert.deepEqual(C.place(SN, [m("x", "snack")], isBought), { action: "add", slot: "snack" });
});

test("apply extra keeps, replace removes first unbought uneaten, sorted and pure", () => {
  const b1 = m("toasty", "breakfast"),
    d1 = m("bowl", "dinner"),
    l1 = m("wrap", "lunch");
  const input = [d1, b1, l1];
  const r1 = C.apply(input, "mac", "lunch", "extra");
  assert.deepEqual(r1.meals.map((x) => x.id), ["toasty", "wrap", "mac", "bowl"]);
  assert.ok(r1.meals.includes(r1.added));
  assert.deepEqual(r1.added, { id: "mac", slot: "lunch", t: "S" });
  assert.deepEqual(input.map((x) => x.id), ["bowl", "toasty", "wrap"], "input not mutated");
  const lb = m("old", "lunch", { bought: "o1" }),
    l2 = m("wrap", "lunch");
  const r2 = C.apply([lb, l2], "mac", "lunch", "replace");
  assert.deepEqual(r2.meals.map((x) => x.id), ["old", "mac"]);
  assert.equal(r2.meals[0], lb);
  const r3 = C.apply([], "toasty", "breakfast", "add");
  assert.deepEqual(r3.meals, [{ id: "toasty", slot: "breakfast", t: "S" }]);
});

test("apply replace by targetIndex removes the chosen same-slot meal", () => {
  const b1 = m("toasty", "breakfast");
  const b2 = m("eggmuffin", "breakfast");
  const r = C.apply([b1, b2], "oats", "breakfast", "replace", isBought, undefined, 1);
  assert.deepEqual(r.meals.map((x) => x.id), ["toasty", "oats"]);
  const l1 = m("wrap", "lunch");
  const l2 = m("mac", "lunch");
  const r2 = C.apply([l1, l2], "new", "lunch", "replace", isBought, undefined, 1);
  assert.deepEqual(r2.meals.map((x) => x.id), ["wrap", "new"]);
});

test("apply replace skips an eaten meal in slot", () => {
  const ate = m("old", "lunch", { ate: "2026-10-19" });
  const r = C.apply([ate], "mac", "lunch", "replace");
  assert.deepEqual(r.meals.map((x) => x.id), ["old", "mac"]);
});

test("apply unknown slot sorts last", () => {
  const r = C.apply([m("a", "breakfast")], "x", "weird", "extra");
  assert.deepEqual(r.meals.map((x) => x.id), ["a", "x"]);
  assert.equal(r.meals[1].slot, "weird");
});

test("cartDays: today on, unbought, in shop, known meals, sorted", () => {
  const days = {
    "2026-10-18": { meals: [m("a", "lunch")] },
    "2026-10-21": { meals: [m("a", "lunch")] },
    "2026-10-19": { meals: [m("a", "lunch")] },
    "2026-10-20": { meals: [m("a", "lunch", { bought: "o" }), m("b", "dinner", { shop: false })] },
    "2026-10-22": { meals: [m("zzz", "lunch")] },
    "2026-10-23": { meals: [] },
  };
  assert.deepEqual(C.cartDays(days, "2026-10-19", isBought, (id) => id !== "zzz"), ["2026-10-19", "2026-10-21"]);
  assert.deepEqual(C.cartDays(null, "2026-10-19", isBought, () => true), []);
});

test("dayFlags", () => {
  assert.deepEqual(C.dayFlags("2026-10-20", 1, "2026-10-19", noWeekend), { few: 1, ahead: null });
  assert.deepEqual(C.dayFlags("2026-10-20", 3, "2026-10-19", noWeekend), { few: null, ahead: null });
  assert.equal(C.dayFlags("2026-10-24", 1, "2026-10-19", noWeekend).few, null, "untracked Saturday");
  assert.equal(C.dayFlags("2026-10-24", 1, "2026-10-19", () => true).few, 1, "tracked Saturday");
  assert.equal(C.dayFlags("2026-10-26", 3, "2026-10-19", noWeekend).ahead, null, "7 days");
  assert.equal(C.dayFlags("2026-10-27", 3, "2026-10-19", noWeekend).ahead, "In 8 days");
  assert.equal(C.dayFlags("2026-11-02", 3, "2026-10-19", noWeekend).ahead, "In 2 weeks");
  assert.equal(C.dayFlags("2026-11-09", 3, "2026-10-19", noWeekend).ahead, "In 3 weeks");
});

test("gapLabel", () => {
  assert.equal(C.gapLabel("2026-10-19", "2026-10-20", noWeekend), null);
  assert.equal(C.gapLabel("2026-10-23", "2026-10-26", noWeekend), null, "Fri to Mon");
  assert.equal(C.gapLabel("2026-10-23", "2026-10-26", (d) => d === "2026-10-24"), "3 days later", "tracked Sat between");
  assert.equal(C.gapLabel("2026-10-19", "2026-10-21", noWeekend), "2 days later");
  assert.equal(C.gapLabel("2026-10-19", "2026-10-28", noWeekend), "9 days later");
  assert.equal(C.gapLabel("2026-10-30", "2026-11-03", noWeekend), "4 days later", "Fri to Tue across a month");
});
