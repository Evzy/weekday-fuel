const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../main/assets/weekday_fuel/specials.js");
const { colesId } = require("../../main/assets/weekday_fuel/catalogue.js");

const wp = (code, price, extra = {}) => ({ name: "W" + code, url: "https://www.woolworths.com.au/shop/productdetails/" + code, stockcode: code, size: 1, price, ...extra });
const cp = (id, price, extra = {}) => ({ name: "C" + id, url: "https://www.coles.com.au/product/x-" + id, size: 1, price, ...extra });
const item = (swaps) => ({ id: "dare", per: { k: 296, p: 30 }, woolies: wp(72280, 4.65), coles: cp(8991361, 4.65), swaps });
const row = (need, have, wCost, cCost) => ({ id: "dare", need, have, woolies: wCost == null ? null : { product: wp(72280, 4.65), quantity: need - (have || 0), cost: wCost, buy: "x" }, coles: cCost == null ? null : { product: cp(8991361, 4.65), quantity: need - (have || 0), cost: cCost, buy: "x" } });
const sw = (id, k, p, w, c, serves = 1) => ({ id, name: id + " name", serves, per: { k, p }, woolies: w, coles: c });

test("swapIds lists every swap stockcode and coles id", () => {
  const items = [item([sw("a", 290, 30, wp(111, 4), cp(2222, 4)), sw("b", 290, 30, null, cp(3333, 4))]), { id: "eggs" }];
  assert.deepEqual(S.swapIds(items, colesId), { stockcodes: [111], colesIds: ["2222", "3333"] });
});

test("applySwapPrices writes live price, was, special and available", () => {
  const items = [item([sw("a", 290, 30, wp(111, 4), cp(2222, 4))]), { id: "eggs" }];
  const out = S.applySwapPrices(items, { 111: { price: 3, was: 4, special: true, available: true } }, { 2222: { available: false } }, colesId);
  const a = out[0].swaps[0];
  assert.deepEqual([a.woolies.price, a.woolies.was, a.woolies.special, a.woolies.available, a.woolies.live], [3, 4, true, true, true]);
  assert.equal(a.coles.available, false);
  assert.equal(a.coles.price, 4);
  assert.equal(out[1], items[1]);
  assert.equal(items[0].swaps[0].woolies.price, 4, "input not mutated");
  assert.equal(S.applySwapPrices(items, null, null, colesId)[0], items[0]);
});

test("applySwapPrices keeps short and full per through live prices", () => {
  const big = {
    id: "dare-750",
    short: "Dare 45g",
    todayOnly: true,
    name: "Dare 750",
    serves: 1,
    per: { k: 444, p: 45, c: 38.3, f: 12 },
    woolies: wp(6020777, 5.8),
    coles: cp(1045886, 5.8),
  };
  const items = [item([big])];
  const out = S.applySwapPrices(items, { 6020777: { price: 5.5, special: true, available: true } }, null, colesId);
  const a = out[0].swaps[0];
  assert.equal(a.short, "Dare 45g");
  assert.equal(a.todayOnly, true);
  assert.equal(a.per.c, 38.3);
  assert.equal(a.per.f, 12);
  assert.equal(a.woolies.price, 5.5);
});

test("suggest skips todayOnly swaps", () => {
  const today = sw("dare-750", 444, 45, wp(6020777, 3.3, { special: true }), cp(1045886, 3.3, { special: true }));
  today.todayOnly = true;
  const regular = sw("a", 292, 30, wp(111, 3.3, { special: true }), cp(2222, 3.3, { special: true }));
  const it = item([today, regular]);
  const s = S.suggest(row(5, 0, 23.25, null), it, "woolies", []);
  assert.ok(s);
  assert.equal(s.swap.id, "a");
  assert.equal(S.suggest(row(5, 0, 23.25, null), it, "woolies", [], "dare-750"), null);
});

test("guard boundaries", () => {
  const main = { per: { k: 296, p: 30 } };
  assert.equal(S.passesGuard(main, { per: { k: 376, p: 25 } }), true);
  assert.equal(S.passesGuard(main, { per: { k: 377, p: 30 } }), false);
  assert.equal(S.passesGuard(main, { per: { k: 296, p: 24.9 } }), false);
});

test("suggest picks the cheapest special that passes and is cheaper", () => {
  const it = item([
    sw("a", 292, 30, wp(111, 3.3, { special: true })),
    sw("b", 270, 30, wp(222, 3.0, { special: true })),
    sw("c", 400, 30, wp(333, 1.0, { special: true })),
    sw("d", 290, 30, wp(444, 2.0, { special: false })),
    sw("e", 290, 30, wp(555, 2.0, { special: true, available: false })),
  ]);
  const s = S.suggest(row(5, 0, 23.25, null), it, "woolies", []);
  assert.equal(s.swap.id, "b");
  assert.deepEqual([s.quantity, s.cost, s.saving, s.dk, s.dp], [5, 15, 8.25, -26, 0]);
  assert.equal(s.product.stockcode, 222);
});

test("suggest honours muted, other store only, have and cheaper-only", () => {
  const it = item([sw("a", 292, 30, wp(111, 3.3, { special: true }), cp(2222, 9, { special: true }))]);
  assert.equal(S.suggest(row(5, 0, 23.25, 23.25), it, "woolies", ["dare:a"]), null);
  assert.equal(S.suggest(row(5, 0, 23.25, 23.25), it, "coles", []), null, "coles special is dearer");
  assert.equal(S.suggest(row(5, 5, 0, null), it, "woolies", []), null, "nothing left to buy");
  assert.equal(S.suggest(row(5, 2, 13.95, null), it, "woolies", []).quantity, 3);
  const noSwapAtColes = item([sw("a", 292, 30, wp(111, 3.3, { special: true }))]);
  assert.equal(S.suggest(row(5, 0, 23.25, 23.25), noSwapAtColes, "coles", []), null);
});

test("suggest rounds packs up by serves and breaks ties by order", () => {
  const it = item([sw("two", 292, 30, wp(111, 6, { special: true }), null, 2), sw("one", 292, 30, wp(222, 3, { special: true }))]);
  const s = S.suggest(row(5, 0, 23.25, null), it, "woolies", []);
  assert.equal(s.swap.id, "one", "two-pack: 3 x $6 = $18 vs 5 x $3 = $15");
  const tie = item([sw("x", 292, 30, wp(111, 3, { special: true })), sw("y", 292, 30, wp(222, 3, { special: true }))]);
  assert.equal(S.suggest(row(5, 0, 23.25, null), tie, "woolies", []).swap.id, "x");
});

test("useSwap rewrites only the chosen store line", () => {
  const it = item([sw("a", 292, 30, wp(111, 3, { special: true }))]);
  const r = row(5, 0, 23.25, 23.25);
  const s = S.suggest(r, it, "woolies", []);
  const out = S.useSwap(r, "woolies", s, "bottles");
  assert.deepEqual([out.woolies.product.stockcode, out.woolies.quantity, out.woolies.cost, out.woolies.swap], [111, 5, 15, "a"]);
  assert.equal(out.woolies.buy, "5 bottles");
  assert.equal(out.woolies.saved, 8.25);
  assert.equal(out.coles, r.coles);
  assert.equal(r.woolies.product.stockcode, 72280, "input not mutated");
});

test("swapBuyText formats single-serve and multi-serve packs", () => {
  assert.equal(S.swapBuyText(5, 1, "bottles"), "5 bottles");
  assert.equal(S.swapBuyText(1, 1, "bottles"), "1 bottle");
  assert.equal(S.swapBuyText(3, 2, "bottles"), "3 × 2 bottles");
});

test("pack count uses ceil not round", () => {
  const it = item([sw("a", 292, 30, wp(111, 3, { special: true }))]);
  assert.equal(S.suggest({ id: "dare", need: 4.4, have: 0, woolies: null }, it, "woolies", []).quantity, 5);
  const two = item([sw("two", 292, 30, wp(111, 4, { special: true }), null, 2)]);
  assert.equal(S.suggest(row(5, 0, 23.25, null), two, "woolies", []).quantity, 3);
});

test("saving and dp rounding", () => {
  const it = item([sw("a", 292, 30.2, wp(111, 3.3, { special: true }))]);
  const s = S.suggest(row(5, 2, 13.95, null), it, "woolies", []);
  assert.equal(s.saving, 4.05);
  assert.equal(s.dp, 0.2);
});

test("keepBlocksStore honours per-store and legacy keep", () => {
  assert.equal(S.keepBlocksStore({ keep: true }, "woolies"), true);
  assert.equal(S.keepBlocksStore({ keep: { woolies: true } }, "coles"), false);
  assert.equal(S.keepBlocksStore({ keep: { coles: true } }, "coles"), true);
  assert.equal(S.keepBlocksStore({ use: "a" }, "woolies"), false);
});

test("hasAnyKeep detects legacy and per-store keep", () => {
  assert.equal(S.hasAnyKeep({ keep: true }), true);
  assert.equal(S.hasAnyKeep({ keep: { woolies: true } }), true);
  assert.equal(S.hasAnyKeep({ keep: {} }), false);
  assert.equal(S.hasAnyKeep({ use: "a" }), false);
});

test("applyChoices applies a still-qualifying choice and drops a stale one", () => {
  const it = item([sw("a", 292, 30, wp(111, 3, { special: true })), sw("b", 292, 30, wp(222, 3.1, { special: false }))]);
  const rows = [row(5, 0, 23.25, null), { id: "eggs", need: 12, woolies: { product: wp(9, 1), quantity: 1, cost: 1 } }];
  const r1 = S.applyChoices(rows, [it], "woolies", { dare: { use: "a", useStore: "woolies" } }, ["dare:a"]);
  assert.equal(r1.rows[0].woolies.swap, "a");
  assert.deepEqual(r1.used, { dare: "a" });
  assert.equal(r1.rows[1], rows[1]);
  const r2 = S.applyChoices(rows, [it], "woolies", { dare: { use: "b" } }, []);
  assert.equal(r2.rows[0], rows[0]);
  assert.deepEqual(r2.used, {});
  const r3 = S.applyChoices(rows, [it], "woolies", { dare: { keep: { woolies: true } } }, []);
  assert.equal(r3.rows[0], rows[0]);
  const r4 = S.applyChoices(rows, [it], "coles", { dare: { use: "a", useStore: "woolies" } }, []);
  assert.equal(r4.rows[0], rows[0], "use on woolies does not apply on coles");
});

test("applyChoices keeps a sent swap after the special ends", () => {
  const it = item([sw("a", 292, 30.2, wp(111, 3.3, { special: false }))]);
  const rows = [row(5, 2, 13.95, null)];
  const r = S.applyChoices(rows, [it], "woolies", { dare: { use: "a", useStore: "woolies" } }, [], ["111"]);
  assert.equal(r.rows[0].woolies.swap, "a");
  assert.equal(r.rows[0].woolies.quantity, 3);
  assert.equal(r.rows[0].woolies.cost, 9.9);
  assert.equal(r.rows[0].woolies.saved, null);
  assert.deepEqual(r.used, { dare: "a" });
});

test("applyChoices drops a stale choice when the swap was not sent", () => {
  const it = item([sw("a", 292, 30, wp(111, 3, { special: false }))]);
  const rows = [row(5, 0, 23.25, null)];
  const r = S.applyChoices(rows, [it], "woolies", { dare: { use: "a" } }, [], []);
  assert.equal(r.rows[0], rows[0]);
  assert.deepEqual(r.used, {});
});

test("applyChoices drops a sent swap that is unavailable", () => {
  const it = item([sw("a", 292, 30, wp(111, 3, { special: false, available: false }))]);
  const rows = [row(5, 0, 23.25, null)];
  const r = S.applyChoices(rows, [it], "woolies", { dare: { use: "a" } }, [], ["111"]);
  assert.equal(r.rows[0], rows[0]);
  assert.deepEqual(r.used, {});
});

test("suggest pack count tolerates floating have", () => {
  const it = item([sw("a", 292, 30, wp(111, 3, { special: true }))]);
  const s = S.suggest({ id: "dare", need: 5, have: 1.9999999999, woolies: null }, it, "woolies", []);
  assert.equal(s.quantity, 3);
});

test("suggest with no main line still offers a special", () => {
  const it = item([sw("a", 292, 30, wp(111, 3, { special: true }))]);
  const r = { id: "dare", need: 5, have: 0, woolies: null, coles: null };
  const s = S.suggest(r, it, "woolies", []);
  assert.equal(s.cost, 15);
  assert.equal(s.saving, null);
});

test("suggest serves two-pack only when it wins on cost", () => {
  const it = item([sw("two", 292, 30, wp(111, 4, { special: true }), null, 2)]);
  const s = S.suggest(row(5, 0, 23.25, null), it, "woolies", []);
  assert.deepEqual([s.swap.id, s.quantity, s.cost], ["two", 3, 12]);
});

test("suggest rejects equal-cost specials", () => {
  const it = item([sw("a", 292, 30, wp(111, 4.65, { special: true }))]);
  assert.equal(S.suggest(row(5, 0, 23.25, null), it, "woolies", []), null);
});

test("suggest returns null when item has no per", () => {
  const it = { id: "dare", swaps: [sw("a", 292, 30, wp(111, 3, { special: true }))] };
  assert.equal(S.suggest(row(5, 0, 23.25, null), it, "woolies", []), null);
});

test("applySwapPrices clears special when live says so and ignores bad was", () => {
  const items = [item([sw("a", 290, 30, wp(111, 4, { special: true }), cp(2222, 4))])];
  const out = S.applySwapPrices(items, { 111: { price: 3, was: 2, special: false, available: true } }, {}, colesId);
  assert.equal(out[0].swaps[0].woolies.special, false);
  assert.equal(out[0].swaps[0].woolies.was, null);
  assert.equal(out[0].swaps[0].woolies.price, 3);
  const noLive = S.applySwapPrices(items, { 111: { special: true } }, {}, colesId);
  assert.equal(noLive[0].swaps[0].woolies.price, 4);
  assert.equal(noLive[0].swaps[0].woolies.special, true);
});

test("a swapped row flows into the trolley, orders and stock-in", () => {
  const cart = require("../../main/assets/weekday_fuel/cart.js");
  const inv = require("../../main/assets/weekday_fuel/inventory.js");
  const it = item([sw("a", 292, 30, wp(111, 3, { special: true }), cp(2222, 3, { special: true }))]);
  const r = row(5, 0, 23.25, 23.25);
  const w = S.useSwap(r, "woolies", S.suggest(r, it, "woolies", []), "bottles");
  const c = S.useSwap(r, "coles", S.suggest(r, it, "coles", []), "bottles");
  const wl = cart.cartLines([w], {}, {});
  assert.equal(wl.lines[0].stockcode, 111);
  const cl = cart.colesCartLines([c], {}, {}, colesId);
  assert.equal(cl.lines[0].productId, "2222");
  const buys = inv.buysFromRows([w], "woolies", {}, {}, {});
  assert.deepEqual(buys, [{ item: "dare", amount: 5 }]);
});
