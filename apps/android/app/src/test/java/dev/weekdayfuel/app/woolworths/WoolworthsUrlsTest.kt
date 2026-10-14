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
