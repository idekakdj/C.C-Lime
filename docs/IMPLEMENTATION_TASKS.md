# C.C. Lime — implementation task register

**Current per-task status and evidence:** [implementation evidence](IMPLEMENTATION_STATUS.md). These descriptions remain the original completion criteria; implemented code does not imply every acceptance check has passed. **Baseline:** [project specification v1.0](../PROJECT_PLAN.md). **Verification:** [acceptance scenarios](ACCEPTANCE_TESTS.md).

Execute dependencies in order. Work that depends on external account setup may remain blocked while independent local tasks continue. A task is complete only when its stated output exists and its completion check has been performed. Keep a short evidence entry under each task during implementation: status, changed files, commands/manual checks performed, result, and unresolved defects.

These paths were planned before implementation. The workspace is now a GitHub clone with application source and tests; the evidence register records actual implementation and gaps.

## Phase 0 — establish the baseline and prove risky integrations

### T-01 — Record requirements and create the project structure

**Depends on:** the owner's answered questions. **Covers:** R-01–R-14.

Create the requirements baseline, task register, and acceptance specification. During implementation, establish `src/main`, `src/preload`, `src/renderer`, `src/domain`, `src/shared`, `tests`, `cloud`, and `docs` boundaries. Add a README describing the application, supported development environment, and development/build/check entry points. Set the display name to C.C. Lime and the internal package name to `cc-lime`. If source control is initialized, exclude user data, secrets, generated installers, and caches before the first commit.

**Complete when:** every confirmed requirement has an implementation owner task and at least one acceptance scenario; source layout and naming have no unresolved collisions. The planning documents can be reviewed before application scaffolding begins.

### T-02 — Pin the desktop toolchain and produce a minimal installer

**Depends on:** T-01. **Covers:** R-01/R-02. **Checks:** A-01/A-50.

Verify the current supported stable Electron/Forge/React/TypeScript/Vite versions and their compatibility with the available Node runtime. Record exact versions in the lockfile. Configure development, type checking, unit tests, production bundling, packaging, and installer creation. Create a minimal packaged window with local assets, a stable app ID, production metadata, and a bundled icon. Exclude credentials and development fixtures from packaging.

**Complete when:** a Windows installer is created and installed under a standard Windows account, launches without a terminal/dev server, and reports the expected product name/version. Record installer size and the runtime version. Do not postpone packaging proof until the end.

### T-03 — Prove native database and notification operation in the installed app

**Depends on:** T-02. **Covers:** R-03/R-06. **Checks:** A-02/A-31.

Add the selected SQLite binding, confirm the native binary is correctly rebuilt or supplied for the pinned Electron ABI, and create/read a small database in the app-data directory. Add a native notification and click handler, tray icon, and single-instance lock. Verify Start Menu/notification identity registration and installation lifecycle handling.

**Complete when:** the installed app persists a record over quit/relaunch, shows a native notification, opens its existing window on notification click, and avoids a second writer on a second launch. If the binding fails, resolve the binding/runtime choice and record it before T-08; do not fall back to nondurable in-memory data.

### T-04 — Prove both live authentication methods and protected session recovery

**Depends on:** T-02 and an owner-controlled Firebase/Google configuration. **Covers:** R-04/R-05/R-13. **Checks:** A-06–A-10.

Document the free-project setup and configure email/password, Google, test audience, desktop OAuth client, provider client allowlist, and managed email actions. Implement a small main-process proof of email sign-in and Google system-browser PKCE exchange. Confirm the desktop client's token audience is accepted by Firebase. Store a Firebase refresh token using OS-backed encryption and restore it after relaunch. Test expired/invalid state, user cancellation, and callback cleanup.

**Complete when:** real email/password and Google identities each obtain a Firebase session and survive an encrypted-session restart. Emulator success alone is insufficient. If owner setup is unavailable, record this task as externally blocked and continue independent UI/domain tasks using labeled test adapters.

### T-05 — Prove atomic, authorized, idempotent cloud mutations

**Depends on:** T-04 for live verification; emulator proof can begin after T-02. **Covers:** R-04/R-13. **Checks:** A-24–A-30/A-49.

Define Firestore paths, record envelopes, the per-user sync head, immutable mutation receipts, and rule validation. Implement the REST commit/precondition proof. Use at most four domain records plus one head and one receipt per atomic group; prove this exact shape fits rule access limits. Create the required query indexes. Simulate concurrent writers, a lost response, duplicate receipt lookup, stale version, and an unauthorized user.

**Complete when:** duplicate submission causes one logical mutation, a lost response is recovered by receipt, stale edits cannot overwrite, sequence-based pull sees all committed changes, and forged cross-account requests fail. Record the tested request/response shapes in `docs/SYNC_PROTOCOL.md`. Do not begin the production sync engine before these invariants pass.

## Phase 1 — data, calendar correctness, and recovery

### T-06 — Establish deterministic test fixtures and clocks

**Depends on:** T-02. **Covers:** all logic-heavy requirements.

Set up a controllable clock, two isolated device identities/databases, synthetic accounts, recurrence fixtures, daylight-saving dates, corrupted/old-schema database fixtures, and malformed calendar files. Separate test data from production accounts and packaging. Define fixture builders with explicit dates/time zones instead of using the real current date implicitly.

**Complete when:** tests run repeatably in a fixed time zone and deliberately varied time zones, device A cannot read device B's local test folder, and advancing the test clock requires no real multi-minute sleeps.

### T-07 — Define shared record schemas and command contracts

**Depends on:** T-06. **Covers:** R-03/R-11/R-12. **Checks:** A-12/A-13/A-49.

Implement types and runtime validation for semesters, courses, item timing variants, recurrence, exceptions, per-occurrence completion, reminder rules, preferences, queue records, and conflicts. Enforce the specification's title/notes/time/date/array limits. Define typed success/error responses and an allowlisted command API; distinguish saved-locally from synced.

**Complete when:** invalid timing variants, negative durations, oversized input, cross-account references, invalid UUIDs, and unsupported schemas fail with field-specific errors. Domain code has no dependency on a React component or Electron window.

### T-08 — Implement the durable local repository and outgoing queue

**Depends on:** T-03/T-07. **Covers:** R-03/R-04. **Checks:** A-02–A-05/A-23.

Create the database schema and indexes. Use per-account app-data locations, a single writer, transactions, foreign-key checking, and WAL. Implement entity repositories and atomic domain-plus-outbox mutations. Preserve an immutable in-flight payload and sequence later edits to the same entity. Expose local counts and safe pagination rather than sending the entire database to every UI component.

**Complete when:** killing the process after a save acknowledgment preserves both the item and queued mutation; failed commits show an error and do not claim success; repeated local edits preserve ordering and can be recovered on restart.

### T-09 — Implement migration, daily snapshots, and recovery

**Depends on:** T-08. **Covers:** R-03/R-12. **Checks:** A-04/A-44/A-50.

Add versioned migrations, pre-migration snapshots, once-per-day snapshots before the first mutation, retention cleanup, and a recovery screen. Use SQLite's supported consistent backup mechanism rather than copying a live WAL database incompletely. Verify destination files before replacing a live database. Preserve the damaged or old file when recovery fails.

**Complete when:** a seeded earlier schema upgrades with all records intact; an injected migration failure restores or preserves the old database; corrupt/full-disk/unwritable-directory scenarios leave recoverable data and actionable UI.

### T-10 — Implement date and time primitives

**Depends on:** T-06/T-07. **Covers:** R-08–R-11. **Checks:** A-17–A-20/A-22.

Implement local dates, inclusive/exclusive ranges, zone-aware conversion, ambiguous/nonexistent local-time handling, formatting, all-day ranges, the seven-calendar-day window, and due/overdue calculation. Make the effective display zone explicit in each query. Keep recurring wall-clock times separate from absolute instants.

**Complete when:** leap days, month/year boundaries, both DST transitions, dates west/east of UTC, and midnight sidebar rollover match the test specification. No domain date-only path relies on `new Date(dateString)` or fixed-millisecond “next day” arithmetic.

### T-11 — Implement bounded recurrence and exceptions

**Depends on:** T-08/T-10. **Covers:** R-11/R-12. **Checks:** A-15–A-20.

Implement native recurrence presets, semester bounds, excluded dates, stable original-date occurrence keys, cancellations, moved overrides, and per-instance completion. Index overrides by effective dates so moves across months are visible. Implement entire-series edit previews and the explicit handling of exceptions no longer generated by a changed rule.

**Complete when:** all supported recurrence fixtures match expected occurrences, unbounded series expand only within a requested horizon, one-instance edits preserve the series, and moved/completed instances retain their identity over restart and sync serialization.

### T-12 — Implement semester and course operations

**Depends on:** T-08/T-11. **Covers:** R-11. **Checks:** A-14/A-16.

Create/edit/archive semesters and courses, inclusive break ranges, default room/instructor/color, and separate lecture/lab patterns. Validate semester bounds and referenced records. Changing semester bounds or breaks produces a date-impact preview for linked class patterns and leaves independent assignments/exams unchanged.

**Complete when:** two meeting patterns generate the expected timetable, breaks are applied only after the stated choice, archives preserve records/reminders, and deleting a referenced course cannot orphan its data.

### T-13 — Implement item and task operations

**Depends on:** T-08/T-11/T-12. **Covers:** R-08/R-11. **Checks:** A-12/A-13/A-21.

Implement create/edit/duplicate/delete/restore, completion states, linking a study session to an assignment, date-only and unscheduled tasks, and task priorities. Preserve course/semester associations on duplicate unless changed. Implement Undo as a real compensating mutation, including handling a remote change that arrives before undo.

**Complete when:** every item type round-trips through local persistence, completion affects only the intended item/occurrence, and Undo cannot overwrite a newer edit without conflict handling.

### T-14 — Implement reminder-rule calculations

**Depends on:** T-10/T-11/T-13. **Covers:** R-06. **Checks:** A-31–A-36.

Compute default and custom reminder anchors for timed, all-day, and due-only records. Assign stable rule IDs, enforce the five-reminder and 30-day limits, and calculate schedule revisions only for timing/reminder changes. Define cancellation on completion/deletion and future-only re-arming on reopening/rescheduling.

**Complete when:** due instants match fixtures, title-only edits cannot duplicate a sent reminder, and DST/date-only anchor behavior is deterministic.

## Phase 2 — black/purple calendar and student workflows

### T-15 — Build the accessible application shell and theme

**Depends on:** T-02/T-07. **Covers:** R-01/R-07/R-14. **Checks:** A-45/A-46.

Create design tokens, typography, buttons, form fields, dialogs, toasts, empty/error/loading states, and navigation. Implement the normal and narrow layouts, sidebar drawer, reduced motion, and keyboard focus behavior. Use local font/icon assets or system fonts without a runtime CDN dependency.

**Complete when:** the C.C. Lime shell works offline, matches the black/purple palette, fits the minimum window size, and its core controls have labels, visible focus, and validated contrast.

### T-16 — Build the month grid and event rows

**Depends on:** T-10/T-11/T-13/T-15. **Covers:** R-08. **Checks:** A-18/A-45.

Implement four/five/six-week layouts, Monday/Sunday preference, adjacent-month days, today marker, date navigation, sorted event rows, deadline labeling, completion styling, course/type labels, and overflow counts. Connect it to real local queries. Do not seed fake student records into production.

**Complete when:** every fixture month renders the right dates, all records appear on the right day, overflow counts are exact, and keyboard date movement does not change user data.

### T-17 — Build inline day expansion

**Depends on:** T-16. **Covers:** R-09. **Checks:** A-19/A-45.

Insert the selected-day panel immediately below its week row. Include previous/next day, collapse, add, all-day/deadline groups, overlapping timed layout, chronological list alternative, and internal scrolling. Control event propagation so item clicks and checkboxes do not toggle the day. Preserve focus and scroll context.

**Complete when:** only one panel is open, the same-day action collapses it, different-day selection replaces it, event details open correctly, and mouse/keyboard/screen-reader paths can reach all entries.

### T-18 — Build the event/task editor and detail view

**Depends on:** T-13/T-15/T-17. **Covers:** R-08/R-11. **Checks:** A-12/A-13/A-15/A-21.

Implement type selection, title, course, date/time/zone, all-day mode, repeat settings, location/notes, reminders, status, priority, estimated effort, and study links. Show fields only when relevant. Include recurrence edit-scope choice, overlap warnings, field-level errors, unsaved-change handling, and reliable save feedback.

**Complete when:** all item types can be created and edited entirely through the UI, invalid fields keep their values for correction, and cancellation never creates a phantom item.

### T-19 — Build the next-seven-days sidebar

**Depends on:** T-10/T-13/T-15/T-18. **Covers:** R-10. **Checks:** A-21/A-22.

Implement independent all-course filtering, overdue separation, exact seven-calendar-date groups, priority tie-breaking, complete/undo controls, task-count badge, empty states, and optional Next event card. Subscribe to local and synced changes and clock/zone/resume events. Keep the range tied to today while browsing other months.

**Complete when:** the test fixture produces exactly the expected tasks with no duplicate overdue entries; completion and midnight updates appear without restarting the app.

### T-20 — Build the Tasks screen

**Depends on:** T-13/T-15/T-18. **Covers:** R-11/R-14. **Checks:** A-21.

Provide Open, In progress, Completed, and Unscheduled filters; course/type/priority filtering; due-date ordering; task detail/edit; quick completion; and Schedule study time. Persist user filter preference only as a device preference unless explicitly designated synced.

**Complete when:** tasks without a due date are discoverable, completed items remain recoverable, and creating a linked study session never alters the assignment deadline automatically.

### T-21 — Build Courses & Semesters screens

**Depends on:** T-12/T-15/T-18. **Covers:** R-11. **Checks:** A-14/A-16.

Implement semester/course editors, break management, lecture/lab pattern creation with occurrence previews, archive visibility, and impact previews for timetable changes. Show class count and date span before applying a recurring pattern.

**Complete when:** a student can build an entire semester timetable without opening a developer tool and can inspect exactly which dates a break/bounds edit changes.

### T-22 — Build Week and Agenda views

**Depends on:** T-16/T-17/T-18. **Covers:** R-11/R-14. **Checks:** A-18/A-19/A-45.

Reuse the domain occurrence queries and detail/editor components for a seven-day timetable and a paged agenda. Include all-day/deadline sections, overlap layout, today navigation, accessible chronological order, and view persistence. Loading another agenda page extends the date window, not the stored recurrence.

**Complete when:** switching views shows the same items and timings and a long recurring series cannot create an unbounded render.

### T-23 — Build search, filters, and keyboard shortcuts

**Depends on:** T-15/T-18/T-22. **Covers:** R-14. **Checks:** A-45/A-47.

Add indexed/efficient text search with explicit date ranges, series results, course/type filters, Ctrl+N/Ctrl+F/Ctrl+T, calendar navigation, and Escape layering. Include “no results” and a clear-filters action. Restore focus after closing search or a result detail.

**Complete when:** title/code/location/note searches return expected records within the requested range, shortcuts do not hijack text editing, and queries meet the specified latency on the performance fixture.

### T-24 — Add direct movement and resizing with equivalent form controls

**Depends on:** T-18/T-22. **Covers:** R-14. **Checks:** A-13/A-15/A-45.

Implement date movement in month view and 15-minute-snapped movement/resizing in week/day views. Preserve duration and intended local time semantics. Deadline-only records cannot be resized. A recurring move opens the scope selector before committing; Escape cancels a drag. Announce the resulting time to assistive technology.

**Complete when:** direct manipulation and form editing produce identical domain commands, and canceled/invalid moves do not mutate records or reminders.

## Phase 3 — accounts and reliable synchronization

### T-25 — Implement the production authentication/session service

**Depends on:** T-04/T-07/T-08. **Covers:** R-04/R-05. **Checks:** A-06–A-11.

Promote the authentication proof into a typed service: signup, verification state refresh, sign-in, reset, serialized token refresh, secure persistence, expiration/revocation, Google cancellation, account linking, and sign-out. Validate network responses, redact logs, and avoid duplicate in-flight account operations.

**Complete when:** all authentication states have defined transitions; a failed refresh cannot corrupt the stored token; relaunch preserves the correct UID; no password/token reaches the renderer's durable storage.

### T-26 — Build authentication and onboarding screens

**Depends on:** T-15/T-25. **Covers:** R-05/R-06/R-11. **Checks:** A-06–A-09/A-37.

Build signup/sign-in, Google progress/cancel, verify-email prompt, forgot-password, provider-linking recovery, and startup setup for time zone, week start, reminders, startup preference, and first semester. Onboarding is resumable and skippable after required account steps; optional fields must not block calendar access.

**Complete when:** both sign-in paths lead to the right account, verification requirements are clear, disabled/unavailable cloud configuration is labeled honestly, and initial optional choices can be changed later.

### T-27 — Implement the cloud record adapter and authorization rules

**Depends on:** T-05/T-07/T-25. **Covers:** R-04/R-13. **Checks:** A-24/A-49.

Implement Firestore REST serialization, Firebase-token authorization, bounded page queries, write preconditions, receipts, sync-head updates, server timestamp handling, error classification, and safe timeouts. Keep indexes/rules/versioned schema in `cloud`. Enforce supported schema compatibility so an older app cannot rewrite an unknown newer record.

**Complete when:** the adapter passes emulator contract/rule tests and a live minimal create/read/update/tombstone cycle without administrative client credentials.

### T-28 — Implement outgoing synchronization and retry recovery

**Depends on:** T-08/T-27. **Covers:** R-03/R-04. **Checks:** A-23/A-25/A-26/A-30.

Drain the durable queue in account order; keep at most one operation in flight; recover ambiguous commits by receipt; rebase unsent chained edits after acknowledgments; enforce safe retry/backoff; and distinguish permanent errors from transient failures. Retain local changes after all network/provider errors.

**Complete when:** process termination before/after every network boundary produces eventual one-logical-change results, and multiple edits made during a slow push survive in order.

### T-29 — Implement incoming synchronization and cursor recovery

**Depends on:** T-27/T-28. **Covers:** R-04. **Checks:** A-24/A-27/A-28/A-30.

Implement initial/full and incremental sequence queries, high-water bounds, stable pagination, referenced-record fetching, remote shadows, tombstones, restartable page application, and cursor advancement only after a completed pass. Add foreground/tray/reconnect/resume polling schedules without overlapping requests.

**Complete when:** two devices converge after edits/deletions/reconnect; page-boundary updates are not lost; local pending proposals are not overwritten by a pull; and polling counts match the resource budget.

### T-30 — Implement conflict detection and resolution UI

**Depends on:** T-15/T-28/T-29. **Covers:** R-04. **Checks:** A-25/A-27–A-29.

Store base/local/remote values, expose a Needs review indicator, and build the comparison dialog with Keep mine, Use cloud, Keep both, and deletion-specific choices. Apply a resolution against a checked remote version; keep the proposal if another conflict races the resolution. Recalculate local reminders after a resolved timing/status change.

**Complete when:** conflicting edits and edit/delete races preserve all proposals until a choice is made; Keep both receives a new ID and does not duplicate the old record's delivery history.

### T-31 — Implement account isolation, switching, and deletion

**Depends on:** T-25/T-29/T-30. **Covers:** R-04/R-05. **Checks:** A-10/A-11/A-49.

Switch the active database only after UID validation; clear visible prior-account state; stop old schedulers and requests; preserve pending changes when signing out; and implement explicit local-data removal. Implement resumable online account deletion with recent authentication, a deletion marker, cloud-data verification before identity deletion, and local cleanup afterward.

**Complete when:** another account never sees the previous account's content, offline sign-out preserves unsynced work without allowing unauthenticated re-entry, and interrupted account deletion resumes safely.

### T-32 — Integrate sync status, repair information, and usage measurement

**Depends on:** T-19/T-28–T-31. **Covers:** R-04/R-13/R-14. **Checks:** A-24/A-30/A-47.

Expose accurate saved/syncing/synced/offline/verification/error/conflict states with last-success time, pending count, and Sync now. Add redacted diagnostics and network-operation counters for release testing. Measure a representative two-device session and estimate free-tier pilot capacity using current project-wide quotas.

**Complete when:** local saves are never mislabeled cloud-synced, user-facing errors explain whether work is safe locally, and the measured cost model includes head/receipt/rule reads and writes.

## Phase 4 — reminders, file interchange, and settings

### T-33 — Implement the durable main-process scheduler

**Depends on:** T-03/T-08/T-14/T-29. **Covers:** R-06. **Checks:** A-31–A-36.

Implement bounded occurrence scheduling, nearest-due timer, reconciliation watchdog, journal transitions, suppression, uncertain dispatch recovery, rescheduling, cancellation, and pruning. Subscribe to lifecycle/time changes and local/remote mutations. Ensure only the active account's scheduler runs.

**Complete when:** due reminders are processed without a visible renderer window, completion/deletion cancels them, and restart/crash tests match the documented delivery-uncertainty policy.

### T-34 — Implement notification presentation and reminder inbox

**Depends on:** T-15/T-18/T-33. **Covers:** R-06/R-14. **Checks:** A-31–A-36.

Create native notification content, privacy-mode text, item activation, inbox history, snooze controls, completion action, delivery-error state, and quiet-hours/catch-up summaries. Escape or dismissing a native toast must not mark its task complete.

**Complete when:** a notification opens the correct current item, deleted/moved items have a useful fallback, snooze persists, and the inbox distinguishes emitted/suppressed/uncertain/failed states accurately.

### T-35 — Finish tray, close, startup, and shutdown behavior

**Depends on:** T-03/T-25/T-33/T-34. **Covers:** R-02/R-06. **Checks:** A-31/A-37/A-38/A-50.

Implement the production tray menu, first-close explanation, close-to-tray preference, explicit quit, single-instance activation, background startup argument, stable launcher registration, OS-disabled-startup feedback, and safe database/service shutdown. No development helper is added to Windows startup.

**Complete when:** hidden-window reminders work, explicit Quit stops the app, login starts it quietly only when enabled, and install/update/uninstall do not leave duplicate startup entries.

### T-36 — Implement `.ics` parsing, preview, and import

**Depends on:** T-07/T-11/T-13/T-15/T-28. **Covers:** R-12. **Checks:** A-39–A-42.

Parse with file/component/expansion limits in a worker, normalize supported events/tasks and time zones, preserve source mappings, detect duplicate/changed UIDs, and report unsupported components. Build the preview and explicit finite-range conversion choice. Commit a local import batch and queue its cloud changes with resumable progress.

**Complete when:** representative Google/Outlook/university-style fixtures import as previewed, repeated import is idempotent, malformed items cannot corrupt existing data, and unsupported semantics are visible before saving.

### T-37 — Implement calendar export and import undo

**Depends on:** T-36. **Covers:** R-12. **Checks:** A-40/A-43.

Generate valid `.ics` with stable UIDs, escaping/folding, date-only/timed values, recurrence/exceptions, and app metadata. Add selection/range options and explain calendar export versus full backup. Implement import undo using the batch's before-images and version checks, routing newer edits to conflict handling.

**Complete when:** exports reparse and preserve the specified supported data, an independent client/parser accepts fixtures, and undo does not remove records edited after the import without a decision.

### T-38 — Implement full backup and restore

**Depends on:** T-09/T-13/T-28/T-30. **Covers:** R-03/R-12. **Checks:** A-44.

Define the versioned JSON format, logical-data inclusion list, secret exclusions, checksum, validation limits, preview, account-aware ID remapping, recovery snapshot, and merge-as-new-mutations restore path. Do not restore stale notification journals, sync cursors, or receipts.

**Complete when:** a full fixture can be restored into a clean account with links/completion intact, the file contains no credentials, and invalid/partial/back-level/forward-level formats produce the prescribed result without partial corruption.

### T-39 — Finish settings, preferences, and help

**Depends on:** T-21/T-26/T-32/T-34–T-38. **Covers:** R-01–R-14. **Checks:** A-03/A-20/A-36/A-37/A-45.

Build settings groups for appearance/accessibility, calendar/date display, defaults, notifications/quiet hours/privacy, startup, account/providers, sync, backups, and About/help. Label which preferences affect only this computer. Add test notification, backup/export entry points, exact version, data location, and concise explanations of offline/reminder behavior.

**Complete when:** every documented setting is changeable and persists with its stated scope, changes do not unexpectedly rewrite existing events, and the user can reach recovery/help without a terminal.

## Phase 5 — integrated verification, distribution, and handover

### T-40 — Run domain, migration, and recovery verification

**Depends on:** T-07–T-14/T-36–T-38. **Checks:** A-02–A-05/A-12–A-23/A-39–A-44.

Run deterministic scheduling, recurrence, task, import/export, and persistence tests. Inject failures at save/migration/backup boundaries. Test every supported data schema from a pristine database and a previous-version fixture. Record failures against tasks and fix the root cause before rerunning affected scenarios.

**Complete when:** required logic/recovery scenarios pass with no unhandled rejection, lost acknowledged mutation, or corrupt relationship. A high coverage percentage alone is not the completion criterion.

### T-41 — Run account, rule, and two-device sync verification

**Depends on:** T-25–T-32/T-38. **Checks:** A-06–A-11/A-23–A-30/A-49.

Use isolated local device stores, two real installations/accounts where required, and controlled offline/network-failure conditions. Test authorization from hostile request shapes, receipt recovery, pagination, conflicts, deletion, email/Google linking, token refresh, and quota/permission failures. Run live sign-in/sync in addition to emulator tests.

**Complete when:** all required scenarios pass and the report names which checks used emulators versus live services. An unavailable second device or cloud configuration is recorded as not run and remains a release dependency.

### T-42 — Run visual, keyboard, and accessibility verification

**Depends on:** T-15–T-24/T-26/T-30/T-34/T-39. **Checks:** A-18–A-22/A-45/A-46.

Review screenshots at normal, narrow, and high-scaling layouts with sparse and crowded dates. Inspect the exact black/purple design, day-panel placement, sidebar boundaries, text clipping, dialogs, empty/error states, focus order, and reduced motion. Operate complete workflows with keyboard and Windows Narrator; run automated accessibility checks as additional evidence.

**Complete when:** every critical workflow is reachable and legible, no selected-day panel or task becomes inaccessible, and contrast/focus defects are fixed with before/after evidence.

### T-43 — Run native lifecycle and reminder verification

**Depends on:** T-33–T-35/T-39. **Checks:** A-31–A-38.

Use the installed app to test visible/hidden reminders, actual sleep/resume, clock changes, quit/relaunch, native suppression, privacy mode, catch-up aggregation, startup enabled/disabled, and a second launch. Synthetic scheduler tests supplement these checks; they cannot prove Windows banner delivery.

**Complete when:** the measured submission timing meets the controlled-test target and lifecycle behavior matches the state table, with actual OS conditions recorded.

### T-44 — Run performance and resource verification

**Depends on:** T-32/T-40–T-43. **Checks:** A-47/A-48.

Measure cold start, month/day navigation, durable saves, searches, large import cancellation, recurrence expansion, idle CPU/memory, and network calls on the named baseline machine and fixture. Profile slow paths and fix blocking work or repeated wakeups. Re-run only affected measurements after fixes.

**Complete when:** required latency/CPU targets are met or any proposed tradeoff is explicitly recorded for owner review; the report includes actual memory, installer size, and operations per session.

### T-45 — Review packaged security and dependency posture

**Depends on:** T-27/T-35/T-36/T-41. **Checks:** A-49.

Inspect renderer isolation, content policy, navigation/IPC allowlists, provider origins, loopback binding, archive contents, token encryption, secret/log exclusion, malformed-import behavior, rule tests, and dependency audit results. Restrict production debugging/execution features as appropriate without breaking required user workflows.

**Complete when:** no bundled administrator credential, cross-account access path, raw privileged UI API, or known exploitable critical runtime dependency issue remains. Record specific findings and resolutions rather than a generic “secure” assertion.

### T-46 — Build and verify the release installer and upgrade path

**Depends on:** T-40–T-45. **Covers:** R-01/R-02/R-03/R-06. **Checks:** A-01/A-50/A-51.

Produce the versioned installer from the pinned source, calculate its checksum, and test a clean standard-user installation without development tools. Test data-preserving upgrade from a seeded previous build, startup/shortcut identity after upgrade, and uninstall behavior. Run the declared OS/architecture matrix. Label unsigned builds truthfully; do not purchase signing without approval.

**Complete when:** each claimed target has passed installation, launch, save/reopen, sign-in, and notification tests; the installer and checksum are ready for local download. Untested targets stay out of the supported matrix.

### T-47 — Write user and maintainer documentation

**Depends on:** T-39/T-41/T-43/T-46. **Covers:** all requirements.

Write installation/update/uninstall instructions; first sign-in; semester/course setup; recurring edit rules; day expansion; tasks/sidebar range; reminders/tray/sleep limitations; offline/conflict behavior; import/export/restore; data location/privacy; and troubleshooting. Add maintainers' build/cloud setup, rules/index deployment, migration, backup, and release instructions. Include all externally owned project/configuration dependencies without publishing secrets.

**Complete when:** a reader without the conversation can install and use the app and a developer can reproduce the build and understand the live-cloud requirements.

### T-48 — Reconcile requirements and deliver the release evidence

**Depends on:** T-46/T-47 and all mandatory tests. **Covers:** R-01–R-14. **Checks:** A-52.

Complete the traceability table, test report, known-issues list, measured resource report, supported-platform matrix, and release notes. Include source/build instructions and the installer link. Clearly identify anything not run or externally blocked; do not describe a development demo as a completed cloud-enabled release. Public hosting is a distinct publication action using an owner-controlled destination if requested/available.

**Complete when:** the owner receives the actual installable artifact and a truthful, reproducible account of what works, what was tested, and any remaining restriction. No critical requirement can be silently reclassified as a future improvement.

## Requirement traceability

| Requirement | Main implementation tasks | Acceptance evidence |
| --- | --- | --- |
| R-01 Name | T-01/T-02/T-15/T-46 | A-01/A-45/A-52 |
| R-02 Installable Windows app | T-02/T-03/T-35/T-46 | A-01/A-37/A-38/A-50/A-51 |
| R-03 Persistent information | T-08/T-09/T-38/T-40 | A-02–A-05/A-23/A-44/A-50 |
| R-04 Accounts/cloud sync | T-04/T-05/T-25–T-32/T-41 | A-06–A-11/A-23–A-30/A-49 |
| R-05 Both sign-in methods | T-04/T-25/T-26/T-31 | A-06–A-11 |
| R-06 Background reminders | T-03/T-14/T-33–T-35/T-43 | A-31–A-38 |
| R-07 Black/purple UI | T-15/T-42 | A-45/A-46 |
| R-08 Regular calendar | T-16/T-18/T-22 | A-12/A-13/A-18/A-45 |
| R-09 Day expansion | T-17/T-18 | A-19/A-45/A-46 |
| R-10 Seven-day sidebar | T-19 | A-21/A-22 |
| R-11 Student toolkit | T-11–T-13/T-18/T-20–T-22 | A-12–A-22 |
| R-12 Calendar import/export | T-36–T-38 | A-39–A-44 |
| R-13 Free initial hosting | T-04/T-05/T-32/T-44 | A-30/A-48/A-52 |
| R-14 UX improvements | T-15/T-20/T-22–T-24/T-39/T-42 | A-21/A-45–A-47 |

## Reporting rules

- Allowed task statuses: planned, in progress, blocked by named dependency, ready for verification, complete, reopened.
- Allowed test statuses: not run, pass, fail, blocked by named environment.
- Estimates are not deadlines. Establish elapsed-effort estimates after the Phase 0 proofs reveal actual integration constraints; do not trade test completeness for an invented delivery date.
- External setup and genuine cost authorization are handled when the concrete step is ready. These do not require stopping unrelated authorized work.
- If the specification changes, update the affected requirement, tasks, and tests together. Preserve a short decision note stating what changed and why.
