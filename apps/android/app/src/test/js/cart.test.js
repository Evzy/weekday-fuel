const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cartLines, stockcodeOf } = require("../../main/assets/weekday_fuel/cart.js");

// Verbatim subset of LINKS in Weekday_Fuel.html.
const LINKS = {
  dare: [["Woolworths", "https://www.woolworths.com.au/shop/productdetails/72280"], ["Coles", "https://www.coles.com.au/product/dare-protein-no-sugar-added-iced-coffee-double-espresso-500ml-8991361"]],
  breast: [["Coles", "https://www.coles.com.au/product/coles-rspca-approved-chicken-breast-fillets-large-pack-approx.-1.4kg-2263179"]],
  ham: [["Woolworths", "https://www.woolworths.com.au/shop/productdetails/175734/d-orsogna-ham-leg-triple-smoked-97-fat-free-shaved"]],
  yog: [["Woolworths", "https://www.woolworths.com.au/shop/productdetails/717518/chobani-greek-yoghurt-natural-light-plain"]],
  pasta: [["Spaghetti", "https://www.woolworths.com.au/shop/productdetails/43974/san-remo-spaghetti-pasta-no-5"], ["Macaroni", "https://www.woolworths.com.au/shop/productdetails/44025"]],
  sauces1: [["Teriyaki", "https://www.woolworths.com.au/shop/productdetails/33948/kikkoman-marinade-teriyaki"], ["Oyster sauce", "https://www.woolworths.com.au/shop/productdetails/364439/lee-kum-kee-panda-sauce-oyster"]],
};

const row = (id, n, name, used = []) => ({ id, n, name, used });

test("stockcodeOf reads Woolworths product URLs with or without a slug", () => {
  assert.equal(stockcodeOf(LINKS.yog[0][1]), 717518);
  assert.equal(stockcodeOf(LINKS.pasta[1][1]), 44025);
  assert.equal(stockcodeOf(LINKS.breast[0][1]), null);
  assert.equal(stockcodeOf(undefined), null);
});

test("a packed item is sent with its pack count", () => {
  const { lines, manual } = cartLines([row("yog", 2, "Chobani Greek Yoghurt")], {}, LINKS);
  assert.deepEqual(lines, [{ itemId: "yog", stockcode: 717518, quantity: 2, name: "Chobani Greek Yoghurt", url: LINKS.yog[0][1] }]);
  assert.deepEqual(manual, []);
});

test("ticked items are left out entirely", () => {
  const { lines, manual } = cartLines([row("yog", 2, "Chobani"), row("breast", 1, "Chicken breast")], { yog: true, breast: true }, LINKS);
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, []);
});

test("Dare uses the Woolworths link with one per fixture day", () => {
  const { lines } = cartLines([row("dare", 5, "Dare")], {}, LINKS);
  assert.deepEqual(lines.map((l) => [l.stockcode, l.quantity]), [[72280, 5]]);
});

test("pasta sends only the packets the picked meals use", () => {
  const both = cartLines([row("pasta", 1, "Pasta", ["buffalomac", "bolognese"])], {}, LINKS).lines;
  assert.deepEqual(both.map((l) => [l.stockcode, l.quantity]), [[43974, 1], [44025, 1]]);
  const spaghetti = cartLines([row("pasta", 1, "Pasta", ["bolognese"])], {}, LINKS).lines;
  assert.deepEqual(spaghetti.map((l) => l.stockcode), [43974]);
  const macaroni = cartLines([row("pasta", 1, "Pasta", ["buffalomac", "toasty"])], {}, LINKS).lines;
  assert.deepEqual(macaroni.map((l) => l.stockcode), [44025]);
});

test("an item with two Woolworths links sends each product, named by its label", () => {
  const { lines } = cartLines([row("sauces1", 1, "Teriyaki + oyster sauce")], {}, LINKS);
  assert.deepEqual(
    lines.map((l) => [l.stockcode, l.quantity, l.name]),
    [[33948, 1, "Teriyaki + oyster sauce (Teriyaki)"], [364439, 1, "Teriyaki + oyster sauce (Oyster sauce)"]],
  );
});

test("deli ham, Coles-only and unlinked items go to the do-it-yourself list", () => {
  const { lines, manual } = cartLines(
    [row("ham", 1, "Shaved ham"), row("breast", 1, "Chicken breast"), row("evap", 1, "Evaporated milk")],
    {},
    LINKS,
  );
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [
    { itemId: "ham", name: "Shaved ham", reason: "deli" },
    { itemId: "breast", name: "Chicken breast", reason: "coles" },
    { itemId: "evap", name: "Evaporated milk", reason: "nostore" },
  ]);
});
