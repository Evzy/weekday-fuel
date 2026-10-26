#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");

const { MEALS } = require(path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/meals.js"));
const OLD_FIXTURE = path.join(ROOT, "apps/android/app/src/test/fixtures/meals-typed-macros.js");
const { MEALS: OLD_MEALS } = require(OLD_FIXTURE);
const oldById = Object.fromEntries(OLD_MEALS.map((m) => [m.id, m]));
const cat = require(path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/catalogue.js"));
const { PANELS } = require(path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/macros.js"));
const { EXTRA_AMOUNTS } = require(path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/extra-amounts.js"));
const calc = require(path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/meal-calc.js"));

const MC = calc.create({
  panels: PANELS,
  amounts: cat.AMOUNTS,
  extraAmounts: EXTRA_AMOUNTS,
  item: (id) => cat.item(id),
});

const TIERS = ["L", "S", "X"];
const SLOT_MIN = { breakfast: 30, main: 45, snack: 15 };
const STORES = ["woolies", "coles"];

function fmt(v) {
  return `${v.k} kcal · ${v.p}g P · ${v.c}g C · ${v.f}g F`;
}

function diff(a, b) {
  return { dk: b.k - a.k, dp: Math.round((b.p - a.p) * 10) / 10, dc: Math.round((b.c - a.c) * 10) / 10, df: Math.round((b.f - a.f) * 10) / 10 };
}

const violations = [];

for (const m of MEALS) {
  for (const st of STORES) {
    for (const t of TIERS) {
      const old = m.t[t];
      const neu = MC.portion(m.id, t, st);
      const calcK = 4 * neu.p + 4 * neu.c + 9 * neu.f + 2 * (neu.fib || 0);
      if (Math.abs(neu.k - calcK) > 0.05 * calcK + 1) {
        violations.push(`${m.id} ${t} ${st}: 4/4/9 sanity ${neu.k} vs ${calcK.toFixed(1)}`);
      }
      const min = Math.min(...m.slots.map((s) => SLOT_MIN[s]));
      if (t === "S" && neu.p < min) {
        violations.push(`${m.id} Standard ${st}: ${neu.p}g P below ${min}g minimum`);
      }
    }
  }
}

let md = `# Macro before/after (typed meals.js vs computed panels)\n\nGenerated: ${new Date().toISOString().slice(0, 10)}. Store panels from \`labels-a/b/c.json\`; extras from \`extra-amounts.js\`.\n\n`;

for (const m of MEALS) {
  md += `## ${m.name} (\`${m.id}\`)\n\n`;
  md += `| Tier | Old (typed) | Woolworths computed | Δ W | Coles computed | Δ C |\n`;
  md += `|------|-------------|---------------------|-----|----------------|-----|\n`;
  const oldMeal = oldById[m.id];
  for (const t of TIERS) {
    const old = oldMeal && oldMeal.t[t];
    if (!old || old.k == null) continue;
    const w = MC.portion(m.id, t, "woolies");
    const c = MC.portion(m.id, t, "coles");
    const dw = diff(old, w);
    const dc = diff(old, c);
    md += `| ${t} | ${fmt(old)} | ${fmt(w)} | ${dw.dk >= 0 ? "+" : ""}${dw.dk} kcal | ${fmt(c)} | ${dc.dk >= 0 ? "+" : ""}${dc.dk} kcal |\n`;
  }
  md += `\n`;
}

md += `## Rule / guideline checks (computed)\n\n`;
if (!violations.length) md += `No hard-rule violations under computed Woolworths/Coles panels.\n`;
else violations.forEach((v) => (md += `- ${v}\n`));

const outPath = path.join(ROOT, "docs/research/macro-before-after.md");
fs.writeFileSync(outPath, md, "utf8");
console.log("Wrote", outPath, "violations:", violations.length);
