# Suggest My Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-18-suggest-week-design.md`](../specs/2026-10-18-suggest-week-design.md)

**Goal:** One tap plans Mon–Fri so meals share ingredients, every filled lunch uses the Sunday chicken, and the whole-pack shop is as cheap as possible.

**Architecture:** A new pure `planner.js` (`weekDays`, `planWeek`, `shopScore`) generates random rule-following weeks, fits portions through a callback, scores each by its real shop via the catalogue, and picks among the near-best. The page adds a button, a locked-portions option to `fitTiers`, and the action that saves the days and adds them to the shop.

**Tech Stack:** plain browser JS, Node built-in test runner, GitHub Actions.

## Global Constraints

- Existing `localStorage` keys and stored days keep their shape; planned meals are `{id, slot, t}` like "Suggest a day" makes.
- Already-planned meals are returned as the same objects, unchanged (portion included). Past days are never changed.
- Every string inserted into HTML goes through `esc`.
- Commit straight to `main` with the prefix `week:` (release commit: `release: v0.10.0`). After each push CI must be green before the next task. Bump the version only in Task 3.
- JS tests: `node --test "apps/android/app/src/test/js/*.test.js"` (keep the quotes); 143 pass before this plan.
- Do not touch `platra/`, the keystore, `local.properties` or `docs/seed/`. Do not stage anything under `.superpowers/`; stage files by explicit path. Never run `git stash`, `git clean` or `git reset --hard`. If `git pull --rebase` refuses because of unstaged files, commit first, then pull --rebase, then push.

### Watching CI after a push (PowerShell)

```powershell
Start-Sleep 8; $id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'; gh run watch $id -R Evzy/weekday-fuel --exit-status *> $null; "CI $id exit $LASTEXITCODE"
```

`exit 0` is green. Otherwise read `gh run view $id -R Evzy/weekday-fuel --log-failed`, fix, push again.

### Inline-script parse check (PowerShell)

```powershell
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>'));fs.writeFileSync(process.env.TEMP+'/wf.js',s)"; node --check "$env:TEMP/wf.js"
```

---

### Task 1: The planner

**Files:**
- Create: `apps/android/app/src/main/assets/weekday_fuel/planner.js`
- Create: `apps/android/app/src/test/js/planner.test.js`
- Modify: `.github/workflows/release-android.yml` (append `apps/android/app/src/test/js/planner.test.js` to the `node --test` list, matching how the others are listed)
- Modify: `README.md` (row after the `meals.js` row: `` | `apps/android/app/src/main/assets/weekday_fuel/planner.js` | Suggest my week: plans Mon–Fri so meals share ingredients and the shop is cheap | ``)

**Interfaces:**
- Produces: `weekDays(view, today) → {dates, before, label}`; `planWeek(opts) → {days: {[date]: meals[]}, score, distinct} | null`; `shopScore(cat, dayMeals, store) → number`. Exported via `module.exports` under Node and `window.WeekdayFuelPlanner` in the page.

- [ ] **Step 1: Write the failing tests** — `planner.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { weekDays, planWeek, shopScore } = require("../../main/assets/weekday_fuel/planner.js");
const real = require("../../main/assets/weekday_fuel/catalogue.js");
const { MEALS } = require("../../main/assets/weekday_fuel/meals.js");
const { create } = real;

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = (size, price) => ({ name: "p", url: "u", size, price, checked: "2026-10-18" });
const ITEMS = [
  { id: "chick", sec: 1, name: "Chicken", unit: "g", coles: P(1000, 10), woolies: P(1000, 10) },
  { id: "rice", sec: 2, name: "Rice", unit: "pouches", coles: P(1, 2), woolies: P(1, 2) },
  { id: "pasta", sec: 2, name: "Pasta", unit: "g", coles: P(500, 2), woolies: P(500, 2) },
  { id: "spin", sec: 1, name: "Spinach", unit: "g", coles: P(120, 3), woolies: P(120, 3) },
  { id: "toms", sec: 1, name: "Tomatoes", unit: "g", coles: P(250, 4), woolies: P(250, 4) },
  { id: "bread", sec: 2, name: "Bread", unit: "slices", coles: P(10, 4), woolies: P(10, 4) },
  { id: "eggs", sec: 1, name: "Eggs", unit: "eggs", coles: P(12, 6), woolies: P(12, 6) },
  { id: "wo", sec: 2, name: "Woolworths only", unit: "bottles", coles: null, woolies: P(1, 7) },
];
const AMOUNTS = {
  b1: { eggs: 3, bread: 2 }, b2: { eggs: 2, spin: 20 }, b3: { bread: 2, toms: 50 },
  l1: { chick: 200, rice: 1 }, l2: { chick: 200, spin: 30 }, l3: { chick: 200, toms: 50 },
  d1: { pasta: 100, toms: 100 }, d2: { pasta: 100, chick: 180 }, d3: { rice: 1, spin: 40 }, d4: { pasta: 100, spin: 60 },
  sa: { spin: 20 }, st: { toms: 50 }, sp: { pasta: 100 }, sw: { wo: 1 },
};
const CAT = create(ITEMS, AMOUNTS);
const POOLS = { breakfast: ["b1", "b2", "b3"], lunch: ["l1", "l2", "l3"], dinner: ["d1", "d2", "d3", "d4"] };
const WEEK = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
const fitS = (calls) => (date, meals, locked) => {
  if (calls) calls.push([date, locked]);
  meals.slice(locked).forEach((m) => (m.t = "S"));
};
const opts = (o) => Object.assign({ dates: WEEK, before: {}, kept: {}, pools: POOLS, fit: fitS(), score: (dm) => shopScore(CAT, dm, "coles"), tries: 200 }, o);

function checkRules(res, o) {
  const count = {};
  const on = {};
  const add = (d, id) => {
    count[id] = (count[id] || 0) + 1;
    (on[d] = on[d] || new Set()).add(id);
  };
  Object.entries(o.before || {}).forEach(([d, ms]) => ms.forEach((m) => add(d, m.id)));
  for (const d of o.dates) {
    const ms = res.days[d];
    for (const slot of ["breakfast", "lunch", "dinner"]) assert.equal(ms.filter((m) => m.slot === slot).length, 1, d + " " + slot);
    ms.forEach((m) => add(d, m.id));
  }
  for (const [id, n] of Object.entries(count)) assert.ok(n <= 2, id + " " + n + " times");
  const ds = Object.keys(on).sort();
  for (let i = 1; i < ds.length; i++) {
    const gap = (Date.parse(ds[i]) - Date.parse(ds[i - 1])) / 864e5;
    if (gap === 1) for (const id of on[ds[i]]) assert.ok(!on[ds[i - 1]].has(id), id + " on " + ds[i - 1] + " and " + ds[i]);
  }
}

test("weekDays plans the viewed week from today on, or the next week when none are left", () => {
  assert.deepEqual(weekDays("2026-10-21", "2026-10-21"), { dates: ["2026-10-21", "2026-10-22", "2026-10-23"], before: ["2026-10-19", "2026-10-20"], label: "Suggest my week" });
  assert.deepEqual(weekDays("2026-10-23", "2026-10-23").dates, ["2026-10-23"]);
  for (const day of ["2026-10-24", "2026-10-25"]) {
    assert.deepEqual(weekDays(day, day), { dates: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"], before: [], label: "Suggest next week" });
  }
  assert.deepEqual(weekDays("2026-10-12", "2026-10-21"), { dates: ["2026-10-21", "2026-10-22", "2026-10-23"], before: ["2026-10-19", "2026-10-20"], label: "Suggest this week" });
  assert.deepEqual(weekDays("2026-11-04", "2026-10-21"), { dates: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"], before: [], label: "Suggest my week" });
});

test("a planned week follows the rules: one breakfast, lunch and dinner a day, lunches from the lunch pool, at most twice, never on consecutive days", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const o = opts({ rng: seeded(seed) });
    const res = planWeek(o);
    checkRules(res, o);
    for (const d of WEEK) {
      assert.ok(POOLS.lunch.includes(res.days[d].find((m) => m.slot === "lunch").id));
      assert.ok(POOLS.breakfast.includes(res.days[d].find((m) => m.slot === "breakfast").id));
      assert.ok(POOLS.dinner.includes(res.days[d].find((m) => m.slot === "dinner").id));
      res.days[d].forEach((m) => assert.equal(m.t, "S"));
    }
    assert.equal(res.distinct, new Set(WEEK.flatMap((d) => res.days[d].map((m) => m.id))).size);
  }
});

test("kept meals stay as the same objects with their portions, only empty slots are filled, and full days aren't refitted", () => {
  const keptDinner = { id: "d1", slot: "dinner", t: "X" };
  const full = [{ id: "b1", slot: "breakfast", t: "L" }, { id: "l1", slot: "lunch", t: "S" }, { id: "d2", slot: "dinner", t: "X" }];
  const calls = [];
  const o = opts({ rng: seeded(7), kept: { "2026-10-20": [keptDinner], "2026-10-22": full }, fit: fitS(calls) });
  const res = planWeek(o);
  checkRules(res, o);
  assert.equal(res.days["2026-10-20"][0], keptDinner);
  assert.equal(keptDinner.t, "X");
  assert.equal(res.days["2026-10-20"].filter((m) => m.slot === "dinner").length, 1);
  assert.deepEqual(res.days["2026-10-22"], full);
  full.forEach((m, i) => assert.equal(res.days["2026-10-22"][i], m));
  assert.ok(!calls.some(([d]) => d === "2026-10-22"));
  assert.ok(calls.some(([d, locked]) => d === "2026-10-20" && locked === 1));
});

test("earlier days of the week count towards the twice-a-week limit", () => {
  const o = opts({ dates: WEEK.slice(2), before: { "2026-10-19": [{ id: "l1", slot: "lunch", t: "S" }], "2026-10-20": [{ id: "l2", slot: "lunch", t: "S" }] }, rng: seeded(3) });
  for (let seed = 1; seed <= 10; seed++) {
    o.rng = seeded(seed);
    const res = planWeek(o);
    checkRules(res, o);
    assert.notEqual(res.days["2026-10-21"].find((m) => m.slot === "lunch").id, "l2");
  }
});

test("when the rules can't be met they are relaxed instead of failing", () => {
  const res = planWeek(opts({ pools: { breakfast: ["b1", "b2", "b3"], lunch: ["l1"], dinner: ["d1", "d2", "d3", "d4"] }, rng: seeded(5) }));
  for (const d of WEEK) assert.equal(res.days[d].find((m) => m.slot === "lunch").id, "l1");
});

test("shopScore is the whole-pack cost plus the unused part of fresh packs, using the other store when one lacks the product", () => {
  const dm = (...ids) => ids.map((meal) => ({ day: "2026-10-19", meal, t: "S" }));
  assert.equal(shopScore(CAT, dm("sa"), "coles"), 5.5);
  assert.equal(shopScore(CAT, dm("sa", "sa"), "coles"), 5);
  assert.equal(shopScore(CAT, dm("sp"), "coles"), 2);
  assert.equal(shopScore(CAT, dm("sw"), "coles"), 7);
  assert.ok(shopScore(CAT, dm("sa", "sa"), "coles") < shopScore(CAT, dm("sa", "st"), "coles"));
});

test("with near 0 the chosen week is the best-scoring one found", () => {
  const d1s = (dm) => dm.filter((x) => x.meal === "d1").length;
  const res = planWeek(opts({ rng: seeded(11), tries: 400, near: 0, score: (dm) => -d1s(dm) }));
  assert.equal(res.score, -2);
});

test("on the real meals, a planned week follows the rules and its shop is no dearer than a typical random week", () => {
  const chicken = (m) => (m.batch || []).includes("chicken");
  const pools = {
    breakfast: MEALS.filter((m) => m.slots.includes("breakfast") && m.id !== "yogbowl").map((m) => m.id),
    lunch: MEALS.filter((m) => m.slots.includes("main") && chicken(m)).map((m) => m.id),
    dinner: MEALS.filter((m) => m.slots.includes("main") && !chicken(m)).map((m) => m.id),
  };
  const o = { dates: WEEK, before: {}, kept: {}, pools, fit: fitS(), score: (dm) => shopScore(real, dm, "coles"), rng: seeded(21), tries: 300 };
  const res = planWeek(o);
  checkRules(res, o);
  const random = [];
  for (let seed = 200; seed < 250; seed++) random.push(planWeek(Object.assign({}, o, { rng: seeded(seed), tries: 1 })).score);
  random.sort((a, b) => a - b);
  assert.ok(res.score <= random[25], res.score + " vs median " + random[25]);
});
```

- [ ] **Step 2: Run to see them fail** (`planner.js` missing).

- [ ] **Step 3: Write `planner.js`:**

```js
/* Suggest my week: plans Mon–Fri so meals share ingredients and the whole-pack shop is cheap. Pure: no DOM or storage. */
(function (root) {
  "use strict";
  var SLOTS = ["breakfast", "lunch", "dinner"];
  /* Relaxed in order when kept meals make the rules impossible. */
  var LEVELS = [{ max: 2, apart: true }, { max: 2, apart: false }, { max: Infinity, apart: false }];

  function parse(s) {
    var p = s.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }
  function iso(d) {
    return d.toISOString().slice(0, 10);
  }
  function addDays(s, n) {
    var d = parse(s);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  }
  function monday(s) {
    return addDays(s, -((parse(s).getUTCDay() + 6) % 7));
  }

  /* The weekdays of the viewed week from today on (never a past week); if none are left, next week's. */
  function weekDays(view, today) {
    var viewMon = monday(view);
    var todayMon = monday(today);
    var mon = viewMon < todayMon ? todayMon : viewMon;
    var dates = [];
    var i;
    for (i = 0; i < 5; i++) if (addDays(mon, i) >= today) dates.push(addDays(mon, i));
    if (!dates.length) {
      mon = addDays(mon, 7);
      for (i = 0; i < 5; i++) dates.push(addDays(mon, i));
    }
    var before = [];
    for (i = 0; i < 5; i++) if (addDays(mon, i) < dates[0]) before.push(addDays(mon, i));
    var label = mon === viewMon ? "Suggest my week" : mon > todayMon ? "Suggest next week" : "Suggest this week";
    return { dates: dates, before: before, label: label };
  }

  /* Whole-pack cost at the store (the other store's product when it lacks one) plus the unused part of fresh (sec 1) packs. */
  function shopScore(cat, dayMeals, store) {
    var other = store === "coles" ? "woolies" : "coles";
    var total = 0;
    cat.shopList({}, 0, dayMeals).forEach(function (r) {
      var line = r[store] || r[other];
      if (!line) return;
      total += line.cost;
      var p = line.product;
      if (r.sec === 1 && !p.perKg) {
        var left = line.quantity * p.size - r.need;
        if (left > 0) total += (left / p.size) * p.price;
      }
    });
    return Math.round(total * 100) / 100;
  }

  function buildWeek(o, level, rng) {
    var count = {};
    var on = {};
    function note(date, id) {
      count[id] = (count[id] || 0) + 1;
      (on[date] = on[date] || {})[id] = true;
    }
    function onDay(date, id) {
      return !!(on[date] && on[date][id]);
    }
    Object.keys(o.before || {}).forEach(function (d) {
      (o.before[d] || []).forEach(function (m) {
        note(d, m.id);
      });
    });
    o.dates.forEach(function (d) {
      ((o.kept || {})[d] || []).forEach(function (m) {
        note(d, m.id);
      });
    });
    var days = {};
    var dayMeals = [];
    for (var i = 0; i < o.dates.length; i++) {
      var d = o.dates[i];
      var kept = (o.kept || {})[d] || [];
      var have = {};
      kept.forEach(function (m) {
        have[m.slot] = true;
      });
      var added = [];
      for (var s = 0; s < SLOTS.length; s++) {
        var slot = SLOTS[s];
        if (have[slot]) continue;
        var pool = (o.pools[slot] || []).filter(function (id) {
          if ((count[id] || 0) >= level.max || onDay(d, id)) return false;
          return !(level.apart && (onDay(addDays(d, -1), id) || onDay(addDays(d, 1), id)));
        });
        if (!pool.length) return null;
        var id = pool[Math.floor(rng() * pool.length)];
        note(d, id);
        added.push({ id: id, slot: slot, t: "S" });
      }
      var meals = kept.concat(added);
      if (added.length) o.fit(d, meals, kept.length);
      days[d] = meals;
      meals.forEach(function (m) {
        dayMeals.push({ day: d, meal: m.id, t: m.t });
      });
    }
    return { days: days, score: o.score(dayMeals) };
  }

  /* opts: dates, before {[date]: meals}, kept {[date]: meals}, pools {breakfast, lunch, dinner: ids},
     fit(date, meals, lockedCount) sets t on the meals after the locked ones, score(dayMeals) lower is better,
     rng, tries (2000), near (0.03: pick at random among weeks within 3% of the best). */
  function planWeek(o) {
    var rng = o.rng || Math.random;
    var tries = o.tries || 2000;
    var near = o.near == null ? 0.03 : o.near;
    for (var l = 0; l < LEVELS.length; l++) {
      var found = [];
      for (var i = 0; i < tries; i++) {
        var w = buildWeek(o, LEVELS[l], rng);
        if (w) found.push(w);
      }
      if (!found.length) continue;
      var best = Math.min.apply(null, found.map(function (x) { return x.score; }));
      var close = found.filter(function (x) { return x.score <= best * (1 + near) + 1e-9; });
      var pick = close[Math.floor(rng() * close.length)];
      var ids = {};
      o.dates.forEach(function (d) {
        pick.days[d].forEach(function (m) {
          ids[m.id] = true;
        });
      });
      return { days: pick.days, score: pick.score, distinct: Object.keys(ids).length };
    }
    return null;
  }

  var api = { weekDays: weekDays, planWeek: planWeek, shopScore: shopScore };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelPlanner = api;
})(this);
```

(Check `catalogue.js` exports `create` at module level — `catalogue.test.js` already imports it; if the name differs, use that.)

- [ ] **Step 4: Run tests.** `node --test "apps/android/app/src/test/js/*.test.js"` → 151 pass. If the real-data median test is flaky across seeds it isn't (seeded); if it fails, report the numbers — don't loosen it without saying so.

- [ ] **Step 5: CI list and README** as listed under Files.

- [ ] **Step 6: Commit, push, watch CI.**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/planner.js apps/android/app/src/test/js/planner.test.js .github/workflows/release-android.yml README.md
git commit -m "week: planner picks a Mon-Fri week whose shared ingredients make the cheapest shop"
git pull --rebase origin main
git push
```

---

### Task 2: Suggest my week on the page

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`

**Interfaces:**
- Consumes: `window.WeekdayFuelPlanner` (Task 1); page `CAT`, `MEALS`, `MEAL`, `state`, `S()`, `dayOf`, `ensureDay`, `saveDay`, `saveSettings`, `store()`, `shopRows()`, `iso`, `dayShort`, `money`, `STORE_NAME`, `esc`.

- [ ] **Step 1: Load it.** Add `<script src="planner.js"></script>` after `<script src="meals.js"></script>`.

- [ ] **Step 2: `fitTiers` with locked portions.** Replace `fitTiers` with:

```js
/* choose L/S/X for each meal so the day lands closest to target, protein first; the first `locked` meals keep their portions */
function fitTiers(day,locked){
  const all=day.meals||[];const lk=locked||0;
  const ms=all.slice(lk).filter(m=>MEAL[m.id]);if(!ms.length)return;
  const base=totals({fx:day.fx,meals:all.slice(0,lk),extras:day.extras});
  const tg=target();let best=null;
  const keys=["L","S","X"];const n=ms.length;const combos=Math.pow(3,n);
  for(let i=0;i<combos;i++){
    let k=base.k,p=base.p,x=i;const pick=[];
    for(let j=0;j<n;j++){const t=keys[x%3];x=Math.floor(x/3);pick.push(t);const v=MEAL[ms[j].id].t[t];k+=v.k;p+=v.p}
    const score=Math.abs(k-tg.k)+Math.max(0,tg.p-p)*12;
    if(!best||score<best.score)best={score,pick};
  }
  ms.forEach((m,j)=>m.t=best.pick[j]);
}
```

(Existing callers pass no `locked`, so behaviour is unchanged for them.)

- [ ] **Step 3: The action.** After `swapMeal` add:

```js
function suggestWeek(){
  const P=WeekdayFuelPlanner,w=P.weekDays(state.date,iso(new Date())),s=store();
  const mealsOf=d=>(state.days[d]&&state.days[d].meals)||[];
  const before={},kept={};
  w.before.forEach(d=>{before[d]=mealsOf(d)});
  w.dates.forEach(d=>{kept[d]=mealsOf(d)});
  if(w.dates.every(d=>["breakfast","lunch","dinner"].every(sl=>kept[d].some(m=>m.slot===sl)))){state.weekNote="Every day already has a breakfast, lunch and dinner. Remove the meals you want replaced, then tap again.";return}
  const chicken=m=>(m.batch||[]).includes("chicken");
  const pools={
    breakfast:MEALS.filter(m=>m.slots.includes("breakfast")&&m.id!=="yogbowl").map(m=>m.id),
    lunch:MEALS.filter(m=>m.slots.includes("main")&&chicken(m)).map(m=>m.id),
    dinner:MEALS.filter(m=>m.slots.includes("main")&&!chicken(m)).map(m=>m.id)
  };
  const fit=(d,meals,locked)=>{const day=dayOf(d);fitTiers({fx:day.fx,meals,extras:day.extras},locked)};
  const r=P.planWeek({dates:w.dates,before,kept,pools,fit,score:dm=>P.shopScore(CAT,dm,s)});
  if(!r){state.weekNote="Couldn't plan this week. Try Suggest a day for each day instead.";return}
  const sd=state.settings.shopDays=Object.assign({},S().shopDays);
  w.dates.forEach(d=>{const day=ensureDay(d);day.meals=r.days[d];day.meals.forEach(m=>delete m.shop);saveDay(d);sd[d]=true});
  saveSettings();
  const first=w.dates[0],last=w.dates[w.dates.length-1];
  const total=CAT.storeTotals(shopRows(),s,{}).total;
  state.weekNote=`Planned ${dayShort(first)}${last!==first?"–"+dayShort(last):""}: ${r.distinct} different meals, shop about ${money(total)} at ${STORE_NAME[s]}.`;
  state.date=first;state.adding=null;
}
```

(Check `STORE_NAME` and `storeTotals` exist with these names; `CAT.storeTotals(rows, store, ticks)` returns `{total, left, missed}`.)

- [ ] **Step 4: Button and note.** In `renderToday`, right after `h+=\`<div class="panel">${weekStrip()}</div>\`;` add:

```js
  const wk=WeekdayFuelPlanner.weekDays(date,iso(new Date()));
  h+=`<div class="row between" style="gap:8px"><span class="small muted">Plans ${wk.dates.length===1?"the day":"the weekdays"} so meals share ingredients and lunches use the Sunday chicken. Planned meals stay.</span><button class="btn alt" data-act="suggestweek">${esc(wk.label)}</button></div>`;
  if(state.weekNote)h+=`<div class="hint"><span>${esc(state.weekNote)}</span></div>`;
```

It renders above the weekend early-return, so it shows on weekends too.

- [ ] **Step 5: Click handling.** Add `weekNote:null` to the `state` initialiser. In the click handler, next to `state.orderError=false;` (before the `switch`), add `state.weekNote=null;`. Add the case `case "suggestweek":suggestWeek();break;`.

- [ ] **Step 6: Parse check, tests** (151 pass).

- [ ] **Step 7: Commit, push, watch CI.**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
git commit -m "week: Suggest my week button plans Mon-Fri around planned meals and adds the days to the shop"
git pull --rebase origin main
git push
```

- [ ] **Step 8 (controller): browser check** on `127.0.0.1:8123`: on a weekday the button reads "Suggest my week"; on a weekend "Suggest next week"; pre-plan one dinner with Loaded on Tuesday, tap → Tuesday keeps it (Loaded), every day has breakfast, lunch and dinner, lunches are tender wraps / burrito bowl / fried rice, no meal 3 times or two days running, all days show "In this shop", the note shows the count and total; tap again → the "Every day already has…" note and nothing changes; clear the days and tap → a different week; compare the shop total against five "Suggest a day" taps; time a tap (should feel instant, under ~0.5 s).

---

### Task 3: Release v0.10.0

- [ ] `apps/android/app/build.gradle.kts`: `versionCode = 16` → `17`, `versionName = "0.9.0"` → `"0.10.0"`.
- [ ] Spec status → `**Status:** approved 2026-10-18; v0.10.0 released 2026-10-18, owner phone checks pending`.
- [ ] Commit `release: v0.10.0`, push, watch CI, then `gh release view v0.10.0 -R Evzy/weekday-fuel-releases --json tagName,assets --jq '.tagName, .assets[].name'`.
