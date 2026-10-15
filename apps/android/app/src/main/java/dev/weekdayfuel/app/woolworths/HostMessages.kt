package dev.weekdayfuel.app.woolworths

import dev.weekdayfuel.app.coles.ColesPricesPhase
import dev.weekdayfuel.app.coles.ColesPricesState
import org.json.JSONArray
import org.json.JSONObject

/** Messages the host posts to the Weekday Fuel page over `WeekdayFuelHost`. */
object HostMessages {
    private const val GENERIC_FAILURE = "Something went wrong sending to Woolworths. Try again."
    private const val PRICES_FAILURE = "Couldn't update Woolworths prices."
    private const val COLES_PRICES_FAILURE = "Couldn't update Coles prices."
    private const val CHECKOUT_FAILURE = "Couldn't reach Woolworths."

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

    fun prices(state: PricesScriptState): String {
        if (state.phase != PricesPhase.DONE) return pricesFailure(state.error ?: PRICES_FAILURE)
        return JSONObject().put("type", "pricesDone").put("at", state.at ?: JSONObject.NULL).put("prices", state.prices).toString()
    }

    fun pricesFailure(message: String): String = JSONObject().put("type", "pricesError").put("message", message).toString()

    fun colesPrices(state: ColesPricesState): String {
        if (state.phase != ColesPricesPhase.DONE) return colesPricesFailure(state.error ?: COLES_PRICES_FAILURE)
        return JSONObject()
            .put("type", "colesPricesDone")
            .put("at", state.at ?: JSONObject.NULL)
            .put("store", state.store ?: JSONObject.NULL)
            .put("prices", state.prices)
            .toString()
    }

    fun colesPricesFailure(message: String): String = JSONObject().put("type", "colesPricesError").put("message", message).toString()

    fun checkout(state: CheckoutScriptState): String {
        if (state.phase != CheckoutPhase.DONE || state.result == null) return checkoutFailure(state.error ?: CHECKOUT_FAILURE)
        return JSONObject().put("type", "checkoutDone").put("result", state.result).toString()
    }

    fun checkoutFailure(message: String): String = JSONObject().put("type", "checkoutError").put("message", message).toString()
}
