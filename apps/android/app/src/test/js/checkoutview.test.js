process.env.TZ = "America/Los_Angeles";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const V = require("../../main/assets/weekday_fuel/checkoutview.js");

test("money, dollars, summaryLines and dayTabs handle missing amounts", () => {
  assert.equal(V.money(undefined), "–");
  assert.equal(V.money(null), "–");
  assert.equal(V.money(NaN), "–");
  assert.equal(V.dollars(undefined), "–");
  assert.equal(V.dollars(0), "$0");
  assert.deepEqual(V.summaryLines(undefined), []);
  assert.deepEqual(V.summaryLines({ error: "x" }), []);
  assert.deepEqual(
    V.summaryLines({ subtotal: 10, total: 12 }).map((l) => [l.label, l.value]),
    [["Subtotal", "$10.00"], ["Delivery fee", "–"], ["Total", "$12.00"]],
  );
  assert.deepEqual(
    V.dayTabs({ days: [{ date: "2026-10-21", available: true, closedText: "", slots: undefined }] }),
    [{ date: "2026-10-21", open: false, priceRange: null, cheapestId: null, closedText: "", slots: [] }],
  );
});

test("boostSummary counts, marks trolley offers and lists them first", () => {
  const b = V.boostSummary(
    {
      offers: [
        { heading: "Collect 100 points", description: "Dishwashing", productId: 555, minimumSpend: null, outcome: "boosted", reason: null },
        { heading: "Collect 60 points", description: "Tomatoes", productId: 134034, minimumSpend: 3, outcome: "already", reason: null },
        { heading: "Collect 2000 points", description: "Spend $50", productId: null, minimumSpend: 50, outcome: "failed", reason: "HTTP 500" },
        { heading: "Collect 10x points", description: "Bakery", productId: 919345, minimumSpend: null, outcome: "boosted", reason: null },
      ],
    },
    [134034, 919345],
  );
  assert.equal(b.boosted, 2);
  assert.equal(b.already, 1);
  assert.deepEqual(b.rows.map((r) => [r.description, r.inTrolley]), [["Tomatoes", true], ["Bakery", true], ["Dishwashing", false]]);
  assert.equal(b.rows[0].minSpend, "$3");
  assert.equal(b.rows[2].minSpend, null);
  assert.deepEqual(b.failed.map((r) => [r.description, r.reason, r.minSpend]), [["Spend $50", "HTTP 500", "$50"]]);
});

test("boostSummary of nothing", () => {
  assert.deepEqual(V.boostSummary(null, []), { boosted: 0, already: 0, rows: [], failed: [] });
  assert.deepEqual(V.boostSummary({ offers: [] }, null), { boosted: 0, already: 0, rows: [], failed: [] });
});

test("dayTabs gives price ranges and the cheapest open slot, ignoring full slots and closed days", () => {
  const tabs = V.dayTabs({
    days: [
      {
        date: "2026-10-20", available: true, closedText: "",
        slots: [
          { id: 1, label: "4am - 7am", price: 13, available: true, eco: true },
          { id: 2, label: "5am - 10am", price: 12, available: true, eco: false },
          { id: 3, label: "7pm - 10pm", price: 2, available: false, eco: true },
          { id: 4, label: "6am - 9am", price: 12, available: true, eco: false },
        ],
      },
      { date: "2026-10-21", available: true, closedText: "", slots: [{ id: 5, label: "5am - 10am", price: 12.5, available: true }] },
      { date: "2026-10-15", available: false, closedText: "All windows are full or have closed for today", slots: [{ id: 6, label: "x", price: 15, available: true }] },
    ],
  });
  assert.deepEqual(tabs.map((t) => [t.date, t.open, t.priceRange, t.cheapestId]), [
    ["2026-10-20", true, "$12 - $13", 2],
    ["2026-10-21", true, "$12.50", 5],
    ["2026-10-15", false, null, null],
  ]);
  assert.equal(tabs[2].closedText, "All windows are full or have closed for today");
  assert.equal(tabs[0].slots.length, 4);
  assert.deepEqual(V.dayTabs(null), []);
});

test("summaryLines shows savings and a delivery discount as notes, and the bag fee only when charged", () => {
  assert.deepEqual(
    V.summaryLines({ subtotal: 131.43, savings: 1.65, deliveryFee: 12, deliveryFeeBefore: 15, bagFee: 2, bagLabel: "Paper bags", total: 145.43 }),
    [
      { label: "Subtotal", value: "$131.43", note: "you've saved $1.65", strong: false },
      { label: "Delivery fee", value: "$12.00", note: "was $15.00", strong: false },
      { label: "Paper bags", value: "$2.00", note: null, strong: false },
      { label: "Total", value: "$145.43", note: null, strong: true },
    ],
  );
  assert.deepEqual(
    V.summaryLines({ subtotal: 20, savings: 0, deliveryFee: 12, deliveryFeeBefore: 12, bagFee: 0, bagLabel: null, total: 32 }).map((l) => [l.label, l.note]),
    [["Subtotal", null], ["Delivery fee", null], ["Total", null]],
  );
  assert.equal(V.summaryLines({ subtotal: 20, savings: 0, deliveryFee: 12, deliveryFeeBefore: 12, bagFee: 1, bagLabel: null, total: 33 })[2].label, "Bag fee");
});

test("labels for days, times, money and the booked slot", () => {
  assert.equal(V.dayLabel("2026-10-21T00:00:00.0000000"), "Wed 21 Oct");
  assert.equal(V.dayLabel("2026-10-20"), "Tue 20 Oct");
  assert.equal(V.timeLabel("2026-10-20T21:00:00.0000000+11:00"), "9pm");
  assert.equal(V.timeLabel("2026-10-20T08:45:00.0000000+11:00"), "8:45am");
  assert.equal(V.timeLabel("2026-10-20T12:00:00"), "12pm");
  assert.equal(V.timeLabel("2026-10-20T00:30:00"), "12:30am");
  assert.deepEqual(
    V.bookedLabel({ id: 948223, start: "2026-10-21T05:00:00.0000000", end: "2026-10-21T10:00:00.0000000", label: "5:00am - 10:00am", cutOff: "2026-10-20T21:00:00.0000000+11:00" }),
    { when: "Wed 21 Oct, 5:00am - 10:00am", cutOff: "Change by Tue 20 Oct 9pm" },
  );
  assert.equal(V.bookedLabel({ start: "2026-10-21T05:00:00", label: "5am - 10am", cutOff: null }).cutOff, null);
  assert.equal(V.dollars(2), "$2");
  assert.equal(V.dollars(12.5), "$12.50");
  assert.equal(V.money(12), "$12.00");
});
