const { test } = require("node:test");
const assert = require("node:assert/strict");
const St = require("../../main/assets/weekday_fuel/steps.js");

test("mergeReply keeps valid days and status", () => {
  const c = St.mergeReply(null, { type: "steps", status: "ok", days: { "2026-11-23": 8412, "bad": 5, "2026-11-22": -1, "2026-11-21": 12.5 } }, "2026-11-23T10:00:00Z");
  assert.deepEqual(c, { days: { "2026-11-23": 8412 }, status: "ok", at: "2026-11-23T10:00:00Z" });
});

test("mergeReply overwrites by date and keeps older days", () => {
  let c = St.mergeReply(null, { type: "steps", status: "ok", days: { "2026-11-22": 100, "2026-11-23": 200 } }, "a");
  c = St.mergeReply(c, { type: "steps", status: "ok", days: { "2026-11-23": 900 } }, "b");
  assert.deepEqual(c.days, { "2026-11-22": 100, "2026-11-23": 900 });
  assert.equal(c.at, "b");
});

test("mergeReply ignores junk replies", () => {
  const c0 = { days: { "2026-11-23": 1 }, status: "ok", at: "a" };
  assert.equal(St.mergeReply(c0, { type: "nope" }, "b"), c0);
  assert.equal(St.mergeReply(c0, { type: "steps", status: "weird" }, "b"), c0);
  assert.equal(St.mergeReply(c0, null, "b"), c0);
});

test("mergeReply clears days when permission is gone or Health Connect is unavailable", () => {
  const c0 = { days: { "2026-11-23": 1 }, status: "ok", at: "a" };
  for (const status of ["noPermission", "unavailable"]) {
    const c1 = St.mergeReply(c0, { type: "steps", status, days: { "2026-11-23": 5 } }, "b");
    assert.deepEqual(c1, { days: {}, status, at: "b" });
  }
});

test("mergeReply keeps days on error and updateRequired", () => {
  const c0 = { days: { "2026-11-23": 1 }, status: "ok", at: "a" };
  for (const status of ["error", "updateRequired"]) {
    const c1 = St.mergeReply(c0, { type: "steps", status }, "b");
    assert.equal(c1.status, status);
    assert.deepEqual(c1.days, c0.days);
  }
});

test("mergeReply from null with a status-only reply", () => {
  assert.deepEqual(St.mergeReply(null, { type: "steps", status: "error" }, "b"), { days: {}, status: "error", at: "b" });
  assert.deepEqual(St.mergeReply(null, { type: "steps", status: "noPermission" }, "b"), { days: {}, status: "noPermission", at: "b" });
});

test("mergeReply ignores days that are an array or null", () => {
  const c0 = { days: { "2026-11-23": 1 }, status: "ok", at: "a" };
  assert.deepEqual(St.mergeReply(c0, { type: "steps", status: "ok", days: [5, 6] }, "b").days, c0.days);
  assert.deepEqual(St.mergeReply(c0, { type: "steps", status: "ok", days: null }, "b").days, c0.days);
});

test("mergeReply prunes days older than 60 days before the newest date", () => {
  const c0 = { days: { "2026-09-23": 1, "2026-09-24": 2, "2026-11-01": 3 }, status: "ok", at: "a" };
  const c1 = St.mergeReply(c0, { type: "steps", status: "ok", days: { "2026-11-23": 4 } }, "b");
  assert.deepEqual(c1.days, { "2026-09-24": 2, "2026-11-01": 3, "2026-11-23": 4 });
  const c2 = St.mergeReply({ days: { "2026-09-23": 1, "2026-11-23": 4 } }, { type: "steps", status: "error" }, "b");
  assert.deepEqual(c2.days, { "2026-11-23": 4 });
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(St.addDays("2026-12-01", -1), "2026-11-30");
  assert.equal(St.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(St.addDays("2026-11-23", 0), "2026-11-23");
});

test("countFor and avg7", () => {
  const days = { "2026-11-23": 8000, "2026-11-22": 9000, "2026-11-21": 7000, "2026-11-20": 10000, "2026-11-10": 1 };
  const c = { days, status: "ok", at: "x" };
  assert.equal(St.countFor(c, "2026-11-23"), 8000);
  assert.equal(St.countFor(c, "2026-11-19"), null);
  assert.equal(St.countFor(null, "2026-11-23"), null);
  assert.equal(St.avg7(c, "2026-11-23"), 8500);
  assert.equal(St.avg7({ days: { "2026-11-23": 1, "2026-11-22": 2, "2026-11-21": 3 } }, "2026-11-23"), null);
});

test("rangeToRead covers the last 8 days across a month boundary", () => {
  assert.deepEqual(St.rangeToRead("2026-12-03"), { from: "2026-11-26", to: "2026-12-03" });
});

test("format groups thousands", () => {
  assert.equal(St.format(8412), "8,412");
  assert.equal(St.format(0), "0");
});
