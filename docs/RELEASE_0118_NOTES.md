# C.C. Lime 0.1.18

October 19, 2026. Requested private Windows update under the [release plan](RELEASE_0118_PLAN.md). Installed and reopened in the ordinary Windows desktop context; the installed archive and distributed files match the tested bytes.

## Calendar and tasks

- My Tasks has **To do** and **Completed** tabs. Previously saved in-progress items remain available in To do; existing records, completion history and weekly progress are preserved.
- Week view has a keyboard-accessible **Time-slot scale** slider (20–100%), **Fit week**, and an original-size **100%** reset. The original 56 pixels/hour is the maximum. Scale and automatic-fit choice persist on this device across app restarts.
- Fit week measures the available height and responds to viewport/header changes. Seven columns, horizontal layout, fonts, **All day & due** and **Upcoming Tasks** retain their existing dimensions. Only hourly spacing and timed-event placement/duration geometry change. Event text keeps its size, with a 26-pixel readable minimum; visual collision lanes keep short adjacent items clickable.
- Early/late, cross-midnight and daylight-saving layouts use the displayed local-hour grid. Dragging/resizing uses the selected scale; changes still require editor review/save and Escape cancels gestures.
- When the unchanged headers leave too little room for the minimum readable 24-hour grid, the app explains that a taller window is needed and retains scrolling rather than clipping or shrinking text. Unlimited all-day rows/dense events cannot be guaranteed to fit every physical screen.
- Dialog confirmation/error messages participate in layout so a movement message cannot cover Save/Cancel.

## Security and staged authentication

Four narrowly scoped [dependency updates](RELEASE_0118_DEPENDENCIES.md) were applied after a fresh audit. Final root findings decreased from 27 entries (11 high, 16 moderate) to 23 (7 high, 16 moderate); remaining roots are `braces` and `sprintf-js` in build/emulator tooling. The full production gate stays blocked without suppression. All remaining affected package names are absent from the measured 13-component app bundle inventory and archive dependency paths; this is not comprehensive native assurance or a production waiver.

This release includes the earlier staged authenticator/passkey client code, disabled by default. No provider MFA, live rules, gateway hosting, signer key, IAM, billing or owner factors are activated. Firebase/Google private configuration remains external to source/package in ignored local files. Earlier eight-character new-password source behavior is included; mandatory live MFA is still pending, so NIST length/AAL conformance is not claimed. Account setup automation is still unimplemented.

Unsigned owner-only scope, seven shipping fuse gaps, physical OS/Google/second-device observations, operator/privacy decisions and independent assessment remain open. PHIPA is excluded; no SOC 2, ISO 27001, CAN/DGSI 118 or PIPEDA certification is asserted.

## Verification checkpoint

Source: 369 tests passed; type checking/build passed. Tooling: 82 passed, two existing Windows symlink-privilege skips. Cloud emulators: 84 passed. A populated synthetic upgrade retained 12 records, recurrence overrides/completions, profile, preferences and pending writes; the only expected device addition is the default weekly scale.

The initial sandbox test/backup attempts were rejected by temporary-file permissions/physical profile redirection; normal-context retries passed. One early UI test used an obsolete exact navigation label that omitted its task-count badge. A later 47-case packaged run passed 46 cases but exposed a real toast intercepting Save; that layout was repaired rather than bypassing pointer checks or extending timeouts. The first 22% candidate also passed 48 independent, 35 original and eight combined-fuse tests, but a separate 1480 × 930 check with five all-day items found five pixels of page overflow. The floor was corrected to 20%, preserving fonts and both task sections; the final suites below include a no-page-scroll assertion at that viewport. Intermediate package hashes are not the final installed identity.


## Final installation evidence

- Final source: 369/369 tests, typecheck/build; eight CI-policy cases also passed after adding weekly-scale coverage.
- Final package: 48/48 independent renderer, 35/35 original desktop and 8/8 combined-fuse disposable-copy cases, all with no skips/flaky failures. Combined fuses remain a test-copy policy, not the shipped policy.
- Verified 235 archive entries, no credential signatures/exact private values or local/gateway paths, 13 notices and 23 covered-source files; installer retains exact Chromium/third-party notices.
- Closed normal profile: 114 files, 2 account databases and 102 records; byte-verified private backup, all records/non-cache files/private configuration preserved before reopening.
- All 108 installed distribution files including stable launcher match; startup registration/approval unchanged.
- Actual installed executable plus normal private configuration: enabled email/Google/reset controls on fresh start and restart; private fixture environment removed. Live disposable email sign-in, Windows-encrypted restart/sign-out: five checks, three normal exits, one created identity fully cleaned up. New Google browser consent/inbox was not performed or inferred.
- Ordinary installed 0.1.18 window reopened and its physical process observed. No owner credentials/calendar/provider settings, MFA/rules/IAM/billing were changed by test fixtures.

Final ASAR SHA256: `a5b5bc5d6c653e97d1947926559fa93f8bc34f084c9de9376843532ace5ecf10`. Installer SHA256: `f47658c05e6b20f9cf9e4c5d0213fc73713de116135577257b958016a45df40e`. Tested runtime source commit: `56c235d9ae4863da0c729ca4a6b4af59b25f08ab`; later documentation and gateway-only updates do not change installed bytes. Detailed owner/profile reports, installer and backups remain ignored locally.

Both [PR CI](https://github.com/idekakdj/C.C-Lime/actions/runs/39205062176) and [push CI](https://github.com/idekakdj/C.C-Lime/actions/runs/39205056820) for `195450284b4b8eac188c51952580c9801e3a0a5a` pass the independent gateway job after the tooling repair. Their desktop job stops at the unchanged production dependency gate, so downstream desktop CI results are not claimed. That follow-up changes only gateway tooling/evidence; installed runtime source remains the `56c235d` ancestor. Local desktop acceptance above is separate evidence.

The first post-install verification attempt stopped because its generated installer file manifest had not been created. The manifest was generated from the exact tested distribution, and verification resumed without rerunning the installer. Failed stage reports are retained privately; no app/data failure is converted into a pass.
