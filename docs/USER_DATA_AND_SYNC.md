# Where C.C. Lime keeps data and how another device receives it

Reviewed against the current application code on October 2, 2026. The ordinary installed release is 0.1.17; the separate reminder-dismissal repair is source/test-package only.

## On Windows

The ordinary data root is `%APPDATA%\C.C. Lime`, normally `C:\Users\<Windows-user>\AppData\Roaming\C.C. Lime`. Settings → Open data folder opens the active account's directory.

| Location | Contents |
| --- | --- |
| `accounts/<account-id-hash>/calendar.sqlite` | Calendar items, courses/semesters, recurring exceptions/completions, preferences, profile name/photo/themes, lifetime progress, sync queue/shadows/conflicts and the local reminder journal |
| Same directory, SQLite `-wal`/`-shm` files | SQLite transaction/recovery sidecars; do not move only the database while the app is running |
| Same directory, `backups/` | Automatic SQLite snapshots; daily and pre-change/migration copies use bounded count retention |
| `device.json` | This computer's reminder/startup/quiet-hours/privacy/zone-following and view settings |
| `session.enc` | Remembered account information and refresh token protected with Electron's Windows secure-storage encryption; the app does not save the account password here |
| `.local/.env` | This private build's Firebase/Google connection configuration, excluded from public source and application archive |

Each account opens its own hashed directory. The hash separates accounts; it does **not** encrypt calendar contents. Calendar databases and exported/automatic backups are not encrypted by C.C. Lime. Manual exports stay where the user saves them. Engineering upgrade backups also exist in the project's ignored `.local` folder; because this project is under OneDrive, ignoring files in Git does not prevent another folder-sync service from copying them. GitHub receives source/documentation, not these ignored user data/configuration files.

## In the account cloud

Firebase Authentication supplies the account's stable UID. Verified account records synchronize through HTTPS to Cloud Firestore beneath that UID (`users/<uid>/records/<record-id>`), with sequence/head/receipt/deletion metadata for durable synchronization. Rules check ownership and verification; project administrators have privileged access independently of these ordinary user rules.

A fresh read-only database metadata check at `2026-10-03T02:13:26Z` confirms the database region `northamerica-northeast2`, which Firebase documents as [Toronto](https://firebase.google.com/docs/firestore/locations). This identifies the calendar database region, not the locations of authentication, logs, support, backups or every subprocessor. The app does not provide end-to-end calendar encryption.

## From one computer to another

1. An edit commits to the active account's SQLite database first and enters its durable outgoing queue. It remains usable locally without a network connection.
2. When running, configured, signed in and email-verified, the app validates its session and sends queued mutations to the same account's cloud records. Version checks and idempotent receipts prevent silent overwrite or retry duplication. Offline/provider-limit failures retain changes and retry; overlapping edits can require conflict review.
3. Another configured computer signed into the **same C.C. Lime account** downloads that UID's cloud changes into its own account-specific SQLite database. It then has its own persistent local copy and can queue offline edits in the opposite direction. Signing into a different account does not expose the first account's directory/cloud records.
4. Sync starts on account activation, is scheduled roughly 700 ms after local changes, and normally polls about every 30 seconds with the app visible or every two minutes while hidden. Foreground/resume/unlock requests a sooner pass. Settings → Sync now can request one manually; errors/provider cooldowns can extend timing.

Calendar schedules and reminder rules, courses/semesters, recurring edits/completions, calendar preferences, profile photo/name/themes and lifetime completion history sync as ordinary account records. **Reminder delivery history, dismissals, snoozes, Windows startup/notification/quiet-hours settings and remembered login are device-local.** Each running computer schedules its own notifications.

For the current private build, every new computer also needs its private Firebase/Google configuration set up for the same project; the installer intentionally contains no connection credentials. Sign in separately on that computer rather than transferring `session.enc`. A local-only preview calendar is a separate local profile and does not automatically merge when signing in: export a full backup and restore/import its calendar into the signed-in account, reviewing the preview before confirming. Other-device copies appear only after their edits have successfully reached the cloud and the receiving app has synchronized.
