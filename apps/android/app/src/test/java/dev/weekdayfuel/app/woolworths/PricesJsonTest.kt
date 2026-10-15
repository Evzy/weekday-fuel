package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PricesJsonTest {
    @Test
    fun missingScriptGivesNull() {
        assertNull(PricesJson.parseScriptState(null))
        assertNull(PricesJson.parseScriptState("null"))
    }

    @Test
    fun parsesDoneStateWithPrices() {
        val raw =
            """{"phase":"done","at":"2026-10-15T02:40:00.000Z","prices":{"919345":{"price":5.6,"was":6.6,"special":true,"available":true}},"error":null}"""
        val state = PricesJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(PricesPhase.DONE, state.phase)
        assertEquals("2026-10-15T02:40:00.000Z", state.at)
        assertEquals(5.6, state.prices.getJSONObject("919345").getDouble("price"), 0.0)
        assertNull(state.error)
    }

    @Test
    fun parsesFetchingAndError() {
        val fetching = PricesJson.parseScriptState(JSONObject.quote("""{"phase":"fetching","at":null,"prices":{},"error":null}"""))!!
        assertEquals(PricesPhase.FETCHING, fetching.phase)
        assertNull(fetching.at)
        val error = PricesJson.parseScriptState(JSONObject.quote("""{"phase":"error","at":null,"prices":{},"error":"prices HTTP 503"}"""))!!
        assertEquals(PricesPhase.ERROR, error.phase)
        assertEquals("prices HTTP 503", error.error)
    }

    @Test
    fun parseStockcodesKeepsPositiveUniqueCodes() {
        assertEquals(listOf(6013278L, 919345L), PricesJson.parseStockcodes(JSONArray("[6013278,919345,6013278,0,-4]")))
    }

    @Test
    fun stockcodesToJsonIsAPlainArray() {
        assertEquals("[6013278,919345]", PricesJson.stockcodesToJson(listOf(6013278L, 919345L)))
    }
}
