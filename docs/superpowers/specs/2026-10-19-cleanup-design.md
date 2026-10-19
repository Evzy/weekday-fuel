# Cleanup pass (v0.20.0)

Evan, 2026-10-19: third of the UI simplifications (staples, cart, then this). Make the app shorter and calmer now that he knows it.

## Decisions (Evan)

- **Targets behind a gear.** A gear button (⚙, `aria-label="Targets"`) in the header, beside the sync status, opens the Targets view. The Targets tab is removed, leaving 5 tabs: Today, Weigh-in, Meals, Shop, Kitchen. The Targets view gets a "Back" control; while it is open no tab is highlighted. Any existing navigation to `targets` (e.g. from Weigh-in or Today notes) still works. The page content is unchanged.
- **"Fixtures" becomes "Staples"** in the shop list's first section heading.
- **Remake filter chip removed** from Meals. The small "Remake" tag stays on meal cards and Today rows. A stored filter of `remake` falls back to "All".
- **Batch prep panel shrinks** to one compact row: the eyebrow "Batch prep" and a chip per batch (its name) that opens the batch recipe sheet. The makes/keeps detail stays in the sheet.
- **Explanation text trimmed.** Every multi-sentence explanatory paragraph becomes one short line or is removed, judged case by case. Instructions needed to act (errors, confirmations, trolley/checkout safety text, notes after an action) stay. Known candidates: the Meals intro, the week planner blurb ("Plans the weekdays so meals share…"), the weekend card, the Shop tick-off text, the Targets footnote.

## Constraints

- No storage shape changes. Settings keys keep their meaning.
- Strings derived from meals, stores or the catalogue still go through `esc`.
- No behaviour changes beyond the above; tests stay green and CI passes.

## Testing

- Existing suite plus inline-script parse check.
- Browser check at 400×860: header gear opens Targets and Back returns; 5 tabs; Meals filter chips without remakes; batch row opens a recipe; Shop "Staples" heading.
