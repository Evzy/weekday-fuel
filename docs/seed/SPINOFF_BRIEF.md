# Nutrition / Weekday Fuel — spinoff brief (new repo)

**Status:** Seed materials live on GitHub in **`Evzy/platra`** (see paths below). Target product repo: **`Evzy/nutrition`** (create if missing).  
**Updated:** 2026-04-17  
**Working names:** repo **`nutrition`**; product UI title **Weekday Fuel**.

---

## For agents without a Platra workspace

You do **not** need Platra checked out. Use **`gh`** (authenticated to an account that can read `Evzy/platra`):

```bash
# Confirm access
gh repo view Evzy/platra --json name,url

# Create product repo if it does not exist (needs create permission)
gh repo view Evzy/nutrition --json name 2>/dev/null || \
  gh repo create Evzy/nutrition --private --description "Weekday Fuel — Android APK" --confirm

# Pull seed files into a new local tree (no full Platra clone required)
mkdir -p nutrition/docs/nutrition-spinoff && cd nutrition
gh api repos/Evzy/platra/contents/docs/NUTRITION_SPINOFF_BRIEF.md --jq .content | base64 -d > docs/NUTRITION_SPINOFF_BRIEF.md
gh api repos/Evzy/platra/contents/docs/nutrition-spinoff/README.md --jq .content | base64 -d > docs/nutrition-spinoff/README.md
gh api repos/Evzy/platra/contents/docs/nutrition-spinoff/TRANSCRIPT_NOTES.md --jq .content | base64 -d > docs/nutrition-spinoff/TRANSCRIPT_NOTES.md
gh api repos/Evzy/platra/contents/docs/nutrition-spinoff/Weekday_Fuel.html --jq .content | base64 -d > docs/nutrition-spinoff/Weekday_Fuel.html

# Optional: Platra plumbing references (read-only)
gh api repos/Evzy/platra/contents/docs/CI_CD.md --jq .content | base64 -d > docs/PLATRA_CI_CD_REFERENCE.md
# Android updater reference (path may be large — prefer sparse clone of apps/android if scaffolding):
# gh api repos/Evzy/platra/git/trees/main?recursive=1 --jq '.tree[].path' | rg '^apps/android'
```

Then implement per the checklist below. Defaults if user is offline: **`applicationId` `dev.weekdayfuel.app`**, update check **on cold start** (non-blocking), releases repo **`Evzy/nutrition-releases`**.

---

## Goal

Create a **brand-new GitHub repository**, completely separate from Platra, that ships an **Android APK** wrapping the **exact** Weekday Fuel web app already built as a Claude artifact.

- **No backend API.** Fully on-device (`localStorage` inside the WebView is already how the artifact works).
- **Only platform extras:** APK build/release pipeline + **update check on launch** (GitHub Releases), adapted from Platra.
- **Do not redesign v0.** Ship the frozen HTML, then iterate.

---

## Seed files in this (Platra) repo

| Path | What |
| --- | --- |
| [`docs/nutrition-spinoff/Weekday_Fuel.html`](nutrition-spinoff/Weekday_Fuel.html) | **Canonical artifact** (~86 KB single-file SPA). Copy into the new Android app’s assets. |
| [`docs/nutrition-spinoff/TRANSCRIPT_NOTES.md`](nutrition-spinoff/TRANSCRIPT_NOTES.md) | Chat decisions (pricing, Shop builder, product links, no search buttons). |
| [`docs/nutrition-spinoff/README.md`](nutrition-spinoff/README.md) | Index for this seed folder. |

**Original Claude links** (may require auth; prefer the frozen HTML above):

| What | URL |
| --- | --- |
| Transcript | https://claude.ai/share/4ff89ac4-f718-408f-b572-7d6b77090db2 |
| Artifact | https://claude.ai/artifact/66jPZUnu1Um8var3Yym2E6 |

---

## What “exact app” means

The HTML is a phone-first SPA with tabs: **Today · Weigh-in · Meals · Shop · Targets**.  
Shop includes **Build a shop** (pick meals/serves → list) and **Full list**; store buttons open **exact** Woolworths/Coles product pages (not search).  
State already persists via `localStorage` (settings, days, weights, shop ticks).

**Android host requirements:**

1. Full-screen **WebView** loading `file:///android_asset/.../Weekday_Fuel.html` (or equivalent).
2. **JavaScript + DOM storage** enabled.
3. **External links** (Woolworths/Coles) open in Custom Tabs / browser, not trapped in WebView.
4. Thin Compose chrome optional: Settings → check for APK update (and/or auto-check on cold start).

---

## Reference implementation (Platra plumbing only)

| Concern | Platra path |
| --- | --- |
| Repo | https://github.com/Evzy/platra |
| Android app | [`apps/android/`](../apps/android/) |
| Versions / `applicationId` | [`apps/android/app/build.gradle.kts`](../apps/android/app/build.gradle.kts) |
| In-app updater + `UPDATE_GITHUB_*` | same `build.gradle.kts` + Settings UI; [`docs/CI_CD.md`](CI_CD.md) |
| Release workflow | [`.github/workflows/release-android.yml`](../.github/workflows/release-android.yml) |
| Releases repo pattern | `platra-releases` → use e.g. **`nutrition-releases`** |
| Shared debug keystore | [`docs/CI_CD.md`](CI_CD.md) § package conflicts |

**Reuse:** Gradle layout, CI → releases repo, shared signing, version bumps, GitHub Releases updater.  
**Drop entirely:** `services/api`, Azure, Firebase, coach chat/jobs, Anthropic, Platra Room catalog. No network except Releases (+ user-opened store product URLs).

---

## Suggested new-repo layout

```
nutrition/                      # new GitHub repo
  README.md
  docs/
    TRANSCRIPT_NOTES.md         # copy from Platra seed
    CI_CD.md                    # adapt Platra CI_CD (releases repo name)
  apps/android/
    app/src/main/assets/weekday_fuel/Weekday_Fuel.html
    … WebView Activity + update check …
  .github/workflows/
    release-android.yml
```

---

## Agent checklist (bootstrap)

1. Create **`nutrition`** + **`nutrition-releases`** GitHub repos.
2. Scaffold Android from Platra `apps/android` with a new `applicationId` (confirm with user; e.g. `dev.weekdayfuel.app`).
3. Copy [`Weekday_Fuel.html`](nutrition-spinoff/Weekday_Fuel.html) into assets; host in WebView (JS + localStorage + external link handling).
4. Strip Platra product UI/API client; keep update-check path pointed at `nutrition-releases`.
5. Adapt release workflow + shared debug keystore secrets.
6. Ship first APK; verify cold-start update check after a version bump.
7. Only then change product behaviour (using transcript notes as constraints).

---

## Explicit non-goals (v0)

- Rewriting Weekday Fuel in Compose/React from scratch
- Backend / cloud sync / accounts
- Platra coach features
- Play Store pipeline

---

## Open questions (only if blocking)

- Final **repo name** and **`applicationId`**
- Whether update check is silent snackbar vs Settings-only (default: check on launch, non-blocking)
