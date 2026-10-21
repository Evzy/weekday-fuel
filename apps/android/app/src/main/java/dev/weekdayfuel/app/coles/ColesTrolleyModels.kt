package dev.weekdayfuel.app.coles

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

data class ColesTrolleyLine(val productId: String, val quantity: Int)

enum class ColesTrolleyPhase { IDLE, FETCHING, NOT_READY, NEEDS_LOGIN, DONE, ERROR }

data class ColesTrolleyResult(val productId: String, val added: Boolean, val reason: String?, val extra: Boolean = false)

data class ColesTrolleyState(val phase: ColesTrolleyPhase, val results: List<ColesTrolleyResult>, val error: String?)

object ColesTrolleyJson {
    private val ID = Regex("^\\d{4,7}$")
    const val MAX_QUANTITY = 99
    const val MAX_KEEP = 300

    fun parseKeep(arr: JSONArray): List<String>? {
        if (arr.length() > MAX_KEEP) return null
        val out = ArrayList<String>(arr.length())
        for (i in 0 until arr.length()) {
            val id = arr.opt(i) as? String ?: return null
            if (!ID.matches(id)) return null
            out.add(id)
        }
        return out
    }

    fun keepToJson(keep: List<String>): String = keep.joinToString(prefix = "[", postfix = "]", separator = ",") { """"$it"""" }

    /**
     * Null when any entry isn't `{productId: "<4-7 digits>", quantity: <whole number 0..99>}`; the lines go into injected
     * script, so nothing else is let through. A product's later duplicates are dropped.
     */
    fun parseLines(lines: JSONArray): List<ColesTrolleyLine>? {
        val out = LinkedHashMap<String, ColesTrolleyLine>()
        for (i in 0 until lines.length()) {
            val o = lines.opt(i) as? JSONObject ?: return null
            val id = o.opt("productId") as? String ?: return null
            if (!ID.matches(id)) return null
            val q = (o.opt("quantity") as? Number)?.toDouble() ?: return null
            if (q != Math.floor(q) || q < 0 || q > MAX_QUANTITY) return null
            out.putIfAbsent(id, ColesTrolleyLine(id, q.toInt()))
        }
        return out.values.toList()
    }

    fun linesToJson(lines: List<ColesTrolleyLine>): String =
        lines.joinToString(prefix = "[", postfix = "]", separator = ",") { """{"productId":"${it.productId}","quantity":${it.quantity}}""" }

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelColesTrolley.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): ColesTrolleyState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        val results = o.optJSONArray("results") ?: JSONArray()
        return ColesTrolleyState(
            phase =
                when (o.optString("phase")) {
                    "fetching" -> ColesTrolleyPhase.FETCHING
                    "notReady" -> ColesTrolleyPhase.NOT_READY
                    "needsLogin" -> ColesTrolleyPhase.NEEDS_LOGIN
                    "done" -> ColesTrolleyPhase.DONE
                    "error" -> ColesTrolleyPhase.ERROR
                    else -> ColesTrolleyPhase.IDLE
                },
            results =
                (0 until results.length()).mapNotNull { i ->
                    val r = results.optJSONObject(i) ?: return@mapNotNull null
                    ColesTrolleyResult(
                        r.optString("productId"),
                        r.optBoolean("added"),
                        if (r.isNull("reason")) null else r.optString("reason"),
                        r.optBoolean("extra"),
                    )
                },
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
