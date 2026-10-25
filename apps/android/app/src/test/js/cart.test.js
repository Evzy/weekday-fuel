const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cartLines, removalLines, colesCartLines, colesRemovalLines, shopFingerprint, sentAfter, emptyLines, planCodes, planExtraStats, planRemovedPhrase, planRemoveFailPhrase, checkoutCleanNoteFromExtras, linesDiffer, projectSentLines, sentLinesForCompare, updateSendFailed } = require("../../main/assets/weekday_fuel/cart.js");

const W = "https://www.woolworths.com.au/shop/productdetails/";
const YOG = { name: "Chobani Greek Yoghurt 907g", url: W + "717518", stockcode: 717518, size: 907, price: 8.8 };
const YOG500 = { name: "Chobani Greek Yoghurt 500g", url: W + "6093769", stockcode: 6093769, size: 500, price: 6.5 };
const EGG12 = { name: "12 pack", url: W + "6013278", stockcode: 6013278, size: 12, price: 6 };
const EGG6 = { name: "6 pack", url: W + "6013276", stockcode: 6013276, size: 6, price: 4 };
const HAM = { name: "D'Orsogna Ham Shaved From The Deli", url: W + "175734", stockcode: 175734, perKg: true, size: 1, price: 28 };
const COLES_BREAST = { name: "Coles Chicken Breast Large", url: "https://www.coles.com.au/product/breast-1", size: 1400, price: 16.8 };
const row = (id, woolies, coles = null) => ({ id, name: "Plain " + id, woolies, coles });

const TRAY = { name: "Woolworths Breast tray", url: W + "969723", stockcode: 969723, size: 1500, sizeLabel: "1.5–2.2kg tray", price: 24.2 };
const COLES_SMALL = { name: "Coles Chicken Breast Small", url: "https://www.coles.com.au/product/coles-breast-small-2263168", size: 600, price: 7.2 };

test("mixed Woolworths parts become one trolley line each without duplicate stockcodes", () => {
  const mixed = {
    product: EGG12,
    quantity: 1,
    cost: 10,
    buy: "1 × 12 eggs + 1 × 6 eggs",
    parts: [
      { product: EGG12, quantity: 1, cost: 6 },
      { product: EGG6, quantity: 1, cost: 4 },
    ],
  };
  const { lines } = cartLines([row("eggs", mixed), row("yog", { product: YOG, quantity: 1 })], {});
  assert.deepEqual(
    lines.map((l) => [l.stockcode, l.quantity]),
    [
      [6013278, 1],
      [6013276, 1],
      [717518, 1],
    ],
  );
  assert.equal(lines.filter((l) => l.stockcode === 6013278).length, 1);
});

test("mixed Woolworths removals keep every part stockcode", () => {
  const mixed = {
    product: EGG12,
    quantity: 1,
    parts: [
      { product: EGG12, quantity: 1, cost: 6 },
      { product: EGG6, quantity: 1, cost: 4 },
    ],
  };
  const rows = [row("eggs", mixed)];
  assert.deepEqual(removalLines({ 6013278: 1, 6013276: 1, 717518: 2 }, rows), [{ stockcode: 717518, quantity: 0 }]);
  assert.deepEqual(removalLines({ 6013278: 1, 6013276: 1 }, rows), []);
});

test("mixed Coles parts become separate trolley lines and merge by product id", () => {
  const small = { name: "Small", url: "https://www.coles.com.au/product/small-2263168", size: 600, price: 7.2 };
  const large = { name: "Large", url: "https://www.coles.com.au/product/large-2263179", size: 1400, price: 15.4 };
  const mixed = {
    product: large,
    quantity: 1,
    parts: [
      { product: large, quantity: 1, cost: 15.4 },
      { product: small, quantity: 1, cost: 7.2 },
    ],
  };
  const { lines } = colesCartLines([row("breast", null, mixed)], {}, {}, idOf);
  assert.deepEqual(
    lines.map((l) => [l.productId, l.quantity]),
    [
      ["2263179", 1],
      ["2263168", 1],
    ],
  );
  const twoRows = colesCartLines([row("a", null, mixed), row("b", null, { product: CM, quantity: 1 })], {}, {}, idOf).lines;
  assert.equal(twoRows.filter((l) => l.productId === "3329137").length, 1);
});

test("mixed Coles removals keep every part product id", () => {
  const mixed = {
    product: COLES_SMALL,
    quantity: 2,
    parts: [
      { product: COLES_SMALL, quantity: 1, cost: 7.2 },
      { product: CB, quantity: 1, cost: 16.8 },
    ],
  };
  const rows = [row("breast", null, mixed)];
  assert.deepEqual(colesRemovalLines({ 2263168: 1, 2263179: 1, 5077283: 2 }, rows, idOf), [{ productId: "5077283", quantity: 0 }]);
});

test("a Woolworths line becomes a trolley line with its pack count", () => {
  const { lines, manual } = cartLines([row("yog", { product: YOG, quantity: 2 })], {});
  assert.deepEqual(lines, [{ itemId: "yog", stockcode: 717518, quantity: 2, name: "Chobani Greek Yoghurt 907g", url: YOG.url }]);
  assert.deepEqual(manual, []);
});

test("ticked items are left out entirely", () => {
  const { lines, manual } = cartLines([row("yog", { product: YOG, quantity: 2 }), row("breast", null, { product: COLES_BREAST, quantity: 1 })], { yog: true, breast: true });
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, []);
});

test("a deli line is sent in kilograms and named with its weight", () => {
  const { lines } = cartLines([row("ham", { product: HAM, quantity: 0.30000000000000004 })], {});
  assert.deepEqual(lines, [{ itemId: "ham", stockcode: 175734, quantity: 0.3, name: "D'Orsogna Ham Shaved From The Deli (300g)", url: HAM.url }]);
});

test("items Woolworths doesn't sell go to the do-it-yourself list", () => {
  const { lines, manual } = cartLines([row("breast", null, { product: COLES_BREAST, quantity: 1 }), row("mystery", null)], {});
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [
    { itemId: "breast", name: "Coles Chicken Breast Large", reason: "coles" },
    { itemId: "mystery", name: "Plain mystery", reason: "nostore" },
  ]);
});

test("a product unavailable online goes to the do-it-yourself list with its reason", () => {
  const r = { ...row("cheese", null, { product: { name: "Coles Light Tasty 500g" }, quantity: 1 }), wooliesUnavailable: { name: "Woolworths Light Tasty 500g" } };
  const { lines, manual } = cartLines([r], {});
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [{ itemId: "cheese", name: "Woolworths Light Tasty 500g", reason: "unavailable" }]);
});

test("items answered 'I have it' are left out of the trolley and the do-it-yourself list", () => {
  const rows = [row("yog", { product: YOG, quantity: 2 }), row("breast", null, { product: COLES_BREAST, quantity: 1 }), row("ham", { product: HAM, quantity: 0.2 })];
  const { lines, manual } = cartLines(rows, {}, { yog: true, breast: true });
  assert.deepEqual(lines.map((l) => l.stockcode), [175734]);
  assert.deepEqual(manual, []);
});

test("a Woolworths tray line sends the tray stockcode and removal drops a previously sent main", () => {
  const rows = [row("breast", { product: TRAY, quantity: 1 })];
  const { lines } = cartLines(rows, {});
  assert.deepEqual(lines, [{ itemId: "breast", stockcode: 969723, quantity: 1, name: TRAY.name, url: TRAY.url }]);
  assert.deepEqual(removalLines({ 6078624: 2, 969723: 1 }, rows), [{ stockcode: 6078624, quantity: 0 }]);
});

test("a Coles line chosen from an alternate pack uses that pack's product id", () => {
  const { lines } = colesCartLines([row("breast", null, { product: COLES_SMALL, quantity: 2 })], {}, {}, idOf);
  assert.deepEqual(lines, [{ itemId: "breast", productId: "2263168", quantity: 2, name: COLES_SMALL.name, url: COLES_SMALL.url }]);
});

test("removalLines sets to 0 only products the shop no longer needs", () => {
  const rows = [row("yog", { product: YOG, quantity: 1 })];
  assert.deepEqual(removalLines({ 717518: 2, 72280: 5, 175734: 0.3 }, rows), [
    { stockcode: 72280, quantity: 0 },
    { stockcode: 175734, quantity: 0 },
  ]);
});

test("removalLines never removes an item still on the list, even unavailable online", () => {
  const unavailable = { ...row("cheese", null), wooliesUnavailable: { name: "Woolworths Light Tasty 500g", stockcode: 729008 } };
  assert.deepEqual(removalLines({ 717518: 2, 729008: 1 }, [row("yog", { product: YOG, quantity: 2 }), unavailable]), []);
  assert.deepEqual(removalLines(null, [row("yog", { product: YOG, quantity: 2 })]), []);
});

test("shopFingerprint follows the plan, not key order", () => {
  const days = [{ day: "2026-10-19", meal: "toasty" }, { day: "2026-10-20", meal: "buffalomac" }];
  const a = shopFingerprint({ toasty: 2, tenderwrap: 1 }, days, 5);
  assert.equal(shopFingerprint({ tenderwrap: 1, toasty: 2, eggmuffin: 0 }, [days[1], days[0]], 5), a);
  assert.notEqual(shopFingerprint({ toasty: 3, tenderwrap: 1 }, days, 5), a);
  assert.notEqual(shopFingerprint({ toasty: 2, tenderwrap: 1 }, [days[0]], 5), a);
  assert.notEqual(shopFingerprint({ toasty: 2, tenderwrap: 1 }, [days[0], { day: "2026-10-20", meal: "schnitzel" }], 5), a);
  assert.notEqual(shopFingerprint({ toasty: 2, tenderwrap: 1 }, days, 4), a);
  assert.equal(typeof a, "string");
});

test("sentAfter records what our sends left in the trolley", () => {
  const last = { 717518: 2, 72280: 5, 175734: 0.3, 729008: 1 };
  const lines = [
    { stockcode: 717518, quantity: 3 },
    { stockcode: 46795, quantity: 1 },
    { stockcode: 72280, quantity: 0 },
    { stockcode: 175734, quantity: 0 },
    { stockcode: 524322, quantity: 1 },
  ];
  const results = [
    { stockcode: 717518, added: true },
    { stockcode: 46795, added: true },
    { stockcode: 72280, added: true },
    { stockcode: 175734, added: false, reason: "HTTP 500" },
    { stockcode: 524322, added: false, reason: "not available" },
  ];
  assert.deepEqual(sentAfter(last, lines, results), { 717518: 3, 46795: 1, 175734: 0.3, 729008: 1 });
  assert.deepEqual(sentAfter(null, [{ stockcode: 46795, quantity: 1 }], [{ stockcode: 46795, added: true }]), { 46795: 1 });
  assert.deepEqual(last, { 717518: 2, 72280: 5, 175734: 0.3, 729008: 1 });
});

const CB = { name: "Coles Chicken Breast Large", url: "https://www.coles.com.au/product/coles-breast-large-2263179", price: 16.8 };
const CM = { name: "Coles Macaroni 500g", url: "https://www.coles.com.au/product/coles-macaroni-3329137", price: 1 };
const YOG_ROW_W = { product: YOG, quantity: 1 };
const idOf = (p) => { const m = /-(\d{4,7})$/.exec((p && p.url) || ""); return m ? m[1] : null; };

test("a Coles line becomes a trolley line keyed by its Coles product ID", () => {
  const { lines, manual } = colesCartLines([row("breast", null, { product: CB, quantity: 2 })], {}, {}, idOf);
  assert.deepEqual(lines, [{ itemId: "breast", productId: "2263179", quantity: 2, name: CB.name, url: CB.url }]);
  assert.deepEqual(manual, []);
});

test("Coles merged quantity caps at 99 and sends the rest to the manual list", () => {
  const rows = [row("a", null, { product: CM, quantity: 60 }), row("b", null, { product: CM, quantity: 50 })];
  const { lines, manual } = colesCartLines(rows, {}, {}, idOf);
  assert.deepEqual(lines, [{ itemId: "a", productId: "3329137", quantity: 99, name: CM.name, url: CM.url }]);
  assert.deepEqual(manual, [{ itemId: "b", name: CM.name + " (add 11 yourself)", reason: "limit" }]);
});

test("Coles single line over 99 caps the trolley line and manual lists the remainder", () => {
  const { lines, manual } = colesCartLines([row("mac", null, { product: CM, quantity: 105 })], {}, {}, idOf);
  assert.deepEqual(lines, [{ itemId: "mac", productId: "3329137", quantity: 99, name: CM.name, url: CM.url }]);
  assert.deepEqual(manual, [{ itemId: "mac", name: CM.name + " (add 6 yourself)", reason: "limit" }]);
});

test("Coles lines skip ticked and 'I have it' items and merge rows that share a product", () => {
  const rows = [row("mac", null, { product: CM, quantity: 1 }), row("mac2", null, { product: CM, quantity: 2 }), row("breast", null, { product: CB, quantity: 1 }), row("yog", YOG_ROW_W, { product: CB, quantity: 1 })];
  const { lines } = colesCartLines(rows, { breast: true }, { yog: true }, idOf);
  assert.deepEqual(lines, [{ itemId: "mac", productId: "3329137", quantity: 3, name: CM.name, url: CM.url }]);
});

test("items Coles doesn't have online go to the do-it-yourself list with their reason", () => {
  const unavailable = { ...row("cheese", { product: YOG, quantity: 1 }), colesUnavailable: { name: "Coles Light Tasty 500g" } };
  const { lines, manual } = colesCartLines([row("yog", { product: YOG, quantity: 1 }), unavailable, row("mystery", null)], {}, {}, idOf);
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [
    { itemId: "yog", name: YOG.name, reason: "woolies" },
    { itemId: "cheese", name: "Coles Light Tasty 500g", reason: "unavailable" },
    { itemId: "mystery", name: "Plain mystery", reason: "nostore" },
  ]);
});

test("colesRemovalLines sets to 0 only Coles products the shop no longer needs", () => {
  const rows = [row("mac", null, { product: CM, quantity: 1 }), { ...row("breast", null), colesUnavailable: CB }];
  assert.deepEqual(colesRemovalLines({ 3329137: 1, 2263179: 1, 5077283: 2 }, rows, idOf), [{ productId: "5077283", quantity: 0 }]);
  assert.deepEqual(colesRemovalLines(null, rows, idOf), []);
});

test("sentAfter can key Coles lines by productId", () => {
  const lines = [{ productId: "3329137", quantity: 2 }, { productId: "5077283", quantity: 0 }, { productId: "2263179", quantity: 1 }];
  const results = [{ productId: "3329137", added: true }, { productId: "5077283", added: true }, { productId: "2263179", added: false }];
  assert.deepEqual(sentAfter({ 5077283: 2, 1111: 1 }, lines, results, "productId"), { 1111: 1, 3329137: 2 });
});

test("emptyLines turns every positive sent code into a quantity-zero removal", () => {
  const w = emptyLines({ 717518: 2, 72280: 0, 175734: 0.3 }, "woolies").sort((a, b) => a.stockcode - b.stockcode);
  assert.deepEqual(w, [
    { stockcode: 175734, quantity: 0 },
    { stockcode: 717518, quantity: 0 },
  ]);
  const c = emptyLines({ 3329137: 1, 2263179: 3 }, "coles").sort((a, b) => a.productId.localeCompare(b.productId));
  assert.deepEqual(c, [
    { productId: "2263179", quantity: 0 },
    { productId: "3329137", quantity: 0 },
  ]);
  assert.deepEqual(emptyLines(null, "woolies"), []);
  assert.deepEqual(emptyLines({}, "coles"), []);
});

test("planCodes lists Woolworths part and deli stockcodes deduplicated", () => {
  const deli = { product: HAM, quantity: 0.3, cost: 8.4, buy: "300g" };
  const mixed = {
    product: EGG12,
    quantity: 1,
    parts: [
      { product: EGG12, quantity: 1 },
      { product: EGG6, quantity: 1 },
    ],
  };
  const rows = [row("ham", deli), row("eggs", mixed), row("nostore", null, { product: CM, quantity: 1 })];
  assert.deepEqual(planCodes(rows, "woolies", idOf).sort(), [175734, 6013276, 6013278].sort((a, b) => a - b));
});

test("planCodes lists Coles product ids from parts and skips rows without Coles lines", () => {
  const large = { name: "Large", url: "https://www.coles.com.au/product/large-2263179", size: 1400, price: 15.4 };
  const mixed = {
    product: large,
    quantity: 1,
    parts: [
      { product: large, quantity: 1 },
      { product: COLES_SMALL, quantity: 1 },
    ],
  };
  const rows = [row("w", { product: YOG, quantity: 1 }), row("c", null, mixed)];
  assert.deepEqual(planCodes(rows, "coles", idOf).sort(), ["2263168", "2263179"].sort());
  assert.deepEqual(planCodes([], "coles", idOf), []);
});

test("plan removed and fail phrases use singular and plural wording", () => {
  assert.equal(planRemovedPhrase(0), "");
  assert.equal(planRemovedPhrase(1), "Removed 1 item that wasn't in your plan");
  assert.equal(planRemovedPhrase(2), "Removed 2 items that weren't in your plan");
  assert.equal(planRemoveFailPhrase(1, "Woolworths"), "Couldn't remove 1 item not in your plan — remove it on Woolworths.");
  assert.equal(planRemoveFailPhrase(3, "Coles"), "Couldn't remove 3 items not in your plan — remove them on Coles.");
});

test("checkoutCleanNoteFromExtras names only successful extra removals", () => {
  const results = [
    { stockcode: 888888, added: true, extra: true },
    { stockcode: 999999, added: false, extra: true },
    { stockcode: 717518, added: true },
  ];
  const note = checkoutCleanNoteFromExtras(results, { 888888: "Extra Snack", 999999: "Stuck item" });
  assert.deepEqual(note, { removed: 1, fail: 1, names: ["Extra Snack"] });
});

test("sentAfter ignores extra results", () => {
  const lines = [{ stockcode: 717518, quantity: 2 }];
  const results = [{ stockcode: 717518, added: true }, { stockcode: 999, added: true, extra: true }];
  assert.deepEqual(sentAfter({}, lines, results), { 717518: 2 });
  assert.deepEqual(planExtraStats(results), { removed: 1, fail: 0 });
});

test("linesDiffer detects quantity, add, and removal changes", () => {
  const sent = { 717518: 2, 72280: 1 };
  assert.equal(linesDiffer(sent, [{ stockcode: 717518, quantity: 2 }], "woolies"), false);
  assert.equal(linesDiffer(sent, [{ stockcode: 717518, quantity: 3 }], "woolies"), true);
  assert.equal(linesDiffer(sent, [{ stockcode: 72280, quantity: 0 }], "woolies"), true);
  assert.equal(linesDiffer(sent, [{ productId: "8991361", quantity: 1 }], "coles", "productId"), true);
  assert.deepEqual(projectSentLines(sent, [{ stockcode: 717518, quantity: 3 }]), { 717518: 3, 72280: 1 });
});

test("linesDiffer ignores failed add attempts recorded in sendFailed", () => {
  const sent = { 717518: 2 };
  const sendLines = [{ stockcode: 72280, quantity: 1 }];
  assert.equal(linesDiffer(sent, sendLines, "woolies"), true);
  const failed = updateSendFailed({}, sendLines, [{ stockcode: 72280, added: false }], "stockcode");
  assert.deepEqual(failed, { 72280: 1 });
  assert.equal(linesDiffer(sent, sendLines, "woolies", "stockcode", failed), false);
  assert.equal(linesDiffer(sent, [{ stockcode: 72280, quantity: 2 }], "woolies", "stockcode", failed), true);
  assert.deepEqual(sentLinesForCompare(sent, failed), { 717518: 2, 72280: 1 });
});

test("a planned meal's Light or Loaded portion is part of the fingerprint, and Standard keys are unchanged", () => {
  const base = shopFingerprint({}, [{ day: "2026-10-20", meal: "mac" }], 5);
  assert.equal(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "S" }], 5), base);
  assert.notEqual(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "X" }], 5), base);
  assert.notEqual(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "L" }], 5), shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "X" }], 5));
});
