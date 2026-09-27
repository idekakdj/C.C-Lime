# Implementation and verification evidence

Updated September 27, 2026. Target: **0.1.4 development preview**, Windows x64. The production release is **not complete** under the plan's definition of done. “Implemented” means code exists, not that every acceptance scenario has passed.

## 0.1.4 Windows notification installation checkpoint

- The [precise repair plan](WINDOWS_NOTIFICATION_PLAN.md) extends T-34/T-35/T-46. Install/update now await Squirrel shortcut creation and align owned root/installer/existing desktop shortcuts before exit. Normal installed startup repeats the check; already-correct shortcuts are unchanged. Changed shortcuts are backed up privately once per location. Unrelated/unreadable shortcuts are refused; failure leaves calendar operation available and reports native dispatch failure.
- The installed AUMID and activator remain stable. Windows preview/test runs do not initialize the native notification presenter. A repeat-launch check exposed that Electron uses the EXE product resource for its shortcut filename, ignoring runtime app-name separation; preventing preview/test initialization fixed this. The diagnostic's root-shortcut and activation-target changes were restored to the verified prior installation before final regression.
- **150 unit tests in 16 files, type checking and production build pass.** Eighteen new cases cover installation boundaries, fresh/stale/idempotent repair, ownership, unreadable files, backup/write/read-back failures and lifecycle ordering/errors. No cloud protocol/rule changes are included.
- **All 25 packaged desktop tests pass in one final run** (1.8 minutes): 23 calendar regressions plus repeated test launches/dispatch attempts preserving installed shortcut bytes, and actual Windows `.lnk` creation/upgrade/backups/idempotence/ownership cleanup in isolated workspace fixtures. An initial fixture test's unsupported `require` call was corrected in the harness. These tests do not establish fresh-Windows-user installation or visible-banner delivery.
- **Source/package scans pass:** 102 publishable files and 204 archive entries, with no private credentials/configuration found. The superseded automatic Squirrel startup dependency and its types were removed; explicit lifecycle handling now waits for completion and reports a nonzero exit on errors.
- The packaged 0.1.4 build preserves the populated 0.1.3 fixture's eight records, eight pending mutations, four reminders and device settings. Schema remains 1. Private real-profile baseline captured before upgrade held zero active calendar records.
- **Built, not installed yet:** unsigned installer `CC-Lime-0.1.4-Setup-x64.exe`, 166,077,952 bytes, SHA-256 `3fb7de98ef66515e7ef6d4489176667752ef8c1acc7d8870f1042035cd384c37`. Packaged ASAR SHA-256 `ec3732698b2cd2dce93632b7acc654c56e5031aaa48a1e4d323ac1205ec1d21a`. The owner's normal installed 0.1.3 instance remains open; a tray-quit request is pending. Installation, immediate post-installer shortcut metadata, installed profile/fixture comparison, installed suite and native banner/click observation remain to be performed. No forced termination of the owner's app occurred.

The automatic repair is implemented and passes isolated Windows tests. T-34/T-35/T-46 still require the installed upgrade and broader native/clean-PC/uninstall checks. All performance, importer, organizational security/privacy and independent assurance gaps remain. The following sections retain the verified 0.1.3 and earlier evidence; they are not 0.1.4 installed results.

## 0.1.3 security/privacy extension checkpoint

The owner confirmed a personal student calendar, no patient records, operated by them or a future company whose details remain undecided. [The detailed plan](SECURITY_PRIVACY_PLAN.md) adds R-15–R-21, T-49–T-62 and A-53–A-64 for the five assurance/privacy targets, rate limiting and 404 recovery. No SOC 2 report, ISO certificate, DGSI conformance assessment or legal compliance finding is claimed.

- **132 unit tests in 15 files, type checking and production build pass.** New coverage includes sensitive-action limits before effects, independent budgets, monotonic provider cooldowns, non-JSON HTTP 429, safe pending queues, and manual/focus/save attempts during a sync hold.
- **36 emulator tests pass.** The new head quota accepts 60 atomic commits per account/window, denies raw REST slot 61 and forged resets/counters/times, handles racing final-slot requests, separate accounts, legacy migration, expired windows and receipt replay. Existing auth, deletion and maximum-group rule-budget tests still pass.
- **23 packaged desktop cases pass** (22 existing cases in the full run plus the corrected 404 case in a focused retest). The new case verifies actual status 404, denied IPC from an error document, automated accessibility, keyboard recovery and preserved saved data. Its first run used an unsupported new-tab accessibility API; switching to the same Electron-compatible legacy mode as existing checks resolved the harness failure.
- **Final source scan: 98 publishable files clean; refreshed package scan: 242 entries clean.** `.local/.env` and `.local/google-oauth.json` remain ignored. No credential values or private local configuration entered the app archive.
- **Installed upgrade passed.** The verified installer exited 0. Installed 0.1.3 preserved eight records, eight queued changes, four reminders and settings in the populated 0.1.2 fixture; all 23 installed desktop tests passed. Its ASAR matches the tested package: SHA-256 `fd6e652972b5dc84532b79deaa864944ac7fd30d9e8d07705528ae575def7023`. After the owner closed the preview copy, the separate real-profile comparison passed at September 27, 06:29 UTC: same profile path, exact calendar/device settings, unchanged earlier feasibility database, private cloud/Google configuration available, and Windows encrypted storage available. The real profile held zero active calendar records before and after; populated-data evidence comes from the isolated fixture. No forced termination or profile overwrite was performed.
- **The server write limit is active.** Before deployment, live source matched the private prior-rule backup. Firebase compiled and released the tested rules. Read-back at September 27, 06:18 UTC exactly matched the source hash below; active ruleset `5c09dc7e-73c9-4aa7-9dd5-002027ca4d4a`. All syncing devices require 0.1.3 or later.
- **Seven live quota checks passed** using two new synthetic accounts: exact deployed source, 60 real accepted commits in one server window, raw REST slot 61/early-reset/omitted-counter rejection with unchanged head, adapter cooldown and free receipt replay, independent account budget, durable pending save with no manual/focus bypass, and automatic delivery after a real window reset. Both accounts and their data/QA deletion markers were removed. The 60 fill commits used 180 document writes; adapter counters plus rule/admin reads are additional and do not represent complete billing measurements.
- **Seven live sync/auth/deletion checks passed under the new rules:** password signup/sign-in/refreshed verification, two-profile create convergence, conflicting edits with keep-both convergence, tombstones, cloud-before-identity deletion and confirmed cleanup. Synthetic email verification was administrative; inbox delivery and Google consent were not re-tested.
- **Notification identity was repaired after this upgrade.** The installer shortcut again had an unregistered activation identifier. It was backed up privately, aligned with the installed launcher/current version and registered identity, and re-read alongside the canonical shortcut. No new visible-banner/click result is claimed; the general installer and clean-PC fix remains open.
- CI now includes the Java 21 Firebase emulator suite before packaging, so future cloud-rule changes are checked on GitHub as well as locally.
- Both GitHub checks for implementation commit `3c1187e8cac729d55c56c73bf9a7a7dfe1b82db8` passed, including the full desktop suite in one run and the new emulator suite: [pull-request check](https://github.com/idekakdj/C.C-Lime/actions/runs/36279909484), [push check](https://github.com/idekakdj/C.C-Lime/actions/runs/36279907196). Subsequent evidence-only documentation edits do not change the tested application/rules code.
- The refreshed unsigned installer is 166,110,720 bytes; SHA-256 `97c2c7ce7d4dff0b870cf74986bce244e2e4242213624de8797c343067173cce`. Tested rules-file SHA-256: `0219a1e9bdeb27b5c802d40bb31819039723b7662b4ad7c92740eae2b1c0e06b` (file bytes; line-ending changes alter the hash).
- [Abuse-control review](ABUSE_THREAT_MODEL.md) maps current boundaries, local-guard bypasses, per-account burst limits, uncovered read/auth/distributed abuse, deletion, local-device and administrative risks to concrete next verification steps. T-53/A-57 remain open.
- The previous rules remain backed up in ignored `.local/rules-before-0.1.3.json`; their source hash was `58b8571810602cfafb9ef54653e5423e50b98b72456d0169502b00b6427db5b3`. They are historical evidence, not the current deployment. An automatic approval-review usage-limit failure interrupted the first post-install check; verification resumed on the owner's subsequent continuation.
- Read-only provider inventory confirmed email/password and improved email privacy enabled, application-account MFA disabled, and Firestore point-in-time recovery/database deletion protection disabled. Region: `northamerica-northeast2`. This is not a finding about administrator MFA or an assurance assessment. The inventory changed no settings or billing plan; details are in the [abuse review](ABUSE_THREAT_MODEL.md).

| Added task | State | Outstanding evidence |
| --- | --- | --- |
| T-49 | Complete | Exact scope, tasks, tests and dependencies documented; operator identity remains an explicit T-54 decision. |
| T-50 | Complete for specified app/provider safeguards | Unit/service and installed regressions pass; live cooldown preserved a queued save and retried automatically. Local guards are not remote abuse enforcement. |
| T-51 | Complete for specified account write quota | Installed populated and real-profile upgrade comparisons, deployment read-back, live denial/bypass/receipt/separate-account/reset checks and cleanup pass. |
| T-52 | Complete for desktop | Status/security headers, traversal/junction/read errors, accessibility and keyboard recovery verified in packaged and installed apps. No hosted website exists. |
| T-53 | In progress | Threat/bypass review and provider inventory recorded. Distributed authentication/read-abuse limits, monitoring and independent assessment remain. |
| T-54–T-60 | Planned; owner decisions required for organizational controls | Operator/legal scope, risk/policy/retention/vendor/access/incident/continuity programs and operating evidence do not exist merely because this plan was written. |
| T-61/T-62 | Blocked by organizational program/independent assessment and original release gaps | Reports/certification/conformance review, legally reviewed claims and final release approval outstanding. |

The original product performance, importer, notification-installer, native/manual, dependency and second-PC gaps below remain open. The following tables retain the prior 0.1.2 baseline unless explicitly updated above; they are not new 0.1.3 installed/performance results.

## Observed results

| Check | Result and scope |
| --- | --- |
| Source credential scan | Pass. No credential signatures in publishable files. Git ignores `.local/.env` and `.local/google-oauth.json`. The historical revoked Firebase key remains in commit `45333f7`. |
| Google configuration and live sign-in | Pass. Correct desktop client imported privately. On September 25 at 07:17 UTC, Google obtained a verified Firebase session; Windows encryption, full process restart, session restoration and live refresh all passed. The first attempt expired after five minutes; a fresh attempt succeeded. |
| Type/unit/build | Pass: 103 tests in 13 files, type checking and production build. Includes DST/recurrence, durable queues, reminders, ICS, recovery, account isolation, detached history, date bounds, overlap lanes, forged OAuth callbacks, preview/history preservation, snapped movement, device zone following, native failure feedback and SQLite write failures. |
| Cloud emulator | Pass: 26 tests. Four-record atomic groups, lost-response recovery, conflicts, authorization, deletion, malformed nested payloads and maximum-reminder rule budget. Hardened rules deployed and live synthetic checks repeated successfully. |
| Live Firebase | Seven synthetic-account checks passed: signup/sign-in, refreshed verification claim, two-profile create/conflict/tombstone convergence, cleanup and confirmed identity deletion. Verification was administrative on the newly created test identity; real email delivery was not tested. |
| Packaged desktop | 22 tests passed against packaged 0.1.2: calendar CRUD/restart/crash/tray, sidebar tasks/undo, recurring edits, semester/course forms, views/search/keyboard/layout, renderer isolation, progress, stale-preview errors/history decisions, dirty scope, timetable/class previews, device-zone persistence, simulated notification failure, week movement/resizing/scope, automated accessibility, 200% zoom and ICS/full backup. Adds large-task batching, refresh retention and sign-out clearing. The real pointer resize check also passed three consecutive repeats. |
| Installed desktop | The same 22 tests passed against installed 0.1.2 in isolated profiles after the real-profile and populated-fixture upgrade checks. |
| Package credentials | 242 archive entries inspected; no credential signatures or local configuration paths. Repeat after rebuilding. |
| Installer | 0.1.2 Squirrel Windows x64 installer: 166,101,504 bytes. Silent upgrade exited successfully. Real profile/settings/private configuration preserved (real profile held zero calendar records). A populated isolated 0.1.1 fixture retained eight records, eight queued mutations, four reminder entries and device settings under installed 0.1.2. Both use schema version 1; a future schema migration still needs a distinct fixture. Checksum in [preview release notes](RELEASE_NOTES.md). |
| Performance | Latest 0.1.2 medians: startup 4,870 ms, save 28 ms, month navigation 322 ms, day expansion 108 ms, search 907 ms. Startup/navigation/search miss targets. Earlier 0.1.0 five-minute idle intervals completed at 0.10% visible / 0.28% tray normalized CPU; see [measurements and limits](PERFORMANCE.md). |
| Native lifecycle/accessibility | Owner confirmed receiving the installed app's Windows test banner after its two app-owned shortcuts were aligned with the registered notification identity. Hidden-window scheduled dispatch was observed on 0.1.1; visible scheduled-banner timing, click routing, sleep/login, Narrator and independent second-PC observations remain. |

In 0.1.2, renderer snapshots preserve account identity and only reuse exact store revisions. Worker responses only omit sections the renderer acknowledged, so superseded messages cannot lose data. Busy lists expose successive batches of 50; grouped task expansion no longer expands unrelated classes/events. GitHub exposed timing-sensitive checkbox and resize tests; they now wait for saved settings and an actionable, updated resize handle.

The previous 0.1.0 package and installation passed 12 calendar tests plus two installed lifecycle checks. In 0.1.1, the expanded suite initially found a delayed day-close focus restoration that could steal search focus and a preview scroll region without keyboard access. Both were fixed, then all 21 tests passed on the rebuilt package. Exact privately configured values were checked against source and package contents without printing them. Raw reports/screenshots stay ignored in `test-results/`; credentials, real-profile baselines and live account checks stay in ignored local directories.

Notification diagnosis for 0.1.0 found two C.C. Lime Start Menu shortcuts with different activation identifiers; the installer-created shortcut was backed up privately and aligned with the existing registered shortcut and verified installed launcher. The owner subsequently reported that a notification banner was received. This is evidence for that installation's test banner, not a completed scheduled-reminder or clean-machine acceptance matrix. Version 0.1.1 reports test submission and native failure separately, without claiming submission proves visibility.

After the 0.1.2 upgrade, the installer-created app shortcut again carried an activation identifier with no registered COM activation server. The existing root shortcut used the registered identifier. Both app-owned shortcuts were backed up/inspected and aligned locally with the verified installed launcher and current version directory. This host-specific repair is verified; a general installer fix and clean-machine notification identity acceptance remain open.

On September 26, an isolated installed 0.1.1 calendar scheduled a real reminder for 08:21:22.427 UTC with the window hidden. Electron reported native submission 73 ms after the due time and the durable journal recorded `emitted`. No click was observed during the bounded test and owner confirmation of the banner was not received. This measures dispatch timing, not visible-banner latency or successful click routing.

A fresh installed 0.1.2 reminder test on September 26 was scheduled for 18:08:44.814 UTC with the window hidden. The native show event arrived 81 ms after the due time and the durable journal recorded emitted. Visible-banner and click confirmation remain separate from this dispatch observation.

## Per-task reconciliation

The original task descriptions remain the completion criteria.

| Task | State | Evidence / outstanding work |
| --- | --- | --- |
| T-01 | Complete | Detailed plan, 48 tasks, 52 acceptance scenarios, GitHub clone and source structure. |
| T-02 | Implemented; local upgrade verified | Pinned toolchain and x64 installer. 0.0.1 → 0.1.0, 0.1.0 → 0.1.1 and 0.1.1 → 0.1.2 upgrades passed on this Windows 11 host, including a populated isolated calendar. Clean second-PC installation remains. |
| T-03 | Partial | Installed SQLite normal/crash restart, hide-to-tray/second-launch restoration and owner-observed test banner pass. Notification-click routing remains. |
| T-04 | Live methods proved; extended auth checks open | Live email/password and Google Firebase exchange passed. Google session used Windows encryption and survived restart/refresh. Delivered email actions, linking and additional cancellation cases remain. |
| T-05 | Verified protocol | Four records + head + receipt fits emulator rules; live two-profile CAS/conflict/tombstone checks pass. |
| T-06 | Implemented | Synthetic fixtures, injected clocks, isolated profiles/stores and corrupt snapshots. Broader disk/migration fixtures remain. |
| T-07 | Implemented; audit partial | Strict shared schemas and bounded IPC; timed local years now limited to 1900–2100. Hostile nested cloud coverage remains. |
| T-08 | Implemented; scalability partial | SQLite/WAL, transactions, durable outbox and restart recovery. Unchanged refreshes omit records using account/store revision checks (855 versus 2,288,946 bytes in the measured fixture). Worker sections also reuse acknowledged data. Initial/changed full snapshots still need paginated transport. |
| T-09 | Partial | Retained snapshots and recovery preservation pass. Added real SQLite file-capacity (`SQLITE_FULL`), read-only-write and newer-schema rejection tests; failed grouped writes preserve records and outbox. Filesystem ACL/physical disk exhaustion and prior calendar-schema migration remain. |
| T-10 | Implemented/tested | Dates, zones, DST gaps/overlaps, date-only deadlines and exclusive all-day ends. |
| T-11 | Implemented/tested | Bounded date-impact previews, stale/expired/canceled preview guards, retained overrides, and explicit preservation/discard of removed history. Preserved moved/completed dates become single independent items; canceled-only dates are not revived. Local atomic undo covered. |
| T-12 | Implemented; extended matrix open | New classes inherit semester dates/zone and course location. Coordinated timetable previews/application preserve interval phase, skip breaks and leave independent assignments/exams unchanged. Semester-only saves supported. Broader archive/deletion combinations remain. |
| T-13 | Implemented/tested | Item CRUD, duplicates, completion, no-date tasks, study links and guarded undo; expand combined interaction coverage. |
| T-14 | Implemented/tested | Reminder anchors/offsets, completion cancellation, reschedule/reopen rules and DST. |
| T-15 | Implemented; manual access check open | Black/purple shell, labeled dialogs, focus and automated contrast checks. Narrator remains. |
| T-16 | Implemented/tested | Month cells, ordered chips, overflow and navigation. |
| T-17 | Implemented/tested | Inline day expansion beneath its week, item rows and keyboard navigation. |
| T-18 | Implemented/tested | Timing modes, reminders, recurrence previews/scope, duplication and discard prompts. Dirty scope changes require confirmation and reload every timing/repeat/reminder field. |
| T-19 | Implemented/tested | Today + six dates, separate overdue work and completion/undo. |
| T-20 | Implemented/tested | Task states, no-date items and course filter. Task groups now render 50-row batches with all remaining items reachable; sidebar/agenda days use the same control. Full virtualization remains open. |
| T-21 | Implemented/tested | Course/semester screens and timetable count/date previews; explicit apply, cancel and semester-only paths. |
| T-22 | Implemented/tested | Week/Agenda and overlap lanes; exhaustive long-span visual cases remain. |
| T-23 | Implemented/tested | Search/filter/shortcuts and keyboard calendar access; explicit search date window and 300-result display limit. |
| T-24 | Implemented; extended matrix open | Week drops select time in the display zone, snap to 15 minutes and retain duration. Resize/cancel and recurrence scope-before-editing covered in desktop tests; whole-series moves reach the date-impact preview. Invalid DST/negative-duration changes rejected by domain tests. Full cross-midnight/manual input-device matrix remains. |
| T-25 | Implemented; live Google verified | Main-only auth, PKCE/state/nonce, Windows encrypted persistence and restart/refresh passed. Additional linking/cancellation/revocation combinations remain. |
| T-26 | Implemented; live actions open | Auth/reset/verify/link/onboarding screens. Delivered email links and live provider linking remain. |
| T-27 | Implemented; hardening reviewed | Deployed per-account/CAS/deletion rules now validate nested timing shape, reminder entries, recurrence bounds and overrides. Real calendar-date validity, IANA semantics and large date-array elements still rely on strict application validation. |
| T-28 | Implemented/tested | Durable outgoing queue/groups, backoff and lost-response acknowledgment. |
| T-29 | Implemented/tested | Incoming cursor, missing-parent handling and profile convergence. Physical second-PC check remains. |
| T-30 | Implemented/tested | Readable conflict UI, local/remote/both choices and live keep-both convergence. |
| T-31 | Implemented; live UI partial | Separate account stores, immediate hiding, local removal and resumable cloud-before-identity deletion. Google reauth/delete UI remains live-unverified. |
| T-32 | Implemented/measured | Status/diagnostics/counters. Live synthetic session: 51 client reads and 20 writes across two profiles; implicit rule reads/admin cleanup are additional. |
| T-33 | Implemented/tested | Durable journal, watchdog, crash uncertainty, catch-up, quiet hours and delivery markers. |
| T-34 | Implemented; native check partial | Owner observed the 0.1.0 test banner after local shortcut repair. 0.1.1 shows native test failures in Settings, covered by synchronous/asynchronous unit cases and a simulated desktop failure. Real scheduled delivery, activation/suppression remain. |
| T-35 | Implemented; installed checks partial | Tray hiding and second launch restoring the existing window pass. Actual login/notification identity remain. |
| T-36 | Implemented; external fixtures open | Bounded ICS worker, preview/UID handling, native/finite recurrence and warnings. Independent Google/Outlook exports remain. |
| T-37 | Partial | ICS export and safe import undo. External interoperability and per-occurrence completion export remain. |
| T-38 | Implemented/tested | Backup checksum/relations, ID remapping, merge/copy preview and desktop restore. |
| T-39 | Implemented; help review open | Device zone-follow affects display/sidebar/quiet hours without rewriting event instants or saved preferences. Tests cover zone changes, restart, disabling and invalid-zone fallback. Settings/help text updated; actual OS-zone-change manual observation remains. |
| T-40 | Partial verification | 103 unit tests, including preview/history guards, movement, zone follow, native failure reporting, SQLite failure/newer-schema preservation, acknowledged caches/account resets, clipped display spans and a class-heavy expansion-budget regression. Prior-schema migration and the complete fault matrix remain. |
| T-41 | Partial verification | 26 emulator tests, live two-profile email/cloud and Google encrypted restart checks. Email delivery/provider linking/second physical PC remain. |
| T-42 | Partial verification | Automated WCAG A/AA calendar/editor, zoom/keyboard/narrow layout. Narrator/full manual matrix remain. |
| T-43 | Partial verification | Scheduler tests; real sleep/startup/activation/crash observations remain. |
| T-44 | Partial verification | Ten cold starts/interactions and five-minute visible/tray intervals measured. Latest save/day targets pass on this host; startup, navigation and search still miss targets. Unchanged snapshot transport shrank from 2.29 MB to 855 bytes. Earlier 0.1.0 normalized idle targets passed; 0.1.2 idle was not remeasured. Cloud/reminder-load idle coverage remains. |
| T-45 | Partial verification | Source/package scans and renderer boundaries pass. Dependency advisories and nested payload audit remain. |
| T-46 | Partial | Unsigned 0.1.2 installer, checksum and populated-calendar upgrade verified. Uninstall, schema-change migration and compatibility matrix remain. |
| T-47 | Drafted | User/maintainer/configuration guides and this register updated. Reconcile final measurements before handover. |
| T-48 | Open | Mandatory implementation and acceptance gaps prevent production release sign-off. |

## All acceptance scenarios

Related unit tests do not mark an entire acceptance scenario passed. The exact steps in `ACCEPTANCE_TESTS.md` remain authoritative.

| Scenarios | Current coverage and remaining scope |
| --- | --- |
| A-01–A-05 | Installed persistence, abrupt main-process exit, actual second launch, settings/queue and corrupt recovery covered. Clean install, full-disk, prior calendar-schema migration and the complete matrix remain. |
| A-06–A-10 | Live synthetic password flow, Google Firebase exchange, Windows-encrypted restart/refresh and emulator auth/isolation/revocation. Delivered email, linking and full cancellation matrix remain. |
| A-11 | Emulator interrupted deletion and live synthetic cleanup; both providers' real UI resume/reauth remain. |
| A-12–A-15 | Item/date/recurrence, timetable previews, removed-history decisions, dirty scope switching and snapped week movement/resizing covered. Complete cross-midnight/manual matrix remains. |
| A-16 | Semester impact preview/application and independent-deadline preservation covered; full archive combination matrix remains. |
| A-17–A-22 | DST/leap/sidebar logic and view/day/task coverage; full display/OS-zone/midnight visual matrix remains. |
| A-23–A-30 | Durable queue/CAS/conflict/lost-response/tombstone/paging and live two-profile convergence; physical second PC and complete error matrix remain. |
| A-31–A-38 | Scheduler logic and controls implemented; installed test banner received by owner. Required scheduled/tray-only timing, click, suppression and sleep/login lifecycle observations remain. |
| A-39–A-44 | Parser/export/backup and actual desktop import/restore; external interoperability, cancellation and full malformed/custom-zone matrix remain. |
| A-45–A-46 | Automated layout/keyboard/axe/zoom; Narrator/manual matrix not run. |
| A-47–A-48 | Performance/resources incomplete. Live client cloud counters available. |
| A-49 | Credential/renderer/account/protocol checks pass; dependency review and exhaustive hostile payload checks remain. |
| A-50–A-51 | Upgrades from feasibility and populated 0.1.0 calendars passed. Uninstall, a schema-version-change fixture and final platform evidence incomplete. Only Windows x64 packaged. |
| A-52 | Open until mandatory tasks and checks complete. |

## Dependency and distribution limits

The September 26 audit reported 32 advisories: 1 critical, 20 high, 8 moderate, 3 low in builder/admin dependencies. The separate `npm audit --omit=dev` check reported zero advisories. That scan does not audit Electron's bundled Chromium or prove a vulnerability-free packaged runtime. The critical finding is in transitive `tar`; automatic remediation proposes incompatible toolchain changes, so dependency updates need compatibility verification before production distribution.

No production release, signing certificate, automatic updater or macOS/Linux installer has been published. The current installer is unsigned. Cloud configuration must be supplied privately on each computer. No billing upgrade was enabled; client counters exclude implicit rule reads, so no unlimited-free-capacity promise is made.

## Owner actions needed

1. Google sign-in is complete; no more credential setup is currently needed. Do not send passwords, codes or credential contents in chat.
2. Use a real inbox for verification/reset delivery checks when requested.
3. Provide a second Windows PC for independent install/sync checks; it needs private local configuration too.
4. Participate in final sleep/resume, login and screen-reader checks where they would interrupt your session.

These do not block independent code, emulator, package, documentation or performance work.
