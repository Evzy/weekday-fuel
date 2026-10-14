# Weekday Fuel — transcript notes (starting point)

**Source chat (Claude share):** https://claude.ai/share/4ff89ac4-f718-408f-b572-7d6b77090db2  
**Artifact link:** https://claude.ai/artifact/66jPZUnu1Um8var3Yym2E6  
**Frozen HTML in this folder:** [`Weekday_Fuel.html`](Weekday_Fuel.html) — **this is the app to ship as-is for v0.**

User intent: **replicate this exact artifact** into a standalone Android APK (no backend). Iterate later; do not redesign in the first cut.

---

## Product name

**Weekday Fuel** (working repo name may still be `nutrition`).

---

## What the artifact already does (tabs)

From the HTML + chat: phone-first SPA with sticky tab bar:

| Tab | Role |
| --- | --- |
| **Today** | Day budget / meal slots with Light / Standard / Loaded portion dial |
| **Weigh-in** | Weight tracking / mode (mini-cut, recomp, lean bulk) |
| **Meals** | Meal library + recipes |
| **Shop** | Shopping: **Build a shop** (pick meals + serves → list) and **Full list** |
| **Targets** | Settings / macros / fixtures (Dare, Grenade, etc.) |

Persistence is already **on-device** via `localStorage` (settings, days, weights, shop ticks). WebView must enable DOM storage.

---

## Chat decisions captured (do not regress these)

### Pricing / products (Sydney reference; Melb packaged often same)

- Meal cost-per-serve updated to newer Coles/Woolworths prices.
- Shopping list uses **real Coles / Woolworths products**; items tagged **Checked** vs **Estimate**.
- Corrections called out in chat: chicken breast, lean mince, Chobani, Dare (~296 kcal), Grenade (~244 kcal); fixtures ~540 kcal/day; mini-cut / “fit portions” left room for that.
- Cheapest swaps noted (cook own chicken vs deli; Coles potatoes/wraps cheaper; Grenade half-price stock-up).

### Product links (Shop)

- App **cannot** load store product photos (cross-origin). UI opens **exact product pages** (Woolworths mostly; Coles for a few).
- **No generic “search” buttons** — user asked for the **actual item** the app intends.
- Two items had no store page: Carnation Light & Creamy Evaporated Milk, Maesri red curry paste → say so + aisle hint.
- Item names in meals must match shopping list product names.

### Shop builder (current main Shop UX)

- Opens on **Build a shop**: − / + serves per meal; tap name for recipe.
- **Starter shop** button: toasty, chicken wraps, burrito bowl, buffalo mac × 2 serves each (shared ingredients).
- List shows **Buy** line (pack size vs amount needed); tick trolley / pantry; “Left to buy”.
- Dare / Grenade: days count (or 0 if already stocked).
- **Full list** still available.
- Picks persist for the phone at the shops.
- Note: chicken may still show large pack when trying few meals — chat mentioned small pack (~600g) can be enough.

### Label / macro caveats (keep in data if present)

- Ayam Light Coconut Milk dense → curry uses 70mL + 70mL water.
- Woolworths Light Tasty cheese slightly fattier than earlier assumption (~+10 kcal / 30g).
- Chobani Natural Light matches meal assumptions.

---

## Chat ends here

Last delivered state in the conversation: Shop builder as above; starter shop ~$135 including ~$48 for 5 days Dare+Grenade; leftover packs carry into next week.

**For the next agent:** ship [`Weekday_Fuel.html`](Weekday_Fuel.html) in a WebView with localStorage + external link handling for Woolworths/Coles URLs. Do not rebuild features from scratch unless the HTML is broken on device.
