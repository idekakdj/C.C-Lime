# Reminder inbox dismissal repair

1. Keep dismissed reminders and delivery markers in the local journal so ordinary reconciliation/restart cannot replay them.
2. Query the inbox separately from the complete scheduler journal: exclude pending and dismissed states before sorting/limiting the 500 visible rows. Preserve existing emitted, failed, uncertain, suppressed, snoozed, canceled and missed entries.
3. Ignore late Windows failure callbacks when the corresponding journal entry is dismissed, snoozed, absent or has a changed due time. Update only the current matching dispatch/emitted entry; retain normal delivery-failure reporting.
4. Verify journal persistence/no replay after dismissal/restart, stale failure callbacks, and inbox coverage when hundreds of dismissed/pending rows precede a visible reminder. Exercise actual renderer Dismiss controls, surviving neighbors, empty state and ordinary restart in an isolated packaged app.
5. Type-check and run the related service/store/scheduler suites; package and verify the new inbox test and configured/absent-config sign-in readiness. Scan source/package credentials, document results and push the existing draft branch. Preserve installed 0.1.17 and its owner profile until a new installation is requested.
6. Explain physical Windows profile paths, SQLite account separation, local save/outbox, authenticated verified-account Firestore sync, second-device download, conflicts and device-only reminder/settings data using the current implementation. Do not equate local-only preview data with an account calendar or claim calendar/backup end-to-end encryption.

## Verification completed October 2

Typecheck and all 45 related scheduler/service/store cases pass. The actual isolated packaged inbox test passes selective Dismiss, retained neighboring reminder, dialog reopen, two ordinary restarts, final empty state and unchanged calendar items. Both configured and absent-config sign-in readiness cases pass fresh start/restart (three packaged cases total). Source scanning finds no private values in 243 publishable files; package inspection verifies 234 entries, ten dependency notices and 23 unchanged covered-source files. Detailed evidence stays under ignored `test-results/reminder-dismissal-*`.

The journal is retained, while the inbox query excludes dismissed/pending rows before its 500-row cap. Late failure tests preserve dismissal, snooze and a changed future due time; a normal failed new delivery is still reported. Existing installed 0.1.17/profile remain unchanged. [Storage and sync explanation](USER_DATA_AND_SYNC.md) includes a fresh read-only Firestore region check; no account calendar contents or provider settings are changed.
