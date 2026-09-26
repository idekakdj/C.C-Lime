# Using C.C. Lime

## Install and open

Run the Windows x64 setup file supplied with the preview, then open **C.C. Lime** from the Start menu. No terminal or development tools are needed to use an installed build. The current installer is unsigned and may receive a Windows reputation warning. Only use a build from a source you trust. Other operating systems remain unverified.

Cloud sign-in requires the private environment configuration described in [Local configuration](LOCAL_CONFIGURATION.md). It is deliberately absent from the public repository and installer. The local calendar preview works without it. Local preview data and signed-in account data are separate calendars; use a full backup and restore to transfer your local work into an account.

## Accounts and saved information

Choose email/password or **Continue with Google**. Google opens your ordinary browser and returns to the desktop app. Verify a newly registered email before cloud synchronization starts. Use the password reset screen if needed. Settings can link the other sign-in method to your existing account.

Changes are saved in a local SQLite database before synchronization. Check the sync status to distinguish saved local work from uploaded work. Offline changes remain queued and retry when a connection returns. A remembered sign-in uses Windows encryption for its refresh token. If encryption is unavailable, the session is not remembered. Ordinary calendar databases and exported backups are not encrypted.

If two computers edit the same item, review the conflict and choose your local version, the cloud version, or keep both. Pending work remains visible in Settings. Signing out keeps this computer's calendar files but stops its account reminders. Each account has a separate local folder.

## Plan your semester

Open **Courses & Semesters**, add semester dates and breaks, then add courses with their names, colors, instructor and usual room. A new class inherits its selected course's semester dates and time zone, proposes weekly meetings, and skips semester breaks by default. Review the selected weekdays and meeting times; lectures and labs should be separate items. Saving a repeating class opens a meeting-date preview before anything is written.

Changing semester dates, time zone or breaks opens a preview for its linked repeating classes. Choose **Apply timetable changes** to update them, or **Save semester only** to keep the current classes. Timetable application preserves each pattern's interval phase and local start time, adopts the semester zone, and replaces count endings with the new semester end date. Previous excluded dates remain excluded by default; the optional replacement of previous break exclusions also replaces manual exclusions inside those old break ranges. Archiving keeps calendar records and reminders. Assignments, exams and independent events keep their dates.

## Calendar and tasks

The month grid lists events below each date. Select a day to expand its schedule underneath that week. Switch to Week for time blocks or Agenda for a list. Use **Add item** for a class, event, assignment, exam, study session or personal task. Tasks can have a due time, just a date, or no date. A date-only deadline becomes overdue after that calendar day ends in its assigned time zone.

The upcoming sidebar includes incomplete tasks, assignments, exams and study sessions for today and the following six calendar days. Overdue items appear separately. The Tasks page includes scheduled work from the previous 30 days and next 180 days, all overdue work and unscheduled tasks. Search looks within the previous and next year, plus unscheduled items. Search results show the first 300 matches.

For repeating items, select **This occurrence only** or **The entire series** before editing. Switching scope with unsaved changes asks you to keep editing or discard those edits. One-occurrence edits retain their original date identity even when moved. A whole-series save previews changed dates. Edited or completed dates removed by the new rule become separate calendar items by default; discarding their history requires an explicit choice and acknowledgement. This decision covers affected history outside the visible preview range too. Canceled dates without other history do not become new items. Completing an occurrence does not complete the entire series.

You can adjust a preview's date window; counts cover that window, while applying changes affects the whole series. If the calendar changes while a preview is open, update the preview before applying it. **Back to editing** leaves the draft intact. Applied changes offer Undo while the undo window remains open and no newer edit conflicts with it.

Month dragging changes the date while preserving local time and duration. Week dragging uses the time under the pointer, snapped to 15 minutes; the resize handle adjusts the end in 15-minute steps. Repeating items ask for occurrence or series scope. A series move shifts its weekday pattern while keeping the current ending and absolute date exclusions, with a preview before saving. Escape cancels an active drag or resize. All proposed moves open editable time controls before saving; you can also edit those fields directly without dragging.

Keyboard shortcuts: **Ctrl+N** adds an item, **Ctrl+F** searches, **Ctrl+T** returns to today. Arrow keys move between calendar dates; Enter expands the selected day. Escape closes dialogs, with a discard confirmation for an edited item.

## Reminders and the tray

Enable **Desktop reminders** in Settings. Add one or more reminders in minutes before an item's start or deadline. All-day items and date-only deadlines use their configured reminder anchor time. Unscheduled tasks cannot produce a dated reminder until they receive a date.

Closing the window normally leaves C.C. Lime in the Windows system tray. Use the tray menu to reopen it or quit completely. **Start with Windows** is optional and off initially. Reminders require the app to be running and the laptop to be awake. Windows Do Not Disturb and notification permissions may suppress banners. The app cannot promise to wake a sleeping laptop or notify while fully quit.

Quiet hours delay notifications, and privacy mode hides calendar titles in popups. The reminder inbox provides dismissal and snooze controls. Use **Send a test reminder** to check your Windows setup. Settings shows whether the test was submitted or Windows reported a failure; submission is not proof that Windows displayed a banner.

In Calendar settings, **Follow this computer's time zone** changes this device's display and quiet-hours zone as the operating-system zone changes. The seven-day sidebar follows the effective display zone. Updates are picked up on resume and during the scheduler's reconciliation, within approximately one minute while running. Stored event instants, class zones, reminder anchors and your saved fixed calendar zone are preserved. Turning this setting off returns to that saved zone; other computers are unaffected.

## Import, export and recovery

In Settings, preview an `.ics` file before importing. Unchanged imported UIDs are skipped; replacing changed imports is optional. Unsupported recurrence or custom time zones may need finite conversion. Read the preview warnings before committing. Files are limited to 10 MiB and 5,000 imported records.

Use `.ics` export for calendar interoperability. Use **Save a full backup** for complete app recovery, including courses, preferences and completion history. Full backups omit passwords, sign-in tokens and reminder delivery history. Treat them as private files. Calendar-format export does not preserve all app-specific data or per-occurrence completion history.

Restore first previews the backup. Restoring copies remaps identities; merging into the same account preserves identities. Automatic daily snapshots retain seven daily copies, one pre-migration copy and three manual snapshots. If the database is unreadable, the recovery screen can restore a valid snapshot while preserving the damaged files. Actual older-version migration and full-disk recovery still require release verification.

## Data and removal

Settings → **Open data folder** shows the active account's location. The ordinary app-data root is `%APPDATA%/C.C. Lime`; Windows app virtualization can redirect it, so use the folder shown by the app. Configuration is in `.local/.env` under that root; account databases are under `accounts/` in separate folders.

**Remove this computer's copy** deletes that account's local data and automatic snapshots after typing `REMOVE`. Unsynced work is lost; cloud records and exported files remain. **Delete account and cloud calendar** requires reauthentication and typing `DELETE`. Interrupted deletion can be resumed; editing pauses during deletion. Other offline computers lose cloud access but their existing disk copies must be removed locally. Exported backups are never remotely erased.

There are no ads, analytics or automatic diagnostic uploads. The Firebase project owner can administer cloud data. A diagnostic export contains versions, counts and sync state, excluding item text and credentials. Send it only if you choose.

## Update and uninstall

Back up first, fully quit the app, then run the newer installer. Automatic updates are not enabled. Uninstall through Windows Apps. Do not assume uninstall deletes calendar data or exported backups. The upgrade/uninstall path remains a release acceptance test; see [current evidence](IMPLEMENTATION_STATUS.md).
