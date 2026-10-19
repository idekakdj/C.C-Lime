# Independent SQLite generated-source reconciliation

October 1–2, 2026, source-only continuation. The six checked better-sqlite3 13.0.3 generation/build inputs match upstream byte-for-byte; its 36 compile definitions match the exported configuration. The work below subsequently reproduced all three bundled source/header files exactly. A generic upstream amalgamation with different generation options remains a different artifact.

## Measured completion

At 2026-10-02 03:59 UTC, a guarded official full-source download and the existing Visual Studio 2022 toolchain generated **sqlite3.c, sqlite3.h and sqlite3ext.h byte-for-byte identical** to the dependency's bundled files. Source manifest and version match the actual bundled identity. The 36 verified definitions were supplied explicitly; Windows Makefile required flags and compiler commands are retained in the ignored log. The pinned source builds its project-local jimsh0 and lemon tools; no interpreter installation was needed.

Official `src/date.c` already contains both literal values listed in dependency patch 1208, each in the expected unique context. Original patch context is absent, so no patch was applied or counted as applied. This explains the convenience script's permitted patch skip for this source version.

| Evidence / source | SHA-256 |
| --- | --- |
| Official sqlite-src-3530400.zip, 14,557,315 bytes | `d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b` |
| Generated and bundled sqlite3.c, 9,516,284 bytes | `6a2805f8c1ef020a7086e62258519323cf98b219e9fe87a42065d916cfebaefc` |
| Generated and bundled sqlite3.h, 690,838 bytes | `919e7f2e8ed1d8f56ac17b412b8971c76aa5d1a879752cc6058f75e7d5910e1d` |
| Generated and bundled sqlite3ext.h, 39,175 bytes | `ac9645e5c9ff0cf176efdd6e75cb5e98f46295d38e02db5c4d208826a39ab4be` |
| Ignored test-results/sqlite-generated-reconciliation.json | `6a820413b761bda4d07e9ab1d67c7094a3c0227fa5b1c1a90d8ba6d8e4a11437` |

Toolchain: VS 2022 17.14.24, MSVC 19.44.35222, SDK 10.0.26100.0, Makefile.msc, line macros disabled. Archive validation bounded size/count and rejected traversal, links, reserved names and case ambiguity before extraction into a unique ignored workspace root. An initial local batch-quoting error exited 9009 and supplied no definitions; it is a failed diagnostic attempt. Corrected forced generation supplied all definitions and exited zero before comparison. No dependency, installed binary or owner profile was replaced.

This closes independent generated-source reconciliation only. Native binding/Electron/Chromium binary reproducibility, embedded libraries, comprehensive advisory coverage and publisher signing remain separate work requiring a complete reviewed build/assessment scope. See [native review](NATIVE_SECURITY_REVIEW.md) and [current checklist](COMPLIANCE_CHECKLIST.md).

The subsequent isolated native binding builds with two existing header families also pass actual SQLite identity/options/transaction checks. Their raw bytes and executable sections differ from the vendor prebuild. The [native review](NATIVE_SECURITY_REVIEW.md) records exact results and the missing historical resolved vendor build inputs; no binary was replaced or normalized to force equality. This source-reconciliation success remains narrower than binary reproducibility.

## Reviewed execution steps

1. Read the [official compilation instructions](https://www.sqlite.org/howtocompile.html) and the pinned source tree's actual Windows generator. Download only the exact source version selected by the already verified dependency script: SQLite 3.53.4, year 2026, sqlite-src-3530400.zip. Bound the download and preserve its digest. Verify archive version and source manifest against the bundled source ID.
2. Use a new uniquely owned ignored tool/result root. Before any extraction, validate every entry for prefix, traversal, absolute/drive/reserved names, case-duplicate ambiguity, symlinks, count and total expanded size. Resolve every destination under that exact root. Never run the upstream script's recursive deletion or replace dependency/application source.
3. Inspect the pinned Makefile and generator requirements. Use only the existing Visual Studio 2022 compiler/SDK and project-local outputs; no OS installation or PATH persistence. Review and pass the verified dependency compile definitions explicitly to source generation. Keep any differing host/generator options documented. If an interpreter/tool is actually missing, report that prerequisite rather than claiming reproduction.
4. Generate sqlite3.c into the owned root using the reviewed Windows source target. Require normal successful exit; preserve logs/inputs/compiler/SDK identity. Apply the reviewed patch only when its original context is unique. If original context is absent, require each unique expected result in both the original official source and generated output, explicitly record that no patch was applied, and fail on any other mismatch. Never silently skip a failed patch.
5. Compare all generated source/header bytes and hashes to the installed dependency inputs. Separate exact equality from newline-only normalization or meaningful differences. Investigate remaining source differences against generator/options; preserve a failed/nonmatching result and do not replace the packaged dependency just to obtain equality.
6. Record the measured source conclusion and remaining limits in the native review/checklist. Matching generated source does not reproduce the better-sqlite3.node, Electron/Chromium or signed final executable, inventory all embedded C libraries or establish comprehensive vulnerability coverage. Installed 0.1.15 and its profile/configuration remain unchanged.
