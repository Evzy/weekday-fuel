package dev.weekdayfuel.app.backup

import org.json.JSONObject

/** Messages the host posts to the Weekday Fuel page for backup save/open. */
object BackupMessages {
    fun saved(name: String, at: String): String =
        JSONObject().put("type", "backupSaved").put("name", name).put("at", at).toString()

    fun error(message: String, needNewFile: Boolean): String =
        JSONObject()
            .put("type", "backupError")
            .put("message", message)
            .put("needNewFile", needNewFile)
            .toString()

    fun opened(json: String, name: String): String =
        JSONObject().put("type", "backupOpened").put("json", json).put("name", name).toString()

    fun info(name: String?): String =
        JSONObject().put("type", "backupInfo").put("name", name ?: JSONObject.NULL).toString()
}
