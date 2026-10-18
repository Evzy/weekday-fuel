const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cartLines, removalLines, colesCartLines, colesRemovalLines, shopFingerprint, sentAfter } = require("../../main/assets/weekday_fuel/cart.js");

const W = "https://www.woolworths.com.au/shop/productdetails/";
const YOG = { name: "Chobani Greek Yoghurt 907g", url: W + "717518", stockcode: 717518, size: 907, price: 8.8 };
const HAM = { name: "D'Orsogna Ham Shaved From The Deli", url: W + "175734", stockcode: 175734, perKg: true, size: 1, price: 28 };
const COLES_BREAST = { name: "Coles Chicken Breast Large", url: "https://www.coles.com.au/product/breast-1", size: 1400, price: 16.8 };
const row = (id, woolies, coles = null) => ({ id, name: "Plain " + id, woolies, coles });

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

test("a planned meal's Light or Loaded portion is part of the fingerprint, and Standard keys are unchanged", () => {
  const base = shopFingerprint({}, [{ day: "2026-10-20", meal: "mac" }], 5);
  assert.equal(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "S" }], 5), base);
  assert.notEqual(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "X" }], 5), base);
  assert.notEqual(shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "L" }], 5), shopFingerprint({}, [{ day: "2026-10-20", meal: "mac", t: "X" }], 5));
});
