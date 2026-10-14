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

    @Test
    fun isWoolworthsPage_acceptsHttpsWoolworthsHost() {
        assertTrue(WoolworthsUrls.isWoolworthsPage("https", "www.woolworths.com.au"))
    }

    @Test
    fun isWoolworthsPage_rejectsNonHttpsOrWrongHost() {
        assertFalse(WoolworthsUrls.isWoolworthsPage("http", "www.woolworths.com.au"))
        assertFalse(WoolworthsUrls.isWoolworthsPage("javascript", "www.woolworths.com.au"))
        assertFalse(WoolworthsUrls.isWoolworthsPage(null, "www.woolworths.com.au"))
        assertFalse(WoolworthsUrls.isWoolworthsPage("https", "www.coles.com.au"))
        assertFalse(WoolworthsUrls.isWoolworthsPage("https", null))
    }
}
