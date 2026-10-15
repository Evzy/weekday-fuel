package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
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
        val id = wholeNumber(msg.opt("timeslotId")) ?: return null
        val date = msg.opt("windowDate") as? String ?: return null
        if (!DATE.matches(date)) return null
        return JSONObject().put("action", "book").put("timeslotId", id).put("windowDate", date).toString()
    }

    /** The page's `checkoutSubs` message as the script's subs request, or null unless it has 1–200 items, each a positive whole stockcode and a boolean. */
    fun subsRequest(msg: JSONObject): String? {
        val items = msg.optJSONArray("items") ?: return null
        if (items.length() !in 1..MAX_SUBS) return null
        val out = JSONArray()
        for (i in 0 until items.length()) {
            val item = items.optJSONObject(i) ?: return null
            val code = wholeNumber(item.opt("stockcode")) ?: return null
            val allow = item.opt("allow") as? Boolean ?: return null
            out.put(JSONObject().put("stockcode", code).put("allow", allow))
        }
        return JSONObject().put("action", "subs").put("items", out).toString()
    }

    /** The page's `checkoutOptions` message as the script's options request, or null unless the note is text of at most 500 characters and the switch a boolean. */
    fun optionsRequest(msg: JSONObject): String? {
        val note = msg.opt("instructions") as? String ?: return null
        val unattended = msg.opt("leaveUnattended") as? Boolean ?: return null
        if (note.length > MAX_NOTE) return null
        return JSONObject().put("action", "options").put("instructions", note).put("leaveUnattended", unattended).toString()
    }

    /** The page's `checkoutAddress` message as the script's address request, or null unless the id is a positive whole number. */
    fun addressRequest(msg: JSONObject): String? {
        val id = wholeNumber(msg.opt("addressId")) ?: return null
        return JSONObject().put("action", "address").put("addressId", id).toString()
    }

    /** A positive whole number JavaScript holds exactly; strings and fractions are refused. */
    private fun wholeNumber(value: Any?): Long? {
        val n =
            when (value) {
                is Int -> value.toLong()
                is Long -> value
                else -> return null
            }
        return n.takeIf { it in 1..MAX_SAFE_INTEGER }
    }

    private const val MAX_SUBS = 200
    private const val MAX_NOTE = 500
    private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

    /** [evaluateResult] is what `evaluateJavascript` returns for `__weekdayFuelCheckout.state()`: a JSON-encoded string, or "null". */
    fun parseScriptState(evaluateResult: String?): CheckoutScriptState? {
        if (evaluateResult == null || evaluateResult == "null") return null
        val raw = JSONTokener(evaluateResult).nextValue() as? String ?: return null
        val o = runCatching { JSONObject(raw) }.getOrNull()
            ?: return CheckoutScriptState(CheckoutPhase.ERROR, null, "Couldn't read the checkout script's state.")
        return CheckoutScriptState(
            phase =
                when (o.optString("phase")) {
                    "idle" -> CheckoutPhase.IDLE
                    "running" -> CheckoutPhase.RUNNING
                    "done" -> CheckoutPhase.DONE
                    else -> CheckoutPhase.ERROR
                },
            result = o.optJSONObject("result"),
            error = if (o.isNull("error")) null else o.optString("error"),
        )
    }
}
