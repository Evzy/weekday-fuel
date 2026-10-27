/* Label photo reminders from panel photo flags and PHOTOS list. Pure: no DOM, no storage. */
(function (root) {
  "use strict";

  function panelForStore(bag, store) {
    if (!bag) return null;
    return bag[store] || bag.any || null;
  }

  function listForStore(store, panels, photos, itemIds, itemName) {
    itemName =
      itemName ||
      function () {
        return "";
      };
    var out = [];
    var seen = {};
    var order = {};
    var ids = (itemIds || []).slice();
    Object.keys(panels || {}).forEach(function (id) {
      if (ids.indexOf(id) < 0) ids.push(id);
    });
    (itemIds || []).forEach(function (id, i) {
      order[id] = i;
    });
    ids.forEach(function (id) {
      var p = panelForStore(panels[id], store);
      if (!p || !p.photo) return;
      seen[id] = true;
      out.push({ id: id, product: p.product || itemName(id) || id, photo: p.photo });
    });
    (photos || []).forEach(function (row) {
      if (row.store !== store && row.store !== "any") return;
      if (seen[row.id]) return;
      seen[row.id] = true;
      out.push({ id: row.id, product: row.product || itemName(row.id) || row.id, photo: row.photo });
    });
    out.sort(function (a, b) {
      var oa = order[a.id];
      var ob = order[b.id];
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return a.product.localeCompare(b.product);
    });
    return out;
  }

  function reminderMap(store, panels, photos, itemIds, itemName) {
    var map = {};
    listForStore(store, panels, photos, itemIds, itemName).forEach(function (e) {
      map[e.id] = { product: e.product, photo: e.photo };
    });
    return map;
  }

  function amountForTier(spec, tier) {
    if (spec == null) return 0;
    if (typeof spec === "number") return spec;
    return spec[tier] || 0;
  }

  function mealIngredientIds(mealId, tier, amounts, extraAmounts) {
    var ids = [];
    var mealAmounts = amounts[mealId];
    if (mealAmounts) {
      Object.keys(mealAmounts).forEach(function (id) {
        if (amountForTier(mealAmounts[id], tier) > 0) ids.push(id);
      });
    }
    var ex = extraAmounts[mealId];
    if (ex) {
      Object.keys(ex).forEach(function (id) {
        if (amountForTier(ex[id], tier) > 0) ids.push(id);
      });
    }
    return ids;
  }

  function mealReminders(mealId, tier, store, panels, photos, amounts, extraAmounts, itemIds, itemName) {
    var map = reminderMap(store, panels, photos, itemIds, itemName);
    var out = [];
    var seen = {};
    mealIngredientIds(mealId, tier, amounts, extraAmounts).forEach(function (id) {
      if (seen[id]) return;
      var r = map[id];
      if (!r) return;
      seen[id] = true;
      out.push({ id: id, product: r.product, photo: r.photo });
    });
    return out;
  }

  var api = {
    panelForStore: panelForStore,
    listForStore: listForStore,
    reminderMap: reminderMap,
    mealIngredientIds: mealIngredientIds,
    mealReminders: mealReminders,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelLabelPhotos = api;
})(this);
