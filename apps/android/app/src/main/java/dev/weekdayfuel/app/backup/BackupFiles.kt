package dev.weekdayfuel.app.backup

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import java.io.ByteArrayOutputStream
import java.io.IOException

class BackupFiles(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun rememberedUri(): Uri? {
        val stored = prefs.getString(KEY_URI, null) ?: return null
        val uri = Uri.parse(stored)
        val held =
            appContext.contentResolver.persistedUriPermissions.any {
                it.uri == uri && it.isWritePermission
            }
        return if (held) uri else null
    }

    fun remember(uri: Uri) {
        try {
            appContext.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
            )
        } catch (_: SecurityException) {
            // Caller may still write while the activity result grant is valid.
        }
        prefs.edit().putString(KEY_URI, uri.toString()).apply()
    }

    /** Null when the provider can't answer (file deleted, permission gone, offline). */
    fun displayName(uri: Uri): String? =
        runCatching {
            appContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) cursor.getString(idx) else null
                } else {
                    null
                }
            }
        }.getOrNull()

    fun write(uri: Uri, json: String) {
        appContext.contentResolver.openOutputStream(uri, "wt")?.use { out ->
            out.write(json.toByteArray(Charsets.UTF_8))
        } ?: throw IOException("Couldn't open file for writing.")
    }

    fun read(uri: Uri): String {
        appContext.contentResolver.openInputStream(uri)?.use { input ->
            val buf = ByteArray(BUF_SIZE)
            val out = ByteArrayOutputStream()
            var total = 0
            while (true) {
                val n = input.read(buf)
                if (n <= 0) break
                total += n
                if (total > MAX_BYTES) throw IOException("Backup file is too large.")
                out.write(buf, 0, n)
            }
            return out.toString(Charsets.UTF_8.name())
        } ?: throw IOException("Couldn't open file for reading.")
    }

    private companion object {
        const val PREFS_NAME = "backup"
        const val KEY_URI = "uri"
        const val MAX_BYTES = 10 * 1024 * 1024
        const val BUF_SIZE = 8192
    }
}
