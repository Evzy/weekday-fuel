const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verdict, avgWindow } = require("../../main/assets/weekday_fuel/trend.js");

const MODES = {
  cut: { label: "Mini-cut", rate: -0.5, lo: -0.8, hi: -0.25 },
  recomp: { label: "Recomp", rate: 0, lo: -0.25, hi: 0.25 },
  bulk: { label: "Lean bulk", rate: 0.25, lo: 0.1, hi: 0.5 },
};

const fmtDay = (s) => `DAY(${s})`;

function days(end, n, kg) {
  const out = {};
  for (let i = n - 1; i >= 0; i--) {
    const d = addIso(end, -i);
    out[d] = { kg };
  }
  return out;
}

function addIso(s, n) {
  const p = s.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function twoWeeks(today, curKg, prevKg) {
  const prevEnd = addIso(today, -7);
  return Object.assign(days(today, 7, curKg), days(prevEnd, 7, prevKg));
}

test("wait when fewer than 3 weigh-ins this week", () => {
  const today = "2026-10-21";
  const weights = days(today, 2, 80);
  const v = verdict(weights, today, "cut", MODES, null, { fmtDay });
  assert.equal(v.state, "wait");
  assert.equal(v.head, "Keep weighing in");
  assert.equal(
    v.body,
    "Log at least 3 weigh-ins this week and the trend will show here. Weigh first thing in the morning, after the toilet, before food or the Dare.",
  );
  assert.equal(v.adj, undefined);
});

test("wait when fewer than 3 weigh-ins last week", () => {
  const today = "2026-10-21";
  const weights = Object.assign(days(today, 7, 80), days(addIso(today, -7), 2, 81));
  const v = verdict(weights, today, "cut", MODES, null, { fmtDay });
  assert.equal(v.state, "wait");
  assert.equal(v.head, "7-day average: 80.0 kg");
  assert.equal(v.body, "You need one more week of weigh-ins to compare against. Keep logging.");
});

test("cut: dropping faster than planned", () => {
  const today = "2026-10-21";
  const v = verdict(twoWeeks(today, 80, 82), today, "cut", MODES, null, { fmtDay });
  assert.equal(v.state, "bad");
  assert.equal(v.head, "Dropping faster than planned");
  assert.equal(v.adj, 150);
  assert.equal(
    v.body,
    "This week averaged 80.0 kg vs 82.0 kg last week (-2.00 kg). Target pace for mini-cut is -0.50 kg/week. Suggest moving weekday calories up 150 kcal.",
  );
  assert.equal(v.cur, 80);
  assert.equal(v.prev, 82);
});

test("cut: has stalled", () => {
  const today = "2026-10-21";
  const v = verdict(twoWeeks(today, 81.0, 81.1), today, "cut", MODES, null, { fmtDay });
  assert.equal(v.head, "Cut has stalled");
  assert.equal(v.adj, -150);
  assert.equal(
    v.body,
    "This week averaged 81.0 kg vs 81.1 kg last week (-0.10 kg). Target pace for mini-cut is -0.50 kg/week. Suggest moving weekday calories down 150 kcal.",
  );
});

test("cut: large weekly gain still counts as stalled", () => {
  const today = "2026-10-21";
  const v = verdict(twoWeeks(today, 81.5, 81), today, "cut", MODES, null, { fmtDay });
  assert.equal(v.head, "Cut has stalled");
  assert.equal(v.adj, -150);
});

test("recomp: on track", () => {
  const today = "2026-10-21";
  const v = verdict(twoWeeks(today, 81, 81), today, "recomp", MODES, null, { fmtDay });
  assert.equal(v.state, "good");
  assert.equal(v.head, "On track for recomp");
  assert.equal(v.adj, 0);
  assert.equal(
    v.body,
    "This week averaged 81.0 kg vs 81.0 kg last week (+0.00 kg). Target pace for recomp is 0.00 kg/week. Keep weekdays where they are.",
  );
});

test("recomp: trending up", () => {
  const today = "2026-10-21";
  const v = verdict(twoWeeks(today, 82, 81), today, "recomp", MODES, null, { fmtDay });
  assert.equal(v.head, "Trending up");
  assert.equal(v.adj, -150);
});

test("bulk: gaining faster than planned", () => {
  const today = "2026-10-21";
  const v = verdict(twoWeeks(today, 83, 81), today, "bulk", MODES, null, { fmtDay });
  assert.equal(v.head, "Gaining faster than planned");
  assert.equal(v.adj, -150);
});

test("bulk: not gaining yet", () => {
  const today = "2026-10-21";
  const modes = Object.assign({}, MODES, { bulk: Object.assign({}, MODES.bulk, { lo: -10 }) });
  const v = verdict(twoWeeks(today, 81.04, 81), today, "bulk", modes, null, { fmtDay });
  assert.equal(v.head, "Not gaining yet");
  assert.equal(v.adj, 150);
});

test("windowing ignores weigh-ins outside the two 7-day windows and bad kg values", () => {
  const today = "2026-10-21";
  const weights = Object.assign(twoWeeks(today, 81, 81), {
    [addIso(today, -15)]: { kg: 50 },
    [addIso(today, -3)]: { kg: "abc" },
  });
  const v = verdict(weights, today, "recomp", MODES, null, { fmtDay });
  assert.equal(v.head, "On track for recomp");
  assert.equal(v.cur, 81);
  assert.equal(v.prev, 81);
  assert.equal(avgWindow(weights, today, 7).n, 6);
});

test("hold is active through day 6 after adjustChange.at and cleared on day 7", () => {
  const changed = { at: "2026-10-15", by: -150 };
  const weights = twoWeeks("2026-10-21", 81.5, 81);
  const day6 = verdict(weights, "2026-10-21", "cut", MODES, changed, { fmtDay });
  assert.equal(day6.adj, 0);
  assert.deepEqual(day6.hold, { at: "2026-10-15", by: -150, next: "2026-10-22" });

  const day7 = verdict(weights, "2026-10-22", "cut", MODES, changed, { fmtDay });
  assert.equal(day7.hold, undefined);
  assert.equal(day7.adj, -150);
});

test("hold replaces the suggestion sentence in the body", () => {
  const changed = { at: "2026-10-15", by: -150 };
  const v = verdict(twoWeeks("2026-10-21", 81.5, 81), "2026-10-21", "cut", MODES, changed, { fmtDay });
  assert.match(v.body, / Changed -150 kcal on DAY\(2026-10-15\); next check from DAY\(2026-10-22\)\.$/);
});

test("on track during a hold still reads on track and ends with the hold sentence", () => {
  const changed = { at: "2026-10-15", by: 150 };
  const v = verdict(twoWeeks("2026-10-21", 81, 81), "2026-10-21", "recomp", MODES, changed, { fmtDay });
  assert.equal(v.state, "good");
  assert.equal(v.head, "On track for recomp");
  assert.equal(v.adj, 0);
  assert.match(v.body, / Changed \+150 kcal on DAY\(2026-10-15\); next check from DAY\(2026-10-22\)\.$/);
});

test("invalid adjustChange.at skips the hold", () => {
  const weights = twoWeeks("2026-10-21", 81.0, 81.1);
  const v = verdict(weights, "2026-10-21", "cut", MODES, { at: "Oct 15", by: -150 }, { fmtDay });
  assert.equal(v.hold, undefined);
  assert.equal(v.adj, -150);
});

test("invalid adjustChange.by skips the hold", () => {
  const weights = twoWeeks("2026-10-21", 81, 81);
  const v = verdict(weights, "2026-10-21", "recomp", MODES, { at: "2026-10-15", by: NaN }, { fmtDay });
  assert.equal(v.hold, undefined);
  assert.equal(v.adj, 0);
});
