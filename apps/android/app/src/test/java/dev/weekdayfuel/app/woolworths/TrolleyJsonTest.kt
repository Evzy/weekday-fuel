package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
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
    fun parseLinesKeepsZeroForRemovalsAndDropsNegatives() {
        val lines =
            TrolleyJson.parseLines(
                JSONArray("""[{"stockcode":717518,"quantity":2,"name":"Chobani"},{"stockcode":198763,"quantity":0},{"stockcode":1,"quantity":-1}]"""),
            )
        assertEquals(listOf(TrolleyLine(717518L, 2.0), TrolleyLine(198763L, 0.0)), lines)
    }

    @Test
    fun removedLineCountsAsDone() {
        val raw = """{"phase":"done","total":1,"completed":1,"results":[{"stockcode":198763,"outcome":"removed"}],"error":null}"""
        val state = TrolleyJson.parseScriptState(JSONObject.quote(raw))!!
        assertEquals(listOf(TrolleyLineResult(198763L, true, null)), state.results)
    }

    @Test
    fun parseLinesKeepsDecimalWeights() {
        val lines = TrolleyJson.parseLines(JSONArray("""[{"stockcode":175734,"quantity":0.3}]"""))
        assertEquals(listOf(TrolleyLine(175734L, 0.3)), lines)
    }

    @Test
    fun linesToJsonRoundTrips() {
        val lines = listOf(TrolleyLine(717518L, 2.0), TrolleyLine(72280L, 5.0), TrolleyLine(175734L, 0.3), TrolleyLine(198763L, 0.0))
        assertEquals(lines, TrolleyJson.parseLines(JSONArray(TrolleyJson.linesToJson(lines))))
    }

    @Test
    fun linesToJsonWritesWholeQuantitiesWithoutDecimals() {
        val json = TrolleyJson.linesToJson(listOf(TrolleyLine(717518L, 2.0), TrolleyLine(175734L, 0.3)))
        assertTrue(json, Regex(""""quantity":2[,}]""").containsMatchIn(json))
        assertTrue(json, json.contains(""""quantity":0.3"""))
        assertFalse(json, json.contains("2.0"))
    }

    @Test
    fun parseKeepAcceptsPositiveIntegersAndEmpty() {
        assertEquals(listOf(717518L, 72280L), TrolleyJson.parseKeep(JSONArray("""[717518,72280]""")))
        assertEquals(emptyList<Long>(), TrolleyJson.parseKeep(JSONArray("[]")))
    }

    @Test
    fun parseKeepRejectsInvalid() {
        for (bad in listOf("""[0]""", """[-1]""", """[1.5]""", """["717518"]""")) {
            assertNull(bad, TrolleyJson.parseKeep(JSONArray(bad)))
        }
        val over = JSONArray().apply { repeat(301) { put(1) } }
        assertNull(TrolleyJson.parseKeep(over))
    }

    @Test
    fun keepToJsonRoundTrips() {
        val keep = listOf(717518L, 72280L)
        assertEquals(keep, TrolleyJson.parseKeep(JSONArray(TrolleyJson.keepToJson(keep))))
    }
}
