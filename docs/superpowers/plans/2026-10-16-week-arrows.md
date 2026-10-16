# Week Arrows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-16-week-arrows-design.md`](../specs/2026-10-16-week-arrows-design.md)

**Goal:** The arrows above the week strip on Today move a week at a time (same weekday), and a "Today" button appears when another day is selected.

**Architecture:** One line of `Weekday_Fuel.html` (the header row at the top of the Today view) changes: the two `shift` buttons get `data-v` `-7`/`7` and week labels, and a `ghost` button with the existing `goto` action is added when the selected day isn't today. No handler, storage or Android changes.

**Tech Stack:** plain browser JS in a single HTML file, Node built-in test runner, GitHub Actions.

## Global Constraints

- Only `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` changes in Task 1.
- Commit straight to `main` with the prefix `week:` (release commit: `release: v0.7.1`). After each push CI must be green before the next task.
- JS tests run locally with `node --test "apps/android/app/src/test/js/*.test.js"` (keep the quotes); 112 pass today.
- Bump the version only in Task 2.
- Do not touch `platra/`, the keystore, `local.properties` or `docs/seed/`. Do not stage anything under `.superpowers/`; stage files by explicit path.

### Watching CI after a push (PowerShell)

```powershell
Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status *> $null; "CI $id exit $LASTEXITCODE"
```

`exit 0` means green. Otherwise read `gh run view $id -R Evzy/weekday-fuel --log-failed`, fix, push again.

---

### Task 1: Week arrows and Today button

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` (the `let h=` line right after `const isToday=date===iso(new Date());` in the Today view, around line 737)

**Interfaces:**
- Consumes: existing actions `shift` (`state.date=addDays(date,+v)`, closes the add-a-meal form) and `goto` (`state.date=v`); existing `iso(date)`, `ICON.left`, `ICON.right`, CSS classes `daynav`, `iconbtn`, `ghost`.
- Produces: nothing new for other code.

- [ ] **Step 1: Replace the header line.** The current line is:

```js
  let h=`<div class="row between"><div class="daynav"><button class="iconbtn" data-act="shift" data-v="-1" aria-label="Previous day">${ICON.left}</button><button class="iconbtn" data-act="shift" data-v="1" aria-label="Next day">${ICON.right}</button></div><div class="grow" style="text-align:right"><div class="eyebrow">${isToday?"Today":"Planning"}</div><h2>${fmtDay(date)}</h2></div></div>`;
```

Replace it with:

```js
  let h=`<div class="row between"><div class="daynav"><button class="iconbtn" data-act="shift" data-v="-7" aria-label="Previous week">${ICON.left}</button><button class="iconbtn" data-act="shift" data-v="7" aria-label="Next week">${ICON.right}</button>${isToday?"":`<button class="ghost" data-act="goto" data-v="${iso(new Date())}">Today</button>`}</div><div class="grow" style="text-align:right"><div class="eyebrow">${isToday?"Today":"Planning"}</div><h2>${fmtDay(date)}</h2></div></div>`;
```

- [ ] **Step 2: Confirm nothing else used the day labels.** Search the HTML for `Previous day` and `Next day`; expect no matches.

- [ ] **Step 3: Run JS tests and the inline-script parse check (PowerShell).**

```powershell
node --test "apps/android/app/src/test/js/*.test.js"
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

Expected: 112 pass, 0 fail; `node --check` prints nothing and exits 0.

- [ ] **Step 4: Commit, push, watch CI.**

```powershell
git pull --rebase origin main
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "week: Today's arrows jump a week on the same weekday, with a Today button to come back"
git push
```

Then watch CI as above.

- [ ] **Step 5 (controller): browser check.** Serve `apps/android/app/src/main/assets` on `127.0.0.1:8123`, open `weekday_fuel/Weekday_Fuel.html` and check:
  - On today: no "Today" button. Right arrow selects the same weekday 7 days later, the strip shows that week, the eyebrow says "Planning", and the "Today" button appears.
  - Left arrow twice from there selects the same weekday 7 days before today.
  - Select Wednesday 29 Oct 2026 (via `goto`), right arrow selects Wednesday 5 Nov.
  - "Today" selects today and disappears.
  - The arrows' accessible names are "Previous week" and "Next week".

---

### Task 2: Release v0.7.1

**Files:**
- Modify: `apps/android/app/build.gradle.kts` (`versionCode`, `versionName`)
- Modify: `docs/superpowers/specs/2026-10-16-week-arrows-design.md` (status line)

- [ ] **Step 1:** In `build.gradle.kts` change `versionCode = 12` to `versionCode = 13` and `versionName = "0.7.0"` to `versionName = "0.7.1"`.
- [ ] **Step 2:** In the spec, change `**Status:** approved 2026-10-16` to `**Status:** approved 2026-10-16; v0.7.1 released 2026-10-16, owner phone checks pending`.
- [ ] **Step 3: Commit, push, watch CI, check the release.**

```powershell
git add apps/android/app/build.gradle.kts docs/superpowers/specs/2026-10-16-week-arrows-design.md
git commit -m "release: v0.7.1"
git push
```

Watch CI as above, then:

```powershell
gh release view v0.7.1 -R Evzy/weekday-fuel-releases --json tagName,assets --jq '.tagName, .assets[].name'
```

Expected: `v0.7.1` and `WeekdayFuel-v0.7.1-debug.apk`.
