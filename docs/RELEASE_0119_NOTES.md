# C.C. Lime 0.1.19

October 19, 2026. Owner-requested private Windows update under the [implementation plan](RELEASE_0119_PLAN.md). Installed and reopened; actual installed bytes match the tested package.

## Weekly calendar

- The hourly scroll box is 50% taller than the previous available-height budget, retaining the readable minimum for short windows. This displays more hourly slots at a chosen manual scale. It can make the overall page taller than the screen.
- **Hide all day & due / Show all day & due** toggles the all-day section. It is shown by default for new and upgraded profiles. The choice persists locally across restart; hiding it does not delete or alter events/tasks. Showing it again restores access to those items.
- Toggling, all-day content changes and window resizing recalculate hourly space. Fit week fits the 24-hour grid inside the enlarged box, subject to the existing readable minimum. Manual 100% remains 56 pixels/hour; text, seven-column widths, all-day cards and Upcoming Tasks keep their sizing.
- Existing scaled drag/resize review, task completion and account functions remain available. No dependencies or authentication configuration changed.

## Verification and installation

- Typecheck/build and 370/370 source tests pass, including boolean validation, defaults for older settings and hidden/shown restart persistence.
- Final packaged checks: 49/49 independent renderer, 35/35 original desktop, 9/9 combined-fuse disposable-copy cases; no skips, unexpected failures or flaky cases. The shipping fuse policy is unchanged.
- Measured exact 150% viewport geometry, unchanged manual spacing/widths, keyboard toggle, preserved hidden records, restored editing, automatic remeasurement, dense all-day/short-window fallback, compressed movement and completion regressions.
- The first focused run passed the new feature tests and exposed a test locator matching both day segments of a cross-midnight event. The containment assertion now checks every matching segment; no application repair was needed. The obsolete prior no-page-scroll assertion was removed because a taller viewport is explicitly requested.
- Synthetic upgrade from actual prior 0.1.18 retained 12 records, recurrence exceptions, completion history, profile/preferences and pending writes. Only expected device addition: default-visible all-day preference.
- Fresh private backup of the closed ordinary profile: 115 files, 2 account databases, 102 records. All account records, non-cache files and private configuration preserved before reopening. Startup registration/approval unchanged.
- 108 installed distribution files verified. Actual installed fresh/restart email, Google and reset controls are enabled with unchanged private configuration. Live disposable email sign-in, Windows encrypted session restart and sign-out pass five checks across three normal exits; one identity created/deleted and cleanup verified. This does not claim a new interactive Google consent flow.
- Package scan: 235 archive entries, 13 dependency notices and 23 covered-source files, no credential values/local configuration/gateway files. Installer contains exact Chromium/third-party notices and covered source. Source secret scan passes. Private backups/evidence/configuration/installers remain ignored by Git.

## Unchanged assurance limits

This UI/device-setting update does not complete a new compliance level. [The compliance checklist](COMPLIANCE_CHECKLIST.md) retains the open organizational, independent assessment, native/signing and provider/hosting/recovery gates. PHIPA remains excluded. No SOC 2, ISO 27001, CAN/DGSI 118, PIPEDA or NIST assurance certification is asserted.

Dependency resolutions are unchanged from the [0.1.18 security checkpoint](RELEASE_0118_DEPENDENCIES.md). Its full lockfile findings remain seven high and 16 moderate propagated build/emulator entries; the production dependency gate stays blocked. Reinspection of these exact 0.1.19 archive bytes confirms affected package names absent from the measured 13-component bundle inventory and archive dependency paths. Tooling/cloud/gateway tests are prior unchanged-subsystem evidence, not reported as rerun for this UI update. Seven shipping fuse gaps remain. No public release, main merge, live MFA/provider/rules/IAM/billing or hosting changes.

## Exact retained identity

- Runtime source commit: `15da49b04edde1303647c4ef5a059db8aba547e5`.
- ASAR SHA-256: `c0f2d9e906217c4de7e5cc62633bcb6e8193b844707cdf7cd8781736c610d3a1`.
- Installer SHA-256: `469624fc58060e9a54ce493d66fa313a608aecd8dacdcd9bf87be4222a8c1bfb` (168312832 bytes).
- Retained owner-only installer: `release/0.1.19/CC-Lime-0.1.19-Setup-x64.exe`; excluded from Git/public distribution. Prior 0.1.18 retained installer unchanged.
