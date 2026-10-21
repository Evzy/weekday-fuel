package dev.weekdayfuel.app.woolworths

import dev.weekdayfuel.app.coles.ColesPricesPhase
import dev.weekdayfuel.app.coles.ColesPricesState
import dev.weekdayfuel.app.coles.ColesTrolleyPhase
import dev.weekdayfuel.app.coles.ColesTrolleyResult
import dev.weekdayfuel.app.coles.ColesTrolleyState
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
        assertFalse(results.getJSONObject(0).has("extra"))
    }

    @Test
    fun doneIncludesExtraOnlyWhenTrue() {
        val state =
            TrolleyScriptState(
                TrolleyPhase.DONE, 2, 2,
                listOf(TrolleyLineResult(111L, true, null, true), TrolleyLineResult(717518L, true, null, false)),
                null,
            )
        val results = JSONObject(HostMessages.finished(state)).getJSONArray("results")
        assertTrue(results.getJSONObject(0).getBoolean("extra"))
        assertFalse(results.getJSONObject(1).has("extra"))
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

    @Test
    fun checkoutDoneCarriesResult() {
        val result = JSONObject("""{"action":"load","loggedOut":false}""")
        val json = JSONObject(HostMessages.checkout(CheckoutScriptState(CheckoutPhase.DONE, result, null)))
        assertEquals("checkoutDone", json.getString("type"))
        assertEquals("load", json.getJSONObject("result").getString("action"))
    }

    @Test
    fun checkoutErrorCarriesMessage() {
        val json = JSONObject(HostMessages.checkout(CheckoutScriptState(CheckoutPhase.ERROR, null, "login check HTTP 503")))
        assertEquals("checkoutError", json.getString("type"))
        assertEquals("login check HTTP 503", json.getString("message"))
        val fallback = JSONObject(HostMessages.checkout(CheckoutScriptState(CheckoutPhase.ERROR, null, null)))
        assertEquals("Couldn't reach Woolworths.", fallback.getString("message"))
        assertEquals("checkoutError", JSONObject(HostMessages.checkoutFailure("x")).getString("type"))
    }

    @Test
    fun colesPricesDoneCarriesTimeStoreAndPrices() {
        val prices = JSONObject().put("8991361", JSONObject().put("price", 3.3))
        val store = JSONObject().put("id", "0668").put("name", "Coles Local St Kilda")
        val json = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.DONE, "2026-10-15T09:40:00.000Z", store, prices, null)))
        assertEquals("colesPricesDone", json.getString("type"))
        assertEquals("2026-10-15T09:40:00.000Z", json.getString("at"))
        assertEquals("Coles Local St Kilda", json.getJSONObject("store").getString("name"))
        assertEquals(3.3, json.getJSONObject("prices").getJSONObject("8991361").getDouble("price"), 0.0)
    }

    @Test
    fun colesPricesErrorCarriesMessageOrDefault() {
        val json = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.ERROR, null, null, JSONObject(), "coles prices HTTP 401")))
        assertEquals("colesPricesError", json.getString("type"))
        assertEquals("coles prices HTTP 401", json.getString("message"))
        val fallback = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.ERROR, null, null, JSONObject(), null)))
        assertEquals("Couldn't update Coles prices.", fallback.getString("message"))
        val notDone = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.FETCHING, null, null, JSONObject(), null)))
        assertEquals("colesPricesError", notDone.getString("type"))
    }

    @Test
    fun colesPricesDoneWithoutTimeOrStoreSendsNulls() {
        val json = JSONObject(HostMessages.colesPrices(ColesPricesState(ColesPricesPhase.DONE, null, null, JSONObject(), null)))
        assertEquals("colesPricesDone", json.getString("type"))
        assertTrue(json.isNull("at"))
        assertTrue(json.isNull("store"))
    }

    @Test
    fun colesPricesFailureCarriesMessage() {
        val json = JSONObject(HostMessages.colesPricesFailure("Coles took too long."))
        assertEquals("colesPricesError", json.getString("type"))
        assertEquals("Coles took too long.", json.getString("message"))
    }

    @Test
    fun colesTrolleyMessages() {
        assertEquals("colesTrolleyLogin", JSONObject(HostMessages.colesTrolleyLogin()).getString("type"))
        val done = JSONObject(HostMessages.colesTrolley(ColesTrolleyState(ColesTrolleyPhase.DONE, listOf(ColesTrolleyResult("3329137", true, null), ColesTrolleyResult("9999999", false, "Product is unavailable")), null)))
        assertEquals("colesTrolleyDone", done.getString("type"))
        val r = done.getJSONArray("results")
        assertEquals("3329137", r.getJSONObject(0).getString("productId"))
        assertTrue(r.getJSONObject(0).getBoolean("added"))
        assertFalse(r.getJSONObject(0).has("reason"))
        assertEquals("Product is unavailable", r.getJSONObject(1).getString("reason"))
        assertFalse(r.getJSONObject(0).has("extra"))
        val withExtra =
            JSONObject(
                HostMessages.colesTrolley(
                    ColesTrolleyState(ColesTrolleyPhase.DONE, listOf(ColesTrolleyResult("132045", true, null, true)), null),
                ),
            ).getJSONArray("results")
        assertTrue(withExtra.getJSONObject(0).getBoolean("extra"))
        val err = JSONObject(HostMessages.colesTrolley(ColesTrolleyState(ColesTrolleyPhase.ERROR, emptyList(), null)))
        assertEquals("colesTrolleyError", err.getString("type"))
        assertEquals("Couldn't send to the Coles trolley.", err.getString("message"))
        assertEquals("Coles took too long.", JSONObject(HostMessages.colesTrolleyFailure("Coles took too long.")).getString("message"))
    }
}
