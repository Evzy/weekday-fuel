package dev.weekdayfuel.app.woolworths

import org.json.JSONObject
import org.json.JSONTokener

enum class CheckoutPhase { IDLE, RUNNING, DONE, ERROR }

/** [result] is the script's result object, passed to the page as it is. */
data class CheckoutScriptState(val phase: CheckoutPhase, val result: JSONObject?, val error: String?)

object CheckoutJson {
    private val DATE = Regex("""\d{4}-\d{2}-\d{2}""")

    fun loadRequest(): String = JSONObject().put("action", "load").toString()

    /** The page's `checkoutBook` message as the script's book request, or null when the slot id or date is missing or malformed. */
    fun bookRequest(msg: JSONObject): String? {
        val id = msg.optLong("timeslotId", 0L)
        val date = msg.optString("windowDate")
        if (id <= 0L || !DATE.matches(date)) return null
        return JSONObject().put("action", "book").put("timeslotId", id).put("windowDate", date).toString()
    }

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelCheckout.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): CheckoutScriptState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = JSONObject(raw)
        return CheckoutScriptState(
            phase =
                when (o.optString("phase")) {
                    "running" -> CheckoutPhase.RUNNING
                    "done" -> CheckoutPhase.DONE
                    "error" -> CheckoutPhase.ERROR
                    else -> CheckoutPhase.IDLE
                },
            result = o.optJSONObject("result"),
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
