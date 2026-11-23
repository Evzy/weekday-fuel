package dev.weekdayfuel.app.steps

import java.time.LocalDate
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class StepsMessagesTest {
    @Test
    fun parsesReadRange() {
        val r = StepsMessages.parseRead(JSONObject("""{"type":"stepsRead","from":"2026-11-16","to":"2026-11-23"}"""))
        assertEquals(LocalDate.of(2026, 11, 16), r!!.from)
        assertEquals(LocalDate.of(2026, 11, 23), r.to)
    }

    @Test
    fun acceptsSingleDayAndMaxRange() {
        val one = StepsMessages.parseRead(JSONObject("""{"from":"2026-11-23","to":"2026-11-23"}"""))
        assertEquals(LocalDate.of(2026, 11, 23), one!!.from)
        val max = StepsMessages.parseRead(JSONObject("""{"from":"2026-10-24","to":"2026-11-23"}"""))
        assertEquals(LocalDate.of(2026, 10, 24), max!!.from)
    }

    @Test
    fun rejectsBadOrLongRanges() {
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"2026-11-23","to":"2026-11-16"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"nope","to":"2026-11-16"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"2026-10-23","to":"2026-11-23"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"2026-10-01","to":"2026-11-23"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"to":"2026-11-23"}""")))
        assertNull(StepsMessages.parseRead(JSONObject("""{"from":"2026-02-30","to":"2026-03-01"}""")))
    }

    @Test
    fun replyShape() {
        val json = JSONObject(StepsMessages.days(mapOf(LocalDate.of(2026, 11, 23) to 8412L)))
        assertEquals("steps", json.getString("type"))
        assertEquals("ok", json.getString("status"))
        assertEquals(8412, json.getJSONObject("days").getInt("2026-11-23"))
        val s = JSONObject(StepsMessages.status(StepsMessages.Status.NO_PERMISSION))
        assertEquals("steps", s.getString("type"))
        assertEquals("noPermission", s.getString("status"))
        assertFalse(s.has("days"))
    }

    @Test
    fun statusWireNames() {
        assertEquals(
            listOf("ok", "noPermission", "unavailable", "updateRequired", "error"),
            StepsMessages.Status.entries.map { it.wire },
        )
    }
}
