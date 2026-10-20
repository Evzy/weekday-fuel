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

## Done in v0.27.0: Shop: mix pack sizes in one line (raised 2026-10-20)

The chooser buys one pack size per item. Mixing is sometimes cheaper: 15 eggs is 2 x 12 = $13.40 but 12 + 6 = $11.60; 1250g yoghurt is 2 x 907g = $17.60 but 907g + 500g = $15.30. Needs the trolley send, sent record, orders matching and stock to handle two products for one item.

