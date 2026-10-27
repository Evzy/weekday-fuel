#!/usr/bin/env node
/**
 * Build weekday_fuel/macros.js PANELS from docs/research/labels-*.json.
 * Run from repo root: node scripts/build-macro-panels.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "apps/android/app/src/main/assets/weekday_fuel/macros.js");

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

function rowToPanel(src0) {
  const asSold = src0.asSoldPer100g || src0.derivedPer100gPowder;
  const row = asSold ? Object.assign({}, src0, { fib: null }, asSold, { basis: "100g" }) : src0;
  const notes = [];
  if (asSold) notes.push("Stored per 100g as sold: " + asSold.method);
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
  if (row.photo) panel.photo = row.photo;
  return panel;
}

function panelIdForRow(row) {
  if (row.role === "fallback") return row.item + "-fallback";
  if (row.role === "pack") return row.item + "-pack";
  return row.item;
}

function buildPhotos(allRows, panels) {
  const onPanel = new Set();
  for (const [id, bag] of Object.entries(panels)) {
    for (const [sk, p] of Object.entries(bag)) {
      if (p && p.photo) onPanel.add(id + "|" + sk);
    }
  }
  const out = [];
  const seen = new Set();
  for (const row of allRows) {
    if (!row.photo || !row.item) continue;
    const sk = storeKey(row.store);
    const pid = panelIdForRow(row);
    if (onPanel.has(pid + "|" + sk)) continue;
    const key = row.item + "|" + sk;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: row.item,
      store: sk,
      product: row.productName || "",
      photo: row.photo,
    });
  }
  return out;
}

function mergePanels(allRows) {
  const byItem = new Map();
  for (const row of allRows) {
    if (!row.item) continue;
    const sk = storeKey(row.store);
    let panelId = row.item;
    if (row.role === "fallback") panelId = row.item + "-fallback";
    else if (row.role === "pack") panelId = row.item + "-pack";
    const key = panelId + "|" + sk;
    const prev = byItem.get(key);
    if (!prev || roleRank(row.role) < roleRank(prev.role)) byItem.set(key, row);
    else if (prev && roleRank(row.role) === roleRank(prev.role) && row.status === "ok" && prev.status !== "ok")
      byItem.set(key, row);
  }
  const panels = {};
  for (const [key, row] of byItem) {
    const panelId = key.slice(0, key.lastIndexOf("|"));
    const sk = key.slice(key.lastIndexOf("|") + 1);
    const panel = rowToPanel(row);
    if (!panel) continue;
    if (!panels[panelId]) panels[panelId] = {};
    panels[panelId][sk] = panel;
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
  if (panels.breast?.coles) {
    panels.breast.coles.photo = "No panel online";
  }
  if (panels.breast?.woolies?.photo) delete panels.breast.woolies.photo;
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
  if (panels.spray?.woolies && panels.spray?.coles?.per === "100mL") {
    panels.spray.coles.confirm =
      "Coles lists this spray per 100 mL but portions are weighed in grams — check the pack.";
  }
  const confirmByItem = {
    potato: {
      any: "Recipe microwaves whole unpeeled potato; panel is FSANZ peeled raw (no unpeeled AFCD entry).",
    },
    corn: {
      woolies: "Panel does not say drained or as-canned — check the can before weighing.",
      coles: "Panel does not say drained or as-canned — check the can before weighing.",
    },
    curry: {
      woolies: "Curry paste values conflict between sources — check the tin.",
    },
    muffin: {
      woolies: "Woolworths and Coles English muffin panels disagree — check your pack.",
      coles: "Woolworths and Coles English muffin panels disagree — check your pack.",
    },
    honey: {
      woolies: "Some values may be printed as '<1g' on the pack — check before trusting 1.0g.",
    },
    oyster: {
      coles: "Some values may be printed as '<1g' on the pack — check before trusting 1.0g.",
      woolies: "Some values may be printed as '<1g' on the pack — check before trusting 1.0g.",
    },
  };
  for (const [itemId, byStore] of Object.entries(confirmByItem)) {
    const bag = panels[itemId];
    if (!bag) continue;
    for (const [sk, msg] of Object.entries(byStore)) {
      if (bag[sk] && !bag[sk].confirm) bag[sk].confirm = msg;
    }
  }
  for (const bag of Object.values(panels)) {
    for (const p of Object.values(bag)) {
      if (!p || p.confirm || !p.note) continue;
      const n = p.note.toLowerCase();
      if (n.includes("confirm on pack") || n.includes("confirm on the") || n.includes("confirm before") || n.includes("values conflict") || n.includes("check on the tin") || n.includes("one store is out of date") || n.includes("confirm on pack before")) {
        const m = p.note.match(/([^.]*confirm[^.]*\.)/i);
        p.confirm = m ? m[1].trim() : "Check the pack against the label.";
      }
    }
  }
  for (const id of ["spinach", "honey", "curry", "fzmix", "fzbroc", "fzberry"]) {
    const c = panels[id]?.coles;
    if (c && c.confirm) delete c.confirm;
  }
  return panels;
}

function serializePanels(panels) {
  return JSON.stringify(panels, null, 2)
    .replace(/"([^"]+)":/g, (m, k) => (/^[a-zA-Z_$][\w$]*$/.test(k) ? k + ":" : m))
    .replace(/"/g, '"');
}

function main() {
  const allRows = LABEL_FILES.flatMap(rowsFromFile);
  let panels = mergePanels(allRows);
  panels = applyOverrides(panels);
  const photos = buildPhotos(allRows, panels);
  const body = `/* Per-store nutrition panels (generated). Regenerate: node scripts/build-macro-panels.mjs */
(function (root) {
  "use strict";
  var PANELS = ${JSON.stringify(panels, null, 2)};
  var PHOTOS = ${JSON.stringify(photos, null, 2)};
  var api = { PANELS: PANELS, PHOTOS: PHOTOS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelMacros = api;
})(this);
`;
  fs.writeFileSync(OUT, body, "utf8");
  console.log("Wrote", OUT, "items:", Object.keys(panels).length);
}

main();
