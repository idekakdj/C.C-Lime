# Dependency treatment and release evidence

## October 1: Node 24-native action follow-up

The first immutable-v4-action checkpoint passes 449 tests with downloaded 34/24-case artifact identities verified in the [implementation register](IMPLEMENTATION_STATUS.md). Its Node-20 deprecation warning prompted a separate [reviewed migration](SECURITY_CONTINUATION_0115.md): official stable releases checkout v7.0.1, setup-node v7.0.0, setup-java v6.0.1 and upload-artifact v7.0.1 are pinned by exact commit in the [manifest](../.github/action-pins.json). Official action.yml files declare Node 24; current inputs and hosted runner 2.337.0 were reviewed for compatibility. Explicit ZIP archiving preserves evidence format, unsafe fork checkout is refused and persisted checkout credentials remain disabled. Runtime/input policy checks supplement immutable references. Both fresh Windows runs at `4cb1e5c` pass 450 tests without skips and without the Node-20-action warning; downloaded baseline/combined ZIP digests and all 58 summary/archive/fuse identities verify. Exact evidence is in the implementation register. No application dependency, version, installed artifact, repository protection or administrator MFA changed. This scoped review does not audit all bundled upstream source or confer release/compliance approval.

## October 1 continued CI identity and compatibility checkpoint

The [security continuation](SECURITY_CONTINUATION_0115.md) pins all four existing v4 action repositories to verified official commit IDs in the [manifest](../.github/action-pins.json), disables persisted checkout credentials and adds six workflow policy controls. Dependency/major/runner versions are unchanged; the existing YAML 2.9.1 lock entry supplies the parser. Commit pinning freezes the resolved action identity; full upstream review, repository-protection enforcement and administrator MFA remain separate.

Local source verification has 198 credential-scanned files, 236 unit/UI passes, 60 tooling passes and two explicit symlink-permission skips; type/build passes and all nine application files match the retained archive. Independent suites pass 34 baseline and 24 combined-fuse renderer cases. Private evidence SHA-256 `f775bb79d8128b2c393d6c3bebae5f65196b8a09152d3286d90301c4b370d69e`. Installed archive/installer identities below remain unchanged. No hardened release, signing/provenance approval or formal assurance is claimed; fresh CI and native/manual observations are separately tracked in the [implementation register](IMPLEMENTATION_STATUS.md).

## October 1 installed 0.1.15 checkpoint

The authorized owner-only upgrade is installed. Application source `1260ad6`; subsequent test-only hardening evidence `05c1df9`. Unsigned private installer: 168,030,208 bytes, SHA-256 `9bae5faa8c07faab2edc96558e18daaffda22bc8598bf900726c027af8f5b97a`; local/installed ASAR `32a6bb564035fea52c235d36bd269eeb390241b80e6eb70d0e18feb9559440d0`. Exact executable, installer-payload/archive equality, nine rebuilt files, archive credentials and complete Chromium notice/version checks pass. Electron 44.4.5, SQLite 3.53.4 and dependency versions are unchanged; the 1,126-component gate reports zero affected packages. Native inventories cover source 83/15 and installed 84/16 files/native entries. Source credential scan covers 185 publishable files; package scan covers 205 entries.

Both security-source Windows runs pass 411 tests without skips. Downloaded 26-case evidence has 15 fingerprints matching CI ASAR `4bf867fd3e20b20a3a459fa599187270e4cfa78e2907b197e248bf7abaf9fa37`; artifact ZIP `10c8413f5e2667dee483f3ba3924158333760c957f2443c7b893c73ae8422eb9`. These CI bytes are distinct from the retained installed artifact. Full identities and links are in [implementation evidence](IMPLEMENTATION_STATUS.md). The NODE_OPTIONS probe modifies disposable copies only; all seven production fuse gaps remain. No public release asset, signing purchase, full native provenance approval or formal assurance is implied. Earlier source-only checkpoints below are historical.

## October 1 source-work verification; installed release unchanged

Calendar/repetition/task changes do not change dependency versions. Final local source-work verification at `a6b017055fb762b2c97eeec0bc8f439dd330e090` passes the 1,126-component npm gate with zero affected-package findings, 182-file source/205-entry archive credential scans, nine exact rebuilt-file comparisons and the 83-file/15-native inventory. Electron 44.4.5, SQLite 3.53.4, Chromium notices and seven open production fuse gaps are recorded by the collector. These are bounded inventory/check results, not complete native advisory coverage or provenance approval.

Source-work ASAR SHA-256 `b06e6b463505246fd817d509948bece780c26477aedb493304f502fb67164433` is distinct from the retained installed 0.1.14 archive. All 25 independent cases pass locally with normal exit and Node CLI inspection disabled; 14 summaries fingerprint that source-work archive. The retained installer remains SHA-256 `0c6beb664db6fec8093c034ca7144d7d7605a21f9acd17914e670c7cafc6db20`; no installer was built for distribution or installed in this continuation. Both fresh Windows runs pass 410 tests without skips; downloaded evidence verifies 25 normally exited independent cases and 14 exact CI archive fingerprints. CI ASAR SHA-256 `cc47e4c6771caf5aaf5dae33776f45a2e9cebb6fd2437efea643f786d92ab1aa` and artifact ZIP SHA-256 `9e21ecbc952eeb265cf6c86faec4120031cc2cf42b5918c0ab83a24b2f248d7f` are separately identified from the local source-work and retained installed bytes. Detailed local reports stay ignored; [implementation evidence](IMPLEMENTATION_STATUS.md) records exact identity and release boundaries. Signing, native provenance, protected release/access controls and formal assurance remain open.

## September 30: 0.1.14 course correction artifact

Unsigned retained installer: 168,030,208 bytes; SHA-256 `0c6beb664db6fec8093c034ca7144d7d7605a21f9acd17914e670c7cafc6db20`. ASAR `bcacee12885f6265dda092eccd0c47cc858340a55202c6be03866ee22be435f2`; lockfile `88cfcd2bbeef44b96c9a1b1a8f9d8b9f0b6171d1b75ec42a5cac1d7c6000749b`. Audit: 1,126 components, zero affected-package findings. Source/package scans, 205 archive entries, 83 files/15 native entries, nine exact dist files, exact 20,472,830-byte installer notices/version and installer-payload/archive equality pass. Seven production fuse gaps remain. Normal installation identity/profile/startup preservation passes. Both fresh Windows CI runs pass for final code `cb64c80`; installed executable/archive/notices, private profile and startup preservation pass. Later documentation changes do not alter retained application bytes. Native provenance/signing and formal assurance remain open.

## September 30: 0.1.13 artifact checkpoint

Unsigned owner-only installer: 168,030,720 bytes, SHA-256 `5034f210d1e4c01f5e469374d0e99653142fb437f2c21c606d9b66a20c760ab7`. ASAR `dc3212ae05085293feffc6d0821564c9aebd9d13f2051999e6c4115ba61274d4`; lockfile `c7f7544af0bb93ec664026089a488446b8119d5f5971add0bb4f80732b7bbd0f`. Full npm audit: 1,126 components, zero affected-package findings. Package inspection: 205 entries; native inventory: 83 files/15 native entries and seven open production fuse gaps. Exact 20,472,830-byte Chromium notice content and installer version metadata pass. All nine dist files match the archive. Normal installed executable/archive/notices equality and profile preservation pass. Installed native inventory covers 84 files/16 native entries, including the additional Squirrel executable. These checks do not establish signing, native provenance or formal compliance.


## September 30: retained and installed 0.1.12

Startup application changes and the version bump do not change dependencies or cloud rules. The full npm gate passes with 1,126 components and zero findings. Lockfile SHA-256 `c01f56632273190dfa5bf7c70d5ac73aec38bda06674d0fe145d95316d7e4634`. All nine rebuilt application files match the tested archive; inspection covers 205 archive entries without private configuration/credentials, 83 physical files/15 native files, Electron 44.4.5 and SQLite 3.53.4. Exact Chromium notices are present in both installer and normal installed copy. Seven fuse gaps and the native review/signing limits remain open.

The retained unsigned installer is 168,030,720 bytes, SHA-256 `4acf25bbd8ef63b82dabf242193a44ee6e7f73237abc314dd16f19c17595282b`. Packaged/normal-installed ASAR SHA-256 `2b65cd1996c89254c58951fdb3974c0eb477a6ed46120299e2a52c67b7429f4a`. Retained installers, detailed reports, profile backups and startup diagnostics stay ignored and local. Physical normal-profile preservation and the bounded startup migration are documented in [implementation evidence](IMPLEMENTATION_STATUS.md). This inventory does not approve production release or certify compliance.

## September 30 evening: repaired Firebase test dependency

Fresh CI for the independent security-test tooling was blocked by five propagated high findings rooted in gRPC 1.9.16. The [ordered repair and exact evidence](GRPC_DEPENDENCY_PLAN.md) replaces only Firebase Firestore's gRPC dependency with maintainer-patched 1.13.6. Existing 1.14.5 branches remain unchanged. The refreshed full gate has 1,126 components and zero findings; registry signatures/attestations and the 48-test cloud suite pass. Source dependency tooling is updated; the installed 0.1.10 artifact and retained installer remain the previously verified bytes. Fresh CI for this repair is recorded separately when complete. Historical earlier lockfile/audit identities below remain retained.

## September 30 feature release 0.1.10

The profile/theme update changes application bytes and its version only; no dependency versions changed from the verified 0.1.9 baseline. Owner-installed 0.1.9 now has exact Chromium notices and matching ASAR bytes. Seven selected Electron fuse gaps remain; header integrity metadata equality is not runtime enforcement. Earlier sections retain their historical artifact identities.

The September 30 04:18 UTC npm gate passes with 1,126 components and zero findings at every severity. Lockfile SHA-256: `69c197094d3fdcd6a0e807465a0156097fd760afbd9e9ef439c1be09356e2f9e`. Final package scan covers 204 ASAR entries without private configuration or credential matches. Native inspection records 83 physical files, 15 native files, Electron 44.4.5, SQLite 3.53.4, matching embedded ASAR-header metadata, all seven remaining fuse gaps and exact Chromium notices. An initial isolated collector close timed out and produced no report; a fresh retry closed normally and passed. Neither run accessed the owner profile.

| Exact 0.1.10 artifact | SHA-256 |
| --- | --- |
| Retained installer, 168,019,968 bytes | `2ae92c88f91800c0e71b06d3fad8e2b18d5275a0ac136f73de6cc5e83dc4a0c9` |
| Packaged ASAR, 17,906,956 bytes | `0fa8c59a4da8f6a8821e53cf154957f524a18f305ed86a7e06e474eefdec8d70` |
| Packaged native report | `28d7068d7a6b67d6e6185db0520a6c9287a541e8d6bb34d7f93b823e1ee848d5` |
| Installer notice report | `747bdd38b79c215fd019a49d2e4fc97ff481fc9712460235ca277cec9175822a` |
| Dependency summary | `caa3571538e14879c35334d231e672bcc922f97ed1ed1b44c80f2e8e93db2917` |
| Live profile/sync/deletion report | `1cd6c21e2216798363e6a57fad1f0a96c7f1109bb46813c6fb3d863dda76051c` |
| Live quota/retry/deletion report | `932f0d857a6c04145fb57a2ebf7b692eec6028e449e14d41c1dcac7cb14a6617` |

Reports and installer remain ignored local evidence. The deployed rules match source SHA-256 `8b096603051115c31edaf5f92eda3ff7bdf854365e424046fc7f38885a3d2977`. Seven live quota checks pass, including raw REST slot-61/reset/omission denial, preserved queued work and automatic retry after server-window reset; both quota-test accounts were removed.


## September 29 native patch: source 0.1.9, installed 0.1.8

The [ordered patch plan](NATIVE_PATCH_019_PLAN.md) updates only Electron from 44.4.2 to **44.4.5**, alongside application version fields. The lockfile has no other dependency changes. Official Windows x64 archive SHA-256 `11c395820a5aaa8ebcc0686b476d0ac98a730274ebfbdc8cf5538a7c2815cb5d` agrees with the updated npm package's checksum map. The downloaded [official checksum list](https://github.com/electron/electron/releases/download/v44.4.5/SHASUMS256.txt) is retained with SHA-256 `a0379166a35f9d3e2e1b63a72b90ddfe54a9558c56a3bde82e98f63823591d72`. Existing custom-download rejection, extraction containment and owned build-root checks remain enforced.

The full npm evidence at **17:02 UTC** has **1,126 components and zero findings**; dependency gate exit zero. `npm audit signatures` verifies **1,172 registry signatures and 145 available attestations**. These package-instance counts differ from the deduplicated CycloneDX component count. Native runtime inspection confirms Electron 44.4.5 and SQLite 3.53.4; all seven selected fuse gaps remain explicit. This patch does not claim complete native provenance/advisory coverage or enable code signing.

| Exact 0.1.9 evidence | Value |
| --- | --- |
| Lockfile SHA-256 | `43c833e30bacc0701a5a58ccf5ff59a9fcd99f244506dd3d34a317cde45d0620` |
| Audit SHA-256 | `f5a3ec0aab8fa3c4309d06de4c1a7369715af18b49f8c30bc09c1fd6c6e03a30` |
| CycloneDX SHA-256 | `f3cca7b4b4d3af600d1a01a5111a8d75499c3a119a537ebedf40a8f92f523cbf` |
| Unsigned installer | `CC-Lime-0.1.9-Setup-x64.exe`, 168,004,096 bytes |
| Installer SHA-256 | `71fe90b2b8c0efa711ec0a765010be38c02fe95a6a6385aff6cd8bd50daf1e3e` |
| Package ASAR | 17,844,220 bytes; SHA-256 `45890d737426768a423d8bd65edb0a02a8593c9f7e6bc57196198682241a187f` |
| Full nupkg SHA-256 | `6779be543a235d9ad066156f905fa314dc0acf6efa7e8c995b134c8a74f54674` |
| Notice-verification summary SHA-256 | `a4354abedbf08841d3aa376d09c50c3d4f757e3f07f875b3d99bcb090ae1ef3c` |
| Native-inventory summary SHA-256 | `d750f85d29475d952963e09a8df7951353060566027aa0bc04041cff4f2cad4a` |

The Squirrel nupkg now includes the exact **20,472,830-byte Chromium notice file**, SHA-256 `7b328b8c7463ac9bfc7dc648c751533517c8441a0b5b21047d6c0b2620e60d70`. Its metadata version matches 0.1.9. The verifier reads ZIP streams without extraction, rejects missing/duplicate/mismatched notice entries and bounded malformed/ambiguous XML metadata, and removes stale success evidence before checking. Seven positive/negative tooling cases pass. This is an installer-content repair; an installed 0.1.9 notice-file observation and broader JavaScript/license review remain separate.

Reports are retained under ignored `test-results/supply-chain-0.1.9`, `test-results/native-package-0.1.9.json` and `test-results/installer-notices-0.1.9.json`. The package credential scan covers 204 entries with no configured private values. [Implementation status](IMPLEMENTATION_STATUS.md) records final application/CI validation. The owner's installed 0.1.8 and its exact retained installer are preserved; no public release asset is uploaded.

Both 0.1.9 implementation CI runs pass all 280 tests. The [PR run](https://github.com/idekakdj/C.C-Lime/actions/runs/36603201815) retains the following synthetic evidence; each ZIP was downloaded locally and its digest checked before reading the report. These are CI build identities, not substitutes for the local installer hash above.

| CI artifact | ZIP SHA-256 |
| --- | --- |
| [Installer notices](https://github.com/idekakdj/C.C-Lime/actions/runs/36603201815/artifacts/11050062813) | `af4e716deb8ed98df6936be1eacd276c5b6ef51e4a80c40ba885251af69d1d55` |
| [Native inventory](https://github.com/idekakdj/C.C-Lime/actions/runs/36603201815/artifacts/11049838058) | `c90c85bf0397644e8a5fab6adabcd6b1f65b2929343421c09aa25334907fc68a` |
| [Recovery drill](https://github.com/idekakdj/C.C-Lime/actions/runs/36603201815/artifacts/11049748632) | `917ac881273d615063b5c8fa8a0d5bee5e4e911b3fa3add930c98a3a6ebd4420` |

The subsequent [static ASAR prerequisite](PRODUCTION_FUSE_PLAN.md) adds read-only metadata comparison without altering app bytes or dependencies. Its extended local report `test-results/native-package-0.1.9-asar-prerequisite.json` has SHA-256 `44d9144668c080bc0e5499c2f04d99dbfa0133587e8cfff11b25ca3172f7ed31`: embedded header matches, enforcement fuses remain disabled. Independent production acceptance and actual tamper refusal are still open.

## September 29 owner installation

The exact retained 0.1.8 installer below is now installed over 0.1.5 at the owner's request. Installer exit zero, installed ASAR equality, real-profile/settings preservation, populated upgrade fixture, shortcut stability and all 26 installed desktop tests pass. See [upgrade plan](UPGRADE_018_PLAN.md) and [implementation evidence](IMPLEMENTATION_STATUS.md). The [native security review](NATIVE_SECURITY_REVIEW.md) supplements npm evidence; its scope and open findings remain separate release gates. Older source/install distinctions below are historical.

## September 28 performance/recovery build: source 0.1.8, installed 0.1.5

Version 0.1.8 changes calendar search, queue counters and test/evidence procedures. The only manifest/lockfile changes are application version fields; dependency versions and the verified-download/extraction policy are unchanged. Fresh full npm evidence generated **September 29 at 02:08 UTC (September 28 in Ontario)** reports **zero findings**, 1,126 components and dependency-gate exit 0. The September 28 installed-package signature/provenance result below applies to the unchanged installed dependency set; no new signing or native-component audit is claimed.

| Exact 0.1.8 evidence | Value |
| --- | --- |
| Lockfile SHA-256 | `45467099db5ba07b12bf7a154e99ea57e2acb849e86ff1f0289b26a66c04287c` |
| Audit SHA-256 | `f5a3ec0aab8fa3c4309d06de4c1a7369715af18b49f8c30bc09c1fd6c6e03a30` |
| CycloneDX SHA-256 | `3d740651572fec4f8a72a453c51189d57834380dff2a176f4af8546a73ffb81a` |
| Unsigned installer | `CC-Lime-0.1.8-Setup-x64.exe`, 166,069,760 bytes |
| Installer SHA-256 | `fa199d98f2cbb5e00330e4148eb5cc2cb01d726ee1ec7753dc4fc31cd724130c` |
| Installer package ASAR | 17,843,485 bytes; SHA-256 `17f7bc04af11623f8cb8f5fa41d77af062e56d01aa704f3ff83ca5698c5ddd36` |

The local installer and its report set are retained under ignored `release/0.1.8` and `test-results/supply-chain-0.1.8`. Source/package credential scans pass; the local archive contains 204 entries. The earlier performance run/focused restore used a preliminary 0.1.8 package (`e66496c07297ee946dc534ba1cf103f6d89d4e421cbc5c978df7e4acb06c0203`); the final installer package is identified separately above and receives the full desktop suite. [Implementation status](IMPLEMENTATION_STATUS.md) records final validation and CI. Installed 0.1.5 is unchanged. A clean npm result remains only one release gate.

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

The initial capable-host CI run passed positive symlink and pre-existing leaf-link cases. Its link-chain assertion was too strong: extraction failure is not atomic rollback, and a relative dangling hop inside the build root may remain after the escaping hop is refused. The follow-up test checks each remaining link's literal and resolved containment and the unchanged outside sentinel. A failed extraction is not consumed by packager. This test correction changes no shipped app or build policy.

Final validation for commit `85b027dd95d8c318e3ebaca1e22c1c0d80bde963`: both [pull-request](https://github.com/idekakdj/C.C-Lime/actions/runs/36476967314) and [push](https://github.com/idekakdj/C.C-Lime/actions/runs/36476960408) Windows runs pass. **All 33 tooling tests pass with zero skips**, including both symlink cases unavailable locally. Fresh dependency installation, the blocking zero-finding audit, 158 app unit tests, 36 cloud tests, 25 desktop tests, type/build, native package, Squirrel installer and archive credential scan also pass. The CI archive contains 201 entries versus the local artifact's 204; the local installer/hash table above does not identify the independently built CI artifact.

At **2026-09-28 20:11 UTC**, pinned npm 11.19.0's `npm audit signatures --json --include-attestations` completed with exit **0**, empty invalid/missing result arrays and **145 verified attestation entries**, including both installed instances of `@electron-internal/extract-zip` 1.0.5. This count includes instances/aliases and is not 145 distinct packages or a statement that every package supplies provenance. The credential-screened report stays in ignored `test-results/package-provenance.json`; SHA-256 `12b552afefd385486de5e1c4c26093400b44fa6d492e865808d09005f1054717`. Verification covers the installed npm dependency set's registry signatures and available provenance, not every cross-platform lockfile package, independently rebuilt native bytes, the extractor's complete Rust dependency tree or the unsigned C.C. Lime installer. Native-component and build-access review therefore remain open.

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
# 0.1.11 retained artifact checkpoint

The owner-only 0.1.11 installer is separately retained under ignored `release/0.1.11/`. It is 168,028,160 bytes; SHA-256 `ffef628e5b3056167814d8482cf21f462cbf8bcd366c7adc07fb4f39d80fafc2`. Packaged ASAR SHA-256 `4ce26976a97d9ef43a93c852d8a12ef96bf8394704dbd7e4b9e371da09bf1e79`. All nine application build files match the tested archive. Exact 20,472,830-byte Chromium notice content/version, 205-entry credential/configuration exclusion and 83-file/15-native inventory pass. The fresh dependency gate records 1,126 components and zero findings; seven production fuse gaps remain. No additional native provenance/signing/compliance determination is implied.

Local 205 unit/54 tooling passes (two explicit host permission skips), 49 cloud, 33 packaged desktop and seven independent renderer cases pass. Both feature Windows runs pass; the seventh independent password-form case was subsequently added and is awaiting its own fresh CI. Owner installation remains 0.1.10, pending the [normal-context upgrade gates](UPGRADE_0111_PLAN.md). Older artifact checkpoints below remain historical.
