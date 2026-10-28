const { test } = require("node:test");
const assert = require("node:assert/strict");
const W = require("../../main/assets/weekday_fuel/weigh.js");

const SOY_SAMPLE = { ml: 40, g: 46 };

test("parseSample rejects zero, NaN, and non-finite values", () => {
  assert.equal(W.parseSample(0, 46), null);
  assert.equal(W.parseSample(40, 0), null);
  assert.equal(W.parseSample(-40, 46), null);
  assert.equal(W.parseSample(40, -1), null);
  assert.equal(W.parseSample(NaN, 46), null);
  assert.equal(W.parseSample(40, NaN), null);
  assert.equal(W.parseSample(Infinity, 46), null);
  assert.equal(W.parseSample(40, Infinity), null);
});

test("parseSample accepts finite positive ml and g", () => {
  assert.deepEqual(W.parseSample(40, 46), { ml: 40, g: 46 });
});

test("40 mL sample maps 20 mL to 23 g", () => {
  assert.equal(W.gramsForMl(SOY_SAMPLE, 40), 46);
  assert.equal(W.gramsForMl(SOY_SAMPLE, 20), 23);
  assert.equal(W.mlForGrams(SOY_SAMPLE, 46), 40);
  assert.equal(W.mlForGrams(SOY_SAMPLE, 23), 20);
});

test("displayAmount without sample stays in mL", () => {
  const item = { id: "soy", unit: "mL" };
  assert.deepEqual(W.displayAmount(item, 40, {}), { amount: 40, unit: "mL" });
  assert.deepEqual(W.displayAmount(item, 40, null), { amount: 40, unit: "mL" });
});

test("displayAmount with sample shows grams and origMl", () => {
  const item = { id: "soy", unit: "mL" };
  const weighG = { soy: SOY_SAMPLE };
  assert.deepEqual(W.displayAmount(item, 40, weighG), {
    amount: 46,
    unit: "g",
    origMl: 40,
  });
});

test("displayAmount ignores weighG for non-mL items", () => {
  const item = { id: "breast", unit: "g" };
  const weighG = { breast: SOY_SAMPLE };
  assert.deepEqual(W.displayAmount(item, 200, weighG), { amount: 200, unit: "g" });
});

test("has is true only for a valid sample on that id", () => {
  assert.equal(W.has({ soy: SOY_SAMPLE }, "soy"), true);
  assert.equal(W.has({ soy: { ml: 0, g: 46 } }, "soy"), false);
  assert.equal(W.has({}, "soy"), false);
});

test("apply and clear do not mutate weighG", () => {
  const weighG = { coco: { ml: 70, g: 80 } };
  const next = W.apply(weighG, "soy", SOY_SAMPLE);
  assert.notEqual(next, weighG);
  assert.deepEqual(weighG, { coco: { ml: 70, g: 80 } });
  assert.deepEqual(next, {
    coco: { ml: 70, g: 80 },
    soy: { ml: 40, g: 46 },
  });

  const cleared = W.clear(next, "soy");
  assert.notEqual(cleared, next);
  assert.deepEqual(next.soy, { ml: 40, g: 46 });
  assert.deepEqual(cleared, { coco: { ml: 70, g: 80 } });
});

test("apply rejects invalid samples", () => {
  const weighG = {};
  assert.deepEqual(W.apply(weighG, "soy", { ml: 0, g: 46 }), weighG);
});

test("convertStockMlToG scales mL stock for one item only", () => {
  const events = [
    { k: "set", item: "soy", amount: 500 },
    { k: "set", item: "rice", amount: 2 },
    { k: "add", item: "soy", amount: 40 },
  ];
  const out = W.convertStockMlToG(events, "soy", SOY_SAMPLE);
  assert.notEqual(out, events);
  assert.deepEqual(out, [
    { k: "set", item: "soy", amount: 575 },
    { k: "set", item: "rice", amount: 2 },
    { k: "add", item: "soy", amount: 46 },
  ]);
});

test("convertStockMlToG converts every stock event for the item", () => {
  const events = [
    { k: "buy", item: "soy", amount: 500, order: "o1" },
    { k: "set", item: "soy", amount: 40 },
  ];
  const out = W.convertStockMlToG(events, "soy", SOY_SAMPLE);
  assert.deepEqual(out, [
    { k: "buy", item: "soy", amount: 575, order: "o1" },
    { k: "set", item: "soy", amount: 46 },
  ]);
});

test("convertStockMlToG leaves other items unchanged", () => {
  const events = [{ k: "set", item: "soy", amount: 500 }];
  const out = W.convertStockMlToG(events, "rice", SOY_SAMPLE);
  assert.equal(out, events);
});

test("convertBuyMlToStock returns ml when not in gram stock mode", () => {
  const item = { id: "soy", unit: "mL" };
  const opt = { isStockInGrams: () => false, mlToGrams: () => 999 };
  assert.equal(W.convertBuyMlToStock(item, 500, opt), 500);
});

test("stockEventsInGramsOnDisk distinguishes mL ledger from converted grams", () => {
  const mlEvents = [{ k: "set", item: "soy", amount: 500 }];
  const gEvents = [{ k: "set", item: "soy", amount: 575 }];
  assert.equal(W.stockEventsInGramsOnDisk(mlEvents, "soy", SOY_SAMPLE), false);
  assert.equal(W.stockEventsInGramsOnDisk(gEvents, "soy", SOY_SAMPLE), true);
});

test("convertBuyMlToStock converts bottle mL when stock is in grams", () => {
  const item = { id: "soy", unit: "mL" };
  const opt = {
    isStockInGrams: (id) => id === "soy",
    mlToGrams: (_id, ml) => W.gramsForMl(SOY_SAMPLE, ml),
  };
  assert.equal(W.convertBuyMlToStock(item, 500, opt), 575);
});
