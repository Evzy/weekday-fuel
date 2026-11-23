# Gym days and steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rest-day/gym-day calorie targets with a manual gym tick that re-fits portions, plus read-only daily steps from Health Connect shown in Today, Week, Weigh and Targets.

**Architecture:** Two new pure JS modules (`targets.js` for target maths and the one-time settings update; `steps.js` for the steps cache) are loaded by `Weekday_Fuel.html`, which wires UI and host messages. On Android, a new `steps` package wraps Health Connect behind three page messages on the existing `WeekdayFuelHost` listener.

**Tech Stack:** Plain JS UMD modules + `node --test`; Kotlin, AndroidX Health Connect `connect-client`, JUnit (CI only).

Spec: `docs/superpowers/specs/2026-11-23-gym-days-steps-design.md`.

## Global Constraints

- Commit straight to `main` and push; stage by explicit path only. Never `git stash`, `git clean`, `git reset --hard`.
- Do not stage the pre-existing CRLF-only working-tree changes: `apps/android/app/src/main/assets/coles/prices.js`, `apps/android/app/src/main/assets/woolworths/prices.js`, `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/ColesPricesModels.kt`, `.../coles/ColesUrls.kt`, `.../woolworths/PricesModels.kt`, `apps/android/app/src/test/java/dev/weekdayfuel/app/coles/ColesUrlsTest.kt`, `.../woolworths/PricesJsonTest.kt`, `.../woolworths/WoolworthsUrlsTest.kt`, `apps/android/app/src/test/js/coles-prices.test.js`, `apps/android/app/src/test/js/prices.test.js`.
- Don't touch `platra/`, keystore, `local.properties`, `docs/seed/`, `.superpowers/`.
- No version bump until Task 6.
- No local Android SDK/Java: Kotlin is compiled and unit-tested only in CI (`.github/workflows/release-android.yml`). After pushing a Kotlin task, watch CI: `gh run list -R Evzy/weekday-fuel -L 1` then `gh run watch <id> -R Evzy/weekday-fuel --exit-status`. Emulator flakes: `gh run rerun <id> --failed -R Evzy/weekday-fuel`.
- Only origin `https://appassets.androidplatform.net` (main frame) may message the host. Woolworths/Coles WebViews never get a bridge.
- Escape dynamic strings in HTML with `esc`. localStorage/settings/day changes are additive optional fields only. HTML stays UTF-8 without BOM.
- New JS test files must be appended to the `node --test` line in `.github/workflows/release-android.yml`.
- Full suite: `node --test "apps/android/app/src/test/js/*.test.js"`. Parse check: extract the last `<script>…</script>` of `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` to a temp file outside the repo and `node --check` it.
- Don't kill processes you didn't start.

---

### Task 1: `targets.js` — gym bonus and the one-time settings update

**Files:**
- Create: `apps/android/app/src/main/assets/weekday_fuel/targets.js`
- Create: `apps/android/app/src/test/js/targets.test.js`
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` (script tag; `DEFAULT_SETTINGS`; `target()`, `gapTargetOn()`, `targetAdjLabel()`; `initStore` + settings snapshot; Targets screen + setup card; Today note)
- Modify: `.github/workflows/release-android.yml` (add `targets.test.js`)

**Interfaces:**
- Produces `WeekdayFuelTargets` (UMD; `module.exports` in node, `root.WeekdayFuelTargets` in the page):
  - `OLD_DEFAULTS = { cut: 2150, recomp: 2500, bulk: 2800 }`, `NEW_DEFAULTS = { cut: 1900, recomp: 2250, bulk: 2550 }`, `GYM_BONUS = 250`
  - `forDay(settings, day) → { k, p }` — `k = kcal[mode] + adjust + (day && day.gym === true ? gymBonus : 0) + (day && day.adj && isFinite(day.adj.k) ? day.adj.k : 0)`, `p = protein`. `gymBonus` falls back to 250 when not a finite number.
  - `gymLabel(settings, day) → string` — `" · +250 gym"` (actual bonus) when `day.gym === true`, else `""`.
  - `migrate(settings) → { settings, changed, note }` — pure (returns a new object).

- [ ] **Step 1: Write the failing tests** (`targets.test.js`)

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../../main/assets/weekday_fuel/targets.js");

const base = () => ({ mode: "cut", kcal: { cut: 1900, recomp: 2250, bulk: 2550 }, protein: 170, adjust: 0, gymBonus: 250, restTargets: true });

test("rest day is the mode kcal plus adjust", () => {
  const s = Object.assign(base(), { adjust: -150 });
  assert.deepEqual(T.forDay(s, {}), { k: 1750, p: 170 });
  assert.deepEqual(T.forDay(s, null), { k: 1750, p: 170 });
});

test("gym day adds the bonus, and per-day adj still applies", () => {
  const s = base();
  assert.equal(T.forDay(s, { gym: true }).k, 2150);
  assert.equal(T.forDay(s, { gym: true, adj: { k: -100 } }).k, 2050);
  assert.equal(T.forDay(s, { gym: false }).k, 1900);
  assert.equal(T.forDay(Object.assign(base(), { gymBonus: undefined }), { gym: true }).k, 2150);
});

test("gym label shows the actual bonus", () => {
  assert.equal(T.gymLabel(base(), { gym: true }), " · +250 gym");
  assert.equal(T.gymLabel(Object.assign(base(), { gymBonus: 300 }), { gym: true }), " · +300 gym");
  assert.equal(T.gymLabel(base(), {}), "");
});

test("migrate moves old defaults to rest-day defaults", () => {
  const r = T.migrate({ mode: "cut", kcal: { cut: 2150, recomp: 2500, bulk: 2800 }, protein: 170, adjust: 0 });
  assert.deepEqual(r.settings.kcal, { cut: 1900, recomp: 2250, bulk: 2550 });
  assert.equal(r.settings.gymBonus, 250);
  assert.equal(r.settings.restTargets, true);
  assert.equal(r.changed, true);
  assert.equal(r.note, null);
});

test("migrate keeps custom values and returns the check note", () => {
  const r = T.migrate({ mode: "cut", kcal: { cut: 2000, recomp: 2500, bulk: 2800 }, protein: 170, adjust: 0 });
  assert.deepEqual(r.settings.kcal, { cut: 2000, recomp: 2250, bulk: 2550 });
  assert.equal(r.note, "Your kcal targets are now rest-day targets; gym days add 250. Check your numbers in Targets.");
});

test("migrate is a no-op once restTargets is set", () => {
  const s = Object.assign(base(), { kcal: { cut: 2150, recomp: 2500, bulk: 2800 } });
  const r = T.migrate(s);
  assert.equal(r.changed, false);
  assert.deepEqual(r.settings.kcal, s.kcal);
});

test("migrate does not mutate its input", () => {
  const s = { mode: "cut", kcal: { cut: 2150, recomp: 2500, bulk: 2800 }, protein: 170, adjust: 0 };
  T.migrate(s);
  assert.equal(s.kcal.cut, 2150);
  assert.equal(s.restTargets, undefined);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test apps/android/app/src/test/js/targets.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement `targets.js`**

```js
/* Rest-day / gym-day calorie targets and the one-time rest-target settings update. */
(function (root) {
  "use strict";

  var OLD_DEFAULTS = { cut: 2150, recomp: 2500, bulk: 2800 };
  var NEW_DEFAULTS = { cut: 1900, recomp: 2250, bulk: 2550 };
  var GYM_BONUS = 250;
  var NOTE = "Your kcal targets are now rest-day targets; gym days add 250. Check your numbers in Targets.";

  function bonus(settings) {
    var b = settings && settings.gymBonus;
    return typeof b === "number" && isFinite(b) ? b : GYM_BONUS;
  }

  function forDay(settings, day) {
    var k = settings.kcal[settings.mode] + (settings.adjust || 0);
    if (day && day.gym === true) k += bonus(settings);
    if (day && day.adj && isFinite(day.adj.k)) k += day.adj.k;
    return { k: k, p: settings.protein };
  }

  function gymLabel(settings, day) {
    return day && day.gym === true ? " · +" + bonus(settings) + " gym" : "";
  }

  function migrate(settings) {
    var s = JSON.parse(JSON.stringify(settings || {}));
    if (s.restTargets === true) return { settings: s, changed: false, note: null };
    var custom = false;
    s.kcal = s.kcal || {};
    Object.keys(OLD_DEFAULTS).forEach(function (m) {
      if (s.kcal[m] === OLD_DEFAULTS[m] || s.kcal[m] == null) s.kcal[m] = NEW_DEFAULTS[m];
      else custom = true;
    });
    if (!(typeof s.gymBonus === "number" && isFinite(s.gymBonus))) s.gymBonus = GYM_BONUS;
    s.restTargets = true;
    return { settings: s, changed: true, note: custom ? NOTE : null };
  }

  var api = { OLD_DEFAULTS: OLD_DEFAULTS, NEW_DEFAULTS: NEW_DEFAULTS, GYM_BONUS: GYM_BONUS, forDay: forDay, gymLabel: gymLabel, migrate: migrate };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelTargets = api;
})(this);
```

- [ ] **Step 4: Run it** → PASS. Add `apps/android/app/src/test/js/targets.test.js` to the CI `node --test` line.

- [ ] **Step 5: Wire it into the page** (`Weekday_Fuel.html`)

1. Add `<script src="targets.js"></script>` next to the other module script tags (near `<script src="trend.js"></script>`).
2. `DEFAULT_SETTINGS`: `kcal:{cut:1900,recomp:2250,bulk:2550}`, add `gymBonus:250,` (do **not** add `restTargets` to the defaults — its absence in saved settings is what triggers the update).
3. Replace the body of `target(date)` with:

```js
function target(date){
  if(!date)return WeekdayFuelTargets.forDay(S(),null);
  return WeekdayFuelTargets.forDay(S(),state.days[date]);
}
```

4. Replace `gapTargetOn(date,daysMap)` with:

```js
function gapTargetOn(date,daysMap){
  const dm=daysMap||state.days;
  return WeekdayFuelTargets.forDay(S(),dm[date]);
}
```

5. `targetAdjLabel(date)`: prefix the existing result with the gym label, i.e. compute `const gym=WeekdayFuelTargets.gymLabel(S(),state.days[date]);` at the top, and return `gym+<existing string>` on every return path (including the early `return ""`, which becomes `return gym`).
6. Add `function runRestTargetsIfNeeded(){const r=WeekdayFuelTargets.migrate(state.settings);if(!r.changed)return;state.settings=deepMerge(DEFAULT_SETTINGS,r.settings);if(r.note)state.targetsNote=r.note;saveSettings()}` near the other `run…IfNeeded` functions, add `targetsNote:null` to the `state` object, and call `runRestTargetsIfNeeded();` in `initStore` right after `runWeighStockIfNeeded();`. In the `config/settings` `onSnapshot` handler, after `state.settings=deepMerge(...)` and the `setupDone` line, call `runRestTargetsIfNeeded();` before `lsSave()`.
7. Today: right after the `renderTodayTrendPanel(today)` line in `renderToday`, add `if(state.targetsNote)h+=`<div class="hint" id="targets-note"><span>${esc(state.targetsNote)}</span> <button type="button" class="ghost" data-act="targets">Targets</button> <button type="button" class="ghost" data-act="targetsnoteok">OK</button></div>`;`. In the click switch add `case "targetsnoteok":state.targetsNote=null;break;` and in `case "targets":` also set `state.targetsNote=null;`.
8. Targets screen (`renderTargets`): labels become `Mini-cut kcal (rest day)`, `Recomp kcal (rest day)`, `Lean bulk kcal (rest day)`; add `<label class="f">Gym day bonus<input class="num" type="number" step="50" id="gymbonus" data-set="gymBonus" value="${s.gymBonus}"></label>` after the bulk field; the "Now:" line becomes `Now: rest day <b class="num">${target().k} kcal</b>, gym day <b class="num">${WeekdayFuelTargets.forDay(s,{gym:true}).k} kcal</b>, <b class="num">${s.protein}g</b> protein. Weigh-in can nudge weekdays ±150 kcal.` Check how the existing `data-set` input handler parses numbers for `kcal.cut`/`adjust` and confirm `gymBonus` goes through the same numeric path.
9. Setup card (`renderSetupCard`): label becomes `${esc(MODES[mode].label)} kcal (rest day)`.

- [ ] **Step 6: Page boot test**

Append to `apps/android/app/src/test/js/page-boot.test.js` (read the file first and follow its pattern for loading the HTML):

```js
test("targets.js loads before the main script and initStore runs the rest-target update", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  assert.ok(html.indexOf('<script src="targets.js"></script>') > -1);
  assert.ok(html.indexOf('<script src="targets.js"></script>') < html.lastIndexOf("<script>"));
  const init = html.slice(html.indexOf("async function initStore(){"));
  assert.ok(init.indexOf("runRestTargetsIfNeeded();") > -1);
});
```

(Use the file's existing names for `fs`/the HTML path constant.)

- [ ] **Step 7: Full suite + parse check**, both green.

- [ ] **Step 8: Commit**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/targets.js apps/android/app/src/test/js/targets.test.js apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html apps/android/app/src/test/js/page-boot.test.js .github/workflows/release-android.yml
git commit -m "Targets: rest-day kcal with a gym day bonus"
git push
```

---

### Task 2: Gym tick in Today and Week, with re-fit

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/targets.js` (add `refitNote`)
- Modify: `apps/android/app/src/test/js/targets.test.js`
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: `WeekdayFuelTargets.forDay`, `gymLabel` (Task 1); page `fitTiers(day,locked,date,opts)`, `ensureDay`, `saveDay`, `dayEditable`, `dayHasMeals`, `todayNote`, `dayNote`.
- Produces: `WeekdayFuelTargets.refitNote(gym, k, changedCount) → string`; page function `setGymDay(date, on)`; click acts `gym` (data-d, data-v "1"/"0").

- [ ] **Step 1: Failing test** (append to `targets.test.js`)

```js
test("refit note wording", () => {
  assert.equal(T.refitNote(true, 2150, 2), "Gym day: portions re-fitted to 2150 kcal.");
  assert.equal(T.refitNote(false, 1900, 1), "Rest day: portions re-fitted to 1900 kcal.");
  assert.equal(T.refitNote(true, 2150, 0), "Portions already fit 2150 kcal.");
  assert.equal(T.refitNote(true, 2150, -1), "Gym day: target 2150 kcal.");
});
```

`changedCount` of `-1` means "the day has no meals to fit".

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** in `targets.js` and export it:

```js
  function refitNote(gym, k, changed) {
    var kind = gym ? "Gym day" : "Rest day";
    if (changed < 0) return kind + ": target " + k + " kcal.";
    if (changed === 0) return "Portions already fit " + k + " kcal.";
    return kind + ": portions re-fitted to " + k + " kcal.";
  }
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Page wiring**

Add near `todayFit`:

```js
function setGymDay(date,on){
  if(!dayEditable(date))return null;
  const d=ensureDay(date);
  if(on)d.gym=true;else delete d.gym;
  let changed=-1;
  if(dayHasMeals(d))changed=fitTiers(d,0,date,{bought:true,respectTierBy:false,clearTierBy:true}).length;
  saveDay(date);
  return WeekdayFuelTargets.refitNote(!!on,target(date).k,changed);
}
```

Check `fitTiers`/`applyPortionPlan` return an array of changed meal labels (as `todayFit` uses `changed.length`); if it returns something else, adapt the count.

Today (`renderToday`): inside the panel that holds `compactMacro(t.k,tg.k," kcal","")`, add a toggle before `${fitBtn}`:
`<button type="button" class="chip" aria-pressed="${day.gym===true}" data-act="gym" data-d="${esc(today)}" data-v="${day.gym===true?"0":"1"}">Gym today</button>`. Also show it on the "Nothing planned" branch (inside that panel) so a gym day can be set before planning. Show the gym label next to the Today kcal: if the existing Today panel shows `targetAdjLabel`/`renderTodaySpreadAdj`, add `${esc(WeekdayFuelTargets.gymLabel(S(),day).replace(/^ · /,""))}` as a small muted line when non-empty.

Week: the day row already renders `targetAdjLabel(d)` after `${dayTg.k} kcal`, so the gym label appears automatically. In the `daymenu:` sheet, add a button at the top of its action list: `<button type="button" class="pick" data-act="gym" data-d="${esc(date)}" data-v="${day.gym===true?"0":"1"}">${day.gym===true?"Not a gym day":"Gym day"}</button>`.

Click switch:

```js
    case "gym":{const date=el.dataset.d,on=el.dataset.v==="1";const note=setGymDay(date,on);if(note==null)break;if(date===iso(new Date())&&state.tab==="today")state.todayNote=note;else{state.dayNote=note;state.scrollWeekDay=date}if(state.sheet&&state.sheet.startsWith("daymenu:"))state.sheet=null;break}
```

Check how `state.dayNote` is displayed in Week (grep `dayNote`) and that it renders for the target date; if it needs a `{date,text}` shape, use that shape instead.

- [ ] **Step 6: Full suite + parse check.**

- [ ] **Step 7: Browser check** — serve `apps/android/app/src/main/assets` with any static server (e.g. `npx --yes http-server apps/android/app/src/main/assets -p 8123 -s`; stop it afterwards; you started it), open `http://localhost:8123/weekday_fuel/Weekday_Fuel.html`, plan today with meals, tap Gym today: target goes from 1900 to 2150 with "+250 gym", portions change or the note says they already fit; tap again to return to 1900. Do the same from the Week day menu. Report what you saw.

- [ ] **Step 8: Commit**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/targets.js apps/android/app/src/test/js/targets.test.js apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "Gym day tick re-fits that day's portions"
git push
```

---

### Task 3: `steps.js` — steps cache helpers

**Files:**
- Create: `apps/android/app/src/main/assets/weekday_fuel/steps.js`
- Create: `apps/android/app/src/test/js/steps.test.js`
- Modify: `.github/workflows/release-android.yml` (add `steps.test.js`)

**Interfaces:**
- Produces `WeekdayFuelSteps`:
  - `STATUSES = ["ok","noPermission","unavailable","updateRequired","error"]`
  - `mergeReply(cache, reply, nowIso) → cache` — returns a new cache `{days, status, at}`. Ignores replies whose `type !== "steps"` or whose `status` isn't in `STATUSES` (returns the input cache unchanged). Copies only `days` entries whose key matches `/^\d{4}-\d{2}-\d{2}$/` and whose value is a non-negative integer; later replies overwrite by date. Sets `status` and `at = nowIso`.
  - `countFor(cache, date) → number|null`
  - `avg7(cache, endDate) → number|null` — mean of counts for `endDate` and the 6 days before; `null` when fewer than 4 of those 7 days have counts; rounded to the nearest 10.
  - `rangeToRead(todayIso) → {from, to}` — `to = todayIso`, `from` = 7 days before (8 days inclusive), local-calendar arithmetic on `YYYY-MM-DD`.
  - `format(n) → string` — `"8,412"` (en-AU grouping).

- [ ] **Step 1: Failing tests** (`steps.test.js`)

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const St = require("../../main/assets/weekday_fuel/steps.js");

test("mergeReply keeps valid days and status", () => {
  const c = St.mergeReply(null, { type: "steps", status: "ok", days: { "2026-11-23": 8412, "bad": 5, "2026-11-22": -1, "2026-11-21": 12.5 } }, "2026-11-23T10:00:00Z");
  assert.deepEqual(c, { days: { "2026-11-23": 8412 }, status: "ok", at: "2026-11-23T10:00:00Z" });
});

test("mergeReply overwrites by date and keeps older days", () => {
  let c = St.mergeReply(null, { type: "steps", status: "ok", days: { "2026-11-22": 100, "2026-11-23": 200 } }, "a");
  c = St.mergeReply(c, { type: "steps", status: "ok", days: { "2026-11-23": 900 } }, "b");
  assert.deepEqual(c.days, { "2026-11-22": 100, "2026-11-23": 900 });
  assert.equal(c.at, "b");
});

test("mergeReply ignores junk and keeps status-only replies", () => {
  const c0 = { days: { "2026-11-23": 1 }, status: "ok", at: "a" };
  assert.equal(St.mergeReply(c0, { type: "nope" }, "b"), c0);
  assert.equal(St.mergeReply(c0, { type: "steps", status: "weird" }, "b"), c0);
  const c1 = St.mergeReply(c0, { type: "steps", status: "noPermission" }, "b");
  assert.equal(c1.status, "noPermission");
  assert.deepEqual(c1.days, c0.days);
});

test("countFor and avg7", () => {
  const days = { "2026-11-23": 8000, "2026-11-22": 9000, "2026-11-21": 7000, "2026-11-20": 10000, "2026-11-10": 1 };
  const c = { days, status: "ok", at: "x" };
  assert.equal(St.countFor(c, "2026-11-23"), 8000);
  assert.equal(St.countFor(c, "2026-11-19"), null);
  assert.equal(St.countFor(null, "2026-11-23"), null);
  assert.equal(St.avg7(c, "2026-11-23"), 8500);
  assert.equal(St.avg7({ days: { "2026-11-23": 1, "2026-11-22": 2, "2026-11-21": 3 } }, "2026-11-23"), null);
});

test("rangeToRead covers the last 8 days across a month boundary", () => {
  assert.deepEqual(St.rangeToRead("2026-12-03"), { from: "2026-11-26", to: "2026-12-03" });
});

test("format groups thousands", () => {
  assert.equal(St.format(8412), "8,412");
  assert.equal(St.format(0), "0");
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `steps.js`**

```js
/* Daily step counts from the host (Health Connect), cached on this device. */
(function (root) {
  "use strict";

  var STATUSES = ["ok", "noPermission", "unavailable", "updateRequired", "error"];
  var DATE = /^\d{4}-\d{2}-\d{2}$/;

  function pad(n) { return String(n).padStart(2, "0"); }
  function parse(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }

  function mergeReply(cache, reply, nowIso) {
    if (!reply || reply.type !== "steps" || STATUSES.indexOf(reply.status) < 0) return cache;
    var days = Object.assign({}, (cache && cache.days) || {});
    var src = reply.days && typeof reply.days === "object" ? reply.days : {};
    Object.keys(src).forEach(function (k) {
      var v = src[k];
      if (DATE.test(k) && typeof v === "number" && Number.isInteger(v) && v >= 0) days[k] = v;
    });
    return { days: days, status: reply.status, at: nowIso };
  }

  function countFor(cache, date) {
    var v = cache && cache.days ? cache.days[date] : undefined;
    return typeof v === "number" ? v : null;
  }

  function avg7(cache, endDate) {
    var sum = 0, n = 0;
    for (var i = 0; i < 7; i++) {
      var v = countFor(cache, addDays(endDate, -i));
      if (v != null) { sum += v; n++; }
    }
    if (n < 4) return null;
    return Math.round(sum / n / 10) * 10;
  }

  function rangeToRead(todayIso) { return { from: addDays(todayIso, -7), to: todayIso }; }

  function format(n) { return Number(n).toLocaleString("en-AU"); }

  var api = { STATUSES: STATUSES, mergeReply: mergeReply, countFor: countFor, avg7: avg7, rangeToRead: rangeToRead, format: format };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelSteps = api;
})(this);
```

If `toLocaleString("en-AU")` doesn't group in this Node build (no ICU), replace `format` with a regex grouping: `String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")`.

- [ ] **Step 4: Run** → PASS. Add `apps/android/app/src/test/js/steps.test.js` to the CI line. Full suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/steps.js apps/android/app/src/test/js/steps.test.js .github/workflows/release-android.yml
git commit -m "Steps: device cache helpers"
git push
```

---

### Task 4: Android — Health Connect steps behind the host bridge

**Files:**
- Modify: `apps/android/gradle/libs.versions.toml`, `apps/android/app/build.gradle.kts`
- Modify: `apps/android/app/src/main/AndroidManifest.xml`
- Modify: `apps/android/app/src/main/res/values/strings.xml`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/steps/StepsMessages.kt`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/steps/HealthSteps.kt`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/steps/StepsRationaleActivity.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt`
- Create: `apps/android/app/src/test/java/dev/weekdayfuel/app/steps/StepsMessagesTest.kt`

**Interfaces:**
- Page → host: `{type:"stepsStatus"}`, `{type:"stepsConnect"}`, `{type:"stepsRead", from:"YYYY-MM-DD", to:"YYYY-MM-DD"}`.
- Host → page: `{type:"steps", status:"ok"|"noPermission"|"unavailable"|"updateRequired"|"error", days?:{"YYYY-MM-DD":Int}}`.

- [ ] **Step 1: Dependency**

`libs.versions.toml`: under `[versions]` add `healthConnect = "1.1.0"`; under `[libraries]` add `health-connect = { group = "androidx.health.connect", name = "connect-client", version.ref = "healthConnect" }`. `app/build.gradle.kts` dependencies: `implementation(libs.health.connect)`. If CI can't resolve `1.1.0`, use the newest `1.1.0-*` listed at https://developer.android.com/jetpack/androidx/releases/health-connect and say so in the report. Check `kotlinx-coroutines` is already available (MainActivity uses it via lifecycle); no extra dependency should be needed.

- [ ] **Step 2: Write the failing JUnit test** (`StepsMessagesTest.kt`, mirror the package/style of existing tests such as `apps/android/app/src/test/java/dev/weekdayfuel/app/backup/` or `woolworths/` tests)

```kotlin
package dev.weekdayfuel.app.steps

import java.time.LocalDate
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StepsMessagesTest {
    @Test fun parsesReadRange() {
        val r = StepsMessages.parseRead(JSONObject("""{"type":"stepsRead","from":"2026-11-16","to":"2026-11-23"}"""))
        assertEquals(LocalDate.of(2026, 11, 16), r!!.from)
        assertEquals(LocalDate.of(2026, 11, 23), r.to)
    }

    @Test fun rejectsBadOrLongRanges() {
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"2026-11-23","to":"2026-11-16"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"nope","to":"2026-11-16"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"2026-10-01","to":"2026-11-23"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"to":"2026-11-23"}""")))
    }

    @Test fun replyShape() {
        val json = JSONObject(StepsMessages.days(mapOf(LocalDate.of(2026, 11, 23) to 8412L)))
        assertEquals("steps", json.getString("type"))
        assertEquals("ok", json.getString("status"))
        assertEquals(8412, json.getJSONObject("days").getInt("2026-11-23"))
        val s = JSONObject(StepsMessages.status(StepsMessages.Status.NO_PERMISSION))
        assertEquals("noPermission", s.getString("status"))
        assertEquals(false, s.has("days"))
    }
}
```

- [ ] **Step 3: `StepsMessages.kt`**

```kotlin
package dev.weekdayfuel.app.steps

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import org.json.JSONObject

/** Page <-> host steps messages. Pure so it can be unit-tested without Android. */
object StepsMessages {
    const val MAX_DAYS = 31L

    enum class Status(val wire: String) {
        OK("ok"), NO_PERMISSION("noPermission"), UNAVAILABLE("unavailable"), UPDATE_REQUIRED("updateRequired"), ERROR("error"),
    }

    data class ReadRange(val from: LocalDate, val to: LocalDate)

    fun parseRead(msg: JSONObject): ReadRange? {
        val from = runCatching { LocalDate.parse(msg.optString("from")) }.getOrNull() ?: return null
        val to = runCatching { LocalDate.parse(msg.optString("to")) }.getOrNull() ?: return null
        if (to.isBefore(from)) return null
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) return null
        return ReadRange(from, to)
    }

    fun status(status: Status): String = JSONObject().put("type", "steps").put("status", status.wire).toString()

    fun days(counts: Map<LocalDate, Long>): String {
        val days = JSONObject()
        counts.forEach { (date, n) -> days.put(date.toString(), n) }
        return JSONObject().put("type", "steps").put("status", Status.OK.wire).put("days", days).toString()
    }
}
```

- [ ] **Step 4: `HealthSteps.kt`**

```kotlin
package dev.weekdayfuel.app.steps

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.Period

/** Read-only daily step totals from Health Connect. */
class HealthSteps(private val context: Context) {
    val permissions: Set<String> = setOf(HealthPermission.getReadPermission(StepsRecord::class))

    fun availability(): StepsMessages.Status =
        when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> StepsMessages.Status.OK
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> StepsMessages.Status.UPDATE_REQUIRED
            else -> StepsMessages.Status.UNAVAILABLE
        }

    private fun client() = HealthConnectClient.getOrCreate(context)

    suspend fun hasPermission(): Boolean = client().permissionController.getGrantedPermissions().containsAll(permissions)

    /** Status-only reply, or the daily counts when available and permitted. */
    suspend fun read(range: StepsMessages.ReadRange): String {
        val avail = availability()
        if (avail != StepsMessages.Status.OK) return StepsMessages.status(avail)
        if (!hasPermission()) return StepsMessages.status(StepsMessages.Status.NO_PERMISSION)
        val groups =
            client().aggregateGroupByPeriod(
                AggregateGroupByPeriodRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(range.from.atStartOfDay(), range.to.plusDays(1).atStartOfDay()),
                    timeRangeSlicer = Period.ofDays(1),
                ),
            )
        val counts = LinkedHashMap<LocalDate, Long>()
        groups.forEach { g -> counts[g.startTime.toLocalDate()] = g.result[StepsRecord.COUNT_TOTAL] ?: 0L }
        return StepsMessages.days(counts)
    }

    suspend fun status(): String {
        val avail = availability()
        if (avail != StepsMessages.Status.OK) return StepsMessages.status(avail)
        return StepsMessages.status(if (hasPermission()) StepsMessages.Status.OK else StepsMessages.Status.NO_PERMISSION)
    }
}
```

- [ ] **Step 5: Rationale screen** (`StepsRationaleActivity.kt`) — a `ComponentActivity` that shows one scrolling `TextView` with `R.string.steps_rationale` (padding 24dp, page background colour like `MainActivity` uses `R.color.page_background`) and nothing else. Add to `strings.xml`:

```xml
    <string name="steps_rationale">Weekday Fuel reads your daily step count from Health Connect to show it next to your meals and weigh-ins. It only reads steps, never writes anything, and the counts stay on this phone.</string>
```

- [ ] **Step 6: Manifest**

Inside `<manifest>`: `<uses-permission android:name="android.permission.health.READ_STEPS" />`, and inside the existing `<queries>` add `<package android:name="com.google.android.apps.healthdata" />`.

Inside `<application>`:

```xml
        <activity
            android:name=".steps.StepsRationaleActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>
        </activity>
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity=".steps.StepsRationaleActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
```

- [ ] **Step 7: MainActivity wiring**

- Field: `private val healthSteps by lazy { HealthSteps(this) }` and `private var lastStepsRange: StepsMessages.ReadRange? = null`.
- Launcher (declare with the other `registerForActivityResult` fields):

```kotlin
    private val requestSteps =
        registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { _ ->
            val range = lastStepsRange ?: StepsMessages.ReadRange(LocalDate.now().minusDays(7), LocalDate.now())
            lifecycleScope.launch { replyToPage(readStepsSafely(range)) }
        }
```

- In `onHostMessage`'s `when`:

```kotlin
            "stepsStatus" -> lifecycleScope.launch { replyToPage(runCatching { healthSteps.status() }.getOrElse { StepsMessages.status(StepsMessages.Status.ERROR) }) }
            "stepsRead" -> {
                val range = StepsMessages.parseRead(msg) ?: run { replyToPage(StepsMessages.status(StepsMessages.Status.ERROR)); return }
                lastStepsRange = range
                lifecycleScope.launch { replyToPage(readStepsSafely(range)) }
            }
            "stepsConnect" -> {
                val avail = healthSteps.availability()
                if (avail != StepsMessages.Status.OK) replyToPage(StepsMessages.status(avail)) else requestSteps.launch(healthSteps.permissions)
            }
```

- Helper:

```kotlin
    private suspend fun readStepsSafely(range: StepsMessages.ReadRange): String =
        withContext(Dispatchers.IO) {
            runCatching { healthSteps.read(range) }.getOrElse {
                Log.i(TAG, "Steps read failed: ${it.message}")
                StepsMessages.status(StepsMessages.Status.ERROR)
            }
        }
```

- Imports: `androidx.health.connect.client.PermissionController`, `dev.weekdayfuel.app.steps.HealthSteps`, `dev.weekdayfuel.app.steps.StepsMessages`, `java.time.LocalDate`.
- `StepsMessages.status(...)` from `availability()` returns `OK` only when the SDK is available; when `stepsConnect` sees `UPDATE_REQUIRED`, also open the Play Store page for `com.google.android.apps.healthdata` via the existing `openExternally(Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding"))`.

- [ ] **Step 8: Push and watch CI.** `git add` the files listed above by path, commit "Steps: read daily steps from Health Connect", push, then `gh run watch` until green. Fix compile errors from CI logs (`gh run view <id> --log-failed -R Evzy/weekday-fuel`); API names above are from connect-client 1.1 — check the compiler message against https://developer.android.com/reference/kotlin/androidx/health/connect/client/package-summary if one differs.

---

### Task 5: Page — request, cache and show steps

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`
- Modify: `apps/android/app/src/test/js/page-boot.test.js`

**Interfaces:**
- Consumes: `WeekdayFuelSteps` (Task 3); host messages (Task 4).

- [ ] **Step 1: Failing boot test** (append to `page-boot.test.js`, following its loading pattern)

```js
test("steps.js loads and steps are only requested when the host exists", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  assert.ok(html.indexOf('<script src="steps.js"></script>') > -1);
  const fn = html.slice(html.indexOf("function requestSteps("));
  assert.ok(fn.indexOf("window.WeekdayFuelHost") > -1);
  const onMsg = html.slice(html.indexOf("function onHostPageMessage("));
  assert.ok(onMsg.indexOf('m.type==="steps"') > -1);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Wire**

1. `<script src="steps.js"></script>` beside `targets.js`.
2. Cache helpers near other `ls*` helpers: key `weekdayfuel.steps`; `function stepsCache(){try{return JSON.parse(localStorage.getItem("weekdayfuel.steps"))||null}catch(e){return null}}` and `function setStepsCache(c){try{localStorage.setItem("weekdayfuel.steps",JSON.stringify(c))}catch(e){}}`.
3. `function requestSteps(){if(!window.WeekdayFuelHost)return;const r=WeekdayFuelSteps.rangeToRead(iso(new Date()));WeekdayFuelHost.postMessage(JSON.stringify({type:"stepsRead",from:r.from,to:r.to}))}`.
4. In `onHostPageMessage`, first line after the null check: `if(m.type==="steps"){setStepsCache(WeekdayFuelSteps.mergeReply(stepsCache(),m,new Date().toISOString()));if(state.tab==="today"||state.tab==="week"||state.tab==="weigh"||state.tab==="targets")render();return}`.
5. Boot: after `installHostListener();` (before `initMealCalc();`) nothing; instead, at the end of `initStore` right after the first `render();`, call `requestSteps();`. Add `document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")requestSteps()});` next to the other top-level `document.addEventListener` calls.
6. Click switch: `case "stepsconnect":if(window.WeekdayFuelHost)WeekdayFuelHost.postMessage(JSON.stringify({type:"stepsConnect"}));break;`
7. `function stepsLine(date){const c=stepsCache();const n=WeekdayFuelSteps.countFor(c,date);if(n!=null)return `${WeekdayFuelSteps.format(n)} steps`;if(!window.WeekdayFuelHost)return "";if(!c||c.status==="noPermission")return "connect";if(c.status==="unavailable"||c.status==="updateRequired")return "unavailable";return ""}`.
8. Today: in the target panel (and in the "Nothing planned" panel), add a small muted line: when `stepsLine(today)` is a count, `"<count> steps today"`; when `"connect"`, `<button type="button" class="ghost" data-act="stepsconnect">Connect steps</button>`; when `"unavailable"`, `Steps need Health Connect`. All text through `esc`.
9. Week: in the day row's kcal line, after the protein span, append ` · ${esc(n)} steps` when `countFor` has a value for `d` (counts only; no connect link in Week).
10. Weigh (`renderWeigh`): where the 7-day weight average is shown, append ` · 7-day steps avg ${esc(WeekdayFuelSteps.format(a))}` when `WeekdayFuelSteps.avg7(stepsCache(),iso(new Date()))` is non-null. Read `renderWeigh` first to find the right spot.
11. Targets (`renderTargets`), before `renderBackupPanel()`: a panel `<div class="panel stack" style="gap:6px"><div class="eyebrow">Steps</div>…</div>` showing: connected with today's count (`"Connected · 8,412 today"`), or the Connect steps button, or `Steps need Health Connect`. When status is `ok` and today's count is 0 and local time is 18:00 or later, add the hint `No steps? In Samsung Health › Settings › Health Connect, allow Steps.` Hide the whole panel when `!window.WeekdayFuelHost`.

- [ ] **Step 4: Full suite + parse check.**

- [ ] **Step 5: Browser check** with a fake host: serve assets as in Task 2, then in DevTools before reload define nothing (no host) and confirm no steps UI appears and nothing errors in the console. Then simulate a reply by calling the page's message handler is not reachable (closure) — instead set `localStorage["weekdayfuel.steps"]=JSON.stringify({days:{[today]:8412},status:"ok",at:"x"})`, reload, and confirm Week shows "8,412 steps" for today (Today/Targets lines need the host and stay hidden; that's expected in the browser). Report what you saw.

- [ ] **Step 6: Commit**

```bash
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html apps/android/app/src/test/js/page-boot.test.js
git commit -m "Steps: show daily steps in Today, Week, Weigh and Targets"
git push
```

Watch CI green.

---

### Task 6: Release (after review gate)

- [ ] Final reviewer pass over Tasks 1–5 against the spec.
- [ ] Bump `apps/android/app/build.gradle.kts` (UTF-8, no BOM) to `versionCode = 60`, `versionName = "0.34.0"`; commit `Release v0.34.0`; push; watch CI; confirm `WeekdayFuel-v0.34.0-debug.apk` on `Evzy/weekday-fuel-releases`.
- [ ] Ask Evan to update, check Targets shows 1,900 / 2,150, tap Connect steps, and compare today's count with Samsung Health.
