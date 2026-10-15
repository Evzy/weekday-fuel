package dev.weekdayfuel.app

import dev.weekdayfuel.app.coles.ColesPricesJson
import dev.weekdayfuel.app.woolworths.PricesJson
import org.json.JSONObject

/**
 * A page `refreshPrices` message. The page waits for one Woolworths reply, and for one Coles reply whenever it sent
 * `colesIds`, so a null list here must still be answered with that store's error reply.
 */
data class RefreshPricesRequest(val stockcodes: List<Long>?, val colesWanted: Boolean, val colesIds: List<String>?) {
    companion object {
        fun parse(msg: JSONObject): RefreshPricesRequest {
            val codes = msg.optJSONArray("stockcodes")?.let { runCatching { PricesJson.parseStockcodes(it) }.getOrNull() }
            val colesArray = msg.optJSONArray("colesIds")
            val colesIds = colesArray?.let { runCatching { ColesPricesJson.parseIds(it) }.getOrNull() }
            return RefreshPricesRequest(
                stockcodes = codes?.takeIf { it.isNotEmpty() },
                colesWanted = msg.has("colesIds"),
                colesIds = colesIds?.takeIf { it.isNotEmpty() },
            )
        }
    }
}
