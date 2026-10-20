package dev.weekdayfuel.app.backup

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupMessagesTest {
    @Test
    fun savedCarriesNameAndTime() {
        val json = JSONObject(BackupMessages.saved("WeekdayFuel-backup.json", "2026-10-20T00:00:00.000Z"))
        assertEquals("backupSaved", json.getString("type"))
        assertEquals("WeekdayFuel-backup.json", json.getString("name"))
        assertEquals("2026-10-20T00:00:00.000Z", json.getString("at"))
    }

    @Test
    fun errorCarriesMessageAndNeedNewFile() {
        val json = JSONObject(BackupMessages.error("Couldn't read that file.", false))
        assertEquals("backupError", json.getString("type"))
        assertEquals("Couldn't read that file.", json.getString("message"))
        assertFalse(json.getBoolean("needNewFile"))
        val withNew = JSONObject(BackupMessages.error("Couldn't update Drive.json. Save as a new file instead.", true))
        assertTrue(withNew.getBoolean("needNewFile"))
        val cancel = JSONObject(BackupMessages.error("", false))
        assertEquals("", cancel.getString("message"))
    }

    @Test
    fun openedCarriesJsonAndName() {
        val json = JSONObject(BackupMessages.opened("""{"app":"weekdayfuel"}""", "backup.json"))
        assertEquals("backupOpened", json.getString("type"))
        assertEquals("weekdayfuel", JSONObject(json.getString("json")).getString("app"))
        assertEquals("backup.json", json.getString("name"))
    }

    @Test
    fun infoCarriesNameOrNull() {
        val named = JSONObject(BackupMessages.info("My backup.json"))
        assertEquals("backupInfo", named.getString("type"))
        assertEquals("My backup.json", named.getString("name"))
        val none = JSONObject(BackupMessages.info(null))
        assertEquals("backupInfo", none.getString("type"))
        assertTrue(none.isNull("name"))
    }
}
