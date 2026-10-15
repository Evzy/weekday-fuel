/* Coles and Woolworths products for every Shop item, and the shopping maths. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  /* A small pack is used while the need is at most this much over its size (in the item's unit). */
  var SMALL_PACK_SLACK = 50;

  /* From docs/catalogue-research.md (approved 2026-10-15). */
  var ITEMS = [
    {
      id: "dare", sec: 0, name: "Dare Protein iced coffee", unit: "bottles", note: "Coles had it on special at $3.30 on 2026-10-15. Bulk-buy at half price; keeps unopened at room temperature", same: true,
      coles: { name: "Dare Protein No Sugar Added Iced Coffee Double Espresso 500mL", url: "https://www.coles.com.au/product/dare-protein-no-sugar-added-iced-coffee-double-espresso-500ml-8991361", size: 1, price: 4.65, checked: "2026-10-15" },
      woolies: { name: "Dare Iced Double Espresso Protein No Added Sugar 500mL", url: "https://www.woolworths.com.au/shop/productdetails/72280/dare-iced-double-espresso-protein-no-added-sugar", stockcode: 72280, size: 1, price: 4.65, checked: "2026-10-15" },
    },
    {
      id: "grenade", sec: 0, name: "Grenade bar", unit: "bars", note: "Same bar; Woolworths leaves \"Chocolate Chip\" out of the name. Half price is $2.50, so buy 10+ then", same: true,
      coles: { name: "Grenade Chocolate Chip Salted Caramel Protein Bar 60g", url: "https://www.coles.com.au/product/grenade-chocolate-chip-salted-caramel-protein-bar-60g-9968707", size: 1, price: 5, checked: "2026-10-15" },
      woolies: { name: "Grenade Salted Caramel Protein Bar 60g", url: "https://www.woolworths.com.au/shop/productdetails/6027807/grenade-salted-caramel-protein-bar", stockcode: 6027807, size: 1, price: 5, checked: "2026-10-15" },
    },
    {
      id: "breast", sec: 1, name: "Chicken breast fillets", unit: "g", note: "Woolworths has no ~1.4kg pack (only 650g, or a 1.5–2.2kg bulk pack at $24.20), so it buys 650g packs", same: false,
      coles: {
        name: "Coles RSPCA Approved Chicken Breast Fillets Large Pack approx. 1.4kg", url: "https://www.coles.com.au/product/coles-rspca-approved-chicken-breast-fillets-large-pack-approx.-1.4kg-2263179", size: 1400, price: 15.4, checked: "2026-10-15",
        small: { name: "Coles RSPCA Approved Chicken Breast Fillets Small Pack approx. 600g", url: "https://www.coles.com.au/product/coles-rspca-approved-chicken-breast-fillets-small-pack-approx.-600g-2263168", size: 600, price: 8.7, checked: "2026-10-15" },
      },
      woolies: { name: "Woolworths RSPCA Approved Chicken Breast Fillets 650g", url: "https://www.woolworths.com.au/shop/productdetails/6078624/woolworths-rspca-approved-chicken-breast-fillets", stockcode: 6078624, size: 650, price: 9.4, checked: "2026-10-15" },
    },
    {
      id: "mince", sec: 1, name: "Extra lean beef mince", unit: "g", note: "Woolworths special (usually $10.00)", same: false,
      coles: { name: "Coles No Added Hormone Beef Extra Lean Mince 500g", url: "https://www.coles.com.au/product/coles-no-added-hormone-beef-extra-lean-mince-500g-8112799", size: 500, price: 9.8, checked: "2026-10-15" },
      woolies: { name: "Woolworths Heart Smart Extra Lean Beef Mince 500g", url: "https://www.woolworths.com.au/shop/productdetails/577860/woolworths-heart-smart-extra-lean-beef-mince", stockcode: 577860, size: 500, price: 9.8, checked: "2026-10-15" },
    },
    {
      id: "thigh", sec: 1, name: "Chicken thigh fillets", unit: "g", note: "Teriyaki week only", same: false,
      coles: {
        name: "Coles RSPCA Approved Chicken Thigh Fillets Large Pack approx. 1.2kg", url: "https://www.coles.com.au/product/coles-rspca-approved-chicken-thigh-fillets-large-pack-approx.-1.2kg-2263328", size: 1200, price: 17.4, checked: "2026-10-15",
        small: { name: "Coles RSPCA Chicken Thigh Fillets Small Pack approx. 700g", url: "https://www.coles.com.au/product/coles-rspca-chicken-thigh-fillets-small-pack-approx.-700g-2263317", size: 700, price: 12.6, checked: "2026-10-15" },
      },
      woolies: { name: "Woolworths RSPCA Approved Chicken Thigh Fillets 550g", url: "https://www.woolworths.com.au/shop/productdetails/6078660/woolworths-rspca-approved-chicken-thigh-fillets", stockcode: 6078660, size: 550, price: 9.9, checked: "2026-10-15" },
    },
    {
      id: "eggs", sec: 1, name: "Free range eggs, 12 pack", unit: "eggs", note: "The old Woolworths link (582362) is unavailable; 6013278 replaces it", same: false,
      coles: { name: "Coles Free Range Eggs 12 Pack 700g", url: "https://www.coles.com.au/product/coles-free-range-eggs-12-pack-700g-9453478", size: 12, price: 6.9, checked: "2026-10-15" },
      woolies: { name: "Woolworths 12 Pack Extra Large Free Range Eggs 700g", url: "https://www.woolworths.com.au/shop/productdetails/6013278/woolworths-12-pack-extra-large-free-range-eggs", stockcode: 6013278, size: 12, price: 6.7, checked: "2026-10-15" },
    },
    {
      id: "ham", sec: 1, name: "Shaved ham", unit: "g", note: "Coles doesn't sell deli ham by weight online, so a 200g pack instead (on special at $5.00 on 2026-10-15)", same: false,
      coles: { name: "Don Leg Ham Shaved 200g", url: "https://www.coles.com.au/product/don-leg-ham-shaved-200g-6284567", size: 200, price: 6.6, checked: "2026-10-15" },
      woolies: { name: "D'Orsogna Ham Leg Triple Smoked 97% Fat Free Shaved From The Deli", url: "https://www.woolworths.com.au/shop/productdetails/175734/d-orsogna-ham-leg-triple-smoked-97-fat-free-shaved-from-the-deli", stockcode: 175734, perKg: true, size: 1, price: 28, checked: "2026-10-15" },
    },
    {
      id: "yog", sec: 1, name: "Greek yoghurt, natural light", unit: "g", note: "Coles shows it as currently unavailable", same: true,
      coles: { name: "Chobani Greek Yogurt Natural Light 907g", url: "https://www.coles.com.au/product/chobani-greek-yogurt-natural-light-907g-1435100", size: 907, price: 8.8, checked: "2026-10-15" },
      woolies: { name: "Chobani Greek Yoghurt Natural Light Plain 907g", url: "https://www.woolworths.com.au/shop/productdetails/717518/chobani-greek-yoghurt-natural-light-plain", stockcode: 717518, size: 907, price: 8.8, checked: "2026-10-15" },
    },
    {
      id: "cheese", sec: 1, name: "Light tasty shredded cheese", unit: "g", note: "Keeps for weeks in the fridge", same: false,
      coles: { name: "Coles Cheese Shredded Tasty Light 700g", url: "https://www.coles.com.au/product/coles-cheese-shredded-tasty-light-700g-8145346", size: 700, price: 11, checked: "2026-10-15" },
      woolies: { name: "Woolworths Light Tasty Shredded Cheese 500g", url: "https://www.woolworths.com.au/shop/productdetails/729008/woolworths-light-tasty-shredded-cheese", stockcode: 729008, size: 500, price: 8.3, checked: "2026-10-15" },
    },
    {
      id: "wraps", sec: 1, name: "Mission Carb Balance wraps", unit: "wraps", note: "Coles lists the 6 pack (8566038) but as unavailable with no price. Woolworths special (usually $6.60). Freeze half", same: false,
      coles: null,
      woolies: { name: "Mission Carb Balance Original Wraps 6 pack", url: "https://www.woolworths.com.au/shop/productdetails/919345/mission-carb-balance-original-wraps", stockcode: 919345, size: 6, price: 5.6, checked: "2026-10-15" },
    },
    {
      id: "bread", sec: 1, name: "Wholemeal sandwich loaf", unit: "slices", note: "About 16 slices. Freeze half", same: true,
      coles: { name: "Abbott's Bakery Farmhouse Wholemeal Bread 750g", url: "https://www.coles.com.au/product/abbott's-bakery-farmhouse-wholemeal-bread-750g-7226034", size: 16, price: 5.2, checked: "2026-10-15" },
      woolies: { name: "Abbott's Bakery Farmhouse Wholemeal Bread Sandwich Slice Loaf 750g", url: "https://www.woolworths.com.au/shop/productdetails/331591/abbott-s-bakery-farmhouse-wholemeal-bread-sandwich-slice-loaf", stockcode: 331591, size: 16, price: 5.2, checked: "2026-10-15" },
    },
    {
      id: "muffin", sec: 1, name: "English muffins", unit: "muffins", note: "The old Woolworths link (6083082) is unavailable", same: true,
      coles: { name: "Tip Top Muffins English 6 pack (400g)", url: "https://www.coles.com.au/product/tip-top-muffins-english-400g-332394", size: 6, price: 6.6, checked: "2026-10-15" },
      woolies: { name: "Tip Top English Muffins Original 6 pack", url: "https://www.woolworths.com.au/shop/productdetails/46795/tip-top-english-muffins-original-bakery", stockcode: 46795, size: 6, price: 6.8, checked: "2026-10-15" },
    },
    {
      id: "spinach", sec: 1, name: "Baby spinach", unit: "g", note: "The old link was the 280g bag", same: false,
      coles: { name: "Coles Baby Spinach 120g", url: "https://www.coles.com.au/product/coles-baby-spinach-120g-1499340", size: 120, price: 3.3, checked: "2026-10-15" },
      woolies: { name: "Woolworths Baby Leaf Spinach 120g", url: "https://www.woolworths.com.au/shop/productdetails/524322/woolworths-baby-leaf-spinach", stockcode: 524322, size: 120, price: 3.3, checked: "2026-10-15" },
    },
    {
      id: "toms", sec: 1, name: "Cherry tomatoes", unit: "g", note: "Coles shows the 250g punnet as currently unavailable", same: false,
      coles: { name: "Coles Cherry Tomatoes 250g", url: "https://www.coles.com.au/product/coles-cherry-tomatoes-250g-4834736", size: 250, price: 3.7, checked: "2026-10-15" },
      woolies: { name: "Woolworths Cherry Tomatoes Punnet 250g", url: "https://www.woolworths.com.au/shop/productdetails/149620/woolworths-cherry-tomatoes-punnet", stockcode: 149620, size: 250, price: 3.5, checked: "2026-10-15" },
    },
    {
      id: "cucumber", sec: 1, name: "Lebanese cucumber", unit: "cucumbers", note: "", same: false,
      coles: { name: "Coles Lebanese Cucumbers, each (approx. 160g)", url: "https://www.coles.com.au/product/coles-lebanese-cucumbers-approx.-160g-4575208", size: 1, price: 1.42, checked: "2026-10-15" },
      woolies: { name: "Lebanese Cucumbers, each", url: "https://www.woolworths.com.au/shop/productdetails/137130/lebanese-cucumbers", stockcode: 137130, size: 1, price: 1.6, checked: "2026-10-15" },
    },
    {
      id: "capsicum", sec: 1, name: "Green capsicum", unit: "capsicums", note: "", same: false,
      coles: { name: "Coles Capsicum Green Loose, each (approx. 220g)", url: "https://www.coles.com.au/product/coles-capsicum-green-loose-approx.-220g-7214862", size: 1, price: 1.74, checked: "2026-10-15" },
      woolies: { name: "Woolworths Capsicum Green, each", url: "https://www.woolworths.com.au/shop/productdetails/135156/woolworths-capsicum-green", stockcode: 135156, size: 1, price: 1.48, checked: "2026-10-15" },
    },
    {
      id: "rice", sec: 2, name: "Microwave rice pouch", unit: "pouches", note: "Often $2.50 on special", same: true,
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
      id: "potato", sec: 2, name: "Washed potatoes 2kg", unit: "g", note: "", same: false,
      coles: { name: "Coles Potatoes Washed 2kg", url: "https://www.coles.com.au/product/coles-potatoes-washed-2kg-1206748", size: 2000, price: 6, checked: "2026-10-15" },
      woolies: { name: "Woolworths Washed Potatoes Bag 2kg", url: "https://www.woolworths.com.au/shop/productdetails/262783/woolworths-washed-potatoes-bag", stockcode: 262783, size: 2000, price: 6.5, checked: "2026-10-15" },
    },
    {
      id: "corn", sec: 2, name: "Corn kernels", unit: "g", note: "Lives in the pantry", same: true,
      coles: { name: "Edgell Corn Kernels 420g", url: "https://www.coles.com.au/product/edgell-corn-kernels-420g-132045", size: 420, price: 2.2, checked: "2026-10-15" },
      woolies: { name: "Edgell Corn Kernels 420g", url: "https://www.woolworths.com.au/shop/productdetails/34437/edgell-corn-kernels", stockcode: 34437, size: 420, price: 2.2, checked: "2026-10-15" },
    },
    {
      id: "fzpeas", sec: 2, name: "Frozen peas", unit: "g", note: "", same: false,
      coles: { name: "Coles Frozen Garden Peas 1kg", url: "https://www.coles.com.au/product/coles-frozen-garden-peas-1kg-9054790", size: 1000, price: 4.5, checked: "2026-10-15" },
      woolies: { name: "Woolworths Frozen Australian Peas 1kg", url: "https://www.woolworths.com.au/shop/productdetails/754169/woolworths-frozen-australian-peas", stockcode: 754169, size: 1000, price: 4.5, checked: "2026-10-15" },
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
      coles: { name: "Mutti Passata Tomato Puree 700g", url: "https://www.coles.com.au/product/mutti-passata-tomato-puree-700g-1809266", size: 700, price: 4.8, checked: "2026-10-15" },
      woolies: { name: "Mutti Passata Tomato Puree 700g", url: "https://www.woolworths.com.au/shop/productdetails/795297/mutti-passata-tomato-puree", stockcode: 795297, size: 700, price: 3.8, checked: "2026-10-15" },
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
    toasty: { bread: 2, ham: 100, cheese: 30, spinach: 20, toms: 50 },
    eggmuffin: { eggs: 3, ham: 50, muffin: 2, cheese: 20, spinach: 20 },
    yogbowl: { yog: 250, fzberry: 100, muesli: 40, honey: 7, pb: 16 },
    brekwrap: { eggs: 3, ham: 50, wraps: 1, cheese: 20, salsa: 30, spinach: 20 },
    tenderwrap: { breast: 200, wraps: 2, cheese: 30, salsa: 30, spinach: 20, cucumber: 0.5, toms: 50 },
    burritobowl: { rice: 0.75, breast: 200, corn: 80, capsicum: 0.5, salsa: 30, taco: 4, yog: 50, cheese: 30 },
    teriyaki: { thigh: 200, teriyaki_sauce: 50, rice: 0.75, fzasian: 150 },
    buffalomac: { breast: 180, macaroni: 75, evap: 80, cheese: 40, franks: 50, fzbroc: 100 },
    schnitzel: { breast: 180, eggs: 1, panko: 30, potato: 200, fzpeas: 120, gravy: 10 },
    koreanbeef: { mince: 200, soy: 40, honey: 21, sesame: 5, garlic: 5, ginger: 5, rice: 0.5, eggs: 1, fzbroc: 150 },
    bolognese: { mince: 200, spaghetti: 85, passata: 200, fzmix: 100, garlic: 5, parm: 10 },
    redcurry: { breast: 180, curry: 15, coco: 70, fzasian: 150, rice: 0.75 },
    friedrice: { breast: 160, eggs: 2, rice: 0.75, fzpeas: 60, corn: 60, soy: 40, oyster: 20, sesame: 5 },
    snackplate: { eggs: 2, cucumber: 0.5, toms: 50, cheese: 20 },
  };

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  /* Deli counters sell by 100 g, minimum 100 g. Round up so the owner never runs short. */
  function deliGrams(needGrams) {
    return Math.max(100, Math.ceil(needGrams / 100) * 100);
  }

  function packLabel(product, unit) {
    return product.size + (/^(g|mL)$/.test(unit) ? unit : " " + unit);
  }

  function singular(unit) {
    return unit.replace(/(ch|sh|x)es$/, "$1").replace(/s$/, "");
  }

  function storeLine(item, product, need) {
    if (product.perKg) {
      var grams = deliGrams(need);
      return { product: product, quantity: grams / 1000, cost: round2((grams / 1000) * product.price), buy: grams + "g from the deli" };
    }
    var useSmall = product.small && need <= product.small.size + SMALL_PACK_SLACK;
    var chosen = useSmall ? product.small : product;
    var packs = useSmall ? 1 : Math.max(1, Math.ceil(need / chosen.size - 1e-9));
    return {
      product: chosen,
      quantity: packs,
      cost: round2(packs * chosen.price),
      buy: chosen.size === 1 ? packs + " " + (packs === 1 ? singular(item.unit) : item.unit) : packs + " × " + packLabel(chosen, item.unit),
    };
  }

  /* prices: { [stockcode]: { price, was, special, available } } read live from Woolworths. */
  function applyLivePrices(items, prices) {
    if (!prices) return items;
    return items.map(function (it) {
      var p = it.woolies;
      var live = p && prices[p.stockcode];
      if (!live) return it;
      if (live.available === false) return Object.assign({}, it, { woolies: null, wooliesUnavailable: p });
      if (!(typeof live.price === "number" && live.price > 0)) return it;
      var was = typeof live.was === "number" && live.was > live.price ? live.was : null;
      return Object.assign({}, it, { woolies: Object.assign({}, p, { price: live.price, was: was, live: true }) });
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
  function applyColesPrices(items, prices) {
    if (!prices) return items;
    return items.map(function (it) {
      var p = it.coles;
      if (!p) return it;
      var live = prices[colesId(p)];
      var small = p.small || null;
      var liveSmall = small && prices[colesId(small)];
      if (small && liveSmall) small = liveSmall.available === false ? null : liveColes(small, liveSmall);
      if (live && live.available === false) {
        if (small) return Object.assign({}, it, { coles: small });
        return Object.assign({}, it, { coles: null, colesUnavailable: p });
      }
      var main = live ? liveColes(p, live) : p;
      if (small !== (p.small || null)) {
        main = Object.assign({}, main);
        if (small) main.small = small;
        else delete main.small;
      }
      return main === p ? it : Object.assign({}, it, { coles: main });
    });
  }

  function create(items, amounts) {
    var byId = {};
    items.forEach(function (it) {
      byId[it.id] = it;
    });

    function shopList(picks, fixtureDays, dayMeals) {
      var need = {};
      var used = {};
      var days = {};
      function addMeal(meal, serves, day) {
        var per = amounts[meal];
        if (!serves || !per) return;
        Object.keys(per).forEach(function (id) {
          need[id] = (need[id] || 0) + per[id] * serves;
          var u = (used[id] = used[id] || []);
          if (u.indexOf(meal) < 0) u.push(meal);
          if (day) (days[id] = days[id] || {})[day] = true;
        });
      }
      Object.keys(picks).forEach(function (meal) {
        addMeal(meal, picks[meal], null);
      });
      (dayMeals || []).forEach(function (dm) {
        addMeal(dm.meal, 1, dm.day);
      });
      if (fixtureDays > 0) {
        items.forEach(function (it) {
          if (it.sec === 0) need[it.id] = fixtureDays;
        });
      }
      return items
        .filter(function (it) {
          return need[it.id] > 0;
        })
        .map(function (it) {
          var n = need[it.id];
          return {
            id: it.id,
            sec: it.sec,
            name: it.name,
            unit: it.unit,
            need: n,
            used: used[it.id] || [],
            days: Object.keys(days[it.id] || {}).sort(),
            coles: it.coles ? storeLine(it, it.coles, n) : null,
            woolies: it.woolies ? storeLine(it, it.woolies, n) : null,
            wooliesUnavailable: it.wooliesUnavailable || null,
            colesUnavailable: it.colesUnavailable || null,
          };
        });
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
        var it = byId[id];
        var p = it && (it[store] || it[other]);
        if (!p) return;
        sum += p.perKg ? (per[id] / 1000) * p.price : (per[id] / p.size) * p.price;
      });
      return round2(sum);
    }

    function usedIn(id) {
      return Object.keys(amounts).filter(function (meal) {
        return id in amounts[meal];
      });
    }

    function checked(store) {
      var dates = [];
      items.forEach(function (it) {
        var p = it[store];
        if (!p) return;
        dates.push(p.checked);
        if (p.small) dates.push(p.small.checked);
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
      shopList: shopList,
      storeTotals: storeTotals,
      mealCost: mealCost,
      usedIn: usedIn,
      checked: checked,
      colesChecked: function () {
        return checked("coles");
      },
    };
  }

  var api = create(ITEMS, AMOUNTS);
  api.create = create;
  api.applyLivePrices = applyLivePrices;
  api.applyColesPrices = applyColesPrices;
  api.colesId = colesId;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCatalogue = api;
})(this);
