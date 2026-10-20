# Backup and restore (v0.21.0)

Evan, 2026-10-19: export the whole app to a file (kept in Google Drive) and import it on a new phone or after something breaks; update the same backup when he wants. Parked then, picked up 2026-10-20. On Android there is no cloud sync (the header reads "Saved on this device only"), so the phone's `localStorage` is the only copy.

Current app keys (all covered by the `weekdayfuel.` prefix rule): `weekdayfuel.v1` (settings, days, weights), `.v1.shop` (ticks), `.v1.sent`, `.v1.colesSent`, `.v1.specials`, `.v1.orders`, `weekdayfuel.inventory` (Kitchen), plus the excluded price caches.

## Decisions (Evan)

- Manual, whole-app export and import. No automatic backups.
- The app remembers the file it last exported to, so **Update backup** overwrites it in one tap; **Save as a new file** makes another copy.
- Restore replaces everything on the phone, after a preview and two taps, with an undo.

## What's in the file

- Every `localStorage` key that belongs to the app (prefix `weekdayfuel.`), with its raw string value, **except**:
  - live price caches (`weekdayfuel.v1.prices`, `weekdayfuel.v1.colesPrices`): they refresh by themselves;
  - the backup's own keys (`weekdayfuel.backup`, `weekdayfuel.beforeRestore`).
- Store logins live in WebView cookies and are never read or written.
- Format (pretty-printed JSON, UTF-8):

  ```json
  { "app": "weekdayfuel", "v": 1, "exportedAt": "ISO time", "appVersion": "0.16.0", "data": { "weekdayfuel.v1": "...", "...": "..." } }
  ```

- File name for a new file: `WeekdayFuel-backup-YYYY-MM-DD.json` (the user can rename it in the Save-to screen).

## Pure module (`backup.js`, ES5, tested)

- `build(storage, now, appVersion)` → the JSON string. `storage` is `{ keys(): [..], get(k) }` so tests can use a fake.
- `parse(text)` → `{ ok: true, backup }` or `{ ok: false, error }` with errors: not JSON, not a Weekday Fuel backup (`app`), newer format (`v > 1`), bad `data` (not an object of strings), or a key outside the `weekdayfuel.` prefix (dropped, not an error).
- `summary(backup)` → `{ exportedAt, appVersion, days, orders, weighIns, hasKitchen }`, read defensively from the known keys (main state key's `days`/`weights`, the orders key, the inventory key); unknown or unreadable parts count as 0.
- `restorePlan(storage, backup)` → `{ remove: [keys], set: { key: value } }`: remove every current app key not in the backup (except price caches and the backup's own keys), set every backup key.

## Android host

New page→host messages (same origin rule as today: only `https://appassets.androidplatform.net` can send them):

- `{ type: "backupSave", json, name, newFile }`:
  - when `newFile` is true or there's no remembered file: open the system Save-to screen (`ACTION_CREATE_DOCUMENT`, `application/json`, suggested `name`); on success take a persistable read/write permission and remember the URI in host `SharedPreferences`;
  - otherwise write to the remembered URI (truncate mode `"wt"`);
  - reply `{ type: "backupSaved", name: display name, at: ISO }` or `{ type: "backupError", message, needNewFile: bool }` (`needNewFile` when the remembered file can't be written: deleted, permission lost, Drive refusal). The user cancelling the Save-to screen replies `backupError` with `message: ""` (the page shows nothing).
- `{ type: "backupOpen" }`: open the system file picker (`ACTION_OPEN_DOCUMENT`, `application/json` and `*/*`), read up to 10 MB as UTF-8, reply `{ type: "backupOpened", json, name }` or `backupError`.
- `{ type: "backupInfo" }`: reply `{ type: "backupInfo", name|null }` with the remembered file's display name (null when none or its permission is gone).
- Writes and reads run off the main thread; replies go through the existing `replyToPage`.
- The pending JSON is held in a field while the Save-to screen is open. If it's gone when the result comes back (the process was killed), reply `backupError` "Couldn't save the backup. Try again."
- Message builders live in `backup/BackupMessages.kt` with a unit test, following `HostMessages`. The remembered URI lives in `SharedPreferences` (`backup`, key `uri`); the display name comes from `OpenableColumns.DISPLAY_NAME`.
- Activity-result launchers (`CreateDocument("application/json")`, `OpenDocument`) are registered as fields so they exist before `onCreate` finishes.

## Page

- `localStorage["weekdayfuel.backup"]`: `{ name, at }` of the last successful save (new key, not exported).
- **Targets (⚙) → Backup panel**, below the targets panel. On opening Targets the page sends `backupInfo`.
  - "Last backup: {fmtShort(at)} ({n} days ago) · {name}", or "No backup yet. Save one to Google Drive so you can restore it on a new phone."
  - **Update backup** (shown when the host reports a remembered file) → `backupSave` with `newFile: false`.
  - **Save as a new file** → `backupSave` with `newFile: true`.
  - **Restore from a file** → `backupOpen`.
  - While waiting, buttons are disabled with "Saving…" / "Opening…". Errors show under the panel; `needNewFile` adds "Save as a new file instead."
  - Outside the Android app (no host), the panel says backups need the Android app.
- **Restore flow:** on `backupOpened`, `parse` it; on error show the message. On success show the summary ("Backup from 12 Oct · v0.15.0 · 46 days, 9 orders, 30 weigh-ins, Kitchen stock") and a "Replace everything on this phone" button (two taps, `state.armed`). On confirm: save the current app keys (same selection as `build`) to `weekdayfuel.beforeRestore` as a backup JSON, apply `restorePlan`, then `location.reload()`.
- **Undo restore:** when `weekdayfuel.beforeRestore` exists, the panel shows "Undo restore" (two taps), which applies it the same way and deletes it. A successful backup save also deletes it.
- If writing `beforeRestore` fails (storage full), the restore stops with "Couldn't keep a copy of your current data, so nothing was changed."
- **No stale writes:** before applying a plan the page sets `restoring = true`; `lsSave`, `queueWrite` and every other `localStorage` writer that could fire from a pending timer or handler skip while it's set, so the old in-memory state can't overwrite the restored keys before `location.reload()`.
- If applying a plan throws part-way, the page applies `beforeRestore` back and shows "Restore failed; your data was put back."

## Testing

- `backup.test.js` (add to the CI list): build round trip, exclusions, parse errors, newer-version refusal, foreign keys dropped, summary on real-shaped and broken data, restorePlan removes stale keys and keeps excluded ones.
- Kotlin compiles in CI; message JSON helpers get unit tests if they follow the existing `HostMessages` pattern.
- Owner checks: save to Drive, update it, restore on the same phone (data unchanged), undo; later, restore on a new phone.
