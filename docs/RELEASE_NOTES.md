# C.C. Lime 0.1.0 — development preview

September 25, 2026. **Not yet a production release.** [Implementation evidence](IMPLEMENTATION_STATUS.md) reconciles all 48 tasks and 52 acceptance scenarios.

This preview provides a black/purple month calendar, expandable days, Week/Agenda, courses/semesters, tasks and the next-seven-days sidebar. It includes local SQLite persistence, offline cloud queues/conflicts, email/password and Google sign-in, tray/reminder controls, ICS interchange and full backups/recovery.

Google's real browser flow, verified Firebase exchange and Windows-encrypted session restart/refresh passed. Both Google and Firebase settings remain in private local environment files; current source and package scans found no private values. Installers require separate local cloud configuration to enable sign-in.

Validation: 69 unit tests, 26 cloud emulator tests, 12 desktop calendar tests against both packaged and installed copies, two additional installed lifecycle tests, live synthetic cloud convergence/deletion and exact-value source/package credential scans. See [performance results](PERFORMANCE.md) for the measured large fixture and CPU intervals. A related unit test does not stand in for a complete native acceptance scenario.

## Local installer

- File: `out/make/squirrel.windows/x64/CC-Lime-0.1.0-Setup-x64.exe`
- Size: 166,089,728 bytes (approximately 158.4 MiB).
- SHA-256: `fa9d0e964a5a73e581aafd670b401be564bacada63ad908396d105c0be8980b0`
- Unsigned; Windows may display a reputation warning.
- Generated locally from the same package used for desktop/performance checks. No public GitHub release asset has been uploaded.

## Platform evidence

| Platform | State |
| --- | --- |
| Windows 11 Home x64, build 10.0.26200 | Packaged and installed calendar tests, crash recovery, tray/second-launch restoration and live Google flow passed. Local 0.0.1 → 0.1.0 upgrade succeeded. Other native lifecycle checks remain. |
| Other Windows x64 PCs / clean standard-user environment | Not yet tested. |
| Windows ARM64 | No native ARM64 package tested. |
| macOS / Linux | Architecture is intended to allow future ports; no tested installer or support claim. |

## Remaining release work

Semester/series impact previews and coordinated timetable updates, complete week-time dragging/cancellation, OS-zone-follow behavior, larger-list/data transport optimization and remaining importer/exporter edge cases are still open. Month navigation and some slow performance samples exceed the plan's limits. The build/admin toolchain has unresolved dependency advisories.

Final native notification activation, actual sleep/resume/login, Narrator, uninstall, delivered verification/reset links and a second physical PC still need verification. The local upgrade preserved the profile and old feasibility database byte-for-byte; the 0.0.1 feasibility build held no calendar records, so prior calendar-schema migration still requires a separate fixture. The updated app's window became available to desktop automation after refreshing the window inventory. A test reminder was submitted to Windows; banner visibility is awaiting owner observation.

Calendar data and exported backups are not end-to-end encrypted. Cloud data is administered by the project owner. Session refresh tokens are protected with Windows encryption when available. No analytics or automatic diagnostic upload is enabled.
