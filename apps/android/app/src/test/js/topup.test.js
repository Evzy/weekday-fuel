const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../../main/assets/weekday_fuel/topup.js");
const S = require("../../main/assets/weekday_fuel/staples.js");

const addDays = (d, n) => T.addDays(d, n);
const tracked = (d) => T.isWeekday(d);
const hasMeals = () => false;
const span = (dates) => S.spanDates(dates);
const weekdayActive = (d) => T.isWeekday(d);
const staplesWeekdays = [{ id: "dare", amount: 1, days: "weekdays" }];

test("gapToMin reports under and reached", () => {
  assert.deepEqual(T.gapToMin(38.4, 50), { total: 38.4, min: 50, gap: 11.6, under: true });
  assert.deepEqual(T.gapToMin(50, 50), { total: 50, min: 50, gap: 0, under: false });
  assert.deepEqual(T.gapToMin(55, 50), { total: 55, min: 50, gap: 0, under: false });
});

test("nextPlanDay finds first tracked empty day after cart or after today", () => {
  const opts = (cart, today) => ({
    cartDays: cart,
    today,
    isTracked: tracked,
    hasMeals,
    addDays,
  });
  assert.equal(T.nextPlanDay(opts(["2026-10-20", "2026-10-21"], "2026-10-19")), "2026-10-22");
  assert.equal(T.nextPlanDay(opts([], "2026-10-20")), "2026-10-21");
  assert.equal(
    T.nextPlanDay(Object.assign(opts([], "2026-10-24"), { isTracked: () => false })),
    null,
  );
});

test("stapleSpanDatesForUntil extends the shop span through until", () => {
  assert.deepEqual(
    T.stapleSpanDatesForUntil(["2026-10-20", "2026-10-22"], "2026-10-24", span, addDays),
    ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"],
  );
  assert.deepEqual(T.stapleSpanDatesForUntil(["2026-10-20"], null, span, addDays), ["2026-10-20"]);
});

test("readShopStapleUntil reads until and legacy forms without mutating", () => {
  const cart = ["2026-10-20", "2026-10-21"];
  assert.equal(T.readShopStapleUntil({ until: "2026-10-25" }, cart, "2026-10-19", span, addDays), "2026-10-25");
  assert.equal(T.readShopStapleUntil(2, cart, "2026-10-19", span, addDays), "2026-10-23");
  assert.equal(
    T.readShopStapleUntil({ n: 2, after: "2026-10-21" }, cart, "2026-10-19", span, addDays),
    "2026-10-23",
  );
  assert.equal(T.readShopStapleUntil({ until: "2026-10-18" }, cart, "2026-10-19", span, addDays), null);
});

test("targetUntilAddingStapleDays counts only staple-active days", () => {
  const fri = "2026-10-23";
  assert.equal(T.untilAfterStapleActiveDays(fri, 1, weekdayActive, addDays), "2026-10-26");
  assert.equal(T.targetUntilAddingStapleDays(fri, null, 2, weekdayActive, addDays), "2026-10-27");
});

test("plan day after staples until keeps until and staple need total", () => {
  const cart = ["2026-10-20"];
  const shopEnd = T.shopSpanLast(cart, span);
  const until = T.targetUntilAddingStapleDays(shopEnd, null, 2, weekdayActive, addDays);
  assert.equal(until, "2026-10-22");
  const cartAfter = T.cartDaysWithPlanDay(cart, "2026-10-21");
  assert.equal(
    T.readShopStapleUntil({ until }, cartAfter, "2026-10-20", span, addDays),
    until,
  );
  const delta = T.planDayStapleNeedsDelta(
    cart,
    "2026-10-21",
    until,
    staplesWeekdays,
    {},
    span,
    addDays,
    S.needs,
  );
  assert.equal(delta, 0);
  const before = S.needs(staplesWeekdays, T.stapleSpanDatesForUntil(cart, until, span, addDays), {});
  const after = S.needs(
    staplesWeekdays,
    T.stapleSpanDatesForUntil(cartAfter, until, span, addDays),
    {},
  );
  assert.deepEqual(before, after);
});

test("cartDaysWithPlanDay merges the planned day into the cart list", () => {
  assert.deepEqual(T.cartDaysWithPlanDay(["2026-10-20", "2026-10-22"], "2026-10-23"), [
    "2026-10-20",
    "2026-10-22",
    "2026-10-23",
  ]);
});

test("stapleSpanExtraFromPlanDay counts new span dates with until held", () => {
  const until = "2026-10-24";
  const extra = T.stapleSpanExtraFromPlanDay(["2026-10-20", "2026-10-21"], "2026-10-23", until, span, addDays);
  assert.deepEqual(extra, []);
  const extra2 = T.stapleSpanExtraFromPlanDay(["2026-10-20"], "2026-10-21", null, span, addDays);
  assert.deepEqual(extra2, ["2026-10-21"]);
});

test("spanDatesIncludingAhead extends the staple span by N days after the last cart day", () => {
  assert.deepEqual(
    T.spanDatesIncludingAhead(["2026-10-20", "2026-10-22"], 2, span, addDays),
    ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"],
  );
});

test("pickStapleAheadN chooses the smallest N that closes the gap", () => {
  const delta = (n) => ({ 1: 8, 2: 14, 3: 20 }[n]);
  assert.equal(T.pickStapleAheadN(11.6, delta), 2);
  assert.equal(T.pickStapleAheadN(20, delta), 3);
  assert.equal(T.pickStapleAheadN(5, delta), 1);
});

test("visibleSuggestions drops zero-cost and keeps cheapest three", () => {
  const out = T.visibleSuggestions([
    { kind: "staples", cost: 0, n: 1 },
    { kind: "day", cost: 12, date: "2026-10-21" },
    { kind: "staples", cost: 8, n: 2 },
    { kind: "day", cost: 6, date: "2026-10-22" },
    { kind: "day", cost: 9, date: "2026-10-23" },
  ]);
  assert.deepEqual(
    out.map((s) => [s.kind, s.cost]),
    [
      ["day", 6],
      ["staples", 8],
      ["day", 9],
    ],
  );
});

test("stapleNeedDelta counts only increases", () => {
  assert.deepEqual(T.stapleNeedDelta({ dare: 5, grenade: 2 }, { dare: 5, grenade: 4 }), { grenade: 2 });
});

test("storeTotalDelta is rounded to cents", () => {
  assert.equal(T.storeTotalDelta(38.4, 51.2), 12.8);
});

test("sameDayMealIds rejects duplicate lunch and dinner", () => {
  assert.equal(T.sameDayMealIds(["toasty", "teriyaki"], "teriyaki"), true);
  assert.equal(T.sameDayMealIds(["toasty", "teriyaki"], "bolognese"), false);
});
