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
  assert.equal(B.isBought({ bought: true }), false);
  assert.equal(B.isBought({ bought: 1 }), false);
  assert.equal(B.isBought({ bought: {} }), false);
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

test("markBought omits days where nothing would be marked", () => {
  const days = {
    "2026-10-20": day([meal("bowl", { bought: "old" }), meal("wrap", { shop: false })]),
    "2026-10-21": day([meal("toasty", { shop: false })]),
  };
  assert.deepEqual(B.markBought(days, ["2026-10-20", "2026-10-21"], "ord1").changed, []);
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

test("backfillBought lists each changed day once when several orders touch it", () => {
  const days = { "2026-10-20": day([meal("bowl"), meal("wrap")]) };
  const orders = [
    { id: "o1", at: "2026-10-21T10:00:00.000Z", days: ["2026-10-20"] },
    { id: "o2", at: "2026-10-22T10:00:00.000Z", days: ["2026-10-20"] },
  ];
  const r = B.backfillBought(days, orders);
  assert.deepEqual(r.changed, ["2026-10-20"]);
  assert.equal(r.days["2026-10-20"].meals[0].bought, "o1");
});

test("backfillBought sorts valid dates before unparseable at values", () => {
  const days = { "2026-10-20": day([meal("bowl")]) };
  const orders = [
    { id: "bad", at: "not-a-date", days: ["2026-10-20"] },
    { id: "good", at: "2026-10-21T10:00:00.000Z", days: ["2026-10-20"] },
  ];
  const r = B.backfillBought(days, orders);
  assert.equal(r.days["2026-10-20"].meals[0].bought, "good");
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

test("clearUnbought skips entire dates in skipDates", () => {
  const days = {
    "2026-10-20": day([meal("bowl"), meal("wrap")]),
    "2026-10-21": day([meal("toasty")]),
  };
  const r = B.clearUnbought(days, ["2026-10-20"]);
  assert.equal(r.cleared, 1);
  assert.deepEqual(r.changed, ["2026-10-21"]);
  assert.equal(r.days["2026-10-20"].meals.length, 2);
  assert.equal(r.days["2026-10-21"].meals.length, 0);
});

test("clearUnbought skips meals on sent keys but clears other unbought", () => {
  const days = {
    "2026-10-20": day([meal("bowl"), meal("wrap")]),
    "2026-10-21": day([meal("brekwrap"), meal("toasty")]),
  };
  const r = B.clearUnbought(days, null, "2026-10-19", ["2026-10-20|0|bowl", "2026-10-21|0|brekwrap"]);
  assert.equal(r.cleared, 2);
  assert.deepEqual(r.changed.sort(), ["2026-10-20", "2026-10-21"]);
  assert.deepEqual(
    r.days["2026-10-20"].meals.map((m) => m.id),
    ["bowl"]
  );
  assert.deepEqual(
    r.days["2026-10-21"].meals.map((m) => m.id),
    ["brekwrap"]
  );
});

test("clearUnbought skipDates as a set-like object", () => {
  const days = { "2026-10-20": day([meal("bowl")]) };
  const r = B.clearUnbought(days, { "2026-10-20": true });
  assert.equal(r.cleared, 0);
  assert.deepEqual(r.changed, []);
});

test("clearUnbought keeps all meals on dates before today", () => {
  const days = {
    "2026-10-18": day([meal("bowl"), meal("wrap")]),
    "2026-10-20": day([meal("toasty")]),
  };
  const r = B.clearUnbought(days, null, "2026-10-19");
  assert.equal(r.cleared, 1);
  assert.deepEqual(r.changed, ["2026-10-20"]);
  assert.equal(r.days["2026-10-18"].meals.length, 2);
  assert.equal(r.days["2026-10-20"].meals.length, 0);
});

test("clearUnbought removes uneaten unbought meals and counts them", () => {
  const days = {
    "2026-10-20": day([
      meal("bowl", { bought: "o1" }),
      meal("wrap"),
      meal("toasty", { ate: "2026-10-20T08:00:00.000Z" }),
      meal("brekwrap", { ate: false }),
    ]),
    "2026-10-21": day([meal("bowl")]),
  };
  const r = B.clearUnbought(days);
  assert.equal(r.cleared, 3);
  assert.deepEqual(r.changed.sort(), ["2026-10-20", "2026-10-21"]);
  assert.equal(r.days["2026-10-20"].meals.length, 2);
  assert.equal(r.days["2026-10-21"].meals.length, 0);
  assert.equal(days["2026-10-20"].meals.length, 4);
});

test("mealKey and parseMealKey round-trip", () => {
  const k = B.mealKey("2026-10-20", 2, "bowl");
  assert.equal(k, "2026-10-20|2|bowl");
  assert.deepEqual(B.parseMealKey(k), { date: "2026-10-20", index: 2, id: "bowl" });
  assert.equal(B.parseMealKey("bad"), null);
  assert.equal(B.parseMealKey("a|b"), null);
});

test("toBuyKeys uses isBought when isBoughtFn omitted", () => {
  const days = { "2026-10-20": day([meal("bowl"), meal("wrap", { bought: "o1" })]) };
  assert.deepEqual(B.toBuyKeys(days, ["2026-10-20"]), ["2026-10-20|0|bowl"]);
});

test("toBuyKeys skips bought and shop false and sorts", () => {
  const days = {
    "2026-10-21": day([meal("wrap"), meal("bowl", { shop: false }), meal("toasty", { bought: "o1" })]),
    "2026-10-20": day([meal("bowl")]),
  };
  assert.deepEqual(B.toBuyKeys(days, ["2026-10-21", "2026-10-20"], B.isBought), [
    "2026-10-20|0|bowl",
    "2026-10-21|0|wrap",
  ]);
});

test("markBoughtKeys marks only matching keys and skips stale keys", () => {
  const days = {
    "2026-10-20": day([meal("bowl"), meal("wrap")]),
  };
  const r = B.markBoughtKeys(days, ["2026-10-20|0|bowl", "2026-10-20|1|wrong", "2026-10-20|5|bowl"], "ord3");
  assert.deepEqual(r.changed, ["2026-10-20"]);
  assert.equal(r.days["2026-10-20"].meals[0].bought, "ord3");
  assert.equal(r.days["2026-10-20"].meals[1].bought, undefined);
});

test("sameKeys compares raw keys; changedSince uses date+id multiset", () => {
  const a = ["2026-10-20|0|a", "2026-10-21|1|b"];
  const b = ["2026-10-20|0|a", "2026-10-22|0|c"];
  assert.equal(B.sameKeys(a, a), true);
  assert.equal(B.sameKeys(a, b), false);
  assert.equal(B.changedSince(a, b), true);
  assert.equal(B.changedSince(a, a.slice()), false);
  assert.equal(B.addedSince(a, b), 1);
  assert.equal(B.addedSince(b, a), 1);
});

test("changedSince ignores pure index shifts on the same date and meal id", () => {
  const sent = ["2026-10-20|0|bowl", "2026-10-21|1|wrap"];
  const now = ["2026-10-20|1|bowl", "2026-10-21|0|wrap"];
  assert.equal(B.changedSince(sent, now), false);
  assert.equal(B.addedSince(sent, now), 0);
});

test("markBoughtKeys falls back when an earlier meal was removed after send", () => {
  const days = {
    "2026-10-20": day([meal("wrap"), meal("bowl")]),
  };
  const r = B.markBoughtKeys(days, ["2026-10-20|0|bowl"], "ord4");
  assert.deepEqual(r.changed, ["2026-10-20"]);
  assert.equal(r.days["2026-10-20"].meals[1].bought, "ord4");
  assert.equal(r.days["2026-10-20"].meals[0].bought, undefined);
});
