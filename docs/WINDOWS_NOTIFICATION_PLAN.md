# Windows notification installation repair

September 27, 2026. Follow-up to T-34/T-35/T-46; implementation target 0.1.4.

## Problem and boundary

Squirrel creates `idekakdj/C.C. Lime.lnk` with a different toast activator from Electron's root `C.C. Lime.lnk`. Each upgrade recreates that mismatch. Earlier manual repairs succeeded on this host but are not part of the product. Development/test runs also shared the installed notification identity.

Electron 44.4.2 supports [setting a toast activator before notification initialization](https://www.electronjs.org/docs/latest/api/app#appsettoastactivatorclsidid-windows). Its [registration implementation](https://github.com/electron/electron/blob/v44.4.2/shell/browser/notifications/win/windows_toast_activator.cc) adopts the existing root shortcut's activator. Therefore setting the API alone is insufficient: align the root and installer-owned shortcuts before initializing notifications. Keep the existing installed AUMID and previously working activator stable. These are public application identifiers, not credentials.

## Ordered implementation and acceptance

1. Define fixed installed/preview/test identities. Development and isolated test profiles must not rewrite the installed identity. Preserve existing calendar profile paths and visible product UI. Testing found that Electron's shortcut filename comes from the executable's Windows product resource rather than `app.setName`; different runtime names alone cannot isolate it. Prevent native notification initialization/submission in Windows previews and automated test profiles; real banner checks must use an installed normal profile.
2. Recognize a Squirrel installation only when the versioned executable, sibling stable launcher and Update.exe exist. Plain packaged previews must not run installer integration.
3. Replace the implicit Squirrel startup handler with an explicit bounded lifecycle. Install/update: await successful shortcut creation, then repair before exiting without calendar windows or stores. Uninstall: remove installer shortcuts, the app-owned root shortcut and login registration; preserve user data. Obsolete: exit without effects. Failures exit nonzero instead of hanging or claiming success.
4. Before ordinary installed startup initializes notifications, create/align the root shortcut and align existing installer/desktop shortcuts. Use one AUMID/CLSID, the stable launcher and current working directory. Preserve unrelated shortcuts and existing arguments; do not recreate a deleted desktop shortcut. Back up changed existing shortcuts once per location in private application data, check write/read-back success, and make repeated runs no-ops. Failure must leave the calendar usable and report failed native dispatch rather than silently claiming delivery.
5. Unit tests cover fresh registration, stale versions/identities, repeated startup, missing desktop shortcuts, foreign/corrupt shortcut refusal, failed writes, lifecycle order and command errors, non-Windows/preview boundaries, and uninstall ownership. Use injected filesystem/shell/process operations; no real Start Menu mutations in unit tests.
6. Build/package with credential scans and all unit/type checks. Run the desktop suite and verify test/preview identity separation. Build an unsigned 0.1.4 installer. Preserve 0.1.3 upgrade fixtures before installation.
7. Verify actual installed 0.1.3-to-0.1.4 upgrade: exact populated fixture/settings/queue/reminder preservation, matching app archive, shortcuts agree immediately and on repeat startup, and Electron's registered activator targets the installed executable. Test lifecycle behavior with isolated shortcut fixtures without uninstalling the owner's app. Perform a native banner test and ask the owner to confirm visibility/click; automated acceptance of a toast alone is not visibility evidence.
8. Record the installer checksum, observed results and remaining clean-PC, sleep/login and manual activation checks. Push reviewed code and evidence to the existing branch/PR. Do not claim full native acceptance or production release.

No account/cloud schema, provider settings, notification permissions or billing changes are part of this task. Clean-PC acceptance requires a separate Windows environment and remains explicitly open if unavailable.

## Observed result

September 27: the 0.1.3-to-0.1.4 installer exited successfully. Before normal startup, all three owned shortcuts shared the installed identity; Windows file IDs verified the normal and redirected path aliases referred to the same files. Normal startup registered the installed activator and subsequent launch preserved shortcut bytes. Populated and real-profile upgrade comparisons passed. All 150 unit tests and all 25 desktop cases passed; the desktop suite ran against both packaged and installed builds. GitHub's implementation checks passed. On the owner's requested retry after reporting Do Not Disturb, the real notification click restored the hidden calendar. No manual shortcut/registry repair was needed after this upgrade. Full clean-PC installation/uninstall, scheduled timing, sleep/login and fully-quit activation remain separate acceptance work.
