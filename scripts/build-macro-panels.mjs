#!/usr/bin/env node
/**
 * Build weekday_fuel/macros.js PANELS from docs/research/labels-*.json.
 * Run from repo root: node scripts/build-macro-panels.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/macro-panels.js");

const LABEL_FILES = [
  path.join(ROOT, "docs/research/labels-a.json"),
  path.join(ROOT, "docs/research/labels-b.json"),
  path.join(ROOT, "docs/research/labels-c.json"),
];

function parseNum(v, noteRef) {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).trim();
  if (!s || s === "-") return null;
  if (s.startsWith("<")) {
    if (noteRef && !noteRef.includes("upper bound")) noteRef.push("Values printed '<1' stored as 1g (upper bound)");
    return 1;
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function rowsFromFile(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(raw)) return raw;
  const out = [];
  if (Array.isArray(raw.items)) out.push(...raw.items);
  if (Array.isArray(raw.extraProducts)) out.push(...raw.extraProducts);
  return out;
}

function storeKey(store) {
  if (!store || store === "any") return "any";
  return store === "coles" ? "coles" : store === "woolies" ? "woolies" : store;
}

function roleRank(role) {
  if (role === "main") return 0;
  if (role === "swap") return 1;
  if (role === "pack") return 2;
  return 3;
}

function rowToPanel(row) {
  const notes = [];
  const kcal =
    row.kcal != null
      ? parseNum(row.kcal, notes)
      : row.kj != null
        ? Math.round((parseNum(row.kj, notes) / 4.184) * 10) / 10
        : null;
  const p = parseNum(row.p, notes);
  const c = parseNum(row.c, notes);
  const f = parseNum(row.f, notes);
  const fib = parseNum(row.fib, notes);
  if (row.status === "missing" && !kcal && !p && !f && !c) return null;
  const src = row.src === "fsanz" || row.status === "fsanz-candidate" ? "fsanz" : "label";
  const per = row.basis && String(row.basis).includes("mL") ? "100mL" : "100g";
  const panel = {
    k: kcal ?? 0,
    p: p ?? 0,
    c: c ?? 0,
    f: f ?? 0,
    per,
    src,
  };
  if (fib != null) panel.fib = fib;
  if (src === "label") {
    panel.product = row.productName || "";
    panel.id = row.productId != null ? String(row.productId) : "";
    panel.checked = row.checked || "";
  } else {
    panel.food = row.fsanzId || row.food || "";
    panel.name = row.fsanzName || row.foodName || row.productName || "";
  }
  let note = row.notes || "";
  if (notes.length) note = (note ? note + " " : "") + notes.join(" ");
  if (row.panelBasisNote) note = (note ? note + " " : "") + row.panelBasisNote;
  if (note) panel.note = note.trim();
  return panel;
}

function mergePanels(allRows) {
  const byItem = new Map();
  for (const row of allRows) {
    if (!row.item) continue;
    const sk = storeKey(row.store);
    const key = row.item + "|" + sk;
    const prev = byItem.get(key);
    if (!prev || roleRank(row.role) < roleRank(prev.role)) byItem.set(key, row);
    else if (prev && roleRank(row.role) === roleRank(prev.role) && row.status === "ok" && prev.status !== "ok")
      byItem.set(key, row);
  }
  const panels = {};
  for (const [key, row] of byItem) {
    const [item, sk] = key.split("|");
    const panel = rowToPanel(row);
    if (!panel) continue;
    if (!panels[item]) panels[item] = {};
    panels[item][sk] = panel;
  }
  return panels;
}

function applyOverrides(panels) {
  const w = panels.breast?.woolies;
  if (w && !panels.breast?.coles) {
    panels.breast.coles = Object.assign({}, w, {
      note: "Woolworths panel, Coles has none online. " + (w.note || ""),
    });
  }
  if (panels.paprika?.any && !panels.paprika.woolies) {
    panels.paprika.woolies = panels.paprika.any;
    panels.paprika.coles = panels.paprika.any;
  }
  if (panels.spinach?.woolies) {
    const n = panels.spinach.woolies.note || "";
    if (!n.includes("upper bound")) {
      panels.spinach.woolies.note =
        (n ? n + " " : "") + "Fat/carbs/sugars printed '<1g' stored as 1g (upper bound).";
    }
  }
  return panels;
}

function serializePanels(panels) {
  return JSON.stringify(panels, null, 2)
    .replace(/"([^"]+)":/g, (m, k) => (/^[a-zA-Z_$][\w$]*$/.test(k) ? k + ":" : m))
    .replace(/"/g, '"');
}

function legacyMacros(panels) {
  const MACROS = {};
  for (const [id, stores] of Object.entries(panels)) {
    const p = stores.woolies || stores.any || stores.coles;
    if (!p) continue;
    MACROS[id] = [p.k, p.p, p.c, p.f, p.per || "100g", p.src || "label", p.note || ""];
  }
  return MACROS;
}

function main() {
  const allRows = LABEL_FILES.flatMap(rowsFromFile);
  let panels = mergePanels(allRows);
  panels = applyOverrides(panels);
  const legacy = legacyMacros(panels);
  const body = `/* Per-store nutrition panels (generated). Regenerate: node scripts/build-macro-panels.mjs */
(function (root) {
  "use strict";
  var PANELS = ${JSON.stringify(panels, null, 2)};
  var LEGACY_MACROS = ${JSON.stringify(legacy, null, 2)};
  var api = { PANELS: PANELS, LEGACY_MACROS: LEGACY_MACROS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelMacroPanels = api;
})(this);
`;
  fs.writeFileSync(OUT, body, "utf8");
  console.log("Wrote", OUT, "items:", Object.keys(panels).length);
}

main();
