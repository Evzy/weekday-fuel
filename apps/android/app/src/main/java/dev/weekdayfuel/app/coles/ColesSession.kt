package dev.weekdayfuel.app.coles

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import dev.weekdayfuel.app.R
import org.json.JSONObject

/** Owns a coles.com.au WebView, shown only in the Coles screen, that reads Coles prices and sets the Coles trolley. No JavaScript bridge. */
@SuppressLint("SetJavaScriptEnabled")
class ColesSession(private val context: Context) {
    interface Listener {
        /** Phase is [ColesPricesPhase.DONE] or [ColesPricesPhase.ERROR]. */
        fun onColesPrices(state: ColesPricesState)

        fun onColesTrolleyNeedsLogin()

        /** Phase is [ColesTrolleyPhase.DONE] or [ColesTrolleyPhase.ERROR]. */
        fun onColesTrolley(state: ColesTrolleyState)
    }

    var listener: Listener? = null

    private val handler = Handler(Looper.getMainLooper())
    private val script: String by lazy {
        context.assets.open(SCRIPT_ASSET).bufferedReader().use { it.readText() }
    }
    private val trolleyScript: String by lazy {
        context.assets.open(TROLLEY_ASSET).bufferedReader().use { it.readText() }
    }
    private var pending: List<String>? = null
    private var polling = false
    private var pendingSend: List<ColesTrolleyLine>? = null
    private var sendPolling = false
    private var loginNotified = false
    private var clearHistoryOnLoad = false
    private var pageLoading = false
    private var needsFreshPage = false
    private var destroyed = false
    private val poller = Runnable { poll() }
    private val retry = Runnable { if (pending != null && !polling && !pageLoading) start() }
    private val watchdog =
        Runnable {
            // A hung request leaves the script "fetching", which refuses start(); reload the page before the next refresh.
            needsFreshPage = true
            fail(context.getString(R.string.coles_timeout))
        }
    private val sendPoller = Runnable { pollSend() }
    private val sendRetry = Runnable { retrySend() }
    private val sendWatchdog =
        Runnable {
            needsFreshPage = true
            failSend(context.getString(R.string.coles_timeout))
        }

    /** True while the Coles screen is up: the page is then the owner's, so refreshes neither navigate nor unload it. */
    var visible = false
        set(value) {
            field = value
            if (!value) unloadIfIdle()
        }

    val hasPendingSend: Boolean get() = pendingSend != null

    val webView: WebView =
        WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webViewClient = SessionClient()
        }

    private fun onColesPage(): Boolean =
        webView.url?.let(Uri::parse)?.let { ColesUrls.isColesPage(it.scheme, it.host) } == true

    /** Loads a page for the owner; Back from it closes the screen instead of returning to background loads. */
    fun load(url: String) {
        if (destroyed) return
        clearHistoryOnLoad = true
        webView.loadUrl(url)
    }

    fun send(lines: List<ColesTrolleyLine>) {
        if (destroyed) return
        pendingSend = lines
        sendPolling = false
        loginNotified = false
        handler.removeCallbacks(sendPoller)
        handler.removeCallbacks(sendRetry)
        armSendWatchdog()
        when {
            needsFreshPage || !onColesPage() -> webView.loadUrl(ColesUrls.HOME_URL)
            !pageLoading -> startSend()
        }
    }

    fun cancelSend() {
        clearSend()
        unloadIfIdle()
    }

    fun refreshPrices(ids: List<String>) {
        if (destroyed) return
        pending = ids
        polling = false
        handler.removeCallbacks(poller)
        handler.removeCallbacks(retry)
        handler.removeCallbacks(watchdog)
        handler.postDelayed(watchdog, TIMEOUT_MS)
        when {
            !visible && pendingSend == null && (needsFreshPage || !onColesPage()) -> webView.loadUrl(ColesUrls.HOME_URL)
            !pageLoading -> start()
        }
    }

    fun cancel() {
        pending = null
        polling = false
        handler.removeCallbacks(poller)
        handler.removeCallbacks(retry)
        handler.removeCallbacks(watchdog)
    }

    fun destroy() {
        cancel()
        clearSend()
        destroyed = true
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
    }

    private fun start() {
        val ids = pending ?: return
        if (pageLoading || !onColesPage()) return
        handler.removeCallbacks(poller)
        handler.removeCallbacks(retry)
        polling = true
        webView.evaluateJavascript("$script\nwindow.__weekdayFuelColesPrices.start(${ColesPricesJson.idsToJson(ids)});", null)
        handler.postDelayed(poller, POLL_MS)
    }

    private fun poll() {
        if (!polling) return
        webView.evaluateJavascript(STATE_EXPRESSION) { result ->
            if (!polling) return@evaluateJavascript
            val state = runCatching { ColesPricesJson.parseScriptState(result) }.getOrNull()
            when (state?.phase) {
                null -> {
                    // A new document dropped the script; onPageFinished or this restarts it.
                    polling = false
                    if (!pageLoading) start()
                }
                ColesPricesPhase.NOT_READY -> {
                    // No key or store yet (e.g. a check page); try again shortly, until the watchdog gives up.
                    polling = false
                    handler.postDelayed(retry, RETRY_MS)
                }
                ColesPricesPhase.IDLE, ColesPricesPhase.FETCHING -> handler.postDelayed(poller, POLL_MS)
                ColesPricesPhase.DONE, ColesPricesPhase.ERROR -> finish(state)
            }
        }
    }

    private fun fail(message: String) {
        if (pending == null) return
        finish(ColesPricesState(ColesPricesPhase.ERROR, null, null, JSONObject(), message))
    }

    /** Unloads the page between uses (refreshes are hours apart) so Coles' scripts don't run in the background. */
    private fun unloadIfIdle() {
        if (!destroyed && !visible && pending == null && pendingSend == null) webView.loadUrl(BLANK_URL)
    }

    private fun clearSend() {
        pendingSend = null
        sendPolling = false
        loginNotified = false
        handler.removeCallbacks(sendPoller)
        handler.removeCallbacks(sendRetry)
        handler.removeCallbacks(sendWatchdog)
    }

    private fun armSendWatchdog() {
        handler.removeCallbacks(sendWatchdog)
        handler.postDelayed(sendWatchdog, SEND_TIMEOUT_MS)
    }

    private fun startSend() {
        val lines = pendingSend ?: return
        // The script's relative /api/bff requests only exist on www.coles.com.au, not on the login pages.
        if (pageLoading || !onColesPage()) return
        handler.removeCallbacks(sendRetry)
        handler.removeCallbacks(sendPoller)
        sendPolling = true
        webView.evaluateJavascript("$trolleyScript\nwindow.__weekdayFuelColesTrolley.start(${ColesTrolleyJson.linesToJson(lines)});", null)
        handler.postDelayed(sendPoller, POLL_MS)
    }

    private fun retrySend() {
        if (pendingSend == null) return
        if (pageLoading || !onColesPage()) {
            handler.postDelayed(sendRetry, LOGIN_RETRY_MS)
            return
        }
        if (loginNotified) armSendWatchdog()
        startSend()
    }

    private fun pollSend() {
        if (!sendPolling) return
        webView.evaluateJavascript(TROLLEY_STATE_EXPRESSION) { result ->
            if (!sendPolling) return@evaluateJavascript
            val state = runCatching { ColesTrolleyJson.parseScriptState(result) }.getOrNull()
            when (state?.phase) {
                null -> {
                    // A new document dropped the script; onPageFinished or this restarts it.
                    sendPolling = false
                    if (!pageLoading) startSend()
                }
                ColesTrolleyPhase.IDLE, ColesTrolleyPhase.FETCHING -> handler.postDelayed(sendPoller, POLL_MS)
                ColesTrolleyPhase.NOT_READY -> {
                    sendPolling = false
                    handler.postDelayed(sendRetry, RETRY_MS)
                }
                ColesTrolleyPhase.NEEDS_LOGIN -> {
                    sendPolling = false
                    // No time limit while the owner logs in; re-check until it works or the screen is closed.
                    handler.removeCallbacks(sendWatchdog)
                    handler.postDelayed(sendRetry, LOGIN_RETRY_MS)
                    if (!loginNotified) listener?.onColesTrolleyNeedsLogin()
                    loginNotified = true
                }
                ColesTrolleyPhase.DONE, ColesTrolleyPhase.ERROR -> {
                    clearSend()
                    listener?.onColesTrolley(state)
                    unloadIfIdle()
                }
            }
        }
    }

    private fun failSend(message: String) {
        if (pendingSend == null) return
        clearSend()
        needsFreshPage = true
        listener?.onColesTrolley(ColesTrolleyState(ColesTrolleyPhase.ERROR, emptyList(), message))
        unloadIfIdle()
    }

    /** Unloads the page between refreshes (hours apart) so Coles' scripts don't run in the background; the next refresh loads it fresh, with the current key. */
    private fun finish(state: ColesPricesState) {
        cancel()
        unloadIfIdle()
        listener?.onColesPrices(state)
    }

    private inner class SessionClient : WebViewClient() {
        // Nobody sees this page, so app links, store links and intents are dropped rather than opened.
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val scheme = request.url.scheme
            return scheme != "http" && scheme != "https"
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            pageLoading = true
            needsFreshPage = false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            pageLoading = false
            if (clearHistoryOnLoad) {
                clearHistoryOnLoad = false
                view.clearHistory()
            }
            val coles = url?.let(Uri::parse)?.let { ColesUrls.isColesPage(it.scheme, it.host) } == true
            if (pending != null && !polling && coles) start()
            if (pendingSend != null && !sendPolling && coles) {
                if (loginNotified) armSendWatchdog()
                startSend()
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                needsFreshPage = true
                fail(context.getString(R.string.coles_offline))
                failSend(context.getString(R.string.coles_offline))
            }
        }
    }

    private companion object {
        const val SCRIPT_ASSET = "coles/prices.js"
        const val TROLLEY_ASSET = "coles/trolley.js"
        const val BLANK_URL = "about:blank"
        const val STATE_EXPRESSION = "window.__weekdayFuelColesPrices ? window.__weekdayFuelColesPrices.state() : null"
        const val TROLLEY_STATE_EXPRESSION = "window.__weekdayFuelColesTrolley ? window.__weekdayFuelColesTrolley.state() : null"
        const val POLL_MS = 300L
        const val RETRY_MS = 1_000L
        const val LOGIN_RETRY_MS = 2_000L
        const val TIMEOUT_MS = 30_000L
        const val SEND_TIMEOUT_MS = 60_000L
    }
}
