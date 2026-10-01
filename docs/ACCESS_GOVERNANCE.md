# Administrative access and repository controls

Engineering draft, September 28, 2026, T-54/T-57/T-58. Ontario operator; owner-only distribution; legal entity, named officers and deputies remain undecided. This is an inventory and proposed procedure, not approved policy or evidence that organizational controls operate continuously. Raw account, credential, recovery and access-review records belong in private evidence storage, not Git.

## Read-only repository observations

October 1 source continuation pins the existing build actions to verified commits and disables persisted checkout credentials, with six policy tests enforcing the source workflow boundary. See the [pin manifest](../.github/action-pins.json) and [implementation evidence](IMPLEMENTATION_STATUS.md). No remote repository protection, collaborators, MFA, IAM, recovery factors or organization settings were changed. This advances pipeline identity control, not operation of the proposed access program.

Refreshed at **2026-10-01 02:39 UTC** for 0.1.13, without changing settings. The separately retained `test-results/repository-access-inventory-0.1.13.json` has SHA-256 `1633dce140a9bce60e144e9cd6da0038abb7c764c97848a4bd0fe5e1475a8973`. Results remain: public repository/main, one admin, unprotected default branch/no rulesets, read-only workflow tokens with PR approval disabled, secret scanning/push protection enabled, automatic dependency security updates disabled and vulnerability-alert enablement unavailable (HTTP 404). The earlier inventory below is preserved. Administrator MFA/IAM/recovery and operating access-review evidence remain unverified.

Observed at **2026-09-28 20:04 UTC** through authenticated GitHub repository APIs. No permissions, protections, accounts or settings were changed. The sanitized local evidence is `test-results/repository-access-inventory.json`, SHA-256 `6ed9a2a19f71c7b5ad6c926f6f009cf8a28cee18b8b1fd40699509399c11db6a`; generated evidence remains ignored.

| Control | Observation | Implication / gap |
| --- | --- | --- |
| Repository boundary | Public repository; default branch `main` | Owner-only installer distribution does not make source/private artifacts automatically private. Git/archive exclusions remain necessary. |
| Repository access | Complete collaborator response: one admin; current authenticated access has admin permission | Single privileged operator and no demonstrated independent review/deputy. This does not identify every credential that can act for the operator. |
| Default branch protection | Branch API reports `protected: false`; repository ruleset list is empty | Required review/status checks and force-push/deletion controls are not demonstrated as enforced. Passing CI alone does not prevent a direct update. |
| Workflow defaults | Default workflow token permission `read`; pull-request review approval disabled | Matches the workflow's explicit `contents: read` boundary. Review permissions when adding release/deployment workflows. |
| Secret scanning | Secret scanning and push protection enabled | Useful detection controls; not proof that every secret pattern or historical commit is clean. The revoked historical key remains recorded in the maintainer guide. |
| Other security features | Automatic dependency security updates, non-provider secret patterns and validity checks reported disabled | The new blocking npm CI gate remains the observed dependency check. Broader native dependencies and credential validity need separate review. |
| Vulnerability-alert API | HTTP 404 | Alert enablement was not confirmed; no inference that an inaccessible or unavailable feature is operating. |

No GitHub administrator MFA/recovery-factor evidence was collected. Application-user MFA from the earlier Firebase inventory is a different control and cannot establish administrator MFA. Firebase/Google project IAM, service accounts, CI credentials, authorized devices, disk encryption, backup access and recovery custody remain unverified here. No access was revoked or credential rotated by this review.

## Proposed access register and procedure

The operator should appoint an accountable reviewer and recovery deputy before wider distribution. Keep the actual identities and recovery details private. Each register entry needs: service/project, named person or workload, purpose, role/scope, authentication factors, credential identifier (never value), device/recovery custodian, approval/effective/expiry dates, last use/review, evidence reference and removal status. Include GitHub, Firebase/Google Cloud, signing/distribution, local `.local` configuration, backups/OneDrive and future support/evidence systems. Do not equate calendar-account access with provider administrator access.

1. **Join:** approve purpose and least privilege; use individual identities; establish and verify MFA/recovery through each provider; record access and a non-sensitive successful action. Do not issue shared owner credentials.
2. **Change:** compare previous/requested privileges, justify additions, remove superseded privileges and verify a denied operation outside the new role. Preserve audit references without recording tokens or calendar content.
3. **Leave/revoke:** remove memberships/roles and workload grants; revoke active credentials/sessions as supported; rotate shared secrets only where exposure warrants it; verify removed access fails against a harmless test resource. Preserve the private record and check that necessary operations still work. Do not test by locking out the sole production owner.
4. **Recovery/emergency:** designate custody/deputy and approved triggers; protect recovery material separately; use time-limited access where available; record use and conduct a post-use review. Test with isolated resources and a verified recovery path before relying on it.
5. **Periodic review:** approve a cadence and event triggers (role change, new device/vendor, suspected compromise, distribution expansion). Reconcile actual provider membership/roles with the register, unused access, credential expiry and recovery custody. The cadence and named reviewer remain pending; this document does not establish a completed review cycle.

## Proposed release protection and validation

Before public distribution, define protected release branches/tags, prohibit routine force-push/deletion, require the current Windows check and a clean dependency gate, and select a review rule the named reviewers can actually satisfy. Decide how administrative bypass/emergency recovery works and record it; a single contributor cannot supply independent approval by approving their own work. Confirm hosting-plan feature availability before promising enforcement. No settings are changed by this proposal.

Test proposed rules on a disposable branch/ruleset first: direct unreviewed update rejected, missing/failing checks rejected, required review enforced, unauthorized force-push/delete rejected, and an approved fully checked merge accepted. Keep the actual denial evidence and actor roles private. Then apply the approved production rules and re-read effective settings. Add signing provenance/key custody and protected release credentials before publishing installers. The current draft PR, unsigned local installer and successful CI do not satisfy this entire gate.

T-57/T-58 remain open pending actual MFA/IAM/device evidence, approved ownership/procedures, negative tests, protected distribution and recurring review. See [risk register](RISK_REGISTER.md), [security/privacy plan](SECURITY_PRIVACY_PLAN.md) and [maintainer guide](MAINTAINER_GUIDE.md).
