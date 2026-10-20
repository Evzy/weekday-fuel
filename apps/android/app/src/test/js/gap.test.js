const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("../../main/assets/weekday_fuel/gap.js");

const MACROS = {
  grenade: (n) => ({ k: 244 * n, p: 23 * n }),
  dare: (n) => ({ k: 295 * n, p: 30 * n }),
  yog: (n) => ({ k: (0.59 * n), p: (0.1 * n) }),
  honey: (n) => ({ k: (3.2 * n), p: 0 }),
  eggs: (n) => ({ k: 84 * n, p: 7 * n }),
  ham: (n) => ({ k: 1.1 * n, p: 0.2 * n }),
  cheese: (n) => ({ k: 3.5 * n, p: 0.25 * n }),
  fzberry: (n) => ({ k: 0.5 * n, p: 0.01 * n }),
};

function macrosFor(id, amount) {
  const fn = MACROS[id];
  if (!fn) return null;
  const m = fn(amount);
  return { k: Math.round(m.k), p: Math.round(m.p * 10) / 10 };
}

test("SNACKS matches the spec table", () => {
  assert.equal(G.SNACKS.length, 6);
  assert.deepEqual(
    G.SNACKS.map((s) => s.id),
    ["grenade", "dare", "yog-honey", "eggs2", "ham-cheese", "yog-berry"],
  );
  const grenade = G.SNACKS.find((s) => s.id === "grenade");
  assert.deepEqual(grenade.items, [{ id: "grenade", amount: 1 }]);
  const yogHoney = G.SNACKS.find((s) => s.id === "yog-honey");
  assert.deepEqual(yogHoney.items, [
    { id: "yog", amount: 200 },
    { id: "honey", amount: 15 },
  ]);
});

test("snackMacros sums item macros", () => {
  const snack = G.SNACKS.find((s) => s.id === "eggs2");
  const m = G.snackMacros(snack, macrosFor);
  assert.equal(m.k, 168);
  assert.equal(m.p, 14);
});

test("snackMacros returns null when any item macro is missing", () => {
  const snack = G.SNACKS[0];
  assert.equal(G.snackMacros(snack, () => null), null);
  const combo = G.SNACKS.find((s) => s.id === "yog-honey");
  assert.equal(
    G.snackMacros(combo, (id) => (id === "yog" ? { k: 1, p: 1 } : null)),
    null,
  );
});

test("snackOptions filters by free stock and skips snacks with missing macros", () => {
  const opts = G.snackOptions({
    free: { grenade: 1, dare: 0 },
    macrosFor,
    total: { k: 2300, p: 180 },
    target: { k: 2500, p: 170 },
  });
  assert.ok(opts.every((o) => o.snack.id === "grenade"));
  assert.equal(
    G.snackOptions({
      free: { grenade: 0 },
      macrosFor,
      total: { k: 2300, p: 180 },
      target: { k: 2500, p: 170 },
    }).length,
    0,
  );
  assert.equal(
    G.snackOptions({
      free: { grenade: 1, yog: 200, honey: 15 },
      macrosFor: (id, amt) => (id === "yog" ? { k: 100, p: 10 } : null),
      total: { k: 2300, p: 180 },
      target: { k: 2500, p: 170 },
    }).length,
    0,
  );
});

test("snackOptions only returns snacks that beat the current score, sorted best first, limit 3", () => {
  const total = { k: 2300, p: 180 };
  const target = { k: 2500, p: 170 };
  const current = Math.abs(total.k - target.k) + Math.max(0, target.p - total.p) * 12;
  assert.equal(current, 200 + 0);
  const opts = G.snackOptions({
    free: { grenade: 2, dare: 2, eggs: 4, yog: 500, honey: 50, ham: 100, cheese: 100, fzberry: 200 },
    macrosFor,
    total,
    target,
    limit: 3,
  });
  assert.ok(opts.length <= 3);
  for (const o of opts) {
    assert.ok(o.score < current);
    assert.deepEqual(o.after, { k: total.k + o.k, p: total.p + o.p });
    assert.ok(o.k > 0);
  }
  for (let i = 1; i < opts.length; i++) {
    assert.ok(opts[i].score >= opts[i - 1].score);
  }
  const worse = G.snackOptions({
    free: { grenade: 1 },
    macrosFor,
    total: { k: 2490, p: 170 },
    target: { k: 2500, p: 170 },
  });
  assert.equal(worse.length, 0);
});

test("spreadSplit splits evenly with remainder on the first date", () => {
  assert.deepEqual(G.spreadSplit(170, ["2026-10-22", "2026-10-23", "2026-10-24"]), [
    { date: "2026-10-22", k: 58 },
    { date: "2026-10-23", k: 56 },
    { date: "2026-10-24", k: 56 },
  ]);
  assert.deepEqual(G.spreadSplit(-170, ["2026-10-22", "2026-10-23", "2026-10-24"]), [
    { date: "2026-10-22", k: -58 },
    { date: "2026-10-23", k: -56 },
    { date: "2026-10-24", k: -56 },
  ]);
  assert.deepEqual(G.spreadSplit(10, ["2026-10-21"]), [{ date: "2026-10-21", k: 10 }]);
  assert.deepEqual(G.spreadSplit(7, ["a", "b"]), [
    { date: "a", k: 4 },
    { date: "b", k: 3 },
  ]);
});

test("spreadSplit returns empty array when there are no dates", () => {
  assert.deepEqual(G.spreadSplit(100, []), []);
  assert.deepEqual(G.spreadSplit(100, null), []);
});

test("forwardCandidates lists bought not-eaten meals after today through week end", () => {
  const meal = (id, extra) => ({ id, slot: "lunch", t: "S", ...extra });
  const days = {
    "2026-10-20": { meals: [meal("a")] },
    "2026-10-21": { meals: [meal("past", { bought: "o1" })] },
    "2026-10-22": {
      meals: [
        meal("bought1", { bought: "o1" }),
        meal("plain"),
        meal("eaten", { bought: "o1", eaten: true }),
      ],
    },
    "2026-10-26": { meals: [meal("nextweek", { bought: "o1" })] },
  };
  const isBought = (m) => !!(m && m.bought);
  const isEaten = (m) => !!(m && m.eaten);
  const list = G.forwardCandidates({
    today: "2026-10-21",
    weekEnd: "2026-10-25",
    days,
    isBought,
    isEaten,
  });
  assert.deepEqual(list, [{ date: "2026-10-22", index: 0, meal: days["2026-10-22"].meals[0] }]);
});

test("forwardCandidates ignores days on or before today and after weekEnd", () => {
  const m = { id: "x", bought: "o1" };
  const days = { "2026-10-20": { meals: [m] }, "2026-10-27": { meals: [m] } };
  assert.deepEqual(
    G.forwardCandidates({
      today: "2026-10-21",
      weekEnd: "2026-10-26",
      days,
      isBought: () => true,
      isEaten: () => false,
    }),
    [],
  );
});
