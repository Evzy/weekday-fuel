package dev.weekdayfuel.app.woolworths

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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
    fun parseScriptStateMalformedOrUnknownPhase() {
        val garbage = CheckoutJson.parseScriptState(JSONObject.quote("garbage"))!!
        assertEquals(CheckoutPhase.ERROR, garbage.phase)
        assertNotNull(garbage.error)
        val weird = CheckoutJson.parseScriptState(JSONObject.quote("""{"phase":"weird","result":null,"error":null}"""))!!
        assertEquals(CheckoutPhase.ERROR, weird.phase)
        val idle = CheckoutJson.parseScriptState(JSONObject.quote("""{"phase":"idle","result":null,"error":null}"""))!!
        assertEquals(CheckoutPhase.IDLE, idle.phase)
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
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":"948223","windowDate":"2026-10-21"}""")))
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":948223.7,"windowDate":"2026-10-21"}""")))
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":948223,"windowDate":"21/10/2026"}""")))
        assertNull(CheckoutJson.bookRequest(JSONObject("""{"timeslotId":948223,"windowDate":"2026-10-21\");alert(1)//"}""")))
    }

    @Test
    fun subsRequestKeepsItems() {
        val msg = JSONObject("""{"type":"checkoutSubs","items":[{"stockcode":34437,"allow":false},{"stockcode":717518,"allow":true}]}""")
        val json = JSONObject(CheckoutJson.subsRequest(msg)!!)
        assertEquals("subs", json.getString("action"))
        val items = json.getJSONArray("items")
        assertEquals(2, items.length())
        assertEquals(34437L, items.getJSONObject(0).getLong("stockcode"))
        assertEquals(false, items.getJSONObject(0).getBoolean("allow"))
        assertEquals(true, items.getJSONObject(1).getBoolean("allow"))
    }

    @Test
    fun subsRequestRejectsBadItems() {
        assertNull(CheckoutJson.subsRequest(JSONObject("""{}""")))
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[]}""")))
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[null]}""")))
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[{"stockcode":"34437","allow":true}]}""")))
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[{"stockcode":34437.5,"allow":true}]}""")))
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[{"stockcode":-1,"allow":true}]}""")))
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[{"stockcode":34437,"allow":"yes"}]}""")))
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[{"stockcode":34437,"allow":true},{"stockcode":34437,"allow":false}]}""")))
        val many = (1..201).joinToString(",") { """{"stockcode":$it,"allow":true}""" }
        assertNull(CheckoutJson.subsRequest(JSONObject("""{"items":[$many]}""")))
    }

    @Test
    fun optionsRequestKeepsNoteAndSwitch() {
        val json = JSONObject(CheckoutJson.optionsRequest(JSONObject("""{"instructions":"Ring the bell \"twice\"","leaveUnattended":false}"""))!!)
        assertEquals("options", json.getString("action"))
        assertEquals("Ring the bell \"twice\"", json.getString("instructions"))
        assertEquals(false, json.getBoolean("leaveUnattended"))
    }

    @Test
    fun optionsRequestRejectsBadValues() {
        assertNull(CheckoutJson.optionsRequest(JSONObject("""{"leaveUnattended":true}""")))
        assertNull(CheckoutJson.optionsRequest(JSONObject("""{"instructions":"x","leaveUnattended":"true"}""")))
        assertNull(CheckoutJson.optionsRequest(JSONObject("""{"instructions":42,"leaveUnattended":true}""")))
        assertNull(CheckoutJson.optionsRequest(JSONObject().put("instructions", "x".repeat(501)).put("leaveUnattended", true)))
    }

    @Test
    fun addressRequestKeepsId() {
        val json = JSONObject(CheckoutJson.addressRequest(JSONObject("""{"addressId":23480611}"""))!!)
        assertEquals("address", json.getString("action"))
        assertEquals(23480611L, json.getLong("addressId"))
    }

    @Test
    fun addressRequestRejectsBadIds() {
        assertNull(CheckoutJson.addressRequest(JSONObject("""{}""")))
        assertNull(CheckoutJson.addressRequest(JSONObject("""{"addressId":0}""")))
        assertNull(CheckoutJson.addressRequest(JSONObject("""{"addressId":"23480611"}""")))
        assertNull(CheckoutJson.addressRequest(JSONObject("""{"addressId":1.5}""")))
    }
}
