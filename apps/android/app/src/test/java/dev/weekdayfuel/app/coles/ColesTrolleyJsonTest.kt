package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ColesTrolleyJsonTest {
    @Test
    fun parseLinesKeepsValidLinesAndDropsLaterDuplicates() {
        val lines = ColesTrolleyJson.parseLines(JSONArray("""[{"productId":"3329137","quantity":2,"name":"Macaroni"},{"productId":"5077283","quantity":0},{"productId":"3329137","quantity":5}]"""))
        assertEquals(listOf(ColesTrolleyLine("3329137", 2), ColesTrolleyLine("5077283", 0)), lines)
        assertEquals(emptyList<ColesTrolleyLine>(), ColesTrolleyJson.parseLines(JSONArray("[]")))
    }

    @Test
    fun parseLinesRejectsAnythingElse() {
        for (bad in listOf(
            """[{"productId":3329137,"quantity":1}]""",
            """[{"productId":"12","quantity":1}]""",
            """[{"productId":"3329137\"]);alert(1);//","quantity":1}]""",
            """[{"productId":"3329137","quantity":1.5}]""",
            """[{"productId":"3329137","quantity":-1}]""",
            """[{"productId":"3329137","quantity":100}]""",
            """[{"productId":"3329137","quantity":"2"}]""",
            """[{"productId":"3329137"}]""",
            """["3329137"]""",
            """[null]""",
        )) assertNull(bad, ColesTrolleyJson.parseLines(JSONArray(bad)))
    }

    @Test
    fun linesToJsonIsPlain() {
        assertEquals("""[{"productId":"3329137","quantity":2}]""", ColesTrolleyJson.linesToJson(listOf(ColesTrolleyLine("3329137", 2))))
    }

    @Test
    fun parseKeepAcceptsProductIdsAndEmpty() {
        assertEquals(listOf("3329137", "5077283"), ColesTrolleyJson.parseKeep(JSONArray("""["3329137","5077283"]""")))
        assertEquals(emptyList<String>(), ColesTrolleyJson.parseKeep(JSONArray("[]")))
    }

    @Test
    fun parseKeepRejectsInvalid() {
        for (bad in listOf("""[3329137]""", """["12"]""", """["3329137\"]);alert(1);//"]""", """[null]""")) {
            assertNull(bad, ColesTrolleyJson.parseKeep(JSONArray(bad)))
        }
        val over = JSONArray().apply { repeat(301) { put("3329137") } }
        assertNull(ColesTrolleyJson.parseKeep(over))
    }

    @Test
    fun keepToJsonRoundTrips() {
        val keep = listOf("3329137", "5077283")
        assertEquals(keep, ColesTrolleyJson.parseKeep(JSONArray(ColesTrolleyJson.keepToJson(keep))))
    }

    @Test
    fun parsesScriptStates() {
        assertNull(ColesTrolleyJson.parseScriptState(null))
        assertNull(ColesTrolleyJson.parseScriptState("null"))
        val done = ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"done","results":[{"productId":"3329137","added":true},{"productId":"9999999","added":false,"reason":"Product is unavailable"}],"error":null}"""))!!
        assertEquals(ColesTrolleyPhase.DONE, done.phase)
        assertEquals(listOf(ColesTrolleyResult("3329137", true, null), ColesTrolleyResult("9999999", false, "Product is unavailable")), done.results)
        assertEquals(ColesTrolleyPhase.NEEDS_LOGIN, ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"needsLogin","results":[],"error":null}"""))!!.phase)
        assertEquals(ColesTrolleyPhase.NOT_READY, ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"notReady","results":[],"error":null}"""))!!.phase)
        val err = ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"error","results":[],"error":"coles trolley HTTP 500"}"""))!!
        assertEquals(ColesTrolleyPhase.ERROR, err.phase)
        assertEquals("coles trolley HTTP 500", err.error)
        assertEquals(ColesTrolleyPhase.IDLE, ColesTrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"odd"}"""))!!.phase)
    }
}
