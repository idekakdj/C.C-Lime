# Dependency treatment and release evidence

## September 28 extraction repair: source 0.1.7, installed 0.1.5

The [ordered extraction plan](ARCHIVE_EXTRACTION_PLAN.md) precedes the change. Forge 7.11.2's packager 18.4.4 was the only resolved consumer of the vulnerable `extract-zip` package. A scoped override now resolves that consumer to `@electron-internal/extract-zip` 1.0.5, the same native implementation already used by Electron 44.4.2. The lockfile removes the old extractor and seven installed helper packages; other consumers are unchanged. This is an implementation replacement with containment checks, not an advisory suppression.

Official [packager 20.3.0](https://github.com/electron/packager/releases/tag/v20.3.0) also uses this implementation, but its hook interface differs from the callbacks used by the current Forge, so the packager major version is retained. Tests load the actual existing CommonJS extraction wrapper and native replacement. The replacement's [security policy](https://raw.githubusercontent.com/electron/extract-zip/v1.0.5/SECURITY.md) supports trusted, checksum-verified Electron distributions through Electron tooling; general untrusted archives and preseeded destinations are outside its supported scope. This app does not use the extractor for user calendar import.

`scripts/electron-build-policy.cjs` pins the official Windows x64 Electron 44.4.2 archive SHA-256 `6aae435b6cd5c0eedf9fd38824bae4045ffdaecd029f0b8c8328bac3f5b71f03`, retrieved from the [release checksum file](https://github.com/electron/electron/releases/download/v44.4.2/SHASUMS256.txt) and cross-checked with the installed Electron package. The policy rejects custom local archives/download options, mirror/version environment selectors and unreviewed target/version changes. The actual downloader validates both cached and fresh bytes against that digest. The pre-package hook creates a unique parent; packager creates an empty extraction child. Post-package cleanup validates the same process's saved root, resolved path and filesystem identity before removing it. Failure may retain that build's root for review; unrelated roots are not cleaned. A trusted build account, checkout and installed tools are assumed; same-user concurrent compromise remains outside this guarantee.

Full npm audit at **2026-09-28 19:18 UTC**: **zero affected-package findings in every severity**, down from 15 high findings in 0.1.6. `npm run check:release-security` exits **0**. CI now uses this blocking command, with an evidence-upload attempt even on failure. An unavailable/malformed audit still fails closed. The flag `releaseAllowed` in generated evidence refers only to this dependency gate; signing, manual acceptance, native-component review, operator/legal decisions and independent assurance remain open.

Local checks: **158 app unit tests, 36 cloud tests and all 25 packaged desktop cases pass**; types, production build, native package and Squirrel maker pass. **31 of 33 tooling cases pass, with two explicitly skipped because this laptop cannot create file symlinks.** The skipped cases are positive relative-link extraction and pre-existing leaf-link replacement; CI must run both and fails instead of skipping if that host is also incapable. Passing cases exercise normal bytes/overwrites, traversal/absolute/reserved paths, outside/chained links, mixed/duplicate entries, directory junctions, checksum/cache failures, rejected build overrides and scoped cleanup. The initial mixed duplicate fixture incorrectly expected every archive to reject: the parser keeps the final regular entry. The corrected test proves that regular file stays inside the destination and the outside sentinel remains unchanged; the reversed order is rejected. No destructive archive/bomb or user-file target was used.

| Exact 0.1.7 dependency evidence | Value |
| --- | --- |
| Full npm CycloneDX components | 1,126 |
| Lockfile SHA-256 | `b0313d161edc0aa7c6ca3118fe48fad7345585904f223024ee1ecb9bc8c75f66` |
| Audit SHA-256 | `f5a3ec0aab8fa3c4309d06de4c1a7369715af18b49f8c30bc09c1fd6c6e03a30` |
| CycloneDX SHA-256 | `0f5ae19693cedbd53e39347a97fdc3b930a64f7ccd7d7fc71db9bf3a7a1e3fa6` |
| Unsigned installer | `CC-Lime-0.1.7-Setup-x64.exe`, 166,069,760 bytes |
| Installer SHA-256 | `e1e3d7b1de37ae2cc4e2ace921c48ac44d115e59d5b73a3bc189ce959cb695c6` |
| Tested ASAR SHA-256 | `cd2b7e67902a4aa4c01c4af153326c2ed9239853f41b5b75c9c2bd1fa7a5ff5a` |

This is a complete npm-lockfile inventory, not an inventory of internal native dependencies in Electron/Chromium or the Rust extractor. Unknown/new advisories and administrative compromise are not ruled out by a zero npm result. Review those components/provenance separately. The exact 0.1.6 installer and its dependency evidence are retained privately before regeneration; 0.1.5 stays installed. Final package/desktop/CI evidence is recorded in [implementation status](IMPLEMENTATION_STATUS.md).

## Historical September 28 follow-up: source 0.1.6, installed 0.1.5

The [follow-up plan](RELEASE_FOLLOWUP_PLAN.md) keeps the requested owner installation at the verified 0.1.5 artifact. Subsequent fixes are separately versioned 0.1.6. No public release or risk acceptance is implied. T-45/T-58 remain open.

| Follow-up | Resolution and verification |
| --- | --- |
| Firebase CLI → Pub/Sub → OpenTelemetry core | Scoped root override pins 2.8.0, matching the CLI's own override intent (transitive overrides are not inherited by npm). Actual W3C trace injection/extraction passes. [Advisory](https://github.com/advisories/GHSA-8988-4f7v-96qf). |
| Firebase CLI → gaxios → UUID | Scoped 11.1.1 pin follows the CLI's declared intent. Required v4 generation and short-buffer rejection pass. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq). |
| Firebase CLI → hosting → RE2 | Pin 1.27.0 and use a supported Node runtime. Native load, hosting match/nonmatch, Unicode named captures and replacement pass; tests reject silent JavaScript fallback. [Bounds-read advisory](https://github.com/advisories/GHSA-j4r3-hg7j-8chg). |
| Build runtime / install hooks | Project-local Node 24.21.0/npm 11.19.0; system Node unchanged. Official Windows x64 archive verified against the [publisher checksum list](https://nodejs.org/dist/v24.21.0/SHASUMS256.txt): `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`. CI uses the same Node version. npm's manifest policy approves only pinned esbuild/RE2 hooks; unused Firebase/protobuf hooks and the broken installer hook are denied. An explicit step selects/verifies existing x64 installer tools. CI now builds the installer too. |

Full audit at **2026-09-28 05:40 UTC**: **15 high, zero critical/moderate/low**, down from 21 affected packages in 0.1.5. All remaining findings trace to `extract-zip` 2.0.1 and inherited tooling parents. This is a count of affected packages, not 15 independent vulnerabilities. No advisories were suppressed. The production dependency gate generated fresh evidence and correctly exited **1, blocked**.

The two extraction advisories have no patched npm release at this review: [symlink target validation](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) and [final-path symlink writes](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3). Upstream [PR 160](https://github.com/max-mapper/extract-zip/pull/160) remains open and addresses final-component containment; it is not proof that both advisories are repaired in a published dependency. Next: review a maintained replacement or complete upstream patches, exercise safe synthetic traversal/symlink/duplicate-entry/pre-existing-target archives, inspect compatibility at each caller, then rebuild/test the real Windows package. Do not force an incompatible Forge downgrade or assume that rejecting all symlinks is compatible with every future platform archive.

Concrete replacement candidate for the next review: `@electron-internal/extract-zip` 1.0.5, already present elsewhere in the lockfile. Its [versioned API](https://github.com/electron/extract-zip/tree/v1.0.5) is ESM and accepts only `dir`; the inspected packager caller uses `dir` through a CommonJS default-import wrapper, which still needs an actual compatibility test. Its [security policy](https://raw.githubusercontent.com/electron/extract-zip/v1.0.5/SECURITY.md) limits supported security reports to checksum-verified, trusted Electron archives used by Electron tooling and excludes attacker-preseeded destinations. Before any substitution, verify download/checksum and cache/custom-archive paths, destination creation/ownership, native loading and every resolved caller. Archive containment tests must check filesystem effects, not just whether a promise rejects. An npm alias removing an advisory name would not itself demonstrate remediation. No substitution or waiver is included in this checkpoint.

Local verification: **158 app unit tests, 12 tooling checks, 36 cloud emulator tests and all 25 packaged desktop tests pass** (desktop suite: 2.5 minutes). Types, production build, native SQLite rebuild, Windows package and Squirrel installer pass. The archive scan inspects 204 entries with no configured credentials or excluded local/output paths. Root `release`/`build` directories are now excluded and checked so retained earlier installers cannot be accidentally bundled. These checks do not establish complete native Electron/Chromium review or production approval.

| Exact 0.1.6 evidence | Value |
| --- | --- |
| Full npm CycloneDX component count | 1,132 |
| Lockfile SHA-256 | `6cc315afcd4127f4044f2fc29b6cfdbd29abb63589c73bf9389e5a5709349cec` |
| Audit SHA-256 | `3254d4377174800811c543ec708a2c60c15da2408fe0fa51331733ea7c2ce9e4` |
| CycloneDX SHA-256 | `1f947db236a7d116b3676f5e943860b1368b382391e1719ac3e6f0063f6f615a` |
| Unsigned installer | `CC-Lime-0.1.6-Setup-x64.exe`, 166,069,248 bytes |
| Installer SHA-256 | `a7261e4c6eed3ae6b1ac491bb6036e0007a5b8e286a6a0993cbc94ad4ae58b5f` |
| Tested ASAR SHA-256 | `7e215efd43d24f7087a56f5ce06d1f1211108398a54f0523d8d08157f89929cc` |

The ignored 0.1.5 installer is retained under `release/0.1.5` with its original hash below. Installed ASAR identity, real-profile preservation, populated upgrade fixture and all 25 installed desktop checks passed for 0.1.5; see [implementation evidence](IMPLEMENTATION_STATUS.md). Version 0.1.6 is built/tested locally, not installed over it. Generated dependency evidence remains ignored locally and retained by CI for 14 days. A later evidence refresh changes metadata/hashes, so compare each report with its corresponding saved summary.

## Historical 0.1.5 build checkpoint

September 27, 2026 (America/Toronto); evidence generated September 28 at 00:32 UTC. Build 0.1.5, owner-only distribution scope. T-45/T-58 remain open. [Ordered plan](SUPPLY_CHAIN_PLAN.md).

## Changes and exposure

| Path | Before / after | Treatment and verification |
| --- | --- | --- |
| Forge native build → rebuild → old node-gyp/tar | Nested rebuild 3.7.2 / unified direct 4.2.0; tar 6.2.1 removed, resolved tar 7.5.22 | Explicit `$@electron/rebuild` override avoids two incompatible build trees. Forge's CommonJS child requires the exported `rebuild` function and its lifecycle events; compatibility tested on Node 24.13.0 and through actual SQLite native rebuild, Forge package and Squirrel maker. [Critical tar advisory](https://github.com/advisories/GHSA-23hp-3jrh-7fpw). |
| Forge interactive editor → temporary files | tmp 0.0.33 / 0.2.7 | Explicit pinned override; actual external-editor construction, content read and cleanup pass without opening an editor. [tmp advisory](https://github.com/advisories/GHSA-ph9p-34f9-6g65). |
| Firebase administrative CLI | 15.30.2 / 15.31.0 | Pinned patch; all 36 local authentication/Firestore emulator tests pass. No live provider/rule/billing change. The patch does not resolve every transitive advisory. |

The update removed 112 installed packages. All 150 app unit tests plus nine tooling checks, type checking and production build pass. Node 24.13.0/npm 11.12.0 is the tested toolchain; do not assume compatibility with older Node versions. No app schema, cloud protocol, Firestore rules or notification behavior was changed.

## Actual audit result and remaining work

| Full npm audit | Critical | High | Moderate | Low | Total affected packages |
| --- | --- | --- | --- | --- | --- |
| Before | 1 | 20 | 8 | 3 | 32 |
| After | 0 | 15 | 6 | 0 | 21 |

These are affected-package findings including inherited parent findings, **not counts of distinct vulnerabilities**. The separate `omit=dev` check reports zero findings but covers only the runtime manifest subset; bundled libraries also come from devDependencies, so it cannot establish that the shipped application is vulnerability-free. The full inventory is retained for review.

| Remaining root advisory package | Observed exposure / required treatment |
| --- | --- |
| `extract-zip` 2.0.1 | Forge/packager build archive extraction; two high symlink/path-write advisories propagate to 14 other tooling packages. No patched registry version observed. An npm suggested Forge downgrade is not an approved repair. Evaluate a maintained replacement or reviewed upstream fix, prove archive containment with safe synthetic tests, then verify real packaging. [Advisory one](https://github.com/advisories/GHSA-jmr9-qjv8-65gv), [advisory two](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3). |
| `@opentelemetry/core` | Firebase CLI → Pub/Sub path; unbounded baggage allocation advisory. Review supported provider-tool update and propagation behavior before overriding major APIs. [Advisory](https://github.com/advisories/GHSA-8988-4f7v-96qf). |
| `uuid` | Firebase CLI → gaxios; buffer bounds advisory. Review patched compatible dependency resolution and the relevant call sites; a major downgrade of the entire CLI is not automatic acceptance. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq). |
| `re2` | Firebase administrative tooling; crash, unbounded-loop and bounds-read findings. Follow-up must update the compatible native module and exercise the CLI paths, not just change a lockfile version. [Bounds-read advisory](https://github.com/advisories/GHSA-j4r3-hg7j-8chg). |

These observed dependency paths are build/administrative tooling. That is exposure context, not a waiver: build compromise can affect distributed binaries. No malicious archive/decompression bomb or destructive abuse test was run. No finding has been suppressed or accepted. Independent penetration review and native Electron/Chromium component review remain outstanding.

## Reproducible commands and gate semantics

1. Use the pinned toolchain and `npm ci`; run `npm run check` (credential scan, tooling checks, types, app tests, build).
2. `npm run security:report` queries npm audit and generates a **CycloneDX full-lockfile inventory**, including build tools and bundled devDependencies. It reports unresolved findings while allowing preview verification to continue. Registry/JSON/schema failures still fail the command. CI retains this evidence for 14 days.
3. `npm run check:release-security` refreshes the same evidence and exits nonzero if **any** reported finding remains. This intentionally exceeds the minimum high/critical gate because dev/runtime labels alone do not identify bundled code. Nine checks verify clean/nonclean severities, malformed/inconsistent data and dependency API compatibility. The current command correctly exits **1: blocked**, after successfully generating evidence.
4. `npm run test:cloud`, `npm run make`, `npm run check:package` and `npm run test:e2e` verify provider-tool/native packaging and isolated desktop behavior. A successful preview CI/build does not mean production security approval. There is no public release/publish automation wired to bypass this manual gate.

The evidence command removes only its prior three generated success files before refresh, validates both reports and unchanged lockfile, scans for configured credential values/signatures, then writes results. It never prints credential values. Reports stay under ignored `test-results/supply-chain` locally; CI has no private environment file. Future artifact retention/access policy remains T-55/T-58. GitHub workflow token permissions are now explicitly read-only for repository contents.

## Recorded inventory and artifact

- CycloneDX inventory: **1,127 components**. It inventories npm packages, not Electron/Chromium's complete native internals.
- Lockfile SHA-256: `8b2310bb2fe8edc8d9430fc29456dc2f396dcd467696de6fc3e187a1cf6a4528`.
- Audit JSON SHA-256: `5fd72ec11c457c18d27110c87435142d6431fdf8aa7e87f56a4cbce75db23682`.
- CycloneDX JSON SHA-256: `b8a948042d17b31e15db896749b1e0b992e4b33f1ac572f528996e28d8132a95`.
- Regeneration can change timestamps/serial IDs/report metadata; compare the exact saved artifact against its own summary, not a newly generated byte hash.
- Unsigned `CC-Lime-0.1.5-Setup-x64.exe`: **166,068,736 bytes**, SHA-256 `c0b25f524b39f832598a7672d056074a6dde3bab1d5a873b5e61a6ffa5cb90df`.
- Tested package ASAR SHA-256: `b933b74971f4c544b3abc39d5f62d164fba4014b1bcb8fe50439910fc5531240`; credential scan covers **204 entries**, no private configuration/credential values found.
- At this original build checkpoint 0.1.5 had not been installed over 0.1.4. The subsequent owner upgrade is now verified as recorded above; no public release asset was uploaded. That patch updated build tooling and evidence, not user-facing calendar behavior.

See [implementation status](IMPLEMENTATION_STATUS.md) for final desktop/CI observations. Signing, clean-PC release acceptance, outstanding dependency remediation and organizational approval remain required. No SOC report, ISO certificate, DGSI conformance finding or privacy-law compliance opinion is established here.
