# Provider password policy alignment

October 1 proposal, revised October 2, 2026 following the owner's explicit eight-character minimum and instruction to work the automatic-setup plan. The target is now 8–128 for newly set passwords. [The execution plan](PASSWORD_MINIMUM_8_PLAN.md) preserves existing short-password sign-in and verifies actual provider behavior before claiming deployment. Installed 0.1.17 still uses its prior fifteen-character app policy until a requested update; rollout results are recorded separately below.

## Observed mismatch

The installed application's new-password validation requires 15–128 Unicode code points and rejects a small set of predictable patterns. Existing-password sign-in deliberately accepts older passwords. This is an application guard; a modified client can call the provider directly. At 09:23 UTC, a read-only effective-policy request returned HTTP 200, schema 1, ENFORCE, minimum 6 and maximum 4096. forceUpgradeOnSignin and composition fields were omitted, so their state is not established by that response. The preceding administrative config GET omitted passwordPolicyConfig entirely; that absence was not interpreted as disabled. Effective-policy evidence SHA-256: `1f028b2a8e967d4fb7291da150aef5e3ab8e34b2604492dcad4c0124450c58b0`. Selected configuration evidence: `39194d294a5c134fd7577e0a75da2948cd8ef605132fbc1917e05958160fccd0`. Both sanitized reports remain ignored locally.

## Exact proposed behavior

| Setting | Proposed value | Purpose |
| --- | --- | --- |
| Enforcement | Require / ENFORCE | Reject weak-length new passwords at the provider even when the desktop app is bypassed. |
| Minimum | 8 | Match the owner's revised source policy; installed 0.1.17 retains fifteen until updated. |
| Maximum | 128 | Match the installed app's accepted new-password range. |
| Required uppercase/lowercase/numeric/symbol | None | Preserve long passphrase support; no new composition rules. |
| Force upgrade on sign-in | Explicitly disabled | Preserve access for existing-password accounts while requiring compliant newly created/changed passwords. Verify with synthetic legacy credentials. |

Provider character counting must be measured rather than assumed to match JavaScript Unicode code-point counting. The application predictable-pattern check is not a comprehensive compromised-password database and is not established as enforced remotely by these length settings. Email/password signup, password linking/change and provider-hosted reset flows may be affected; Google sign-in and calendar data are outside the proposed change.

## Executed rollout, October 3 03:02:59–03:03:07 UTC

The authorized passwordPolicyConfig-only change is applied and independently read back: ENFORCE, minimum 8, maximum 128, all four composition flags false. The request explicitly sets forceUpgradeOnSignin=false; the effective response omits that field, so compatibility is established through a real legacy seven-character login rather than an invented explicit false readback. Unrelated administrative fields match the private immutable baseline. Owner passwords/sessions/calendar, billing, MFA, reCAPTCHA, quotas and rules are unchanged.

Direct provider tests accept newly set ASCII passwords at eight and 128, reject seven and 129 with PASSWORD_DOES_NOT_MEET_REQUIREMENTS, accept eight lower-case characters without composition, preserve the old login after a rejected change, and accept an eight-character change followed by fresh login. Six disposable identities were independently deleted and confirmed absent; no cloud calendar fixtures or hosted emails were created. Sanitized local report `test-results/password-minimum-8-provider.json` SHA-256 `853ed53f447f031720957b83d8dec4ebef6572869a2bed5c38437b97d08e2896`.

**Partial alignment:** the provider accepts seven code points/eight UTF-16 units (`🌿abcde7`), accepts eight code points/nine units, and rejects 128 code points/129 units. These probes establish a counting difference, not every Unicode case. The app retains code-point counting; modified clients can bypass its eight-code-point minimum and small predictable-pattern blocklist. Do not call the provider fully NIST-length-aligned for Unicode. Raw credential attachment, provider-hosted reset and actual MFA enforcement remain separately unverified; unit attachment/change tests and packaged confirmation tests are source evidence. No complete P-02 closure is claimed.

The owner subsequently requests required MFA for email/password accounts. [The implementation/activation plan](REQUIRED_MFA_PLAN.md) explains restricted SMS, the unrestricted alternative, server enforcement, compatibility/recovery and billing/verification prerequisites. Current live end-user MFA remains disabled. An eight-character password alone does not meet NIST's single-factor minimum; exact length alignment alone would not establish full conformance either.

## Ordered rollout after approval

1. Re-read actual project/config and effective policy, assert the expected project privately, and preserve a never-overwritten private pre-change policy snapshot. Do not record API keys, tokens, account IDs or raw unrelated configuration in public evidence. If concurrent policy changes are detected, stop dependent rollout and reconcile the new baseline.
2. Create disposable synthetic accounts only, including a legacy-length baseline account, with unique addresses and random credentials retained privately. Confirm current successful sign-in and record cleanup targets before any mutation. Do not send password/reset/verification emails or change the owner's password.
3. Use the official Firebase/Identity Platform password-policy console or the supported administrative API schema reviewed below. Apply only the five settings above, using a passwordPolicyConfig-only update mask. Preserve other project settings and compare selected fields before/after. No audit/enforcement reCAPTCHA toggle, request-logging setting or billing change is included.
4. Re-read both administrative and effective policy. Require exact min/max/enforcement values. Send forceUpgradeOnSignin explicitly false; if a protobuf response omits that false field, record its omission rather than claim an explicit readback. Require separate successful synthetic legacy short-password sign-in, alongside rejection of new short passwords, before accepting compatibility. Test raw client signup/change requests at 7/8/128/129 characters, Unicode boundary cases and no composition requirement; require specific policy rejection and no accidental identity/password change. Exercise an existing valid password session. Verify password linking and ordinary app signup/change error handling using disposable identities and the actual hardened test window. The earlier same-Windows hardened password-account acceptance does not verify the proposed provider-policy behavior. Hosted email-reset delivery remains a separate human acceptance gate.
5. Delete every new synthetic identity and any synthetic data on success/failure; verify cleanup independently. Retain sanitized counts, response codes, policy fingerprint and limited scope. Never relax existing policy automatically to make a failed test pass. On failure, prepare the exact prior effective settings for reviewed restoration and report any temporary incompatibility; do not claim byte-identical rollback of an omitted administrative field.
6. Record verified results and residual gaps. This closes only measured provider length enforcement, not distributed auth/read abuse, comprehensive password screening, administrator MFA, monitoring or formal compliance.

The primary references are Google's [password-policy guide](https://docs.cloud.google.com/identity-platform/docs/password-policy), [effective policy API](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/TopLevel/getPasswordPolicy) and [project configuration schema](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config). The owner's revised instruction authorizes the eight-character policy work; the execution plan limits the project-wide change to reviewed passwordPolicyConfig fields. No unrelated provider or billing change is included.

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
        "minPasswordLength": 8,
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

Do not mix this shape with client/effective-policy representations or guide examples using enforcementState/constraints. Omit read-only schemaVersion and lastUpdateTime. October 3 02:50:06 UTC public discovery refresh has revision `20260924`, fingerprint `f8480b1ace674a479514f07eda1f88d4c6272549a6b924f5f2e0fed160ed0ddd`, and confirms these administrative property names. Actual provider readback/behavior/cleanup remains necessary; schema review is not server acceptance.
