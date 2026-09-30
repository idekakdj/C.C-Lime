# Production acceptance coverage migration

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
