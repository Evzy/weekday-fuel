package dev.weekdayfuel.app.woolworths

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HostMessagesTest {
    @Test
    fun progressCarriesCounts() {
        val json = JSONObject(HostMessages.progress(3, 31))
        assertEquals("trolleyProgress", json.getString("type"))
        assertEquals(3, json.getInt("completed"))
        assertEquals(31, json.getInt("total"))
    }

    @Test
    fun doneCarriesPerLineResults() {
        val state =
            TrolleyScriptState(
                TrolleyPhase.DONE, 2, 2,
                listOf(TrolleyLineResult(717518L, true, null), TrolleyLineResult(72280L, false, "HTTP 500")),
                null,
            )
        val json = JSONObject(HostMessages.finished(state))
        assertEquals("trolleyDone", json.getString("type"))
        val results = json.getJSONArray("results")
        assertEquals(717518L, results.getJSONObject(0).getLong("stockcode"))
        assertTrue(results.getJSONObject(0).getBoolean("added"))
        assertTrue(results.getJSONObject(0).isNull("reason"))
        assertFalse(results.getJSONObject(1).getBoolean("added"))
        assertEquals("HTTP 500", results.getJSONObject(1).getString("reason"))
    }

    @Test
    fun errorStateBecomesFailureMessage() {
        val json = JSONObject(HostMessages.finished(TrolleyScriptState(TrolleyPhase.ERROR, 0, 0, emptyList(), "login check HTTP 403")))
        assertEquals("trolleyError", json.getString("type"))
        assertEquals("login check HTTP 403", json.getString("message"))
    }

    @Test
    fun loginMessage() {
        assertEquals("trolleyLogin", JSONObject(HostMessages.login()).getString("type"))
    }

    @Test
    fun pricesDoneCarriesTimeAndPrices() {
        val prices = JSONObject("""{"919345":{"price":5.6,"was":6.6,"special":true,"available":true}}""")
        val json = JSONObject(HostMessages.prices(PricesScriptState(PricesPhase.DONE, "2026-10-15T02:40:00.000Z", prices, null)))
        assertEquals("pricesDone", json.getString("type"))
        assertEquals("2026-10-15T02:40:00.000Z", json.getString("at"))
        assertEquals(6.6, json.getJSONObject("prices").getJSONObject("919345").getDouble("was"), 0.0)
    }

    @Test
    fun pricesErrorCarriesMessage() {
        val json = JSONObject(HostMessages.prices(PricesScriptState(PricesPhase.ERROR, null, JSONObject(), "prices HTTP 503")))
        assertEquals("pricesError", json.getString("type"))
        assertEquals("prices HTTP 503", json.getString("message"))
        val fallback = JSONObject(HostMessages.prices(PricesScriptState(PricesPhase.ERROR, null, JSONObject(), null)))
        assertEquals("Couldn't update Woolworths prices.", fallback.getString("message"))
    }
}
