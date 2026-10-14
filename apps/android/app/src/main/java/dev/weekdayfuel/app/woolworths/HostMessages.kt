package dev.weekdayfuel.app.woolworths

import org.json.JSONArray
import org.json.JSONObject

/** Messages the host posts to the Weekday Fuel page over `WeekdayFuelHost`. */
object HostMessages {
    private const val GENERIC_FAILURE = "Something went wrong sending to Woolworths. Try again."

    fun login(): String = JSONObject().put("type", "trolleyLogin").toString()

    fun progress(completed: Int, total: Int): String =
        JSONObject().put("type", "trolleyProgress").put("completed", completed).put("total", total).toString()

    fun finished(state: TrolleyScriptState): String {
        if (state.phase != TrolleyPhase.DONE) return failure(state.error ?: GENERIC_FAILURE)
        val results =
            JSONArray().apply {
                state.results.forEach {
                    put(
                        JSONObject()
                            .put("stockcode", it.stockcode)
                            .put("added", it.added)
                            .put("reason", it.reason ?: JSONObject.NULL),
                    )
                }
            }
        return JSONObject().put("type", "trolleyDone").put("results", results).toString()
    }

    fun failure(message: String): String = JSONObject().put("type", "trolleyError").put("message", message).toString()
}
