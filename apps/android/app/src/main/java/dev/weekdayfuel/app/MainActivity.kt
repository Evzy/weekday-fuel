package dev.weekdayfuel.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
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
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import dev.weekdayfuel.app.backup.BackupFiles
import dev.weekdayfuel.app.backup.BackupMessages
import dev.weekdayfuel.app.coles.ColesPricesState
import dev.weekdayfuel.app.coles.ColesSession
import dev.weekdayfuel.app.coles.ColesTrolleyJson
import dev.weekdayfuel.app.coles.ColesTrolleyState
import dev.weekdayfuel.app.coles.ColesUrls
import dev.weekdayfuel.app.update.GithubApkReleaseInfo
import dev.weekdayfuel.app.update.GithubApkReleaseUpdater
import dev.weekdayfuel.app.update.ReleaseVersionCompare
import dev.weekdayfuel.app.woolworths.CheckoutJson
import dev.weekdayfuel.app.woolworths.CheckoutScriptState
import dev.weekdayfuel.app.woolworths.HostMessages
import dev.weekdayfuel.app.woolworths.PricesScriptState
import dev.weekdayfuel.app.woolworths.TrolleyJson
import dev.weekdayfuel.app.woolworths.TrolleyScriptState
import dev.weekdayfuel.app.woolworths.WoolworthsSession
import dev.weekdayfuel.app.woolworths.WoolworthsUrls
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var woolworths: WoolworthsSession
    private lateinit var coles: ColesSession
    private lateinit var woolworthsScreen: StoreScreen
    private lateinit var colesScreen: StoreScreen
    private var hostReply: JavaScriptReplyProxy? = null

    /** True while the Woolworths screen is up only because a send needs the owner to log in. */
    private var loginShownForSend = false

    private var loginShownForColesSend = false

    /** Set when the user tapped Update but first had to grant "install unknown apps". */
    private var pendingUpdate: GithubApkReleaseInfo? = null
    private var updateInProgress = false

    private var pendingBackupJson: String? = null
    private val backupFiles by lazy { BackupFiles(this) }

    private val createBackup =
        registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            if (uri == null) {
                pendingBackupJson = null
                replyToPage(BackupMessages.error("", false))
                return@registerForActivityResult
            }
            val json = pendingBackupJson
            pendingBackupJson = null
            if (json == null) {
                replyToPage(BackupMessages.error(getString(R.string.backup_save_failed), false))
                return@registerForActivityResult
            }
            lifecycleScope.launch {
                val reply =
                    withContext(Dispatchers.IO) {
                        runCatching {
                            backupFiles.remember(uri)
                            backupFiles.write(uri, json)
                            val name = backupFiles.displayName(uri).orEmpty()
                            BackupMessages.saved(name, Instant.now().toString())
                        }.getOrElse { BackupMessages.error(getString(R.string.backup_save_failed), false) }
                    }
                replyToPage(reply)
            }
        }

    private val openBackup =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri == null) {
                replyToPage(BackupMessages.error("", false))
                return@registerForActivityResult
            }
            lifecycleScope.launch {
                val reply =
                    withContext(Dispatchers.IO) {
                        runCatching {
                            val json = backupFiles.read(uri)
                            val name = backupFiles.displayName(uri).orEmpty()
                            BackupMessages.opened(json, name)
                        }.getOrElse { BackupMessages.error(getString(R.string.backup_read_failed), false) }
                    }
                replyToPage(reply)
            }
        }

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
        coles = ColesSession(this)
        coles.listener = ColesListener()
        colesScreen = StoreScreen(this, coles.webView, webView, onClose = ::hideColes)
        root.addView(colesScreen.view, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        woolworthsScreen = StoreScreen(this, woolworths.webView, webView, onClose = ::hideWoolworths)
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
                        colesScreen.isShowing && coles.webView.canGoBack() -> coles.webView.goBack()
                        colesScreen.isShowing -> hideColes()
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
        woolworths.cancelPrices()
        woolworths.cancelCheckout()
        coles.destroy()
        woolworths.webView.destroy()
        webView.destroy()
        super.onDestroy()
    }

    private fun onHostMessage(data: String) {
        val msg = runCatching { JSONObject(data) }.getOrNull() ?: return
        when (msg.optString("type")) {
            "sendTrolley" -> {
                val lines = runCatching { TrolleyJson.parseLines(msg.optJSONArray("lines") ?: JSONArray()) }.getOrNull()
                    ?: run {
                        replyToPage(HostMessages.failure(getString(R.string.woolworths_bad_request)))
                        return
                    }
                woolworths.send(lines)
            }
            "openWoolworths" -> {
                val url = msg.optString("url")
                val uri = Uri.parse(url)
                showWoolworths(if (WoolworthsUrls.isWoolworthsPage(uri.scheme, uri.host)) url else WoolworthsUrls.HOME_URL)
            }
            "checkoutLoad" -> woolworths.checkout(CheckoutJson.loadRequest())
            "checkoutBook" -> runCheckout(CheckoutJson.bookRequest(msg), R.string.woolworths_checkout_bad_request)
            "checkoutSubs" -> runCheckout(CheckoutJson.subsRequest(msg), R.string.woolworths_checkout_bad_change)
            "checkoutOptions" -> runCheckout(CheckoutJson.optionsRequest(msg), R.string.woolworths_checkout_bad_change)
            "checkoutAddress" -> runCheckout(CheckoutJson.addressRequest(msg), R.string.woolworths_checkout_bad_change)
            "sendColesTrolley" -> {
                val lines = msg.optJSONArray("lines")?.let { runCatching { ColesTrolleyJson.parseLines(it) }.getOrNull() }
                if (lines.isNullOrEmpty()) {
                    replyToPage(HostMessages.colesTrolleyFailure(getString(R.string.coles_bad_lines)))
                    return
                }
                coles.send(lines)
            }
            "openColes" -> {
                val uri = Uri.parse(msg.optString("url"))
                showColes(if (ColesUrls.isColesPage(uri.scheme, uri.host)) uri.toString() else ColesUrls.HOME_URL)
            }
            "colesCheckout" -> showColes(ColesUrls.CHECKOUT_URL)
            "refreshPrices" -> {
                val request = RefreshPricesRequest.parse(msg)
                if (request.colesWanted) {
                    if (request.colesIds != null) {
                        coles.refreshPrices(request.colesIds)
                    } else {
                        coles.cancel()
                        replyToPage(HostMessages.colesPricesFailure(getString(R.string.coles_bad_request)))
                    }
                }
                if (request.stockcodes != null) {
                    woolworths.refreshPrices(request.stockcodes)
                } else {
                    replyToPage(HostMessages.pricesFailure(getString(R.string.woolworths_bad_request)))
                }
            }
            "backupSave" -> handleBackupSave(msg)
            "backupOpen" -> openBackup.launch(arrayOf("application/json", "*/*"))
            "backupInfo" ->
                lifecycleScope.launch {
                    val name =
                        withContext(Dispatchers.IO) {
                            runCatching { backupFiles.rememberedUri()?.let { backupFiles.displayName(it) } }.getOrNull()
                        }
                    replyToPage(BackupMessages.info(name))
                }
        }
    }

    private fun handleBackupSave(msg: JSONObject) {
        val json = msg.optString("json")
        if (json.isEmpty()) {
            replyToPage(BackupMessages.error(getString(R.string.backup_save_failed), false))
            return
        }
        val newFile = msg.optBoolean("newFile")
        val suggestedName = msg.optString("name").ifEmpty { "WeekdayFuel-backup.json" }
        val remembered = backupFiles.rememberedUri()
        if (newFile || remembered == null) {
            pendingBackupJson = json
            createBackup.launch(suggestedName)
            return
        }
        lifecycleScope.launch {
            val reply =
                withContext(Dispatchers.IO) {
                    runCatching {
                        backupFiles.write(remembered, json)
                        val name = backupFiles.displayName(remembered).orEmpty()
                        BackupMessages.saved(name, Instant.now().toString())
                    }.getOrElse {
                        val name = backupFiles.displayName(remembered).orEmpty().ifEmpty { suggestedName }
                        BackupMessages.error(getString(R.string.backup_update_failed, name), true)
                    }
                }
            replyToPage(reply)
        }
    }

    private fun replyToPage(json: String) {
        hostReply?.postMessage(json)
    }

    private fun runCheckout(request: String?, badRequest: Int) {
        if (request == null) replyToPage(HostMessages.checkoutFailure(getString(badRequest))) else woolworths.checkout(request)
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

    private fun showColes(url: String) {
        coles.visible = true
        coles.load(url)
        colesScreen.show()
    }

    private fun hideColes() {
        colesScreen.hide()
        if (loginShownForColesSend) {
            loginShownForColesSend = false
            if (coles.hasPendingSend) {
                coles.cancelSend()
                replyToPage(HostMessages.colesTrolleyFailure(getString(R.string.coles_login_cancelled)))
            }
        }
        coles.visible = false
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

        override fun onPrices(state: PricesScriptState) {
            replyToPage(HostMessages.prices(state))
        }

        override fun onCheckout(state: CheckoutScriptState) {
            replyToPage(HostMessages.checkout(state))
        }
    }

    private inner class ColesListener : ColesSession.Listener {
        override fun onColesPrices(state: ColesPricesState) {
            replyToPage(HostMessages.colesPrices(state))
        }

        override fun onColesTrolleyNeedsLogin() {
            if (!colesScreen.isShowing) showColes(ColesUrls.HOME_URL)
            loginShownForColesSend = true
            colesScreen.setStatus(getString(R.string.coles_login_status))
            colesScreen.setAction(getString(R.string.coles_send_now)) { coles.retryNow() }
            replyToPage(HostMessages.colesTrolleyLogin())
        }

        override fun onColesTrolley(state: ColesTrolleyState) {
            if (loginShownForColesSend) {
                loginShownForColesSend = false
                colesScreen.hide()
                coles.visible = false
            }
            replyToPage(HostMessages.colesTrolley(state))
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
            if (WoolworthsUrls.isWoolworthsPage(request.url.scheme, request.url.host)) {
                showWoolworths(request.url.toString())
                return true
            }
            if (ColesUrls.isColesPage(request.url.scheme, request.url.host)) {
                showColes(request.url.toString())
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
