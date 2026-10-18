# Meal library: rules, checks and an agent workflow for adding meals

**Status:** approved 2026-10-18 (design); spec awaiting owner review
**Release:** v0.9.0 (setup only; new meals come in later releases)

## Goal

Make adding, changing or removing meals a repeatable chat with an agent: the agent follows Evan's meal rules automatically, automatic checks block meals that break the hard rules, and the meal data lives in its own file instead of inside the 1,000+ line page.

## Decisions (owner, 2026-10-18)

- Meals are added by chatting with the agent, plus a one-off setup: the meal-planning handover saved as a repo rule, and automatic meal checks. No in-app meal editor.
- Checks block only hard rules; kcal bands, protein maximums, cost, prep time, beans and single-store products are guidelines the agent reports when proposing a meal.
- Meals move into their own file, `assets/weekday_fuel/meals.js`; products and shopping amounts stay in `catalogue.js`.
- Two kcal figures that miss the 5% maths rule are corrected; the protein minimum is checked on the Standard portion.

## Current state (2026-10-18)

- `Weekday_Fuel.html` defines `const MEALS=[…]` (14 meals, line ~246) and `const MEAL=Object.fromEntries(…)`. Meal objects already have the handover's shape: `id, name, slots, cuisine, mins, remake?, core, t: {L,S,X: {k,p,c,f,cost,what}}, ing, steps, note?`.
- `catalogue.js` holds `ITEMS` (products with Coles and Woolworths pages, prices, pack sizes, `checked` dates) and `AMOUNTS` (per meal: item id → amount one Standard serve uses). This is the handover's `amt`.
- `catalogue-data.test.js` already checks products (real product URLs, prices, Coles ids, Woolworths stockcodes), that every `AMOUNTS` item exists, and that every product is used; its `MEALS` list of 14 ids is hard-coded.
- The page special-cases `yogbowl` by id (suggestions and snack lists). Meal ids are stored in settings (picks, day plans), so ids must never change.
- Run against the handover's rules, all 14 meals pass the macro maths except fried rice Light (640 kcal listed, 608 from macros, 5.3%) and snack plate Light (175 vs 166, 5.4%). Ten meals fall outside the kcal bands and several Loaded portions exceed the protein maximums; the owner likes these meals, so those rules are guidelines.

## Components

### 1. `assets/weekday_fuel/meals.js` (new)

- Exports `MEALS` (the 14 meal objects, unchanged apart from the two kcal fixes) the same way `catalogue.js` exports its API: `module.exports` under Node, `window.WeekdayFuelMeals` in the page.
- Fixes: fried rice Light `k` 640 → 608; snack plate Light `k` 175 → 166.
- `Weekday_Fuel.html` loads it with `<script src="meals.js"></script>` next to the other asset scripts (before the page's inline script) and sets `const MEALS=WeekdayFuelMeals.MEALS;`. Everything else in the page keeps using `MEALS` and `MEAL` unchanged.
- README gets a row for the file.

### 2. Meal rule checks: `test/js/meal-rules.test.js` (new, in the CI `node --test` list)

Hard rules (a failing meal fails CI):

- **Shape:** unique `id` matching `^[a-z][a-z0-9]*$`; `name`, `cuisine`, `core` non-empty strings; `slots` a non-empty subset of `breakfast`, `main`, `snack`; `mins` a positive number; `L`, `S`, `X` each with numeric `k, p, c, f`, a positive `cost` and a non-empty `what`; non-empty `ing` and `steps` string arrays.
- **Maths:** for every portion, `|k − (4p + 4c + 9f)| ≤ 5%` of `4p + 4c + 9f`.
- **Protein minimum:** Standard `p` ≥ the lowest minimum among the meal's slots (breakfast 30, main 45, snack 15).
- **Banned foods:** no match for `/tuna|salmon|cottage cheese/i` in the meal's name, core, `what`, ingredients, steps or note, nor in the names of the products its `AMOUNTS` use.
- **Shopping amounts:** every meal has an `AMOUNTS` entry and every `AMOUNTS` key is a meal (replacing the hard-coded list in `catalogue-data.test.js`, which then reads ids from `meals.js`).

Guidelines (never fail CI; the agent reports them per meal when proposing):

- kcal bands: Light 400–600, Standard 550–750, Loaded 750–950;
- protein maximum per slot: breakfast 45, main 65, snack 25;
- cost over $7 a serve; prep over 20 min; beans; a product stocked at only one store.

The agent works out guideline misses itself when proposing; no helper code for them (YAGNI).

### 3. `.cursor/rules/meals.mdc` (new)

A Cursor rule, applied when `meals.js` or `catalogue.js` is in context or when meals are discussed (`globs` on those two files plus a description so it can be pulled in by request). Contents, from the owner's handover, tightened:

- Who it's for: Evan, 30, Melbourne, 183 cm, ~83.5 kg; PPL 5 days at lunch + 2 runs; shops at Coles and Woolworths; desk job; cheap, low-effort meals.
- Targets: 170 g protein every weekday (fixed, first); kcal by phase (mini-cut ~2,150, current; recomp ~2,500; lean bulk ~2,800); weekends untracked; weekday kcal nudged ±150 from the 7-day trend; he picks meals and portions, the app adds them up.
- Daily fixtures (Dare 500 mL, Grenade bar; ~540 kcal, ~50 g protein); meals cover ~120 g protein; typical day one breakfast, two mains, maybe a snack.
- Food rules: banned (tuna, tinned salmon, cottage cheese); avoid beans unless minor; the approved proteins, carbs and veg; ask Evan yes/no before any new core ingredient; variety across cuisines, no variations of the same dish; flavour from cheap jars, pastes and spice mixes; ready-meal remakes are a big win.
- A **food decisions** list (approved/rejected, with dates), seeded with the handover's approved lists, updated whenever Evan answers.
- Practical limits: ≤20 min, one pan plus microwave; small fridge (frozen veg, long-life cans, pantry jars, single-portion frozen meat, no half-used perishables); Sunday chicken batch (1 kg breast → ~750 g cooked, 5 × 150 g); cost under $7 a serve with realistic Coles/Woolworths AUD prices.
- Meal structure: fixed protein core; L/S/X change only carbs and fat; the hard rules and guidelines exactly as in component 2; protein per meal ranges.
- Products: real Coles and Woolworths products with exact product-page URLs (never search URLs; say so if none found), looked up on the live sites, label values where possible, each price marked checked or estimate; record them in `catalogue.js` the way existing items are recorded (name, url, price, size, `checked` date, Woolworths stockcode, Coles id at the end of the URL).
- Where things go: meal object in `meals.js`; shopping amounts (the handover's `amt`) in `catalogue.js` `AMOUNTS`, keyed by item id; new products as `ITEMS`. Meal ids never change.
- Workflow (component 4) and the proposal format: per meal, cuisine, mins, core, the L/S/X table with costs, ingredients with both stores' links, method, guideline misses, assumptions and unverified values.

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

- No meal content changes in this release except the two kcal fixes.
- Meal ids and existing `localStorage` keys keep their shape.
- Commit straight to `main`; CI green before the next task; version bumped only in the release task.
- Don't touch `platra/`, the keystore, `local.properties` or `docs/seed/`; don't stage `.superpowers/`.

## Verification

- JS tests pass, including `meal-rules.test.js` (all 14 meals pass the hard rules after the fixes).
- Browser check: Today, Meals and Shop tabs render the same 14 meals with the same numbers (fried rice Light and snack plate Light show the corrected kcal); suggestions and the starter shop still work.
- Owner phone check after release: the app looks and works the same.

## Out of scope

- New meals (they follow in later releases via the workflow).
- An in-app meal editor.
- Enforcing guidelines in CI.
- Changing kcal bands or protein ranges.
