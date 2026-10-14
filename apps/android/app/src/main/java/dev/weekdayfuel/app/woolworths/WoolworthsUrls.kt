package dev.weekdayfuel.app.woolworths

object WoolworthsUrls {
    const val HOME_URL = "https://www.woolworths.com.au/"
    const val LOGIN_URL = "https://www.woolworths.com.au/shop/securelogin"
    const val TROLLEY_URL = "https://www.woolworths.com.au/shop/checkout"

    fun isWoolworthsHost(host: String?): Boolean =
        host != null && (host == "woolworths.com.au" || host.endsWith(".woolworths.com.au"))
}
