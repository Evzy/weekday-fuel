# Kitchen inventory (idea, not designed yet)

**Status:** idea captured 2026-10-18 for later. Brainstorm it before building; nothing here is decided.

## The idea

The app keeps a running count of the food at home, so it knows what is left to use across all meals and the shop only buys what's actually missing.

Owner's example: buy 30 slices of cheese and the app assumes there are 30 to use across every meal; each planned meal uses some up; the next shop only buys cheese when the planned meals need more than what's left.

## Why it fits

- The shop already buys whole packs and knows the leftover: macaroni shows "Buy: 1 × 500g · need 150g", so 350g goes home unused and is forgotten today.
- Today the owner removes things from the shop by hand: ticking a row ("already had") or the pantry check before sending a trolley. An inventory would do most of that automatically.
- The meal library (v0.9.0) gives exact per-portion amounts for every meal, so what a planned day uses up is known.
- It pairs with the planned overlap-aware "Suggest a day": suggestions could favour meals that use up what's already at home (e.g. the rest of the macaroni or the cucumber) before it goes off.

## How it might work (to brainstorm)

- **Stock in:** when an order is saved ("Save order and start next shop"), what was bought goes into the inventory in the catalogue's units (g, mL, slices, eggs, pouches). Manual add and adjust for anything else ("I have 30 slices of cheese").
- **Stock out:** planned meals use their amounts for their portion when the day passes (or when marked eaten); fixtures (Dare, Grenade) use one each tracked weekday.
- **Shop:** each row's need is reduced by what's in stock; a row that's fully covered drops off or shows as "covered by what you have". The pantry check could start pre-ticked from the inventory.
- **Inventory view:** a list of what's at home with amounts, an easy "used it / threw it out / set amount" correction, and maybe a "use soon" flag for fresh items.

## Questions to settle

- When does a planned meal count as eaten: automatically when its day ends, or only when ticked? What about meals that were planned but skipped?
- How much correcting is acceptable? It will drift (snacking, spills, eating out); the fix has to be quick or the counts stop being trusted.
- Fresh food going off: track a bought date and a rough shelf life (spinach a few days, cheese weeks, pantry jars months), or only track amounts?
- Batch cooking: the Sunday chicken turns 1kg raw into 5 cooked portions. Track raw, cooked portions, or both?
- Products bought in a different pack size or at the other store than the catalogue assumes.
- Does it replace the "Already had" ticks and pantry check, or sit alongside them?
- Storage: a new `localStorage` key; existing keys keep their shape.

## Out of scope until designed

Barcode scanning, receipt reading, and anything that reads the owner's Coles or Woolworths order history.
