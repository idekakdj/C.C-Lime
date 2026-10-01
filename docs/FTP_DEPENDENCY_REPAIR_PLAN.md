# FTP tooling dependency repair

October 1, 2026. Source and development-tooling change only; keep the app at 0.1.15 and do not replace the installed app or its profile.

## Trigger and boundaries

The fresh Windows checks for commit `d51e5a7e0bf00caad253036190e461de629ad6cf` stopped at the dependency gate. The audit reports five affected packages propagated from one root advisory, [GHSA-c475-qrg2-pj4r](https://github.com/patrickjuchli/basic-ftp/security/advisories/GHSA-c475-qrg2-pj4r): `firebase-tools → proxy-agent → pac-proxy-agent → get-uri → basic-ftp`. The installed development tree resolves basic-ftp 5.3.1; the maintainer identifies 6.2.1 as the patched release. Do not suppress the finding, relax the audit, or accept npm's suggested Firebase CLI major downgrade.

## Ordered implementation and acceptance

1. Preserve the failing audit and summary under unique ignored evidence names before rerunning the gate. Read the registry metadata, current get-uri FTP implementation, and maintainer major-release notes. The registry's latest get-uri still requests basic-ftp 5.x, so updating that parent alone does not resolve this finding.
2. Add an exact basic-ftp 6.2.1 override scoped beneath firebase-tools/get-uri, preserving every other dependency, engine, lifecycle-script permission and app version. Update the lockfile using the configured Node 24/npm 11 runtime. Review the resulting diff; stop if unrelated dependencies change.
3. Verify the resolved dependency path and integrity. Review the actual Client APIs used by get-uri: constructor, access, lastMod, list, downloadTo and close. Version 6 defaults to rejecting separate transfer hosts; retain that security default. Do not add an escape hatch for FTP bounce behavior. Confirm no new installation lifecycle script requires permission.
4. Add bounded, loopback-only compatibility tests using the real get-uri module and resolved basic-ftp package. Exercise MDTM download, LIST fallback with a malformed long listing followed by a valid record, unchanged-cache response and missing-file response. The malicious-listing test runs in a child with a parent-enforced deadline so a parser regression cannot freeze the test runner. Close sockets and child processes on success or failure. Do not connect to external FTP servers or use user credentials.
5. Require the full dependency/SBOM gate to report zero findings. Run the complete local source/tooling checks and cloud rules suite as appropriate; record actual counts and any skipped checks. Build and test both baseline and all-seven-fuse Windows copies in CI, including positive/negative account-configuration readiness after restart. Check archive integrity and normal exits; do not infer runtime success from packaging alone.
6. Push the reviewed repair to the existing draft PR. Verify both push and PR Windows runs, downloaded evidence digests, exact source revision and test counts. Update the risk register and acceptance record with measured scope. Keep earlier failed runs as historical failures. No certification, production fuse rollout, provider policy deployment or signed installer approval is implied.

The maintainer's [6.0.0 notes](https://github.com/patrickjuchli/basic-ftp/releases/tag/v6.0.0) describe the separate-transfer-host default change; [6.2.1](https://github.com/patrickjuchli/basic-ftp/releases/tag/v6.2.1) contains the parser repair. Compatibility is an acceptance requirement because this is a major-version override.
