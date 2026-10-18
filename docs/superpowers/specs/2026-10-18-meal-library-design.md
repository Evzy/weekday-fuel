# Meal library: rules, checks and an agent workflow for adding meals

**Status:** approved 2026-10-18 (design); spec awaiting owner review
**Release:** v0.9.0 (setup, full recipes, portion-aware shop; new meals come in later releases)

## Goal

Make adding, changing or removing meals a repeatable chat with an agent: the agent follows Evan's meal rules automatically, automatic checks block meals that break the hard rules, and the meal data lives in its own file instead of inside the 1,000+ line page. Every meal gets a full recipe whose amounts follow the portion, the shop buys what each planned day's portion actually needs, and the plan keeps its founding idea: cheap, smart, and as little prep as possible (cook once, eat many).

## Decisions (owner, 2026-10-18)

- Meals are added by chatting with the agent, plus a one-off setup: the meal-planning handover saved as a repo rule, and automatic meal checks. No in-app meal editor.
- Checks block only hard rules; kcal bands, protein maximums, cost, prep time, beans and single-store products are guidelines the agent reports when proposing a meal.
- Meals move into their own file, `assets/weekday_fuel/meals.js`; products and shopping amounts stay in `catalogue.js`.
- Two kcal figures that miss the 5% maths rule are corrected; the protein minimum is checked on the Standard portion.
- Shared ingredients stay the point: new meals are built mainly from products already in the app, and every proposal reports what it adds and what it shares. Making "Suggest a day" and Build a shop prefer overlapping meals is the next feature, brainstormed separately.
- Little to no prep is the guiding idea: batch-cook early in the week (Sunday chicken, boiled eggs) and reuse it across meals. Every meal is labelled assemble (~5 min from batch or no-cook parts), quick cook (one pan, ≤12 min) or full cook (≤20 min); new meals lean to the first two.
- Full recipes for every meal: every ingredient with an amount, amounts that follow the portion, clear steps with heat and times, and a Batch prep card.
- Portions are a property of a planned meal, not something Evan has to pick: "Suggest a day" already fits each meal's portion to the day's calories, and he can still add a meal to a day and choose its portion himself. The shop buys each planned meal at its planned portion; the recipe opens on that portion.

## Current state (2026-10-18)

- `Weekday_Fuel.html` defines `const MEALS=[…]` (14 meals, line ~246) and `const MEAL=Object.fromEntries(…)`. Meal objects already have the handover's shape: `id, name, slots, cuisine, mins, remake?, core, t: {L,S,X: {k,p,c,f,cost,what}}, ing, steps, note?`.
- `catalogue.js` holds `ITEMS` (products with Coles and Woolworths pages, prices, pack sizes, `checked` dates) and `AMOUNTS` (per meal: item id → amount one Standard serve uses). This is the handover's `amt`.
- `catalogue-data.test.js` already checks products (real product URLs, prices, Coles ids, Woolworths stockcodes), that every `AMOUNTS` item exists, and that every product is used; its `MEALS` list of 14 ids is hard-coded.
- Recipes already exist (tap a meal's name on Today, in Build a shop or in an item's "Used in" chips, or Recipe on the Meals tab) but most ingredient lines have no amount, nothing follows the portion, the batch cook has no recipe, and methods are 3–4 short lines.
- Planned days feed Build a shop (`dayMeals()` → `CAT.shopList(picks, fixtureDays, dayMeals)`), but `dayMeals()` drops each meal's portion `t`, so every planned meal is bought at Standard amounts. `shopList` already skips meal ids it doesn't know.
- The page special-cases `yogbowl` by id (suggestions and snack lists). Meal ids are stored in settings (picks, day plans), so ids must never change.
- Run against the handover's rules, all 14 meals pass the macro maths except fried rice Light (640 kcal listed, 608 from macros, 5.3%) and snack plate Light (175 vs 166, 5.4%). Ten meals fall outside the kcal bands and several Loaded portions exceed the protein maximums; the owner likes these meals, so those rules are guidelines.

## Components

### 1. `assets/weekday_fuel/meals.js` (new)

- Exports `MEALS` and `BATCHES` the same way `catalogue.js` exports its API: `module.exports` under Node, `window.WeekdayFuelMeals` in the page.
- Meals keep their ids, names, slots, cuisine, core and L/S/X numbers (`k p c f cost what`), apart from two kcal fixes: fried rice Light `k` 640 → 608; snack plate Light `k` 175 → 166.
- Each meal gains:
  - `prep`: `"assemble"`, `"quick"` or `"cook"`, with `mins` its hands-on time;
  - `batch`: ids of batch components it uses (e.g. `["chicken"]`), omitted when none;
  - `extras`: non-shop ingredients with amounts, e.g. `"Oil spray"`, `"½ tsp garlic powder"`, `"Salt and pepper"`;
  - rewritten `steps`: numbered, with heat and times, never hard-coding an amount that changes by portion (they say "the macaroni"; the ingredient list carries the amount).
- The free-text `ing` list is removed; the recipe's ingredient list is built from `catalogue.js` amounts (component 1a) plus `extras`, so the recipe and the shop list can't drift apart.
- `BATCHES`: `chicken` (Sunday chicken: 1 kg breast, 200 °C 20–25 min, rest, slice, 5 × 150 g; cooked chicken keeps 3–4 days in the fridge, so freeze the Thursday and Friday portions after cooking and thaw overnight) and `eggs` (boil 6, 9 min, cold water; keep unpeeled in the fridge up to 5 days). Each has `id, name, makes, keeps, steps` and its shopping amounts in `catalogue.js`.

### 1a. Amounts per portion (`catalogue.js`)

- `AMOUNTS[meal][item]` is either a number (the same for every portion, e.g. the 180 g chicken) or `{L, S, X}` (e.g. macaroni `{L: 50, S: 75, X: 100}`), matching each portion's `what` and macros.
- Batch-component meals list the batch's cooked amount against the raw item (e.g. 150 g batch chicken → the breast item at the raw-equivalent weight already used today), so the shop still buys raw breast.
- New helper `amountFor(meal, item, tier)` (tier defaults to `"S"`), used by `shopList`, `mealCost` and the recipe.
- `shopList(picks, fixtureDays, dayMeals)`: `dayMeals` entries gain `t` (`"L" | "S" | "X"`); each planned meal is bought at its planned portion. Build a shop picks (meal × serves, not tied to a day) stay at Standard. `mealCost(meal, store, tier)` gains the tier argument (default `"S"`).
- `Weekday_Fuel.html` `dayMeals()` passes each planned meal's `t`.

### 1b. Recipe view and Batch prep (`Weekday_Fuel.html`)

- The recipe sheet gets a Light / Standard / Loaded switch. It opens on the planned portion when opened from a meal on Today, otherwise on Standard. The switch only changes what the recipe shows; it never changes the day's plan (portions on Today are changed with the existing portion dial).
- Ingredients: one line per `amountFor` entry, formatted with the existing `fmtAmt` ("100g", "½ pouch", "2"), the item's name, and the product for the picked store in muted text, then the `extras`. Then the method and note as now.
- A meal with `batch` shows "Uses Sunday chicken · Batch prep" (a link that opens that batch's recipe in the same sheet).
- Meals tab: a Batch prep card at the top listing each batch (name, makes, keeps), each opening its recipe.
- The meal card's tags show the prep label ("Assemble", "Quick cook", "Full cook") next to the minutes.
- All meal-derived text goes through `esc` as today.
- `Weekday_Fuel.html` loads it with `<script src="meals.js"></script>` next to the other asset scripts (before the page's inline script) and sets `const MEALS=WeekdayFuelMeals.MEALS;`. Everything else in the page keeps using `MEALS` and `MEAL` unchanged.
- README gets a row for the file.

### 2. Meal rule checks: `test/js/meal-rules.test.js` (new, in the CI `node --test` list)

Hard rules (a failing meal fails CI):

- **Shape:** unique `id` matching `^[a-z][a-z0-9]*$`; `name`, `cuisine`, `core` non-empty strings; `slots` a non-empty subset of `breakfast`, `main`, `snack`; `mins` a positive number; `prep` one of `assemble`, `quick`, `cook`; `L`, `S`, `X` each with numeric `k, p, c, f`, a positive `cost` and a non-empty `what`; `extras` a string array; at least 3 `steps`.
- **Recipe:** every `AMOUNTS` entry is a positive number or has positive `L`, `S` and `X`; every `batch` id is a `BATCHES` id; every batch has `name, makes, keeps`, at least 2 steps and an `AMOUNTS` entry; no step of a meal contains a number followed by `g` or `mL` (`/\d\s*(g|mL)\b/`) when that meal has any per-portion amount.
- **Maths:** for every portion, `|k − (4p + 4c + 9f)| ≤ 5%` of `4p + 4c + 9f`.
- **Protein minimum:** Standard `p` ≥ the lowest minimum among the meal's slots (breakfast 30, main 45, snack 15).
- **Banned foods:** no match for `/tuna|salmon|cottage cheese/i` in the meal's name, core, `what`, extras, steps or note, nor in the names of the items and products its `AMOUNTS` use.
- **Shopping amounts:** every meal has an `AMOUNTS` entry and every `AMOUNTS` key is a meal (replacing the hard-coded list in `catalogue-data.test.js`, which then reads ids from `meals.js`).

Guidelines (never fail CI; the agent reports them per meal when proposing):

- kcal bands: Light 400–600, Standard 550–750, Loaded 750–950;
- protein maximum per slot: breakfast 45, main 65, snack 25;
- cost over $7 a serve; prep over 20 min; beans; a product stocked at only one store;
- ingredient reuse: how many products the meal adds that no existing meal uses (aim for at most one, and never a new perishable that would be left half-used), and which existing meals share its protein, carb and veg.

The agent works out guideline misses itself when proposing; no helper code for them (YAGNI).

### 3. `.cursor/rules/meals.mdc` (new)

A Cursor rule, applied when `meals.js` or `catalogue.js` is in context or when meals are discussed (`globs` on those two files plus a description so it can be pulled in by request). Contents, from the owner's handover, tightened:

- Who it's for: Evan, 30, Melbourne, 183 cm, ~83.5 kg; PPL 5 days at lunch + 2 runs; shops at Coles and Woolworths; desk job; cheap, low-effort meals.
- Targets: 170 g protein every weekday (fixed, first); kcal by phase (mini-cut ~2,150, current; recomp ~2,500; lean bulk ~2,800); weekends untracked; weekday kcal nudged ±150 from the 7-day trend; he picks meals and portions, the app adds them up.
- Daily fixtures (Dare 500 mL, Grenade bar; ~540 kcal, ~50 g protein); meals cover ~120 g protein; typical day one breakfast, two mains, maybe a snack.
- Shared ingredients (the plan's founding idea): build new meals mainly from products already in `catalogue.js`, so a week's shop stays small and prep overlaps (Sunday chicken batch, rice pouches, light cheese, wraps, eggs, frozen veg). Take the protein, carb and veg from the existing pool; get new flavour from cheap jars, pastes and spice mixes rather than new fresh items.
- Food rules: banned (tuna, tinned salmon, cottage cheese); avoid beans unless minor; the approved proteins, carbs and veg; ask Evan yes/no before any new core ingredient; variety across cuisines, no variations of the same dish; flavour from cheap jars, pastes and spice mixes; ready-meal remakes are a big win.
- A **food decisions** list (approved/rejected, with dates), seeded with the handover's approved lists, updated whenever Evan answers.
- Little to no prep (cook once, eat many): build around batch components cooked early in the week (Sunday chicken, boiled eggs; add a new batch component only with Evan's yes). Label every meal assemble / quick / cook and lean new meals to assemble and quick. Every proposal shows hands-on minutes, batch components used and cost per serve.
- Recipe standard: every ingredient has an amount for each portion (in `AMOUNTS`), non-shop items go in `extras` with amounts, steps are numbered with heat and times and never hard-code an amount that changes by portion.
- Practical limits: ≤20 min, one pan plus microwave; small fridge (frozen veg, long-life cans, pantry jars, single-portion frozen meat, no half-used perishables); Sunday chicken batch (1 kg breast → ~750 g cooked, 5 × 150 g); cost under $7 a serve with realistic Coles/Woolworths AUD prices.
- Meal structure: fixed protein core; L/S/X change only carbs and fat; the hard rules and guidelines exactly as in component 2; protein per meal ranges.
- Products: real Coles and Woolworths products with exact product-page URLs (never search URLs; say so if none found), looked up on the live sites, label values where possible, each price marked checked or estimate; record them in `catalogue.js` the way existing items are recorded (name, url, price, size, `checked` date, Woolworths stockcode, Coles id at the end of the URL).
- Where things go: meal object in `meals.js`; shopping amounts (the handover's `amt`) in `catalogue.js` `AMOUNTS`, keyed by item id; new products as `ITEMS`. Meal ids never change.
- Workflow (component 4) and the proposal format: per meal, cuisine, prep label and hands-on mins, batch components, core, the L/S/X table with costs, ingredients with both stores' links, method, the ingredient-reuse report (new products added; existing meals it shares ingredients with), guideline misses, assumptions and unverified values.

### 4. Workflow (documented in the rule)

1. Evan asks in chat (loose or specific).
2. Any needed food not in the food decisions list gets a yes/no question first, one food per question.
3. The agent proposes each meal in the proposal format, using the live Coles and Woolworths sites for products and labels.
4. Evan approves, tweaks or rejects each meal.
5. The agent adds approved meals (`meals.js`, `catalogue.js`), runs the JS tests, checks the Meals and Shop tabs in a browser, commits to `main`, waits for green CI, bumps the version and releases.
6. Food answers are recorded in the rule's food decisions list.

Removing a meal: the agent confirms the page and `catalogue.shopList` ignore picks and day plans that name an unknown meal id (adding a guard if they don't), so saved settings never break.

## Error handling

- A meal that breaks a hard rule fails CI; the agent fixes it before release.
- The page fails to load `meals.js`: same failure mode as `catalogue.js` today (the app's assets ship in the APK, so this only happens if the file is missing from the build; the tests catch a missing or malformed file).

## Guardrails

- Each meal's L/S/X numbers stay as they are except the two kcal fixes; recipe rewrites (amounts, extras, steps, prep labels) must match the existing portions' `what` and macros, and the owner reviews them in the release.
- Meal ids and existing `localStorage` keys keep their shape.
- Commit straight to `main`; CI green before the next task; version bumped only in the release task.
- Don't touch `platra/`, the keystore, `local.properties` or `docs/seed/`; don't stage `.superpowers/`.

## Verification

- JS tests pass, including `meal-rules.test.js` (all 14 meals and both batches pass the hard rules) and `catalogue` tests for `amountFor` and portion-aware `shopList` (a planned Loaded buffalo mac buys 100 g macaroni, a pick buys 75 g).
- Browser check: Today, Meals and Shop tabs show the same 14 meals with the same numbers (fried rice Light and snack plate Light show the corrected kcal); every recipe shows amounts that change with the portion switch; a recipe opened from Today opens on that day's portion; the Batch prep card and links work; suggestions and the starter shop still work; a Loaded day raises the shop amounts.
- Owner phone check after release: recipes read well and are cookable from the screen; the shop matches the planned days.

## Out of scope

- New meals (they follow in later releases via the workflow).
- An in-app meal editor.
- Enforcing guidelines in CI.
- Changing kcal bands or protein ranges.
- Overlap-aware "Suggest a day" and Build a shop (next feature, own brainstorm).
- Portions for Build a shop picks that aren't tied to a day (they stay Standard).
- A prep-day planner (which batch to cook when, for the week's plan).
