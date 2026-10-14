# CI/CD (GitHub Actions)

Adapted from Platra's `docs/CI_CD.md` (Android plumbing only — no API, Azure, or Firebase).

## Workflow

| Workflow | File | When it runs | Purpose |
|----------|------|--------------|---------|
| **Release Android APK** | [`.github/workflows/release-android.yml`](../.github/workflows/release-android.yml) | PR to `main`, push to `main`, push tag `v*`, `workflow_dispatch` | Unit tests + **debug APK** (always uploaded as the `weekday-fuel-debug-apk` artifact). On push, publishes to **`OWNER/weekday-fuel-releases`** when release **`v{versionName}`** does not exist yet (main) or for an explicit **`v*`** tag. |

The workflow also runs the JS unit tests (`node --test apps/android/app/src/test/js/*.test.js`) and an Android 15 emulator launch smoke test; nothing is published unless all pass. `docs/seed/Weekday_Fuel.html` is the historical v0; the shipped page now evolves through specs.

## Releases repo + token

APK Releases live in **`weekday-fuel-releases`** (public, same owner as `weekday-fuel`) so the app can check for updates without a token. The workflow publishes with secret **`WEEKDAY_FUEL_RELEASES_TOKEN`**.

1. `weekday-fuel-releases` needs a `main` branch (a one-line `README.md` is enough).
2. Create a **fine-grained PAT**: Repository access → only `weekday-fuel-releases`; Permissions → **Contents: Read and write**.
3. In **`weekday-fuel`**: Settings → Secrets and variables → Actions → **`WEEKDAY_FUEL_RELEASES_TOKEN`**.

   ```bash
   gh secret set WEEKDAY_FUEL_RELEASES_TOKEN -R Evzy/weekday-fuel
   ```

## Cut a release

1. Bump `versionCode` / `versionName` in [`apps/android/app/build.gradle.kts`](../apps/android/app/build.gradle.kts) and merge to **`main`**. CI creates release **`v{versionName}`** with **`WeekdayFuel-v{version}-debug.apk`** if it does not exist yet.
2. Optional: push a tag (e.g. `git push origin v0.1.1`) to force a release for that tag.
3. If the release already exists, publish is skipped.

## In-app update check

On **cold start** the app calls `GET /repos/{UPDATE_GITHUB_OWNER}/{UPDATE_GITHUB_REPO}/releases/latest`. If the tag is newer than `versionName`, it shows a non-blocking dialog: **Update** downloads the `.apk` asset and hands it to the system installer (asking once for "install unknown apps"); **Later** dismisses until the next cold start. Network failures are ignored silently.

Defaults are `Evzy` / `weekday-fuel-releases`; override with `UPDATE_GITHUB_*` in `local.properties` or the environment (see [`local.properties.example`](../apps/android/local.properties.example)).

## Shared debug keystore (avoid "package conflicts")

Android only upgrades an install when the new APK is signed with the **same certificate**. CI and local builds must share one debug keystore.

| Secret | Purpose |
|--------|---------|
| `WEEKDAY_FUEL_SHARED_DEBUG_KEYSTORE_B64` | Base64 of the keystore file |
| `WEEKDAY_FUEL_SHARED_DEBUG_STORE_PASSWORD` | Keystore password |
| `WEEKDAY_FUEL_SHARED_DEBUG_KEY_ALIAS` | e.g. `weekdayfuel_shared_debug` |
| `WEEKDAY_FUEL_SHARED_DEBUG_KEY_PASSWORD` | Key password |

To build locally with the same key, copy the keystore to `apps/android/app/ci-shared-debug.keystore` (gitignored) and add `debug.storeFile`, `debug.storePassword`, `debug.keyAlias`, `debug.keyPassword` to `apps/android/local.properties`.

If a device has an APK signed with a different key, uninstall once (this clears Weekday Fuel's on-device data), then install from `weekday-fuel-releases`.

CI builds **debug** APKs only. A Play Store pipeline (`assembleRelease` + release keystore) is out of scope for v0.

## Secrets summary

| Secret | Required | Purpose |
|--------|----------|---------|
| `WEEKDAY_FUEL_RELEASES_TOKEN` | For publishing | PAT with Contents: write on `weekday-fuel-releases` |
| `WEEKDAY_FUEL_SHARED_DEBUG_*` (4) | Recommended | Stable signing so in-app updates install over previous versions |
