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
