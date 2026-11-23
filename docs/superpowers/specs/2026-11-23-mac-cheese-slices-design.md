# Buffalo mac & cheese: processed cheese slices

Date: 2026-11-23. Approved by Evan in chat.

## Problem

The buffalo chicken mac & cheese (`buffalomac`) uses light shredded cheese on Light and Standard and full-fat tasty shredded on Loaded. Light shredded cheese has less fat and anti-caking starch, so it clumps and won't come together into a sauce. Evan wants the meal fast and foolproof, and is happy to give up light cheese for that.

## Decision

Use processed cheese slices (regular, not light) in every portion. Processed slices contain emulsifying salts (sodium citrate/phosphates), so they melt smoothly with the evaporated milk even if the heat is a bit high, and survive reheating. Evan chose regular over light slices to make it as forgiving as possible. If they're too bland, he'll say so and we revisit.

## Product

New catalogue item `cheeseslice`:

- `sec: 1`, `keeps: 28`, `name: "Cheese slices"`, `short: "Slices"`, `unit: "slices"`, `unitSize: 18`, `same: false`, note says they're individually wrapped processed slices that melt smoothly.
- Woolworths: Kraft Singles Original 432g (24 slices), stockcode 791364, `https://www.woolworths.com.au/shop/productdetails/791364/kraft-singles-original-original`, size 24, price 9.60 (checked 2026-11-23).
- Coles: Coles doesn't list Kraft Singles. Use Coles Simply Sandwich Slices 24 Pack 500g (24 slices, about 20.8 g each), price 4.25 (seen 2026-11-20 on a price tracker). The implementer finds the exact `coles.com.au/product/...-<id>` URL. If it can't be confirmed, set `coles: null` and say why in the item note. Do not guess an id.

`MACROS.cheeseslice` (per 100g, `src: "label"`):

- woolies: Kraft Singles Original, 1140 kJ = 272.5 kcal, P 19.1, C 3.5, F 20.8, sodium 1300 mg. One 18 g slice: 205 kJ, 3.4 g P, 3.7 g F.
- coles: Coles Simply Sandwich Slices, 1226 kJ = 293 kcal, P 18.9, C 3.9, F 22.6, sodium 1190 mg, serving 20.8 g. Note that two versions of this label circulate (the other is 289 kcal, 18.2 g P, 22.5 g F) and mark it `confirm` until checked on the pack, so it lands on the label-photo list.

## Per-store slice weight

`unitSize` is per item, but a Coles slice (20.8 g) is heavier than a Kraft slice (18 g). Add an optional `unitG` on a MACROS store panel: when the item's unit is a count (`slices`, `eggs`, etc.) and the chosen panel has `unitG`, `meal-calc.js` uses `amount * panel.unitG` instead of `amount * item.unitSize`. Set `unitG: 20.8` on the Coles `cheeseslice` panel only. Nothing else changes behaviour.

## Meal changes (`buffalomac`)

`AMOUNTS.buffalomac`: drop `cheese` and `tasty`, add `cheeseslice: { L: 2, S: 3, X: 4 }`. Everything else stays (breast 200, freshpasta 50/80/110, evap 80, franks 50, fzbroc 100, paprika 1, garlic 5).

Portion `what`:

- L: "Small serve of fettuccine, 2 cheese slices"
- S: "Fettuccine, 3 cheese slices"
- X: "Big serve of fettuccine, 4 cheese slices"

`cost` per portion recomputed so Standard matches the catalogue per-serve cost averaged over both stores (same method as the other meals).

Steps 3 and 4 become:

3. "Cook the fettuccine for 2 min, then drain it and return it to the pot on low with the evaporated milk. Warm for 30 sec."
4. "Tear in the cheese slices and stir for 1 min until smooth and glossy. Fold through the chicken and broccoli for 1 min until hot, then finish with the rest of the Frank's."

Note becomes: "Evaporated milk and processed cheese slices make a smooth sauce that won't split or go stringy, even reheated. The rest of the can goes in the schnitzel mash within a few days."

Expected macros from the cheese per Standard: Woolworths 3 × 18 g ≈ 147 kcal, 10.3 g P (was 40 g light shredded: 135 kcal, 11.9 g P). Meal stays within the meal rules' kcal bands; report any guideline miss.

## Removals

- `tasty` is used only by `buffalomac`, so delete it from `ITEMS` and `MACROS`, and add its ids (Woolworths 729026, Coles 8145335) to `RETIRED` so past orders still show the name.
- Light shredded `cheese` stays (six other meals use it).
- Remove any `tasty` research/label-photo references that tests require to match the catalogue.

## Saved data

Meal ids don't change. Kitchen stock or shop leftovers recorded for `tasty` become an unknown item; the app already ignores items no longer in the catalogue. No migration.

## Tests

- `meal-rules.test.js` and `catalogue-data.test.js` pass with the new item and amounts.
- New test: a count-unit item whose store panel has `unitG` uses `unitG` per unit for that store, and `unitSize` for a store panel without it.
- New test: `buffalomac` Standard cheese macros at Coles use 20.8 g per slice.
- Full suite: `node --test "apps/android/app/src/test/js/*.test.js"`; last `<script>` of `Weekday_Fuel.html` passes `node --check`.

## Out of scope

Using cheese slices in other meals (toastie, egg muffin, wraps). Revisit once Evan has tried them.

## Release

Ships in the next release with the broccoli label fix, after the calorie/activity work is designed (or sooner if Evan asks).
