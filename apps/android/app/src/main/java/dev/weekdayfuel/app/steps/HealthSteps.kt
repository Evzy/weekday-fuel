package dev.weekdayfuel.app.steps

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.Period

/** Read-only daily step totals from Health Connect. */
class HealthSteps(private val context: Context) {
    val permissions: Set<String> = setOf(HealthPermission.getReadPermission(StepsRecord::class))

    fun availability(): StepsMessages.Status =
        when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> StepsMessages.Status.OK
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> StepsMessages.Status.UPDATE_REQUIRED
            else -> StepsMessages.Status.UNAVAILABLE
        }

    private fun client() = HealthConnectClient.getOrCreate(context)

    suspend fun hasPermission(): Boolean = client().permissionController.getGrantedPermissions().containsAll(permissions)

    /** Status-only reply, or the daily counts when available and permitted. */
    suspend fun read(range: StepsMessages.ReadRange): String {
        val avail = availability()
        if (avail != StepsMessages.Status.OK) return StepsMessages.status(avail)
        if (!hasPermission()) return StepsMessages.status(StepsMessages.Status.NO_PERMISSION)
        // Local date-times so each slice is a calendar day in the phone's time zone.
        val groups =
            client().aggregateGroupByPeriod(
                AggregateGroupByPeriodRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(range.from.atStartOfDay(), range.to.plusDays(1).atStartOfDay()),
                    timeRangeSlicer = Period.ofDays(1),
                ),
            )
        val counts = LinkedHashMap<LocalDate, Long>()
        groups.forEach { g -> counts[g.startTime.toLocalDate()] = g.result[StepsRecord.COUNT_TOTAL] ?: 0L }
        return StepsMessages.days(counts)
    }

    suspend fun status(): String {
        val avail = availability()
        if (avail != StepsMessages.Status.OK) return StepsMessages.status(avail)
        return StepsMessages.status(if (hasPermission()) StepsMessages.Status.OK else StepsMessages.Status.NO_PERMISSION)
    }
}
