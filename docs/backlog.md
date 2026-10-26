# Backlog

Ideas agreed for later. Each gets a brainstorm and spec before it's built.

## Done in v0.26.0: Today: close the gap when portions can't (raised 2026-10-20)

**Problem.** Skipping a staple on Today refits portions, but when every remaining meal is already Loaded the day still falls short (seen: Dare skipped, all meals Loaded, 2329 / 2500 kcal). The app only says "Portions refit".

**Evan's idea.** Suggest bringing forward something already bought for a later meal, and change the portions of the later meals to make up for it.

**Options, in the order the app should try them:**

1. **Spare food at home.** Use stock that no later meal needs (the inventory already knows what's reserved), e.g. "Have 200g Greek yoghurt + honey: +260 kcal, 25g protein". Nothing later changes. Best when it exists.
2. **Spread the gap over the next days.** Targets matter most as a weekly average. Offer "Make up 170 kcal over Wed–Thu" and nudge those days' portions up (they're often not Loaded yet). No food moves, no shop changes.
3. **Bring a later meal or part of one forward** (Evan's idea). Move or add a bought meal from a later day to today, then refit the days it came from. Most powerful, but it changes later days' food, so it needs a clear preview and undo.

**Also consider (Today).** Show the shortfall plainly ("170 kcal short even at Loaded") so a refit that can't hit the goal doesn't look like it worked. And the reverse case: adding a staple on a day already over target, with every meal already Light.

## Built, not yet released: Woolworths $50 delivery minimum (raised 2026-10-26)

Spec `docs/superpowers/specs/2026-10-27-delivery-minimum-design.md`; built in 18e36a4, dea9ff2, fc82587 (reviewer approved). Both stores, $50 each. Suggestions: plan the next day, daily staples ahead. Ships with the exact-macros release.

**Problem.** Woolworths won't complete a delivery order under $50, so small shops (e.g. a 3-day plan) get stuck at checkout.

**Evan's choice (2026-10-26).** Show how far under $50 the Woolworths shop is, and suggest top-ups that get used anyway: cover the next planned days, restock pantry items needed soon, or bigger packs. (Not chosen: plan enough days automatically; only show the gap.) Next step: brainstorm details and spec. Do after the exact-macros work.

## Open: Kitchen stock follow-ups (raised 2026-10-26)

- **Done in v0.32.2:** Kitchen button at the top of Shop; Kitchen hint "Used something for another meal? Tap the item to set how much is left." Evan didn't know Kitchen existed (it was only reachable via Shop → Already at home → At home).
- Kitchen already has Used it all / Threw it out / Set amount per item, and Add food. Evan said Set amount is enough (no "Used some" box for now).
- Known side effect of the 2026-10-26 meal rework: eaten past meals now draw down stock with the new recipes (e.g. breast instead of thigh), so breast stock may read low; Evan can fix with Set amount.

## In progress: exact macros (raised 2026-10-27)

Spec: `docs/superpowers/specs/2026-10-27-exact-macros-design.md`. No estimates: label or FSANZ values only, per store; meals calculated, not typed; measured extras; unconfirmed prices shown. Also: rice Standard ½ pouch / Loaded ¾; schnitzel Standard 300g mash + gravy, Loaded 400g mash + butter + gravy (the reviewed c34e27b schnitzel Standard figures were wrong: 45g P / 61g C, not 47 / 71). Label research in `docs/research/labels-{a,b,c}.json`. Evan approves a before/after table before release. The 2026-10-26 meal rework (c34e27b) is on main but not released yet; release together.

## Done in v0.27.0: Shop: mix pack sizes in one line (raised 2026-10-20)

The chooser buys one pack size per item. Mixing is sometimes cheaper: 15 eggs is 2 x 12 = $13.40 but 12 + 6 = $11.60; 1250g yoghurt is 2 x 907g = $17.60 but 907g + 500g = $15.30. Needs the trolley send, sent record, orders matching and stock to handle two products for one item.

