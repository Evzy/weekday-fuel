const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "../../main/assets/weekday_fuel/Weekday_Fuel.html");
const Inv = require("../../main/assets/weekday_fuel/inventory.js");
const Weigh = require("../../main/assets/weekday_fuel/weigh.js");

const SOY_WEIGH = { ml: 40, g: 46 };
const WEIGH_G_SOY_FLAG = "weekdayfuel.inventory.weighG.soy";
const WEIGH_G_SOY_SAMPLE = "weekdayfuel.inventory.weighG.sample.soy";

function mockLs() {
  return {
    store: {},
    getItem(k) {
      return this.store[k] ?? null;
    },
    setItem(k, v) {
      this.store[k] = v;
    },
    removeItem(k) {
      delete this.store[k];
    },
  };
}

function lastInlineScript(html) {
  const i = html.lastIndexOf("<script>");
  const j = html.lastIndexOf("</script>");
  assert.ok(i >= 0 && j > i, "last inline script");
  return html.slice(i + 8, j);
}

function extractRunWeighStockIfNeeded(inlineScript) {
  const start = inlineScript.indexOf("function runWeighStockIfNeeded");
  const end = inlineScript.indexOf("function staplesActiveOn");
  assert.ok(start >= 0 && end > start, "runWeighStockIfNeeded in Weekday_Fuel.html");
  return inlineScript.slice(start, end).trim();
}

function makeRunWeighStockIfNeeded(html) {
  const fnSrc = extractRunWeighStockIfNeeded(lastInlineScript(html));
  const ls = mockLs();
  let inv = {
    v: 1,
    start: "2026-10-10T08:00:00.000Z",
    events: [
      {
        k: "set",
        item: "soy",
        amount: 500,
        why: "count",
        at: "2026-10-10T10:00:00.000Z",
      },
    ],
  };
  let lsSetInvCalls = 0;
  let lsSetInvOk = true;
  const settings = { weighG: { soy: SOY_WEIGH } };

  const g = {
    WeekdayFuelInventory: Inv,
    WeekdayFuelWeigh: Weigh,
    localStorage: ls,
    S() {
      return settings;
    },
    lsInv() {
      return inv;
    },
    lsSetInv(next) {
      lsSetInvCalls += 1;
      if (!lsSetInvOk) return false;
      inv = next;
      return true;
    },
  };

  const run = new Function(
    ...Object.keys(g),
    `${fnSrc}; return runWeighStockIfNeeded;`,
  )(...Object.values(g));

  return {
    ls,
    get inv() {
      return inv;
    },
    get lsSetInvCalls() {
      return lsSetInvCalls;
    },
    set lsSetInvOk(v) {
      lsSetInvOk = v;
    },
    run,
  };
}

test("runWeighStockIfNeeded: failed lsSetInv leaves sample and flag unset with mL events", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const h = makeRunWeighStockIfNeeded(html);
  h.lsSetInvOk = false;
  h.run();
  assert.equal(h.lsSetInvCalls, 1);
  assert.equal(h.inv.events[0].amount, 500, "events on disk stay mL");
  assert.equal(h.ls.getItem(WEIGH_G_SOY_SAMPLE), null);
  assert.equal(h.ls.getItem(WEIGH_G_SOY_FLAG), null);
  assert.equal(Inv.weighGStockMigrationFlagPending(h.ls, "soy"), false);
});

test("runWeighStockIfNeeded: orphaned sample with mL events re-migrates instead of flag-only", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const h = makeRunWeighStockIfNeeded(html);
  h.ls.setItem(WEIGH_G_SOY_SAMPLE, JSON.stringify(SOY_WEIGH));
  assert.equal(Inv.weighGStockMigrationFlagPending(h.ls, "soy"), true);
  h.run();
  assert.equal(h.inv.events[0].amount, 575);
  assert.equal(h.ls.getItem(WEIGH_G_SOY_FLAG), "1");
});

test("runWeighStockIfNeeded: success persists grams then sample and flag", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const h = makeRunWeighStockIfNeeded(html);
  h.run();
  assert.equal(h.inv.events[0].amount, 575);
  assert.deepEqual(JSON.parse(h.ls.getItem(WEIGH_G_SOY_SAMPLE)), SOY_WEIGH);
  assert.equal(h.ls.getItem(WEIGH_G_SOY_FLAG), "1");
});
