# C.C. Lime 0.1.17

Installed for the Ontario owner-only pilot on October 2, 2026. The ordinary installed calendar window is reopened. Source identity: `7cc9f3b2d0d3126bea34884d5f22cb8d69defda9`; subsequent documentation does not change application bytes. [Ordered installation plan](RELEASE_0117_PLAN.md).

## Included since installed 0.1.16

- Changing a password clears the current device's login. Every sync pass validates the refresh token, so other devices running this implementation require sign-in when revocation is detected. Pending calendar edits remain available after same-account sign-in. Already-issued access tokens can remain valid until provider expiry; this is not immediate server-wide revocation for older/modified clients. [Session behavior and measured limits](PASSWORD_SESSION_CHANGE_PLAN.md).
- Invalid legacy civil times leave the calendar usable and expose repair controls. Invalid new writes reject atomically. Calendar imports handle duplicate recurring overrides, UTC recurrence identity and original seconds/milliseconds correctly. Calendar/backup file reads enforce their size bounds while reading. [Adversarial assessment](ADVERSARIAL_TEST_REPORT.md).
- Settings offer 447 searchable time-zone suggestions covering all 418 runtime-enumerated geographic zones plus UTC/fixed offsets. Saved aliases remain usable. The shared list also serves onboarding, editors and imports; timed events keep their original instants. [Time-zone verification](TIME_ZONE_OPTIONS_PLAN.md).

The [0.1.16 capabilities inventory](APP_CAPABILITIES_0116.md) remains the baseline for calendar, recurring events/tasks, reminders, profile cropping/username/progress, synced themes, backups and account features. No provider policy, cloud rules or production fuse rollout is included in this update.

## Measured installation and verification

| Gate | Result |
| --- | --- |
| Type/source/tooling | Typecheck, 287 source tests and 81 tooling cases pass; two local symlink-privilege cases explicitly skipped |
| Cloud rules | All 59 isolated emulator cases pass; no deployment |
| Windows application | 35 original desktop and 43 independent packaged renderer cases pass |
| Disposable hardening compatibility | 32 cases pass with all seven fuse targets enabled on copies; shipping settings remain unchanged |
| Populated upgrade | 12 linked synthetic records, overrides/completions, preferences, device state and pending writes preserved from actual retained installed 0.1.16 bytes |
| Owner preservation | New byte-verified private backup; 109-file profile with two account databases and 39 records; all account records and non-cache files preserved before owner reopen; private configuration unchanged |
| Distribution | Installer exits zero; exact tested archive/notices; 108 distributed files including the stable launcher match the nupkg vector; prior retained 0.1.16 installer unchanged |
| Sign-in after installation | Actual physical installed executable/private configuration pass fresh-start and ordinary-restart email/Google/reset control checks; private fixture copy removed |
| Live installed authentication | Five disposable email-account checks pass, including Windows-encrypted session restoration and signed-out fresh restart; three normal exits; identity/data/private fixture configuration cleaned up |
| Startup/reopen | Existing registration/approval bytes unchanged; startup reads registered/enabled true; ordinary second launch exposes the installed window |
| Private-data boundaries | 240 publishable files and 234 archive entries scanned; no private configuration/credential values found; ten dependency notices and 23 unchanged covered-source files verified |

The first backup attempt refused redirected tool-context paths; normal-desktop backup succeeds. The dependency-scope helper first failed on archive path separators and passes with original archive keys. The first hidden app launch starts the correct physical version but does not expose a window within its bound; ordinary visible second launch succeeds. Failed attempts remain retained. No owner process is terminated and no existing owner data is overwritten to make a check pass.

## Production dependency gate remains blocked

A fresh audit reports **23 high affected-package entries propagated from two build/emulator root libraries**, braces 3.0.3 and http-cache-semantics 4.2.0. Their reviewed advisories list no patched version: [braces recursion exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [cache response disclosure](https://github.com/advisories/GHSA-ch52-4w7c-c8xp). Registry latest versions remain unchanged at this check. These packages are absent from the measured JavaScript bundle/copy inventory and archive dependency tree; this does not make the development tools secure.

The full npm gate remains failed and unmodified. Both exact-source [PR CI](https://github.com/idekakdj/C.C-Lime/actions/runs/37087410834) and [push CI](https://github.com/idekakdj/C.C-Lime/actions/runs/37087408078) stop at that gate. Local functionality tests above are separate and are not represented as successful full CI. The owner explicitly requested this private update; installation does not approve production distribution, waive the dependency policy or accept organizational residual risk. RK-01 stays open pending compatible patched tooling and a fresh passing full-tree gate.

## Retained artifact identities and scope

| Artifact | SHA-256 |
| --- | --- |
| Private installer, 168,205,312 bytes | `a0a0bbcdffbddc04e526580fa661c4098af6c125d88ebcd9d191a7f72c761678` |
| Installed/tested ASAR | `e3087abee5c14ede4b316d49e5f6fb8a2cf428e8e3c32584dc526974692caf9b` |
| Installed executable | `3dad98fa80f9780728018bedba5b98e802bfc3d8e370850fc64583b1e23ee8c0` |
| Retained final sanitized local evidence | `8d2edd3a3a6ab0b0d613b1ca318a63f867dae98322bfb375697b9ed20700a245` |

Installer: ignored `release/0.1.17/CC-Lime-0.1.17-Setup-x64.exe`. Private backup remains under ignored `.local/upgrade-0.1.17-normal-profile-before`; detailed evidence under ignored `test-results/release-0117-*` and installed/profile reports. No public installer, main merge or formal assurance claim. Actual Google consent/inbox, Windows logon/banner/native dialogs, another physical PC, production signing/fuses and organizational/independent assurance remain open. PHIPA remains excluded.
