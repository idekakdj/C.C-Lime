# Dependency treatment and release evidence

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
- The working installed 0.1.4 baseline is preserved; 0.1.5 has not been installed over it or uploaded as a public release. This patch updates build tooling and evidence, not user-facing calendar behavior.

See [implementation status](IMPLEMENTATION_STATUS.md) for final desktop/CI observations. Signing, clean-PC release acceptance, outstanding dependency remediation and organizational approval remain required. No SOC report, ISO certificate, DGSI conformance finding or privacy-law compliance opinion is established here.
