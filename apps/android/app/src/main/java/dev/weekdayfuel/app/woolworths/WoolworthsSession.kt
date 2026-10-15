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
import org.json.JSONObject

/** Owns the woolworths.com.au WebView, whether or not it is on screen, and runs trolley sends in it. */
@SuppressLint("SetJavaScriptEnabled")
class WoolworthsSession(private val context: Context, private val openExternal: (Uri) -> Unit) {
    interface Listener {
        fun onNeedsLogin()

        fun onProgress(completed: Int, total: Int)

        /** Phase is [TrolleyPhase.DONE] or [TrolleyPhase.ERROR]. */
        fun onFinished(state: TrolleyScriptState)

        fun onPrices(state: PricesScriptState)
    }

    var listener: Listener? = null

    private val handler = Handler(Looper.getMainLooper())
    private val script: String by lazy {
        context.assets.open(SCRIPT_ASSET).bufferedReader().use { it.readText() }
    }
    private var pending: List<TrolleyLine>? = null
    private var polling = false
    private var pageLoading = false
    private var lastCompleted = -1
    private var loginNotified = false
    private var needsFreshPage = false
    private val poller = Runnable { poll() }
    private val loginRetry = Runnable { retryLogin() }
    private val watchdog = Runnable { fail(context.getString(R.string.woolworths_timeout)) }
    private val pricesScript: String by lazy {
        context.assets.open(PRICES_ASSET).bufferedReader().use { it.readText() }
    }
    private var pendingPrices: List<Long>? = null
    private var pricesPolling = false
    private val pricesPoller = Runnable { pollPrices() }
    private val pricesWatchdog =
        Runnable {
            // A hung request leaves the script "fetching", which refuses start(); reload the page before the next refresh.
            needsFreshPage = true
            failPrices(context.getString(R.string.woolworths_timeout))
        }

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

    private fun onShopPage(): Boolean =
        webView.url?.let(Uri::parse)?.let { WoolworthsUrls.isShopPage(it.scheme, it.host) } == true

    fun send(lines: List<TrolleyLine>) {
        pending = lines
        polling = false
        loginNotified = false
        handler.removeCallbacks(poller)
        handler.removeCallbacks(loginRetry)
        armWatchdog()
        when {
            needsFreshPage || !onShopPage() -> webView.loadUrl(WoolworthsUrls.HOME_URL)
            !pageLoading -> start()
        }
    }

    fun cancel() {
        pending = null
        polling = false
        loginNotified = false
        handler.removeCallbacks(poller)
        handler.removeCallbacks(loginRetry)
        handler.removeCallbacks(watchdog)
    }

    /** Reads current prices in the background page. A running send keeps control of navigation; prices start once its shop page is up. */
    fun refreshPrices(stockcodes: List<Long>) {
        pendingPrices = stockcodes
        pricesPolling = false
        handler.removeCallbacks(pricesPoller)
        handler.removeCallbacks(pricesWatchdog)
        handler.postDelayed(pricesWatchdog, PRICES_TIMEOUT_MS)
        when {
            pending == null && (needsFreshPage || !onShopPage()) -> webView.loadUrl(WoolworthsUrls.HOME_URL)
            !pageLoading -> startPrices()
        }
    }

    fun cancelPrices() {
        pendingPrices = null
        pricesPolling = false
        handler.removeCallbacks(pricesPoller)
        handler.removeCallbacks(pricesWatchdog)
    }

    private fun start() {
        val lines = pending ?: return
        // The script's relative /api fetches only exist on the shop host; auth.woolworths.com.au would 404 mid-login.
        if (pageLoading || !onShopPage()) return
        handler.removeCallbacks(loginRetry)
        handler.removeCallbacks(poller)
        polling = true
        lastCompleted = -1
        // No reload when the script reports a run already in progress: it is polled, and a hung one is ended by the watchdog.
        webView.evaluateJavascript("$script\nwindow.__weekdayFuelTrolley.start(${TrolleyJson.linesToJson(lines)});", null)
        handler.postDelayed(poller, POLL_MS)
    }

    private fun retryLogin() {
        if (pending == null) return
        if (pageLoading || !onShopPage()) {
            handler.postDelayed(loginRetry, LOGIN_RETRY_MS)
            return
        }
        armWatchdog()
        start()
    }

    private fun armWatchdog() {
        handler.removeCallbacks(watchdog)
        handler.postDelayed(watchdog, TIMEOUT_MS)
    }

    private fun poll() {
        if (!polling) return
        webView.evaluateJavascript(STATE_EXPRESSION) { result ->
            if (!polling) return@evaluateJavascript
            val state = runCatching { TrolleyJson.parseScriptState(result) }.getOrNull()
            when (state?.phase) {
                null -> {
                    // No script state: a new document dropped it, so inject again.
                    polling = false
                    if (pending != null && !pageLoading) start()
                }
                TrolleyPhase.IDLE, TrolleyPhase.CHECKING -> handler.postDelayed(poller, POLL_MS)
                TrolleyPhase.ADDING -> {
                    // Re-arm only on progress so a hung request still times out.
                    if (state.completed > lastCompleted) {
                        lastCompleted = state.completed
                        armWatchdog()
                        listener?.onProgress(state.completed, state.total)
                    }
                    handler.postDelayed(poller, POLL_MS)
                }
                TrolleyPhase.LOGGED_OUT -> {
                    polling = false
                    handler.removeCallbacks(watchdog)
                    // Login may finish without a full page load, so re-check until it succeeds or the owner closes the screen.
                    handler.postDelayed(loginRetry, LOGIN_RETRY_MS)
                    if (!loginNotified) listener?.onNeedsLogin()
                    loginNotified = true
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
        // Drops any stuck script or browser error page on the next send.
        needsFreshPage = true
        listener?.onFinished(TrolleyScriptState(TrolleyPhase.ERROR, 0, 0, emptyList(), message))
    }

    private fun startPrices() {
        val codes = pendingPrices ?: return
        if (pageLoading || !onShopPage()) return
        handler.removeCallbacks(pricesPoller)
        pricesPolling = true
        webView.evaluateJavascript("$pricesScript\nwindow.__weekdayFuelPrices.start(${PricesJson.stockcodesToJson(codes)});", null)
        handler.postDelayed(pricesPoller, POLL_MS)
    }

    private fun pollPrices() {
        if (!pricesPolling) return
        webView.evaluateJavascript(PRICES_STATE_EXPRESSION) { result ->
            if (!pricesPolling) return@evaluateJavascript
            val state = runCatching { PricesJson.parseScriptState(result) }.getOrNull()
            when (state?.phase) {
                null -> {
                    // A new document dropped the script; onPageFinished or this restarts it.
                    pricesPolling = false
                    if (!pageLoading) startPrices()
                }
                PricesPhase.IDLE, PricesPhase.FETCHING -> handler.postDelayed(pricesPoller, POLL_MS)
                PricesPhase.DONE, PricesPhase.ERROR -> {
                    cancelPrices()
                    listener?.onPrices(state)
                }
            }
        }
    }

    private fun failPrices(message: String) {
        if (pendingPrices == null) return
        cancelPrices()
        listener?.onPrices(PricesScriptState(PricesPhase.ERROR, null, JSONObject(), message))
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
            needsFreshPage = false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            pageLoading = false
            // Not while polling: same-document navigations also fire this, and a real new document makes poll() see no state and restart.
            val shop = url?.let(Uri::parse)?.let { WoolworthsUrls.isShopPage(it.scheme, it.host) } == true
            if (pending != null && !polling && shop) {
                if (loginNotified) armWatchdog()
                start()
            }
            if (pendingPrices != null && !pricesPolling && shop) startPrices()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                needsFreshPage = true
                fail(context.getString(R.string.woolworths_offline))
                failPrices(context.getString(R.string.woolworths_offline))
            }
        }
    }

    private companion object {
        const val SCRIPT_ASSET = "woolworths/trolley.js"
        const val STATE_EXPRESSION = "window.__weekdayFuelTrolley ? window.__weekdayFuelTrolley.state() : null"
        const val PRICES_ASSET = "woolworths/prices.js"
        const val PRICES_STATE_EXPRESSION = "window.__weekdayFuelPrices ? window.__weekdayFuelPrices.state() : null"
        const val PRICES_TIMEOUT_MS = 30_000L
        const val POLL_MS = 300L
        const val LOGIN_RETRY_MS = 2_000L
        const val TIMEOUT_MS = 60_000L
    }
}
