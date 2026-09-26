# C.C. Lime 0.1.2 — development preview

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
