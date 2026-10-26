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
        L: { k: 380, p: 29, c: 38, f: 11, cost: 4.75, what: "2 wholemeal slices, 1 light cheese slice" },
        S: { k: 475, p: 35, c: 38, f: 18, cost: 5.15, what: "2 cheese slices + thin butter outside" },
        X: { k: 575, p: 39, c: 60, f: 18, cost: 5.75, what: "Thick sourdough, 2 cheese slices, butter" },
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
        L: { k: 455, p: 36, c: 29, f: 21, cost: 4.85, what: "1 English muffin, no cheese" },
        S: { k: 675, p: 48, c: 56, f: 28, cost: 6.1, what: "2 muffins + 1 light cheese slice" },
        X: { k: 780, p: 54, c: 56, f: 37, cost: 6.95, what: "2 muffins, 2 cheese slices, butter" },
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
        L: { k: 410, p: 37, c: 9, f: 22, fib: 16, cost: 4.6, what: "1 protein wrap, salsa, spinach" },
        S: { k: 475, p: 43, c: 9, f: 27, fib: 16, cost: 5.25, what: "+ 20g light grated cheese" },
        X: { k: 605, p: 52, c: 13, f: 31, fib: 33, cost: 6.55, what: "2 wraps, 30g cheese" },
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
        L: { k: 495, p: 57, c: 50, f: 6, cost: 6.1, what: "⅓ rice pouch, no cheese" },
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
    },
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
    },
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
    },
    {
      id: "koreanbeef", name: "Korean beef mince bowl", slots: ["main"], cuisine: "Korean", mins: 10, prep: "quick",
      core: "200g lean beef mince",
      t: {
        L: { k: 565, p: 52, c: 49, f: 17, cost: 7.3, what: "⅓ rice pouch, less honey" },
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
      note: "Bag up the rest of the fettuccine pack in single portions and freeze it; it cooks from frozen in 3 min.",
    },
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
    },
    {
      id: "friedrice", name: "No-chop chicken fried rice", slots: ["main"], cuisine: "Chinese", mins: 8, prep: "quick", batch: ["chicken"],
      core: "120g cooked chicken breast + 2 eggs",
      t: {
        L: { k: 580, p: 60, c: 43, f: 17, cost: 5.2, what: "⅓ rice pouch, no corn, spray oil" },
        S: { k: 840, p: 65, c: 87, f: 24, cost: 6.8, what: "¾ pouch + sesame oil" },
        X: { k: 1015, p: 67, c: 109, f: 33, cost: 7.6, what: "Whole pouch, 2 tsp oil + sesame oil" },
      },
      extras: [{ tiers: "LS", text: "Oil spray" }, { tiers: "X", text: "2 tsp vegetable oil" }, RICE_REST],
      steps: [
        "Heat a large frying pan or wok on high with the oil. Scramble the eggs for 1 min and push them to the side.",
        "Add the frozen peas, and the drained corn if your portion has it, for 2 min.",
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
      makes: "200g raw breast per 150g tub; cook all the breast you bought (one tray takes up to about 1.5kg)",
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
      id: "bolo", name: "Sunday bolognese sauce", item: "mince", ratio: 0.75, line: "1 tub", as: "Sunday bolognese sauce", with: ["passata", "fzmix", "garlic"],
      makes: "5 tubs of about 450g from 1kg mince, two 700g jars of passata, 500g frozen carrots, peas & corn and 25g garlic paste",
      keeps: "3 days in the fridge or 3 months in the freezer. Thaw a tub overnight in the fridge, or microwave it from frozen",
      steps: [
        "Heat your biggest pot or a deep frying pan on high. Brown all the mince you bought for bolognese (1kg makes 5 tubs) for 8–10 min, breaking it up.",
        "Stir in the garlic paste (5g per tub) and 1 tbsp dried Italian herbs for 1 min.",
        "Add the frozen carrots, peas & corn (100g per tub) and the passata (280g per tub; swirl a splash of water round the jars). Bring to a simmer.",
        "Simmer with the lid ajar on low for 20 min, stirring now and then. Season with salt and pepper.",
        "Cool for 20 min, then split into tubs of about 450g. Fridge the next 2 days' tubs and freeze the rest.",
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
