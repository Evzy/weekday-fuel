const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const LP = require("../../main/assets/weekday_fuel/label-photos.js");
const { PANELS, PHOTOS } = require("../../main/assets/weekday_fuel/macros.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const { EXTRA_AMOUNTS } = require("../../main/assets/weekday_fuel/extra-amounts.js");

const ROOT = path.resolve(__dirname, "../../../../../..");
const LABEL_FILES = [
  path.join(ROOT, "docs/research/labels-a.json"),
  path.join(ROOT, "docs/research/labels-b.json"),
  path.join(ROOT, "docs/research/labels-c.json"),
];

function rowsFromFile(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(raw)) return raw;
  const out = [];
  if (Array.isArray(raw.items)) out.push(...raw.items);
  if (Array.isArray(raw.extraProducts)) out.push(...raw.extraProducts);
  return out;
}

const researchRows = LABEL_FILES.flatMap(rowsFromFile);
const rowsWithPhoto = researchRows.filter((r) => r.photo && r.item);

const itemIds = cat.ITEMS.map((i) => i.id);
const itemName = (id) => {
  const it = cat.item(id);
  return it ? it.name : "";
};

function list(store) {
  return LP.listForStore(store, PANELS, PHOTOS, itemIds, itemName);
}

function hasReminder(store, id) {
  return list(store).some((e) => e.id === id);
}

test("every research row with photo appears for its store", () => {
  for (const row of rowsWithPhoto) {
    const store = row.store === "any" ? "woolies" : row.store === "woolies" ? "woolies" : "coles";
    if (row.item === "potato") continue;
    const entries = list(store);
    const hit = entries.find((e) => e.id === row.item && e.photo === row.photo);
    assert.ok(hit, row.item + " " + store + " photo list");
  }
});

test("gr-cookie appears without a panel", () => {
  assert.equal(PANELS["gr-cookie"], undefined);
  assert.ok(PHOTOS.some((p) => p.id === "gr-cookie" && p.store === "woolies"));
  assert.ok(hasReminder("woolies", "gr-cookie"));
});

test("potato and items without photo are absent", () => {
  assert.equal(hasReminder("woolies", "potato"), false);
  assert.equal(hasReminder("coles", "potato"), false);
  assert.equal(hasReminder("woolies", "breast"), false);
  assert.equal(hasReminder("coles", "breast"), true);
});

test("Coles spray reminder is store-specific", () => {
  assert.ok(hasReminder("coles", "spray"));
  assert.equal(hasReminder("woolies", "spray"), false);
});

test("mealReminders lists flagged ingredients for the tier", () => {
  const extraIds = itemIds.concat(Object.keys(PANELS));
  const r = LP.mealReminders("toasty", "L", "coles", PANELS, PHOTOS, cat.AMOUNTS, EXTRA_AMOUNTS, extraIds, itemName);
  assert.ok(r.some((x) => x.id === "spray"));
});
