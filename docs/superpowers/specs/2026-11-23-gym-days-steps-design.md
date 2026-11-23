# Gym days and steps

Date: 2026-11-23. Approved by Evan in chat.

## Problem

The calorie targets were set for push/pull/legs five days a week plus two runs. Evan isn't training right now, eats to the mini-cut target of 2,150 kcal, and feels very full; dropping a meal works better. At ~83.5 kg / 183 cm / 30 with a desk job and normal walking, maintenance is roughly 2,300–2,450 kcal, so 2,150 is a small deficit at best on a non-gym day. Training adds roughly 250–300 kcal for an hour of resistance work.

Evan wants step counts from Samsung Health and a simple "did I go to the gym" record, and targets that follow activity.

## Decisions

- Every day is planned at a **rest-day** target. Rest days already assume normal walking.
- **Gym** is a manual tick (about an hour of resistance training; no sets/reps, no workout app integration). It can be set ahead in Week or on the day in Today. A gym day gets a fixed bonus and its portions re-fit.
- **Steps** come from Health Connect (Samsung Health writes steps there), read-only, displayed only. They don't change targets in this version.
- Mini-cut: 1,900 rest / 2,150 gym. Protein stays 170 g every day.
- Weekends stay untracked.

## Targets

`DEFAULT_SETTINGS.kcal` becomes the rest-day value per mode: `{ cut: 1900, recomp: 2250, bulk: 2550 }`. New setting `gymBonus: 250`.

`target(date)`:

- base `k = kcal[mode] + adjust` (unchanged meaning: rest day).
- if `state.days[date].gym === true`, add `gymBonus`.
- the existing per-day `adj` (spread from another day) still applies on top.

`targetAdjLabel(date)` adds ` · +250 gym` (actual bonus) when the day is a gym day, before any spread/from label.

Targets screen: the mode kcal fields are labelled as rest-day targets ("Mini-cut kcal (rest day)" etc.), plus a new "Gym day bonus" number field (`data-set="gymBonus"`, step 50). The "Now:" line reads "Rest day N kcal, gym day M kcal, P g protein". The first-run setup card uses the same rest-day wording.

### One-time settings update

Settings flag `restTargets` (additive, optional). On boot (in `initStore` with the other run-once migrations, and again when synced settings arrive without the flag), if `restTargets !== true`:

- For each mode, if the saved value equals the old default (cut 2150, recomp 2500, bulk 2800), set it to the new default (1900, 2250, 2550).
- If any saved mode value differs from its old default, leave it and set a one-off note on Today: "Your kcal targets are now rest-day targets; gym days add 250. Check your numbers in Targets." (shown until dismissed or Targets is opened).
- Set `gymBonus` to 250 if missing, set `restTargets = true`, save settings.

The weigh-in trend nudge (`adjust`, ±150) is untouched and applies to both rest and gym days.

## Gym day

Day record field `gym: true` (additive, optional; absent = rest day). Synced and backed up with the day like other day fields.

UI:

- Today: a "Gym today" toggle near the target line (`data-act="gym"`, `aria-pressed`).
- Week: the day menu (`daymenu`) gets "Gym day" / "Not a gym day".
- Both show the target with the `+250 gym` label.

Toggling (on or off) for a date:

1. Set or delete `day.gym`, `saveDay(date)`.
2. If the day has meals, re-fit portions for that date with the same fitter used by "Fit portions" for that date, at the new target. Meals already eaten or otherwise fixed (whatever the existing fitter treats as locked: bought tiers, ate flags, `locked` count) are not changed.
3. Show a short note: "Gym day: portions re-fitted to N kcal." / "Rest day: portions re-fitted to N kcal." If nothing changed: "Portions already fit N kcal."

Turning gym on for a day with no meals just changes the target.

## Steps

### Android (Kotlin, CI-compiled only)

- Dependency `androidx.health.connect:connect-client` (stable 1.1.x) in `gradle/libs.versions.toml` and `app/build.gradle.kts`.
- Manifest: `<uses-permission android:name="android.permission.health.READ_STEPS" />`; a `<queries>` entry for package `com.google.android.apps.healthdata`; a permissions-rationale activity (handles `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`) and an `activity-alias` `ViewPermissionUsageActivity` (action `android.intent.action.VIEW_PERMISSION_USAGE`, category `android.intent.category.HEALTH_PERMISSIONS`, permission `android.permission.START_VIEW_PERMISSION_USAGE`) targeting it. The rationale screen is a plain native screen with one paragraph: the app reads step counts only, to show them next to your meals; nothing leaves the phone.
- New `steps/` package:
  - `StepsMessages.kt`: parse page messages and build replies (pure, unit-tested).
  - `HealthSteps.kt`: availability check (`HealthConnectClient.getSdkStatus`), permission check, permission request via `PermissionController.createRequestPermissionResultContract()`, and daily totals via `aggregateGroupByPeriod` on `StepsRecord.COUNT_TOTAL` over local-date days.
- Page messages (accepted only through the existing `WeekdayFuelHost` listener restricted to `https://appassets.androidplatform.net`, main frame):
  - `{type:"stepsStatus"}` → reply `{type:"steps", status}`.
  - `{type:"stepsConnect"}` → launches the Health Connect permission request; on result, reply as for `stepsRead` of the last 8 days.
  - `{type:"stepsRead", from:"YYYY-MM-DD", to:"YYYY-MM-DD"}` (max 31 days; invalid dates rejected) → reply `{type:"steps", status:"ok", days:{"YYYY-MM-DD": count, ...}}`.
  - `status` is one of `ok`, `noPermission`, `unavailable` (Health Connect not installed/supported), `updateRequired`, `error`.
- No other health data types. Nothing is written to Health Connect. Store pages (Woolworths/Coles WebViews) get no bridge, as today.

### Page

- New module `steps.js` (`WeekdayFuelSteps`): pure helpers for the cache and messages: `mergeReply(cache, reply)`, `countFor(cache, date)`, `avg7(cache, endDate)`, `rangeToRead(today)` (last 8 days), `formatSteps(n)` ("8,412").
- Cache in localStorage key `weekdayfuel.steps` (device-only, not synced, not in backups): `{ days: { date: count }, status, at }`. Additive; absent = never connected.
- On boot and when the app becomes visible again (`visibilitychange`), if `window.WeekdayFuelHost` exists, post `stepsRead` for `rangeToRead(today)`. Replies update the cache and re-render.
- Display:
  - Today: "8,412 steps today" under the target line. If status `noPermission` or never connected: a "Connect steps" link (`data-act="stepsconnect"`). If `unavailable`/`updateRequired`: "Steps need Health Connect" (one line, muted).
  - Week: each day's kcal line gets " · 8,412 steps" when a count exists for that date.
  - Weigh: next to the 7-day weight average, "7-day steps avg 8,100" when at least 4 of the 7 days have counts.
  - Targets: a "Steps" row with status and a "Connect steps" button; if connected but today reads 0 by evening, the hint: "No steps? In Samsung Health › Settings › Health Connect, allow Steps."
- Steps never change targets, fitting, the shop or kitchen.

## Errors

- Any steps failure only affects the steps line; planning, targets and shop work without it.
- Malformed host replies are ignored (the merge helper validates date keys and non-negative integer counts).

## Tests

JS (`node --test`; add new files to `.github/workflows/release-android.yml`):

- `target()` adds `gymBonus` on gym days, not on rest days; combines with `adjust` and per-day `adj`.
- Settings update: old defaults move to new; custom values stay and raise the note; idempotent once `restTargets` is set; missing `gymBonus` gets 250.
- Gym toggle re-fits only unlocked meals toward the new target, and toggling back restores a rest-day fit.
- `steps.js`: merge validates and overwrites by date, `avg7` needs ≥4 days, `rangeToRead` returns the last 8 local dates, formatting.
- Page boot test: steps request is only posted when `WeekdayFuelHost` exists.

Kotlin (JUnit, CI): `StepsMessages` parsing (valid/invalid types, date range limits, max 31 days) and reply JSON shape.

Manual on Evan's phone: Connect steps → Health Connect permission screen → today's count matches Samsung Health within its sync delay.

## Out of scope

Steps adjusting targets; workout logging or other apps (Liftoff); weekend tracking; active-calorie or exercise data from Health Connect.
