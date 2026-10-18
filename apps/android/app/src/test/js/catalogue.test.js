const { test } = require("node:test");
const assert = require("node:assert/strict");
const { create, deliGrams, applyLivePrices, applyColesPrices, colesId } = require("../../main/assets/weekday_fuel/catalogue.js");

const W = "https://www.woolworths.com.au/shop/productdetails/";
const C = "https://www.coles.com.au/product/";
const ITEMS = [
  { id: "dare", sec: 0, name: "Dare iced coffee", unit: "bottles", note: "", same: true,
    coles: { name: "Dare Double Espresso 500mL", url: C + "dare-8991361", size: 1, price: 5.5, checked: "2026-10-15" },
    woolies: { name: "Dare Double Espresso 500mL", url: W + "72280", stockcode: 72280, size: 1, price: 5, checked: "2026-10-15" } },
  { id: "breast", sec: 1, name: "Chicken breast", unit: "g", note: "", same: false,
    coles: { name: "Coles Chicken Breast Large", url: C + "breast-large-2263179", size: 1400, price: 16.8, checked: "2026-10-12",
      packs: [{ name: "Coles Chicken Breast Small", url: C + "breast-small-2263168", size: 600, price: 7.2, checked: "2026-10-12" }] },
    woolies: { name: "Woolworths Chicken Breast 1kg", url: W + "123456", stockcode: 123456, size: 1000, price: 13, checked: "2026-10-15" } },
  { id: "ham", sec: 1, name: "Shaved ham", unit: "g", note: "", same: false,
    coles: null,
    woolies: { name: "D'Orsogna Ham Shaved From The Deli", url: W + "175734", stockcode: 175734, perKg: true, size: 1, price: 28, checked: "2026-10-15" } },
  { id: "cheese", sec: 1, name: "Light tasty cheese", unit: "g", note: "", same: false,
    coles: { name: "Coles Light Tasty 500g", url: C + "cheese-8145346", size: 500, price: 7.5, checked: "2026-10-14" },
    woolies: { name: "Woolworths Light Tasty 500g", url: W + "729008", stockcode: 729008, size: 500, price: 9, checked: "2026-10-15" } },
  { id: "evap", sec: 2, name: "Evaporated milk", unit: "mL", note: "", same: false,
    coles: { name: "Carnation Light Evaporated Milk 375mL", url: C + "evap-1234567", size: 375, price: 2.5, checked: "2026-10-14" },
    woolies: null },
];
const AMOUNTS = {
  toasty: { ham: 100, cheese: 30 },
  eggmuffin: { ham: 50 },
  tenderwrap: { breast: 200, cheese: 30 },
  buffalomac: { breast: 180, cheese: 40, evap: 80 },
};
const cat = create(ITEMS, AMOUNTS);
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

test("deliGrams rounds up to the next 100 g, at least 100 g", () => {
  assert.equal(deliGrams(250), 300);
  assert.equal(deliGrams(60), 100);
  assert.equal(deliGrams(300), 300);
  assert.equal(deliGrams(0), 100);
});

test("shopList adds up each item's need across meals and serves, in catalogue order", () => {
  const rows = cat.shopList({ toasty: 2, tenderwrap: 2 }, 0);
  assert.deepEqual(rows.map((r) => [r.id, r.need]), [["breast", 400], ["ham", 200], ["cheese", 120]]);
  assert.deepEqual(byId(rows).cheese.used, ["toasty", "tenderwrap"]);
});

test("fixtures are one per day at each store", () => {
  const [dare] = cat.shopList({}, 5);
  assert.equal(dare.id, "dare");
  assert.deepEqual([dare.coles.quantity, dare.coles.cost, dare.coles.buy], [5, 27.5, "5 bottles"]);
  assert.equal(dare.woolies.cost, 25);
  assert.deepEqual(cat.shopList({}, 0), []);
  assert.equal(cat.shopList({}, 1)[0].coles.buy, "1 bottle");
  const pouch = create([{ ...ITEMS[0], id: "rice", unit: "pouches" }], { bowl: { rice: 1 } });
  assert.equal(pouch.shopList({ bowl: 1 }, 0)[0].woolies.buy, "1 pouch");
});

test("whole packs per store, from each store's own pack size", () => {
  const r = byId(cat.shopList({ buffalomac: 13 }, 0));
  assert.deepEqual([r.cheese.coles.quantity, r.cheese.coles.cost, r.cheese.coles.buy], [2, 15, "2 × 500g"]);
  assert.equal(r.cheese.woolies.cost, 18);
  assert.deepEqual([r.breast.coles.product.name, r.breast.coles.quantity, r.breast.coles.cost], ["Coles Chicken Breast Small", 4, 28.8]);
  assert.deepEqual([r.breast.woolies.quantity, r.breast.woolies.cost, r.breast.woolies.buy], [3, 39, "3 × 1000g"]);
  assert.deepEqual([r.evap.coles.quantity, r.evap.coles.buy], [3, "3 × 375mL"]);
  assert.equal(r.evap.woolies, null);
});

test("the cheapest chicken pack for the week wins on cost plus waste", () => {
  const small = byId(cat.shopList({ tenderwrap: 3 }, 0)).breast.coles;
  assert.deepEqual([small.product.name, small.quantity, small.cost, small.buy], ["Coles Chicken Breast Small", 1, 7.2, "1 × 600g"]);
  const twoSmall = byId(cat.shopList({ tenderwrap: 4 }, 0)).breast.coles;
  assert.deepEqual([twoSmall.product.name, twoSmall.quantity, twoSmall.cost], ["Coles Chicken Breast Small", 2, 14.4]);
  const slackCat = create(ITEMS, { m650: { breast: 650 }, m651: { breast: 651 } });
  const at650 = byId(slackCat.shopList({ m650: 1 }, 0)).breast.coles;
  assert.deepEqual([at650.product.name, at650.quantity, at650.cost, at650.buy], ["Coles Chicken Breast Small", 1, 7.2, "1 × 600g"]);
  const at651 = byId(slackCat.shopList({ m651: 1 }, 0)).breast.coles;
  assert.deepEqual([at651.product.name, at651.quantity, at651.cost], ["Coles Chicken Breast Small", 2, 14.4]);
});

test("a Woolworths tray is chosen when it beats fixed packs on cost plus waste", () => {
  const trayItems = [
    {
      id: "breast",
      sec: 1,
      name: "Chicken breast",
      unit: "g",
      note: "",
      same: false,
      coles: null,
      woolies: {
        name: "Woolworths Chicken Breast 650g",
        url: W + "6078624",
        stockcode: 6078624,
        size: 650,
        price: 9.4,
        checked: "2026-10-15",
        packs: [{ name: "Woolworths Breast tray", url: W + "969723", stockcode: 969723, size: 1500, sizeLabel: "1.5–2.2kg tray", price: 24.2, checked: "2026-10-18" }],
      },
    },
  ];
  const trayCat = create(trayItems, { big: { breast: 1400 }, mid: { breast: 1000 } });
  const tray = byId(trayCat.shopList({ big: 1 }, 0)).breast.woolies;
  assert.deepEqual([tray.product.name, tray.quantity, tray.cost, tray.buy], ["Woolworths Breast tray", 1, 24.2, "1 × 1.5–2.2kg tray"]);
  const packs = byId(trayCat.shopList({ mid: 1 }, 0)).breast.woolies;
  assert.deepEqual([packs.product.name, packs.quantity, packs.cost], ["Woolworths Chicken Breast 650g", 2, 18.8]);
});

test("pack choice uses cost plus waste, not cost alone", () => {
  const pin = create(
    [
      {
        id: "pin",
        sec: 1,
        name: "Pinned item",
        unit: "g",
        note: "",
        same: false,
        coles: {
          name: "Main 1kg",
          url: C + "main-1000001",
          size: 1000,
          price: 10,
          checked: "2026-10-15",
          packs: [{ name: "Alt 650g", url: C + "alt-1000002", size: 650, price: 12, checked: "2026-10-15" }],
        },
        woolies: null,
      },
    ],
    { one: { pin: 650 } },
  );
  const line = byId(pin.shopList({ one: 1 }, 0)).pin.coles;
  assert.equal(line.product.name, "Alt 650g");
  assert.equal(line.cost, 12);
  assert.ok(10 < 12, "cost alone would pick the 1kg main ($10 vs $12)");
});

test("identical cost plus waste ties go to the main product", () => {
  const tie = create(
    [
      {
        id: "tie",
        sec: 1,
        name: "Tie item",
        unit: "g",
        note: "",
        same: false,
        coles: {
          name: "Main twin",
          url: C + "main-2000001",
          size: 600,
          price: 6,
          checked: "2026-10-15",
          packs: [{ name: "Alt twin", url: C + "alt-2000002", size: 600, price: 6, checked: "2026-10-15" }],
        },
        woolies: null,
      },
    ],
    { one: { tie: 550 } },
  );
  const line = byId(tie.shopList({ one: 1 }, 0)).tie.coles;
  assert.equal(line.product.name, "Main twin");
});

test("deli ham is bought by weight, rounded up to 100 g", () => {
  const ham = byId(cat.shopList({ toasty: 2, eggmuffin: 1 }, 0)).ham;
  assert.equal(ham.need, 250);
  assert.deepEqual([ham.woolies.quantity, ham.woolies.cost, ham.woolies.buy], [0.3, 8.4, "300g from the deli"]);
  assert.equal(ham.coles, null);
  const two = byId(cat.shopList({ toasty: 2 }, 0)).ham.woolies;
  assert.deepEqual([two.quantity, two.cost, two.buy], [0.2, 5.6, "200g from the deli"]);
});

test("storeTotals counts each store's packs, leaves out ticked items from Left to buy, and lists missed items", () => {
  const rows = cat.shopList({ buffalomac: 1 }, 0);
  assert.deepEqual(cat.storeTotals(rows, "coles", {}), { total: 17.2, left: 17.2, missed: [] });
  assert.deepEqual(cat.storeTotals(rows, "woolies", {}), { total: 22, left: 22, missed: ["evap"] });
  assert.equal(cat.storeTotals(rows, "coles", { cheese: true }).left, 9.7);
  assert.equal(cat.storeTotals(rows, "woolies", { cheese: true }).left, 13);
});

test("mealCost prices a Standard serve at the chosen store, using the other store where it has nothing", () => {
  const cheapPack = create(
    [
      {
        ...ITEMS[1],
        coles: {
          ...ITEMS[1].coles,
          packs: [{ ...ITEMS[1].coles.packs[0], price: 7 }],
        },
      },
      ...ITEMS.slice(2),
    ],
    AMOUNTS,
  );
  assert.equal(cheapPack.mealCost("buffalomac", "coles"), 3.23);
  assert.equal(cat.mealCost("buffalomac", "coles"), 3.29);
  assert.equal(cat.mealCost("buffalomac", "woolies"), 3.59);
  assert.equal(cat.mealCost("toasty", "woolies"), 3.34);
  assert.equal(cat.mealCost("toasty", "coles"), 3.25);
  assert.equal(cat.mealCost("nope", "coles"), null);
});

test("usedIn, item and colesChecked", () => {
  assert.deepEqual(cat.usedIn("cheese"), ["toasty", "tenderwrap", "buffalomac"]);
  assert.deepEqual(cat.usedIn("ham"), ["toasty", "eggmuffin"]);
  assert.equal(cat.item("cheese").name, "Light tasty cheese");
  assert.equal(cat.colesChecked(), "2026-10-12");
});

test("live prices replace Woolworths prices without changing the catalogue", () => {
  const live = applyLivePrices(ITEMS, {
    729008: { price: 7.5, was: 9, special: true, available: true },
    175734: { price: 30, was: null, special: false, available: true },
    123456: { price: 13, was: 13, special: false, available: true },
  });
  const cheese = live.find((i) => i.id === "cheese");
  assert.deepEqual([cheese.woolies.price, cheese.woolies.was, cheese.woolies.live, cheese.woolies.name], [7.5, 9, true, "Woolworths Light Tasty 500g"]);
  assert.equal(cheese.coles, ITEMS[3].coles);
  assert.equal(ITEMS[3].woolies.price, 9);
  assert.equal(live.find((i) => i.id === "breast").woolies.was, null);
  assert.equal(live.find((i) => i.id === "dare"), ITEMS[0]);
  const c = create(live, AMOUNTS);
  assert.equal(byId(c.shopList({ toasty: 1 }, 0)).ham.woolies.cost, 3);
  assert.equal(c.mealCost("toasty", "woolies"), 3.45);
});

test("no live prices, or an unusable price, leaves items as they are", () => {
  assert.deepEqual(applyLivePrices(ITEMS, null), ITEMS);
  const live = applyLivePrices(ITEMS, { 729008: { price: null, was: null, special: false, available: true } });
  assert.equal(live.find((i) => i.id === "cheese"), ITEMS[3]);
});

test("a product unavailable online counts as missed at Woolworths", () => {
  const live = applyLivePrices(ITEMS, { 729008: { price: 9, was: null, special: false, available: false } });
  const cheese = live.find((i) => i.id === "cheese");
  assert.equal(cheese.woolies, null);
  assert.equal(cheese.wooliesUnavailable.stockcode, 729008);
  const c = create(live, AMOUNTS);
  const rows = c.shopList({ toasty: 1 }, 0);
  assert.equal(byId(rows).cheese.woolies, null);
  assert.equal(byId(rows).cheese.wooliesUnavailable.name, "Woolworths Light Tasty 500g");
  assert.equal(byId(rows).ham.wooliesUnavailable, null);
  assert.deepEqual(c.storeTotals(rows, "woolies", {}).missed, ["cheese"]);
  assert.equal(c.mealCost("toasty", "woolies"), 3.25);
});

test("checked gives each store's oldest price date", () => {
  assert.equal(cat.checked("coles"), "2026-10-12");
  assert.equal(cat.checked("woolies"), "2026-10-15");
});

test("planned days combine with picks and with each other before packs are rounded", () => {
  const rows = cat.shopList({ tenderwrap: 1 }, 0, [
    { day: "2026-10-20", meal: "buffalomac" },
    { day: "2026-10-19", meal: "toasty" },
    { day: "2026-10-20", meal: "toasty" },
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.need]), [["breast", 380], ["ham", 200], ["cheese", 130], ["evap", 80]]);
  const r = byId(rows);
  assert.equal(r.cheese.woolies.quantity, 1);
  assert.deepEqual(r.cheese.days, ["2026-10-19", "2026-10-20"]);
  assert.deepEqual(r.cheese.used, ["tenderwrap", "buffalomac", "toasty"]);
  assert.deepEqual([r.ham.days, r.ham.used, r.ham.woolies.quantity], [["2026-10-19", "2026-10-20"], ["toasty"], 0.2]);
  assert.deepEqual(r.breast.days, ["2026-10-20"]);
});

test("the same meal on two days is one meal in used and one pack when it fits", () => {
  const [ham, cheese] = cat.shopList({}, 0, [{ day: "2026-10-19", meal: "toasty" }, { day: "2026-10-20", meal: "toasty" }]);
  assert.deepEqual([cheese.id, cheese.need, cheese.woolies.quantity, cheese.used], ["cheese", 60, 1, ["toasty"]]);
  assert.deepEqual([ham.id, ham.days], ["ham", ["2026-10-19", "2026-10-20"]]);
});

test("no planned days leaves the list as it was, with empty days", () => {
  const before = cat.shopList({ toasty: 2, tenderwrap: 2 }, 3);
  assert.deepEqual(cat.shopList({ toasty: 2, tenderwrap: 2 }, 3, []), before);
  assert.ok(before.every((r) => Array.isArray(r.days) && r.days.length === 0));
  assert.deepEqual(byId(before).dare.used, []);
});

test("an unknown meal in a planned day adds nothing", () => {
  assert.deepEqual(cat.shopList({}, 0, [{ day: "2026-10-19", meal: "nope" }]), []);
});

test("colesId is the 4 to 7 digit number at the end of a Coles product URL", () => {
  assert.equal(colesId({ url: C + "dare-8991361" }), "8991361");
  assert.equal(colesId({ url: C + "abbott's-bakery-farmhouse-wholemeal-bread-750g-7226034" }), "7226034");
  assert.equal(colesId({ url: C + "dare" }), null);
  assert.equal(colesId({ url: C + "x-12" }), null);
  assert.equal(colesId({}), null);
  assert.equal(colesId(null), null);
});

test("live Coles prices replace catalogue prices, with was-prices for specials", () => {
  const live = applyColesPrices(ITEMS, {
    8145346: { price: 6, was: 7.5, special: true, available: true },
    8991361: { price: 5.5, was: 5.5, special: false, available: true },
  });
  const cheese = live.find((i) => i.id === "cheese");
  assert.deepEqual([cheese.coles.price, cheese.coles.was, cheese.coles.live, cheese.coles.name], [6, 7.5, true, "Coles Light Tasty 500g"]);
  assert.equal(cheese.woolies, ITEMS[3].woolies);
  assert.equal(ITEMS[3].coles.price, 7.5);
  assert.equal(live.find((i) => i.id === "dare").coles.was, null);
  assert.equal(live.find((i) => i.id === "evap"), ITEMS[4]);
  assert.equal(live.find((i) => i.id === "ham"), ITEMS[2]);
  assert.equal(byId(create(live, AMOUNTS).shopList({ toasty: 1 }, 0)).cheese.coles.cost, 6);
  assert.equal("packs" in cheese.coles, false);
});

test("live Woolworths prices never add a packs key to products that had none", () => {
  const live = applyLivePrices(ITEMS, { 729008: { price: 7.5, was: 9, special: true, available: true } });
  const cheese = live.find((i) => i.id === "cheese");
  assert.equal("packs" in cheese.woolies, false);
});

test("no Coles prices, a product left out, or no price keeps the catalogue item", () => {
  assert.equal(applyColesPrices(ITEMS, null), ITEMS);
  const empty = applyColesPrices(ITEMS, {});
  assert.notEqual(empty, ITEMS);
  assert.equal(empty.length, ITEMS.length);
  empty.forEach((it, i) => assert.equal(it, ITEMS[i]));
  const live = applyColesPrices(ITEMS, { 8145346: { price: null, was: null, special: false, available: true } });
  assert.equal(live.find((i) => i.id === "cheese"), ITEMS[3]);
  assert.equal(live.find((i) => i.id === "breast"), ITEMS[1]);
});

test("a Coles product unavailable online counts as missed at Coles", () => {
  const live = applyColesPrices(ITEMS, { 8145346: { price: 7.5, was: null, special: false, available: false } });
  const cheese = live.find((i) => i.id === "cheese");
  assert.equal(cheese.coles, null);
  assert.equal(cheese.colesUnavailable.name, "Coles Light Tasty 500g");
  const c = create(live, AMOUNTS);
  const rows = c.shopList({ toasty: 1 }, 0);
  assert.equal(byId(rows).cheese.coles, null);
  assert.equal(byId(rows).cheese.colesUnavailable.name, "Coles Light Tasty 500g");
  assert.equal(byId(rows).ham.colesUnavailable, null);
  assert.deepEqual(c.storeTotals(rows, "coles", {}).missed, ["ham", "cheese"]);
});

test("when both chicken packs are unavailable online the item is missed with the catalogue product kept", () => {
  const live = applyColesPrices(ITEMS, {
    2263179: { price: 16.8, was: null, special: false, available: false },
    2263168: { price: 7.2, was: null, special: false, available: false },
  });
  const breast = live.find((i) => i.id === "breast");
  assert.equal(breast.coles, null);
  assert.equal(breast.colesUnavailable, ITEMS[1].coles);
  const row = byId(create(live, AMOUNTS).shopList({ tenderwrap: 1 }, 0)).breast;
  assert.equal(row.coles, null);
  assert.equal(row.colesUnavailable, ITEMS[1].coles);
});

test("a live alternate pack price leaves the main pack at its catalogue price", () => {
  const live = applyColesPrices(ITEMS, { 2263168: { price: 5, was: 6, special: true, available: true } });
  const breast = live.find((i) => i.id === "breast");
  assert.equal(breast.coles.price, ITEMS[1].coles.price);
  assert.equal(breast.coles.live, undefined);
  assert.equal(breast.coles.packs[0].price, 5);
  assert.equal(breast.coles.packs[0].was, 6);
  assert.equal(breast.coles.packs[0].live, true);
});

test("applyColesPrices does not mutate frozen catalogue items", () => {
  const frozen = structuredClone(ITEMS);
  const snap = JSON.stringify(frozen);
  function freezeDeep(o) {
    if (o && typeof o === "object") {
      Object.freeze(o);
      for (const v of Object.values(o)) freezeDeep(v);
    }
  }
  frozen.forEach(freezeDeep);
  assert.doesNotThrow(() =>
    applyColesPrices(frozen, {
      2263179: { price: 16.8, was: null, special: false, available: false },
      8145346: { price: 6, was: null, special: false, available: false },
    }),
  );
  assert.equal(JSON.stringify(frozen), snap);
});

test("an unavailable main Coles pack falls back to the first alternate pack, and an unavailable alternate pack is dropped", () => {
  const large = applyColesPrices(ITEMS, { 2263179: { price: 16.8, was: null, special: false, available: false } });
  const b1 = large.find((i) => i.id === "breast");
  assert.equal(b1.coles.name, "Coles Chicken Breast Small");
  assert.equal(b1.coles.price, ITEMS[1].coles.packs[0].price);
  assert.equal(b1.coles.live, undefined);
  assert.equal(b1.coles.packs, undefined);
  assert.equal(b1.colesUnavailable, undefined);
  const row1 = byId(create(large, AMOUNTS).shopList({ tenderwrap: 4 }, 0)).breast;
  assert.deepEqual([row1.coles.product.name, row1.coles.quantity], ["Coles Chicken Breast Small", 2]);

  const alt = applyColesPrices(ITEMS, { 2263168: { price: 7.2, was: null, special: false, available: false } });
  const b2 = alt.find((i) => i.id === "breast");
  assert.equal(b2.coles.name, "Coles Chicken Breast Large");
  assert.equal(b2.coles.packs, undefined);
  assert.equal(ITEMS[1].coles.packs[0].name, "Coles Chicken Breast Small");
  assert.equal(byId(create(alt, AMOUNTS).shopList({ tenderwrap: 1 }, 0)).breast.coles.product.name, "Coles Chicken Breast Large");

  const both = applyColesPrices(ITEMS, {
    2263179: { price: 15, was: null, special: false, available: true },
    2263168: { price: 7, was: 8, special: true, available: true },
  });
  const b3 = both.find((i) => i.id === "breast");
  assert.deepEqual([b3.coles.price, b3.coles.live, b3.coles.packs[0].price, b3.coles.packs[0].was, b3.coles.packs[0].live], [15, true, 7, 8, true]);
});

test("when the main Coles pack is unavailable, the first alternate becomes main and the rest stay in packs", () => {
  const items = [
    {
      id: "tri",
      sec: 1,
      name: "Three packs",
      unit: "g",
      note: "",
      same: false,
      coles: {
        name: "Main pack",
        url: C + "main-3000001",
        size: 1000,
        price: 10,
        checked: "2026-10-15",
        packs: [
          { name: "First alt", url: C + "alt1-3000002", size: 500, price: 5, checked: "2026-10-15" },
          { name: "Second alt", url: C + "alt2-3000003", size: 400, price: 4, checked: "2026-10-15" },
        ],
      },
      woolies: null,
    },
  ];
  const live = applyColesPrices(items, { 3000001: { price: 10, was: null, special: false, available: false } });
  assert.equal(live[0].coles.name, "First alt");
  assert.equal(live[0].coles.packs.length, 1);
  assert.equal(live[0].coles.packs[0].name, "Second alt");
});

test("checked includes alternate pack dates", () => {
  const withTray = create(
    [
      {
        id: "breast",
        sec: 1,
        name: "Chicken breast",
        unit: "g",
        note: "",
        same: false,
        coles: { name: "Coles Breast", url: C + "breast-2263179", size: 1400, price: 16.8, checked: "2026-10-20", packs: [{ name: "Small", url: C + "breast-small-2263168", size: 600, price: 7.2, checked: "2026-10-12" }] },
        woolies: null,
      },
    ],
    {},
  );
  assert.equal(withTray.checked("coles"), "2026-10-12");
});

const WOOLIES_TRAY_ITEM = {
  id: "breast",
  sec: 1,
  name: "Chicken breast",
  unit: "g",
  note: "",
  same: false,
  coles: null,
  woolies: {
    name: "Woolworths Chicken Breast 650g",
    url: W + "6078624",
    stockcode: 6078624,
    size: 650,
    price: 9.4,
    checked: "2026-10-15",
    packs: [{ name: "Tray", url: W + "969723", stockcode: 969723, size: 1500, sizeLabel: "1.5–2.2kg tray", price: 24.2, checked: "2026-10-18" }],
  },
};

test("a Woolworths live main price leaves tray packs at their catalogue price", () => {
  const live = applyLivePrices([WOOLIES_TRAY_ITEM], { 6078624: { price: 8, was: 9.4, special: true, available: true } });
  assert.equal(live[0].woolies.price, 8);
  assert.equal(live[0].woolies.packs[0].price, 24.2);
  assert.equal(live[0].woolies.packs[0].live, undefined);
});

test("Woolworths tray availability from live data", () => {
  const items = [WOOLIES_TRAY_ITEM];
  const dropped = applyLivePrices(items, { 969723: { price: 11, was: null, special: false, available: false } });
  assert.equal(dropped[0].woolies.packs, undefined);
  assert.equal(dropped[0].woolies.stockcode, 6078624);

  const trayPrice = applyLivePrices(items, { 969723: { price: 99, was: 50, special: true, available: true } });
  assert.equal(trayPrice[0].woolies.packs[0].price, 24.2);
  assert.equal(trayPrice[0].woolies.packs[0].live, undefined);

  const promoted = applyLivePrices(items, {
    6078624: { price: 8, was: null, special: false, available: false },
    969723: { price: 99, was: null, special: false, available: true },
  });
  assert.equal(promoted[0].woolies.name, "Tray");
  assert.equal(promoted[0].woolies.stockcode, 969723);
  assert.equal(promoted[0].woolies.packs, undefined);
  assert.equal(promoted[0].wooliesUnavailable, undefined);
  const row = byId(create(promoted, { week: { breast: 1000 } }).shopList({ week: 1 }, 0)).breast;
  assert.deepEqual([row.woolies.product.name, row.woolies.quantity, row.woolies.buy], ["Tray", 1, "1 × 1.5–2.2kg tray"]);

  const bothOut = applyLivePrices(items, {
    6078624: { price: 9.4, was: null, special: false, available: false },
    969723: { price: 24.2, was: null, special: false, available: false },
  });
  assert.equal(bothOut[0].woolies, null);
  assert.equal(bothOut[0].wooliesUnavailable, items[0].woolies);
});

test("applyLivePrices does not mutate frozen Woolworths catalogue items", () => {
  const frozen = structuredClone([WOOLIES_TRAY_ITEM]);
  const snap = JSON.stringify(frozen);
  function freezeDeep(o) {
    if (o && typeof o === "object") {
      Object.freeze(o);
      for (const v of Object.values(o)) freezeDeep(v);
    }
  }
  frozen.forEach(freezeDeep);
  assert.doesNotThrow(() =>
    applyLivePrices(frozen, {
      6078624: { price: 8, was: null, special: false, available: false },
      969723: { price: 99, was: null, special: false, available: true },
    }),
  );
  assert.equal(JSON.stringify(frozen), snap);
});

const TIERED = create(ITEMS, { mac: { breast: 180, cheese: { L: 25, S: 40, X: 0 }, evap: { L: 0, S: 0, X: 80 } } });

test("amountFor reads a fixed amount or the portion's amount, Standard by default, 0 when unused", () => {
  assert.equal(TIERED.amountFor("mac", "breast", "L"), 180);
  assert.equal(TIERED.amountFor("mac", "cheese"), 40);
  assert.equal(TIERED.amountFor("mac", "cheese", "X"), 0);
  assert.equal(TIERED.amountFor("mac", "ham", "S"), 0);
  assert.equal(TIERED.amountFor("nope", "breast", "S"), 0);
});

test("planned meals are bought at their portion, picks at Standard, and unused items are left out", () => {
  const picked = byId(TIERED.shopList({ mac: 1 }, 0));
  assert.deepEqual(Object.keys(picked), ["breast", "cheese"]);
  assert.equal(picked.cheese.need, 40);
  const loaded = byId(TIERED.shopList({}, 0, [{ day: "2026-10-20", meal: "mac", t: "X" }]));
  assert.deepEqual(Object.keys(loaded), ["breast", "evap"]);
  assert.equal(loaded.evap.need, 80);
  const mixed = byId(TIERED.shopList({}, 0, [{ day: "2026-10-20", meal: "mac", t: "L" }, { day: "2026-10-21", meal: "mac" }]));
  assert.equal(mixed.cheese.need, 65);
  assert.deepEqual(mixed.cheese.days, ["2026-10-20", "2026-10-21"]);
  assert.equal(mixed.evap, undefined);
});

test("mealCost prices Standard and usedIn counts a meal when any portion uses the item", () => {
  assert.equal(TIERED.mealCost("mac", "coles"), 2.76);
  assert.deepEqual(TIERED.usedIn("evap"), ["mac"]);
  assert.deepEqual(TIERED.usedIn("ham"), []);
});
