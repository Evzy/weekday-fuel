# Label photo reminders

Evan, 2026-10-27: "keep these in a list, also in the app so I'm reminded to take a photo of them when I'm cooking or have the ingredient ... just to make it easy to keep it updated."

## Goal

Remind Evan to photograph nutrition panels that the exact-macros work couldn't confirm online, at the moments he has the pack in hand. The list maintains itself: when a panel is updated from a photo, its reminder disappears.

## Decisions (Evan)

- Items: every flagged label a photo can fix, not just the original six.
- Places: a Label photos list in Kitchen, a tag on the Kitchen item line, and a line in the meal's cooking steps.
- No "photo taken" tick: the reminder stays until an app update replaces the panel.

## Source of truth

- Research rows in `docs/research/labels-{a,b,c}.json` get an optional `photo` string: the one thing to check, in plain words (e.g. "Does the panel say drained or as canned?").
- `scripts/build-macro-panels.mjs` copies `photo` onto the generated panel in `macros.js`.
- Products with no usable panel (Grenade Cookie Dough bar, `gr-cookie`) can't carry a panel field. The build also emits `PHOTOS`: a list of `{ id, store, product, photo }` for research rows that have `photo` but no panel. The swap stays hidden.
- Clearing a reminder = remove `photo` from the research row, update the figures, regenerate.

## Which items get `photo`

Labels a photo resolves: corn (both stores), curry paste (Woolworths only), ginger paste (cached page, both stores), English muffins (both stores), honey (Woolworths only), oyster sauce (both stores), spinach (Woolworths only), the three Woolworths frozen veg packs (fzmix, fzbroc, fzberry — fat/protein may be printed as &lt;1g), Coles oil spray, Coles chicken breast (uses the Woolworths panel), Grenade Cookie Dough bar. Potato is excluded (no official unpeeled figure; a photo doesn't help). Coles panels for curry, honey, spinach, and the three frozen veg lines are not flagged when the online panel is unambiguous. Existing `confirm` flags stay as they are where still needed; `photo` is separate.

## App

- A small pure helper (new `label-photos.js`, exported for Node tests) builds the list for a store from PANELS + PHOTOS + catalogue: one entry per item `{ id, product, photo }`, only for the given store's product (falls back to an `any` panel). Breast on Coles shows only when the Coles store is selected.
- **Kitchen:** a "Label photos" card listing `product: photo`, hidden when empty. Intro line: "Snap these nutrition panels next time you have them, then send them over."
- **Kitchen item line:** items with a reminder show a `Snap the label` tag (title = the photo text).
- **Cooking steps (meal detail):** if the meal's ingredients or extras for the shown tier include a flagged item, add a final line: "While you cook: snap the label on <product> (<photo>)." One line per item.
- Every dynamic string goes through `esc`. No storage changes.

## Tests

- New `label-photos.test.js` (added to the CI test list): every research row with `photo` appears in the list for its store; nothing without `photo` appears; store filtering works (Coles spray absent on Woolworths); `gr-cookie` appears though it has no panel; potato absent.

## Out of scope

Uploading photos in the app; ticking photos off.
