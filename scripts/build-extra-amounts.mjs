#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const ROOT = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const { AMOUNTS } = require("../apps/android/app/src/main/assets/weekday_fuel/catalogue.js");
const labelsC = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/research/labels-c.json"), "utf8"));
const OUT = path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/extra-amounts.js");

function tierSpec(tiers, amount) {
  const o = { L: 0, S: 0, X: 0 };
  for (const ch of String(tiers || "")) {
    if (ch === "L" || ch === "S" || ch === "X") o[ch] = amount;
  }
  return o;
}

function build() {
  const out = {};
  for (const row of labelsC.extras || []) {
    if (!row.meal || String(row.meal).startsWith("batch:")) continue;
    if (row.zeroEnergy || !row.item || row.amount == null) continue;
    if (AMOUNTS[row.meal] && AMOUNTS[row.meal][row.item] != null) continue;
    if (!out[row.meal]) out[row.meal] = {};
    const spec = tierSpec(row.tiers, row.amount);
    if (row.unit === "mL") spec._ml = true;
    const prev = out[row.meal][row.item];
    if (prev) {
      for (const t of ["L", "S", "X"]) spec[t] = Math.max(spec[t], prev[t] || 0);
      if (prev._ml) spec._ml = true;
    }
    out[row.meal][row.item] = spec;
  }
  for (const [meal, items] of Object.entries(out)) {
    if (items.garlicpowder && AMOUNTS[meal]?.garlic != null) delete items.garlicpowder;
    if (Object.keys(items).length === 0) delete out[meal];
  }
  return out;
}

const amounts = build();
const body = `/* Measured extras per meal portion (generated). Regenerate: node scripts/build-extra-amounts.mjs */
(function (root) {
  "use strict";
  var EXTRA_AMOUNTS = ${JSON.stringify(amounts, null, 2)};
  var api = { EXTRA_AMOUNTS: EXTRA_AMOUNTS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelExtraAmounts = api;
})(this);
`;
fs.writeFileSync(OUT, body, "utf8");
console.log("Wrote", OUT, "meals:", Object.keys(amounts).length);
