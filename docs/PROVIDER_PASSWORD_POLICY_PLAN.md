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
3. Use the official Firebase/Identity Platform password-policy console or the supported administrative API schema reviewed below. Apply only the five settings above, using a passwordPolicyConfig-only update mask. Preserve other project settings and compare selected fields before/after. No audit/enforcement reCAPTCHA toggle, request-logging setting or billing change is included.
4. Re-read both administrative and effective policy. Require exact min/max/enforcement values. Send forceUpgradeOnSignin explicitly false; if a protobuf response omits that false field, record its omission rather than claim an explicit readback. Require separate successful synthetic legacy short-password sign-in, alongside rejection of new short passwords, before accepting compatibility. Test raw client signup/change requests at 14/15/128/129 characters, Unicode boundary cases and no composition requirement; require specific policy rejection and no accidental identity/password change. Exercise an existing valid password session. Verify password linking and ordinary app signup/change error handling using disposable identities and the actual hardened test window. The earlier same-Windows hardened password-account acceptance does not verify the proposed provider-policy behavior. Hosted email-reset delivery remains a separate human acceptance gate.
5. Delete every new synthetic identity and any synthetic data on success/failure; verify cleanup independently. Retain sanitized counts, response codes, policy fingerprint and limited scope. Never relax existing policy automatically to make a failed test pass. On failure, prepare the exact prior effective settings for reviewed restoration and report any temporary incompatibility; do not claim byte-identical rollback of an omitted administrative field.
6. Record verified results and residual gaps. This closes only measured provider length enforcement, not distributed auth/read abuse, comprehensive password screening, administrator MFA, monitoring or formal compliance.

The primary references are Google's [password-policy guide](https://docs.cloud.google.com/identity-platform/docs/password-policy), [effective policy API](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/TopLevel/getPasswordPolicy) and [project configuration schema](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config). The live change needs a specific rollout decision because it applies across the Firebase project and provider-hosted account flows. No live provider policy has changed during preparation.

## Administrative schema review, October 1

Read-only review of Google's public [v2 discovery document](https://identitytoolkit.googleapis.com/$discovery/rest?version=v2), revision `20260923`, and [updateConfig reference](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig) identifies the administrative resource and field names below. The fetched document fingerprint is `971af9ad6d0b6dcad080a254ee5b4ed88a4ab51b3035a9ce0b549bf5d4d8aed6`; the ignored report retains selected schemas and the fingerprint, not the complete fetched document. No authenticated mutation or server acceptance was performed. Schema review does not replace live readback or behavior tests.

Proposed request: `PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT_ID}/config?updateMask=passwordPolicyConfig`. Resolve and assert the actual project privately at rollout; do not place its credentials in this file. The [PasswordPolicyConfig administrative schema](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects.tenants#PasswordPolicyConfig) uses a one-element passwordPolicyVersions array:

```json
{
  "passwordPolicyConfig": {
    "passwordPolicyEnforcementState": "ENFORCE",
    "forceUpgradeOnSignin": false,
    "passwordPolicyVersions": [{
      "customStrengthOptions": {
        "minPasswordLength": 15,
        "maxPasswordLength": 128,
        "containsLowercaseCharacter": false,
        "containsUppercaseCharacter": false,
        "containsNumericCharacter": false,
        "containsNonAlphanumericCharacter": false
      }
    }]
  }
}
```

Do not mix this shape with client/effective-policy representations or guide examples using enforcementState/constraints. Omit read-only schemaVersion and lastUpdateTime. The project-wide rollout remains pending the specific approval already requested; continued preparation does not apply these settings.
