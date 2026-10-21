/* Coles and Woolworths products for every Shop item, and the shopping maths. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  /* Slack (in the item's unit) for approximate pack weights when an item has packs. */
  var PACK_SLACK = 50;

  /* Old products no longer in ITEMS; keys are Coles ids / Woolworths stockcodes as strings. */
  var RETIRED = {
    coles: {
      "6284567": { name: "Don Leg Ham Shaved 200g", url: "https://www.coles.com.au/product/don-leg-ham-shaved-200g-6284567" },
    },
    woolies: {},
  };

  /* From docs/catalogue-research.md (approved 2026-10-15). */
  var ITEMS = [
    {
      id: "dare", sec: 0, name: "Dare Protein iced coffee", short: "Dare", unit: "bottles", unitSize: 500, note: "Coles had it on special at $3.30 on 2026-10-15. Bulk-buy at half price; keeps unopened at room temperature", same: true,
      per: { k: 296, p: 30 },
      coles: { name: "Dare Protein No Sugar Added Iced Coffee Double Espresso 500mL", url: "https://www.coles.com.au/product/dare-protein-no-sugar-added-iced-coffee-double-espresso-500ml-8991361", size: 1, price: 4.65, checked: "2026-10-15" },
      woolies: { name: "Dare Iced Double Espresso Protein No Added Sugar 500mL", url: "https://www.woolworths.com.au/shop/productdetails/72280/dare-iced-double-espresso-protein-no-added-sugar", stockcode: 72280, size: 1, price: 4.65, checked: "2026-10-15" },
      swaps: [
        { id: "dare-mocha", name: "Dare Protein Mocha 500mL", serves: 1, per: { k: 292, p: 30 },
          woolies: { name: "Dare Protein Mocha Iced Coffee 500mL", url: "https://www.woolworths.com.au/shop/productdetails/6074551", stockcode: 6074551, size: 1, price: 4.65, checked: "2026-10-19" },
          coles: { name: "Dare Protein Mocha Flavoured Milk 500mL", url: "https://www.coles.com.au/product/dare-protein-mocha-flavoured-milk-500ml-1608570", size: 1, price: 4.65, checked: "2026-10-19" } },
        { id: "pauls-dec", name: "Pauls Plus+ Protein Double Espresso Caramel 400mL", serves: 1, per: { k: 270, p: 30 },
          woolies: { name: "Pauls Plus+ Protein Flavoured Milk Double Espresso Caramel 400mL", url: "https://www.woolworths.com.au/shop/productdetails/6049883", stockcode: 6049883, size: 1, price: 4.5, checked: "2026-10-19" },
          coles: { name: "Pauls Plus+ Protein Double Espresso Caramel Milk 400mL", url: "https://www.coles.com.au/product/pauls-plus-protein-double-espresso-caramel-milk-400ml-1439928", size: 1, price: 4.6, checked: "2026-10-19" } },
        { id: "rokeby-de", name: "Rokeby Protein Smoothie Double Espresso 425mL", serves: 1, per: { k: 292, p: 30.2 },
          woolies: { name: "Rokeby Protein Smoothie Double Espresso 425mL", url: "https://www.woolworths.com.au/shop/productdetails/771267", stockcode: 771267, size: 1, price: 5, checked: "2026-10-19" },
          coles: { name: "Rokeby Protein Smoothie Double Espresso 425mL", url: "https://www.coles.com.au/product/rokeby-protein-smoothie-double-espresso-425ml-6258498", size: 1, price: 5, checked: "2026-10-19" } },
        { id: "oak-sc", name: "Oak Plus Protein Salted Caramel 500mL", serves: 1, per: { k: 304, p: 30 },
          woolies: { name: "Oak Plus Protein Salted Caramel Flavoured Milk 500mL", url: "https://www.woolworths.com.au/shop/productdetails/6048422", stockcode: 6048422, size: 1, price: 4.6, checked: "2026-10-19" },
          coles: { name: "Oak Plus Protein Salted Caramel No Added Sugar Milk 500mL", url: "https://www.coles.com.au/product/oak-plus-protein-salted-caramel-no-added-sugar-milk-500ml-1043778", size: 1, price: 4.6, checked: "2026-10-19" } },
        { id: "icebreak", name: "Ice Break Strong Espresso + Protein 500mL", serves: 1, per: { k: 347, p: 30 },
          coles: { name: "Ice Break Iced Coffee Strong Espresso + Protein 500mL", url: "https://www.coles.com.au/product/ice-break-iced-coffee-strong-espresso-protein-500ml-7850783", size: 1, price: 3.95, checked: "2026-10-19" } },
      ],
    },
    {
      id: "grenade", sec: 0, name: "Grenade bar", short: "Grenade", unit: "bars", unitSize: 60, note: "Same bar; Woolworths leaves \"Chocolate Chip\" out of the name. Half price is $2.50, so buy 10+ then", same: true,
      per: { k: 244, p: 20.5 },
      coles: { name: "Grenade Chocolate Chip Salted Caramel Protein Bar 60g", url: "https://www.coles.com.au/product/grenade-chocolate-chip-salted-caramel-protein-bar-60g-9968707", size: 1, price: 5, checked: "2026-10-15" },
      woolies: { name: "Grenade Salted Caramel Protein Bar 60g", url: "https://www.woolworths.com.au/shop/productdetails/6027807/grenade-salted-caramel-protein-bar", stockcode: 6027807, size: 1, price: 5, checked: "2026-10-15" },
      swaps: [
        { id: "gr-oreo", name: "Grenade Oreo 60g", serves: 1, per: { k: 253, p: 20.9 },
          woolies: { name: "Grenade Oreo Milk Chocolate Protein Bar 60g", url: "https://www.woolworths.com.au/shop/productdetails/286090", stockcode: 286090, size: 1, price: 5, checked: "2026-10-19" },
          coles: { name: "Grenade Oreo Milk Chocolate Protein Bar 60g", url: "https://www.coles.com.au/product/grenade-oreo-milk-chocolate-protein-bar-60g-6509780", size: 1, price: 5, checked: "2026-10-19" } },
        { id: "gr-white-oreo", name: "Grenade White Oreo 60g", serves: 1, per: { k: 253, p: 20.7 },
          woolies: { name: "Grenade Protein Bar White Oreo 60g", url: "https://www.woolworths.com.au/shop/productdetails/6028961", stockcode: 6028961, size: 1, price: 5, checked: "2026-10-19" },
          coles: { name: "Grenade Oreo White Chocolate Protein Bar 60g", url: "https://www.coles.com.au/product/grenade-oreo-white-chocolate-protein-bar-60g-9968718", size: 1, price: 5, checked: "2026-10-19" } },
        { id: "gr-cookie", name: "Grenade Choc Chip Cookie Dough 60g", serves: 1, per: { k: 208, p: 21 },
          woolies: { name: "Grenade High Protein Low Sugar Bar Choc Chip Cookie Dough 60g", url: "https://www.woolworths.com.au/shop/productdetails/6043930", stockcode: 6043930, size: 1, price: 5, checked: "2026-10-19" } },
        { id: "mu-vancar", name: "Musashi Protein Crisp Vanilla Caramel 60g", serves: 1, per: { k: 239, p: 20.1 },
          woolies: { name: "Musashi Crisp Protein Bar Vanilla Caramel 60g", url: "https://www.woolworths.com.au/shop/productdetails/153264", stockcode: 153264, size: 1, price: 4.9, checked: "2026-10-19" },
          coles: { name: "Musashi Protein Crisp Bar Vanilla Caramel 60g", url: "https://www.coles.com.au/product/musashi-protein-crisp-bar-vanilla-caramel-60g-4292429", size: 1, price: 4.9, checked: "2026-10-19" } },
        { id: "mu-wcsc", name: "Musashi Protein Crisp White Choc Salted Caramel 60g", serves: 1, per: { k: 256, p: 21.3 },
          woolies: { name: "Musashi Protein Crisp Bar White Choc Salted Caramel 60g", url: "https://www.woolworths.com.au/shop/productdetails/6014680", stockcode: 6014680, size: 1, price: 4.9, checked: "2026-10-19" },
          coles: { name: "Musashi Protein Crisp Bar White Choc Salted Caramel 60g", url: "https://www.coles.com.au/product/musashi-protein-crisp-bar-white-choc-salted-caramel-60g-9958500", size: 1, price: 4.9, checked: "2026-10-19" } },
        { id: "mu-cc", name: "Musashi Protein Crisp White Choc Cookies & Cream 60g", serves: 1, per: { k: 256, p: 20.7 },
          woolies: { name: "Musashi Protein Crisp Bar White Choc Cookies & Cream 60g", url: "https://www.woolworths.com.au/shop/productdetails/555158", stockcode: 555158, size: 1, price: 4.9, checked: "2026-10-19" },
          coles: { name: "Musashi Protein Crisp Bar White Chocolate Cookies and Cream 60g", url: "https://www.coles.com.au/product/musashi-protein-crisp-bar-white-chocolate-cookies-and-cream-60g-7875897", size: 1, price: 4.9, checked: "2026-10-19" } },
        { id: "bsc-cc", name: "BSc High Protein Low Carb Cookies & Cream 60g", serves: 1, per: { k: 207, p: 19.2 },
          coles: { name: "BSc High Protein Low Carb Bar Cookies & Cream 60g", url: "https://www.coles.com.au/product/bsc-high-protein-low-carb-bar-cookies-and-cream-60g-3125148", size: 1, price: 5, checked: "2026-10-19" } },
      ],
    },
    {
      id: "breast", sec: 1, keeps: 3, name: "Chicken breast fillets", unit: "g", note: "Woolworths buys 650g packs, or the 1.5–2.2kg tray when it's cheaper for the week (charged at 2.2kg, the difference refunded)", same: false, approx: true,
      coles: {
        name: "Coles RSPCA Approved Chicken Breast Fillets Large Pack approx. 1.4kg", url: "https://www.coles.com.au/product/coles-rspca-approved-chicken-breast-fillets-large-pack-approx.-1.4kg-2263179", size: 1400, price: 15.4, checked: "2026-10-15",
        packs: [{ name: "Coles RSPCA Approved Chicken Breast Fillets Small Pack approx. 600g", url: "https://www.coles.com.au/product/coles-rspca-approved-chicken-breast-fillets-small-pack-approx.-600g-2263168", size: 600, price: 8.7, checked: "2026-10-15" }],
      },
      woolies: {
        name: "Woolworths RSPCA Approved Chicken Breast Fillets 650g", url: "https://www.woolworths.com.au/shop/productdetails/6078624/woolworths-rspca-approved-chicken-breast-fillets", stockcode: 6078624, size: 650, price: 9.4, checked: "2026-10-15",
        packs: [{ name: "Woolworths RSPCA Approved Chicken Breast Fillet 1.5kg - 2.2kg", url: "https://www.woolworths.com.au/shop/productdetails/969723/woolworths-rspca-approved-chicken-breast-fillet", stockcode: 969723, size: 1500, sizeLabel: "1.5–2.2kg tray", price: 24.2, checked: "2026-10-18" }],
      },
    },
    {
      id: "mince", sec: 1, keeps: 3, name: "Extra lean beef mince", unit: "g", note: "Woolworths special (usually $10.00)", same: false,
      coles: { name: "Coles No Added Hormone Beef Extra Lean Mince 500g", url: "https://www.coles.com.au/product/coles-no-added-hormone-beef-extra-lean-mince-500g-8112799", size: 500, price: 9.8, checked: "2026-10-15" },
      woolies: { name: "Woolworths Heart Smart Extra Lean Beef Mince 500g", url: "https://www.woolworths.com.au/shop/productdetails/577860/woolworths-heart-smart-extra-lean-beef-mince", stockcode: 577860, size: 500, price: 9.8, checked: "2026-10-15" },
    },
    {
      id: "thigh", sec: 1, keeps: 3, name: "Chicken thigh fillets", unit: "g", note: "Teriyaki week only", same: false, approx: true,
      coles: {
        name: "Coles RSPCA Approved Chicken Thigh Fillets Large Pack approx. 1.2kg", url: "https://www.coles.com.au/product/coles-rspca-approved-chicken-thigh-fillets-large-pack-approx.-1.2kg-2263328", size: 1200, price: 17.4, checked: "2026-10-15",
        packs: [{ name: "Coles RSPCA Chicken Thigh Fillets Small Pack approx. 700g", url: "https://www.coles.com.au/product/coles-rspca-chicken-thigh-fillets-small-pack-approx.-700g-2263317", size: 700, price: 12.6, checked: "2026-10-15" }],
      },
      woolies: {
        name: "Woolworths RSPCA Approved Chicken Thigh Fillets 550g", url: "https://www.woolworths.com.au/shop/productdetails/6078660/woolworths-rspca-approved-chicken-thigh-fillets", stockcode: 6078660, size: 550, price: 9.9, checked: "2026-10-15",
        packs: [{ name: "Woolworths RSPCA Approved Chicken Thigh Fillets Skinless 1.2kg - 1.8kg", url: "https://www.woolworths.com.au/shop/productdetails/727622/woolworths-rspca-approved-chicken-thigh-fillets-skinless", stockcode: 727622, size: 1200, sizeLabel: "1.2–1.8kg tray", price: 26.1, checked: "2026-10-18" }],
      },
    },
    {
      id: "eggs", sec: 1, keeps: 28, name: "Free range eggs, 12 pack", short: "Eggs", unit: "eggs", unitSize: 58, note: "The old Woolworths link (582362) is unavailable; 6013278 replaces it", same: false,
      coles: {
        name: "Coles Free Range Eggs 12 Pack 700g", url: "https://www.coles.com.au/product/coles-free-range-eggs-12-pack-700g-9453478", size: 12, price: 6.9, checked: "2026-10-15",
        packs: [
          { name: "Sunny Queen Free Range X Large Eggs 6 Pack 350g", url: "https://www.coles.com.au/product/sunny-queen-free-range-x-large-eggs-6-pack-350g-5484210", size: 6, price: 5.2, checked: "2026-10-21" },
          { name: "Sunny Queen Free Range X-large Eggs 30 Pack 1.75kg", url: "https://www.coles.com.au/product/sunny-queen-free-range-x-large-eggs-30-pack-1.75kg-5341257", size: 30, price: 17, checked: "2026-10-21" },
        ],
      },
      woolies: {
        name: "Woolworths 12 Pack Extra Large Free Range Eggs 700g", url: "https://www.woolworths.com.au/shop/productdetails/6013278/woolworths-12-pack-extra-large-free-range-eggs", stockcode: 6013278, size: 12, price: 6.7, checked: "2026-10-15",
        packs: [{ name: "Woolworths 6 Pack Extra Large Free Range Eggs 350g", url: "https://www.woolworths.com.au/shop/productdetails/133245/woolworths-6-pack-extra-large-free-range-eggs", stockcode: 133245, size: 6, price: 4.9, checked: "2026-10-20" }],
      },
    },
    {
      id: "ham", sec: 1, keeps: 5, name: "Shaved ham", short: "Ham", unit: "g", note: "Coles doesn't sell deli ham by weight online, so a 250g pack instead", same: false,
      coles: { name: "The Deli Shaved Leg Ham 250g", url: "https://www.coles.com.au/product/the-deli-shaved-leg-ham-250g-1476946", size: 250, price: 6, checked: "2026-10-18" },
      woolies: { name: "D'Orsogna Ham Leg Triple Smoked 97% Fat Free Shaved From The Deli", url: "https://www.woolworths.com.au/shop/productdetails/175734/d-orsogna-ham-leg-triple-smoked-97-fat-free-shaved-from-the-deli", stockcode: 175734, perKg: true, size: 1, price: 28, checked: "2026-10-15" },
    },
    {
      id: "yog", sec: 1, keeps: 14, name: "Greek yoghurt, natural light", short: "Yoghurt", unit: "g", note: "Coles shows it as currently unavailable", same: true,
      coles: { name: "Chobani Greek Yogurt Natural Light 907g", url: "https://www.coles.com.au/product/chobani-greek-yogurt-natural-light-907g-1435100", size: 907, price: 8.8, checked: "2026-10-15" },
      woolies: {
        name: "Chobani Greek Yoghurt Natural Light Plain 907g", url: "https://www.woolworths.com.au/shop/productdetails/717518/chobani-greek-yoghurt-natural-light-plain", stockcode: 717518, size: 907, price: 8.8, checked: "2026-10-15",
        packs: [{ name: "Chobani Greek Yoghurt Natural Light 500g", url: "https://www.woolworths.com.au/shop/productdetails/6093769/chobani-greek-yoghurt-natural-light", stockcode: 6093769, size: 500, price: 6.5, checked: "2026-10-20" }],
      },
    },
    {
      id: "cheese", sec: 1, keeps: 21, name: "Light tasty shredded cheese", short: "Cheese", unit: "g", note: "Keeps for weeks in the fridge", same: false,
      coles: { name: "Coles Cheese Shredded Tasty Light 700g", url: "https://www.coles.com.au/product/coles-cheese-shredded-tasty-light-700g-8145346", size: 700, price: 9.5, checked: "2026-10-20" },
      woolies: {
        name: "Woolworths Light Tasty Shredded Cheese 500g", url: "https://www.woolworths.com.au/shop/productdetails/729008/woolworths-light-tasty-shredded-cheese", stockcode: 729008, size: 500, price: 8.3, checked: "2026-10-15",
        packs: [{ name: "Woolworths Light Tasty Cheese Shredded 250g", url: "https://www.woolworths.com.au/shop/productdetails/728984/woolworths-light-tasty-cheese-shredded", stockcode: 728984, size: 250, price: 5, checked: "2026-10-20" }],
      },
    },
    {
      id: "wraps", sec: 1, keeps: 14, name: "Mission Carb Balance wraps", short: "Wrap", unit: "wraps", unitSize: 48, note: "Coles lists the 6 pack (8566038) but as unavailable with no price. Woolworths special (usually $6.60). Freeze half", same: false,
      coles: null,
      woolies: { name: "Mission Carb Balance Original Wraps 6 pack", url: "https://www.woolworths.com.au/shop/productdetails/919345/mission-carb-balance-original-wraps", stockcode: 919345, size: 6, price: 5.6, checked: "2026-10-15" },
    },
    {
      id: "bread", sec: 1, keeps: 5, name: "Wholemeal sandwich loaf", short: "Bread", unit: "slices", unitSize: 45, note: "About 16 slices. Freeze half", same: true,
      coles: { name: "Abbott's Bakery Farmhouse Wholemeal Bread 750g", url: "https://www.coles.com.au/product/abbott's-bakery-farmhouse-wholemeal-bread-750g-7226034", size: 16, price: 5.2, checked: "2026-10-15" },
      woolies: { name: "Abbott's Bakery Farmhouse Wholemeal Bread Sandwich Slice Loaf 750g", url: "https://www.woolworths.com.au/shop/productdetails/331591/abbott-s-bakery-farmhouse-wholemeal-bread-sandwich-slice-loaf", stockcode: 331591, size: 16, price: 5.2, checked: "2026-10-15" },
    },
    {
      id: "muffin", sec: 1, keeps: 5, name: "English muffins", short: "Muffin", unit: "muffins", unitSize: 67, note: "The old Woolworths link (6083082) is unavailable", same: true,
      coles: { name: "Tip Top Muffins English 6 pack (400g)", url: "https://www.coles.com.au/product/tip-top-muffins-english-400g-332394", size: 6, price: 6.6, checked: "2026-10-15" },
      woolies: { name: "Tip Top English Muffins Original 6 pack", url: "https://www.woolworths.com.au/shop/productdetails/46795/tip-top-english-muffins-original-bakery", stockcode: 46795, size: 6, price: 6.8, checked: "2026-10-15" },
    },
    {
      id: "spinach", sec: 1, keeps: 4, name: "Baby spinach", unit: "g", note: "The old link was the 280g bag", same: false,
      coles: {
        name: "Coles Baby Spinach 120g", url: "https://www.coles.com.au/product/coles-baby-spinach-120g-1499340", size: 120, price: 3, checked: "2026-10-20",
        packs: [{ name: "Coles Baby Spinach 60g", url: "https://www.coles.com.au/product/coles-baby-spinach-60g-1499486", size: 60, price: 2.2, checked: "2026-10-20" }],
      },
      woolies: {
        name: "Woolworths Baby Leaf Spinach 120g", url: "https://www.woolworths.com.au/shop/productdetails/524322/woolworths-baby-leaf-spinach", stockcode: 524322, size: 120, price: 3.3, checked: "2026-10-15",
        packs: [
          { name: "Woolworths Baby Leaf Spinach 60g", url: "https://www.woolworths.com.au/shop/productdetails/379515/woolworths-baby-leaf-spinach", stockcode: 379515, size: 60, price: 2.2, checked: "2026-10-20" },
          { name: "Woolworths Baby Leaf Spinach 280g", url: "https://www.woolworths.com.au/shop/productdetails/524336/woolworths-baby-leaf-spinach-spinach", stockcode: 524336, size: 280, price: 5, checked: "2026-10-20" },
        ],
      },
    },
    {
      id: "toms", sec: 1, keeps: 7, name: "Cherry tomatoes", unit: "g", note: "Coles shows the 250g punnet as currently unavailable", same: false,
      coles: { name: "Coles Cherry Tomatoes 250g", url: "https://www.coles.com.au/product/coles-cherry-tomatoes-250g-4834736", size: 250, price: 3, checked: "2026-10-20" },
      woolies: { name: "Woolworths Cherry Tomatoes Punnet 250g", url: "https://www.woolworths.com.au/shop/productdetails/149620/woolworths-cherry-tomatoes-punnet", stockcode: 149620, size: 250, price: 3.5, checked: "2026-10-15" },
    },
    {
      id: "cucumber", sec: 1, keeps: 7, name: "Lebanese cucumber", unit: "cucumbers", unitSize: 160, note: "", same: false,
      coles: { name: "Coles Lebanese Cucumbers, each (approx. 160g)", url: "https://www.coles.com.au/product/coles-lebanese-cucumbers-approx.-160g-4575208", size: 1, price: 1.42, checked: "2026-10-15" },
      woolies: { name: "Lebanese Cucumbers, each", url: "https://www.woolworths.com.au/shop/productdetails/137130/lebanese-cucumbers", stockcode: 137130, size: 1, price: 1.6, checked: "2026-10-15" },
    },
    {
      id: "capsicum", sec: 1, keeps: 7, name: "Green capsicum", unit: "capsicums", unitSize: 220, note: "", same: false,
      coles: { name: "Coles Capsicum Green Loose, each (approx. 220g)", url: "https://www.coles.com.au/product/coles-capsicum-green-loose-approx.-220g-7214862", size: 1, price: 1.74, checked: "2026-10-15" },
      woolies: { name: "Woolworths Capsicum Green, each", url: "https://www.woolworths.com.au/shop/productdetails/135156/woolworths-capsicum-green", stockcode: 135156, size: 1, price: 1.48, checked: "2026-10-15" },
    },
    {
      id: "rice", sec: 2, name: "Microwave rice pouch", unit: "pouches", unitSize: 250, note: "Often $2.50 on special", same: true,
      coles: { name: "Sunrice Microwave Long Grain Rice Pouch 250g", url: "https://www.coles.com.au/product/sunrice-microwave-long-grain-rice-pouch-250g-4854391", size: 1, price: 3, checked: "2026-10-15" },
      woolies: { name: "Sunrice Microwave White Long Grain Rice Pouch 250g", url: "https://www.woolworths.com.au/shop/productdetails/244755/sunrice-microwave-white-long-grain-rice-pouch", stockcode: 244755, size: 1, price: 3, checked: "2026-10-15" },
    },
    {
      id: "spaghetti", sec: 2, name: "Spaghetti", unit: "g", note: "Woolworths special (usually $2.95)", same: true,
      coles: { name: "San Remo Spaghetti No 5 500g", url: "https://www.coles.com.au/product/san-remo-spaghetti-no-5-500g-206196", size: 500, price: 2.95, checked: "2026-10-15" },
      woolies: { name: "San Remo Spaghetti Pasta No 5 500g", url: "https://www.woolworths.com.au/shop/productdetails/43974/san-remo-spaghetti-pasta-no-5", stockcode: 43974, size: 500, price: 2.3, checked: "2026-10-15" },
    },
    {
      id: "macaroni", sec: 2, name: "Macaroni", unit: "g", note: "Coles doesn't list San Remo macaroni. Woolworths special (usually $2.95)", same: false,
      coles: { name: "Coles Durum Wheat Pasta Macaroni 500g", url: "https://www.coles.com.au/product/coles-durum-wheat-pasta-macaroni-500g-3329137", size: 500, price: 1, checked: "2026-10-15" },
      woolies: { name: "San Remo Macaroni Pasta No 38 500g", url: "https://www.woolworths.com.au/shop/productdetails/44025/san-remo-macaroni-pasta-no-38", stockcode: 44025, size: 500, price: 2.3, checked: "2026-10-15" },
    },
    {
      id: "potato", sec: 2, keeps: 21, name: "Washed potatoes", short: "Potatoes", unit: "g", note: "", same: false,
      coles: {
        name: "Coles Potatoes Washed 2kg", url: "https://www.coles.com.au/product/coles-potatoes-washed-2kg-1206748", size: 2000, price: 6, checked: "2026-10-15",
        packs: [{ name: "Coles Baby Washed Potatoes 1Kg", url: "https://www.coles.com.au/product/coles-baby-washed-potatoes-1kg-2488485", size: 1000, price: 4.5, checked: "2026-10-20" }],
      },
      woolies: {
        name: "Woolworths Washed Potatoes Bag 2kg", url: "https://www.woolworths.com.au/shop/productdetails/262783/woolworths-washed-potatoes-bag", stockcode: 262783, size: 2000, price: 6.5, checked: "2026-10-15",
        packs: [{ name: "Woolworths White Washed Baby Potatoes Bag 1kg", url: "https://www.woolworths.com.au/shop/productdetails/385085/woolworths-white-washed-baby-potatoes-bag", stockcode: 385085, size: 1000, price: 4.8, checked: "2026-10-20" }],
      },
    },
    {
      id: "corn", sec: 2, name: "Corn kernels", unit: "g", note: "Lives in the pantry", same: true,
      coles: { name: "Edgell Corn Kernels 420g", url: "https://www.coles.com.au/product/edgell-corn-kernels-420g-132045", size: 420, price: 2.2, checked: "2026-10-15" },
      woolies: { name: "Edgell Corn Kernels 420g", url: "https://www.woolworths.com.au/shop/productdetails/34437/edgell-corn-kernels", stockcode: 34437, size: 420, price: 2.2, checked: "2026-10-15" },
    },
    {
      id: "fzpeas", sec: 2, name: "Frozen peas", unit: "g", note: "", same: false,
      coles: { name: "Coles Frozen Garden Peas 1kg", url: "https://www.coles.com.au/product/coles-frozen-garden-peas-1kg-9054790", size: 1000, price: 4.5, checked: "2026-10-15" },
      woolies: {
        name: "Woolworths Frozen Australian Peas 1kg", url: "https://www.woolworths.com.au/shop/productdetails/754169/woolworths-frozen-australian-peas", stockcode: 754169, size: 1000, price: 4.5, checked: "2026-10-15",
        packs: [{ name: "Woolworths Peas 500g", url: "https://www.woolworths.com.au/shop/productdetails/754170/woolworths-peas", stockcode: 754170, size: 500, price: 2.75, checked: "2026-10-20" }],
      },
    },
    {
      id: "fzmix", sec: 2, name: "Frozen carrots, peas & corn", unit: "g", note: "", same: false,
      coles: { name: "Coles Frozen Carrot Corn & Peas 1kg", url: "https://www.coles.com.au/product/coles-frozen-carrot-corn-and-peas-1kg-7644872", size: 1000, price: 4.2, checked: "2026-10-15" },
      woolies: { name: "Woolworths Frozen Australian Carrots Peas & Corn 1kg", url: "https://www.woolworths.com.au/shop/productdetails/768569/woolworths-frozen-australian-carrots-peas-corn", stockcode: 768569, size: 1000, price: 5.5, checked: "2026-10-15" },
    },
    {
      id: "fzbroc", sec: 2, name: "Frozen broccoli", unit: "g", note: "", same: false,
      coles: { name: "Coles Frozen Broccoli Florets 500g", url: "https://www.coles.com.au/product/coles-frozen-broccoli-florets-500g-5341010", size: 500, price: 4, checked: "2026-10-15" },
      woolies: { name: "Woolworths Frozen Australian Broccoli Florets 500g", url: "https://www.woolworths.com.au/shop/productdetails/768559/woolworths-frozen-australian-broccoli-florets", stockcode: 768559, size: 500, price: 4, checked: "2026-10-15" },
    },
    {
      id: "fzasian", sec: 2, name: "Frozen stir-fry veg", unit: "g", note: "Coles doesn't list Birds Eye Oriental", same: false,
      coles: { name: "Coles Frozen Stir Fry Vegetables 500g", url: "https://www.coles.com.au/product/coles-frozen-stir-fry-vegetables-500g-7645092", size: 500, price: 2.5, checked: "2026-10-15" },
      woolies: { name: "Birds Eye Frozen Stir Fry Oriental Style 850g", url: "https://www.woolworths.com.au/shop/productdetails/768622/birds-eye-frozen-stir-fry-oriental-style", stockcode: 768622, size: 850, price: 6.2, checked: "2026-10-15" },
    },
    {
      id: "fzberry", sec: 2, name: "Frozen mixed berries", unit: "g", note: "", same: false,
      coles: { name: "Coles Frozen Mixed Berries 500g", url: "https://www.coles.com.au/product/coles-frozen-mixed-berries-500g-1301206", size: 500, price: 7, checked: "2026-10-15" },
      woolies: { name: "Woolworths Frozen Mixed Berries 500g", url: "https://www.woolworths.com.au/shop/productdetails/260010/woolworths-frozen-mixed-berries", stockcode: 260010, size: 500, price: 7, checked: "2026-10-15" },
    },
    {
      id: "evap", sec: 2, name: "Light evaporated milk", unit: "mL", note: "In the baking aisle next to the condensed milk", same: true,
      coles: { name: "Nestle Carnation Light & Creamy Evaporated Milk 340mL", url: "https://www.coles.com.au/product/nestle-carnation-light-and-creamy-evaporated-milk-340ml-3964510", size: 340, price: 3.45, checked: "2026-10-15" },
      woolies: { name: "Nestle Carnation Light & Creamy Evaporated Milk 340mL", url: "https://www.woolworths.com.au/shop/productdetails/151917/nestle-carnation-light-creamy-evaporated-milk", stockcode: 151917, size: 340, price: 3.45, checked: "2026-10-15" },
    },
    {
      id: "coco", sec: 2, name: "Light coconut milk", unit: "mL", note: "Use 70mL per curry and freeze the rest", same: true,
      coles: { name: "Ayam 100% Natural Light Coconut Milk 270mL", url: "https://www.coles.com.au/product/ayam-100percent-natural-light-coconut-milk-270ml-9124341", size: 270, price: 4, checked: "2026-10-15" },
      woolies: { name: "Ayam 100% Natural Light Coconut Milk 270mL", url: "https://www.woolworths.com.au/shop/productdetails/180429/ayam-100-natural-light-coconut-milk", stockcode: 180429, size: 270, price: 4, checked: "2026-10-15" },
    },
    {
      id: "curry", sec: 2, name: "Red curry paste", unit: "g", note: "Coles doesn't list Maesri. In the Asian aisle", same: false,
      coles: { name: "Ayam Thai Red Curry Paste 195g", url: "https://www.coles.com.au/product/ayam-thai-red-curry-paste-195g-6801057", size: 195, price: 4, checked: "2026-10-15" },
      woolies: { name: "Maesri Paste Red Curry 114g", url: "https://www.woolworths.com.au/shop/productdetails/45458/maesri-paste-red-curry", stockcode: 45458, size: 114, price: 2.3, checked: "2026-10-15" },
    },
    {
      id: "soy", sec: 2, name: "Soy sauce", unit: "mL", note: "Woolworths special (usually $4.30)", same: true,
      coles: { name: "Lee Kum Kee Soy Sauce 500mL", url: "https://www.coles.com.au/product/lee-kum-kee-soy-sauce-500ml-9434699", size: 500, price: 4.3, checked: "2026-10-15" },
      woolies: { name: "Lee Kum Kee Soy Sauce Premium 500mL", url: "https://www.woolworths.com.au/shop/productdetails/198763/lee-kum-kee-soy-sauce-premium", stockcode: 198763, size: 500, price: 3.7, checked: "2026-10-15" },
    },
    {
      id: "parm", sec: 2, name: "Grated parmesan", unit: "g", note: "The old 100g Woolworths link is unavailable", same: true,
      coles: { name: "Perfect Italiano Cheese Grated Parmesan 125g", url: "https://www.coles.com.au/product/perfect-italiano-cheese-grated-parmesan-125g-5339878", size: 125, price: 4.5, checked: "2026-10-15" },
      woolies: { name: "Perfect Italiano Parmesan Cheese Grated Parmesan 125g", url: "https://www.woolworths.com.au/shop/productdetails/42161/perfect-italiano-parmesan-cheese-grated-parmesan", stockcode: 42161, size: 125, price: 4.5, checked: "2026-10-15" },
    },
    {
      id: "passata", sec: 2, name: "Passata", unit: "g", note: "Woolworths special (usually $4.80)", same: true,
      coles: {
        name: "Mutti Passata Tomato Puree 700g", url: "https://www.coles.com.au/product/mutti-passata-tomato-puree-700g-1809266", size: 700, price: 4.8, checked: "2026-10-15",
        packs: [{ name: "Mutti Tomato Passata 400g", url: "https://www.coles.com.au/product/mutti-tomato-passata-400g-2349503", size: 400, price: 3.7, checked: "2026-10-20" }],
      },
      woolies: {
        name: "Mutti Passata Tomato Puree 700g", url: "https://www.woolworths.com.au/shop/productdetails/795297/mutti-passata-tomato-puree", stockcode: 795297, size: 700, price: 3.8, checked: "2026-10-15",
        packs: [{ name: "Mutti Passata Tomato Puree 400g", url: "https://www.woolworths.com.au/shop/productdetails/290301/mutti-passata-tomato-puree", stockcode: 290301, size: 400, price: 3.7, checked: "2026-10-20" }],
      },
    },
    {
      id: "panko", sec: 2, name: "Panko breadcrumbs", unit: "g", note: "The old Crumbed & Co link is unavailable", same: false,
      coles: { name: "Coles Australian Panko Crumb 220g", url: "https://www.coles.com.au/product/coles-australian-panko-crumb-220g-4324875", size: 220, price: 2.3, checked: "2026-10-15" },
      woolies: { name: "Woolworths Panko Bread Crumbs 220g", url: "https://www.woolworths.com.au/shop/productdetails/83295/woolworths-panko-bread-crumbs", stockcode: 83295, size: 220, price: 2.3, checked: "2026-10-15" },
    },
    {
      id: "teriyaki_sauce", sec: 2, name: "Teriyaki sauce", unit: "mL", note: "Coles doesn't list the marinade; its 240g bottle is counted as 240mL", same: false,
      coles: { name: "Kikkoman Gluten Free Sauce Thick Teriyaki 240g", url: "https://www.coles.com.au/product/kikkoman-gluten-free-sauce-thick-teriyaki-240g-5007594", size: 240, price: 3.4, checked: "2026-10-15" },
      woolies: { name: "Kikkoman Marinade Teriyaki 250mL", url: "https://www.woolworths.com.au/shop/productdetails/33948/kikkoman-marinade-teriyaki", stockcode: 33948, size: 250, price: 4, checked: "2026-10-15" },
    },
    {
      id: "oyster", sec: 2, name: "Oyster sauce", unit: "g", note: "Smaller bottle than the old 907g link", same: true,
      coles: { name: "Lee Kum Kee Panda Brand Oyster Sauce 255g", url: "https://www.coles.com.au/product/lee-kum-kee-panda-brand-oyster-sauce-255g-5873664", size: 255, price: 3.65, checked: "2026-10-15" },
      woolies: { name: "Lee Kum Kee Panda Brand Oyster Sauce 255g", url: "https://www.woolworths.com.au/shop/productdetails/65404/lee-kum-kee-panda-brand-oyster-sauce", stockcode: 65404, size: 255, price: 3.65, checked: "2026-10-15" },
    },
    {
      id: "franks", sec: 2, name: "Frank's RedHot", unit: "mL", note: "", same: true,
      coles: { name: "Frank's Redhot Original Sauce 148mL", url: "https://www.coles.com.au/product/frank's-redhot-original-sauce-148ml-1957139", size: 148, price: 4.1, checked: "2026-10-15" },
      woolies: { name: "Frank's RedHot Original Cayenne Pepper Hot Sauce 148mL", url: "https://www.woolworths.com.au/shop/productdetails/759137/frank-s-redhot-original-cayenne-pepper-hot-sauce", stockcode: 759137, size: 148, price: 4.1, checked: "2026-10-15" },
    },
    {
      id: "salsa", sec: 2, name: "Mild salsa", unit: "g", note: "Woolworths special (usually $6.50)", same: true,
      coles: { name: "Old El Paso Thick N Chunky Mild Salsa 395g", url: "https://www.coles.com.au/product/old-el-paso-thick-n-chunky-mild-salsa-395g-1712437", size: 395, price: 6.5, checked: "2026-10-15" },
      woolies: { name: "Old El Paso Thick N Chunky Salsa Mild 395g", url: "https://www.woolworths.com.au/shop/productdetails/6059611/old-el-paso-thick-n-chunky-salsa-mild", stockcode: 6059611, size: 395, price: 5.5, checked: "2026-10-15" },
    },
    {
      id: "taco", sec: 2, name: "Taco spice mix", unit: "g", note: "Coles had it on special at $2.50 on 2026-10-15", same: true,
      coles: { name: "Old El Paso Spice Mix For Tacos Mild 30g", url: "https://www.coles.com.au/product/old-el-paso-spice-mix-for-tacos-mild-30g-291377", size: 30, price: 3, checked: "2026-10-15" },
      woolies: { name: "Old El Paso Taco Spice Mix 30g", url: "https://www.woolworths.com.au/shop/productdetails/93444/old-el-paso-taco-spice-mix-taco-spice-mix", stockcode: 93444, size: 30, price: 3, checked: "2026-10-15" },
    },
    {
      id: "garlic", sec: 2, name: "Garlic paste", unit: "g", note: "Woolworths Garlic Paste (the old link) is unavailable", same: true,
      coles: { name: "Gourmet Garden Garlic Cold Blended Paste 80g", url: "https://www.coles.com.au/product/gourmet-garden-garlic-cold-blended-paste-80g-3022167", size: 80, price: 4.2, checked: "2026-10-15" },
      woolies: { name: "Gourmet Garden Cold Blend Pastes Garlic 80g", url: "https://www.woolworths.com.au/shop/productdetails/948491/gourmet-garden-cold-blend-pastes-garlic", stockcode: 948491, size: 80, price: 4.2, checked: "2026-10-15" },
    },
    {
      id: "ginger", sec: 2, name: "Ginger paste", unit: "g", note: "", same: true,
      coles: { name: "Gourmet Garden Ginger Cold Blended Paste 80g", url: "https://www.coles.com.au/product/gourmet-garden-ginger-cold-blended-paste-80g-3023206", size: 80, price: 4.2, checked: "2026-10-15" },
      woolies: { name: "Gourmet Garden Paste Ginger 80g", url: "https://www.woolworths.com.au/shop/productdetails/948511/gourmet-garden-paste-ginger", stockcode: 948511, size: 80, price: 4.2, checked: "2026-10-15" },
    },
    {
      id: "sesame", sec: 2, name: "Sesame oil", unit: "mL", note: "Coles had it on special at $4.00 on 2026-10-15", same: true,
      coles: { name: "Yeo's Sesame Oil 150mL", url: "https://www.coles.com.au/product/yeo's-sesame-oil-150ml-5077283", size: 150, price: 5, checked: "2026-10-15" },
      woolies: { name: "Yeo's Ingredients Sesame Oil 150mL", url: "https://www.woolworths.com.au/shop/productdetails/39319/yeo-s-ingredients-sesame-oil", stockcode: 39319, size: 150, price: 5, checked: "2026-10-15" },
    },
    {
      id: "gravy", sec: 2, name: "Gravy mix", unit: "g", note: "", same: true,
      coles: { name: "Gravox Traditional Gravy Mix 425g", url: "https://www.coles.com.au/product/gravox-traditional-gravy-mix-425g-121151", size: 425, price: 5.6, checked: "2026-10-15" },
      woolies: { name: "Gravox Traditional Gravy Mix 425g", url: "https://www.woolworths.com.au/shop/productdetails/38723/gravox-traditional-gravy-mix-traditional", stockcode: 38723, size: 425, price: 5.6, checked: "2026-10-15" },
    },
    {
      id: "honey", sec: 2, name: "Honey squeeze", unit: "g", note: "The old 1kg Woolworths link is unavailable", same: false,
      coles: { name: "Coles Simply Pure Honey Squeeze 400g", url: "https://www.coles.com.au/product/coles-simply-pure-honey-squeeze-400g-1809867", size: 400, price: 4.4, checked: "2026-10-15" },
      woolies: { name: "Woolworths Pure Honey Twist & Squeeze 375g", url: "https://www.woolworths.com.au/shop/productdetails/753976/woolworths-pure-honey-twist-squeeze", stockcode: 753976, size: 375, price: 5.5, checked: "2026-10-15" },
    },
    {
      id: "muesli", sec: 2, name: "Natural muesli", unit: "g", note: "", same: true,
      coles: { name: "Uncle Tobys Natural Style Muesli 1kg", url: "https://www.coles.com.au/product/uncle-tobys-natural-style-muesli-1kg-132748", size: 1000, price: 8, checked: "2026-10-15" },
      woolies: { name: "Uncle Tobys Natural Style Swiss Blend Muesli 1kg", url: "https://www.woolworths.com.au/shop/productdetails/36370/uncle-tobys-natural-style-swiss-blend-muesli-breakfast-cereal", stockcode: 36370, size: 1000, price: 8, checked: "2026-10-15" },
    },
    {
      id: "pb", sec: 2, name: "Smooth peanut butter", unit: "g", note: "Coles had it half price at $3.45 on 2026-10-15. Loaded yoghurt bowl only", same: true,
      coles: { name: "Bega Peanut Butter Smooth 470g", url: "https://www.coles.com.au/product/bega-peanut-butter-smooth-470g-5398753", size: 470, price: 6.9, checked: "2026-10-15" },
      woolies: { name: "Bega Peanut Butter Smooth 470g", url: "https://www.woolworths.com.au/shop/productdetails/98046/bega-peanut-butter-smooth", stockcode: 98046, size: 470, price: 6.9, checked: "2026-10-15" },
    },
  ];
  var AMOUNTS = {
    toasty: { bread: { L: 2, S: 2, X: 0 }, ham: 100, cheese: { L: 20, S: 40, X: 40 }, spinach: 20, toms: 50 },
    eggmuffin: { eggs: 3, ham: 50, muffin: { L: 1, S: 2, X: 2 }, cheese: { L: 0, S: 20, X: 40 }, spinach: 20 },
    yogbowl: { yog: 250, fzberry: 100, honey: 7, muesli: { L: 0, S: 40, X: 60 }, pb: { L: 0, S: 0, X: 16 } },
    brekwrap: { eggs: 3, ham: 50, wraps: { L: 1, S: 1, X: 2 }, cheese: { L: 0, S: 20, X: 30 }, salsa: 30, spinach: 20 },
    tenderwrap: { breast: 200, wraps: { L: 1, S: 2, X: 2 }, cheese: { L: 20, S: 30, X: 50 }, salsa: 30, spinach: 20, cucumber: 0.5, toms: 50 },
    burritobowl: { rice: { L: 1 / 3, S: 0.75, X: 1 }, breast: 200, corn: 80, capsicum: 0.5, salsa: 30, taco: 4, yog: 50, cheese: { L: 0, S: 30, X: 30 } },
    teriyaki: { thigh: 200, teriyaki_sauce: 50, rice: { L: 1 / 3, S: 0.75, X: 1 }, fzasian: 150 },
    buffalomac: { breast: 180, macaroni: { L: 35, S: 75, X: 100 }, evap: 80, cheese: { L: 25, S: 40, X: 0 }, franks: 50, fzbroc: 100 },
    schnitzel: { breast: 180, eggs: 1, panko: 30, potato: { L: 50, S: 200, X: 300 }, fzpeas: 120, gravy: { L: 0, S: 10, X: 10 } },
    koreanbeef: { mince: 200, soy: 40, honey: { L: 14, S: 21, X: 21 }, sesame: 5, garlic: 5, ginger: 5, rice: { L: 1 / 3, S: 0.5, X: 1 }, eggs: { L: 0, S: 1, X: 1 }, fzbroc: 150 },
    bolognese: { mince: 200, spaghetti: { L: 40, S: 85, X: 110 }, passata: 200, fzmix: 100, garlic: 5, parm: { L: 10, S: 10, X: 20 } },
    redcurry: { breast: 180, curry: 15, coco: { L: 70, S: 70, X: 100 }, fzasian: 150, rice: { L: 1 / 3, S: 0.75, X: 1 } },
    friedrice: { breast: 160, eggs: 2, rice: { L: 1 / 3, S: 0.75, X: 1 }, fzpeas: 60, corn: { L: 0, S: 60, X: 60 }, soy: 40, oyster: 20, sesame: { L: 0, S: 5, X: 5 } },
    snackplate: { eggs: { L: 2, S: 2, X: 3 }, cucumber: 0.5, toms: 50, cheese: { L: 0, S: 20, X: 20 } },
  };

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  /* Deli counters sell by 100 g, minimum 100 g. Round up so the owner never runs short. */
  function deliGrams(needGrams) {
    return Math.max(100, Math.ceil(needGrams / 100) * 100);
  }

  function packLabel(product, unit) {
    if (product.sizeLabel) return product.sizeLabel;
    return product.size + (/^(g|mL)$/.test(unit) ? unit : " " + unit);
  }

  function singular(unit) {
    return unit.replace(/(ch|sh|x)es$/, "$1").replace(/s$/, "");
  }

  function pickMatches(product, pickId) {
    if (pickId == null || pickId === "") return false;
    if (product.stockcode != null && product.stockcode == pickId) return true;
    if (typeof product.url === "string" && product.url === pickId) return true;
    return false;
  }

  function partBuy(n, prod, item) {
    return prod.size === 1 ? n + " " + (n === 1 ? singular(item.unit) : item.unit) : n + " × " + packLabel(prod, item.unit);
  }

  function partsFromCounts(candidates, counts) {
    var parts = [];
    for (var i = 0; i < candidates.length; i++) {
      if (counts[i] > 0) parts.push({ product: candidates[i], quantity: counts[i], cost: round2(counts[i] * candidates[i].price) });
    }
    parts.sort(function (a, b) {
      return b.product.size - a.product.size;
    });
    return parts;
  }

  function primaryPart(parts, main) {
    var pick = parts[0];
    var best = parts[0].quantity * parts[0].product.size;
    for (var i = 0; i < parts.length; i++) {
      var amt = parts[i].quantity * parts[i].product.size;
      if (amt > best || (amt === best && parts[i].product === main)) {
        best = amt;
        pick = parts[i];
      }
    }
    return pick;
  }

  function productInParts(prod, parts) {
    for (var i = 0; i < parts.length; i++) if (parts[i].product === prod) return true;
    return false;
  }

  function cheapestSinglePack(candidates) {
    var pick = candidates[0];
    for (var ci = 1; ci < candidates.length; ci++) {
      if (candidates[ci].price < pick.price) pick = candidates[ci];
    }
    return [{ product: pick, quantity: 1, cost: round2(pick.price) }];
  }

  function bestPackMix(candidates, need, slack, main) {
    var minCover = need - slack;
    var maxCounts = candidates.map(function (c) {
      return Math.max(1, Math.ceil(minCover / c.size));
    });
    var best = null;
    function search(idx, counts, totalSize, rawCost, packCount, mainCount) {
      if (idx === candidates.length) {
        if (totalSize + 1e-9 < minCover || packCount < 1) return;
        var cost = round2(rawCost);
        var leftover = totalSize - need;
        if (
          !best ||
          cost < best.cost ||
          (cost === best.cost && leftover < best.leftover) ||
          (cost === best.cost && leftover === best.leftover && packCount < best.packCount) ||
          (cost === best.cost && leftover === best.leftover && packCount === best.packCount && mainCount > best.mainCount)
        ) {
          best = { cost: cost, leftover: leftover, packCount: packCount, mainCount: mainCount, counts: counts.slice() };
        }
        return;
      }
      var c = candidates[idx];
      for (var n = 0; n <= maxCounts[idx]; n++) {
        counts[idx] = n;
        search(idx + 1, counts, totalSize + n * c.size, rawCost + n * c.price, packCount + n, mainCount + (idx === 0 ? n : 0));
      }
    }
    search(0, new Array(candidates.length), 0, 0, 0, 0);
    return best;
  }

  function storeLine(item, product, need, pickId) {
    if (product.perKg) {
      var grams = deliGrams(need);
      return { product: product, quantity: grams / 1000, cost: round2((grams / 1000) * product.price), buy: grams + "g from the deli" };
    }
    var candidates = product.packs && product.packs.length ? [product].concat(product.packs) : null;
    var slack = item.approx ? PACK_SLACK : 0;
    function qtyFor(c) {
      return Math.max(1, Math.ceil((need - slack) / c.size - 1e-9));
    }
    var parts;
    if (candidates) {
      var forced = null;
      for (var fi = 0; fi < candidates.length; fi++) {
        if (pickMatches(candidates[fi], pickId)) {
          forced = candidates[fi];
          break;
        }
      }
      if (forced) {
        var fq = qtyFor(forced);
        parts = [{ product: forced, quantity: fq, cost: round2(fq * forced.price) }];
      } else {
        var mix = bestPackMix(candidates, need, slack, product);
        parts = mix ? partsFromCounts(candidates, mix.counts) : cheapestSinglePack(candidates);
      }
    } else {
      var chosen = product;
      var n = Math.max(1, Math.ceil((need - slack) / chosen.size - 1e-9));
      return {
        product: chosen,
        quantity: n,
        cost: round2(n * chosen.price),
        buy: partBuy(n, chosen, item),
      };
    }
    var primary = primaryPart(parts, product);
    var totalSize = 0;
    var lineCost = 0;
    for (var pi = 0; pi < parts.length; pi++) {
      totalSize += parts[pi].quantity * parts[pi].product.size;
      lineCost += parts[pi].cost;
    }
    var line = {
      product: primary.product,
      quantity: primary.quantity,
      cost: round2(lineCost),
      buy: parts.map(function (p) {
        return partBuy(p.quantity, p.product, item);
      }).join(" + "),
      parts: parts,
    };
    line.candidates = candidates.map(function (c) {
      var q = qtyFor(c);
      return { product: c, quantity: q, cost: round2(q * c.price) };
    });
    var leftoverAmt = totalSize - need;
    if (leftoverAmt > 1e-6) line.leftover = round2(leftoverAmt);
    var alts = [];
    for (var j = 0; j < candidates.length; j++) {
      if (!productInParts(candidates[j], parts)) alts.push(candidates[j]);
    }
    if (alts.length) line.alts = alts;
    return line;
  }

  function wooliesWithPacks(main, packs) {
    if (!packs.length) {
      if (!main.packs) return main;
      var bare = Object.assign({}, main);
      delete bare.packs;
      return bare;
    }
    return Object.assign({}, main, { packs: packs });
  }

  function liveWoolies(p, live) {
    if (!(typeof live.price === "number" && live.price > 0)) return p;
    var was = typeof live.was === "number" && live.was > live.price ? live.was : null;
    return Object.assign({}, p, { price: live.price, was: was, live: true });
  }

  /* prices: { [stockcode]: { price, was, special, available } } read live from Woolworths. */
  function applyLivePrices(items, prices) {
    if (!prices) return items;
    return items.map(function (it) {
      var p = it.woolies;
      if (!p) return it;
      var hadPacks = p.packs && p.packs.length;
      var live = prices[p.stockcode];
      if (!hadPacks) {
        if (!live) return it;
        if (live.available === false) return Object.assign({}, it, { woolies: null, wooliesUnavailable: p });
        if (!(typeof live.price === "number" && live.price > 0)) return it;
        var nextOnly = liveWoolies(p, live);
        return nextOnly === p ? it : Object.assign({}, it, { woolies: nextOnly });
      }
      var packs = p.packs.slice();
      var packsMut = false;
      packs = packs.map(function (pk) {
        var livePk = prices[pk.stockcode];
        if (!livePk) return pk;
        if (livePk.available === false) {
          packsMut = true;
          return null;
        }
        if (pk.sizeLabel) return pk;
        var nextPk = liveWoolies(pk, livePk);
        if (nextPk !== pk) packsMut = true;
        return nextPk;
      }).filter(Boolean);
      if (packs.length !== p.packs.length) packsMut = true;
      if (live && live.available === false) {
        if (packs.length) return Object.assign({}, it, { woolies: wooliesWithPacks(packs[0], packs.slice(1)) });
        return Object.assign({}, it, { woolies: null, wooliesUnavailable: p });
      }
      var main = p;
      var mainMut = false;
      if (live) {
        main = liveWoolies(p, live);
        mainMut = main !== p;
      }
      if (!mainMut && !packsMut) return it;
      return Object.assign({}, it, { woolies: wooliesWithPacks(main, packs) });
    });
  }

  function colesId(product) {
    var m = product && typeof product.url === "string" && /-(\d{4,7})$/.exec(product.url);
    return m ? m[1] : null;
  }

  function liveColes(p, live) {
    if (!(typeof live.price === "number" && live.price > 0)) return p;
    var was = typeof live.was === "number" && live.was > live.price ? live.was : null;
    return Object.assign({}, p, { price: live.price, was: was, live: true });
  }

  /* prices: { [Coles product id]: { price, was, special, available } } read live from Coles. */
  function colesWithPacks(main, packs) {
    if (!packs.length) {
      if (!main.packs) return main;
      var bare = Object.assign({}, main);
      delete bare.packs;
      return bare;
    }
    return Object.assign({}, main, { packs: packs });
  }

  function applyColesPrices(items, prices) {
    if (!prices) return items;
    return items.map(function (it) {
      var p = it.coles;
      if (!p) return it;
      var hadPacks = p.packs && p.packs.length;
      var live = prices[colesId(p)];
      if (!hadPacks) {
        if (live && live.available === false) return Object.assign({}, it, { coles: null, colesUnavailable: p });
        var mainOnly = live ? liveColes(p, live) : p;
        return mainOnly === p ? it : Object.assign({}, it, { coles: mainOnly });
      }
      var packs = p.packs.slice();
      var packsMut = false;
      packs = packs.map(function (pk) {
        var livePk = prices[colesId(pk)];
        if (!livePk) return pk;
        if (livePk.available === false) {
          packsMut = true;
          return null;
        }
        var next = liveColes(pk, livePk);
        if (next !== pk) packsMut = true;
        return next;
      }).filter(Boolean);
      if (packs.length !== p.packs.length) packsMut = true;
      if (live && live.available === false) {
        if (packs.length) return Object.assign({}, it, { coles: colesWithPacks(packs[0], packs.slice(1)) });
        return Object.assign({}, it, { coles: null, colesUnavailable: p });
      }
      var main = live ? liveColes(p, live) : p;
      if (main === p && !packsMut) return it;
      return Object.assign({}, it, { coles: colesWithPacks(main, packs) });
    });
  }

  /* An AMOUNTS value is a number (every portion) or {L, S, X}; a portion amount of 0 means that portion doesn't use the item. */
  function tierAmount(v, tier) {
    if (typeof v === "number") return v;
    var a = v && v[tier || "S"];
    return typeof a === "number" ? a : 0;
  }

  function create(items, amounts) {
    var byId = {};
    items.forEach(function (it) {
      byId[it.id] = it;
    });

    function amountFor(meal, id, tier) {
      var per = amounts[meal];
      return per && Object.prototype.hasOwnProperty.call(per, id) ? tierAmount(per[id], tier) : 0;
    }

    function buildShopNeed(picks, fixtureDays, dayMeals) {
      var need = {};
      var used = {};
      var days = {};
      function addMeal(meal, serves, day, tier) {
        var per = amounts[meal];
        if (!serves || !per) return;
        Object.keys(per).forEach(function (id) {
          var a = tierAmount(per[id], tier);
          if (!(a > 0)) return;
          need[id] = (need[id] || 0) + a * serves;
          var u = (used[id] = used[id] || []);
          if (u.indexOf(meal) < 0) u.push(meal);
          if (day) (days[id] = days[id] || {})[day] = true;
        });
      }
      Object.keys(picks).forEach(function (meal) {
        addMeal(meal, picks[meal], null, "S");
      });
      (dayMeals || []).forEach(function (dm) {
        addMeal(dm.meal, 1, dm.day, dm.t === "L" || dm.t === "X" ? dm.t : "S");
      });
      if (typeof fixtureDays === "number") {
        if (fixtureDays > 0) {
          items.forEach(function (it) {
            if (it.sec === 0) need[it.id] = fixtureDays;
          });
        }
      } else if (fixtureDays && typeof fixtureDays === "object" && !Array.isArray(fixtureDays)) {
        Object.keys(fixtureDays).forEach(function (id) {
          if (id === "__proto__") return;
          var n = fixtureDays[id];
          if (typeof n === "number" && isFinite(n) && n > 0) need[id] = (need[id] || 0) + n;
        });
      }
      return { need: need, used: used, days: days };
    }

    function haveForRow(have, id, need) {
      if (!have || !Object.prototype.hasOwnProperty.call(have, id)) return 0;
      var v = have[id];
      if (typeof v !== "number" || !isFinite(v) || v <= 0) return 0;
      return Math.min(v, need);
    }

    function rowCovered(need, h) {
      if (!(need > 0) || !(h > 0)) return false;
      var shortfall = need - h;
      return shortfall <= Math.max(1e-9, 0.05 * need);
    }

    function shopRow(it, n, used, days, buy, h, packPick) {
      var woolPick = packPick && packPick.woolies ? packPick.woolies[it.id] : undefined;
      var colesPick = packPick && packPick.coles ? packPick.coles[it.id] : undefined;
      var row = {
        id: it.id,
        sec: it.sec,
        name: it.name,
        unit: it.unit,
        need: n,
        used: used[it.id] || [],
        days: Object.keys(days[it.id] || {}).sort(),
        coles: it.coles ? storeLine(it, it.coles, buy, colesPick) : null,
        woolies: it.woolies ? storeLine(it, it.woolies, buy, woolPick) : null,
        wooliesUnavailable: it.wooliesUnavailable || null,
        colesUnavailable: it.colesUnavailable || null,
      };
      if (h > 0) row.have = h;
      return row;
    }

    function shopList(picks, fixtureDays, dayMeals, have, packPick) {
      var built = buildShopNeed(picks, fixtureDays, dayMeals);
      var need = built.need;
      var used = built.used;
      var days = built.days;
      var out = [];
      items.forEach(function (it) {
        var n = need[it.id];
        if (!(n > 0)) return;
        var h = haveForRow(have, it.id, n);
        if (rowCovered(n, h)) return;
        out.push(shopRow(it, n, used, days, n - h, h, packPick));
      });
      return out;
    }

    function coveredList(picks, fixtureDays, dayMeals, have) {
      var built = buildShopNeed(picks, fixtureDays, dayMeals);
      var need = built.need;
      var used = built.used;
      var days = built.days;
      var out = [];
      items.forEach(function (it) {
        var n = need[it.id];
        if (!(n > 0)) return;
        var h = haveForRow(have, it.id, n);
        if (!rowCovered(n, h)) return;
        out.push({
          id: it.id,
          sec: it.sec,
          name: it.name,
          unit: it.unit,
          need: n,
          have: h,
          used: used[it.id] || [],
          days: Object.keys(days[it.id] || {}).sort(),
          covered: true,
        });
      });
      return out;
    }

    function storeTotals(rows, store, ticks) {
      var t = { total: 0, left: 0, missed: [] };
      rows.forEach(function (r) {
        var line = r[store];
        if (!line) {
          t.missed.push(r.id);
          return;
        }
        t.total += line.cost;
        if (!ticks[r.id]) t.left += line.cost;
      });
      t.total = round2(t.total);
      t.left = round2(t.left);
      return t;
    }

    function mealCost(meal, store) {
      var per = amounts[meal];
      if (!per) return null;
      var other = store === "coles" ? "woolies" : "coles";
      var sum = 0;
      Object.keys(per).forEach(function (id) {
        var q = tierAmount(per[id], "S");
        var it = byId[id];
        var p = it && (it[store] || it[other]);
        if (!(q > 0) || !p) return;
        if (p.perKg) sum += (q / 1000) * p.price;
        else {
          var unit = p.price / p.size;
          if (p.packs) {
            p.packs.forEach(function (pk) {
              var u = pk.price / pk.size;
              if (u < unit) unit = u;
            });
          }
          sum += q * unit;
        }
      });
      return round2(sum);
    }

    function usedIn(id) {
      return Object.keys(amounts).filter(function (meal) {
        var v = amounts[meal][id];
        return v !== undefined && ["L", "S", "X"].some(function (t) {
          return tierAmount(v, t) > 0;
        });
      });
    }

    function checked(store) {
      var dates = [];
      items.forEach(function (it) {
        var p = it[store];
        if (!p) return;
        dates.push(p.checked);
        if (p.packs) p.packs.forEach(function (pk) {
          dates.push(pk.checked);
        });
      });
      return dates.sort()[0] || null;
    }

    return {
      ITEMS: items,
      AMOUNTS: amounts,
      item: function (id) {
        return byId[id];
      },
      deliGrams: deliGrams,
      amountFor: amountFor,
      shopList: shopList,
      coveredList: coveredList,
      storeTotals: storeTotals,
      mealCost: mealCost,
      usedIn: usedIn,
      checked: checked,
      colesChecked: function () {
        return checked("coles");
      },
    };
  }

  function shopNeedLabel(row, fmt) {
    if (!row || typeof row !== "object" || typeof fmt !== "function") return "";
    var needText = fmt(row.need, row.unit);
    var out = "need " + needText;
    if (!(row.have > 0)) return out;
    return out + " · have " + fmt(row.have, row.unit);
  }

  var api = create(ITEMS, AMOUNTS);
  api.shopNeedLabel = shopNeedLabel;
  api.create = create;
  api.applyLivePrices = applyLivePrices;
  api.applyColesPrices = applyColesPrices;
  api.colesId = colesId;
  api.RETIRED = RETIRED;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCatalogue = api;
})(this);
