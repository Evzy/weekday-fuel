const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MEALS, BATCHES } = require("../../main/assets/weekday_fuel/meals.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");

const TIERS = ["L", "S", "X"];
const SLOT_MIN = { breakfast: 30, main: 45, snack: 15 };
const PREP = ["assemble", "quick", "cook"];
const BANNED = /tuna|salmon|cottage cheese/i;
const BATCH = Object.fromEntries(BATCHES.map((b) => [b.id, b]));
const str = (s) => typeof s === "string" && s.trim().length > 0;
const extraText = (e) => (typeof e === "string" ? e : e.text);
const tiered = (m) => Object.values(cat.AMOUNTS[m.id] || {}).some((v) => typeof v !== "number");

test("every meal has the full shape", () => {
  const ids = new Set();
  for (const m of MEALS) {
    assert.match(m.id, /^[a-z][a-z0-9]*$/, "id " + m.id);
    assert.ok(!ids.has(m.id), "duplicate " + m.id);
    ids.add(m.id);
    for (const k of ["name", "cuisine", "core"]) assert.ok(str(m[k]), m.id + " " + k);
    assert.ok(Array.isArray(m.slots) && m.slots.length > 0 && m.slots.every((s) => s in SLOT_MIN), m.id + " slots");
    assert.ok(typeof m.mins === "number" && m.mins > 0, m.id + " mins");
    assert.ok(PREP.includes(m.prep), m.id + " prep");
    for (const t of TIERS) {
      const v = m.t && m.t[t];
      assert.ok(v, m.id + " " + t);
      for (const k of ["k", "p", "c", "f"]) assert.ok(typeof v[k] === "number" && v[k] >= 0, m.id + " " + t + "." + k);
      assert.ok(typeof v.cost === "number" && v.cost > 0, m.id + " " + t + " cost");
      assert.ok(str(v.what), m.id + " " + t + " what");
    }
    assert.ok(Array.isArray(m.extras), m.id + " extras");
    for (const e of m.extras) {
      const ok = typeof e === "string" ? str(e) : !!e && str(e.text) && /^(?!.*(.).*\1)[LSX]+$/.test(e.tiers || "");
      assert.ok(ok, m.id + " extra " + JSON.stringify(e));
    }
    assert.ok(Array.isArray(m.steps) && m.steps.length >= 3 && m.steps.every(str), m.id + " needs at least 3 steps");
    assert.ok(!("ing" in m), m.id + " ingredients come from catalogue amounts, not a free-text list");
  }
});

test("kcal are within 5% of 4 × protein + 4 × carbs + 9 × fat for every portion", () => {
  for (const m of MEALS) {
    for (const t of TIERS) {
      const v = m.t[t];
      const calc = 4 * v.p + 4 * v.c + 9 * v.f + 2 * (v.fib || 0);
      assert.ok(Math.abs(v.k - calc) <= 0.05 * calc, `${m.id} ${t}: ${v.k} kcal vs ${calc} from macros`);
    }
  }
});

test("Standard protein meets the minimum for the meal's lowest slot", () => {
  for (const m of MEALS) {
    const min = Math.min(...m.slots.map((s) => SLOT_MIN[s]));
    assert.ok(m.t.S.p >= min, `${m.id} Standard ${m.t.S.p}g protein, needs ${min}g`);
  }
});

test("no meal uses a banned food", () => {
  for (const m of MEALS) {
    const texts = [m.name, m.core, m.note || "", ...TIERS.map((t) => m.t[t].what), ...m.extras.map(extraText), ...m.steps];
    for (const id of Object.keys(cat.AMOUNTS[m.id] || {})) {
      const it = cat.item(id);
      texts.push(it.name);
      for (const store of ["coles", "woolies"]) if (it[store]) texts.push(it[store].name);
    }
    for (const s of texts) assert.doesNotMatch(s, BANNED, m.id + ": " + s);
  }
});

test("every meal has shopping amounts, and every amount is a positive number or a portion set", () => {
  assert.deepEqual(Object.keys(cat.AMOUNTS).sort(), MEALS.map((m) => m.id).sort());
  for (const m of MEALS) {
    for (const [id, v] of Object.entries(cat.AMOUNTS[m.id])) {
      assert.ok(cat.item(id), m.id + " uses unknown item " + id);
      if (typeof v === "number") assert.ok(v > 0, m.id + "." + id);
      else {
        assert.ok(TIERS.every((t) => typeof v[t] === "number" && v[t] >= 0), m.id + "." + id + " needs L, S and X");
        assert.ok(TIERS.some((t) => v[t] > 0), m.id + "." + id + " is never used");
      }
    }
  }
});

test("steps never hard-code a gram or mL amount in a meal whose amounts change by portion", () => {
  for (const m of MEALS) if (tiered(m)) for (const s of m.steps) assert.doesNotMatch(s, /\d\s*(g|mL)\b/, m.id + ": " + s);
});

test("batches are complete, and meals only use real batches made from an item they buy", () => {
  for (const b of BATCHES) {
    assert.match(b.id, /^[a-z][a-z0-9]*$/, "batch id " + b.id);
    for (const k of ["id", "name", "as", "makes", "keeps"]) assert.ok(str(b[k]), b.id + " " + k);
    assert.ok(cat.item(b.item), b.id + " item");
    assert.ok(b.ratio > 0 && b.ratio <= 1, b.id + " ratio");
    assert.ok(Array.isArray(b.steps) && b.steps.length >= 2 && b.steps.every(str), b.id + " steps");
  }
  for (const m of MEALS) {
    if (!("batch" in m)) continue;
    assert.ok(Array.isArray(m.batch) && m.batch.length > 0, m.id + " batch");
    for (const id of m.batch) {
      assert.ok(BATCH[id], m.id + " uses unknown batch " + id);
      assert.ok(BATCH[id].item in cat.AMOUNTS[m.id], m.id + " doesn't buy " + BATCH[id].item + " for " + id);
    }
  }
});

test("a planned Loaded buffalo mac buys 110g fresh fettuccine and a Build a shop pick buys 80g", () => {
  const pasta = (rows) => rows.find((r) => r.id === "freshpasta").need;
  assert.equal(pasta(cat.shopList({}, 0, [{ day: "2026-10-20", meal: "buffalomac", t: "X" }])), 110);
  assert.equal(pasta(cat.shopList({ buffalomac: 1 }, 0)), 80);
});
