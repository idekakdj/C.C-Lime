# Build dependency and release evidence work

September 27, 2026. T-45/T-58 follow-up; target build 0.1.5. Operator location: Ontario, Canada. Next distribution scope: owner only. Legal entity/contact remain undecided. This does not waive security findings or authorize public distribution, paid services, signing purchases or an assurance claim.

## Baseline and bounded change

The refreshed npm report contains 32 affected-package findings, including inherited findings: 1 critical, 20 high, 8 moderate and 3 low. Forge resolves an older nested `@electron/rebuild` 3.7.2 using `tar` 6.2.1, while the project's direct rebuild 4.2.0 already resolves patched `tar` 7.5.22. The CLI also uses an older temporary-file helper, and Firebase administrative tooling has an available patch update. `extract-zip` remains an upstream finding with no patched registry release observed. Keep that unresolved; do not suppress it or call a dependency scan a security certification.

## Ordered work and acceptance

1. Save the original audit privately, inspect resolved dependency paths and primary advisory records, and record package versions, affected input, build/runtime exposure, proposed treatment and remaining risk.
2. Unify Forge's nested rebuild dependency with the already pinned direct 4.2.0 through an explicit npm override. Inspect Forge's used API and validate on the pinned Node 24.13.0. Upgrade the temporary-file helper to pinned 0.2.7 and Firebase CLI to pinned 15.31.0. No broad forced audit fix or unreviewed major parent-tool upgrade.
3. Refresh the lockfile, review changes and audit again. Revert any incompatible override rather than marking the issue fixed from version numbers alone. Exercise temporary-file cleanup, the rebuild API and the real SQLite native build/package path. Verify changed Firebase CLI with the cloud emulator suite; do not redeploy unchanged live rules.
4. Generate a standard CycloneDX inventory from the complete lockfile, retain a private raw audit and a publishable concise triage report, and record checksums. A full dependency inventory includes build-only tools; an `omit=dev` inventory alone is incomplete because renderer/domain libraries are bundled from devDependencies. Do not claim this inventory lists Electron/Chromium's internal native components.
5. Add reproducible commands and CI evidence generation. A production release security check must fail on unresolved high/critical or runtime findings; ordinary preview verification can report them without implying acceptance. Implementation uses a stricter all-findings gate because dev/runtime labels cannot identify every bundled library. Document exact remaining findings and who must resolve/approve treatment.
6. Run source/secret/type/unit/build, cloud emulator and actual Windows package/desktop checks. Build a versioned unsigned installer, inspect its archive for credentials, record SHA-256 and preserve the installed 0.1.4 baseline. A build-tool update alone does not require installing a new preview over the owner's working app.
7. Prepare an engineering privacy data/retention inventory and initial risk register using actual source behavior. Distinguish proposed operator decisions from implemented controls. Link actionable gaps to T-53–T-60, with evidence/review/sign-off slots left honestly unapproved.
8. Commit reviewed source, lockfile, scripts and concise documentation; generated inventories/audits remain ignored or CI artifacts. Update the existing draft PR and implementation register with observed results and outstanding external decisions.

No destructive live abuse tests, automatic deletion of retained user data, cloud billing changes, emails to others, certification procurement or publication are included.
