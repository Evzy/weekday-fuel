package dev.weekdayfuel.app.steps

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import org.json.JSONObject

/** Page <-> host steps messages. Pure so it can be unit-tested without Android. */
object StepsMessages {
    const val MAX_DAYS = 31L

    enum class Status(val wire: String) {
        OK("ok"),
        NO_PERMISSION("noPermission"),
        UNAVAILABLE("unavailable"),
        UPDATE_REQUIRED("updateRequired"),
        ERROR("error"),
    }

    data class ReadRange(val from: LocalDate, val to: LocalDate)

    fun parseRead(msg: JSONObject): ReadRange? {
        val from = runCatching { LocalDate.parse(msg.optString("from")) }.getOrNull() ?: return null
        val to = runCatching { LocalDate.parse(msg.optString("to")) }.getOrNull() ?: return null
        if (to.isBefore(from)) return null
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) return null
        return ReadRange(from, to)
    }

    fun status(status: Status): String = JSONObject().put("type", "steps").put("status", status.wire).toString()

    fun days(counts: Map<LocalDate, Long>): String {
        val days = JSONObject()
        counts.forEach { (date, n) -> days.put(date.toString(), n) }
        return JSONObject().put("type", "steps").put("status", Status.OK.wire).put("days", days).toString()
    }
}
