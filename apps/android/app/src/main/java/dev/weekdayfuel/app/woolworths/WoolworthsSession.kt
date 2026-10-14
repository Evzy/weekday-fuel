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
