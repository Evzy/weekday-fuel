const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cartLines } = require("../../main/assets/weekday_fuel/cart.js");

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
