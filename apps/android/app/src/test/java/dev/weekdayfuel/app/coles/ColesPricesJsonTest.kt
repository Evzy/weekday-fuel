package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ColesPricesJsonTest {
    @Test
    fun missingScriptGivesNull() {
        assertNull(ColesPricesJson.parseScriptState(null))
        assertNull(ColesPricesJson.parseScriptState("null"))
    }

    @Test
    fun parsesDoneStateWithStoreAndPrices() {
        val raw =
            """{"phase":"done","at":"2026-10-15T09:40:00.000Z","store":{"id":"0668","name":"Coles Local St Kilda"},"prices":{"8991361":{"price":3.3,"was":4.65,"special":true,"available":true}},"error":null}"""
        val state = ColesPricesJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(ColesPricesPhase.DONE, state.phase)
        assertEquals("2026-10-15T09:40:00.000Z", state.at)
        assertEquals("Coles Local St Kilda", state.store!!.getString("name"))
        assertEquals(4.65, state.prices.getJSONObject("8991361").getDouble("was"), 0.0)
        assertNull(state.error)
    }

    @Test
    fun parsesFetchingNotReadyAndError() {
        val fetching = ColesPricesJson.parseScriptState(JSONObject.quote("""{"phase":"fetching","at":null,"store":null,"prices":{},"error":null}"""))!!
        assertEquals(ColesPricesPhase.FETCHING, fetching.phase)
        assertNull(fetching.store)
        val notReady = ColesPricesJson.parseScriptState(JSONObject.quote("""{"phase":"notReady","at":null,"store":null,"prices":{},"error":null}"""))!!
        assertEquals(ColesPricesPhase.NOT_READY, notReady.phase)
        val error = ColesPricesJson.parseScriptState(JSONObject.quote("""{"phase":"error","at":null,"store":null,"prices":{},"error":"coles prices HTTP 401"}"""))!!
        assertEquals(ColesPricesPhase.ERROR, error.phase)
        assertEquals("coles prices HTTP 401", error.error)
    }

    @Test
    fun parseIdsKeepsUniqueDigitStrings() {
        assertEquals(listOf("8991361", "132045"), ColesPricesJson.parseIds(JSONArray("""["8991361","132045","8991361"]""")))
        assertEquals(emptyList<String>(), ColesPricesJson.parseIds(JSONArray("[]")))
    }

    @Test
    fun parseIdsRejectsAnythingElse() {
        assertNull(ColesPricesJson.parseIds(JSONArray("""["8991361",132045]""")))
        assertNull(ColesPricesJson.parseIds(JSONArray("""["12"]""")))
        assertNull(ColesPricesJson.parseIds(JSONArray("""["12345678"]""")))
        assertNull(ColesPricesJson.parseIds(JSONArray("""["8991361\"]);alert(1);//"]""")))
    }

    @Test
    fun idsToJsonIsAPlainArrayOfStrings() {
        assertEquals("""["8991361","132045"]""", ColesPricesJson.idsToJson(listOf("8991361", "132045")))
    }
}
