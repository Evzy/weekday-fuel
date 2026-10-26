# Meal rework proposal — 10-minute mains (2026-10-26)

Evan's decision (2026-10-26): every main is **≤10 min hands-on** (unattended microwave, air fryer, oven or simmer time is fine), and mains should preferably be **assembled from batch components**. Approved today: a new batch component *Sunday bolognese sauce*, fresh pasta (2–3 min cook) as a new catalogue item, and frozen crumbed chicken schnitzel in the air fryer with microwave potato mash for the schnitzel meal.

This proposal reworks five existing meals (ids unchanged): `teriyaki`, `redcurry`, `bolognese`, `buffalomac`, `schnitzel`. Nothing in the app has been changed; everything below is ready to apply.

All portion figures are computed as `AMOUNTS × MACROS` (`apps/android/app/src/main/assets/weekday_fuel/macros.js`), plus extras added by hand where marked. Costs use the catalogue's unit-price logic (`mealCost`: cheapest pack's price per unit, falling back to the other store), averaged over Coles and Woolworths. Extras that aren't bought in the shop are costed by hand.

---

## 1. Summary

| Meal | Prep, hands-on | L kcal / P | S kcal / P | X kcal / P | Cost L / S / X | Was (S) |
| --- | --- | --- | --- | --- | --- | --- |
| Teriyaki chicken rice bowl | assemble, 5 min | 480 / 52 | 678 / 56 | 882 / 58 | $5.20 / $6.52 / $7.55 | 740 kcal, 50 g P, 12 min, $7.20 |
| Thai red curry chicken | assemble, 6 min | 550 / 53 | 724 / 56 | 880 / 59 | $5.80 / $7.06 / $8.25 | 710 kcal, 52 g P, 12 min, $6.80 |
| Sunday bolognese with fresh fettuccine | assemble, 5 min | 567 / 56 | 709 / 64 | 892 / 72 | $7.15 / $8.01 / $8.95 | 715 kcal, 62 g P, 15 min, $6.70 |
| Buffalo chicken mac & cheese (fresh fettuccine) | quick, 8 min | 585 / 69 | 743 / 78 | 910 / 82 | $6.70 / $7.41 / $8.00 | 725 kcal, 72 g P, 15 min, $6.20 |
| Chicken schnitzel, mash & peas | cook, 6 min (about 20 min elapsed) | 418 / 43 | 517 / 47 | 659 / 47 | ~$5.50 / ~$5.85 / ~$6.25 (Woolworths fillet pack) | 710 kcal, 64 g P, 18 min, $4.45 |

`mins` in this proposal means **hands-on minutes**. That's a rule clarification, covered in section 9.

### New products

| Item | Woolworths | Coles | Label per 100 g |
| --- | --- | --- | --- |
| `freshpasta`: Latina Fresh Egg Fettuccine 375 g | [stockcode 22081](https://www.woolworths.com.au/shop/productdetails/22081/latina-fresh-egg-fettuccine-pasta), **$5.80 checked** 2026-10-26 (ShopHop daily tracker; product page confirmed) | [id 5051790](https://www.coles.com.au/product/latina-fresh-egg-fettuccine-pasta-375g-5051790), **$6.00 checked** 2026-10-26 via ShopHop (direct Coles fetch was blocked; Coles' page was indexed showing a $5.40 special) | Label is **per 100 g cooked**: 765 kJ (183 kcal), 7.3 g P, 30.6 g C, 2.8 g F, 2.1 g fibre. Converted **as sold**: 341 kcal, 13.6 g P, 57.1 g C, 5.2 g F, 3.9 g fibre (375 g pack → 700 g cooked, from the label's "350 g = ½ pack cooked") |
| `crumbfillet`: Woolworths Italian Style Crumb Chicken Fillets 350 g (2 × 175 g, frozen, 77% RSPCA breast) | [stockcode 130110](https://www.woolworths.com.au/shop/productdetails/130110/woolworths-italian-style-crumb-chicken-fillets), label **checked** 2026-10-26; **price $9.00 is an estimate** (not shown online without a store, and not in ShopHop or GroceryWise) | **None.** Coles has no lean equivalent (see section 7) | 583 kJ (139 kcal), 18.7 g P, 8.2 g C, 3.4 g F (per 175 g fillet: 244 kcal, 32.7 g P, 14.4 g C, 6 g F) — **label checked** |

No other new products are needed. The mash uses the existing `potato` item (washed potatoes, microwaved whole and mashed); section 7 compares it with ready-made mash.

---

## 2. Food decisions to record (rule table)

Add these rows to `.cursor/rules/meals.mdc` → *Food decisions*:

```markdown
| Sunday bolognese sauce (batch: beef mince, passata, frozen veg, garlic; portioned into tubs, fridge or freezer) | Yes (batch component) | 2026-10-26 |
| Fresh pasta (fresh egg fettuccine, 2–3 min cook) | Yes (carbs) | 2026-10-26 |
| Frozen crumbed chicken schnitzel / crumbed breast fillets, cooked in the air fryer | Yes (proteins) | 2026-10-26 |
| Microwave potato mash | Yes (carbs) | 2026-10-26 |
```

The 10-minute hands-on policy isn't a food, so it goes in the rule text instead (section 9).

---

## 3. New batch: Sunday bolognese sauce

Each portion is one tub of sauce. Like Sunday chicken, the batch's `item` is the raw meat (`mince`), and `ratio` turns raw grams into cooked grams for the recipe line (200 g raw → 150 g cooked mince per tub, at 0.75). The passata, veg and garlic stay as separate `AMOUNTS` rows so the shop still buys them.

```js
{
  id: "bolo", name: "Sunday bolognese sauce", item: "mince", ratio: 0.75, as: "cooked mince, in one tub of Sunday bolognese sauce",
  makes: "5 tubs of about 450g from 1kg mince, two 700g jars of passata, 500g frozen carrots, peas & corn and 25g garlic paste",
  keeps: "3 days in the fridge or 3 months in the freezer. Thaw a tub overnight in the fridge, or microwave it from frozen",
  steps: [
    "Heat your biggest pot or a deep frying pan on high. Brown all the mince you bought for bolognese (1kg makes 5 tubs) for 8–10 min, breaking it up.",
    "Stir in the garlic paste (5g per tub) and 1 tbsp dried Italian herbs for 1 min.",
    "Add the frozen carrots, peas & corn (100g per tub) and the passata (280g per tub; swirl a splash of water round the jars). Bring to a simmer.",
    "Simmer with the lid ajar on low for 20 min, stirring now and then. Season with salt and pepper.",
    "Cool for 20 min, then split into tubs of about 450g. Fridge the next 2 days' tubs and freeze the rest.",
  ],
}
```

- **Ratio and servings:** 1 kg raw extra-lean mince → about 750 g cooked (ratio 0.75, the same as Sunday chicken; extra-lean mince loses mostly water). Per tub: 200 g raw mince (150 g cooked) + 280 g passata + 100 g frozen veg + 5 g garlic paste ≈ 535 g, reducing to about 450 g after the simmer.
- **Per tub (sauce only):** 396.5 kcal, 49.4 g P, 23 g C, 10.2 g F; about $6.25 (Coles $6.60, Woolworths $5.95).
- **Hands-on time:** about 15 min on Sunday, plus a 20-minute unattended simmer.
- **Why 280 g passata per tub:** five tubs use exactly two 700 g jars, so there's no half-used jar. The current recipe uses 200 g.
- The meal uses `batch: ["bolo"]` and keeps buying `mince`, which passes the batch test. I used the id `bolo` rather than `bolognese` so it isn't confused with the meal id.

### How batch portions map to raw items in `AMOUNTS`

| Batch | Recipe reads | `AMOUNTS` row (raw) | Ratio |
| --- | --- | --- | --- |
| Sunday chicken | "150g Sunday chicken, cooked" | `breast: 200` | 0.75 |
| Sunday bolognese sauce | "150g cooked mince, in one tub of Sunday bolognese sauce" | `mince: 200`, plus `passata: 280`, `fzmix: 100`, `garlic: 5` | 0.75 (mince only) |

**Display gap (needs Evan's call):** `recipeLines` in `Weekday_Fuel.html` only folds the batch's single `item` into the batch line. In the bolognese recipe, passata, frozen veg and garlic would still appear as their own ingredient lines, which reads as if you add them again. Options:
- **(a)** Accept it, and say so in the meal's `note` (wording is in section 4).
- **(b)** Make a small app change: an optional `with: ["passata", "fzmix", "garlic"]` on the batch, which `recipeLines` skips for meals using that batch. The shop would still buy them. **Recommended**, but it's an app-code change, so it needs approval.

---

## 4. Meals

Shared notes:
- Every chicken meal now uses one standard Sunday chicken tub: 150 g cooked = 200 g raw `breast`.
- Breast MACROS: 110 kcal, 23 g P, 0 g C, 1.6 g F per 100 g raw.
- In every table, "Fixed" rows are the protein core and are the same at every portion.

### 4.1 Teriyaki chicken rice bowl (`teriyaki`)

- **Cuisine** Japanese · **prep** `assemble` · **mins** 5 · `batch: ["chicken"]`
- **Core:** 150 g cooked chicken breast (Sunday batch), replacing 200 g raw thigh. Protein core 46 g (was about 40 g from thigh).
- **Ingredients:** Sunday chicken (`breast` 200 raw), `teriyaki_sauce` 50, `fzasian` 150, `rice` L ⅓ / S ¾ / X 1. Extras: sesame seeds (S, X), Kewpie (X).

| Item (per 100 g/mL) | Amount | kcal | P | C | F |
| --- | --- | --- | --- | --- | --- |
| Fixed: breast (110/23/0/1.6) | 200 g raw | 220 | 46 | 0 | 3.2 |
| Fixed: teriyaki_sauce (150/1/30/0.5) | 50 mL | 75 | 0.5 | 15 | 0.25 |
| Fixed: fzasian (35/2/5/0.3) | 150 g | 52.5 | 3 | 7.5 | 0.45 |
| **Fixed subtotal** | | **347.5** | **49.5** | **22.5** | **3.9** |
| L: rice ⅓ pouch (167/3/35/1.5) | 83 g | 139.2 | 2.5 | 29.2 | 1.25 |
| S: rice ¾ pouch | 187.5 g | 313.1 | 5.6 | 65.6 | 2.8 |
| S, X: sesame seeds, 1 tsp (by hand) | ~3 g | 17 | 0.5 | 0.3 | 1.5 |
| X: rice 1 pouch | 250 g | 417.5 | 7.5 | 87.5 | 3.75 |
| X: Kewpie, 1 tbsp (by hand) | ~15 g | 100 | 0.3 | 0.4 | 11 |
| **L total** | | 486.7 | 52.0 | 51.7 | 5.2 |
| **S total** | | 677.6 | 55.6 | 88.4 | 8.2 |
| **X total** | | 882.0 | 57.8 | 110.7 | 20.2 |

| Portion | k | p | c | f | cost | what | 4P+4C+9F |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L | **480** | 52 | 52 | 5 | 5.20 | "⅓ rice pouch, microwave veg" | 461 (+4.1%) |
| S | 678 | 56 | 88 | 8 | 6.52 | "¾ pouch + sesame seeds" | 648 (+4.6%) |
| X | 882 | 58 | 111 | 20 | 7.55 | "Whole pouch + Kewpie drizzle" | 856 (+3.0%) |

**L kcal:** the ingredient sum is 487, which is 5.6% above 4P+4C+9F and would fail the CI check. The cause is `teriyaki_sauce` MACROS (150 kcal, but 1/30/0.5 g only accounts for 128.5 kcal). I trimmed L to 480 so it passes.

The Woolworths Kikkoman Marinade label (stockcode 33948, checked 2026-10-26) is actually 377 kJ (90 kcal), 5.8 g P, 12.2 g C, 0 g F per 100 mL; it contains 3.9% alcohol, which explains the kcal gap. Coles stocks Kikkoman Thick Teriyaki, a different sauce. Consider giving the item real per-store label values in a later pass.

```js
{
  id: "teriyaki", name: "Teriyaki chicken rice bowl", slots: ["main"], cuisine: "Japanese", mins: 5, prep: "assemble", batch: ["chicken"],
  core: "150g cooked chicken breast (Sunday batch)",
  t: {
    L: { k: 480, p: 52, c: 52, f: 5, cost: 5.2, what: "⅓ rice pouch, microwave veg" },
    S: { k: 678, p: 56, c: 88, f: 8, cost: 6.52, what: "¾ pouch + sesame seeds" },
    X: { k: 882, p: 58, c: 111, f: 20, cost: 7.55, what: "Whole pouch + Kewpie drizzle" },
  },
  extras: [{ tiers: "SX", text: "1 tsp sesame seeds" }, { tiers: "X", text: "1 tbsp Kewpie mayo" }, RICE_REST],
  steps: [
    "Tip the frozen stir-fry veg into a microwave-safe bowl. Cover and microwave on high for 3 min.",
    "Slice a portion of Sunday chicken and add it to the veg with the teriyaki. Stir, cover and microwave for 90 sec until hot and glossy.",
    "Microwave the rice pouch for 90 sec.",
    "Serve the chicken and veg over the rice, topped with sesame seeds and Kewpie if your portion has them.",
  ],
}
```

`AMOUNTS.teriyaki = { breast: 200, teriyaki_sauce: 50, fzasian: 150, rice: { L: 1 / 3, S: 0.75, X: 1 } }`

- **Ingredient reuse:** no new products. Protein: Sunday chicken (shared with tenderwrap, burritobowl, friedrice, redcurry, buffalomac). Carb: rice pouch (burritobowl, koreanbeef, redcurry, friedrice). Veg: `fzasian` (redcurry).
- **Removals:** `thigh` becomes unused and has to be removed (section 8).
- **Guideline misses:** X costs $7.55 (over $7). Fat drops from 15–30 g to 5–20 g, so the bowl is leaner than the thigh version.

### 4.2 Thai red curry chicken (`redcurry`)

- **Cuisine** Thai · **prep** `assemble` · **mins** 6 · `batch: ["chicken"]`
- **Core:** 150 g cooked chicken breast (Sunday batch), replacing 180 g raw breast fried in the pan. Protein core 46 g (was 41 g).
- **Ingredients:** Sunday chicken (`breast` 200), `curry` 15, `coco` L 70 / S 70 / X 100, `fzasian` 150, `rice` L ⅓ / S ¾ / X 1. No new products; the existing paste and coconut milk are made into the sauce in the microwave. A jar of simmer sauce would be another new product and isn't needed.

| Item (per 100 g/mL) | Amount | kcal | P | C | F |
| --- | --- | --- | --- | --- | --- |
| Fixed: breast | 200 g raw | 220 | 46 | 0 | 3.2 |
| Fixed: curry paste (120/2/10/7) | 15 g | 18 | 0.3 | 1.5 | 1.05 |
| Fixed: fzasian | 150 g | 52.5 | 3 | 7.5 | 0.45 |
| **Fixed subtotal** | | **290.5** | **49.3** | **9.0** | **4.7** |
| L, S: coco (172/1.9/3.1/16.7) | 70 mL | 120.4 | 1.33 | 2.17 | 11.69 |
| X: coco | 100 mL | 172 | 1.9 | 3.1 | 16.7 |
| L: rice ⅓ / S: ¾ / X: 1 pouch | | 139.2 / 313.1 / 417.5 | 2.5 / 5.6 / 7.5 | 29.2 / 65.6 / 87.5 | 1.25 / 2.8 / 3.75 |
| **L total** | | 550.1 | 53.1 | 40.3 | 17.6 |
| **S total** | | 724.0 | 56.3 | 76.8 | 19.2 |
| **X total** | | 880.0 | 58.7 | 99.6 | 25.2 |

| Portion | k | p | c | f | cost | what | 4P+4C+9F |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L | 550 | 53 | 40 | 18 | 5.8 | "⅓ rice pouch" | 534 (+3.0%) |
| S | 724 | 56 | 77 | 19 | 7.06 | "¾ rice pouch" | 703 (+3.0%) |
| X | 880 | 59 | 100 | 25 | 8.25 | "Whole pouch, extra coconut milk" | 861 (+2.2%) |

```js
{
  id: "redcurry", name: "Thai red curry chicken", slots: ["main"], cuisine: "Thai", mins: 6, prep: "assemble", batch: ["chicken"],
  core: "150g cooked chicken breast (Sunday batch)",
  t: {
    L: { k: 550, p: 53, c: 40, f: 18, cost: 5.8, what: "⅓ rice pouch" },
    S: { k: 724, p: 56, c: 77, f: 19, cost: 7.06, what: "¾ rice pouch" },
    X: { k: 880, p: 59, c: 100, f: 25, cost: 8.25, what: "Whole pouch, extra coconut milk" },
  },
  extras: ["Water, the same amount as the coconut milk", "Splash of fish sauce (optional)", RICE_REST],
  steps: [
    "In a large microwave-safe bowl, stir the curry paste into the coconut milk and the same amount of water until smooth.",
    "Add the frozen veg. Cover loosely and microwave on high for 4 min, stirring halfway.",
    "Stir in a portion of Sunday chicken, sliced, and microwave for 2 min more until piping hot.",
    "Microwave the rice pouch for 90 sec. Add a splash of fish sauce to the curry and serve it over the rice.",
  ],
  note: "Ayam Light is still fairly rich (about 170 kcal per 100mL), so it's stretched with water. Freeze the rest of the can in an ice-cube tray.",
}
```

`AMOUNTS.redcurry = { breast: 200, curry: 15, coco: { L: 70, S: 70, X: 100 }, fzasian: 150, rice: { L: 1 / 3, S: 0.75, X: 1 } }`

- **Ingredient reuse:** no new products. Shares Sunday chicken, rice and `fzasian` with teriyaki, so the two can run back to back.
- **Guideline misses:** S $7.06 and X $8.25 are over $7. That's 26 cents more than now, from the full 200 g raw chicken tub instead of 180 g.

### 4.3 Sunday bolognese with fresh fettuccine (`bolognese`)

- **Cuisine** Italian · **prep** `assemble` · **mins** 5 (about 10 elapsed including the kettle) · `batch: ["bolo"]`
- **Name:** proposed rename from "15-minute bolognese" to "Sunday bolognese with fresh fettuccine" (the id stays).
- **Core:** one tub of Sunday bolognese sauce (200 g raw mince, 150 g cooked). Protein core 49.4 g with the sauce (was 47.2 g; the extra is from more passata).
- **Ingredients:** sauce tub (`mince` 200, `passata` 280, `fzmix` 100, `garlic` 5), `freshpasta` L 50 / S 80 / X 110, `parm` L 0 / S 10 / X 20, olive oil (X). The fresh-pasta amounts match the energy of the old dry-spaghetti portions (40/85/110 g dry ≈ 42/89/114 g fresh), rounded to fit the kcal bands.

| Item (per 100 g) | Amount | kcal | P | C | F |
| --- | --- | --- | --- | --- | --- |
| Fixed: mince (125/21/0/4.5) | 200 g raw | 250 | 42 | 0 | 9 |
| Fixed: passata (30/1.5/5/0.2) | 280 g | 84 | 4.2 | 14 | 0.56 |
| Fixed: fzmix (55/3/8/0.4) | 100 g | 55 | 3 | 8 | 0.4 |
| Fixed: garlic (150/4/20/5) | 5 g | 7.5 | 0.2 | 1 | 0.25 |
| **Fixed subtotal (one sauce tub)** | | **396.5** | **49.4** | **23.0** | **10.2** |
| L: freshpasta (341/13.6/57.1/5.2) | 50 g | 170.5 | 6.8 | 28.6 | 2.6 |
| S: freshpasta | 80 g | 272.8 | 10.9 | 45.7 | 4.2 |
| S: parm (400/36/0/28) | 10 g | 40 | 3.6 | 0 | 2.8 |
| X: freshpasta | 110 g | 375.1 | 15.0 | 62.8 | 5.7 |
| X: parm | 20 g | 80 | 7.2 | 0 | 5.6 |
| X: olive oil, 1 tsp (by hand) | ~4.5 g | 40 | 0 | 0 | 4.5 |
| **L total** | | 567.0 | 56.2 | 51.6 | 12.8 |
| **S total** | | 709.3 | 63.9 | 68.7 | 17.2 |
| **X total** | | 891.6 | 71.6 | 85.8 | 26.0 |

| Portion | k | p | c | f | cost | what | 4P+4C+9F |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L | 567 | 56 | 52 | 13 | 7.15 | "Small serve of fettuccine, no parmesan" | 549 (+3.3%) |
| S | 709 | 64 | 69 | 17 | 8.01 | "Fettuccine + 10g parmesan" | 685 (+3.5%) |
| X | 892 | 72 | 86 | 26 | 8.95 | "Big serve, 20g parmesan, olive oil" | 866 (+3.0%) |

```js
{
  id: "bolognese", name: "Sunday bolognese with fresh fettuccine", slots: ["main"], cuisine: "Italian", mins: 5, prep: "assemble", batch: ["bolo"],
  core: "1 tub Sunday bolognese sauce (200g raw lean beef mince)",
  t: {
    L: { k: 567, p: 56, c: 52, f: 13, cost: 7.15, what: "Small serve of fettuccine, no parmesan" },
    S: { k: 709, p: 64, c: 69, f: 17, cost: 8.01, what: "Fettuccine + 10g parmesan" },
    X: { k: 892, p: 72, c: 86, f: 26, cost: 8.95, what: "Big serve, 20g parmesan, olive oil" },
  },
  extras: ["Salt for the pasta water", { tiers: "X", text: "1 tsp olive oil" }],
  steps: [
    "Boil the kettle, pour it into a saucepan with a pinch of salt and bring it back to the boil on high.",
    "Meanwhile microwave a tub of Sunday bolognese sauce, covered, for 3–4 min from the fridge (6–8 min from frozen), stirring halfway.",
    "Drop the fettuccine into the boiling water, loosen it with tongs and cook for 2 min. Drain, keeping a splash of the water.",
    "Toss the pasta through the sauce with the splash of water (and the olive oil on Loaded). Finish with the parmesan if your portion has it.",
  ],
  note: "The passata, veg and garlic in the list are already in the sauce tub. Bag up the rest of the fettuccine pack in single portions and freeze it; it cooks from frozen in 3 min.",
}
```

`AMOUNTS.bolognese = { mince: 200, passata: 280, fzmix: 100, garlic: 5, freshpasta: { L: 50, S: 80, X: 110 }, parm: { L: 0, S: 10, X: 20 } }`

- **Ingredient reuse:** new `freshpasta`, shared with buffalomac. Mince and garlic are shared with koreanbeef.
- **Removals:** `spaghetti` becomes unused and has to be removed.
- **Guideline misses:**
  - Cost: L $7.15, S $8.01 and X $8.95 are all over $7. Mince is $3.92 of each serve; fresh pasta costs $1.24 at S against $0.39 for dry spaghetti; the extra passata adds about $0.30. Switching to 4-star mince saves roughly $1 a serve and adds about 60 kcal, as the koreanbeef note already says.
  - Protein: X 72 g is over the 65 g maximum.
  - Perishable: an opened 375 g fettuccine pack lasts 3 days, so freeze the rest on opening day (see the note).
- **Batch shopping:** the shop buys raw mince for the bolognese meals Evan *plans*. The batch is written as "cook all the mince you bought (1 kg = 5 tubs)", so planning 2 bolognese buys a 500 g pack, which makes about 2.5 tubs. Tubs that come from the freezer in later weeks are already covered by the app's "have" inventory.

### 4.4 Buffalo chicken mac & cheese (`buffalomac`)

- **Cuisine** American · **prep** `quick` (one pot) · **mins** 8 · `batch: ["chicken"]` · remake "YES-style buffalo chicken mac" (unchanged)
- **Name:** the shape is now fettuccine. Either keep the name (it's a ready-meal remake) or rename it to "Buffalo chicken cheesy fettuccine". **Evan's call.**
- **Core:** 150 g cooked chicken breast (Sunday batch), replacing 180 g raw breast pan-fried. Protein core 46 g (was 41 g). Using 120 g cooked (160 g raw, like friedrice) would bring it back to 37 g if Evan prefers.
- **Ingredients:** Sunday chicken (`breast` 200), `freshpasta` L 50 / S 80 / X 110, `evap` 80, `cheese` L 25 / S 40 / X 0, `franks` 50, `fzbroc` 100. X uses 50 g full-fat tasty, bought separately.

| Item (per 100 g/mL) | Amount | kcal | P | C | F |
| --- | --- | --- | --- | --- | --- |
| Fixed: breast | 200 g raw | 220 | 46 | 0 | 3.2 |
| Fixed: evap (100/7.5/13.5/1.5) | 80 mL | 80 | 6 | 10.8 | 1.2 |
| Fixed: franks (10/0/1/0) | 50 mL | 5 | 0 | 0.5 | 0 |
| Fixed: fzbroc (30/3/2.5/0.4) | 100 g | 30 | 3 | 2.5 | 0.4 |
| **Fixed subtotal** | | **335** | **55.0** | **13.8** | **4.8** |
| L: freshpasta | 50 g | 170.5 | 6.8 | 28.6 | 2.6 |
| L: light cheese (337/29.7/0.5/24.2) | 25 g | 84.3 | 7.4 | 0.1 | 6.1 |
| S: freshpasta | 80 g | 272.8 | 10.9 | 45.7 | 4.2 |
| S: light cheese | 40 g | 134.8 | 11.9 | 0.2 | 9.7 |
| X: freshpasta | 110 g | 375.1 | 15.0 | 62.8 | 5.7 |
| X: full-fat tasty, 50 g (by hand, typical 400/25/0/33) | 50 g | 200 | 12.5 | 0 | 16.5 |
| **L total** | | 589.8 | 69.2 | 42.5 | 13.5 |
| **S total** | | 742.6 | 77.8 | 59.7 | 18.6 |
| **X total** | | 910.1 | 82.5 | 76.6 | 27.0 |

| Portion | k | p | c | f | cost | what | 4P+4C+9F |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L | **585** | 69 | 42 | 13 | 6.7 | "Small serve of fettuccine, 25g light cheese" | 561 (+4.3%) |
| S | 743 | 78 | 60 | 19 | 7.41 | "Fettuccine, 40g light cheese" | 723 (+2.8%) |
| X | 910 | 82 | 77 | 27 | 8.0 | "Big serve, 50g full-fat tasty" | 879 (+3.5%) |

**L kcal:** the ingredient sum is 590, but after rounding the macros that is 5.2% above the check. I set 585.

```js
{
  id: "buffalomac", name: "Buffalo chicken mac & cheese", slots: ["main"], cuisine: "American", mins: 8, prep: "quick", batch: ["chicken"], remake: "YES-style buffalo chicken mac",
  core: "150g cooked chicken breast (Sunday batch)",
  t: {
    L: { k: 585, p: 69, c: 42, f: 13, cost: 6.7, what: "Small serve of fettuccine, 25g light cheese" },
    S: { k: 743, p: 78, c: 60, f: 19, cost: 7.41, what: "Fettuccine, 40g light cheese" },
    X: { k: 910, p: 82, c: 77, f: 27, cost: 8.0, what: "Big serve, 50g full-fat tasty" },
  },
  extras: ["Salt for the pasta water", "½ tsp garlic powder", "½ tsp paprika", { tiers: "X", text: "50g full-fat tasty cheese, grated, instead of the light cheese (buy separately)" }],
  steps: [
    "Boil the kettle, pour it into a saucepan with a pinch of salt and bring it back to the boil on high. Microwave the broccoli, covered, for 3 min.",
    "Tear a portion of Sunday chicken into bite-size pieces and toss it with most of the Frank's, the garlic powder and the paprika.",
    "Cook the fettuccine for 2 min, then drain it and return it to the pot on low.",
    "Add the evaporated milk and the cheese and stir for 1 min until glossy. Fold through the chicken and broccoli for 1 min until hot, then finish with the rest of the Frank's.",
  ],
  note: "Evaporated milk is the trick. It makes a creamy sauce that won't split. The rest of the can goes in the schnitzel mash within a few days.",
}
```

`AMOUNTS.buffalomac = { breast: 200, freshpasta: { L: 50, S: 80, X: 110 }, evap: 80, cheese: { L: 25, S: 40, X: 0 }, franks: 50, fzbroc: 100 }`

- **Ingredient reuse:** `freshpasta` (shared with bolognese), `evap` (now also used by schnitzel, so the 340 mL can gets used up), `fzbroc` (koreanbeef) and Sunday chicken.
- **Removals:** `macaroni` becomes unused and has to be removed.
- **Guideline misses:**
  - Protein: 69 / 78 / 82 g are all over the 65 g maximum. The current recipe is already over at S and X (72 / 75).
  - Cost: S $7.41 and X $8.00 are over $7.
  - Perishable: the opened fettuccine pack, as for bolognese.
- **Test impact:** `meal-rules.test.js` has *"a planned Loaded buffalo mac buys 100g macaroni and a Build a shop pick buys 75g"*. Rewrite it for `freshpasta`: Loaded buys 110, a Build a shop pick buys 80.

### 4.5 Chicken schnitzel, mash & peas (`schnitzel`)

- **Cuisine** Pub classic · **prep** `cook` (about 20 min elapsed, air fryer unattended) · **mins** 6 · remake "YES-style chicken schnitzel" (unchanged)
- **Core (Evan 2026-10-26):** **1** Woolworths Italian Style Crumb Chicken Fillet (175 g, frozen). ~33 g protein from the fillet; **100 g** peas keeps Standard at **47 g** (CI hard minimum 45 g for mains).
- **Ingredients:** `crumbfillet` 1, `potato` L 100 / S 200 / X 300, `evap` 30, `fzpeas` 100, `gravy` L 0 / S 10 / X 10. X adds 10 g butter (extra).

| Item (per 100 g/mL) | Amount | kcal | P | C | F |
| --- | --- | --- | --- | --- | --- |
| Fixed: crumbfillet (139/18.7/8.2/3.4) | 1 fillet = 175 g | 243.3 | 32.7 | 14.4 | 6.0 |
| Fixed: evap | 30 mL | 30 | 2.3 | 4.1 | 0.5 |
| Fixed: fzpeas (75/5.5/9/0.5) | 100 g | 75 | 5.5 | 9.0 | 0.5 |
| **Fixed subtotal** | | **348.3** | **40.5** | **27.5** | **7.0** |
| L: potato (70/2/14/0.1) | 100 g | 70 | 2.0 | 14.0 | 0.1 |
| S: potato | 200 g | 140 | 4.0 | 28.0 | 0.2 |
| S, X: gravy powder (285/8.3/58/1.7) | 10 g | 28.5 | 0.8 | 5.8 | 0.2 |
| X: potato | 300 g | 210 | 6.0 | 42.0 | 0.3 |
| X: butter, 10 g (by hand) | 10 g | 72 | 0.1 | 0 | 8.1 |
| **L total** | | **418.3** | **42.5** | **41.5** | **7.1** |
| **S total** | | **516.8** | **47.3** | **71.3** | **7.4** |
| **X total** | | **658.8** | **47.4** | **75.3** | **15.6** |

| Portion | k | p | c | f | cost | what | 4P+4C+9F |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L | 418 | 43 | 41 | 7 | ~5.5 | "Small mash, no gravy" | 399 (+4.8%) |
| S | 517 | 47 | 71 | 7 | ~5.85 | "Mash + gravy" | 535 (−3.4%) |
| X | 659 | 47 | 75 | 16 | ~6.25 | "Big buttery mash + gravy" | 632 (+4.3%) |

```js
{
  id: "schnitzel", name: "Chicken schnitzel, mash & peas", slots: ["main"], cuisine: "Pub classic", mins: 6, prep: "cook", remake: "YES-style chicken schnitzel",
  core: "1 frozen crumbed chicken breast fillet (175g)",
  t: {
    L: { k: 418, p: 43, c: 41, f: 7, cost: 5.5, what: "Small mash, no gravy" },
    S: { k: 517, p: 47, c: 71, f: 7, cost: 5.85, what: "Mash + gravy" },
    X: { k: 659, p: 47, c: 75, f: 16, cost: 6.25, what: "Big buttery mash + gravy" },
  },
  extras: ["Oil spray", "Salt and pepper", { tiers: "X", text: "10g butter for the mash (buy separately)" }],
  steps: [
    "Heat the air fryer to 180 °C. Spray the frozen fillet with oil and air-fry it for 18–20 min, turning halfway, until golden and piping hot in the middle (check the pack directions).",
    "Meanwhile prick the potato all over and microwave it on high until soft: about 3 min on Light, 6–8 min on Standard and Loaded.",
    "Mash the potato with a fork, the evaporated milk, salt and pepper (and the butter on Loaded).",
    "Microwave the peas, covered, for 2–3 min. On Standard and Loaded, whisk the gravy powder with boiling water from the kettle.",
  ],
  note: "About 20 min start to finish, 6 of them hands-on. Woolworths only: Coles has no frozen crumbed breast this lean.",
}
```

`AMOUNTS.schnitzel = { crumbfillet: 1, potato: { L: 100, S: 200, X: 300 }, evap: 30, fzpeas: 100, gravy: { L: 0, S: 10, X: 10 } }`

- **Ingredient reuse:** new `crumbfillet` (used by this meal only; frozen, so nothing is left half-used). Also `potato`, `evap` (shared with buffalomac), `fzpeas` (friedrice) and `gravy`.
- **Removals:** `panko` becomes unused and has to be removed. Eggs are no longer used here, but other meals still use them.
- **Guideline misses (one fillet, applied 2026-10-26):**
  - **Light kcal:** 418 is under the 400–600 band lower edge is OK; actually 418 is in band.
  - **Protein:** L 43 g and X 47 g are under the 45 g breakfast-style floor only on Light — main Light minimum is 45 g: **L at 43 g protein misses the 45 g main guideline** (Standard 47 g passes the hard CI rule).
  - **One store:** Woolworths only for the fillet (Coles shops need the home-crumb fallback from section 7).
  - **New products:** `freshpasta` and `crumbfillet` (two new items in one rework).
  - **Daily fit:** schnitzel L (418) + bolognese L (567) + yogbowl L (205) + fixtures (540) = 1,730 kcal — roomier on mini-cut days.

---

## 5. Catalogue `ITEMS` to add

```js
{
  id: "freshpasta", sec: 1, keeps: 5, name: "Fresh egg fettuccine", short: "Fettuccine", unit: "g", note: "Use within 3 days of opening. Freeze the rest in single portions; it cooks from frozen in 3 min", same: true,
  coles: { name: "Latina Fresh Egg Fettuccine Pasta 375g", url: "https://www.coles.com.au/product/latina-fresh-egg-fettuccine-pasta-375g-5051790", size: 375, price: 6, checked: "2026-10-26" },
  woolies: { name: "Latina Fresh Egg Fettuccine Pasta 375g", url: "https://www.woolworths.com.au/shop/productdetails/22081/latina-fresh-egg-fettuccine-pasta", stockcode: 22081, size: 375, price: 5.8, checked: "2026-10-26" },
},
{
  id: "crumbfillet", sec: 2, name: "Frozen crumbed chicken breast fillets", short: "Crumbed fillets", unit: "fillets", unitSize: 175, note: "Woolworths only: 77% chicken breast, about twice the protein of a typical frozen schnitzel. Coles has no lean equivalent", same: false,
  coles: null,
  woolies: { name: "Woolworths Italian Style Crumb Chicken Fillets 350g", url: "https://www.woolworths.com.au/shop/productdetails/130110/woolworths-italian-style-crumb-chicken-fillets", stockcode: 130110, size: 2, price: 9, checked: "2026-10-26" },
},
```

- `freshpasta.keeps: 5` is Coles' stated "Life 5 days minimum from delivery". It's conservative; the real unopened shelf life is probably longer.
- The `crumbfillet` price of 9 is an estimate. The app's live Woolworths price reader (`applyLivePrices`) will show the real price once the item is in the catalogue. Recheck it then and update `checked`.

## 6. `MACROS` to add

The rule says `Weekday_Fuel.html`, but MACROS now lives in `macros.js`. The rule text should be updated.

```js
freshpasta: [341, 13.6, 57.1, 5.2, "100g", "label", "As sold. The label is per 100g cooked: 183 kcal, 7.3g P, 30.6g C, 2.8g F, 2.1g fibre (375g cooks to about 700g)"],
crumbfillet: [139, 18.7, 8.2, 3.4, "100g", "label", "Per 175g fillet: 244 kcal, 32.7g P, 14.4g C, 6g F"],
```

Delete `thigh`, `spaghetti`, `macaroni` and `panko` from `MACROS` along with their items.

---

## 7. Alternatives considered (not recommended)

**Frozen schnitzels.** All labels were checked on 2026-10-26 unless marked otherwise. These all have about half the protein and 2–3× the fat of the Woolworths fillets, so reaching the same protein would need about 400 g and 750+ kcal.

| Product | Store / link | Price | Per 100 g |
| --- | --- | --- | --- |
| Coles Frozen Chicken Breast Schnitzel 400g (52% breast) | [Coles 7648272](https://www.coles.com.au/product/coles-frozen-chicken-breast-schnitzel-400g-7648272) | $5.50 checked (ShopHop and Coles page, 2026-10-26) | 213 kcal, 12.7 g P, 12.8 g C, 11.8 g F, 2.5 g fibre (single third-party source, **estimate**) |
| Steggles Chicken Breast Schnitzel Crumbed 400g | Coles (maker says "available at Coles"); **no exact Coles page found** | ~$5.50 (estimate, Nine.com.au) | 185 kcal, 15.6 g P, 11.4 g C, 8.3 g F (maker's site) |
| Ingham's Chicken Breast Schnitzel 400g | [Woolworths 85804](https://www.woolworths.com.au/shop/productdetails/85804/ingham-s-chicken-breast-schnitzel); [Coles 4315003](https://www.coles.com.au/product/inghams-chicken-breast-schnitzel-400g-4315003) (currently unavailable) | not found | 215 kcal, 13.2 g P, 12.4 g C, 12.1 g F |
| Woolworths Chicken Breast Schnitzel 400g | [Woolworths 901739](https://www.woolworths.com.au/shop/productdetails/901739/woolworths-chicken-breast-schnitzel) | not found | 192 kcal, 11.9 g P, 18.2 g C, 7.7 g F |
| Coles RSPCA Chicken Breast Fillet Crumb Sage & Rosemary 400g (chilled, not frozen) | [Coles 2903871](https://www.coles.com.au/product/coles-rspca-approved-chicken-breast-fillet-crumb-sage-and-rosemary-400g-2903871) | $10.00 (Grocerize) | ~188 kcal (377 kcal per ~200 g, Grocerize); protein not found |

For a Coles shop, the realistic fallback is still Evan's old home-crumbed breast. Crumb a batch on Sunday and freeze it raw. That would make it a batch component, which needs a separate yes.

**Ready-made mash** (instead of microwaving a potato):
- [Woolworths Classic Potato Mash 475g (828744)](https://www.woolworths.com.au/shop/productdetails/828744/woolworths-classic-potato-mash) is chilled and can be home-frozen. Per 100 g: 100 kcal, 2 g P, 10.2 g C, 5.5 g F. Price not found.
- No exact Coles page was found for a chilled microwave mash. A "Coles Crème Royale mashed potato tub" appears in calorie databases only.
- Not recommended. It has about 55× the fat of plain potato (5.5 g against 0.1 g per 100 g), it's perishable, and it would be a third new product. Microwaving a whole washed potato is about 2 minutes hands-on and uses an existing item.

---

## 8. Clean-up needed when applying

**Unused items to remove.** `catalogue-data.test.js` fails on any unused product, so delete these from `ITEMS` and `MACROS` and add their ids to `RETIRED`:

| Item | Coles id → `RETIRED.coles` | Woolworths stockcode → `RETIRED.woolies` |
| --- | --- | --- |
| `thigh` | 2263328 (Large Pack approx. 1.2kg), 2263317 (Small Pack approx. 700g) | 6078660 (550g), 727622 (1.2–1.8kg tray) |
| `spaghetti` | 206196 (San Remo Spaghetti No 5 500g) | 43974 |
| `macaroni` | 3329137 (Coles Durum Wheat Pasta Macaroni 500g) | 44025 |
| `panko` | 4324875 (Coles Australian Panko Crumb 220g) | 83295 |

Use the name and url already in `catalogue.js` for each `RETIRED` entry.

**Other references:**
- `meal-rules.test.js`: rewrite the buffalo mac macaroni test for `freshpasta` (110 and 80).
- `catalogue-data.test.js` `withPacks`: `"thigh"` is now dead. It's harmless, but can be removed.
- `Weekday_Fuel.html`:
  - `KITCHEN_FREEZE` includes `"thigh"`. Harmless; remove it if you like.
  - The *Weekly top-up* hint text (around line 699) could mention the bolognese sauce batch.
  - Optional `recipeLines` change to fold the sauce ingredients into the batch line (section 3, option b).
- **Sunday chicken batch `makes`:** with teriyaki, redcurry and buffalomac now on Sunday chicken, a week can need more than 5 tubs. Suggested wording: *"200g raw breast per 150g tub; cook all the breast you bought (one tray takes up to about 1.5kg)"*.

---

## 9. Rule text edits (`.cursor/rules/meals.mdc`)

- **Cook once, eat many:** "…the Sunday chicken (1 kg breast → ~750 g cooked, 5 × 150 g), the Sunday bolognese sauce (1 kg mince → 5 tubs) and boiled eggs."
- **Prep labels:** add *"Every main is ≤10 min hands-on; unattended microwave, air fryer, oven or simmer time doesn't count. `mins` is hands-on minutes. Prefer assemble from batch components (decided 2026-10-26)."*
- **Small fridge:** "Microwave, stovetop, oven **and air fryer** available."
- **Products:** "Add a new product's label macros to `MACROS` in **`macros.js`**."
- **Label facts worth knowing:** add *"Latina Fresh pasta labels are per 100 g cooked (375 g pack → ~700 g cooked); Woolworths Italian Style Crumb Chicken Fillets per 175 g fillet: 244 kcal, 32.7 g P."*

---

## 10. Assumptions and values I couldn't verify

- **Woolworths crumbed fillets:** the price ($9.00 a pack) is an **estimate**. Current availability is also unconfirmed: the product page and label are live, but price trackers don't list it. Check the price in the app or at the store before approving.
- **Air-fryer time** for the fillets (180 °C, 18–20 min from frozen) is an assumption. Pack directions weren't on the product page.
- **Fresh pasta macros as sold** are converted from the cooked label using the label's "350 g = ½ pack cooked" (×1.87). If the real cooked yield is lower, the as-sold kcal would be lower (for example, ~293 kcal per 100 g at ×1.6).
- **Freezing fresh pasta** isn't mentioned on the Latina pack. It's common practice; the 3-minute cook from frozen is an assumption.
- **Coles prices:** the Coles site blocked direct fetches. The Coles prices and availability come from ShopHop (checked 2026-10-26) and Coles' indexed product pages.
- **Mince cooked ratio** of 0.75 and the about-450 g tub weight are typical values, not measured.
- **Typical values added by hand:** full-fat tasty (400 kcal, 25 g P, 33 g F per 100 g), Kewpie (~100 kcal per tbsp), butter (72 kcal per 10 g), sesame seeds (17 kcal per tsp), olive oil (40 kcal per tsp). Their costs are also estimates.
- **Existing MACROS** marked "typical" (breast, mince, sauces, veg) are used as they are. The `teriyaki_sauce` value disagrees with the Woolworths label (section 4.1).
