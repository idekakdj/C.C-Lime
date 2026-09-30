# Firebase test dependency repair

September 30, 2026. Security-test CI for `a84fc8f` stops at the conservative full-lockfile gate with five propagated high affected-package findings. The actual vulnerable node is `@grpc/grpc-js` 1.9.16 under the Firebase test SDK. The two other installed gRPC instances are 1.14.5. Earlier dated clean audit results remain historical; they do not override this fresh result.

The maintainer's [certificate-authentication advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j) identifies fixed releases 1.13.6 and 1.14.5. The companion [server-error disclosure advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4) has the same lower fixed branch. These are server-side behaviors; this project uses the Firebase SDK in cloud-rule tests, while application cloud/auth code uses its own HTTPS adapter. Keep the full gate strict regardless of reachability.

1. Retain failed CI audit evidence and verify its downloaded archive digest. Inspect exact dependency ancestry and upstream patched-version metadata before editing.
2. Add an exact override scoped to `@firebase/firestore` for `@grpc/grpc-js` 1.13.6. Do not downgrade Firebase or modify already-patched 1.14.5 instances. Review the entire lockfile diff and require only the intended replacement/newly required package changes.
3. Install with the pinned Node/npm toolchain and scripts disabled for this dependency-only mutation. Confirm resolved gRPC instances and versions. Scan the existing installed/package ASAR for actual Firebase/gRPC package files and inspect runtime imports; do not infer runtime exposure from the devDependency label alone.
4. Run the full dependency gate, registry signature checks, source/type/unit/tooling checks and all cloud-rule emulator tests. Run ordinary desktop and independent acceptance in CI. If compatibility or audit fails, investigate without suppressing severity or forcing broad dependency changes.
5. Preserve installed 0.1.10 and its exact prior installer identity. This repair concerns development/test dependencies; no owner installation is authorized solely by a passing audit. A later changed application artifact must receive its own version, package and installation acceptance.
6. Record repaired lockfile/report identities and actual CI results. Resume remaining production coverage migration and paired negative probes. Keep organizational compliance claims open.

## Local repair result

The only lockfile change is removal of gRPC 1.9.16 and addition of Firebase-scoped 1.13.6, with its registry integrity matching reviewed metadata. Other gRPC branches remain 1.14.5. Full npm gate: 1,126 components, zero findings; 1,172 verified signatures and 145 verified attestations. Types, 188 units, 54 tooling passes (two explicit host symlink skips), build and all 48 cloud emulator tests pass. Three independent renderer/paired-inspector tests also pass locally.

Repaired lockfile SHA-256 `271931b120a2dd5dbb58d1666ea1edc8dbf7c9a1739eeb47ed0299aeda677339`. Dependency-summary report `test-results/supply-chain-0.1.10-grpc-repair.json` SHA-256 `0d787113f43f678ae3d0b2431fb435d470bf2f28fada2faee2ebf22beeb2a500`. Failed CI audit archive SHA-256 `1641ffa562163e97d6ef4050f76e147828743addf058b42448103a39dd77db23` matches GitHub metadata.

Static inspection of installed 0.1.10 finds empty Firebase/gRPC scope directories but no SDK package files, and no gRPC identifiers in the bundled main process. Its manifest has only better-sqlite3 as a runtime dependency. Exact installed ASAR remains `0fa8c59a4da8f6a8821e53cf154957f524a18f305ed86a7e06e474eefdec8d70`. Versioned scope report SHA-256 `667b91535f3a8e418cc419ec9de73e1ad48d4013d87bc2588a98526b3589bdde`. This bounds the observed runtime package; it is not a comprehensive native vulnerability assessment. No owner installer was replaced.

## Fresh CI result

Both [PR](https://github.com/idekakdj/C.C-Lime/actions/runs/36774029212) and [push](https://github.com/idekakdj/C.C-Lime/actions/runs/36774023285) runs succeed for `03d8d4401e395de639a3be09e4408595c8296d56`. All 326 tests pass: 188 unit, 56 tooling without skips, 48 cloud, 31 desktop and three independent renderer/paired-inspector cases. Fresh installation, full dependency gate, build/package, notices and native inventory also pass.

The downloaded [dependency artifact](https://github.com/idekakdj/C.C-Lime/actions/runs/36774029212/artifacts/11124800951) archive SHA-256 `7646c574cbdd76a16dc534df65ac1c4df5f7cb24cca3beb818fcede577a3d191` matches GitHub metadata. Its inspected summary records the exact repaired lockfile, 1,126 components and zero findings. The [independent-test artifact](https://github.com/idekakdj/C.C-Lime/actions/runs/36774029212/artifacts/11125426220) archive matches `56e85f19c1716f6ca3fd172efc2642b0a5eb72b56aeb74045e755e12a48786aa`; all three synthetic summaries were inspected. CI retention is 14 days; private downloaded copies retain these exact archive identities. Installed owner acceptance remains tied to its separately retained artifact.
