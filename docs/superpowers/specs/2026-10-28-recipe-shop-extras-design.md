# Recipe extras on Shop, and weigh liquids in grams

Evan, 2026-10-28: he'd rather weigh liquids on a scale than use teaspoons; recipes can stay authored in mL, then he enters the grams he weighed. Also butter, mayo, spices and spray are in the recipes but not the cart — every real recipe ingredient should be on Shop, and Kitchen Set amount covers things he already has.

## Decisions

- Every extra that is a real product becomes a normal catalogue item. Skip salt, pepper and water.
- Entering grams is once per product, from the recipe line, and applies to every meal that uses it.
- Extras join Shop as full catalogue products (not a sidecar list, not Kitchen-only).

## 1. Extras become shop items

Move these from `EXTRA_AMOUNTS` into `catalogue.js` `AMOUNTS` and add them to `ITEMS`, using the same products already used for macros (label panels in `docs/research/labels-*.json`). No new core protein/carb/veg.

| id | What | Unit |
| --- | --- | --- |
| spray | Oil spray | g (shop buys the can) |
| butter | Butter | g |
| lightmayo | Light mayo | g |
| kewpie | Kewpie mayo | g |
| paprika | Paprika | g |
| olive | Extra virgin olive oil | mL until weighed |
| fishsauce | Fish sauce | mL until weighed |
| vegoil | Vegetable oil | mL until weighed |
| tomsauce | Tomato sauce | mL until weighed |
| sesameseed | Sesame seeds | g |
| sourdough | Sourdough | g |
| avocado | Avocado | g |
| tasty | Full-fat tasty cheese | g |

Buffalo mac's 5 g garlic paste is already a shop item (`garlic`); fold that 5 g into `AMOUNTS.buffalomac.garlic` instead of leaving it as an extra.

Salt, pepper, water, and "splash of water" stay as recipe `extras` text only. They never appear on Shop.

Shop still buys whole packs (a spray can, a butter block, a mayo jar). Kitchen Set amount and Shop "already have it" work as they do for soy and cheese. If he already has spray or butter, he sets the amount in Kitchen (or ticks pantry) and it stays out of the trolley.

Meal recipe cards keep the measured wording they have today; shop ingredient lines come from `AMOUNTS` like everything else.

Unconfirmed prices stay tagged until a live price arrives, same as crumbed fillet.

## 2. Weigh a liquid, then use grams

Liquids in scope: catalogue items whose unit is mL (`soy`, `coco`, `franks`, `sesame`, and the new `olive`, `fishsauce`, `vegoil`, `tomsauce`).

On the recipe card, a liquid line is tappable. The sheet names the product and the portion amount in mL: "Soy sauce · this portion is 40 mL. What did 40 mL weigh?" He types grams.

Stored additively in settings: `weighG: { soy: { ml: 40, g: 46 }, ... }`. No other localStorage shape changes.

That ratio applies to every meal that uses the product. Recipe lines then show grams, with the original mL in small type. Macros use the weighed grams against a per-100 g label when the panel is per 100 g; when the panel is per 100 mL, macros keep using mL (grams / (g/ml) = mL) so nothing is estimated.

Shop still buys the bottle (pack size unchanged). After a conversion exists, Kitchen Set amount for that item is in grams so leftover stock matches the scale. Existing Kitchen stock in mL is multiplied by g/ml once, with a device-local done flag next to inventory (same pattern as the cucumber/capsicum migration), only for items that have a `weighG` entry.

Tap the line again to correct. A clear control removes `weighG[id]` and the UI goes back to mL; Kitchen stock is not converted back.

No density is assumed. No grams until he has weighed that product.

## Out of scope

Changing how recipes are authored (they stay in mL in the data). Uploading photos. Ticking "I already weighed this" without a number.
