# Implementation and verification evidence

Updated September 25, 2026. Target: **0.1.0 development preview**, Windows x64. The production release is **not complete** under the plan's definition of done. “Implemented” means code exists, not that every acceptance scenario has passed.

## Observed results

| Check | Result and scope |
| --- | --- |
| Source credential scan | Pass. No credential signatures in publishable files. Git ignores `.local/.env` and `.local/google-oauth.json`. The historical revoked Firebase key remains in commit `45333f7`. |
| Google configuration and live sign-in | Pass. Correct desktop client imported privately. On September 25 at 07:17 UTC, Google obtained a verified Firebase session; Windows encryption, full process restart, session restoration and live refresh all passed. The first attempt expired after five minutes; a fresh attempt succeeded. |
| Type/unit/build | Pass: 69 tests in 10 files, type checking and production build. Includes DST/recurrence, durable queues, reminders, ICS, recovery, account isolation, detached history, date bounds, overlap lanes, forged OAuth callbacks and canceled listener cleanup. |
| Cloud emulator | Pass: 26 tests. Four-record atomic groups, lost-response recovery, conflicts, authorization, deletion, malformed nested payloads and maximum-reminder rule budget. Hardened rules deployed and live synthetic checks repeated successfully. |
| Live Firebase | Seven synthetic-account checks passed: signup/sign-in, refreshed verification claim, two-profile create/conflict/tombstone convergence, cleanup and confirmed identity deletion. Verification was administrative on the newly created test identity; real email delivery was not tested. |
| Packaged and installed desktop | 12 calendar tests passed against both the package and installed app: crowded-day access, create/edit/restart, sidebar completion/undo, one-occurrence edit, semester/course forms, views/search/keyboard/narrow layout, renderer isolation, progress, visible errors, automated accessibility, 200% zoom, ICS/full backup. Two additional installed-app tests passed for abrupt main-process exit/recovery and hide-to-tray/second-launch restoration. |
| Package credentials | 242 archive entries inspected; no credential signatures or local configuration paths. Repeat after rebuilding. |
| Installer | Squirrel Windows x64 installer: 166,089,728 bytes. Upgrade from 0.0.1 exited successfully; installed version 0.1.0 kept the profile path and the old feasibility database byte-for-byte. That older build contained no calendar records, so this does not prove a prior calendar-schema migration. Private local cloud configuration loaded successfully. Checksum in [preview release notes](RELEASE_NOTES.md). |
| Performance | Median startup 2,828 ms, save 15 ms, month navigation 246 ms, day expansion 180 ms, search 283 ms. Navigation and slow samples miss targets. Two five-minute idle intervals completed at 0.10% visible / 0.28% tray normalized CPU; see [measurements and limits](PERFORMANCE.md). |
| Native lifecycle/accessibility | Scheduler logic and controls tested; actual banner/click, sleep/login, Narrator and independent second-PC observations remain. |

All 12 calendar tests passed on the rebuilt package containing the final performance changes, then against the installed copy. The two added lifecycle tests passed in a separate run. The initial crash test targeted Playwright's Windows shell wrapper; it was corrected to verify the isolated profile and terminate the actual application main process. Exact privately configured values were also checked against source and package contents, without printing them. Raw reports/screenshots stay ignored in `test-results/`; credentials and live account checks stay in ignored local directories.

## Per-task reconciliation

The original task descriptions remain the completion criteria.

| Task | State | Evidence / outstanding work |
| --- | --- | --- |
| T-01 | Complete | Detailed plan, 48 tasks, 52 acceptance scenarios, GitHub clone and source structure. |
| T-02 | Implemented; local upgrade verified | Pinned toolchain and x64 installer. Upgrade from the 0.0.1 feasibility build to 0.1.0 passed on this Windows 11 host. Clean second-PC installation remains. |
| T-03 | Partial | Installed SQLite normal/crash restart and hide-to-tray/second-launch restoration pass. Native popup/click observation remains. |
| T-04 | Live methods proved; extended auth checks open | Live email/password and Google Firebase exchange passed. Google session used Windows encryption and survived restart/refresh. Delivered email actions, linking and additional cancellation cases remain. |
| T-05 | Verified protocol | Four records + head + receipt fits emulator rules; live two-profile CAS/conflict/tombstone checks pass. |
| T-06 | Implemented | Synthetic fixtures, injected clocks, isolated profiles/stores and corrupt snapshots. Broader disk/migration fixtures remain. |
| T-07 | Implemented; audit partial | Strict shared schemas and bounded IPC; timed local years now limited to 1900–2100. Hostile nested cloud coverage remains. |
| T-08 | Implemented; scalability partial | SQLite/WAL, transactions, durable outbox and restart recovery. Cached full snapshots still need paginated transport. |
| T-09 | Partial | Consistent retained snapshots, recovery UI and preservation tests. Prior-version migration/full-disk/unwritable scenarios remain. |
| T-10 | Implemented/tested | Dates, zones, DST gaps/overlaps, date-only deadlines and exclusive all-day ends. |
| T-11 | Implemented; preview partial | Recurrence, moved/cancelled exceptions, completion and independent detachment. Full series-impact preview remains. |
| T-12 | Partial | Course/semester CRUD, archive and class break exclusion. Coordinated semester-bound/break preview/application remains. |
| T-13 | Implemented/tested | Item CRUD, duplicates, completion, no-date tasks, study links and guarded undo; expand combined interaction coverage. |
| T-14 | Implemented/tested | Reminder anchors/offsets, completion cancellation, reschedule/reopen rules and DST. |
| T-15 | Implemented; manual access check open | Black/purple shell, labeled dialogs, focus and automated contrast checks. Narrator remains. |
| T-16 | Implemented/tested | Month cells, ordered chips, overflow and navigation. |
| T-17 | Implemented/tested | Inline day expansion beneath its week, item rows and keyboard navigation. |
| T-18 | Implemented; UX review partial | Timing modes, reminders, recurrence scope, duplication and item discard prompt. Dirty scope-switch review remains. |
| T-19 | Implemented/tested | Today + six dates, separate overdue work and completion/undo. |
| T-20 | Implemented/tested | Task states, no-date items and course filter. Large lists need virtualization. |
| T-21 | Partial | Course/semester screens tested; timetable count/impact previews remain. |
| T-22 | Implemented/tested | Week/Agenda and overlap lanes; exhaustive long-span visual cases remain. |
| T-23 | Implemented/tested | Search/filter/shortcuts and keyboard calendar access; explicit search date window and 300-result display limit. |
| T-24 | Partial | Month/date dragging and a snapped week resize handle open the editor before saving. Week movement does not yet select time from the drop position; cancellation and full direct-manipulation tests remain. |
| T-25 | Implemented; live Google verified | Main-only auth, PKCE/state/nonce, Windows encrypted persistence and restart/refresh passed. Additional linking/cancellation/revocation combinations remain. |
| T-26 | Implemented; live actions open | Auth/reset/verify/link/onboarding screens. Delivered email links and live provider linking remain. |
| T-27 | Implemented; hardening reviewed | Deployed per-account/CAS/deletion rules now validate nested timing shape, reminder entries, recurrence bounds and overrides. Real calendar-date validity, IANA semantics and large date-array elements still rely on strict application validation. |
| T-28 | Implemented/tested | Durable outgoing queue/groups, backoff and lost-response acknowledgment. |
| T-29 | Implemented/tested | Incoming cursor, missing-parent handling and profile convergence. Physical second-PC check remains. |
| T-30 | Implemented/tested | Readable conflict UI, local/remote/both choices and live keep-both convergence. |
| T-31 | Implemented; live UI partial | Separate account stores, immediate hiding, local removal and resumable cloud-before-identity deletion. Google reauth/delete UI remains live-unverified. |
| T-32 | Implemented/measured | Status/diagnostics/counters. Live synthetic session: 51 client reads and 20 writes across two profiles; implicit rule reads/admin cleanup are additional. |
| T-33 | Implemented/tested | Durable journal, watchdog, crash uncertainty, catch-up, quiet hours and delivery markers. |
| T-34 | Implemented; native check open | Notification host, occurrence routing, inbox/privacy/snooze. Actual banner activation/suppression remains. |
| T-35 | Implemented; installed checks partial | Tray hiding and second launch restoring the existing window pass. Actual login/notification identity remain. |
| T-36 | Implemented; external fixtures open | Bounded ICS worker, preview/UID handling, native/finite recurrence and warnings. Independent Google/Outlook exports remain. |
| T-37 | Partial | ICS export and safe import undo. External interoperability and per-occurrence completion export remain. |
| T-38 | Implemented/tested | Backup checksum/relations, ID remapping, merge/copy preview and desktop restore. |
| T-39 | Partial | Settings/preferences/diagnostics/data-folder/user guide. OS-zone-follow and further in-app help remain. |
| T-40 | Partial verification | 69 unit tests; migration, disk faults and full matrix remain. |
| T-41 | Partial verification | 26 emulator tests, live two-profile email/cloud and Google encrypted restart checks. Email delivery/provider linking/second physical PC remain. |
| T-42 | Partial verification | Automated WCAG A/AA calendar/editor, zoom/keyboard/narrow layout. Narrator/full manual matrix remain. |
| T-43 | Partial verification | Scheduler tests; real sleep/startup/activation/crash observations remain. |
| T-44 | Partial verification | Ten cold starts/interactions and five-minute visible/tray intervals measured. Save and normalized idle targets pass on this host; navigation and some slow samples miss targets. Cloud/reminder-load idle coverage remains. |
| T-45 | Partial verification | Source/package scans and renderer boundaries pass. Dependency advisories and nested payload audit remain. |
| T-46 | Partial | Unsigned 0.1.0 installer, checksum and local upgrade verified. Uninstall, prior calendar-schema migration and compatibility matrix remain. |
| T-47 | Drafted | User/maintainer/configuration guides and this register updated. Reconcile final measurements before handover. |
| T-48 | Open | Mandatory implementation and acceptance gaps prevent production release sign-off. |

## All acceptance scenarios

Related unit tests do not mark an entire acceptance scenario passed. The exact steps in `ACCEPTANCE_TESTS.md` remain authoritative.

| Scenarios | Current coverage and remaining scope |
| --- | --- |
| A-01–A-05 | Installed persistence, abrupt main-process exit, actual second launch, settings/queue and corrupt recovery covered. Clean install, full-disk, prior calendar-schema migration and the complete matrix remain. |
| A-06–A-10 | Live synthetic password flow, Google Firebase exchange, Windows-encrypted restart/refresh and emulator auth/isolation/revocation. Delivered email, linking and full cancellation matrix remain. |
| A-11 | Emulator interrupted deletion and live synthetic cleanup; both providers' real UI resume/reauth remain. |
| A-12–A-15 | Item/date/recurrence and desktop editor coverage; full timetable previews/all combinations remain. |
| A-16 | Archive implemented; semester impact preview/application incomplete. |
| A-17–A-22 | DST/leap/sidebar logic and view/day/task coverage; full display/OS-zone/midnight visual matrix remains. |
| A-23–A-30 | Durable queue/CAS/conflict/lost-response/tombstone/paging and live two-profile convergence; physical second PC and complete error matrix remain. |
| A-31–A-38 | Scheduler logic and controls implemented; required real native lifecycle observations outstanding. |
| A-39–A-44 | Parser/export/backup and actual desktop import/restore; external interoperability, cancellation and full malformed/custom-zone matrix remain. |
| A-45–A-46 | Automated layout/keyboard/axe/zoom; Narrator/manual matrix not run. |
| A-47–A-48 | Performance/resources incomplete. Live client cloud counters available. |
| A-49 | Credential/renderer/account/protocol checks pass; dependency review and exhaustive hostile payload checks remain. |
| A-50–A-51 | Upgrade from the feasibility build passed with its database preserved. Uninstall, calendar-schema migration and final platform evidence incomplete. Only Windows x64 packaged. |
| A-52 | Open until mandatory tasks and checks complete. |

## Dependency and distribution limits

The last local audit reported 32 advisories: 1 critical, 20 high, 8 moderate, 3 low in builder/admin dependencies. No runtime library was named by that report; this is not proof of a vulnerability-free packaged runtime. Review upgrades before production distribution.

No production release, signing certificate, automatic updater or macOS/Linux installer has been published. The current installer is unsigned. Cloud configuration must be supplied privately on each computer. No billing upgrade was enabled; client counters exclude implicit rule reads, so no unlimited-free-capacity promise is made.

## Owner actions needed

1. Google sign-in is complete; no more credential setup is currently needed. Do not send passwords, codes or credential contents in chat.
2. Use a real inbox for verification/reset delivery checks when requested.
3. Provide a second Windows PC for independent install/sync checks; it needs private local configuration too.
4. Participate in final sleep/resume, login and screen-reader checks where they would interrupt your session.

These do not block independent code, emulator, package, documentation or performance work.
