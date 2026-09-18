# C.C. Lime — acceptance test specification

**Baseline:** [project specification](../PROJECT_PLAN.md). **Work order:** [implementation task register](IMPLEMENTATION_TASKS.md).

All tests in this document are **not run** at the end of the planning phase. Expected results are requirements, not reported observations. During implementation, record actual build/version, environment, date, result, and supporting evidence. An emulator or browser preview cannot substitute for a test explicitly requiring the installed app or a live identity provider.

## Test environments and shared fixtures

- **D1:** installed Windows desktop app using device identity A and its own app-data directory.
- **D2:** second independently installed app using device identity B and an independent app-data directory. A second test process is useful for automation, but the release report must distinguish it from a second real computer.
- **U1/U2:** different synthetic test users; use owner-controlled test accounts for live tests. Never load real student information into generated fixtures.
- **C1:** one semester from September 1 through December 18, 2026, in `America/Toronto`, with a break October 12–16 inclusive; lecture pattern Monday/Wednesday 09:00–10:00 and a separate Friday lab 14:00–16:00.
- **P1:** 50 courses, 5,000 stored master records, and 20,000 generated occurrences within the performance date window. Record the fixture generator seed.
- **Clock control:** use a replaceable clock for logical tests. Use real operating-system sleep/startup/notification behavior for native acceptance checks. Never change a user's actual clock as an unnoticed side effect of a test.
- **Network control:** simulated offline, timeout before send, timeout after commit, delayed response, quota failure, expired token, and denied permission. Live provider tests must use a separate clearly labeled test configuration.

## Installation and local durability

### A-01 — Fresh desktop installation

**Environment:** clean supported Windows x64 account without project dependencies or a development server. **Tasks:** T-02/T-46.

Install the release candidate from its `.exe`; launch from the Start Menu; close and relaunch; inspect product name, icon, version, and window. Verify no terminal or development server is required. Confirm the installation is usable by a standard user without an unnecessary elevation requirement.

**Pass:** C.C. Lime opens successfully from the installed artifact, local UI assets work offline, the correct version appears, and no missing DLL/native-module error occurs. Capture installer checksum and OS/architecture.

### A-02 — Acknowledged save survives every ordinary exit path

**Environment:** D1. **Tasks:** T-03/T-08/T-40.

Create an event, assignment, course, and recurrence exception. Wait for the explicit local-save acknowledgment. Verify each after closing to tray, explicit Quit, and an unexpected application-process termination performed on test data. Repeat with a mutation made while offline.

**Pass:** every acknowledged record and unsent mutation is present after relaunch, with original IDs, dates, and relationships. A crash after acknowledgment cannot erase a saved record.

### A-03 — Settings and view persistence

**Environment:** D1/D2. **Tasks:** T-08/T-39.

Change week start, time display, calendar zone, notification defaults, startup choice, selected view/month, and sidebar filters. Relaunch. Sync the same account to D2 and compare the documented synced versus device-only settings.

**Pass:** each setting persists at the specified scope. Device A's startup setting does not enable startup on device B. Changing reminder defaults leaves existing item rules unchanged.

### A-04 — Failed save, corruption, and migration recovery

**Environment:** disposable local database fixtures. **Tasks:** T-09/T-40.

Inject a full-disk/write-denied failure during a save; open a damaged database; migrate a previous schema; fail the migration midway; inspect recovery snapshots and restore behavior. Verify daily snapshots include consistent database content even when WAL is active.

**Pass:** no failed write claims success, editor contents remain available, migration failure preserves/restores the previous data, and corruption does not trigger an automatic overwrite of the only recoverable copy.

### A-05 — Single writer and chained local edits

**Environment:** D1 with slow/failing network. **Tasks:** T-08/T-28.

Launch the app twice. While the first update to an item is in flight, edit that item twice more and terminate/relaunch before acknowledgment. Recover the queue and complete sync.

**Pass:** only one app instance writes that account database; the three edits retain their intended order; the final local and cloud item equals the latest edit; no acknowledgment replaces a newer unsent local value.

## Accounts and privacy boundaries

### A-06 — Email signup and verification

**Environment:** live Firebase test project, plus automated error fixtures. **Tasks:** T-04/T-25/T-26.

Register with a valid address/password; attempt too-short password and malformed email; request verification; save one local item before verification; verify in the managed action page; return and refresh verification status.

**Pass:** validation is understandable, verification email arrives in the controlled test account, pre-verification data stays local, cloud access is denied for an unverified token, and pending data syncs after verified credentials are refreshed.

### A-07 — Password sign-in, recovery, and secure session persistence

**Environment:** D1 and live account. **Tasks:** T-25/T-26.

Sign in, quit, inspect the session-file format for plaintext credentials, relaunch offline, reconnect after token expiry, and reset the password through the actual recovery email. Exercise invalid password and nonexisting-address recovery responses.

**Pass:** the refresh token is OS-encrypted, passwords are not retained, remembered cached data opens offline, a valid session refreshes once despite concurrent calls, and password recovery actually permits a subsequent sign-in without leaking account existence through app wording.

### A-08 — Google sign-in through the system browser

**Environment:** installed D1 with live Google/Firebase test configuration. **Tasks:** T-04/T-25/T-26.

Select Continue with Google, inspect the requested scopes, complete browser consent, return through the loopback listener, and relaunch with the resulting remembered session.

**Pass:** the flow uses the system browser, asks only for identity access, validates state/PKCE/nonce and token audience, receives the expected Firebase UID, closes the callback listener, and restores the correct account on relaunch.

### A-09 — Authentication cancellation and account linking

**Environment:** live provider plus callback/error fixtures. **Tasks:** T-04/T-25/T-26.

Cancel Google sign-in, let it time out, send a wrong-state callback, attempt a callback replay, and exercise an account whose email is used by both providers. Link after signing in to the existing account, then sign in with each provider.

**Pass:** cancellation returns to a usable sign-in screen, failed callbacks do not authenticate, listeners/tokens are cleaned up, linking preserves the original UID and data, and a provider attached to a different account cannot silently merge accounts.

### A-10 — Sign-out and account switching

**Environment:** D1, U1/U2. **Tasks:** T-25/T-31.

Create offline U1 changes and a near-future reminder; sign out; attempt to reopen U1 offline; sign in as U2; trigger old asynchronous callbacks; later sign back in as U1 online.

**Pass:** signed-out U1 data is not shown without reauthentication, U2 never sees U1 content or notifications, stale callbacks cannot write into U2's database, and U1's unsynced changes remain recoverable unless explicitly removed.

### A-11 — Interrupted account deletion

**Environment:** disposable U1 live/emulated account with several batches of data. **Tasks:** T-31.

Confirm deletion after recent authentication; interrupt during cloud cleanup; relaunch and resume; simulate a cleanup failure; finally complete deletion. Inspect cloud records, receipts, settings, identity, and local caches.

**Pass:** normal editing stops during deletion, cleanup is resumable, authentication identity is not deleted before owned cloud data is verified gone, failures are not described as completed deletion, and successful deletion removes local account caches. Exported backup files are not silently deleted.

## Calendar and student scheduling

### A-12 — Every item type and validation rule

**Environment:** D1 plus domain tests. **Tasks:** T-07/T-13/T-18.

Create/edit/reopen all six item types; exercise optional fields, notes, priority, course links, estimated effort, and five reminders. Try whitespace-only/oversized titles, invalid dates/zones, six reminders, invalid effort, and oversized notes. Save valid Unicode and punctuation.

**Pass:** supported data round-trips, fields are shown only when relevant, invalid commands fail at the desktop boundary as well as the UI, and error handling retains the user's unsaved entries.

### A-13 — Timed, all-day, deadline, and cross-midnight editing

**Environment:** D1. **Tasks:** T-10/T-13/T-18/T-24.

Create a 23:30–00:30 event, one-day and multi-day all-day events, a timed deadline, and a date-only deadline. Move dates and resize timed items; cancel a drag; attempt zero/negative duration. Compare form and direct-manipulation results.

**Pass:** end dates are visible, all-day exclusive ends produce exactly the intended dates, deadlines are not fabricated duration blocks, invalid/canceled changes do not persist, and equivalent edits produce identical data/reminders.

### A-14 — Semester timetable creation

**Environment:** C1. **Tasks:** T-12/T-21.

Create C1 and its lecture/lab patterns from the UI. Inspect previews, first/last occurrences, linked course labels, default room, and break exclusion. Restart and inspect the same timetable.

**Pass:** classes appear only on the defined weekdays within semester bounds, the break's inclusive dates are excluded when selected, separate meeting times do not get mixed, and no manually scheduled assignment/exam is moved by creating the course.

### A-15 — Occurrence versus series edits

**Environment:** C1 plus recurring study sessions. **Tasks:** T-11/T-18/T-24.

Move one lecture to another month, cancel one instance, change one location, and complete one recurring study session. Edit the whole series' title/time. Change a recurrence rule so an exception's original date disappears and exercise each explicit retention/discard choice.

**Pass:** single-instance actions preserve other instances, moved events are found in their effective month, completion remains per occurrence, explicit overrides survive applicable series edits, and orphaned exceptions/history are not silently lost.

### A-16 — Semester changes and archiving

**Environment:** C1 with assignments/exams. **Tasks:** T-12/T-21.

Change semester bounds and break dates; cancel and then accept the impact preview. Archive the course/semester. Attempt to delete a course still referenced by items.

**Pass:** cancellation changes nothing, accepted timetable changes match the preview, unrelated deadlines stay put, archiving preserves data and reminder behavior, and referenced-course deletion is blocked with an archive alternative.

### A-17 — Daylight-saving recurrence

**Environment:** deterministic `America/Toronto` clock fixtures. **Tasks:** T-10/T-11.

Expand a weekly 09:00 class across March 8 and November 1, 2026. Test a recurrence at a nonexistent local time on the spring-transition date and an ambiguous local time on the autumn-transition date. Attempt manual creation of those times.

**Pass:** 09:00 remains 09:00 locally while UTC offsets change; nonexistent recurring instances follow the specified skip policy; ambiguous recurrences choose the earlier occurrence consistently; manual invalid/ambiguous choices receive the defined validation/offset UI.

### A-18 — Month, year, leap-day, and view consistency

**Environment:** deterministic dates and all three calendar views. **Tasks:** T-10/T-11/T-16/T-22.

Render months requiring four, five, and six week rows with Sunday and Monday starts; navigate December/January; schedule February 29, 2028; expand a monthly day-31 series across short months and a yearly February-29 series across leap/non-leap years. Switch Month/Week/Agenda.

**Pass:** cells and adjacent-month dates are correct, nonexistent monthly/yearly dates are skipped, and each view shows the same records at the same effective dates/times.

### A-19 — Day expansion and crowded-day detail

**Environment:** D1 with empty, sparse, and crowded days, including overlaps. **Tasks:** T-17/T-22.

Open a day by mouse and keyboard, select another date, toggle the same date, use +N more, click an event, navigate previous/next day across a week boundary, and close with Escape. Test enough overlapping and all-day items to require scrolling.

**Pass:** exactly one panel is inserted below the selected week, every item is reachable, overlaps remain visible, event clicks do not collapse the day, focus returns to the triggering date, and the month/scroll context is preserved.

### A-20 — Display-zone changes and date-only stability

**Environment:** Toronto, Vancouver, UTC, and a zone east of UTC. **Tasks:** T-10/T-11/T-39.

Create absolute timed events, university-zone recurring classes, all-day records, and date-only deadlines. Change the effective display zone; enable/disable follow-computer-zone; restart; explicitly edit a series' zone and inspect its preview.

**Pass:** absolute instants are unchanged by display settings, recurring schedules retain their source zone, date-only values do not drift to adjacent dates, and an intentional schedule-zone edit is visibly distinct from a display preference change.

### A-21 — Task completion, unscheduled work, and sidebar content

**Environment:** D1 with each item type, all priorities, and unscheduled tasks. **Tasks:** T-13/T-19/T-20.

Populate today through seven days from today plus overdue items. Include classes/general events, assignments, exams, study sessions, personal tasks, completed tasks, date-only tasks, and no-date tasks. Complete and undo from the sidebar; open a title; schedule study time from an assignment.

**Pass:** only intended task types enter the seven-day list, no-date work appears in Unscheduled, completed tasks leave the open list without disappearing from history, overdue rows are not duplicated, the checkbox does not navigate, and linked study creation leaves the assignment deadline unchanged.

### A-22 — Exact seven-calendar-day boundary and midnight rollover

**Environment:** controlled clock, including DST and year boundary. **Tasks:** T-10/T-19.

At December 29, 2026, include items through January 4, 2027 and exclude January 5. Repeat across a DST change, at local midnight, after sleep spanning midnight, with timed deadlines just before/at/after now, and with date-only deadlines ending at their next local midnight. Browse an unrelated month and change only calendar course filters.

**Pass:** the list follows today plus six dates rather than a fixed 168 hours, updates without restart, applies the specified overdue boundary, and does not accidentally follow the browsed month or unrelated calendar filters.

## Offline behavior and synchronization

### A-23 — Offline create/edit/delete/relaunch

**Environment:** D1 with a previously authenticated account. **Tasks:** T-08/T-28/T-41.

Disconnect, create and edit a course/event/task, cancel an occurrence, complete a task, delete an event, and restart. Reconnect and observe queue delivery.

**Pass:** local operations and local reminders continue, all changes survive restart, offline status is explicit, and each change eventually reaches the cloud without requiring manual re-entry.

### A-24 — Initial and incremental two-device sync

**Environment:** D1/D2 and live cloud. **Tasks:** T-27/T-29/T-32.

Create a representative account on D1 including semester, courses, recurrence exceptions, completion, and preferences. Sign into D2; compare data; edit each supported record kind; observe foreground/tray convergence and sync timestamps.

**Pass:** D2 retrieves equivalent data, incremental changes converge within the controlled-test bounds, only device-independent settings sync, and neither UI reports Synced before acknowledgment.

### A-25 — Simultaneous conflicting edits

**Environment:** D1/D2 with the same base record. **Tasks:** T-05/T-28/T-30.

Disconnect both devices; change the same event's time differently; reconnect in each order. Repeat with task completion versus another edit. Inspect stored base/local/remote values and each resolution option.

**Pass:** stale changes do not silently overwrite, both proposals remain recoverable, conflict UI shows the actual versions, and the explicit resolution converges on both devices.

### A-26 — Lost response, duplicate retry, and queued edit chain

**Environment:** deterministic cloud fault injection and emulator/live proof. **Tasks:** T-05/T-28.

Drop a response after the cloud commit succeeds; retry with the same mutation ID; edit the item again before receipt recovery; restart at each network boundary; retry an atomic multi-record group.

**Pass:** one logical operation is recorded once, its immutable receipt resolves uncertainty, subsequent edits retain their new values, and no partial atomic group is visible.

### A-27 — Concurrent pagination and pull-cursor recovery

**Environment:** more changed records than one pull page, D1/D2. **Tasks:** T-05/T-29.

Begin a pull with high-water sequence N. Update records on D2 before and after page boundaries, including an already-read record and a not-yet-read record advancing above N. Crash D1 before and after page application and cursor advancement.

**Pass:** replay is harmless, no completed cursor skips an unseen committed change permanently, records moved above N are retrieved on the next pass, and local pending proposals remain intact.

### A-28 — Delete/edit conflict and long-offline tombstone

**Environment:** D1/D2 with old offline state. **Tasks:** T-29/T-30.

Delete an item on D1 and edit its stale copy offline on D2. Reconnect D2 after advancing the test clock beyond normal reminder-history retention. Exercise Keep deleted and Restore as new item.

**Pass:** the old edit cannot resurrect the tombstoned ID, the user can explicitly preserve the proposal under a new ID, and deleted reminders are canceled when each device receives the deletion.

### A-29 — Resolution race and cross-record independence

**Environment:** D1/D2. **Tasks:** T-30.

Open a conflict on D1, change its remote version again from D2, and then resolve on D1. Separately edit different records at the same time, including distinct occurrence-state records.

**Pass:** resolving against a stale remote version surfaces a new conflict without losing the proposal; independent record edits converge without an unnecessary user conflict simply because the sync-head sequence raced.

### A-30 — Quota, authentication, network, and permanent errors

**Environment:** controlled response faults and measured live session. **Tasks:** T-28/T-29/T-32/T-41.

Simulate offline, timeouts, temporary server errors, quota exceeded, permission denied, unknown schema, expired token, and revoked session. Observe retry timing and issue Sync now repeatedly. Confirm no billing configuration is modified.

**Pass:** local data remains usable/saved, transient errors back off, overlapping polls are prevented, one token refresh handles concurrent expiry, permanent errors do not spin indefinitely, and quota failures never auto-upgrade a paid plan.

## Native reminders and desktop lifecycle

### A-31 — Visible-window and tray-only native reminder

**Environment:** installed D1, real Windows notifications enabled, computer awake. **Tasks:** T-03/T-33–T-35/T-43.

Schedule a near-future reminder while visible, then another while hidden in the tray. Click each notification. Repeat after restarting the installed app and on a day containing recurring and all-day items. Measure scheduler submission timing separately from the operating system's visual rendering.

**Pass:** the app submits the notification within five seconds of the due instant in controlled conditions, displays the correct identity/content, and clicking it brings the existing app forward to the right item without a second instance.

### A-32 — Save, reschedule, complete, and duplicate suppression

**Environment:** controlled clock plus installed D1. **Tasks:** T-14/T-33/T-34.

Edit an item's title after its reminder emits; change its time to a future trigger; complete/reopen it; delete/cancel it; save the same reminder rule repeatedly; restart before and after dispatch.

**Pass:** text-only edits do not re-arm emitted reminders, valid future timing changes do, completion/cancellation removes pending work, reopening does not replay past triggers, and identity-based deduplication survives normal restart.

### A-33 — Real sleep/resume and catch-up aggregation

**Environment:** installed D1 with actual Windows sleep/resume. **Tasks:** T-33/T-34/T-43.

Sleep across one reminder and then across more than three reminders. Include a still-future event, an ongoing event, an incomplete deadline, a finished past event, and a reminder older than 24 hours. Resume with and without the window visible.

**Pass:** eligible recent missed reminders follow the defined catch-up policy; a large set produces one summary; finished old events do not create a storm; history remains accessible; no claim is made that sleeping-time reminders appeared on time.

### A-34 — Crash during notification dispatch

**Environment:** injectable scheduler/native-notification boundary. **Tasks:** T-33/T-34.

Terminate after persisting `dispatching` but before confirmed submission, and after operating-system submission but before persisting `emitted`. Relaunch each fixture. Inject a native notification failure.

**Pass:** uncertain reminders are represented honestly in the inbox without automatic duplicate popups; definite failures are labeled failed; the application never claims guaranteed exactly-once visual delivery across a crash.

### A-35 — Snooze, notification activation, and remote completion

**Environment:** D1/D2 and controlled clock. **Tasks:** T-33/T-34.

Snooze for each supported interval; restart before the snoozed time; move/delete the item before clicking an old notification; complete the item on D2; dismiss a toast without completing the task.

**Pass:** snoozes persist, activation resolves the current item or useful history fallback, synced completion cancels future local reminders, and dismissing a toast never changes completion state. Independent offline devices may each notify as documented.

### A-36 — Quiet hours, privacy, and operating-system suppression

**Environment:** D1 with real Windows suppression and controlled logical time. **Tasks:** T-33/T-34/T-39.

Configure quiet hours that cross midnight; trigger several reminders; exit quiet hours; enable generic privacy text; disable Windows notifications/enable Do Not Disturb; use Test notification.

**Pass:** quiet hours suppress banners but preserve inbox entries, one relevant summary appears afterward, privacy mode hides event details, and Windows suppression is respected without incorrectly labeling the reminder as seen by the user.

### A-37 — Optional login startup

**Environment:** installed D1 and actual Windows sign-out/sign-in or restart. **Tasks:** T-26/T-35.

Verify the default is off. Enable startup, sign in to Windows again, check tray-only launch, disable startup, and repeat. Disable the entry through Windows settings and inspect the app's displayed status. Upgrade the app and repeat the enabled case.

**Pass:** startup is opt-in, uses the stable installed launcher, opens quietly, respects Windows-disabled status, and never creates duplicate or development-path entries.

### A-38 — Close, explicit Quit, and relaunch

**Environment:** installed D1. **Tasks:** T-35/T-43.

Close to tray, reopen from tray, choose Quit, wait across a test reminder, and relaunch. Repeat with close-to-tray disabled and with the second-instance launch path.

**Pass:** close-to-tray preserves reminder service; Quit exits completely; no reminder is promised while quit; relaunch applies catch-up; unsent local changes remain durable; a second launch focuses the existing instance.

## Calendar files and backups

### A-39 — Representative calendar import

**Environment:** controlled `.ics` fixtures generated independently of the app. **Tasks:** T-36.

Import ordinary VEVENTs, VTODOs, all-day dates, UTC and named-zone times, cross-midnight durations, RRULE/RDATE/EXDATE, cancellation, and RECURRENCE-ID overrides. Include Unicode, folded lines, escaped punctuation, and events crossing a DST boundary.

**Pass:** the preview's counts/dates/times match the eventual records and supported recurrence/exception meaning is preserved. Notes remain plain text and no invitation or email is sent.

### A-40 — Duplicate import, changed UID, and safe undo

**Environment:** D1 with import history and subsequent edits. **Tasks:** T-36/T-37.

Import a file twice; modify its content while preserving a UID; choose update and skip in separate cases; edit an imported item afterward; undo the original import batch.

**Pass:** identical content does not duplicate, changed content requires the explicit selected behavior, stable mappings survive restart, and undo does not erase a subsequent user/remote edit without showing a conflict.

### A-41 — Unsupported zones, floating times, and complex recurrence

**Environment:** fixtures containing floating times, custom VTIMEZONE, and more than one occurrence per local date. **Tasks:** T-36.

Inspect unsupported-component reporting; choose a time zone for floating times; perform a deliberate finite-range conversion where available; cancel or skip unsupported entries.

**Pass:** unsupported semantics are identified before save, conversion clearly states its finite date range, no unlimited future fidelity is implied, and skipping/canceling leaves unrelated data intact.

### A-42 — Malformed/oversized input and cancellation

**Environment:** malicious-format and resource-limit fixtures in a disposable account. **Tasks:** T-36/T-45.

Import oversized files, excessive component/occurrence counts, invalid dates, control characters, script-like notes, invalid links, and deeply expensive recurrence data. Cancel a long-running parse before commit. Exercise an import failure after staging.

**Pass:** limits are enforced without freezing the UI or executing content; cancel-before-commit leaves no imported domain records; validation failure cannot corrupt existing data; any already committed resumable batch is identified accurately and recoverable through its batch record.

### A-43 — Calendar export and interoperability

**Environment:** representative native/imported fixture and an independent parser/client. **Tasks:** T-37.

Export all records and a filtered date/course subset. Reparse with a separate parser or inspect in a supported external calendar client. Verify time-zone semantics, exclusive all-day ends, Unicode/escaping/line folding, stable UIDs, recurrence exceptions, and the documented deadline representation.

**Pass:** the file is valid and preserves the supported calendar meaning; the UI labels calendar export separately from full backup; unsupported application-only fields are not falsely claimed to be universally supported by other clients.

### A-44 — Backup, validation, and restoration

**Environment:** clean and populated D1/D2/U1/U2 databases. **Tasks:** T-09/T-38.

Export a full backup, inspect exclusions, restore into a clean same-account profile and a different account, test a populated-account conflict, and attempt corrupted/oversized/future-schema backups. Fail the restore halfway in the test adapter.

**Pass:** logical records, links, exceptions, and completion are retained; cross-account IDs are remapped coherently; tokens/device-delivery journals/cloud cursors are absent; invalid backups do not partially alter the database; restoration enters the ordinary sync path with a recoverable pre-restore snapshot.

## UX, resources, security, and release

### A-45 — Visual and interaction acceptance

**Environment:** installed D1 at 1440 × 900, 1200-wide boundary, and 900 × 640, plus high Windows scaling. **Tasks:** T-15–T-24/T-39/T-42.

Review empty/populated/crowded month views, inline day expansion, sidebar and narrow-screen drawer, all forms, search, conflict/recovery screens, and loading/error states. Verify naming, exact design-token intent, today/selected markers, overflow counts, and the absence of sample production data.

**Pass:** the interface is recognizably black/purple, events sit beneath their dates, expanded detail and seven-day tasks remain reachable, no important text/control clips, and screen states tell the truth about saved/synced/reminder status.

### A-46 — Keyboard, screen reader, contrast, and zoom

**Environment:** Windows Narrator, keyboard-only input, automated accessibility tooling. **Tasks:** T-15/T-17/T-23/T-42.

Complete sign-in, calendar navigation, day expansion, event creation/edit, task completion, recurrence selection, and settings without a mouse. Review focus traps/restoration, dialog labeling, grid reading order, form errors, reduced motion, contrast, and 200% zoom.

**Pass:** every critical action is reachable with an understandable name/state, no keyboard trap occurs, documented contrast ratios are met, and zoom does not make controls unreachable. Record both automated findings and manual observations.

### A-47 — Responsiveness and large-data behavior

**Environment:** named baseline machine with P1. **Tasks:** T-23/T-32/T-44.

Measure at least ten cold starts and repeated month/day navigation, saves, and searches; report median and slowest observed result rather than only the fastest. Run a large import while using navigation, cancel it, and search a bounded date range containing long-running series.

**Pass:** target latencies in the product plan are met under the recorded conditions, long jobs do not block normal UI interaction, and recurrence expansion/search remain bounded. Retain measurement data with the release report.

### A-48 — Idle resource use and cloud operation budget

**Environment:** baseline D1/D2, P1 plus a realistic smaller student account. **Tasks:** T-32/T-44.

Observe five minutes idle in foreground and tray, then a representative session with edits, imports, reconnects, and two-device activity. Record CPU/memory/network/poll counts, read/write/receipt/head overhead, installer size, and current free-tier quotas.

**Pass:** average idle CPU is below the target, polling does not overlap or exceed its defined cadence, the report provides measured rather than invented resource/capacity figures, and no paid service/billing change is introduced.

### A-49 — Authorization and desktop attack boundaries

**Environment:** emulator/rule tests, disposable live account, packaged artifact inspection. **Tasks:** T-05/T-07/T-27/T-31/T-45.

Attempt unauthenticated/unverified/cross-UID reads and writes; forged owner/type/schema/version/head/receipt combinations; oversized cloud fields; unauthorized hard deletion; unknown IPC commands; untrusted navigation; script/file URLs; token leakage through logs/backups; and malformed imported text. Inspect packaged credentials and renderer security settings.

**Pass:** unauthorized operations are denied at the correct boundary, rules enforce the allowed atomic shapes and access limits, private administrative credentials are absent, UI content cannot execute native code through a generic bridge, and session secrets are not persisted in plaintext.

### A-50 — Upgrade, uninstall, and data preservation

**Environment:** installed prior-build fixture and release candidate. **Tasks:** T-09/T-35/T-46.

Seed accounts, queued offline edits, settings, exceptions, and reminder state in the prior build. Upgrade with the new installer; verify migration and startup/shortcut paths; uninstall; inspect retained data and removed binaries/registration; reinstall and sign in.

**Pass:** the upgrade preserves records and local queue state, a migration snapshot exists, shortcuts/startup target the new installed launcher, uninstall removes app registration without silently deleting calendar data, and reinstall can recover the documented retained data.

### A-51 — Published platform compatibility matrix

**Environment:** each Windows/architecture combination claimed in release notes. **Tasks:** T-46.

On each claimed target, run installation, launch, local persistence, both sign-in paths, tray notification, and upgrade smoke checks. Record OS edition/build, architecture, installer architecture, and exact outcomes. If no Windows 10 or ARM environment exists, mark that target not run.

**Pass:** every advertised target has evidence; Windows 10, Windows ARM, macOS, and Linux support is not inferred from a Windows 11 x64 development run. Untested systems are excluded from the supported list.

### A-52 — Final handover completeness

**Environment:** release artifacts and documentation. **Tasks:** T-47/T-48.

Reconcile R-01–R-14 with completed tasks and actual tests. Verify the downloadable installer opens, checksum matches, source/lockfile/build instructions exist, external cloud ownership/configuration is documented, and user guidance covers persistence, reminders, sync, import/backup, and recovery.

**Pass:** the handover distinguishes tested functionality from unavailable/not-run dependencies, provides the real installer, identifies unsigned/public-hosting status accurately, lists known limitations, and does not call a mock sign-in or local demo a completed cloud-enabled app.

## Release report format

Create `docs/RELEASE_VERIFICATION.md` during implementation. For each A-ID, include actual result, environment/build, evidence reference, defect reference if any, and retest outcome. Include a separate tested-platform table and the actual free-tier operation measurements. Do not prefill results with “pass.”

Block release for acknowledged-data loss, cross-account disclosure, an unusable installer on the primary target, broken required sign-in/sync, incorrect core recurrence/time-zone handling, or reminders that fail the agreed awake/tray contract. For an unavailable external environment, preserve the not-run status and identify the exact dependency needed to finish verification.
