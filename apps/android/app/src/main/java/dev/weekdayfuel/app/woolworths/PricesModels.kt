package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

enum class PricesPhase { IDLE, FETCHING, DONE, ERROR }

/** [prices] is the script's `{ "<stockcode>": {price, was, special, available} }` object, passed to the page as it is. */
data class PricesScriptState(val phase: PricesPhase, val at: String?, val prices: JSONObject, val error: String?)

object PricesJson {
    fun parseStockcodes(codes: JSONArray): List<Long> = (0 until codes.length()).map { codes.getLong(it) }.filter { it > 0 }.distinct()

    fun stockcodesToJson(codes: List<Long>): String = JSONArray().apply { codes.forEach { put(it) } }.toString()

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelPrices.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): PricesScriptState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        return PricesScriptState(
            phase =
                when (o.optString("phase")) {
                    "fetching" -> PricesPhase.FETCHING
                    "done" -> PricesPhase.DONE
                    "error" -> PricesPhase.ERROR
                    else -> PricesPhase.IDLE
                },
            at = if (o.isNull("at")) null else o.optString("at"),
            prices = o.optJSONObject("prices") ?: JSONObject(),
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
