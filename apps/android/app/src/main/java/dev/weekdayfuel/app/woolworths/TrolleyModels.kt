package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

data class TrolleyLine(val stockcode: Long, val quantity: Double)

data class TrolleyLineResult(val stockcode: Long, val added: Boolean, val reason: String?)

enum class TrolleyPhase { IDLE, CHECKING, LOGGED_OUT, ADDING, DONE, ERROR }

data class TrolleyScriptState(
    val phase: TrolleyPhase,
    val total: Int,
    val completed: Int,
    val results: List<TrolleyLineResult>,
    val error: String?,
)

object TrolleyJson {
    fun parseLines(lines: JSONArray): List<TrolleyLine> =
        (0 until lines.length())
            .map { i -> lines.getJSONObject(i).let { TrolleyLine(it.getLong("stockcode"), it.getDouble("quantity")) } }
            .filter { it.quantity > 0 }

    fun linesToJson(lines: List<TrolleyLine>): String =
        JSONArray().apply {
            lines.forEach {
                val quantity: Number = if (it.quantity % 1.0 == 0.0) it.quantity.toLong() else it.quantity
                put(JSONObject().put("stockcode", it.stockcode).put("quantity", quantity))
            }
        }.toString()

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelTrolley.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): TrolleyScriptState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        val results = o.optJSONArray("results") ?: JSONArray()
        return TrolleyScriptState(
            phase =
                when (o.optString("phase")) {
                    "checking" -> TrolleyPhase.CHECKING
                    "loggedOut" -> TrolleyPhase.LOGGED_OUT
                    "adding" -> TrolleyPhase.ADDING
                    "done" -> TrolleyPhase.DONE
                    "error" -> TrolleyPhase.ERROR
                    else -> TrolleyPhase.IDLE
                },
            total = o.optInt("total"),
            completed = o.optInt("completed"),
            results =
                (0 until results.length()).map { i ->
                    val r = results.getJSONObject(i)
                    TrolleyLineResult(r.getLong("stockcode"), r.optString("outcome") == "added", r.stringOrNull("reason"))
                },
            error = o.stringOrNull("error"),
        )
    }

    private fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else optString(key)
}
