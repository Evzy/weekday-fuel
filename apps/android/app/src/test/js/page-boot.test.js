const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "../../main/assets/weekday_fuel/Weekday_Fuel.html");

function lastScript(html) {
  const i = html.lastIndexOf("<script>");
  const j = html.lastIndexOf("</script>");
  assert.ok(i >= 0 && j > i, "last inline script");
  return html.slice(i + 8, j);
}

test("initMealCalc() runs only after store() and S() exist (cold start must leave Loading)", () => {
  const src = lastScript(fs.readFileSync(HTML, "utf8"));
  const call = src.search(/\ninitMealCalc\(\);\n/);
  const store = src.search(/\nconst store\s*=/);
  const settings = src.search(/\nconst S\s*=/);
  assert.ok(call >= 0, "initMealCalc() is called");
  assert.ok(store >= 0, "store() is defined");
  assert.ok(settings >= 0, "S() is defined");
  assert.ok(call > store, "initMealCalc() after store()");
  assert.ok(call > settings, "initMealCalc() after S()");
});

test("targets.js loads before the main script and initStore runs the rest-target update", () => {
  const html = fs.readFileSync(HTML, "utf8");
  assert.ok(html.indexOf('<script src="targets.js"></script>') > -1);
  assert.ok(html.indexOf('<script src="targets.js"></script>') < html.lastIndexOf("<script>"));
  const init = html.slice(html.indexOf("async function initStore(){"));
  assert.ok(init.indexOf("runRestTargetsIfNeeded();") > -1);
});

test("steps.js loads and steps are only requested when the host exists", () => {
  const html = fs.readFileSync(HTML, "utf8");
  assert.ok(html.indexOf('<script src="steps.js"></script>') > -1);
  const fn = html.slice(html.indexOf("function requestSteps("));
  assert.ok(fn.indexOf("window.WeekdayFuelHost") > -1);
  const onMsg = html.slice(html.indexOf("function onHostPageMessage("));
  assert.ok(onMsg.indexOf('m.type==="steps"') > -1);
});
