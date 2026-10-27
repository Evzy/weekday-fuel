const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const LP = require("../../main/assets/weekday_fuel/label-photos.js");
const { PANELS, PHOTOS } = require("../../main/assets/weekday_fuel/macros.js");
const cat = require("../../main/assets/weekday_fuel/catalogue.js");
const { EXTRA_AMOUNTS } = require("../../main/assets/weekday_fuel/extra-amounts.js");
const { BATCHES } = require("../../main/assets/weekday_fuel/meals.js");
const BATCH = Object.fromEntries(BATCHES.map((b) => [b.id, b]));

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
Object.keys(PANELS).forEach((id) => {
  if (!itemIds.includes(id)) itemIds.push(id);
});

function labelPhotoProductName(id, st, panelProduct) {
  const it = cat.item(id);
  if (it && it[st] && it[st].name) return it[st].name;
  if (id === "gr-cookie") {
    const gren = cat.item("grenade");
    const sw = gren && gren.swaps && gren.swaps.find((s) => s.id === "gr-cookie");
    if (sw) {
      const p = sw[st] || sw.woolies || sw.coles;
      if (p && p.name) return p.name;
      if (sw.name) return sw.name;
    }
  }
  if (it) return "";
  return panelProduct || "";
}

function expectedCatalogueName(id, st) {
  const n = labelPhotoProductName(id, st, "");
  return n || null;
}

function list(store) {
  return LP.listForStore(store, PANELS, PHOTOS, itemIds, labelPhotoProductName);
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

test("list product names match catalogue store products when listed", () => {
  for (const st of ["woolies", "coles"]) {
    for (const e of list(st)) {
      const exp = expectedCatalogueName(e.id, st);
      if (exp) assert.equal(e.product, exp, e.id + " " + st);
    }
  }
  const colesBreast = list("coles").find((e) => e.id === "breast");
  assert.ok(colesBreast);
  assert.equal(colesBreast.product, cat.item("breast").coles.name);
});

test("gr-cookie appears without a panel", () => {
  assert.equal(PANELS["gr-cookie"], undefined);
  assert.ok(PHOTOS.some((p) => p.id === "gr-cookie" && p.store === "woolies"));
  assert.ok(hasReminder("woolies", "gr-cookie"));
  const entry = list("woolies").find((e) => e.id === "gr-cookie");
  assert.equal(entry.product, labelPhotoProductName("gr-cookie", "woolies", ""));
});

test("potato and trimmed Coles reminders are absent", () => {
  assert.equal(hasReminder("woolies", "potato"), false);
  assert.equal(hasReminder("coles", "potato"), false);
  assert.equal(hasReminder("woolies", "breast"), false);
  assert.equal(hasReminder("coles", "breast"), true);
  assert.equal(hasReminder("coles", "spinach"), false);
  assert.equal(hasReminder("coles", "honey"), false);
  assert.equal(hasReminder("coles", "curry"), false);
  assert.equal(hasReminder("coles", "fzmix"), false);
});

test("Coles spray reminder is store-specific", () => {
  assert.ok(hasReminder("coles", "spray"));
  assert.equal(hasReminder("woolies", "spray"), false);
  const spray = list("coles").find((e) => e.id === "spray");
  assert.ok(spray.product.includes("Coles Canola"));
});

test("mealReminders lists flagged ingredients for the tier", () => {
  const r = LP.mealReminders("toasty", "L", "coles", PANELS, PHOTOS, cat.AMOUNTS, EXTRA_AMOUNTS, itemIds, labelPhotoProductName);
  assert.ok(r.some((x) => x.id === "spray"));
});

test("mealReminders skips batch-prep ingredients", () => {
  const r = LP.mealReminders("tenderwrap", "S", "coles", PANELS, PHOTOS, cat.AMOUNTS, EXTRA_AMOUNTS, itemIds, labelPhotoProductName, {
    skipIds: ["breast"],
  });
  assert.ok(!r.some((x) => x.id === "breast"));
});

test("batch with items includes with list for skip and prep reminders", () => {
  const bolo = BATCH.bolo;
  assert.deepEqual(LP.batchIngredientIds(bolo), ["mince", "passata", "fzmix", "garlic"]);
  const skip = LP.batchIngredientIds(bolo);
  const mealR = LP.mealReminders("bolognese", "S", "woolies", PANELS, PHOTOS, cat.AMOUNTS, EXTRA_AMOUNTS, itemIds, labelPhotoProductName, {
    skipIds: skip,
  });
  assert.ok(!mealR.some((x) => x.id === "fzmix"), "weeknight bolognese skips batch fzmix");
  const map = LP.reminderMap("woolies", PANELS, PHOTOS, itemIds, labelPhotoProductName);
  const batchFlagged = LP.batchIngredientIds(bolo).filter((id) => map[id]);
  assert.ok(batchFlagged.includes("fzmix"), "Sunday batch still flags fzmix");
});
