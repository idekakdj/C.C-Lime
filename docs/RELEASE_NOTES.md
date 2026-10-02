# C.C. Lime release notes

## Unreleased — fresh sign-in after password changes

Changing a password now clears this computer's saved login and returns to sign-in with an explanation. Each updated client's sync pass checks its refresh token first; older revoked sessions must sign in again when they reconnect/check, while pending calendar edits are preserved. Live disposable-account verification covers two independent sessions and an older saved-session restart. Previously issued access tokens remain a separate backend enforcement window; immediate global logout is not claimed. [Plan and evidence](PASSWORD_SESSION_CHANGE_PLAN.md).

This follow-up is source/test-package only. The normal installed version remains 0.1.16 until a separately requested release/install.

## 0.1.16 — accumulated security fixes and compliance inventory

This owner-only Windows update includes all existing calendar, recurrence/task history, course editing, circular profile crop, password confirmation/strength and custom-theme features. It adds immediate pending-write status, safer remembered-session cleanup, bounded/cancellable Google callback handling, stronger document response/frame/worker restrictions, the reviewed tooling dependency fix and complete bundled/copied runtime notices with unchanged covered MPL sources.

The [comprehensive capabilities inventory](APP_CAPABILITIES_0116.md) separates shipped functions and security controls from experimental fuse checks, uncompleted native acceptance and formal assurance. No SOC 2 report, ISO certificate, DGSI conformance or PIPEDA compliance conclusion is claimed; PHIPA is excluded. [Release plan](RELEASE_0116_PLAN.md) and [implementation evidence](IMPLEMENTATION_STATUS.md) record installation/validation independently. Shipping fuse settings and provider policy remain unchanged.

## 0.1.15 — recurring scheduled items and reliable task progress

All scheduled calendar types gain recurrence, while undated tasks remain unscheduled. Twelve-hour calendar labels show AM/PM. Completion history and weekly progress persist, including repeating-task occurrences, with to-do ranges for this week, this month and all. Cloud payload compatibility was approved and deployed with disposable-account verification. Installed email/Google controls are protected by fresh/restart checks and private normal configuration; actual password-account restoration was tested separately.

## 0.1.14 course filters, editing and selection safety

Native dropdown options use black text on white, while the closed controls retain themed contrast. Active sidebar courses have an explicit edit button and course cards say Edit course. Both update the existing course and retain linked calendar items. Course-event text and time labels use the validated palette foreground/background while course colors remain in borders and navigation dots.

A dialog backdrop click must begin and end outside the form. Selecting text and releasing outside preserves the draft; ordinary backdrop clicks, Cancel, close and Escape retain their behavior. See the [ordered plan](COURSE_USABILITY_PLAN.md) and [verification evidence](IMPLEMENTATION_STATUS.md) for release and installation gates. This remains an unsigned owner-only preview; formal security/compliance assurance remains open.

## 0.1.13 consistent circular profile photos

The crop preview, large profile photo and both profile buttons now use the same centered circular framing. Removing browser-default button padding fixes the narrow image in the top-right button. Existing saved photos and bounded 128×128 PNG storage remain unchanged; dragging, zoom, cancellation and account sync retain their behavior.

PHIPA was withdrawn from the current scope by the owner on September 30, 2026. SOC 2, ISO 27001, CAN/DGSI 118 and PIPEDA work continues without a certification claim. Independent task completion, undo and lifetime-history acceptance now runs without main-process inspection. See the [ordered plan](CIRCULAR_AVATAR_SCOPE_PLAN.md) and [verification evidence](IMPLEMENTATION_STATUS.md).

## 0.1.12 Windows startup correction

Settings reads the actual enabled state of C.C. Lime's named Windows startup entry, even when Electron's older status flag is false. It distinguishes missing registration from Windows disablement, refreshes on window focus and lets the owner reapply a saved startup preference. Only the installed app can register startup; previews and test profiles preserve the installed entry. The bounded owner upgrade also corrects the older launcher target while preserving Windows' enablement choice. Actual Windows login execution remains a manual acceptance check. See the [ordered plan and evidence](WINDOWS_STARTUP_FIX_PLAN.md).

## 0.1.11 profile editing and password controls

Centers the profile heading/cards with consistent gutters, wraps long profile labels, and removes the trailing Personal workspace chevron. Uploaded photos open a user-controlled square crop with dragging, keyboard sliders, zoom, reset and explicit Save/Cancel. Username edits use the existing synced profile name; email remains the login identifier.

New-account and added-password forms include strength feedback and matching confirmation. Settings lets password-enabled accounts change passwords after verifying the current password, with the same new-password controls. Existing-password sign-in remains compatible. Crop originals and passwords are not persisted. No calendar schema or cloud-rule change is required. See the [implementation plan](PROFILE_CROP_LAYOUT_PLAN.md). The normal-context 0.1.11 installation and account/data preservation passed; broader manual acceptance remains open. This remains an unsigned owner-only preview without compliance certification.

## September 30: 0.1.10 profile and appearance update

Adds account-synced profile photos/names, joined dates when available, lifetime completed-task statistics, Black & white and Navy & gold presets, and a color editor with up to three saved themes. Purple & black remains the default. Uploaded images are cropped to square icons; completed-task history survives subsequent deletion but cannot recover tasks deleted before tracking began.

SQLite and full-backup compatibility advance to version 2 for the new records. Update every computer using this account before using the new features. Calendar copies exclude profiles and lifetime history; same-account merge retains them when missing or identical. Backup files can contain photos and are not encrypted.

0.1.10 is installed; exact package identity, private profile comparison and populated migration passed. Live account sync and cleanup passed. See [current results](IMPLEMENTATION_STATUS.md) and [installation gates](UPGRADE_0110_PLAN.md). This remains an unsigned owner-only preview, without a compliance certification. Older sections below describe historical checkpoints.


## Historical 0.1.9 build checkpoint

September 29, 2026. This separate build updates Electron to 44.4.5 and fixes the Windows installer omitting Chromium's license notices. The notice file is checked byte-for-byte inside the installer package. The owner's verified installed app remains 0.1.8.

Validation: 171 unit tests, 45 local tooling passes with two permission-limited symlink skips, 36 cloud tests, all 26 packaged desktop tests, populated-calendar upgrade fixture, native inventory and source/package credential scans pass. The npm audit is clean. No calendar schema, cloud protocol or notification behavior changed. See [current evidence](IMPLEMENTATION_STATUS.md) and [exact artifacts](SUPPLY_CHAIN_REPORT.md).

The unsigned 168,004,096-byte installer is retained privately at `release/0.1.9/CC-Lime-0.1.9-Setup-x64.exe`; SHA-256 `71fe90b2b8c0efa711ec0a765010be38c02fe95a6a6385aff6cd8bd50daf1e3e`. It is not installed or publicly released. Production fuse hardening, installed-notice verification, broader native/license review, signing and outstanding product/organizational acceptance remain open. This is not a compliance certification.

## Prior verified 0.1.8 owner upgrade

September 29, 2026. The owner has been updated from 0.1.5 to 0.1.8. **This remains a development preview, not a completed production release or compliance certification.**

Targeted calendar searches now avoid expanding unrelated recurring items, and queue-status refreshes avoid decoding every queued change. Expired quick-undo history is cleaned from active account stores. Build dependency fixes add verified Electron downloads and protected extraction directories. Existing import/recovery copies retain their documented limits.

The exact installer passed profile/settings preservation, a populated eight-record upgrade fixture and all 26 installed desktop tests. Windows shortcuts and the notification activator update automatically and remain stable on repeated launches. The actual profile's one account database contained zero calendar rows; populated-data preservation is established separately. Google/cloud configuration and Windows encrypted storage remain available.

Unsigned retained installer: `release/0.1.8/CC-Lime-0.1.8-Setup-x64.exe`, 166,069,760 bytes; SHA-256 `fa199d98f2cbb5e00330e4148eb5cc2cb01d726ee1ec7753dc4fc31cd724130c`. Installed ASAR SHA-256 `17f7bc04af11623f8cb8f5fa41d77af062e56d01aa704f3ff83ca5698c5ddd36`. No public asset was uploaded. [Current evidence](IMPLEMENTATION_STATUS.md) distinguishes automated checks from remaining native/manual, security, signing and organizational acceptance work. The latest owner-observed banner/click evidence is still the 0.1.4 result below.

## Prior verified 0.1.4 checkpoint

September 27, 2026. **Installed upgrade and native notification activation verified. Not a production release or compliance certification.**

Windows installation and updates now align C.C. Lime's notification shortcuts automatically, using a stable notification identity and launcher. Ordinary installed startup checks them again. Changes are privately backed up, and unrelated shortcuts are preserved. Windows development previews/test profiles do not initialize native notifications; use the installed app for popup reminders.

Validation: 150 unit tests, type/build checks, all 25 desktop tests against both packaged and installed apps, and source/package credential scans passed. Actual isolated Windows shortcut files were tested through fresh creation, stale upgrade, repeated repair and ownership cleanup. The populated 0.1.3 fixture retained eight records, eight queued changes, four reminders and settings under both packaged and installed 0.1.4. The real profile comparison preserved settings, private configuration and its earlier database; that profile held zero active records. The cloud protocol and deployed rules are unchanged.

Unsigned local installer: `out/make/squirrel.windows/x64/CC-Lime-0.1.4-Setup-x64.exe`; **166,077,952 bytes**; SHA-256 **`3fb7de98ef66515e7ef6d4489176667752ef8c1acc7d8870f1042035cd384c37`**. Installed successfully; its archive matches the tested package. All three shortcuts aligned automatically during the upgrade and stayed stable on repeat launch. A real test-notification click reopened the hidden calendar after a Do Not Disturb retry. Not published as a release asset. Scheduled timing, sleep/login, clean-PC and full uninstall acceptance remain open; see [current evidence](IMPLEMENTATION_STATUS.md).

## Prior verified 0.1.3 checkpoint

Updated September 27, 2026. **Not a production release or a compliance certification.** Adds main-process sensitive-action limits, provider cooldowns that preserve pending edits, a server-enforced account write quota, and a black/purple 404 page with keyboard recovery. The rules are deployed and require 0.1.3 or later on syncing devices; see [implementation evidence](IMPLEMENTATION_STATUS.md).

Validation: 132 unit tests, 36 cloud-emulator tests, 23 desktop cases against both packaged and installed apps, type/build and credential scans pass. Seven live quota checks and seven live sync/auth/deletion checks passed under the new rules; temporary accounts/data were cleaned up. Tests verified raw bypass rejection, independent budgets, durable queued data and automatic delivery after a real server-window reset. The [security/privacy plan](SECURITY_PRIVACY_PLAN.md) tracks 62 tasks and 64 acceptance scenarios. Organizational controls, independent assurance and remaining original release checks are still required.

Installed local preview: `out/make/squirrel.windows/x64/CC-Lime-0.1.3-Setup-x64.exe`. Unsigned, not uploaded as a public release. Size **166,110,720 bytes**, SHA-256 **`97c2c7ce7d4dff0b870cf74986bce244e2e4242213624de8797c343067173cce`**. Installed 0.1.3 preserved an isolated 0.1.2 fixture's eight records, eight queued changes, four reminders and settings; its archive matches the tested package. The separate real-profile comparison also passed: settings, private configuration and the earlier database were preserved; that profile held zero active calendar records before and after. The app's notification shortcut was backed up and realigned with its registered identity; the general installer fix and banner/click acceptance remain open. Do not use the older checksum below for 0.1.3.

## Prior verified 0.1.2 checkpoint

September 26, 2026. **Not yet a production release.** [Implementation evidence](IMPLEMENTATION_STATUS.md) reconciles all 48 tasks and 52 acceptance scenarios.

This preview provides a black/purple month calendar, expandable days, Week/Agenda, courses/semesters, tasks and the next-seven-days sidebar. It includes local SQLite persistence, offline cloud queues/conflicts, email/password and Google sign-in, tray/reminder controls, ICS interchange and full backups/recovery.

Google's real browser flow, verified Firebase exchange and Windows-encrypted session restart/refresh passed. Both Google and Firebase settings remain in private local environment files; current source and package scans found no private values. Installers require separate local cloud configuration to enable sign-in.

New in 0.1.2: unchanged refreshes omit the calendar record payload, worker responses retain acknowledged results, visible dates use a shared index, and unrelated classes/events no longer expand for the six-month task list. Busy task groups, agenda days and sidebar days use 50-item batches with every item still reachable. Account changes reset caches; superseded results cannot suppress data the window never received.

Added in 0.1.1: review semester and whole-series date changes before applying; preserve removed edits/completion as independent items or explicitly discard them; inherit semester defaults for new classes; confirm dirty scope changes; move/resize in the week grid with 15-minute snapping and recurrence scope; follow this computer's zone without rewriting stored events; show native test-notification failures in Settings. Keyboard access to the preview date list and a day-close/search focus race are fixed.

Validation: 103 unit tests, 22 desktop tests against both packaged and installed 0.1.2, three consecutive resize-test repeats, type checking, production build and source/package credential scans pass. The unchanged cloud protocol previously passed 26 emulator tests plus live synthetic cloud checks; live Google sign-in and encrypted restart were verified in 0.1.0. See [performance results](PERFORMANCE.md) for the new large-fixture measurements and earlier 0.1.0 CPU intervals. The latest save/day samples meet targets; startup, navigation and search still exceed them. A related unit test does not stand in for a complete native acceptance scenario.

## Local installer

- File: `out/make/squirrel.windows/x64/CC-Lime-0.1.2-Setup-x64.exe`
- Size: 166,101,504 bytes (approximately 158.4 MiB).
- SHA-256: `6c4221135cc782d80070e78c4431ebea992d57c164d2504414b86bf7bba34c9e`
- Unsigned; Windows may display a reputation warning.
- Generated locally from the same package used for desktop/performance checks. No public GitHub release asset has been uploaded.

## Platform evidence

| Platform | State |
| --- | --- |
| Windows 11 Home x64, build 10.0.26200 | 0.1.2 package suite and local upgrade passed. A populated 0.1.1 fixture retained eight records, eight queued mutations, four reminders and settings. The real profile (zero records) retained settings/private configuration. Prior 0.1.0 installed suite and live Google flow passed. Other native lifecycle checks remain. |
| Other Windows x64 PCs / clean standard-user environment | Not yet tested. |
| Windows ARM64 | No native ARM64 package tested. |
| macOS / Linux | Architecture is intended to allow future ports; no tested installer or support claim. |

## Remaining release work

Initial/changed snapshot pagination, full list virtualization and remaining importer/exporter edge cases are still open. The current startup, navigation and search measurements exceed the plan's limits despite the much smaller unchanged-refresh payload. The build/admin toolchain has unresolved dependency advisories. Expanded cross-midnight, input-device, archive/deletion and operating-system-zone acceptance combinations still need review.

Final native notification activation, actual sleep/resume/login, Narrator, uninstall, delivered verification/reset links and a second physical PC still need verification. The populated 0.1.1 → 0.1.2 upgrade uses the same SQLite schema version; a schema-change migration needs a distinct fixture. The owner confirmed receiving a 0.1.0 Windows test banner after conflicting app shortcut activation metadata was aligned locally. The 0.1.2 upgrade required the same backed-up local shortcut repair. Scheduled-banner visibility and click routing still require separate verification.

Calendar data and exported backups are not end-to-end encrypted. Cloud data is administered by the project owner. Session refresh tokens are protected with Windows encryption when available. No analytics or automatic diagnostic upload is enabled.
