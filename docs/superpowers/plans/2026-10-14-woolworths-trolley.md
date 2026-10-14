# Woolworths Trolley Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md`](../specs/2026-10-14-woolworths-trolley-design.md)

**Goal:** One tap on the Shop tab sets every not-yet-ticked Woolworths product into the owner's woolworths.com.au trolley (whole packs), in the background, then the owner checks out in an in-app Woolworths screen.

**Architecture:** The Weekday Fuel page computes cart lines in a small pure `cart.js` and posts them to the Android host over an origin-restricted `WebMessageListener`. A `WoolworthsSession` owns a second WebView on woolworths.com.au (kept attached underneath the app page so it runs at full speed), injects `trolley.js` which sends the site's own set-quantity requests, and the host polls its state and relays progress/results back to the page. A `WoolworthsScreen` overlay brings that WebView to the front for login and checkout.

**Tech Stack:** Kotlin 2.0.21, AGP 8.7.2, Android WebView + `androidx.webkit` 1.12.1 (`WebViewAssetLoader`, `WebViewCompat.addWebMessageListener`), `org.json`, plain browser JS, Node built-in test runner (`node --test`), JUnit 4, GitHub Actions.

## Global Constraints

- `applicationId` stays `dev.weekdayfuel.app`; the app page URL stays `https://appassets.androidplatform.net/assets/weekday_fuel/Weekday_Fuel.html`; the signing key does not change.
- No server. Network traffic only to: GitHub Releases (update check), Google Fonts, and `woolworths.com.au` — the latter only after the owner taps Send, Checkout, or a Woolworths link.
- Woolworths pages never get a JavaScript bridge into the app. Only origin `https://appassets.androidplatform.net` may message the host. Results from Woolworths come back only via `evaluateJavascript`.
- The Woolworths login lives only in the app's WebView cookie storage on the phone.
- Saved `localStorage` data does not change shape (cart lines are computed per send, never stored).
- HTML changes are limited to the Shop tab's trolley panel and `buildList()`'s numeric pack count; reuse existing CSS classes (`panel`, `stack`, `btn`, `ghost`, `hint`, `eyebrow`, `row`, `between`, `small`, `muted`, `num`). No redesign.
- Quantities are whole packs; products already in the trolley are **set** to the app's quantity (no doubling).
- Nothing in CI talks to the real Woolworths site.
- Commit straight to `main`, message prefix `woolworths-trolley:`. After each push, CI (unit tests, JS tests, debug APK, Android 15 launch smoke test) must be green before starting the next task.
- There is no local Android SDK: Kotlin is verified by CI. JS tests run locally with Node 24 (`node --test`).
- Release (version bump) only where a task says so.

### Watching CI after a push (PowerShell)

```powershell
git push
Start-Sleep 8
$id = gh run list -R Evzy/weekday-fuel -b main -L 1 --json databaseId --jq '.[0].databaseId'
gh run watch $id -R Evzy/weekday-fuel --exit-status
```

Expected: exits 0, all steps ✓. If it fails, read `gh run view $id -R Evzy/weekday-fuel --log-failed`, fix, push again.

## File Structure

| Path | Responsibility |
| --- | --- |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsUrls.kt` | Woolworths URL constants + host check |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsSession.kt` | Owns the Woolworths WebView; send/poll/login-resume/timeout |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsScreen.kt` | Overlay view: "← Weekday Fuel" bar + session WebView; show/hide by z-order |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt` | `TrolleyLine`, results/state types, `TrolleyJson` parsing |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt` | JSON messages host → page |
| `apps/android/app/src/main/assets/woolworths/trolley.js` | Runs inside woolworths.com.au: login check + set-quantity requests |
| `apps/android/app/src/main/assets/weekday_fuel/cart.js` | Pure cart-line calculation |
| `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` | Loads `cart.js`; `buildList()` pack count; trolley panel; host messages |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt` | Wires overlay, link routing, host channel, back button |
| `apps/android/app/src/test/js/cart.test.js`, `trolley.test.js` | Node tests |
| `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/*Test.kt` | JVM tests |
| `docs/woolworths-requests.md` | Captured Woolworths requests + in-app go/no-go results |

---

### Task 1: In-app Woolworths screen (go/no-go part A)

Woolworths product links open in an in-app Woolworths screen (logged-in session kept), then the owner checks login persistence and checkout inside the WebView on the phone.

**Files:**
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsUrls.kt`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsSession.kt`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsScreen.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt` (full replacement below)
- Modify: `apps/android/app/src/main/res/values/colors.xml`, `apps/android/app/src/main/res/values-night/colors.xml`, `apps/android/app/src/main/res/values/strings.xml`
- Modify: `apps/android/app/build.gradle.kts` (version 0.1.2)
- Create: `docs/woolworths-requests.md`
- Test: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/WoolworthsUrlsTest.kt`

**Interfaces:**
- Produces: `WoolworthsUrls.HOME_URL`, `LOGIN_URL`, `TROLLEY_URL` (String consts), `WoolworthsUrls.isWoolworthsHost(host: String?): Boolean`; `class WoolworthsSession(context: Context, openExternal: (Uri) -> Unit)` with `val webView: WebView`, `fun load(url: String)`; `class WoolworthsScreen(context: Context, sessionView: WebView, appView: View, onClose: () -> Unit)` with `val view: LinearLayout`, `val isShowing: Boolean`, `fun show()`, `fun hide()`, `fun setStatus(text: String?)`. `MainActivity.showWoolworths(url: String)` / `hideWoolworths()` (private).

- [ ] **Step 1: Write the failing test**

`apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/WoolworthsUrlsTest.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WoolworthsUrlsTest {
    @Test
    fun matchesWoolworthsHosts() {
        assertTrue(WoolworthsUrls.isWoolworthsHost("www.woolworths.com.au"))
        assertTrue(WoolworthsUrls.isWoolworthsHost("woolworths.com.au"))
    }

    @Test
    fun rejectsOtherAndLookalikeHosts() {
        assertFalse(WoolworthsUrls.isWoolworthsHost("www.coles.com.au"))
        assertFalse(WoolworthsUrls.isWoolworthsHost("evilwoolworths.com.au"))
        assertFalse(WoolworthsUrls.isWoolworthsHost("woolworths.com.au.evil.example"))
        assertFalse(WoolworthsUrls.isWoolworthsHost(null))
    }
}
```

- [ ] **Step 2: Implement `WoolworthsUrls`**

`apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsUrls.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

object WoolworthsUrls {
    const val HOME_URL = "https://www.woolworths.com.au/"
    const val LOGIN_URL = "https://www.woolworths.com.au/shop/securelogin"
    const val TROLLEY_URL = "https://www.woolworths.com.au/shop/checkout"

    fun isWoolworthsHost(host: String?): Boolean =
        host != null && (host == "woolworths.com.au" || host.endsWith(".woolworths.com.au"))
}
```

- [ ] **Step 3: Implement `WoolworthsSession` (browsing only for now)**

`apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsSession.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/** Owns the woolworths.com.au WebView, whether or not it is on screen. */
@SuppressLint("SetJavaScriptEnabled")
class WoolworthsSession(context: Context, private val openExternal: (Uri) -> Unit) {
    val webView: WebView =
        WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webViewClient = SessionClient()
        }

    fun load(url: String) = webView.loadUrl(url)

    private inner class SessionClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val scheme = request.url.scheme
            if (scheme == "http" || scheme == "https") return false
            openExternal(request.url)
            return true
        }
    }
}
```

- [ ] **Step 4: Implement `WoolworthsScreen`**

`apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsScreen.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import android.content.Context
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import dev.weekdayfuel.app.R

/**
 * "← Weekday Fuel" bar above the session WebView. When hidden it stays attached and visible underneath
 * the app page (z-order), because a hidden WebView throttles the session's scripts.
 */
class WoolworthsScreen(
    context: Context,
    sessionView: WebView,
    private val appView: View,
    onClose: () -> Unit,
) {
    private val status =
        TextView(context).apply {
            setTextColor(context.getColor(R.color.ink))
            textSize = 13f
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setPadding(0, 0, 32, 0)
        }

    val view: LinearLayout =
        LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(context.getColor(R.color.page_background))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            val bar =
                LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    addView(
                        Button(context, null, android.R.attr.borderlessButtonStyle).apply {
                            text = context.getString(R.string.woolworths_back)
                            setTextColor(context.getColor(R.color.ink))
                            isAllCaps = false
                            setOnClickListener { onClose() }
                        },
                    )
                    addView(status, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))
                }
            addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(sessionView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        }

    var isShowing = false
        private set

    fun show() {
        isShowing = true
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        appView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        view.bringToFront()
    }

    fun hide() {
        isShowing = false
        setStatus(null)
        appView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        appView.bringToFront()
    }

    fun setStatus(text: String?) {
        status.text = text.orEmpty()
    }
}
```

- [ ] **Step 5: Add colours and strings**

In `apps/android/app/src/main/res/values/colors.xml`, add inside `<resources>` (after `page_background`):

```xml
    <color name="ink">#16201A</color>
```

In `apps/android/app/src/main/res/values-night/colors.xml`, add inside `<resources>`:

```xml
    <color name="ink">#E6ECE7</color>
```

In `apps/android/app/src/main/res/values/strings.xml`, add before `</resources>`:

```xml
    <string name="woolworths_back">← Weekday Fuel</string>
```

- [ ] **Step 6: Wire the overlay into `MainActivity`**

Replace the whole of `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt` with:

```kotlin
package dev.weekdayfuel.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import dev.weekdayfuel.app.update.GithubApkReleaseInfo
import dev.weekdayfuel.app.update.GithubApkReleaseUpdater
import dev.weekdayfuel.app.update.ReleaseVersionCompare
import dev.weekdayfuel.app.woolworths.WoolworthsScreen
import dev.weekdayfuel.app.woolworths.WoolworthsSession
import dev.weekdayfuel.app.woolworths.WoolworthsUrls
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var woolworths: WoolworthsSession
    private lateinit var woolworthsScreen: WoolworthsScreen

    /** Set when the user tapped Update but first had to grant "install unknown apps". */
    private var pendingUpdate: GithubApkReleaseInfo? = null
    private var updateInProgress = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.page_background)) }

        val assetLoader =
            WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .build()

        webView =
            WebView(this).apply {
                setBackgroundColor(getColor(R.color.page_background))
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                webViewClient = HostWebViewClient(assetLoader)
            }
        woolworths = WoolworthsSession(this, ::openExternally)
        woolworthsScreen = WoolworthsScreen(this, woolworths.webView, webView, onClose = ::hideWoolworths)
        root.addView(woolworthsScreen.view, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        root.addView(webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        setContentView(root)
        // Needs the decor view, which only exists after setContentView (NPE on Android 15 otherwise).
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isNight
            isAppearanceLightNavigationBars = !isNight
        }

        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() or
                        WindowInsetsCompat.Type.displayCutout() or
                        WindowInsetsCompat.Type.ime(),
                )
            v.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    when {
                        woolworthsScreen.isShowing && woolworths.webView.canGoBack() -> woolworths.webView.goBack()
                        woolworthsScreen.isShowing -> hideWoolworths()
                        webView.canGoBack() -> webView.goBack()
                        else -> {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                            isEnabled = true
                        }
                    }
                }
            },
        )

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL)
        }
        if (savedInstanceState == null) {
            checkForUpdateOnColdStart()
        }
    }

    override fun onResume() {
        super.onResume()
        val pending = pendingUpdate ?: return
        if (packageManager.canRequestPackageInstalls()) {
            pendingUpdate = null
            downloadAndInstall(pending)
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        woolworths.webView.destroy()
        webView.destroy()
        super.onDestroy()
    }

    private fun showWoolworths(url: String) {
        woolworths.load(url)
        woolworthsScreen.show()
    }

    private fun hideWoolworths() {
        woolworthsScreen.hide()
    }

    private fun checkForUpdateOnColdStart() {
        if (!GithubApkReleaseUpdater.isConfigured()) return
        lifecycleScope.launch {
            GithubApkReleaseUpdater.fetchLatestApkRelease()
                .onSuccess { release ->
                    val versus = ReleaseVersionCompare.compare(release.tagName, BuildConfig.VERSION_NAME)
                    if (versus == ReleaseVersionCompare.VersusInstalled.UPDATE_AVAILABLE && !isFinishing) {
                        showUpdateDialog(release)
                    }
                }
                .onFailure { Log.i(TAG, "Update check skipped: ${it.message}") }
        }
    }

    private fun showUpdateDialog(release: GithubApkReleaseInfo) {
        AlertDialog.Builder(this)
            .setTitle(R.string.update_available_title)
            .setMessage(getString(R.string.update_available_message, release.tagName, "v${BuildConfig.VERSION_NAME}"))
            .setPositiveButton(R.string.update_install) { _, _ -> startUpdate(release) }
            .setNegativeButton(R.string.update_later, null)
            .show()
    }

    private fun startUpdate(release: GithubApkReleaseInfo) {
        if (GithubApkReleaseUpdater.ensureInstallFromUnknownSources(this)) {
            downloadAndInstall(release)
        } else {
            pendingUpdate = release
            Toast.makeText(this, R.string.update_allow_installs, Toast.LENGTH_LONG).show()
        }
    }

    private fun downloadAndInstall(release: GithubApkReleaseInfo) {
        if (updateInProgress) return
        updateInProgress = true
        val progress =
            AlertDialog.Builder(this)
                .setTitle(R.string.update_downloading)
                .setView(ProgressBar(this).apply { isIndeterminate = true; setPadding(0, 48, 0, 48) })
                .setCancelable(false)
                .show()
        lifecycleScope.launch {
            val result = GithubApkReleaseUpdater.downloadApkToCache(this@MainActivity, release.downloadUrl)
            progress.dismiss()
            updateInProgress = false
            result
                .onSuccess { GithubApkReleaseUpdater.startPackageInstall(this@MainActivity, it) }
                .onFailure {
                    Toast.makeText(
                        this@MainActivity,
                        getString(R.string.update_failed, it.message ?: it.javaClass.simpleName),
                        Toast.LENGTH_LONG,
                    ).show()
                }
        }
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    private inner class HostWebViewClient(
        private val assetLoader: WebViewAssetLoader,
    ) : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            assetLoader.shouldInterceptRequest(request.url)

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (request.url.host == WebViewAssetLoader.DEFAULT_DOMAIN) return false
            if (WoolworthsUrls.isWoolworthsHost(request.url.host)) {
                showWoolworths(request.url.toString())
                return true
            }
            openExternally(request.url)
            return true
        }
    }

    private companion object {
        const val TAG = "WeekdayFuel"
        val APP_URL = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/weekday_fuel/Weekday_Fuel.html"
    }
}
```

- [ ] **Step 7: Bump the version so the owner can test on the phone**

In `apps/android/app/build.gradle.kts`:

```kotlin
        versionCode = 3
        versionName = "0.1.2"
```

- [ ] **Step 8: Create the findings doc**

`docs/woolworths-requests.md`:

```markdown
# Woolworths requests and in-app checks

Evidence for the go/no-go checks in the Woolworths trolley spec. Values here are what `assets/woolworths/trolley.js` and `WoolworthsUrls.kt` must match.

## In-app checks (phone, v0.1.2+)

| Check | Result | Notes |
| --- | --- | --- |
| Woolworths product link opens in the in-app Woolworths screen | | |
| Log in works inside the in-app screen | | |
| Still logged in after closing and reopening the app | | |
| Trolley → checkout → pick a time reaches the payment step with the saved card | | |
| Login page URL | | |
| Trolley/cart page URL | | |

## Login status request

| Field | Value |
| --- | --- |
| URL | |
| Method | |
| JSON path that says logged in / out | |

## Set trolley quantity request

| Field | Value |
| --- | --- |
| URL | |
| Method | |
| Body for "Chobani 717518 quantity 2" | |
| Sending the same body twice leaves quantity 2 (set, not add)? | |
| Quantity 0 removes the product? | |
| Response status when it works | |
| Response when logged out | |

## Deli ham (175734)

| Field | Value |
| --- | --- |
| Body the site sends when adding shaved ham | |
| Can it be set by the same request? | |

## Decision

Go / no-go:
```

- [ ] **Step 9: Commit, push, and watch CI**

```powershell
git add apps/android docs/woolworths-requests.md
git commit -m "woolworths-trolley: in-app Woolworths screen; release: v0.1.2"
```

Then run the "Watching CI after a push" commands. Expected: green, and `Evzy/weekday-fuel-releases` gets `v0.1.2`.

- [ ] **Step 10 (OWNER, phone): in-app go/no-go checks**

On the phone, accept the v0.1.2 update prompt (or install `WeekdayFuel-v0.1.2-debug.apk`), then:

1. Shop → Full list → tap "Chobani" → "Woolworths product page ↗". Expected: opens inside the app with "← Weekday Fuel" at the top.
2. Log in on the Woolworths site.
3. Swipe the app away, reopen it, open the same product link. Expected: still logged in.
4. Add any product with the site's own button, open the trolley, go to checkout, pick a time. Expected: reaches the payment step showing the saved card. Back out without paying.
5. Note the login page URL and trolley page URL from step 2/4 (long-press is not available in WebView; read them from desktop Chrome in Task 2 if needed).

Fill in the "In-app checks" table in `docs/woolworths-requests.md`.

**If login is refused with a "browser not supported" style message**, add this line inside the `WebView(context).apply { … }` block in `WoolworthsSession.kt`, push, and repeat the checks:

```kotlin
            settings.userAgentString = settings.userAgentString.replace("; wv", "")
```

**If the login page or trolley page URL differs from `WoolworthsUrls`**, update `LOGIN_URL` / `TROLLEY_URL` to the recorded values.

- [ ] **Step 11: Commit the findings**

```powershell
git add docs/woolworths-requests.md apps/android
git commit -m "woolworths-trolley: record in-app checks"
git push
```

**Gate:** If login or checkout does not work in the WebView even with the user-agent change, stop here and revisit the spec with the owner.

---

### Task 2: Capture the Woolworths requests (go/no-go part B)

Record the exact login-status and set-quantity requests from desktop Chrome on the owner's account, and prove set-not-add semantics. This needs the owner's login: either the owner does it in desktop Chrome, or the agent drives the Cursor browser after the owner logs in there manually.

**Files:**
- Modify: `docs/woolworths-requests.md`

**Interfaces:**
- Produces: confirmed values for `LOGIN_STATUS_URL`, the logged-in JSON path, `TROLLEY_UPDATE_URL`, and the update body shape, consumed by Task 4.

- [ ] **Step 1: Login-status request**

Desktop Chrome, logged in at https://www.woolworths.com.au → DevTools → Network → filter Fetch/XHR → tick "Preserve log" → reload. Find the response containing `IsLoggedIn` (expected: `GET /api/ui/v2/bootstrap`, path `ShopperDetailsRequest.IsLoggedIn`). Record URL, method, JSON path.

- [ ] **Step 2: Set-quantity request from the site**

Open https://www.woolworths.com.au/shop/productdetails/717518 → "Add to trolley", then tap "+" once. Record the request(s) fired (expected: `POST /apis/ui/Trolley/Update`), and the JSON body for quantity 2.

- [ ] **Step 3: Same request from a script, and set semantics**

In the DevTools Console on the same tab, run twice:

```js
await fetch("/apis/ui/Trolley/Update",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({items:[{stockcode:717518,quantity:2,diagnostics:"0",source:"ProductDetail",searchTerm:null,evaluateRewardPoints:false,offerId:null,profileId:null,priceLevel:null}]})}).then(r=>r.status)
```

(Use the URL/body from Step 2 if they differ.) Expected: `200` each time, and the trolley shows Chobani × **2** (not 4). Then run it with `quantity:0` and confirm Chobani is removed. Record results.

- [ ] **Step 4: Logged-out behaviour**

In an Incognito window on woolworths.com.au (not logged in), run the Step 1 request in the Console (`await (await fetch("/api/ui/v2/bootstrap",{credentials:"include"})).json()`) and record what the logged-in path holds. Record what the Step 3 request returns while logged out.

- [ ] **Step 5: Deli ham**

On https://www.woolworths.com.au/shop/productdetails/175734 add the shaved ham and record the request body (look for weight/unit fields). Note whether the Step 3 request shape with a quantity works for it.

- [ ] **Step 6: Decide and commit**

Fill in "Decision" in `docs/woolworths-requests.md`: **Go** if Steps 1–3 work (script request accepted, set-not-add confirmed); otherwise **No-go** and stop to revisit the spec.

```powershell
git add docs/woolworths-requests.md
git commit -m "woolworths-trolley: record Woolworths requests"
git push
```

---

### Task 3: Cart-line calculation (`cart.js`)

**Files:**
- Create: `apps/android/app/src/main/assets/weekday_fuel/cart.js`
- Test: `apps/android/app/src/test/js/cart.test.js`
- Modify: `.github/workflows/release-android.yml` (add JS test step)
- Modify: `docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md` (Verification wording)

**Interfaces:**
- Produces (browser global `window.WeekdayFuelCart`, and CommonJS export):
  - `stockcodeOf(url: string | undefined): number | null`
  - `cartLines(rows: Row[], ticks: {[itemId]: boolean}, links: {[itemId]: [label: string, url: string][]}): { lines: Line[], manual: Manual[] }`
  - `Row = { id: string, n: number, used: string[], name: string }`
  - `Line = { itemId: string, stockcode: number, quantity: number, name: string, url: string }`
  - `Manual = { itemId: string, name: string, reason: "deli" | "coles" | "nostore" }`

- [ ] **Step 1: Write the failing tests**

`apps/android/app/src/test/js/cart.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cartLines, stockcodeOf } = require("../../main/assets/weekday_fuel/cart.js");

// Verbatim subset of LINKS in Weekday_Fuel.html.
const LINKS = {
  dare: [["Woolworths", "https://www.woolworths.com.au/shop/productdetails/72280"], ["Coles", "https://www.coles.com.au/product/dare-protein-no-sugar-added-iced-coffee-double-espresso-500ml-8991361"]],
  breast: [["Coles", "https://www.coles.com.au/product/coles-rspca-approved-chicken-breast-fillets-large-pack-approx.-1.4kg-2263179"]],
  ham: [["Woolworths", "https://www.woolworths.com.au/shop/productdetails/175734/d-orsogna-ham-leg-triple-smoked-97-fat-free-shaved"]],
  yog: [["Woolworths", "https://www.woolworths.com.au/shop/productdetails/717518/chobani-greek-yoghurt-natural-light-plain"]],
  pasta: [["Spaghetti", "https://www.woolworths.com.au/shop/productdetails/43974/san-remo-spaghetti-pasta-no-5"], ["Macaroni", "https://www.woolworths.com.au/shop/productdetails/44025"]],
  sauces1: [["Teriyaki", "https://www.woolworths.com.au/shop/productdetails/33948/kikkoman-marinade-teriyaki"], ["Oyster sauce", "https://www.woolworths.com.au/shop/productdetails/364439/lee-kum-kee-panda-sauce-oyster"]],
};

const row = (id, n, name, used = []) => ({ id, n, name, used });

test("stockcodeOf reads Woolworths product URLs with or without a slug", () => {
  assert.equal(stockcodeOf(LINKS.yog[0][1]), 717518);
  assert.equal(stockcodeOf(LINKS.pasta[1][1]), 44025);
  assert.equal(stockcodeOf(LINKS.breast[0][1]), null);
  assert.equal(stockcodeOf(undefined), null);
});

test("a packed item is sent with its pack count", () => {
  const { lines, manual } = cartLines([row("yog", 2, "Chobani Greek Yoghurt")], {}, LINKS);
  assert.deepEqual(lines, [{ itemId: "yog", stockcode: 717518, quantity: 2, name: "Chobani Greek Yoghurt", url: LINKS.yog[0][1] }]);
  assert.deepEqual(manual, []);
});

test("ticked items are left out entirely", () => {
  const { lines, manual } = cartLines([row("yog", 2, "Chobani"), row("breast", 1, "Chicken breast")], { yog: true, breast: true }, LINKS);
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, []);
});

test("Dare uses the Woolworths link with one per fixture day", () => {
  const { lines } = cartLines([row("dare", 5, "Dare")], {}, LINKS);
  assert.deepEqual(lines.map((l) => [l.stockcode, l.quantity]), [[72280, 5]]);
});

test("pasta sends only the packets the picked meals use", () => {
  const both = cartLines([row("pasta", 1, "Pasta", ["buffalomac", "bolognese"])], {}, LINKS).lines;
  assert.deepEqual(both.map((l) => [l.stockcode, l.quantity]), [[43974, 1], [44025, 1]]);
  const spaghetti = cartLines([row("pasta", 1, "Pasta", ["bolognese"])], {}, LINKS).lines;
  assert.deepEqual(spaghetti.map((l) => l.stockcode), [43974]);
  const macaroni = cartLines([row("pasta", 1, "Pasta", ["buffalomac", "toasty"])], {}, LINKS).lines;
  assert.deepEqual(macaroni.map((l) => l.stockcode), [44025]);
});

test("an item with two Woolworths links sends each product, named by its label", () => {
  const { lines } = cartLines([row("sauces1", 1, "Teriyaki + oyster sauce")], {}, LINKS);
  assert.deepEqual(
    lines.map((l) => [l.stockcode, l.quantity, l.name]),
    [[33948, 1, "Teriyaki + oyster sauce (Teriyaki)"], [364439, 1, "Teriyaki + oyster sauce (Oyster sauce)"]],
  );
});

test("deli ham, Coles-only and unlinked items go to the do-it-yourself list", () => {
  const { lines, manual } = cartLines(
    [row("ham", 1, "Shaved ham"), row("breast", 1, "Chicken breast"), row("evap", 1, "Evaporated milk")],
    {},
    LINKS,
  );
  assert.deepEqual(lines, []);
  assert.deepEqual(manual, [
    { itemId: "ham", name: "Shaved ham", reason: "deli" },
    { itemId: "breast", name: "Chicken breast", reason: "coles" },
    { itemId: "evap", name: "Evaporated milk", reason: "nostore" },
  ]);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `node --test apps/android/app/src/test/js/cart.test.js`
Expected: FAIL with `Cannot find module '../../main/assets/weekday_fuel/cart.js'`.

- [ ] **Step 3: Implement `cart.js`**

`apps/android/app/src/main/assets/weekday_fuel/cart.js`:

```js
/* Turns Build a shop rows into Woolworths trolley lines. Pure: no DOM, no storage. */
(function (root) {
  "use strict";
  var PRODUCT = /^https:\/\/www\.woolworths\.com\.au\/shop\/productdetails\/(\d+)/;
  var PASTA_LABEL_FOR_MEAL = { bolognese: "Spaghetti", buffalomac: "Macaroni" };

  function stockcodeOf(url) {
    var m = PRODUCT.exec(url || "");
    return m ? Number(m[1]) : null;
  }

  function cartLines(rows, ticks, links) {
    var lines = [];
    var manual = [];
    rows.forEach(function (row) {
      if (ticks[row.id]) return;
      if (row.id === "ham") {
        manual.push({ itemId: row.id, name: row.name, reason: "deli" });
        return;
      }
      var all = links[row.id] || [];
      var woolies = all.filter(function (l) { return stockcodeOf(l[1]) !== null; });
      if (row.id === "pasta") {
        var wanted = (row.used || []).map(function (meal) { return PASTA_LABEL_FOR_MEAL[meal]; });
        woolies = woolies.filter(function (l) { return wanted.indexOf(l[0]) !== -1; });
      }
      if (!woolies.length) {
        manual.push({ itemId: row.id, name: row.name, reason: all.length ? "coles" : "nostore" });
        return;
      }
      var several = woolies.length > 1;
      woolies.forEach(function (l) {
        lines.push({
          itemId: row.id,
          stockcode: stockcodeOf(l[1]),
          quantity: row.n,
          name: several ? row.name + " (" + l[0] + ")" : row.name,
          url: l[1],
        });
      });
    });
    return { lines: lines, manual: manual };
  }

  var api = { cartLines: cartLines, stockcodeOf: stockcodeOf };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelCart = api;
})(this);
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test apps/android/app/src/test/js/cart.test.js`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 5: Run JS tests in CI**

In `.github/workflows/release-android.yml`, insert this step immediately before `- name: Decode shared debug keystore`:

```yaml
      - name: JS unit tests
        run: node --test apps/android/app/src/test/js/cart.test.js
```

- [ ] **Step 6: Align the spec's verification wording**

In `docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md`, replace:

```text
- `cart.js` unit tests with Node's built-in test runner (`node --test`), using real cases: the starter shop, a ticked item excluded, Dare/Grenade days, pasta with one or both pasta meals, two-link items, Coles-only and unlinked items routed to "Add these yourself".
```

with:

```text
- `cart.js` unit tests with Node's built-in test runner (`node --test`), using rows shaped like `buildList()` output and a verbatim subset of `LINKS`: a packed item, a ticked item excluded, Dare days, pasta with one or both pasta meals, two-link items, deli/Coles-only/unlinked items routed to "Add these yourself". The full starter shop is checked on the phone.
```

- [ ] **Step 7: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/cart.js apps/android/app/src/test/js/cart.test.js .github/workflows/release-android.yml docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md
git commit -m "woolworths-trolley: cart-line calculation with Node tests"
```

Then the "Watching CI after a push" commands. Expected: green, "JS unit tests" ✓, no release (version unchanged).

---

### Task 4: Trolley script and Kotlin models

**Files:**
- Create: `apps/android/app/src/main/assets/woolworths/trolley.js`
- Test: `apps/android/app/src/test/js/trolley.test.js`
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt`
- Test: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt`
- Modify: `apps/android/gradle/libs.versions.toml`, `apps/android/app/build.gradle.kts` (org.json for JVM tests)
- Modify: `.github/workflows/release-android.yml` (add trolley test file)
- Modify: `docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md` (outcome wording)

**Interfaces:**
- Consumes: confirmed request values in `docs/woolworths-requests.md` (Task 2).
- Produces:
  - In the Woolworths page: `window.__weekdayFuelTrolley = { start(lines: {stockcode, quantity}[]): boolean /* false if a run is already in progress */, state(): string /* JSON */, urls: { loginStatus, trolleyUpdate } }`. State JSON: `{ phase: "idle"|"checking"|"loggedOut"|"adding"|"done"|"error", total, completed, results: {stockcode, outcome: "added"|"failed", reason?}[], error: string|null }`.
  - Kotlin: `data class TrolleyLine(val stockcode: Long, val quantity: Int)`, `data class TrolleyLineResult(val stockcode: Long, val added: Boolean, val reason: String?)`, `enum class TrolleyPhase { IDLE, CHECKING, LOGGED_OUT, ADDING, DONE, ERROR }`, `data class TrolleyScriptState(val phase: TrolleyPhase, val total: Int, val completed: Int, val results: List<TrolleyLineResult>, val error: String?)`, `object TrolleyJson { fun parseLines(lines: JSONArray): List<TrolleyLine>; fun linesToJson(lines: List<TrolleyLine>): String; fun parseScriptState(evaluateResult: String?): TrolleyScriptState? }`.

- [ ] **Step 0: Check the captured requests**

The code below already uses the values recorded in `docs/woolworths-requests.md` on 2026-10-15: login status is `GET /api/ui/v2/bootstrap` → `ShopperRequest.IsGuest === false`; set quantity is `POST /api/v3/ui/trolley/update` with `{items:[{stockcode, quantity, source:"ProductDetail", diagnostics:"0", searchTerm:null, evaluateRewardPoints:false, offerId:null, profileId:null, priceLevel:null}]}`. The update always answers HTTP 200 (even for an unknown stockcode, and even when logged out, where it fills a guest trolley), so a line counts as added only when the response's `UpdatedItems` contains its `Stockcode`. If the doc and this task disagree, the doc wins.

- [ ] **Step 1: Write the failing JS tests**

`apps/android/app/src/test/js/trolley.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../../main/assets/woolworths/trolley.js");
const LOGGED_IN = { ShopperRequest: { IsGuest: false } };
const LOGGED_OUT = { ShopperRequest: { IsGuest: true } };
const LINES = [{ stockcode: 717518, quantity: 2 }, { stockcode: 72280, quantity: 5 }];

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function accepted(init) {
  const item = JSON.parse(init.body).items[0];
  return response(200, { UpdatedItems: [{ Stockcode: item.stockcode, Quantity: item.quantity }] });
}

function load(handler) {
  const calls = [];
  globalThis.window = {};
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, globalThis.window.__weekdayFuelTrolley.urls);
  };
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return { api: globalThis.window.__weekdayFuelTrolley, calls };
}

async function settle(api) {
  for (let i = 0; i < 200; i++) {
    const s = JSON.parse(api.state());
    if (s.phase !== "checking" && s.phase !== "adding") return s;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("trolley script did not settle");
}

test("stops at loggedOut without touching the trolley", async () => {
  const { api, calls } = load(() => response(200, LOGGED_OUT));
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "loggedOut");
  assert.equal(calls.length, 1);
});

test("sets each line's quantity in order", async () => {
  const { api, calls } = load((url, init, urls) => (url === urls.loginStatus ? response(200, LOGGED_IN) : accepted(init)));
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.equal(s.completed, 2);
  const updates = calls.slice(1);
  assert.deepEqual(updates.map((c) => [c.url, c.init.method]), [["/api/v3/ui/trolley/update", "POST"], ["/api/v3/ui/trolley/update", "POST"]]);
  assert.deepEqual(updates.map((c) => JSON.parse(c.init.body).items[0]).map((i) => [i.stockcode, i.quantity]), [[717518, 2], [72280, 5]]);
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "added" }, { stockcode: 72280, outcome: "added" }]);
});

test("a rejected line is reported and the rest still go in", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    return JSON.parse(init.body).items[0].stockcode === 717518 ? response(500, {}) : accepted(init);
  });
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "failed", reason: "HTTP 500" }, { stockcode: 72280, outcome: "added" }]);
});

test("a line Woolworths silently drops is reported as not available", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    return JSON.parse(init.body).items[0].stockcode === 717518 ? response(200, { UpdatedItems: [] }) : accepted(init);
  });
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "done");
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "failed", reason: "not available" }, { stockcode: 72280, outcome: "added" }]);
});

test("a network error on a line is reported as failed", async () => {
  const { api } = load((url, init, urls) => {
    if (url === urls.loginStatus) return response(200, LOGGED_IN);
    throw new Error("offline");
  });
  api.start([LINES[0]]);
  const s = await settle(api);
  assert.deepEqual(s.results, [{ stockcode: 717518, outcome: "failed", reason: "offline" }]);
});

test("a failing login check ends in error", async () => {
  const { api } = load(() => response(403, {}));
  api.start(LINES);
  const s = await settle(api);
  assert.equal(s.phase, "error");
  assert.equal(s.error, "login check HTTP 403");
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test apps/android/app/src/test/js/trolley.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `trolley.js`**

`apps/android/app/src/main/assets/woolworths/trolley.js`:

```js
/* Injected into woolworths.com.au by WoolworthsSession. Sets trolley quantities with the site's own requests. */
(function () {
  "use strict";
  if (window.__weekdayFuelTrolley) return;

  var LOGIN_STATUS_URL = "/api/ui/v2/bootstrap";
  var TROLLEY_UPDATE_URL = "/api/v3/ui/trolley/update";
  var state = { phase: "idle", total: 0, completed: 0, results: [], error: null };

  function isLoggedIn(json) {
    return Boolean(json && json.ShopperRequest && json.ShopperRequest.IsGuest === false);
  }

  function wasUpdated(json, stockcode) {
    var items = (json && json.UpdatedItems) || [];
    return items.some(function (item) { return item.Stockcode === stockcode; });
  }

  function updateBody(line) {
    return {
      items: [{
        stockcode: line.stockcode,
        quantity: line.quantity,
        source: "ProductDetail",
        diagnostics: "0",
        searchTerm: null,
        evaluateRewardPoints: false,
        offerId: null,
        profileId: null,
        priceLevel: null,
      }],
    };
  }

  async function checkLogin() {
    var r = await fetch(LOGIN_STATUS_URL, { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("login check HTTP " + r.status);
    return isLoggedIn(await r.json());
  }

  async function setQuantity(line) {
    try {
      var r = await fetch(TROLLEY_UPDATE_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(updateBody(line)),
      });
      if (!r.ok) return { stockcode: line.stockcode, outcome: "failed", reason: "HTTP " + r.status };
      if (wasUpdated(await r.json(), line.stockcode)) return { stockcode: line.stockcode, outcome: "added" };
      return { stockcode: line.stockcode, outcome: "failed", reason: "not available" };
    } catch (e) {
      return { stockcode: line.stockcode, outcome: "failed", reason: String((e && e.message) || e) };
    }
  }

  async function run(lines) {
    state = { phase: "checking", total: lines.length, completed: 0, results: [], error: null };
    try {
      if (!(await checkLogin())) {
        state.phase = "loggedOut";
        return;
      }
      state.phase = "adding";
      for (var i = 0; i < lines.length; i++) {
        state.results.push(await setQuantity(lines[i]));
        state.completed = i + 1;
      }
      state.phase = "done";
    } catch (e) {
      state.phase = "error";
      state.error = String((e && e.message) || e);
    }
  }

  window.__weekdayFuelTrolley = {
    start: function (lines) { run(lines); return true; },
    state: function () { return JSON.stringify(state); },
    urls: { loginStatus: LOGIN_STATUS_URL, trolleyUpdate: TROLLEY_UPDATE_URL },
  };
})();
```

- [ ] **Step 4: Run to confirm pass**

Run: `node --test apps/android/app/src/test/js/trolley.test.js`
Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 5: Add org.json for JVM tests**

In `apps/android/gradle/libs.versions.toml`, under `[versions]` add:

```toml
orgJson = "20240303"
```

and under `[libraries]` add:

```toml
org-json = { group = "org.json", name = "json", version.ref = "orgJson" }
```

In `apps/android/app/build.gradle.kts`, in `dependencies { … }` after `testImplementation(libs.junit)` add:

```kotlin
    testImplementation(libs.org.json)
```

- [ ] **Step 6: Write the failing Kotlin test**

`apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/TrolleyJsonTest.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TrolleyJsonTest {
    @Test
    fun missingScriptGivesNull() {
        assertNull(TrolleyJson.parseScriptState(null))
        assertNull(TrolleyJson.parseScriptState("null"))
    }

    @Test
    fun parsesDoneStateFromEvaluateResult() {
        val raw =
            """{"phase":"done","total":2,"completed":2,"results":[{"stockcode":717518,"outcome":"added"},{"stockcode":72280,"outcome":"failed","reason":"HTTP 500"}],"error":null}"""
        val state = TrolleyJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(TrolleyPhase.DONE, state.phase)
        assertEquals(2, state.total)
        assertEquals(2, state.completed)
        assertEquals(
            listOf(TrolleyLineResult(717518L, true, null), TrolleyLineResult(72280L, false, "HTTP 500")),
            state.results,
        )
        assertNull(state.error)
    }

    @Test
    fun parsesLoggedOutAndError() {
        val loggedOut = TrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"loggedOut","total":3,"completed":0,"results":[],"error":null}"""))!!
        assertEquals(TrolleyPhase.LOGGED_OUT, loggedOut.phase)
        val error = TrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"error","total":3,"completed":0,"results":[],"error":"login check HTTP 403"}"""))!!
        assertEquals(TrolleyPhase.ERROR, error.phase)
        assertEquals("login check HTTP 403", error.error)
    }

    @Test
    fun parseLinesKeepsPositiveQuantities() {
        val lines = TrolleyJson.parseLines(JSONArray("""[{"stockcode":717518,"quantity":2,"name":"Chobani"},{"stockcode":72280,"quantity":0}]"""))
        assertEquals(listOf(TrolleyLine(717518L, 2)), lines)
    }

    @Test
    fun linesToJsonRoundTrips() {
        val lines = listOf(TrolleyLine(717518L, 2), TrolleyLine(72280L, 5))
        assertEquals(lines, TrolleyJson.parseLines(JSONArray(TrolleyJson.linesToJson(lines))))
    }
}
```

- [ ] **Step 7: Implement `TrolleyModels.kt`**

`apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/TrolleyModels.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

data class TrolleyLine(val stockcode: Long, val quantity: Int)

data class TrolleyLineResult(val stockcode: Long, val added: Boolean, val reason: String?)

enum class TrolleyPhase { IDLE, CHECKING, LOGGED_OUT, ADDING, DONE, ERROR }

data class TrolleyScriptState(
    val phase: TrolleyPhase,
    val total: Int,
    val completed: Int,
    val results: List<TrolleyLineResult>,
    val error: String?,
)

object TrolleyJson {
    fun parseLines(lines: JSONArray): List<TrolleyLine> =
        (0 until lines.length())
            .map { i -> lines.getJSONObject(i).let { TrolleyLine(it.getLong("stockcode"), it.getInt("quantity")) } }
            .filter { it.quantity > 0 }

    fun linesToJson(lines: List<TrolleyLine>): String =
        JSONArray().apply {
            lines.forEach { put(JSONObject().put("stockcode", it.stockcode).put("quantity", it.quantity)) }
        }.toString()

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelTrolley.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): TrolleyScriptState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        val results = o.optJSONArray("results") ?: JSONArray()
        return TrolleyScriptState(
            phase =
                when (o.optString("phase")) {
                    "checking" -> TrolleyPhase.CHECKING
                    "loggedOut" -> TrolleyPhase.LOGGED_OUT
                    "adding" -> TrolleyPhase.ADDING
                    "done" -> TrolleyPhase.DONE
                    "error" -> TrolleyPhase.ERROR
                    else -> TrolleyPhase.IDLE
                },
            total = o.optInt("total"),
            completed = o.optInt("completed"),
            results =
                (0 until results.length()).map { i ->
                    val r = results.getJSONObject(i)
                    TrolleyLineResult(r.getLong("stockcode"), r.optString("outcome") == "added", r.stringOrNull("reason"))
                },
            error = o.stringOrNull("error"),
        )
    }

    private fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else optString(key)
}
```

- [ ] **Step 8: Add the trolley tests to CI and align the spec**

In `.github/workflows/release-android.yml`, change the JS test step's `run:` line to:

```yaml
        run: node --test apps/android/app/src/test/js/cart.test.js apps/android/app/src/test/js/trolley.test.js
```

In `docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md`, replace:

```text
returns a per-line result (`added` / `unavailable` / `failed` + reason).
```

with:

```text
returns a per-line result (`added`, or `failed` with a reason such as the HTTP status; out-of-stock and unavailable products surface as `failed`).
```

- [ ] **Step 9: Run JS tests locally, commit, push, watch CI**

Run: `node --test apps/android/app/src/test/js/cart.test.js apps/android/app/src/test/js/trolley.test.js`
Expected: `# pass 13`, `# fail 0`.

```powershell
git add apps/android .github/workflows/release-android.yml docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md
git commit -m "woolworths-trolley: trolley script and Kotlin state parsing"
```

Then the "Watching CI after a push" commands. Expected: green; the Gradle step runs `TrolleyJsonTest` (5 tests) and `WoolworthsUrlsTest`.

---

### Task 5: Background session and host channel

**Files:**
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/WoolworthsSession.kt` (full replacement)
- Create: `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt`
- Test: `apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/HostMessagesTest.kt`
- Modify: `apps/android/app/src/main/java/dev/weekdayfuel/app/MainActivity.kt` (full replacement)
- Modify: `apps/android/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: Task 1 `WoolworthsUrls`, `WoolworthsScreen`; Task 4 `TrolleyLine`, `TrolleyJson`, `TrolleyPhase`, `TrolleyScriptState`, `TrolleyLineResult`, asset `woolworths/trolley.js`.
- Produces:
  - `WoolworthsSession.Listener { fun onNeedsLogin(); fun onProgress(completed: Int, total: Int); fun onFinished(state: TrolleyScriptState) }`, `var listener: Listener?`, `val hasPending: Boolean`, `fun send(lines: List<TrolleyLine>)`, `fun cancel()`.
  - `HostMessages.login(): String`, `progress(completed: Int, total: Int): String`, `finished(state: TrolleyScriptState): String`, `failure(message: String): String`.
  - Page ⇄ host protocol (JS object `WeekdayFuelHost`, origin `https://appassets.androidplatform.net` only):
    - page → host: `{"type":"sendTrolley","lines":[Line…]}`, `{"type":"openWoolworths","url":"https://www.woolworths.com.au/…"}`, `{"type":"checkout"}`
    - host → page: `{"type":"trolleyLogin"}`, `{"type":"trolleyProgress","completed":n,"total":t}`, `{"type":"trolleyDone","results":[{"stockcode":n,"added":bool,"reason":string|null}]}`, `{"type":"trolleyError","message":string}`

- [ ] **Step 1: Write the failing test**

`apps/android/app/src/test/java/dev/weekdayfuel/app/woolworths/HostMessagesTest.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HostMessagesTest {
    @Test
    fun progressCarriesCounts() {
        val json = JSONObject(HostMessages.progress(3, 31))
        assertEquals("trolleyProgress", json.getString("type"))
        assertEquals(3, json.getInt("completed"))
        assertEquals(31, json.getInt("total"))
    }

    @Test
    fun doneCarriesPerLineResults() {
        val state =
            TrolleyScriptState(
                TrolleyPhase.DONE, 2, 2,
                listOf(TrolleyLineResult(717518L, true, null), TrolleyLineResult(72280L, false, "HTTP 500")),
                null,
            )
        val json = JSONObject(HostMessages.finished(state))
        assertEquals("trolleyDone", json.getString("type"))
        val results = json.getJSONArray("results")
        assertEquals(717518L, results.getJSONObject(0).getLong("stockcode"))
        assertTrue(results.getJSONObject(0).getBoolean("added"))
        assertTrue(results.getJSONObject(0).isNull("reason"))
        assertFalse(results.getJSONObject(1).getBoolean("added"))
        assertEquals("HTTP 500", results.getJSONObject(1).getString("reason"))
    }

    @Test
    fun errorStateBecomesFailureMessage() {
        val json = JSONObject(HostMessages.finished(TrolleyScriptState(TrolleyPhase.ERROR, 0, 0, emptyList(), "login check HTTP 403")))
        assertEquals("trolleyError", json.getString("type"))
        assertEquals("login check HTTP 403", json.getString("message"))
    }

    @Test
    fun loginMessage() {
        assertEquals("trolleyLogin", JSONObject(HostMessages.login()).getString("type"))
    }
}
```

- [ ] **Step 2: Implement `HostMessages`**

`apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/HostMessages.kt`:

```kotlin
package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject

/** Messages the host posts to the Weekday Fuel page over `WeekdayFuelHost`. */
object HostMessages {
    private const val GENERIC_FAILURE = "Something went wrong sending to Woolworths. Try again."

    fun login(): String = JSONObject().put("type", "trolleyLogin").toString()

    fun progress(completed: Int, total: Int): String =
        JSONObject().put("type", "trolleyProgress").put("completed", completed).put("total", total).toString()

    fun finished(state: TrolleyScriptState): String {
        if (state.phase != TrolleyPhase.DONE) return failure(state.error ?: GENERIC_FAILURE)
        val results =
            JSONArray().apply {
                state.results.forEach {
                    put(
                        JSONObject()
                            .put("stockcode", it.stockcode)
                            .put("added", it.added)
                            .put("reason", it.reason ?: JSONObject.NULL),
                    )
                }
            }
        return JSONObject().put("type", "trolleyDone").put("results", results).toString()
    }

    fun failure(message: String): String = JSONObject().put("type", "trolleyError").put("message", message).toString()
}
```

- [ ] **Step 3: Add strings**

In `apps/android/app/src/main/res/values/strings.xml`, add before `</resources>`:

```xml
    <string name="woolworths_login_status">Log in to send your shop</string>
    <string name="woolworths_login_cancelled">Log in to Woolworths, then tap Send again.</string>
    <string name="woolworths_timeout">Woolworths took too long to respond. Try again.</string>
    <string name="woolworths_offline">Couldn\'t reach Woolworths. Check your connection and try again.</string>
```

- [ ] **Step 4: Replace `WoolworthsSession.kt`**

```kotlin
package dev.weekdayfuel.app.woolworths

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import dev.weekdayfuel.app.R

/** Owns the woolworths.com.au WebView, whether or not it is on screen, and runs trolley sends in it. */
@SuppressLint("SetJavaScriptEnabled")
class WoolworthsSession(private val context: Context, private val openExternal: (Uri) -> Unit) {
    interface Listener {
        fun onNeedsLogin()

        fun onProgress(completed: Int, total: Int)

        /** Phase is [TrolleyPhase.DONE] or [TrolleyPhase.ERROR]. */
        fun onFinished(state: TrolleyScriptState)
    }

    var listener: Listener? = null

    private val handler = Handler(Looper.getMainLooper())
    private val script: String by lazy {
        context.assets.open(SCRIPT_ASSET).bufferedReader().use { it.readText() }
    }
    private var pending: List<TrolleyLine>? = null
    private var polling = false
    private var pageLoading = false
    private val poller = Runnable { poll() }
    private val loginRetry = Runnable { start() }
    private val watchdog = Runnable { fail(context.getString(R.string.woolworths_timeout)) }

    val webView: WebView =
        WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webViewClient = SessionClient()
        }

    val hasPending: Boolean get() = pending != null

    fun load(url: String) = webView.loadUrl(url)

    fun send(lines: List<TrolleyLine>) {
        pending = lines
        polling = false
        handler.removeCallbacks(poller)
        val onWoolworths = WoolworthsUrls.isWoolworthsHost(webView.url?.let { Uri.parse(it).host })
        when {
            !onWoolworths -> webView.loadUrl(WoolworthsUrls.HOME_URL)
            !pageLoading -> start()
        }
    }

    fun cancel() {
        pending = null
        polling = false
        handler.removeCallbacks(poller)
        handler.removeCallbacks(loginRetry)
        handler.removeCallbacks(watchdog)
    }

    private fun start() {
        val lines = pending ?: return
        handler.removeCallbacks(loginRetry)
        polling = true
        armWatchdog()
        webView.evaluateJavascript("$script\nwindow.__weekdayFuelTrolley.start(${TrolleyJson.linesToJson(lines)});") { started ->
            // An earlier run (e.g. stuck on a hung request) still owns this page; a fresh page drops it and onPageFinished restarts.
            if (started == "false" && pending != null) {
                polling = false
                handler.removeCallbacks(poller)
                webView.reload()
            }
        }
        handler.postDelayed(poller, POLL_MS)
    }

    private fun armWatchdog() {
        handler.removeCallbacks(watchdog)
        handler.postDelayed(watchdog, TIMEOUT_MS)
    }

    private fun poll() {
        if (!polling) return
        webView.evaluateJavascript(STATE_EXPRESSION) { result ->
            if (!polling) return@evaluateJavascript
            val state = TrolleyJson.parseScriptState(result)
            when (state?.phase) {
                null -> polling = false
                TrolleyPhase.IDLE, TrolleyPhase.CHECKING -> handler.postDelayed(poller, POLL_MS)
                TrolleyPhase.ADDING -> {
                    armWatchdog()
                    listener?.onProgress(state.completed, state.total)
                    handler.postDelayed(poller, POLL_MS)
                }
                TrolleyPhase.LOGGED_OUT -> {
                    polling = false
                    handler.removeCallbacks(watchdog)
                    // Login may finish without a full page load, so re-check until it succeeds or the owner closes the screen.
                    handler.postDelayed(loginRetry, LOGIN_RETRY_MS)
                    listener?.onNeedsLogin()
                }
                TrolleyPhase.DONE, TrolleyPhase.ERROR -> {
                    cancel()
                    listener?.onFinished(state)
                }
            }
        }
    }

    private fun fail(message: String) {
        if (pending == null) return
        cancel()
        listener?.onFinished(TrolleyScriptState(TrolleyPhase.ERROR, 0, 0, emptyList(), message))
    }

    private inner class SessionClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val scheme = request.url.scheme
            if (scheme == "http" || scheme == "https") return false
            openExternal(request.url)
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            pageLoading = true
        }

        override fun onPageFinished(view: WebView, url: String?) {
            pageLoading = false
            // A new document drops the injected script, so (re)start on every Woolworths page while a send is pending.
            if (pending != null && WoolworthsUrls.isWoolworthsHost(url?.let { Uri.parse(it).host })) {
                handler.removeCallbacks(poller)
                start()
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) fail(context.getString(R.string.woolworths_offline))
        }
    }

    private companion object {
        const val SCRIPT_ASSET = "woolworths/trolley.js"
        const val STATE_EXPRESSION = "window.__weekdayFuelTrolley ? window.__weekdayFuelTrolley.state() : null"
        const val POLL_MS = 300L
        const val LOGIN_RETRY_MS = 2_000L
        const val TIMEOUT_MS = 60_000L
    }
}
```

- [ ] **Step 5: Replace `MainActivity.kt`**

Same as Task 1's version plus the host channel and session listener. Replace the whole file with:

```kotlin
package dev.weekdayfuel.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import dev.weekdayfuel.app.update.GithubApkReleaseInfo
import dev.weekdayfuel.app.update.GithubApkReleaseUpdater
import dev.weekdayfuel.app.update.ReleaseVersionCompare
import dev.weekdayfuel.app.woolworths.HostMessages
import dev.weekdayfuel.app.woolworths.TrolleyJson
import dev.weekdayfuel.app.woolworths.TrolleyScriptState
import dev.weekdayfuel.app.woolworths.WoolworthsScreen
import dev.weekdayfuel.app.woolworths.WoolworthsSession
import dev.weekdayfuel.app.woolworths.WoolworthsUrls
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var woolworths: WoolworthsSession
    private lateinit var woolworthsScreen: WoolworthsScreen
    private var hostReply: JavaScriptReplyProxy? = null

    /** True while the Woolworths screen is up only because a send needs the owner to log in. */
    private var loginShownForSend = false

    /** Set when the user tapped Update but first had to grant "install unknown apps". */
    private var pendingUpdate: GithubApkReleaseInfo? = null
    private var updateInProgress = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.page_background)) }

        val assetLoader =
            WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .build()

        webView =
            WebView(this).apply {
                setBackgroundColor(getColor(R.color.page_background))
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                webViewClient = HostWebViewClient(assetLoader)
            }
        woolworths = WoolworthsSession(this, ::openExternally)
        woolworths.listener = TrolleyListener()
        woolworthsScreen = WoolworthsScreen(this, woolworths.webView, webView, onClose = ::hideWoolworths)
        root.addView(woolworthsScreen.view, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        root.addView(webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        setContentView(root)
        // Needs the decor view, which only exists after setContentView (NPE on Android 15 otherwise).
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isNight
            isAppearanceLightNavigationBars = !isNight
        }

        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() or
                        WindowInsetsCompat.Type.displayCutout() or
                        WindowInsetsCompat.Type.ime(),
                )
            v.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    when {
                        woolworthsScreen.isShowing && woolworths.webView.canGoBack() -> woolworths.webView.goBack()
                        woolworthsScreen.isShowing -> hideWoolworths()
                        webView.canGoBack() -> webView.goBack()
                        else -> {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                            isEnabled = true
                        }
                    }
                }
            },
        )

        // Must be registered before the page loads; only Weekday Fuel's own origin can reach the host.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, HOST_OBJECT, setOf(APP_ORIGIN)) { _, message, _, isMainFrame, replyProxy ->
                if (isMainFrame) {
                    hostReply = replyProxy
                    message.data?.let(::onHostMessage)
                }
            }
        }

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL)
        }
        if (savedInstanceState == null) {
            checkForUpdateOnColdStart()
        }
    }

    override fun onResume() {
        super.onResume()
        val pending = pendingUpdate ?: return
        if (packageManager.canRequestPackageInstalls()) {
            pendingUpdate = null
            downloadAndInstall(pending)
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        woolworths.cancel()
        woolworths.webView.destroy()
        webView.destroy()
        super.onDestroy()
    }

    private fun onHostMessage(data: String) {
        val msg = runCatching { JSONObject(data) }.getOrNull() ?: return
        when (msg.optString("type")) {
            "sendTrolley" -> {
                val lines = runCatching { TrolleyJson.parseLines(msg.optJSONArray("lines") ?: JSONArray()) }.getOrNull() ?: return
                woolworths.send(lines)
            }
            "openWoolworths" -> {
                val url = msg.optString("url")
                showWoolworths(if (WoolworthsUrls.isWoolworthsHost(Uri.parse(url).host)) url else WoolworthsUrls.HOME_URL)
            }
            "checkout" -> showWoolworths(WoolworthsUrls.TROLLEY_URL)
        }
    }

    private fun replyToPage(json: String) {
        hostReply?.postMessage(json)
    }

    private fun showWoolworths(url: String) {
        woolworths.load(url)
        woolworthsScreen.show()
    }

    private fun hideWoolworths() {
        woolworthsScreen.hide()
        if (loginShownForSend) {
            loginShownForSend = false
            if (woolworths.hasPending) {
                woolworths.cancel()
                replyToPage(HostMessages.failure(getString(R.string.woolworths_login_cancelled)))
            }
        }
    }

    private fun closeLoginIfShownForSend() {
        if (loginShownForSend) {
            loginShownForSend = false
            woolworthsScreen.hide()
        }
    }

    private inner class TrolleyListener : WoolworthsSession.Listener {
        override fun onNeedsLogin() {
            if (!woolworthsScreen.isShowing) {
                woolworths.load(WoolworthsUrls.LOGIN_URL)
                woolworthsScreen.show()
            }
            loginShownForSend = true
            woolworthsScreen.setStatus(getString(R.string.woolworths_login_status))
            replyToPage(HostMessages.login())
        }

        override fun onProgress(completed: Int, total: Int) {
            closeLoginIfShownForSend()
            replyToPage(HostMessages.progress(completed, total))
        }

        override fun onFinished(state: TrolleyScriptState) {
            closeLoginIfShownForSend()
            replyToPage(HostMessages.finished(state))
        }
    }

    private fun checkForUpdateOnColdStart() {
        if (!GithubApkReleaseUpdater.isConfigured()) return
        lifecycleScope.launch {
            GithubApkReleaseUpdater.fetchLatestApkRelease()
                .onSuccess { release ->
                    val versus = ReleaseVersionCompare.compare(release.tagName, BuildConfig.VERSION_NAME)
                    if (versus == ReleaseVersionCompare.VersusInstalled.UPDATE_AVAILABLE && !isFinishing) {
                        showUpdateDialog(release)
                    }
                }
                .onFailure { Log.i(TAG, "Update check skipped: ${it.message}") }
        }
    }

    private fun showUpdateDialog(release: GithubApkReleaseInfo) {
        AlertDialog.Builder(this)
            .setTitle(R.string.update_available_title)
            .setMessage(getString(R.string.update_available_message, release.tagName, "v${BuildConfig.VERSION_NAME}"))
            .setPositiveButton(R.string.update_install) { _, _ -> startUpdate(release) }
            .setNegativeButton(R.string.update_later, null)
            .show()
    }

    private fun startUpdate(release: GithubApkReleaseInfo) {
        if (GithubApkReleaseUpdater.ensureInstallFromUnknownSources(this)) {
            downloadAndInstall(release)
        } else {
            pendingUpdate = release
            Toast.makeText(this, R.string.update_allow_installs, Toast.LENGTH_LONG).show()
        }
    }

    private fun downloadAndInstall(release: GithubApkReleaseInfo) {
        if (updateInProgress) return
        updateInProgress = true
        val progress =
            AlertDialog.Builder(this)
                .setTitle(R.string.update_downloading)
                .setView(ProgressBar(this).apply { isIndeterminate = true; setPadding(0, 48, 0, 48) })
                .setCancelable(false)
                .show()
        lifecycleScope.launch {
            val result = GithubApkReleaseUpdater.downloadApkToCache(this@MainActivity, release.downloadUrl)
            progress.dismiss()
            updateInProgress = false
            result
                .onSuccess { GithubApkReleaseUpdater.startPackageInstall(this@MainActivity, it) }
                .onFailure {
                    Toast.makeText(
                        this@MainActivity,
                        getString(R.string.update_failed, it.message ?: it.javaClass.simpleName),
                        Toast.LENGTH_LONG,
                    ).show()
                }
        }
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    private inner class HostWebViewClient(
        private val assetLoader: WebViewAssetLoader,
    ) : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            assetLoader.shouldInterceptRequest(request.url)

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (request.url.host == WebViewAssetLoader.DEFAULT_DOMAIN) return false
            if (WoolworthsUrls.isWoolworthsHost(request.url.host)) {
                showWoolworths(request.url.toString())
                return true
            }
            openExternally(request.url)
            return true
        }
    }

    private companion object {
        const val TAG = "WeekdayFuel"
        const val HOST_OBJECT = "WeekdayFuelHost"
        val APP_ORIGIN = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}"
        val APP_URL = "$APP_ORIGIN/assets/weekday_fuel/Weekday_Fuel.html"
    }
}
```

- [ ] **Step 6: Commit, push, watch CI**

```powershell
git add apps/android
git commit -m "woolworths-trolley: background session and page-to-host channel"
```

Then the "Watching CI after a push" commands. Expected: green; `HostMessagesTest` (4 tests) runs; launch smoke test still finds `MainActivity` resumed. No release.

---

### Task 6: Shop tab trolley panel

**Files:**
- Modify: `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html`
- Modify: `.github/workflows/release-android.yml` (remove frozen-seed step)
- Modify: `docs/CI_CD.md`, `README.md`

**Interfaces:**
- Consumes: `window.WeekdayFuelCart.cartLines` (Task 3); `WeekdayFuelHost` protocol (Task 5).
- Produces: `buildList()` rows gain `n: number` (whole packs; days for Dare/Grenade); `state.trolley`: `null | { phase: "adding"|"login"|"done"|"error", completed, total, lines: Line[], manual: Manual[], results?: {stockcode, added, reason}[], message?: string }`.

All edits below are exact find/replace on `Weekday_Fuel.html`. Each "find" string occurs once.

- [ ] **Step 1: Load `cart.js`**

Find:

```html
<script>
(function(){
```

Replace with:

```html
<script src="cart.js"></script>
<script>
(function(){
```

- [ ] **Step 2: Add `trolley` to page state**

Find: `armed:null,openItem:null};`
Replace with: `armed:null,openItem:null,trolley:null};`

- [ ] **Step 3: Give every `buildList()` row a numeric pack count**

Make these six replacements:

1. Find `cost:days*S().fixtures.dare.cost,sec:0}` → replace `cost:days*S().fixtures.dare.cost,sec:0,n:days}`
2. Find `cost:days*S().fixtures.grenade.cost,sec:0}` → replace `cost:days*S().fixtures.grenade.cost,sec:0,n:days}`
3. Find `const amt=need[id];let qty="",buy="",cost=0;` → replace `const amt=need[id];let qty="",buy="",cost=0,n=1;`
4. Find `cost=big?packs*16.8:7.2;}` → replace `cost=big?packs*16.8:7.2;n=packs;}`
5. Find `const P=PACK[id];const n=Math.ceil(amt/P.size-1e-9);` → replace `const P=PACK[id];n=Math.ceil(amt/P.size-1e-9);`
6. Find `rows.push({id,qty,buy,cost,sec:secOf(id),used:usedBy[id]});` → replace `rows.push({id,qty,buy,cost,n,sec:secOf(id),used:usedBy[id]});`

- [ ] **Step 4: Add the trolley panel helpers**

Find:

```js
function renderShop(){
  const ticks=lsTicks();const build=S().shopMode!=="all";
  const ITEM=Object.fromEntries(SHOP.flatMap(s=>s.items).map(i=>[i[0],i]));
```

Replace with:

```js
function itemIndex(){return Object.fromEntries(SHOP.flatMap(s=>s.items).map(i=>[i[0],i]))}
function trolleyCart(rows,ticks,ITEM){return WeekdayFuelCart.cartLines(rows.map(r=>({id:r.id,n:r.n,used:r.used||[],name:buildName(r.id,ITEM[r.id][1],r.used)})),ticks,LINKS)}
const MANUAL_WHY={deli:"deli counter, sold by weight",coles:"Coles only",nostore:"no online store page"};
function renderTrolley(rows,ticks,ITEM){
  if(!window.WeekdayFuelHost)return "";
  const t=state.trolley;
  let h=`<div class="panel stack"><h3>Woolworths trolley</h3>`;
  if(!t){
    const c=trolleyCart(rows,ticks,ITEM);
    h+=`<div class="small muted">Puts the ${c.lines.length} Woolworths product${c.lines.length===1?"":"s"} still left to buy into your online trolley. Anything already there is set to these amounts, not doubled.</div>`;
    h+=`<div class="row"><button class="btn" data-act="sendtrolley" ${c.lines.length?"":"disabled"}>Send to Woolworths trolley</button></div>`;
  }else if(t.phase==="login"){
    h+=`<div class="small">Log in to Woolworths in the window that opened. Sending carries on by itself once you're in.</div>`;
  }else if(t.phase==="adding"){
    h+=`<div class="small num">Adding ${t.completed} of ${t.total}…</div>`;
  }else if(t.phase==="error"){
    h+=`<div class="small">${esc(t.message||"")}</div><div class="row"><button class="btn" data-act="sendtrolley">Try again</button><button class="ghost" data-act="trolleyreset">Close</button></div>`;
  }else{
    const byCode=Object.fromEntries(t.lines.map(l=>[l.stockcode,l]));
    const added=t.results.filter(r=>r.added),failed=t.results.filter(r=>!r.added);
    if(!added.length&&failed.length)h+=`<div class="hint"><span>Nothing could be added. Woolworths may have changed their website, so the automatic send is out of date. Open each product below to add it yourself.</span></div>`;
    h+=`<div class="small"><b>Added ${added.length}</b> of ${t.results.length}.</div>`;
    if(failed.length)h+=`<div class="eyebrow">Couldn't add</div>${failed.map(r=>{const l=byCode[r.stockcode]||{name:String(r.stockcode)};return `<div class="row between"><span class="small">${esc(l.name)}${r.reason?` <span class="muted">(${esc(r.reason)})</span>`:""}</span>${l.url?`<button class="ghost" data-act="openwoolies" data-v="${esc(l.url)}">Open ↗</button>`:""}</div>`}).join("")}`;
    if(t.manual.length)h+=`<div class="eyebrow">Add these yourself</div>${t.manual.map(m=>`<div class="small">${esc(m.name)} <span class="muted">(${MANUAL_WHY[m.reason]})</span></div>`).join("")}`;
    h+=`<div class="row"><button class="btn" data-act="checkout">Checkout</button><button class="ghost" data-act="trolleyreset">Done</button></div>`;
  }
  return h+`</div>`;
}
function renderShop(){
  const ticks=lsTicks();const build=S().shopMode!=="all";
  const ITEM=itemIndex();
```

- [ ] **Step 5: Show the panel under the Build a shop list**

Find:

```js
    h+=`<div class="row"><button class="ghost" data-act="untickall">Clear ticks for next shop</button></div>`;
    return h;
  }
  const all=
```

Replace with:

```js
    h+=renderTrolley(rows,ticks,ITEM);
    h+=`<div class="row"><button class="ghost" data-act="untickall">Clear ticks for next shop</button></div>`;
    return h;
  }
  const all=
```

- [ ] **Step 6: Handle the new buttons**

Find:

```js
    case "fxdays":
```

Replace with:

```js
    case "sendtrolley":{const c=trolleyCart(buildList(),lsTicks(),itemIndex());state.trolley={phase:"adding",completed:0,total:c.lines.length,lines:c.lines,manual:c.manual};WeekdayFuelHost.postMessage(JSON.stringify({type:"sendTrolley",lines:c.lines}));break}
    case "trolleyreset":state.trolley=null;break;
    case "checkout":WeekdayFuelHost.postMessage(JSON.stringify({type:"checkout"}));return;
    case "openwoolies":WeekdayFuelHost.postMessage(JSON.stringify({type:"openWoolworths",url:v}));return;
    case "fxdays":
```

- [ ] **Step 7: Listen for host messages**

Find:

```js
initStore();
})();
```

Replace with:

```js
if(window.WeekdayFuelHost){
  WeekdayFuelHost.addEventListener("message",e=>{
    let m;try{m=JSON.parse(e.data)}catch(_){return}
    const t=state.trolley;if(!t)return;
    if(m.type==="trolleyLogin")t.phase="login";
    else if(m.type==="trolleyProgress"){t.phase="adding";t.completed=m.completed;t.total=m.total}
    else if(m.type==="trolleyDone"){t.phase="done";t.results=m.results}
    else if(m.type==="trolleyError"){t.phase="error";t.message=m.message}
    else return;
    if(state.tab==="shop")render();
  });
}
initStore();
})();
```

- [ ] **Step 8: Check the page still parses and the shop logic still runs in Node**

Run (PowerShell, from repo root):

```powershell
node -e "const fs=require('fs');const h=fs.readFileSync('apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html','utf8');const s=h.slice(h.indexOf('<script>\n(function(){')+8,h.lastIndexOf('</script>'));new Function(s);console.log('inline script parses OK')"
```

Expected: `inline script parses OK` (a `SyntaxError` means an edit broke the script).

- [ ] **Step 9: Remove the frozen-HTML CI step and update docs**

In `.github/workflows/release-android.yml`, delete these two lines:

```yaml
      - name: Shipped HTML matches frozen seed
        run: cmp docs/seed/Weekday_Fuel.html apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html
```

and the blank line after them.

In `docs/CI_CD.md`, replace:

```text
The workflow also fails if `apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html` drifts from the frozen seed in `docs/seed/`. Drop that step once v0 has shipped and the HTML starts evolving.
```

with:

```text
The workflow also runs the JS unit tests (`node --test apps/android/app/src/test/js/*.test.js`) and an Android 15 emulator launch smoke test; nothing is published unless all pass. `docs/seed/Weekday_Fuel.html` is the historical v0; the shipped page now evolves through specs.
```

In `README.md`, replace the row:

```text
| `apps/android/app/src/main/java/dev/weekdayfuel/app/update/` | GitHub Releases updater |
```

with:

```text
| `apps/android/app/src/main/java/dev/weekdayfuel/app/update/` | GitHub Releases updater |
| `apps/android/app/src/main/java/dev/weekdayfuel/app/woolworths/` | Woolworths session, in-app Woolworths screen, trolley send |
| `apps/android/app/src/main/assets/weekday_fuel/cart.js`, `assets/woolworths/trolley.js` | Cart-line calculation; script that sets the Woolworths trolley |
```

and add at the end of `README.md`:

```markdown

## Network

No backend. The phone talks directly to GitHub Releases (update check), Google Fonts, and woolworths.com.au — the last only after you tap Send, Checkout, or a Woolworths link. Your Woolworths login stays in the app's browser storage on the phone.
```

- [ ] **Step 10: Commit, push, watch CI**

```powershell
git add apps/android/app/src/main/assets/weekday_fuel/Weekday_Fuel.html .github/workflows/release-android.yml docs/CI_CD.md README.md
git commit -m "woolworths-trolley: Send to Woolworths trolley panel on the Shop tab"
```

Then the "Watching CI after a push" commands. Expected: green (no frozen-seed step any more), launch smoke test passes, no release.

---

### Task 7: Release and phone checklist

**Files:**
- Modify: `apps/android/app/build.gradle.kts`
- Modify: `docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md` (status)

- [ ] **Step 1: Bump the version**

In `apps/android/app/build.gradle.kts`:

```kotlin
        versionCode = 4
        versionName = "0.2.0"
```

- [ ] **Step 2: Commit, push, watch CI**

```powershell
git add apps/android/app/build.gradle.kts
git commit -m "release: v0.2.0"
```

Then the "Watching CI after a push" commands. Expected: green, and `v0.2.0` with `WeekdayFuel-v0.2.0-debug.apk` appears on https://github.com/Evzy/weekday-fuel-releases/releases.

- [ ] **Step 3 (OWNER, phone): checklist from the spec**

Accept the update prompt on launch, then:

- [ ] Log in once in the Woolworths screen; restart the app; still logged in.
- [ ] Shop → Build a shop → "Use the starter shop" → Send to Woolworths trolley; the trolley on woolworths.com.au matches the Buy lines.
- [ ] Send again; quantities unchanged (no doubling).
- [ ] Tick one item, change a serve count, send; the ticked item is unchanged in the trolley and the changed item's quantity follows.
- [ ] "Add these yourself" lists chicken breast, mince, wraps, ham, evaporated milk, curry paste when relevant.
- [ ] Checkout reaches the payment step with the saved card (placing an order optional).
- [ ] A Woolworths product link from Shop opens in the Woolworths screen, logged in.

Any failure: fix in a follow-up commit with a test where possible, release `0.2.1`.

- [ ] **Step 4: Mark the spec done**

In `docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md`, replace `**Status:** approved 2026-10-14` with `**Status:** done (v0.2.0)`.

```powershell
git add docs/superpowers/specs/2026-10-14-woolworths-trolley-design.md
git commit -m "woolworths-trolley: done"
git push
```
