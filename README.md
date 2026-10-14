# Weekday Fuel

Self-contained Android app for weekday meal budgeting, weigh-ins, meals, and shopping. No backend: all state lives on the phone (`localStorage` inside the WebView).

The page started from the frozen v0 [`Weekday_Fuel.html`](docs/seed/Weekday_Fuel.html) in `docs/seed/` and now evolves through specs inside a WebView—including sending your Build-a-shop list to the Woolworths trolley—plus a GitHub Releases update check on cold start.

## Layout

| Path | What |
| --- | --- |
| `apps/android/` | Android app (`dev.weekdayfuel.app`) |
| `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` | The shipped UI |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt` | WebView host: JS + DOM storage on, off-app links (Woolworths/Coles) open externally |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/update/` | GitHub Releases updater |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/` | Woolworths session, in-app Woolworths screen, trolley send |
| `apps/android/app/src/main/assets/weekday_fuel/cart.js`, `assets/woolworths/trolley.js` | Cart-line calculation; script that sets the Woolworths trolley |
| `.github/workflows/release-android.yml` | Tests, debug APK, publish to [`Evzy/weekday-fuel-releases`](https://github.com/Evzy/weekday-fuel-releases) |
| `docs/CI_CD.md` | Release pipeline, secrets, signing |
| `docs/seed/` | Seed brief, transcript notes, frozen artifact (from Platra) |

## Install

Download the latest `WeekdayFuel-v*-debug.apk` from [weekday-fuel-releases](https://github.com/Evzy/weekday-fuel-releases/releases/latest) and open it on the phone. Later versions are offered automatically on launch.

## Build locally

Requires JDK 17 and the Android SDK (platform 35).

```bash
cd apps/android
cp local.properties.example local.properties   # set sdk.dir
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

The page is served from `https://appassets.androidplatform.net/assets/...` via `WebViewAssetLoader`, so `localStorage` has a stable origin. Keep that URL unchanged across versions or saved data will not carry over.

## Network

No backend. The phone talks directly to GitHub Releases (update check), Google Fonts, and woolworths.com.au — the last only after you tap Send, Checkout, or a Woolworths link. Your Woolworths login stays in the app's browser storage on the phone.
