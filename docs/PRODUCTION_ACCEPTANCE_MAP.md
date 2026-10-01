# Production acceptance coverage migration

## 0.1.11 added coverage

The existing 31 desktop cases remain, with two additional crop/layout cases (33 total). Upload now explicitly saves the crop. Crop coverage checks real native decoding/re-encoding through an adapted chooser, selected region pixels and 128×128 output, keyboard adjustment, pointer dragging, reset, Cancel/Escape and restart preservation. Profile layout checks centered gutters at 1,600/1,000/800 widths and absence of the bottom chevron. Both are inspector-assisted desktop cases; native picker/dialog observation still needs migration. Six independent external-launch renderer cases continue to pass with the renamed Username field and centered profile layout. Password forms have isolated DOM tests and emulator-backed service rotation tests; real signed-in interactive desktop acceptance remains open and must not modify the owner's credentials as a test.

September 30, 2026. Follow-up to the [fuse plan](PRODUCTION_FUSE_PLAN.md), after the requested 0.1.10 installation. No existing desktop coverage is removed by this document. The installed app retains its seven recorded fuse gaps.

## Proven transport boundary

The disposable-copy probe disables only the `nodeCliInspect` fuse, starts a child without Playwright's Electron launcher and connects through the existing Chromium loopback transport on a random port. It uses the ordinary renderer bridge, opens a synthetic local calendar, turns off close-to-tray in that profile and requests ordinary browser closure. Calendar rendering and exit zero were observed without forced cleanup. The installed executable and retained installer remain untouched.

The reproducible [probe](../scripts/probe-production-transport.mjs) creates a new ignored package/profile directory each run, checks the copied fuse wire and records a sanitized versioned report. Failure to connect/render/exit normally returns nonzero. This is a feasibility check, not production hardening, a Node-inspector negative probe, full authentication verification or comprehensive desktop acceptance.

## Required migration before shipping disabled inspection

| Current coverage | Proposed independent observation | Gate still open |
| --- | --- | --- |
| Calendar CRUD, recurrence, tasks, keyboard, zoom, appearance, 404 | Existing DOM interactions through loopback Chromium transport; use UI to create fixtures or ordinary renderer commands, then observe the result | Port tests to external launcher; preserve assertions and account isolation |
| Restart and durable saves | Owned-process normal exit/restart, read-only SQLite inspection after closure, same isolated profile | Deliberate crash test must terminate only its owned process; check durable acknowledgment |
| Photo upload and ICS/backup dialogs | Real Windows file-dialog automation with synthetic files; export result read from disk | Current main-process dialog stubs cannot be counted as production verification |
| Invalid image, upload cancellation and account switch | Actual file-dialog selection/cancel, bounded files, ordinary account transitions | Preserve malformed/oversized/account-switch coverage |
| Native runtime/version/SQLite | Static manifest/native inventory plus independently measured application behavior; keep inspector-based inventory as development evidence only | Obtain actual hardened-runtime identity without enabling main inspection |
| Tray/second launch/login | External process and Windows window/tray observations, normal app launcher | Match existing single-instance behavior; manual login/sleep/clean-PC acceptance still needed |
| Notification failure and activation | Windows registration/file-identity checks and actual banner/click observations | Remove main-process Notification stubs from claimed final-artifact acceptance |
| Renderer sandbox and sender denial | Actual preload surface/renderer checks and untrusted-frame attempts | Replace main-process WebPreferences inspection with separate policy tests plus runtime boundary probes |
| Synced profile/history and deletion | Existing live synthetic service verification, plus real hardened app sign-in/sync | Service tests alone do not establish hardened interactive authentication |
| ASAR and executable fuses | Read final bytes; paired unhardened controls and disposable negative probes | Prove environment/inspector/alternate-app/header/content refusal; timeout is not success |

Next implementation order: external launcher/owned shutdown fixture; migrate renderer-only smoke and persistence checks; provide native dialog/OS observations; add negative controls; only then apply all seven reviewed fuses in a new package version and run exact-artifact CI/installed acceptance. Keep 0.1.10 unchanged while those gates are developed.

## First migrated checks

The [independent launcher](../tests/production/desktop.mjs) creates a fresh package copy with only Node CLI inspection disabled and synthetic profiles beneath its owned root. It attaches through Chromium, asserts local mode without account configuration, and requires normal exit zero. Forced cleanup is a failure, limited to the owned child. No Electron main-process evaluation or dialog stubs are used.

The [two renderer tests](../tests/production/renderer.spec.ts) pass locally: UI event creation/edit and local profile-name/theme persistence after real restart; renderer Node API absence, unknown-command rejection, true 404 status, query non-reflection, invalid-sender denial and return to saved calendar. Windows CI now runs these alongside the existing 31 desktop cases and retains sanitized summaries. This is initial migrated coverage, not completion of the matrix. Photo/ICS native-dialog automation, OS observations, runtime identity and paired negative probes remain open.

Next negative-control gate: launch an unchanged disposable control with an explicit loopback Node inspector port and verify its `/json/list` exposes a Node target. Launch an inspection-disabled copy with the same kind of explicit port, require normal calendar startup, no Node inspector announcement and connection refusal at that port. Both children must close normally; an unavailable control, occupied port, startup failure or timeout fails the test. Keep all other fuse settings and the installed app unchanged. This isolates the inspection setting rather than inferring protection from static bytes alone.

The [paired test](../tests/production/inspector.spec.ts) now passes locally. It checks an actual Node target in the control and three OS connection-refused observations in the disabled copy, while both applications start and close normally. The other six fuse targets still require their own probes.

All three independent cases also pass in [Windows CI at `03d8d44`](https://github.com/idekakdj/C.C-Lime/actions/runs/36774029212), with 326 total tests passing across the combined suites. The downloaded three-summary archive matches SHA-256 `56e85f19c1716f6ca3fd172efc2642b0a5eb72b56aeb74045e755e12a48786aa`; its versioned contents confirm each observed boundary. The runner's successful result also requires normal application exit. The installed artifact remains unchanged.

## Exact existing-case migration register

These 31 cases remain in the original suite. “Partial” means the new independent tests cover some assertions only; it is not permission to remove the original case. Fixtures may use ordinary renderer commands, but assertions must observe behavior independently. Main-process evaluation and native-dialog stubs cannot be claimed as hardened-artifact evidence.

| Existing case and source | Required external observation / replacement | Current migrated status |
| --- | --- | --- |
| 404 recovery, [desktop:17](../tests/e2e/desktop.spec.ts) | Actual 404/non-reflection, invalid-sender denial, keyboard return, saved item and axe check | Migrated locally and in CI: complete renderer assertions; original retained |
| Crowded day, [desktop:38](../tests/e2e/desktop.spec.ts) | Ordinary fixture commands; DOM paging/access to every saved item | Pending |
| Large task lists/sign-out, [desktop:48](../tests/e2e/desktop.spec.ts) | DOM paging/edit, ordinary sign-out, reopen persistence | Pending |
| Event create/day/edit/restart, [desktop:57](../tests/e2e/desktop.spec.ts) | UI create/edit, normal owned restart, visible day detail | Migrated locally and in CI: visible day detail before edit and after restart; original retained |
| Crash durability, [desktop:63](../tests/e2e/desktop.spec.ts) | Kill only external launcher's owned child after save acknowledgment; read-only closed SQLite and restart | Pending |
| Tray/second launch, [desktop:70](../tests/e2e/desktop.spec.ts) | External child/window state and second executable launch; normal tray quit | Pending; OS automation |
| Seven-day completion/undo, [desktop:81](../tests/e2e/desktop.spec.ts) | Sidebar UI, undo and persisted status | Pending |
| One recurring occurrence, [desktop:85](../tests/e2e/desktop.spec.ts) | UI scope/edit, visible override and unchanged remaining series | Pending |
| Course/semester management, [desktop:89](../tests/e2e/desktop.spec.ts) | Management-screen controls and saved linked records | Pending |
| Keyboard/views/search/narrow, [desktop:92](../tests/e2e/desktop.spec.ts) | Renderer keyboard and DOM; external window sizing or verified viewport | Pending |
| Renderer security, [desktop:96](../tests/e2e/desktop.spec.ts) | Renderer Node/credential absence, unknown-command denial; policy tests and untrusted-frame boundary | Partial: Node absence, empty local/session storage in local profile, unknown command covered; policy/untrusted frame remain |
| New task progress, [desktop:99](../tests/e2e/desktop.spec.ts) | Actual new/edit UI controls, selected progress and stored state | Pending |
| Removed occurrence/stale preview, [desktop:103](../tests/e2e/desktop.spec.ts) | Review/cancel/stale dialog and unchanged/approved records | Pending |
| Dirty recurrence scope, [desktop:114](../tests/e2e/desktop.spec.ts) | Discard prompt and each scope's restored fields | Pending |
| Semester-linked timetable, [desktop:122](../tests/e2e/desktop.spec.ts) | UI impact review, linked class changes and assignment preservation | Pending |
| Class semester defaults, [desktop:130](../tests/e2e/desktop.spec.ts) | UI date/zone defaults, meeting preview and final linked class | Pending |
| Computer zone, [desktop:136](../tests/e2e/desktop.spec.ts) | Independent process timezone/environment fixture, actual follow/fixed toggles and date behavior | Pending; remove main-process zone stub |
| Notification failure, [desktop:144](../tests/e2e/desktop.spec.ts) | Observed OS failure and Settings result; domain failure test retained separately | Pending; remove Notification stub |
| Week move/resize cancel, [desktop:149](../tests/e2e/desktop.spec.ts) | Actual pointer/keyboard movement, snap, cancellation and saved timing | Pending |
| Recurring week movement, [desktop:159](../tests/e2e/desktop.spec.ts) | Pointer movement, scope/review and final series timing | Pending |
| Calendar/editor accessibility, [desktop:165](../tests/e2e/desktop.spec.ts) | Axe through external renderer transport | Pending |
| 200% zoom, [desktop:169](../tests/e2e/desktop.spec.ts) | Real renderer zoom/layout and reachable day/task controls | Pending |
| ICS/backup flows, [desktop:172](../tests/e2e/desktop.spec.ts) | Native file selection/save, actual exported file, preview/copy result | Pending; native dialogs |
| Profile photo/progress, [profile:12](../tests/e2e/profile.spec.ts) | Actual file picker, uploaded/removed icon, deletion-resistant count and restart | Partial: name restart covered only; photo/progress remain |
| Invalid photo, [profile:20](../tests/e2e/profile.spec.ts) | Native malformed-file selection and preserved profile | Pending; native dialog |
| Presets/custom slots, [profile:23](../tests/e2e/profile.spec.ts) | All presets, three-slot cap, edit/delete/cancel and restart | Migrated locally and in CI: all presets, cap before/after restart, edit/delete-to-default/reuse and final restart; cancellation in light test |
| Profile/theme narrow accessibility, [profile:30](../tests/e2e/profile.spec.ts) | External window sizing, axe and screenshots | Renderer portion migrated locally and in CI at measured 1000×900 and 800×850; physical window sizing remains separate |
| Custom light palette, [profile:35](../tests/e2e/profile.spec.ts) | Light editor save/contrast and unsaved cancellation | Migrated locally and in CI: axe, cancel preserved name/colors and restart; original retained |
| Recovery drill, [recovery:13](../tests/e2e/recovery-drill.spec.ts) | Native backup/restore files, independent checksum/linked-record comparison, restart and damaged-file rejection | Pending; native dialogs/storage |
| Test notification identity, [windows:18](../tests/e2e/windows-integration.spec.ts) | Registry/shortcut file identity and observed notification result without main-process introspection | Pending; OS observation |
| Shortcut repair/cleanup, [windows:35](../tests/e2e/windows-integration.spec.ts) | Existing isolated helper tests plus externally executed Windows shell operations in a synthetic shortcut root | Pending; retain all owned-path invariants |

## Renderer migration batch specification

1. Add independent tests for all three presets and the complete three-slot custom editor: create/apply, disabled fourth slot, normal restart, edit/apply, delete-to-default and slot reuse. Observe persisted state through the ordinary UI; retain the original test.
2. Port custom-light contrast and unsaved-editor cancellation assertions, including the existing automated A/AA scan. Port profile/preset narrow-layout scans using externally controlled and measured renderer viewport dimensions; describe viewport evidence separately from physical window resizing.
3. Complete existing independent event coverage with expanded-day controls after create and restart. Complete the 404 case with keyboard return and its automated accessibility scan. Check renderer local/session storage is empty in the synthetic local profile; do not claim signed-in token verification.
4. Retain sanitized per-case summaries after normal closure, plus isolated screenshots for layout inspection. Run types and the complete independent suite locally; inspect the screenshots and summary content. Fix failed assertions or application behavior with appropriate regression evidence.
5. Update this register by exact assertion coverage, commit and run fresh Windows CI. Preserve original 31 cases until all their applicable assertions are independently covered. No native photo/file dialogs, physical-window/tray behavior, cloud authentication or remaining fuse targets are credited to this renderer batch.

## Renderer batch local result

The [three appearance tests](../tests/production/appearance.spec.ts) and expanded [two renderer tests](../tests/production/renderer.spec.ts), alongside the paired inspector case, pass together locally (six tests, final run 28.3 seconds). Measured viewport dimensions match requested values. Profile, monochrome, navy, custom-editor and light-palette screenshots were visually reviewed without observed control overlap; automated A/AA scans pass in the defined views. A new day locator initially targeted the day button as if it contained event controls; selecting the actual day cell's button resolves that test-only failure. No application code was changed.

Summaries are now emitted only after successful normal closure; failure artifacts cannot masquerade as completed per-case success. The retained private report `test-results/production-renderer-batch-0.1.10.json` records all six sanitized results and exact source/summary hashes; SHA-256 `7194592fe5aeb1bff49809e6af74462c2a3e8f7efec6c3ed11670297c7563a8d`. The owner-installed ASAR still matches `0fa8c59a4da8f6a8821e53cf154957f524a18f305ed86a7e06e474eefdec8d70`.

## Renderer batch CI result

Both [PR](https://github.com/idekakdj/C.C-Lime/actions/runs/36776331011) and [push](https://github.com/idekakdj/C.C-Lime/actions/runs/36776324379) Windows runs pass for `768c43ee2628a5ec29cdc23d9f9e7e4e2b1629c7`: **329 tests**, comprising 188 unit, 56 tooling without skips, 48 cloud, 31 original desktop and six independent cases. The six independent cases take 19 seconds on the PR runner. Fresh dependency, source/type/build, installer/notices, package credential scan and native inventory gates also pass.

The downloaded [six-summary artifact](https://github.com/idekakdj/C.C-Lime/actions/runs/36776331011/artifacts/11126270011) archive SHA-256 `bafa365f9f1b9bedafe2e7eef0dfdee197a2e09c072c78dd896fb97708dd5427` matches GitHub metadata. All six inspected summaries identify 0.1.10, disabled Node CLI inspection and successful normal exit. Private verification report `test-results/ci-independent-renderer-batch-0.1.10.json` SHA-256 `d6588cddd061323317a37250bd78aae0c429e2f060b74129f73405832d283065`. CI artifact retention is 14 days; the downloaded archive is separately retained privately. The migration register above keeps native/manual/authentication and remaining six fuse probes explicitly open.
