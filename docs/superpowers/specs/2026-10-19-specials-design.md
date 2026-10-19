# Specials from approved alternatives

Evan, 2026-10-19: keep a preferred product per item (e.g. Dare), plus a list of approved alternatives from other brands (Rokeby, Ice Break Protein, Pauls protein milk; Grenade flavours he likes). When an alternative is on special and cheaper, the shop asks whether to use it instead. A big money saver on drinks and bars.

## Decisions (Evan)

- The main product stays preferred. Alternatives come only from a list Evan approved; nothing is discovered automatically.
- When an approved alternative is on special and works out cheaper, the shop **asks**; it never swaps by itself.
- Nutrition guard: an alternative qualifies only if, per serve, protein is at most 5 g lower and calories at most 80 kcal higher than the main product. The rest of the day absorbs differences that size, so day totals keep the main item's macros.
- Option 1: alternatives belong to the catalogue item (for macros and Kitchen stock a Rokeby bought for Dare counts as Dare).

## Approval process

1. On request (first: Dare and Grenade), the agent researches alternatives at Woolworths and Coles: product name, both stores' ids/URLs, pack size, serves per pack, and label macros per serve.
2. The agent shows Evan a table: each candidate's kcal and protein per serve against the main product, and whether it passes the guard.
3. Only alternatives Evan approves are added to `catalogue.js`. Adding one is a data change (no app code), checked by catalogue tests.

## Data (`catalogue.js`)

On an item, optional `alts`:

```js
alts: [{
  id: "rokeby-espresso",          // unique within the item
  name: "Rokeby Protein Smoothie Espresso 2 × 375mL",
  serves: 2,                      // amount of the main item, in its unit, one pack replaces (2 bottles here)
  per: { k: 210, p: 30 },         // label macros per serve
  woolies: { name, url, stockcode, price, checked },   // either or both stores
  coles: { name, url, price, checked },
}]
```

- The main item gets `per: { k, p }` too (per serve; for Dare 296/30, Grenade 244/20.5) so the guard can compare. Items with `alts` must have `per`.
- (The pack-size field `packs` from v0.11 is unrelated and unchanged.)

## Price checks

- The Woolworths and Coles price requests include every alternative's stockcode / product id. Results land in the existing price caches; `applyLivePrices` / `applyColesPrices` also update `alts[].woolies` / `alts[].coles` (price, was, special, available), leaving the main product logic as it is.

## Suggesting (pure, `specials.js`, ES5, tested)

`suggest(row, store, muted)` → the best alternative or `null`, for a shop row at the chosen store:

- Candidates: alternatives with a product at that store that is `special: true` and `available !== false`, not in `muted`, and passing the guard (`per.p >= main.per.p − 5` and `per.k <= main.per.k + 80`).
- Each candidate's line: `quantity = ceil(row's remaining need in serves / alt.serves)`, `cost = quantity × price`.
- A candidate qualifies when its cost is lower than the row's current main line cost at that store. The cheapest qualifying candidate wins (ties: the first listed).
- Returns `{ alt, quantity, cost, saving, dk, dp }` (`dk`/`dp`: per-serve kcal and protein difference vs the main).

## Shop screen

- A row with a suggestion shows under its Buy line: "On special instead: {alt name}, {quantity} × ${price} (save ${saving}) · +{dk} kcal, {dp}g protein per serve" with **Use it** and **Keep {short main name}**.
- **Use it**: the row's line at that store becomes the alternative (`quantity`, `cost`, `product` = the alternative's store product) for this shop. Totals, trolley lines, Coles cart, saved order and stock-in (as the main item, amount = quantity × serves) all use it.
- **Keep**: hides the suggestion for this shop.
- Choices live in `localStorage["weekdayfuel.v1.specials"]` as `{ itemId: { use: altId } | { keep: true } }` and are cleared by "Save order and start next shop". A choice is ignored when the alternative is no longer on special or no longer qualifies (the row goes back to the main product and may suggest again).
- The shop fingerprint includes the chosen alternatives (so a sent trolley shows out of date if the choice changes).

## Item info and muting

- The item's info sheet (tap the item in the Shop) lists its alternatives with price, special badge, kcal/protein per serve and a "Don't suggest" switch. Muted ids live in settings `mutedAlts: [ "item:altId" ]` (additive).

## Testing

- `specials.test.js` (CI list): guard boundaries (−5 g / +80 kcal pass, beyond fail), not on special, unavailable, muted, other store only, quantity rounding with `serves`, cheaper-only, tie order.
- Catalogue tests: every `alts` entry has a unique id, `serves` ≥ 1, `per`, at least one store product with a valid id; items with `alts` have `per`.
- Price tests: alternatives' ids requested and live data applied to `alts`.
- Order/stock-in tests: a used alternative is ordered under its own product and stocked as the main item.

## Owner checks

When Rokeby (or another approved alternative) is on special, the Dare row offers it; Use it changes the trolley line; the saved order lists the alternative; the Kitchen shows Dare stock.

## Approved alternatives (owner, 2026-10-19)

All pass the loose macros guard. Figures per serve; W = Woolworths stockcode, C = Coles id.

**Dare Protein Double Espresso 500mL (main):**
- Dare Protein Mocha 500mL: 292 kcal / 30 g (W 6074551, C 1608570)
- Pauls Plus+ Protein Double Espresso Caramel 400mL: 270 / 30 (W 6049883, C 1439928)
- Rokeby Protein Smoothie Double Espresso 425mL: 292 / 30.2 (W 771267, C 6258498)
- Oak Plus Protein Salted Caramel 500mL: 304 / 30 (W 6048422, C 1043778)
- Ice Break Strong Espresso + Protein 500mL: 347 / 30 (C 7850783; W 805966 may be delisted, often out of stock)

**Grenade Choc Chip Salted Caramel 60g (main):**
- Grenade Oreo 60g: 253 / 20.9 (W 286090, C 6509780)
- Grenade White Oreo 60g: 253 / 20.7 (W 6028961, C 9968718)
- Grenade Choc Chip Cookie Dough 60g: ~208 / 21 (W 6043930 only; UK label, AU label unverified)
- Musashi Protein Crisp Vanilla Caramel 60g: 239 / 20.1 (W 153264, C 4292429)
- Musashi Protein Crisp White Choc Salted Caramel 60g: 256 / 21.3 (W 6014680, C 9958500)
- Musashi Protein Crisp White Choc Cookies & Cream 60g: 256 / 20.7 (W 555158, C 7875897)
- BSc High Protein Low Carb Cookies & Cream 60g: 207 / 19.2 (C 3125148 only)
