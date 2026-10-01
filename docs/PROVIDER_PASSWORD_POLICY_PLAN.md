# Provider password policy alignment

October 1, 2026. Proposed live setting change for review; not deployed. This advances the remaining provider-control work without changing the installed 0.1.15 app, user credentials, billing, MFA, reCAPTCHA or logging.

## Observed mismatch

The installed application's new-password validation requires 15–128 Unicode code points and rejects a small set of predictable patterns. Existing-password sign-in deliberately accepts older passwords. This is an application guard; a modified client can call the provider directly. At 09:23 UTC, a read-only effective-policy request returned HTTP 200, schema 1, ENFORCE, minimum 6 and maximum 4096. forceUpgradeOnSignin and composition fields were omitted, so their state is not established by that response. The preceding administrative config GET omitted passwordPolicyConfig entirely; that absence was not interpreted as disabled. Effective-policy evidence SHA-256: `1f028b2a8e967d4fb7291da150aef5e3ab8e34b2604492dcad4c0124450c58b0`. Selected configuration evidence: `39194d294a5c134fd7577e0a75da2948cd8ef605132fbc1917e05958160fccd0`. Both sanitized reports remain ignored locally.

## Exact proposed behavior

| Setting | Proposed value | Purpose |
| --- | --- | --- |
| Enforcement | Require / ENFORCE | Reject weak-length new passwords at the provider even when the desktop app is bypassed. |
| Minimum | 15 | Match the installed app's minimum. |
| Maximum | 128 | Match the installed app's accepted new-password range. |
| Required uppercase/lowercase/numeric/symbol | None | Preserve long passphrase support; no new composition rules. |
| Force upgrade on sign-in | Explicitly disabled | Preserve access for existing-password accounts while requiring compliant newly created/changed passwords. Verify with synthetic legacy credentials. |

Provider character counting must be measured rather than assumed to match JavaScript Unicode code-point counting. The application predictable-pattern check is not a comprehensive compromised-password database and is not established as enforced remotely by these length settings. Email/password signup, password linking/change and provider-hosted reset flows may be affected; Google sign-in and calendar data are outside the proposed change.

## Ordered rollout after approval

1. Re-read actual project/config and effective policy, assert the expected project privately, and preserve a never-overwritten private pre-change policy snapshot. Do not record API keys, tokens, account IDs or raw unrelated configuration in public evidence. If concurrent policy changes are detected, stop dependent rollout and reconcile the new baseline.
2. Create disposable synthetic accounts only, including a legacy-length baseline account, with unique addresses and random credentials retained privately. Confirm current successful sign-in and record cleanup targets before any mutation. Do not send password/reset/verification emails or change the owner's password.
3. Use the official Firebase/Identity Platform password-policy console or a separately verified supported administrative API schema. Apply only the five settings above. The guide and reference show different request-field representations; do not send a guessed PATCH. Preserve other project settings and compare selected fields before/after. No audit/enforcement reCAPTCHA toggle, request-logging setting or billing change is included.
4. Re-read both administrative and effective policy. Require exact min/max/enforcement values and explicit force-upgrade disabled. Test raw client signup/change requests at 14/15/128/129 characters, Unicode boundary cases and no composition requirement; require specific policy rejection and no accidental identity/password change. Exercise existing synthetic short-password sign-in and an existing valid password session. Verify password linking and ordinary app signup/change error handling using disposable identities and the actual hardened test window when its signed-in acceptance is available. Hosted email-reset delivery remains a separate human acceptance gate.
5. Delete every new synthetic identity and any synthetic data on success/failure; verify cleanup independently. Retain sanitized counts, response codes, policy fingerprint and limited scope. Never relax existing policy automatically to make a failed test pass. On failure, prepare the exact prior effective settings for reviewed restoration and report any temporary incompatibility; do not claim byte-identical rollback of an omitted administrative field.
6. Record verified results and residual gaps. This closes only measured provider length enforcement, not distributed auth/read abuse, comprehensive password screening, administrator MFA, monitoring or formal compliance.

The primary references are Google's [password-policy guide](https://docs.cloud.google.com/identity-platform/docs/password-policy), [effective policy API](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/TopLevel/getPasswordPolicy) and [project configuration schema](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config). The live change needs a specific rollout decision because it applies across the Firebase project and provider-hosted account flows. No live provider policy has changed during preparation.
