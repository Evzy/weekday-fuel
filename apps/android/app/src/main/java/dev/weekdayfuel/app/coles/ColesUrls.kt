package dev.weekdayfuel.app.coles

object ColesUrls {
    const val HOME_URL = "https://www.coles.com.au/"
    const val CHECKOUT_URL = "https://www.coles.com.au/checkout"
    const val SHOP_HOST = "www.coles.com.au"

    fun isColesPage(scheme: String?, host: String?): Boolean = scheme == "https" && host == SHOP_HOST
}
