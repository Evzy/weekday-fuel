package dev.weekdayfuel.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.util.Log
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
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import dev.weekdayfuel.app.update.GithubApkReleaseInfo
import dev.weekdayfuel.app.update.GithubApkReleaseUpdater
import dev.weekdayfuel.app.update.ReleaseVersionCompare
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

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
        WindowInsetsControllerCompat(window, root).apply {
            isAppearanceLightStatusBars = !isNight
            isAppearanceLightNavigationBars = !isNight
        }

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
        root.addView(webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        setContentView(root)

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
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
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

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
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
            openExternally(request.url)
            return true
        }
    }

    private companion object {
        const val TAG = "WeekdayFuel"
        val APP_URL = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/weekday_fuel/Weekday_Fuel.html"
    }
}
