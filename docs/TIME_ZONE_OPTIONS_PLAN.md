# Complete time-zone suggestions

1. Replace the 16-entry shared datalist with the full time-zone catalog supplied by the pinned Electron runtime's `Intl.supportedValuesOf('timeZone')`. Keep the existing editable, searchable native input; do not introduce network fetching or a separate time-zone database.
2. Add UTC, Etc/UTC, Etc/GMT and the supported Etc/GMT fixed-offset names, which enumeration can omit. Filter names through the same Luxon IANA validity check used by application preferences. Deduplicate and sort, putting UTC first.
3. Retain valid saved/display-zone aliases even if the runtime enumerates another primary name. Continue accepting valid names typed manually. Invalid names remain rejected by existing preference validation.
4. Reuse the shared datalist in settings, onboarding, item/semester editors and import. Add a search placeholder and explanatory settings text; preserve the computer-zone toggle and Apply behavior.
5. Verify catalog completeness/validity, alias handling, unusual fractional-offset zones, actual Settings selection/Apply, event instant preservation and saved selection after an ordinary restart of an isolated test app. Check configured and absent-config sign-in readiness after packaging.
6. Type-check, build/package without changing version 0.1.16, scan secrets/package boundaries, retain local test evidence and commit/push to the existing branch. Do not replace the normal installation or cloud rules.

Enumeration follows the runtime's IANA data. Primary names and accepted aliases are distinct; aliases are preserved without treating them as separate geographical zones. Reference: [ECMAScript internationalization time-zone enumeration](https://tc39.es/ecma402/#sec-availableprimarytimezoneidentifiers).

## Verification completed October 2

The Windows test package lists **447 options**, including every one of its **418 enumerated geographic zones** plus UTC/fixed-offset names. The shared catalog also supplies onboarding, event/semester editors and imports. Valid saved aliases appear in suggestions; other valid aliases can still be entered manually.

Typecheck and 39 relevant source cases pass. The real isolated packaged Settings test passes Apply, Australia/Eucla's 45-minute offset rendering, ordinary restart persistence, manual US/Eastern alias selection and exact preservation of the stored event. Both configured and absent-config sign-in readiness cases pass fresh startup and ordinary restart. The first two Settings attempts failed on test locators whose exact label text included button/option contents; corrected accessible-role locators pass without changing application behavior. Failed attempts remain in local test evidence.

Secret scanning passes for 238 publishable files. Package scanning passes for 234 archive entries, ten dependency notices and 23 unchanged covered-source files. The initial sandboxed credential scan could not spawn Git; its authorized rerun passes. Evidence remains under ignored `test-results/time-zone-settings*`; the verified package ASAR SHA-256 is `fe5a984f30126ad2c42e2d4fc05dcb26744175c4dd9183c5ebe1a22835e53e51`.

Version remains **0.1.16**. These changes are in source and the isolated test package; the normal installation, account/profile, private configuration and cloud rules are unchanged. Sign-in readiness checks assert configured controls, not a new live Google consent exchange.
