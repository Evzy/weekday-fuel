# Week arrows — design

**Status:** approved 2026-10-16; v0.7.1 released 2026-10-16, owner phone checks pending
**Scope:** The arrows above the week strip on the Today tab move a week at a time, and a "Today" button brings you back. Nothing else changes.
**Release:** v0.7.1

## Goal

The arrows above the week strip move one day at a time, which duplicates the strip itself: any day of the shown week is already one tap away. Looking ahead or back a week (planning next week, checking last week) takes up to seven taps. After this, each arrow moves a whole week, and getting back to today is one tap.

## Decisions (owner, 2026-10-16)

| Question | Decision |
| --- | --- |
| Which day is selected after a jump | The same weekday: Thursday 15 Oct goes to Thursday 22 Oct (right) or Thursday 8 Oct (left). |
| A way back to today | A small "Today" button next to the arrows, shown only when the selected day isn't today. |

## Design

All in `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`, in the header row built at the top of the Today view.

1. **Arrows.** The two `iconbtn` buttons keep their icons and the `shift` action, with `data-v` `-7` and `7` instead of `-1` and `1`. Their `aria-label`s become "Previous week" and "Next week". The `shift` handler is unchanged (`state.date=addDays(date,+v)` and it closes the add-a-meal form), so a jump keeps the weekday and crosses month and year boundaries like any date step.
2. **Today button.** When `state.date` isn't today (`iso(new Date())`), a third button follows the arrows inside `.daynav`: `<button class="ghost" data-act="goto" data-v="<today>">Today</button>`, reusing the existing `goto` action. It isn't rendered when today is selected.
3. **Unchanged.** The week strip (tapping a day), the "Today"/"Planning" eyebrow and the date heading on the right, storage, the catalogue, the Android host, and the other tabs.

## Testing

- JS tests (`node --test "apps/android/app/src/test/js/*.test.js"`) and the inline-script parse check still pass; nothing here is in a tested module.
- Browser check on the local page (no host needed):
  - From today, right arrow selects the same weekday a week later, the strip shows that week, and the "Today" button appears; left arrow twice selects the same weekday a week before today.
  - From Thursday 29 Oct, right arrow selects Thursday 5 Nov.
  - "Today" selects today and disappears.
  - The arrows' accessible names are "Previous week" and "Next week".

## Out of scope

Swipe gestures, a date picker, and changing the week strip.
