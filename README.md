# Weekday Fuel

Self-contained Android app for weekday meal budgeting, weigh-ins, meals, and shopping. No backend: all state lives on the phone (`localStorage` inside the WebView).

The page started from the frozen v0 [`Weekday_Fuel.html`](docs/seed/Weekday_Fuel.html) in `docs/seed/` and now evolves through specs inside a WebView—including sending your Build-a-shop list to the Woolworths trolley—plus a GitHub Releases update check on cold start.

## Layout

| Path | What |
| --- | --- |
| `apps/android/` | Android app (`dev.weekdayfuel.app`) |
| `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` | The shipped UI |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt` | WebView host: JS + DOM storage on; Woolworths and Coles links open in in-app store screens, other links externally |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/update/` | GitHub Releases updater |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/` | Woolworths session, in-app Woolworths screen, trolley send |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/coles/` | Hidden Coles page that reads Coles prices (no JS bridge) |
| `apps/android/app/src/main/assets/weekday_fuel/cart.js`, `assets/woolworths/trolley.js` | Cart-line calculation; script that sets the Woolworths trolley |
| `apps/android/app/src/main/assets/woolworths/prices.js` | Script that reads live Woolworths prices |
| `apps/android/app/src/main/assets/coles/prices.js` | Script that reads live Coles prices |
| `apps/android/app/src/main/assets/coles/trolley.js` | Script that sets the Coles trolley |
| `apps/android/app/src/main/assets/woolworths/checkout.js`, `assets/weekday_fuel/checkoutview.js` | Script that boosts offers, reads delivery times and the order summary, and books a time; Checkout panel helpers |
| `apps/android/app/src/main/assets/weekday_fuel/orders.js` | Past orders: the snapshot saved when a shop is finished, and the stored list |
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

Opening Checkout changes your Woolworths account: it boosts every Everyday Rewards offer, and Book changes your delivery time. The app never pays; Pay on Woolworths opens the Woolworths checkout page, where you place the order yourself.
