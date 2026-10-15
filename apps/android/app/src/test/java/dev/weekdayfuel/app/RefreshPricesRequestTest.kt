package dev.weekdayfuel.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RefreshPricesRequestTest {
    private fun parse(json: String) = RefreshPricesRequest.parse(JSONObject(json))

    @Test
    fun usableListsGoToBothStores() {
        val r = parse("""{"type":"refreshPrices","stockcodes":[123,456,123],"colesIds":["8991361","132045"]}""")
        assertEquals(listOf(123L, 456L), r.stockcodes)
        assertTrue(r.colesWanted)
        assertEquals(listOf("8991361", "132045"), r.colesIds)
    }

    @Test
    fun noColesIdsMeansNoColesReply() {
        val r = parse("""{"type":"refreshPrices","stockcodes":[123]}""")
        assertFalse(r.colesWanted)
        assertNull(r.colesIds)
    }

    @Test
    fun emptyAbsentOrUnreadableStockcodesNeedAWoolworthsError() {
        val ids = """"colesIds":["8991361"]"""
        for (codes in listOf("", """"stockcodes":[],""", """"stockcodes":["x"],""", """"stockcodes":"123",""")) {
            val r = parse("""{"type":"refreshPrices",$codes$ids}""")
            assertNull(codes, r.stockcodes)
            assertEquals(listOf("8991361"), r.colesIds)
        }
    }

    @Test
    fun emptyOrUnreadableColesIdsNeedAColesError() {
        for (ids in listOf("[]", """["12"]""", """["8991361",8991361]""", "\"8991361\"", "null")) {
            val r = parse("""{"type":"refreshPrices","stockcodes":[123],"colesIds":$ids}""")
            assertTrue(ids, r.colesWanted)
            assertNull(ids, r.colesIds)
            assertEquals(listOf(123L), r.stockcodes)
        }
    }
}
