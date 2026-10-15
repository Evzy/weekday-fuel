package dev.weekdayfuel.app.coles

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ColesUrlsTest {
    @Test
    fun onlyHttpsColesShopHostIsAColesPage() {
        assertTrue(ColesUrls.isColesPage("https", "www.coles.com.au"))
        assertFalse(ColesUrls.isColesPage("http", "www.coles.com.au"))
        assertFalse(ColesUrls.isColesPage("https", "coles.com.au"))
        assertFalse(ColesUrls.isColesPage("https", "www.coles.com.au.evil.example"))
        assertFalse(ColesUrls.isColesPage("https", null))
    }
}
