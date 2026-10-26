# Exact macros (design)

Date: 2026-10-27. Approved by Evan in chat.

## Problem

Meal kcal/protein/carbs/fat are typed into `meals.js` by hand. They are worked out from `AMOUNTS` (catalogue.js) × per-100g values (macros.js) plus hand-added extras, but nothing checks that they agree (CI only checks 4/4/9 consistency), so slips get through (schnitzel Standard was 47g P instead of 45g). 30 of 43 ingredient values are generic "typical" figures, not the label of the product Evan buys. Evan: "ensure we don't estimate, this can cause massive problems".

## Rules (enforced by CI)

1. **No estimated nutrition.** Every nutrition value has a source of one of two kinds:
   - `label`: the nutrition information panel of the exact catalogue product, per store, with product name, store, product id and `checked` date;
   - `fsanz`: for unpackaged produce with no panel (loose tomatoes, cucumber, capsicum, loose potatoes, etc.), the FSANZ AUSNUT / Australian Food Composition Database entry, with its food id and name.
   The source `typical` is removed and a test fails if any value lacks a valid source.
2. **No estimated amounts.** Every ingredient and every extra that carries energy has a measured amount per portion (g or mL). Vague extras ("oil spray", "splash of milk", "knob of butter") become measured ("2 sprays (1g) canola spray", "20 mL milk", "10g butter") with their own label values. Zero-energy extras (water, salt and pepper, dried herbs under 1g) may stay unmeasured and are listed as such.
3. **Meal figures are calculated, not typed.** The app computes every meal's L/S/X kcal, P, C, F (and fibre where labels give it) from amounts × values. `meals.js` keeps names, portions' `what`, costs and steps, but no macro numbers. A test asserts nothing in `meals.js` hard-codes k/p/c/f.
4. **Unconfirmed product data is visible.** A price or product not confirmed on the live store page is marked `unconfirmed` and the app shows it as unconfirmed (e.g. "price not confirmed") instead of presenting it as fact. The crumbed chicken fillet ($9, stock unconfirmed) is the current case.

## Per-store values

Ingredient values are stored per store product (`coles` and `woolies` each carry their own panel). Meals are calculated with the products of the store selected in Shop. A meal already bought (`m.bought` order id) uses the store of that order. When an item is only sold at one store, that store's panel is used everywhere. When the fallback product is in use (e.g. Helga's bread), its own panel is used.

## Data shape

- `macros.js` changes from one array per item to per-product panels, e.g. `{ woolies: {k,p,c,f,fib,per:"100g",src:"label",product,id,checked}, coles: {...} }` or `{ any: {..., src:"fsanz", food:"F00xxxx", name} }` for produce. Extras get entries too (canola spray, butter, milk, Kewpie, olive oil, sesame seeds, full-fat tasty, avocado, sourdough).
- Raw vs cooked: amounts stay in the form bought (raw chicken, dry/fresh pasta as sold, rice as sold in the pouch); batch ratios (Sunday chicken 0.75, Sunday bolognese 0.75) only convert weights for display.
- Storage shapes in localStorage don't change; this is all shipped asset data plus calculation code.

## Approval step

Before release, Evan gets a before/after table of every meal portion (old typed figures vs new calculated figures, per store) and approves it. Meal ids never change.

## Also in this round (decided 2026-10-26/27)

- Rice: Standard becomes ½ pouch, Loaded ¾ pouch, Light stays ⅓, for every rice meal (meal `what` text updated).
- Schnitzel: Standard 300g mash + gravy, Loaded 400g mash + butter + gravy, Light 50g mash.
- Planner: any main can be suggested at lunch or dinner, keeping the existing variety rules.
- Fresh pasta added to the Kitchen "or freeze it" list.

## Testing

- Every macros entry has a valid source; no `typical`; label entries name a catalogue product id that exists for that store.
- Every meal ingredient and energy-carrying extra has a measured amount and a values entry.
- Calculation tests: a meal's portion equals the hand-checked sum for a fixture; store switch changes the result when panels differ; bought meals use their order's store; fallback product uses its own panel.
- Existing 4/4/9 check stays as a sanity check on panels.
