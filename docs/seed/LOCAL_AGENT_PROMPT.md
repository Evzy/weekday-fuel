# Paste this into a new local Cursor agent

You are bootstrapping **Weekday Fuel** in a **new** GitHub repo. You may **not** have the Platra monorepo open.

## Do this first

1. Use **`gh`** to read seed materials from **`Evzy/platra`** (they are already on `main`):
   - `docs/NUTRITION_SPINOFF_BRIEF.md`
   - `docs/nutrition-spinoff/Weekday_Fuel.html` ← **exact app UI to ship**
   - `docs/nutrition-spinoff/TRANSCRIPT_NOTES.md`
   - `docs/nutrition-spinoff/README.md`
2. Ensure **`Evzy/nutrition`** exists (`gh repo create Evzy/nutrition --private` if missing and you have permission). Put the working tree there and push.
3. Optionally create **`Evzy/nutrition-releases`** for APK Releases.

Fetch pattern:

```bash
gh api repos/Evzy/platra/contents/docs/nutrition-spinoff/Weekday_Fuel.html --jq .content | base64 -d > Weekday_Fuel.html
```

Also pull `docs/CI_CD.md` from Platra as a reference for the APK/updater pipeline, and reuse ideas from Platra’s `apps/android` (WebView host + GitHub Releases updater) **without** copying coach/API code.

## Product rules

- **No backend API.** Self-contained Android app.
- Ship **`Weekday_Fuel.html` as-is** in a WebView (JS + `localStorage` + open Woolworths/Coles links externally).
- Platform extras only: debug APK CI + in-app update check against `nutrition-releases`.
- Defaults: `applicationId` = `dev.weekdayfuel.app`; check for updates on cold start (non-blocking).

Follow `NUTRITION_SPINOFF_BRIEF.md` for the full checklist.
