package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TrolleyJsonTest {
    @Test
    fun missingScriptGivesNull() {
        assertNull(TrolleyJson.parseScriptState(null))
        assertNull(TrolleyJson.parseScriptState("null"))
    }

    @Test
    fun parsesDoneStateFromEvaluateResult() {
        val raw =
            """{"phase":"done","total":2,"completed":2,"results":[{"stockcode":717518,"outcome":"added"},{"stockcode":72280,"outcome":"failed","reason":"HTTP 500"}],"error":null}"""
        val state = TrolleyJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(TrolleyPhase.DONE, state.phase)
        assertEquals(2, state.total)
        assertEquals(2, state.completed)
        assertEquals(
            listOf(TrolleyLineResult(717518L, true, null), TrolleyLineResult(72280L, false, "HTTP 500")),
            state.results,
        )
        assertNull(state.error)
    }

    @Test
    fun parsesLoggedOutAndError() {
        val loggedOut = TrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"loggedOut","total":3,"completed":0,"results":[],"error":null}"""))!!
        assertEquals(TrolleyPhase.LOGGED_OUT, loggedOut.phase)
        val error = TrolleyJson.parseScriptState(JSONObject.quote("""{"phase":"error","total":3,"completed":0,"results":[],"error":"login check HTTP 403"}"""))!!
        assertEquals(TrolleyPhase.ERROR, error.phase)
        assertEquals("login check HTTP 403", error.error)
    }

    @Test
    fun parseLinesKeepsPositiveQuantities() {
        val lines = TrolleyJson.parseLines(JSONArray("""[{"stockcode":717518,"quantity":2,"name":"Chobani"},{"stockcode":72280,"quantity":0}]"""))
        assertEquals(listOf(TrolleyLine(717518L, 2)), lines)
    }

    @Test
    fun linesToJsonRoundTrips() {
        val lines = listOf(TrolleyLine(717518L, 2), TrolleyLine(72280L, 5))
        assertEquals(lines, TrolleyJson.parseLines(JSONArray(TrolleyJson.linesToJson(lines))))
    }
}
