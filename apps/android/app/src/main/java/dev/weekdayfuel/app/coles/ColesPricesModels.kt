package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

enum class ColesPricesPhase { IDLE, FETCHING, NOT_READY, DONE, ERROR }

/** [prices] is the script's `{ "<id>": {price, was, special, available} }` object and [store] its `{id, name}`, passed to the page as they are. */
data class ColesPricesState(val phase: ColesPricesPhase, val at: String?, val store: JSONObject?, val prices: JSONObject, val error: String?)

object ColesPricesJson {
    private val ID = Regex("^\\d{4,7}$")

    /** Null when any entry is not a string of 4 to 7 digits; the IDs go into injected script, so nothing else is let through. */
    fun parseIds(ids: JSONArray): List<String>? {
        val out = mutableListOf<String>()
        for (i in 0 until ids.length()) {
            val v = ids.opt(i) as? String ?: return null
            if (!ID.matches(v)) return null
            out += v
        }
        return out.distinct()
    }

    fun idsToJson(ids: List<String>): String = JSONArray().apply { ids.forEach { put(it) } }.toString()

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelColesPrices.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): ColesPricesState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        return ColesPricesState(
            phase =
                when (o.optString("phase")) {
                    "fetching" -> ColesPricesPhase.FETCHING
                    "notReady" -> ColesPricesPhase.NOT_READY
                    "done" -> ColesPricesPhase.DONE
                    "error" -> ColesPricesPhase.ERROR
                    else -> ColesPricesPhase.IDLE
                },
            at = if (o.isNull("at")) null else o.optString("at"),
            store = o.optJSONObject("store"),
            prices = o.optJSONObject("prices") ?: JSONObject(),
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
