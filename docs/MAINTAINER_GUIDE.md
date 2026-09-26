# Maintaining C.C. Lime

## Development boundaries

Work in a clone of `https://github.com/idekakdj/C.C-Lime`. The main process owns authentication, SQLite, synchronization and notifications. The sandboxed renderer uses an allowlisted preload API; it has no Node integration. Calendar expansion runs in a browser worker; calendar-file parsing/export runs in a bounded main-process worker.

Use Node 24.13.0, `npm ci`, then `npm run check`. Dependencies are pinned. Windows native compilation needs Visual Studio 2022 with its C++ workload; the pinned Electron node-gyp does not recognize Visual Studio major 18. CI uses `windows-2022` explicitly rather than the moving latest image. `npm run dev` runs the Vite interface; `npm start` runs the production assets. The runner temporarily rebuilds native SQLite for Electron and restores the Node binary on normal exit. After forcibly stopping it, `npm run rebuild:node` repairs a Node/Electron ABI mismatch. Do not run native unit tests while that development process owns the Electron binary.

`npm run package` creates the packaged app. `npm run make` also creates the Squirrel Windows x64 installer. Run `npm run check:package` against the resulting ASAR, then `npm run test:e2e`. Desktop tests use unique isolated profiles and synthetic records. File-dialog selections are stubbed in automation; the actual import/export and persistence code executes. Native banner display, sleep, login and screen-reader checks require separate observations.

After packaging, `node scripts/measure-performance.mjs` runs the large-fixture checks; `node scripts/measure-idle.mjs` then measures two five-minute idle intervals. See [performance evidence](PERFORMANCE.md) for the current results and remaining misses.

## Private cloud setup

See [Local configuration](LOCAL_CONFIGURATION.md). Never put credential values in source, `VITE_` variables, CI logs, fixtures or installers. The owner-provided Google JSON belongs in `.local/google-oauth.json`; `node scripts/import-google-oauth.mjs` imports validated values into `.local/.env`. Both locations are ignored. Do not copy the local folder when sharing the repository or installer.

The current Firebase project is `cc-lime-8d41b`, with email/password and Google enabled. Firestore uses the default database in Toronto. Database access requires a verified identity and matching account ID. No billing upgrade is required by the implemented deployment. Review actual provider quotas before expanding the pilot.

Use the owner's Firebase CLI login for deployment; do not create or commit an administrator key. `node scripts/cloud-admin.mjs auth-config` prepares ignored provider configuration. The helper is owner-only and excluded from the desktop package. Do not print returned credentials from administrative APIs. Configuration-file validation alone does not prove Google consent or live token exchange.

Deploy committed rules/indexes with the Firebase CLI for the intended project. Before changing rules, run `npm run test:cloud`. The emulator launcher needs Java 21+ in `JAVA_HOME` or its documented ignored `.tools/java` fallback. Emulator tests cover record/head/receipt atomic groups, authorization, conflict behavior and interrupted deletion. They do not replace live provider and real-device tests.

## Data protocol and recovery

Read [Sync protocol](SYNC_PROTOCOL.md) before editing queues, receipts, cursors or conflict resolution. Never discard an unacknowledged mutation after a network timeout. Group-linked edits use at most four domain records plus a head and receipt; security-rule access limits are tested for this exact shape. Preserve tombstones and mutation receipts for the lifetime of an active account. The retained deletion marker prevents still-valid old tokens from recreating deleted data.

SQLite schema version is currently 1. There is no prior production schema upgrade to claim as verified. Introduce a migration and a seeded older-schema test together before increasing it. Make a consistent pre-migration snapshot and preserve the original database on failure. Keep corrupted databases and sidecars during recovery; never replace them based only on a filename.

Automatic snapshots and manual export files contain user data. Do not include them in CI artifacts, bug reports or release assets. CI uploads its synthetic `test-results` only on failure. Keep live account checks and owner credentials outside public test fixtures.

## Release procedure

1. Reconcile every task and acceptance scenario with the evidence document. A partial test is not a pass. Resolve outstanding functional and mandatory verification gaps before labeling a production release complete.
2. Run source/secret/type/unit/build checks, cloud emulator checks when cloud code changes, packaged desktop tests and the packaged credential scan. Record exact counts and build version.
3. Measure the specified large fixture and five-minute foreground/tray resource use. Record actual hardware, median and slowest response, and client cloud-operation counters. Rules-dependent reads are additional usage.
4. Verify the installed artifact, native reminder/banner activation, real sleep/resume, login startup, session restoration, update/uninstall, accessibility and a second physical PC. Preserve the user's startup and reminder preferences during checks.
5. Review dependency audit output by actual runtime and build-tool exposure. Do not apply breaking `audit fix --force` updates without compatibility testing. The current toolchain has unresolved advisories; consult the evidence document.
6. Build the installer, record SHA-256 and size, inspect its archive, and retain version-specific evidence. Signing is a separate owner decision. Never describe an unsigned installer as signed or warning-free.
7. Commit source and documentation only. A public GitHub release is a separate intentional publication step. Attach only the installer/checksum/release notes; never local configuration, live test accounts, diagnostic logs or private calendars.

## Credential incident record

The original Firebase client key reached Git history in `45333f7`. It was replaced with a restricted local-only key and the old key was revoked; current source removes the credential. That historical commit still exists. Never reuse the old value. Rewriting shared Git history requires a separate owner decision. The newer Google desktop client has been imported privately and is subject to the same source/package scans.
