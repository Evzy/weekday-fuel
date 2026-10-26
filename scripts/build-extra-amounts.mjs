#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const labelsC = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/research/labels-c.json"), "utf8"));
const OUT = path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/extra-amounts.js");

const OVERRIDES = {
  buffalomac: {
    garlic: { L: 5, S: 5, X: 5, _ml: false },
    paprika: { L: 1, S: 1, X: 1, _ml: false },
  },
};

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
  for (const [meal, items] of Object.entries(OVERRIDES)) {
    if (!out[meal]) out[meal] = {};
    Object.assign(out[meal], items);
    delete out[meal].garlicpowder;
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
