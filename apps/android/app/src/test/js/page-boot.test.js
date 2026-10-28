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
