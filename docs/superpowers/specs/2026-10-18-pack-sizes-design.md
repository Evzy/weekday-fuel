# Pack sizes chosen by the week (v0.11.0)

Evan, 2026-10-18: meal costs looked high. The biggest saving available is buying meat in the pack size that suits the week, so the shop should choose it.

## Decisions

- Only meat gets a choice of packs (Evan: "just the meat").
- Leftovers count as waste (Evan: "treat any leftover as waste"), so a big pack is bought only when it's cheaper even after losing what's left.
- Extra-lean mince stays 5-star 500g: no bigger pack exists, and 4-star adds fat for about 17c a serve (Evan's order: targets, then cost, then taste).
- Coles ham changes from Don Leg Ham Shaved 200g ($6.60) to The Deli Shaved Leg Ham 250g ($6.00, $24/kg). Label per 100 g: 90 kcal, 14.8 g P, 2.2 g C, 2.1 g F.

## Packs found (checked 2026-10-18)

| Item | Store | Packs |
| --- | --- | --- |
| Chicken breast | Coles | 1.4kg $15.40 (main), 600g $8.70 (already the `small` pack) |
| Chicken breast | Woolworths | 650g $9.40 (main), new: 1.5–2.2kg tray, stockcode 969723, $24.20 up front at $11/kg |
| Chicken thigh | Coles | 1.2kg $17.40 (main), 700g $12.60 (already `small`) |
| Chicken thigh | Woolworths | 550g $9.90 (main), new: 1.2–1.8kg tray, stockcode 727622, $26.10 up front at $14.50/kg |
| Ham | Coles | The Deli Shaved Leg Ham 250g $6.00 (replaces Don 200g) |

The trays are variable weight: Woolworths charges the heaviest weight and refunds the difference. A tray's `size` is its lightest weight (so the shop never runs short) and its `price` is the up-front charge.

## Design

- **Data:** a store product may have `packs: [product, ...]`, other pack sizes of the same food, each with the usual fields (`name, url, size, price, checked`, Woolworths `stockcode`) plus optional `sizeLabel` (e.g. `"1.5–2.2kg tray"`, used in "Buy" text instead of the size). The Coles `small` field becomes a one-item `packs` list.
- **Choosing:** for an item with packs, each candidate (the main product and each pack) gets `n = max(1, ceil((need − 50) / size))` packs (the existing 50 g slack for approximate weights), cost `n × price`, and waste `(n × size − need) / size × price` when positive. The lowest cost + waste wins; ties go to the earlier candidate (main first). Items without packs are unchanged. For Coles breast and thigh this mostly matches the old small-pack rule but not always: e.g. 1540 g breast now buys 3 × 600g ($26.10) instead of 2 × 1400g ($30.80), and 1160–1210 g buys 2 × 600g, paying about $2 more to waste less (Evan's "leftovers count as waste").
- **Meal cost:** a meal's ingredient cost uses the cheapest price per unit among the store's main product and its packs.
- **Live prices:** Coles live prices apply to every pack (as `small` does today); an unavailable main product falls back to its first available pack. Woolworths live prices apply to the main product only; trays keep their checked price because a by-weight tray's live `Price` may be per kg, but their live availability is used: an unavailable tray is dropped, and an unavailable main product falls back to an available tray.
- **Lookups:** everything that finds a product by Coles id or Woolworths stockcode (price refresh ids, trolley product names, removal lines, checked dates) searches the main product and its packs.
- **Trolley:** unchanged. It sends whichever product the shop chose; switching between a pack and the main product removes the old one (existing removal lines).

## Out of scope

Mixing pack sizes in one row (e.g. one tray plus one 650g pack); other foods; the rice pouches (Evan keeps them).

## Owner check

Send a Woolworths trolley for a week with a chicken lunch every day and confirm one breast tray arrives as one tray (not 1 kg). Harmless: it only edits the trolley.
