# Maintaining C.C. Lime

## Development boundaries

Work in a clone of `https://github.com/idekakdj/C.C-Lime`. The main process owns authentication, SQLite, synchronization and notifications. The sandboxed renderer uses an allowlisted preload API; it has no Node integration. Calendar expansion runs in a browser worker; calendar-file parsing/export runs in a bounded main-process worker.

Use Node 24.21.0/npm 11.19.0, `npm ci`, then `npm run check`. Dependencies are pinned. Patched RE2 requires at least Node 24.15 in the Node 24 line; the tested toolchain and CI use 24.21.0. Forge uses rebuild 4.2.0 throughout. CI keeps the known Visual Studio 2022 C++ toolchain on `windows-2022`; other compiler majors need separate verification. `npm run dev` runs the Vite interface; `npm start` runs the production assets. The runner temporarily rebuilds native SQLite for Electron and restores the Node binary on normal exit. After forcibly stopping it, `npm run rebuild:node` repairs a Node/Electron ABI mismatch. Do not run native unit tests while that development process owns the Electron binary.

npm 11.19 blocks unapproved dependency lifecycle scripts. `allowScripts` permits the reviewed, version-pinned esbuild binary setup and RE2 native install. It denies Firebase util's environment-to-bundle hook, protobufjs's optional warning hook and electron-winstaller's broken architecture-selection hook. `npm run make` explicitly copies and verifies the installed dependency's existing x64 7-Zip vendor files instead. This workaround is for Windows x64. Review new hooks/version changes individually; never enable every dependency script to resolve an install failure. Tooling tests require native RE2 to load instead of accepting the hosting helper's JavaScript fallback.

`npm run package` creates the packaged app. `npm run make` also creates the Squirrel Windows x64 installer. Run `npm run check:package` against the resulting ASAR, then `npm run test:e2e`. Desktop tests use unique isolated profiles and synthetic records. File-dialog selections are stubbed in automation; the actual import/export and persistence code executes. Native banner display, sleep, login and screen-reader checks require separate observations.

After packaging, `node scripts/measure-performance.mjs` runs the large-fixture checks; `node scripts/measure-idle.mjs` then measures two five-minute idle intervals. See [performance evidence](PERFORMANCE.md) for the current results and remaining misses.

## Windows notification installation

Version 0.1.4 owns its Squirrel lifecycle explicitly in `src/main/windows-integration.ts`. It waits for shortcut creation before aligning the root, installer and existing desktop shortcuts. The installed AUMID and toast activator are stable public identifiers; never generate a new one on update. Electron adopts the root shortcut's activator, so align shortcuts before initializing its notification presenter. Normal installed startup also repairs stale metadata. Changed shortcuts are backed up once per location under the private profile's `shortcut-backups` directory. A foreign/unreadable shortcut or failed write disables native submission for that run while keeping the calendar usable; Settings reports dispatch failure.

Packaged previews/development and isolated test profiles use separate notification names, AUMIDs and activators, and never initialize or submit Windows native notifications. Electron's shortcut filename comes from the executable resource rather than `app.setName`, so runtime naming alone is insufficient isolation. Native reminders require a normal installed Windows launch. These restrictions preserve existing calendar profile paths and prevent test runs from rewriting installed shortcuts. The Windows integration suite exercises actual `.lnk` files inside isolated workspace fixtures; it does not uninstall the owner's application. Installer events never initialize calendar stores or windows. Uninstall removes Squirrel shortcuts, the app-owned root shortcut targeting this installation, and its login setting; full uninstall and clean-PC acceptance still require a separate observation. See the [implementation/test plan](WINDOWS_NOTIFICATION_PLAN.md).

## Private cloud setup

See [Local configuration](LOCAL_CONFIGURATION.md). Never put credential values in source, `VITE_` variables, CI logs, fixtures or installers. The owner-provided Google JSON belongs in `.local/google-oauth.json`; `node scripts/import-google-oauth.mjs` imports validated values into `.local/.env`. Both locations are ignored. Do not copy the local folder when sharing the repository or installer.

The current Firebase project is `cc-lime-8d41b`, with email/password and Google enabled. Firestore uses the default database in Toronto. Database access requires a verified identity and matching account ID. No billing upgrade is required by the implemented deployment. Review actual provider quotas before expanding the pilot.

Use the owner's Firebase CLI login for deployment; do not create or commit an administrator key. `node scripts/cloud-admin.mjs auth-config` prepares ignored provider configuration. The helper is owner-only and excluded from the desktop package. Do not print returned credentials from administrative APIs. Configuration-file validation alone does not prove Google consent or live token exchange.

Deploy committed rules/indexes with the Firebase CLI for the intended project. Before changing rules, run `npm run test:cloud`. The emulator launcher needs Java 21+ in `JAVA_HOME` or its documented ignored `.tools/java` fallback. Emulator tests cover record/head/receipt atomic groups, authorization, conflict behavior and interrupted deletion. They do not replace live provider and real-device tests.

## Data protocol and recovery

Version 0.1.3 adds a 60-commit/60-second verified-account quota to the existing Firestore sync head. The four-record maximum is unchanged. `rateWindowStart` must be a server timestamp; `rateWindowCount` increments atomically and cannot exceed 60. Legacy heads migrate on their next new-client write. **Upgrade all pilot clients before deploying the new rules:** 0.1.2 and older omit required quota fields and will be denied writes. Preserve their local queues. See the [precise rollout/test specification](SECURITY_PRIVACY_PLAN.md#t-51-server-enforced-calendar-mutation-quota) and [sync protocol](SYNC_PROTOCOL.md).

Action limits and provider cooldowns run in the main process. They do not constrain a modified client. The server write quota survives device restarts and alternate clients, but it does not limit reads, signup abuse, rejected requests or privileged Admin SDK operations. Firebase's own protections and quotas also apply. Additional remote abuse/alerting architecture remains T-53; do not claim universal rate limiting or denial-of-service protection. The 404 screen covers the local app protocol, not a hosted website.

The [security/privacy plan](SECURITY_PRIVACY_PLAN.md) also defines operator-owned policies, legal reviews, evidence and independent assurance gates. Do not publish a certification/compliance claim based on tests, this plan or supplier certifications.

Read [Sync protocol](SYNC_PROTOCOL.md) before editing queues, receipts, cursors or conflict resolution. Never discard an unacknowledged mutation after a network timeout. Group-linked edits use at most four domain records plus a head and receipt; security-rule access limits are tested for this exact shape. Preserve tombstones and mutation receipts for the lifetime of an active account. The retained deletion marker prevents still-valid old tokens from recreating deleted data.

SQLite schema version is currently 1. There is no prior production schema upgrade to claim as verified. Introduce a migration and a seeded older-schema test together before increasing it. Make a consistent pre-migration snapshot and preserve the original database on failure. Keep corrupted databases and sidecars during recovery; never replace them based only on a filename.

Automatic snapshots and manual export files contain user data. Do not include them in CI artifacts, bug reports or release assets. CI retains its credential-scanned dependency evidence on successful generation for 14 days; synthetic desktop results upload on failure. Keep live account checks and owner credentials outside public test fixtures. See the [data inventory](PRIVACY_DATA_INVENTORY.md) for actual retention and deletion limitations; its policies are not yet approved.

From source version 0.1.6, quick-undo cleanup removes only rows with `expires_ms < now` on account open, mutation housekeeping, undo attempts, ordinary snapshots and existing scheduler reconciliation. Exact-expiry undo remains valid. Expected SQLite cleanup failures are retried on later lifecycle opportunities without rejecting an already saved mutation; the expiry guard still rejects expired undo. The idle scheduler normally checks within 60 seconds while active and awake. This is logical deletion, not forensic erasure or a guarantee during sleep, closed accounts or storage failure. Pre-migration snapshots preserve the previous schema verbatim. Existing snapshot/import/quarantine history, queues and cloud markers have not acquired a new retention policy. The installed 0.1.5 does not yet have this cleanup.

## Release procedure

1. Reconcile every task and acceptance scenario with the evidence document. A partial test is not a pass. Resolve outstanding functional and mandatory verification gaps before labeling a production release complete.
2. Run source/secret/type/unit/build checks, cloud emulator checks when cloud code changes, packaged desktop tests and the packaged credential scan. Record exact counts and build version.
3. Measure the specified large fixture and five-minute foreground/tray resource use. Record actual hardware, median and slowest response, and client cloud-operation counters. Rules-dependent reads are additional usage.
4. Verify the installed artifact, native reminder/banner activation, real sleep/resume, login startup, session restoration, update/uninstall, accessibility and a second physical PC. Preserve the user's startup and reminder preferences during checks.
5. Generate `npm run security:report` and review actual bundled/runtime/build-tool exposure. Require a fresh successful `npm run check:release-security` before production approval; it currently exits 1 because findings remain. The conservative gate blocks every severity since devDependencies include bundled app libraries. A reporting-only preview CI pass is not release approval. Do not apply `audit fix --force` or suppress findings without reviewed treatment. See [dependency evidence](SUPPLY_CHAIN_REPORT.md), including inventory limits, hashes and override compatibility.
6. Build the installer, record SHA-256 and size, inspect its archive, and retain version-specific evidence. Signing is a separate owner decision. Never describe an unsigned installer as signed or warning-free.
7. Commit source and documentation only. A public GitHub release is a separate intentional publication step. Attach only the installer/checksum/release notes; never local configuration, live test accounts, diagnostic logs or private calendars.

## Credential incident record

The original Firebase client key reached Git history in `45333f7`. It was replaced with a restricted local-only key and the old key was revoked; current source removes the credential. That historical commit still exists. Never reuse the old value. Rewriting shared Git history requires a separate owner decision. The newer Google desktop client has been imported privately and is subject to the same source/package scans.
