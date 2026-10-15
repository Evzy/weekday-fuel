package dev.weekdayfuel.app.woolworths

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CheckoutJsonTest {
    @Test
    fun missingScriptGivesNull() {
        assertNull(CheckoutJson.parseScriptState(null))
        assertNull(CheckoutJson.parseScriptState("null"))
    }

    @Test
    fun parsesDoneStateWithResult() {
        val raw = """{"phase":"done","result":{"action":"load","loggedOut":false,"booked":null},"error":null}"""
        val state = CheckoutJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(CheckoutPhase.DONE, state.phase)
        assertEquals("load", state.result!!.getString("action"))
        assertNull(state.error)
    }

    @Test
    fun parsesRunningAndError() {
        val running = CheckoutJson.parseScriptState(JSONObject.quote("""{"phase":"running","result":null,"error":null}"""))!!
        assertEquals(CheckoutPhase.RUNNING, running.phase)
        assertNull(running.result)
        val error = CheckoutJson.parseScriptState(JSONObject.quote("""{"phase":"error","result":null,"error":"login check HTTP 503"}"""))!!
        assertEquals(CheckoutPhase.ERROR, error.phase)
        assertEquals("login check HTTP 503", error.error)
    }

    @Test
    fun loadRequest() {
        assertEquals("load", JSONObject(CheckoutJson.loadRequest()).getString("action"))
    }

    @Test
    fun bookRequestKeepsSlotAndDate() {
        val request = CheckoutJson.bookRequest(JSONObject("""{"type":"checkoutBook","timeslotId":948223,"windowDate":"2026-10-21"}"""))!!
        val json = JSONObject(request)
        assertEquals("book", json.getString("action"))
        assertEquals(948223L, json.getLong("timeslotId"))
        assertEquals("2026-10-21", json.getString("windowDate"))
    }

    @Test
    fun bookRequestRejectsMissingOrBadValues() {
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"windowDate":"2026-10-21"}""")))
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":0,"windowDate":"2026-10-21"}""")))
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":948223}""")))
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":948223,"windowDate":"21/10/2026"}""")))
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":948223,"windowDate":"2026-10-21\");alert(1)//"}""")))
    }
}
