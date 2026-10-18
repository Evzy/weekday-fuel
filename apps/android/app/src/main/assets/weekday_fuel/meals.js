/* Evan's meals and batch-prep recipes. Pure data. The rules every meal follows: .cursor/rules/meals.mdc and test/js/meal-rules.test.js. Ingredient amounts per portion live in catalogue.js AMOUNTS. */
(function (root) {
  "use strict";
  /* k=kcal p=protein c=carbs f=fat (g), cost=AUD per serve (estimate). prep: assemble | quick | cook. extras: non-shop ingredients, a string (every portion) or {tiers, text}. */
  var RICE_REST = { tiers: "LS", text: "Fridge the rest of the rice pouch for another rice meal within 2 days" };
  var MEALS = [
    {
      id: "toasty", name: "Loaded ham & cheese toasty", slots: ["breakfast"], cuisine: "Aussie", mins: 6, prep: "quick",
      core: "100g shaved ham",
      t: {
        L: { k: 395, p: 32, c: 38, f: 11, cost: 5.15, what: "2 wholemeal slices, 1 light cheese slice" },
        S: { k: 490, p: 38, c: 38, f: 19, cost: 5.6, what: "2 cheese slices + thin butter outside" },
        X: { k: 590, p: 42, c: 60, f: 18, cost: 6.25, what: "Thick sourdough, 2 cheese slices, butter" },
      },
      extras: [{ tiers: "X", text: "2 thick slices of sourdough (buy separately)" }, { tiers: "L", text: "Oil spray" }, { tiers: "SX", text: "Thin spread of butter for the outside" }],
      steps: [
        "Heat a sandwich press, or a frying pan on medium.",
        "Layer the ham, cheese, spinach and halved tomatoes between the bread.",
        "Butter or spray the outsides.",
        "Press 3–4 min, or fry 2 min each side, until golden and the cheese melts.",
      ],
    },
    {
      id: "eggmuffin", name: "Egg & ham breakfast muffins", slots: ["breakfast"], cuisine: "Café", mins: 7, prep: "quick",
      core: "3 eggs + 50g ham",
      t: {
        L: { k: 465, p: 38, c: 29, f: 21, cost: 5.05, what: "1 English muffin, no cheese" },
        S: { k: 680, p: 50, c: 56, f: 28, cost: 6.35, what: "2 muffins + 1 light cheese slice" },
        X: { k: 785, p: 56, c: 56, f: 37, cost: 7.25, what: "2 muffins, 2 cheese slices, butter" },
      },
      extras: ["Oil spray", "Hot sauce or tomato sauce, to taste", { tiers: "X", text: "Butter for the muffins" }],
      steps: [
        "Heat a non-stick pan on medium with oil spray. Crack in the eggs and fry 3 min (break the yolks if you like them firm).",
        "Toast the muffins while the eggs cook, and butter them on Loaded.",
        "Warm the ham in the pan for the last 30 sec.",
        "Stack muffin, cheese (if your portion has it), ham, spinach and egg. Add sauce to taste.",
      ],
    },
    {
      id: "yogbowl", name: "Greek yoghurt berry bowl", slots: ["breakfast", "snack"], cuisine: "No-cook", mins: 2, prep: "assemble",
      core: "250g high-protein plain Greek yoghurt",
      t: {
        L: { k: 205, p: 24, c: 24, f: 1, cost: 3.7, what: "Yoghurt, 100g frozen berries, 1 tsp honey" },
        S: { k: 365, p: 28, c: 48, f: 5, cost: 4.25, what: "+ 40g muesli" },
        X: { k: 540, p: 34, c: 62, f: 15, cost: 4.75, what: "+ 60g muesli + 1 tbsp peanut butter" },
      },
      extras: [],
      steps: [
        "Microwave the berries in the bowl for 40 sec until jammy, or thaw them in the fridge overnight.",
        "Spoon the yoghurt over or alongside.",
        "Drizzle the honey, then add the muesli and peanut butter if your portion has them.",
      ],
    },
    {
      id: "brekwrap", name: "Scrambled egg breakfast wrap", slots: ["breakfast"], cuisine: "Mexican", mins: 6, prep: "quick",
      core: "3 eggs + 50g ham",
      t: {
        L: { k: 415, p: 38, c: 9, f: 22, fib: 16, cost: 4.8, what: "1 protein wrap, salsa, spinach" },
        S: { k: 485, p: 44, c: 9, f: 27, fib: 16, cost: 5.5, what: "+ 20g light grated cheese" },
        X: { k: 615, p: 54, c: 13, f: 31, fib: 33, cost: 6.85, what: "2 wraps, 30g cheese" },
      },
      extras: ["Salt and pepper", "Oil spray"],
      steps: [
        "Whisk the eggs with salt and pepper.",
        "Heat a non-stick pan on medium with oil spray. Scramble the eggs for 2 min, stirring, until just set.",
        "Fold in the torn ham and the spinach for the last 30 sec.",
        "Warm the wraps for 15 sec in the microwave. Fill with the eggs, salsa and cheese (if your portion has it), and roll.",
      ],
    },
    {
      id: "tenderwrap", name: "Chicken tender wraps", slots: ["main"], cuisine: "Your go-to", mins: 5, prep: "assemble", batch: ["chicken"],
      core: "150g cooked chicken breast (Sunday batch)",
      t: {
        L: { k: 415, p: 60, c: 10, f: 11, fib: 16, cost: 5.75, what: "1 protein wrap, 20g light cheese" },
        S: { k: 545, p: 70, c: 14, f: 15, fib: 33, cost: 7.4, what: "2 wraps, 30g light cheese" },
        X: { k: 660, p: 76, c: 17, f: 24, fib: 33, cost: 8.1, what: "2 wraps, 50g cheese, light mayo" },
      },
      extras: [{ tiers: "X", text: "1 tbsp light mayo" }],
      steps: [
        "Take a portion of Sunday chicken and slice it.",
        "Warm it for 60–90 sec in the microwave, or 2 min in a hot pan for colour.",
        "Warm the wraps for 15 sec. Load them with the chicken, cheese, sliced cucumber, halved tomatoes, spinach and salsa (and the mayo on Loaded).",
        "Roll them up. Optional: 2 min in the sandwich press.",
      ],
      note: "Crumbed frozen tenders instead of plain chicken add roughly 150 kcal per serve. Deli BBQ chicken adds about $1.70 a serve.",
    },
    {
      id: "burritobowl", name: "Chicken burrito bowl", slots: ["main"], cuisine: "Mexican", mins: 5, prep: "assemble", batch: ["chicken"],
      core: "150g cooked chicken breast (Sunday batch)",
      t: {
        L: { k: 565, p: 58, c: 65, f: 6, cost: 6.6, what: "½ rice pouch, no cheese" },
        S: { k: 770, p: 69, c: 87, f: 15, cost: 7.85, what: "¾ pouch + 30g light cheese" },
        X: { k: 995, p: 72, c: 110, f: 27, cost: 10.35, what: "Whole pouch, cheese, ½ avocado" },
      },
      extras: ["Splash of water", { tiers: "X", text: "½ avocado (buy separately)" }, RICE_REST],
      steps: [
        "Toss a portion of Sunday chicken with the taco seasoning and a splash of water. Microwave for 90 sec.",
        "Microwave the rice pouch for 90 sec and the drained corn for 2 min.",
        "Dice the capsicum.",
        "Bowl it: rice, chicken, corn, capsicum, salsa and a dollop of yoghurt as sour cream, then the cheese and avocado if your portion has them.",
      ],
    },
    {
      id: "teriyaki", name: "Teriyaki chicken rice bowl", slots: ["main"], cuisine: "Japanese", mins: 12, prep: "quick",
      core: "200g chicken thigh fillet",
      t: {
        L: { k: 615, p: 47, c: 66, f: 16, cost: 6.6, what: "½ rice pouch, stir-fry veg" },
        S: { k: 740, p: 50, c: 89, f: 18, cost: 7.2, what: "¾ pouch + sesame seeds" },
        X: { k: 940, p: 52, c: 112, f: 30, cost: 8.05, what: "Whole pouch + Kewpie drizzle" },
      },
      extras: ["Oil spray", { tiers: "SX", text: "1 tsp sesame seeds" }, { tiers: "X", text: "1 tbsp Kewpie mayo" }, RICE_REST],
      steps: [
        "Slice the thigh into strips.",
        "Heat a frying pan on high with oil spray. Fry the chicken for 6–7 min until browned and cooked through.",
        "Add the frozen veg for 2 min, then the teriyaki. Let it bubble for 1 min until sticky.",
        "Microwave the rice pouch for 90 sec. Serve the chicken over the rice, topped with sesame seeds and Kewpie if your portion has them.",
      ],
    },
    {
      id: "buffalomac", name: "Buffalo chicken mac & cheese", slots: ["main"], cuisine: "American", mins: 15, prep: "cook", remake: "YES-style buffalo chicken mac",
      core: "180g chicken breast",
      t: {
        L: { k: 585, p: 64, c: 49, f: 12, cost: 5.9, what: "50g dry macaroni, 25g light cheese" },
        S: { k: 725, p: 72, c: 67, f: 16, cost: 6.2, what: "75g macaroni, 40g light cheese" },
        X: { k: 880, p: 75, c: 85, f: 23, cost: 6.8, what: "100g macaroni, 50g full-fat tasty" },
      },
      extras: ["Oil spray", "½ tsp garlic powder", "½ tsp paprika", { tiers: "X", text: "50g full-fat tasty cheese, grated, instead of the light cheese (buy separately)" }],
      steps: [
        "Boil the macaroni in salted water for 9 min.",
        "Meanwhile dice the chicken. Pan-fry it on medium-high with oil spray, garlic powder and paprika for 6 min until cooked through.",
        "Take the pan off the heat and toss the chicken through most of the Frank's.",
        "Drain the pasta and return it to the pot on low. Add the evaporated milk and the cheese and stir for 1 min until glossy.",
        "Microwave the broccoli for 3 min. Fold the chicken and broccoli through and finish with the rest of the Frank's.",
      ],
      note: "Evaporated milk is the trick. It makes a creamy sauce that won't split, and the can lives in the pantry. Cook 2 serves and box one for tomorrow.",
    },
    {
      id: "schnitzel", name: "Chicken schnitzel, mash & peas", slots: ["main"], cuisine: "Pub classic", mins: 18, prep: "cook", remake: "YES-style chicken schnitzel",
      core: "180g chicken breast, crumbed",
      t: {
        L: { k: 610, p: 61, c: 49, f: 16, fib: 8, cost: 4.1, what: "100g potato mash" },
        S: { k: 710, p: 64, c: 68, f: 16, fib: 10, cost: 4.45, what: "200g mash + gravy" },
        X: { k: 850, p: 66, c: 82, f: 24, fib: 12, cost: 4.95, what: "300g mash with butter + gravy" },
      },
      extras: ["1 tsp oil + oil spray", "½ tsp paprika, salt and pepper", "Splash of milk for the mash", { tiers: "X", text: "Knob of butter for the mash" }],
      steps: [
        "Slice the breast in half horizontally, or bash it to about 1 cm thick.",
        "Beat the egg in one bowl and mix the panko with the paprika and salt in another. Dip the chicken in the egg, then press it into the crumbs.",
        "Pan-fry in the oil and spray on medium-high for 3 min each side until golden and cooked through (air fryer: 200 °C for 12 min).",
        "Meanwhile prick the potato and microwave it until soft (about 4 min on Light, 6–8 min on Standard and Loaded), then mash it with a fork and the milk (and butter on Loaded).",
        "Microwave the peas for 3 min. On Standard and Loaded, make up the gravy with boiling water.",
      ],
      note: "Crumb 2–3 breasts at once and freeze them raw between baking paper. They go straight from freezer to pan.",
    },
    {
      id: "koreanbeef", name: "Korean beef mince bowl", slots: ["main"], cuisine: "Korean", mins: 10, prep: "quick",
      core: "200g lean beef mince",
      t: {
        L: { k: 635, p: 53, c: 64, f: 18, cost: 7.8, what: "½ rice pouch, less honey" },
        S: { k: 740, p: 61, c: 70, f: 24, cost: 8.45, what: "+ fried egg on top" },
        X: { k: 945, p: 64, c: 113, f: 25, cost: 10.25, what: "Whole pouch + fried egg" },
      },
      extras: ["Oil spray", RICE_REST],
      steps: [
        "Brown the mince in a hot pan for 5 min, breaking it up.",
        "Add the garlic and ginger paste, soy, honey and sesame oil. Cook for 2 min until glossy.",
        "Microwave the rice pouch for 90 sec and the broccoli for 3 min.",
        "On Standard or Loaded, fry the egg in oil spray for 2–3 min. Serve the beef over the rice with the broccoli (and the egg).",
      ],
      note: "4-star mince is cheaper and adds about 60 kcal.",
    },
    {
      id: "bolognese", name: "15-minute bolognese", slots: ["main"], cuisine: "Italian", mins: 15, prep: "cook",
      core: "200g lean beef mince",
      t: {
        L: { k: 625, p: 59, c: 62, f: 14, cost: 6.65, what: "60g spaghetti, 10g parmesan" },
        S: { k: 715, p: 62, c: 79, f: 14, cost: 6.7, what: "85g spaghetti" },
        X: { k: 885, p: 69, c: 97, f: 22, cost: 7.2, what: "110g spaghetti, 20g parmesan, olive oil" },
      },
      extras: ["1 tsp dried Italian herbs", { tiers: "X", text: "1 tsp olive oil" }],
      steps: [
        "Boil the spaghetti in salted water for 10 min.",
        "Meanwhile brown the mince with the garlic paste on high for 5 min.",
        "Add the frozen veg, the passata and the herbs. Simmer for 5 min.",
        "Drain the pasta and toss it through the sauce (with the olive oil on Loaded). Finish with the parmesan.",
      ],
      note: "Double the sauce and freeze half flat in a zip bag. It takes up little freezer space.",
    },
    {
      id: "redcurry", name: "Thai red curry chicken", slots: ["main"], cuisine: "Thai", mins: 12, prep: "quick",
      core: "180g chicken breast",
      t: {
        L: { k: 610, p: 50, c: 55, f: 19, cost: 6, what: "½ rice pouch" },
        S: { k: 710, p: 52, c: 77, f: 20, cost: 6.8, what: "¾ rice pouch" },
        X: { k: 870, p: 54, c: 100, f: 26, cost: 7.65, what: "Whole pouch, extra coconut milk" },
      },
      extras: ["Oil spray", "Water, the same amount as the coconut milk", "Splash of fish sauce (optional)", RICE_REST],
      steps: [
        "Slice the chicken thinly.",
        "Fry the curry paste in oil spray on medium-high for 30 sec until fragrant. Add the chicken and cook for 4 min.",
        "Add the frozen veg, the coconut milk and the same amount of water. Simmer for 4 min.",
        "Microwave the rice pouch for 90 sec. Add a splash of fish sauce to the curry and serve it over the rice.",
      ],
      note: "Ayam Light is still fairly rich (about 170 kcal per 100mL), so it's stretched with water. Freeze the rest of the can in an ice-cube tray.",
    },
    {
      id: "friedrice", name: "No-chop chicken fried rice", slots: ["main"], cuisine: "Chinese", mins: 8, prep: "quick", batch: ["chicken"],
      core: "120g cooked chicken breast + 2 eggs",
      t: {
        L: { k: 695, p: 63, c: 65, f: 18, cost: 6, what: "½ rice pouch, spray oil" },
        S: { k: 840, p: 65, c: 87, f: 24, cost: 6.8, what: "¾ pouch + sesame oil" },
        X: { k: 1015, p: 67, c: 109, f: 33, cost: 7.6, what: "Whole pouch, 2 tsp oil + sesame oil" },
      },
      extras: [{ tiers: "LS", text: "Oil spray" }, { tiers: "X", text: "2 tsp vegetable oil" }, RICE_REST],
      steps: [
        "Heat a large frying pan or wok on high with the oil. Scramble the eggs for 1 min and push them to the side.",
        "Add the frozen peas and the drained corn for 2 min.",
        "Add the rice straight from the pouch and a portion of Sunday chicken, torn up. Break the rice up as it heats.",
        "Add the soy, the oyster sauce and (on Standard and Loaded) the sesame oil. Toss on high for 2 min.",
      ],
    },
    {
      id: "snackplate", name: "Egg & salad snack plate", slots: ["snack"], cuisine: "No-cook", mins: 1, prep: "assemble", batch: ["eggs"],
      core: "2 hard-boiled eggs",
      t: {
        L: { k: 180, p: 16, c: 4, f: 12, cost: 2.45, what: "Eggs, cucumber, cherry tomatoes" },
        S: { k: 250, p: 21, c: 4, f: 17, cost: 2.95, what: "+ 1 light cheese slice" },
        X: { k: 330, p: 29, c: 4, f: 22, cost: 3.75, what: "3 eggs + cheese" },
      },
      extras: ["Salt and pepper"],
      steps: [
        "Peel the boiled eggs from your batch and halve them.",
        "Slice the cucumber and halve the tomatoes.",
        "Plate it all up with the cheese if your portion has it, and season.",
      ],
    },
  ];

  /* Cooked early in the week and reused. item = the catalogue item it's made from; ratio = cooked weight per raw weight. */
  var BATCHES = [
    {
      id: "chicken", name: "Sunday chicken", item: "breast", ratio: 0.75, as: "Sunday chicken, cooked",
      makes: "About 750g cooked from 1kg raw breast: 5 portions of 150g",
      keeps: "3–4 days in the fridge. Freeze the Thursday and Friday portions after cooking and thaw them overnight",
      steps: [
        "Heat the oven to 200 °C and line a tray with baking paper.",
        "Lay out 1kg of chicken breast, spray with oil and season with salt, pepper and paprika or garlic powder.",
        "Bake for 20–25 min until the thickest part is cooked through (no pink, juices run clear).",
        "Rest for 10 min, cool, then slice and split into 5 containers of about 150g.",
        "Fridge three and freeze two.",
      ],
    },
    {
      id: "eggs", name: "Boiled eggs", item: "eggs", ratio: 1, as: "hard-boiled, from your batch",
      makes: "6 hard-boiled eggs",
      keeps: "up to 5 days in the fridge, unpeeled",
      steps: [
        "Bring a saucepan of water to the boil.",
        "Lower in 6 eggs and boil for 9 min.",
        "Move them to cold water for 5 min, then keep them in the fridge unpeeled.",
      ],
    },
  ];

  var api = { MEALS: MEALS, BATCHES: BATCHES };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelMeals = api;
})(this);