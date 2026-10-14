package dev.weekdayfuel.app.update

/**
 * Compares a GitHub release [tag_name] (e.g. `v0.0.1-alpha`) to the app's [installedVersionName]
 * from `defaultConfig.versionName` (e.g. `0.1.0`). Uses the numeric core before the first `-`
 * (semver-style): `v0.0.1-alpha` → `0.0.1`.
 */
object ReleaseVersionCompare {
    enum class VersusInstalled {
        /** Could not parse one or both sides. */
        UNKNOWN,

        /** Same numeric core (e.g. tag v0.1.0 vs installed 0.1.0). */
        UP_TO_DATE,

        /** GitHub release is newer than this install. */
        UPDATE_AVAILABLE,

        /** This install is newer than the latest GitHub release. */
        INSTALLED_NEWER,
    }

    fun compare(remoteTag: String, installedVersionName: String): VersusInstalled {
        val remote = parseNumericCore(remoteTag) ?: return VersusInstalled.UNKNOWN
        val installed = parseNumericCore(installedVersionName) ?: return VersusInstalled.UNKNOWN
        val cmp = compareTriple(remote, installed)
        return when {
            cmp > 0 -> VersusInstalled.UPDATE_AVAILABLE
            cmp < 0 -> VersusInstalled.INSTALLED_NEWER
            else -> VersusInstalled.UP_TO_DATE
        }
    }

    private fun parseNumericCore(raw: String): List<Int>? {
        var s = raw.trim()
        if (s.startsWith('v', ignoreCase = true)) {
            s = s.substring(1)
        }
        val core = s.substringBefore('-', s)
        val parts = core.split('.').mapNotNull { p -> p.toIntOrNull() }
        if (parts.isEmpty()) return null
        return listOf(
            parts.getOrElse(0) { 0 },
            parts.getOrElse(1) { 0 },
            parts.getOrElse(2) { 0 },
        )
    }

    /** &gt; 0 if [remote] is newer than [installed]. */
    private fun compareTriple(remote: List<Int>, installed: List<Int>): Int {
        for (i in 0..2) {
            val a = remote[i]
            val b = installed[i]
            if (a != b) return a - b
        }
        return 0
    }
}
