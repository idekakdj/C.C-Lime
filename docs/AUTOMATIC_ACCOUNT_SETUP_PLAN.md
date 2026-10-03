# Automatic account setup: prerequisite audit and implementation plan

Prepared October 2, 2026 (Ontario time); provider observation completed October 3 at 02:32:58 UTC. Baseline source is `2b7c4d3`; installed release remains 0.1.17. This document authorizes no provider deployment and implements no application feature. The user requested a plan and verification of restrictions/controls before feature implementation.

**Decision: do not start automatic release configuration yet.** The active key restrictions and deployed database rules have been verified, and existing control tests pass. Provider password alignment, distributed authentication/read/multiple-account enforcement, operational alerts, live desktop OAuth registration/secret-free exchange, privileged-access verification and release integrity remain unresolved. Unknown or untested controls are not passes. The audit itself made no installed-app update, version bump, owner-profile alteration, key rotation, API enablement, cloud configuration change or public distribution. The owner's subsequent instruction to work the plan and use an eight-character minimum is handled by [the scoped continuation](PASSWORD_MINIMUM_8_PLAN.md); dated results supersede only their corresponding historical observations below.

## 1. Intended behavior and security boundary

A fresh Windows installation should immediately offer working email/password and Google sign-in without asking a user to create an environment file. The same account on another configured device should synchronize its own records. Existing local-only calendars, account separation, offline queues, private overrides and remembered sessions must retain their behavior.

The distributed desktop app is an untrusted/public client. A user can extract or modify its copy. Firebase project ID, a restricted Firebase client API key and a desktop OAuth client ID identify services; they do not grant administrator privileges or prove the app is genuine. Keeping values out of GitHub prevents repository disclosure but cannot make installer contents confidential. Authentication, ownership rules, provider/server enforcement and release integrity remain necessary. See [Firebase key guidance](https://firebase.google.com/docs/projects/api-keys), [rules and authentication](https://firebase.google.com/docs/rules/rules-and-auth), and [native OAuth guidance](https://developers.google.com/identity/protocols/oauth2/native-app).

The implementation must distribute exactly three client values plus a schema version. It must not copy `.local/.env`, OAuth downloads, Google client secrets, service-account/admin credentials, login tokens, user databases or backups. All provider/administrator secrets remain private. No static shared secret may be used as desktop attestation.

## 2. Fresh prerequisite findings

All provider reads used existing authorized administration. Raw responses, client values, project/principal identifiers and authentication tokens were not published. Sanitized detailed evidence is in ignored `test-results/distributed-config-preflight.json`; SHA-256 `3a92b81613810b808c704ca5f7d6959b9c9ce88f871f3c85d62a93fd92b28b5c`. This hash identifies the read-only audit, not an application artifact.

| Control | Fresh observation | Acceptance status / implication |
| --- | --- | --- |
| Active Firebase key ownership | Lookup and metadata GET returned 200; key belongs to configured project | Verified metadata |
| API restriction | Exactly `identitytoolkit.googleapis.com` and `securetoken.googleapis.com`; all methods within those services | Verified metadata; retain exact allowlist, do not add unrelated/billable APIs |
| Other active project keys | Complete metadata list: one active key, zero API-unrestricted keys | Verified at observation time; deleted historical keys and other projects are outside this inventory |
| Allowed-service runtime check | Effective password-policy GET with the configured key returned 200 | Verified for this read; not a full sign-in/refresh transaction |
| Application restrictions | No browser/IP/Android/iOS restriction returned | Do not apply browser-referrer, Android, iOS or fixed-IP restrictions blindly to Windows desktops; prove compatibility of any proposed restriction first |
| Negative API-restriction runtime check | Key-only API Keys metadata returned 401 `CREDENTIALS_MISSING`; authorized Firestore metadata plus the key returned 200 | Neither proves `API_KEY_SERVICE_BLOCKED`; administrator Bearer access is a separate authorization path. Metadata restriction is verified; runtime exclusion is not independently proven |
| Deployed Firestore rules | Live source exactly matches repository after newline/outer-whitespace normalization; quota function present | Verified metadata plus fresh emulator behavior; normalized SHA-256 `bcc6a11b427b36130936f3fa7e00ecd74f88fe388dfcc28a86fd42c116fede05` |
| Ownership/verification/schema/write protocol | Fresh 59-case cloud emulator suite passed | Verified in emulators, using repository-matched rules; no new production-account traffic generated |
| Accepted write budget | Rules enforce 60 accepted atomic commits per server-timed 60-second account window | Preserve; not a general read/auth/request/cost cap, and multiple accounts multiply the allowance |
| Email/password and Google provider | Both enabled; improved email privacy enabled | Verified provider metadata; no owner sign-in was changed |
| Effective remote password policy | ENFORCE, minimum 6, maximum 4096; force-upgrade/composition fields omitted | BLOCKER: app requires 15–128 for new passwords. Direct clients bypass app-only validation. Omitted fields remain unknown |
| Application-user MFA | DISABLED | Observed; distinct from administrator MFA or Google-account MFA. Decide scope before broader release, do not enable by assumption |
| Email/password reCAPTCHA | Enforcement field not returned | Unknown; cannot claim bot enforcement |
| Desktop OAuth download | `installed` client, matching project and configured ID, expected Google endpoints | Verified local downloaded metadata; live registration/audience/consent and secret-free exchange still require separate evidence |
| Optional Google secret | Present in private local environment today | BLOCKER for the proposed three-field package: verify actual secret-free flow before removing this dependency; do not package it silently |
| App Check service metadata | Complete list returned 200 with no service configurations | Enforcement not established. Windows provider/attestation feasibility and legitimate-client acceptance remain open |
| Provider quotas | Complete selected lists returned 200: 9 Identity Toolkit, 2 Secure Token, 16 Firestore metrics; no returned consumer/admin overrides | Verified inventory, not desired product abuse limits. See examples below |
| Monitoring alert policies | Complete list returned 200 with zero policies | BLOCKER: no project monitoring alert policy or alert delivery established |
| Billing | Metadata returned 200, `billingEnabled=false`; no billing-account budgets available to inspect | No billing upgrade authorized; this does not guarantee continued free availability or prove an enforced product request cap |
| Recovery protections | Toronto database; PITR and whole-database deletion protection disabled | Observed. Recovery/retention decisions remain in existing continuity checklist; no settings changed |
| Project-local IAM | Fresh inventory: one human owner; service-agent/token-creator bindings; no returned public-principal binding | Scoped metadata only; sole-owner privileges, effective permissions, MFA/recovery/custody and review remain open |
| Service-account key metadata | Complete inventory: one service account, zero user-managed keys | Verified metadata; not proof of administrator MFA or absence of all credentials elsewhere |
| Existing source/package exclusions | Source scanner: 243 files clean. Existing test package: 234 archive entries clean, 10 notices/23 covered-source files preserved | Baseline protections verified; current package gate would intentionally reject proposed client values |
| Configuration/OAuth/local cooldowns | Fresh 27 existing tests pass across four files | Existing behavior verified; modified clients can bypass local enforcement |
| Dependency release gate | Fresh inventory: 1,126 components; 23 high affected-package findings; gate exits 1 | BLOCKER remains; no severity downgrade or exception introduced |
| Signing and production fuses | Existing installed owner preview is unsigned; seven shipping fuse gaps remain recorded | Public release BLOCKER; previous disposable compatibility tests are not production hardening |

Selected quota examples from the actual metadata: Identity Toolkit general project quota is 180,000/minute; its `{user}` quota is 30,000/minute (do not equate that quota dimension with a Firebase end-user product limit). Secure Token metrics report 6,000/minute and 18,000/minute for their respective metrics. Firestore reports 50,000 read operations/day and 20,000 write operations/day, among other metrics. All are provider metric/unit observations, not proof of custom account/IP enforcement or cost limits. Quota values must be re-read before any approved change.

Fresh IAM evidence: ignored `test-results/cloud-access-inventory-0.1.15-20261001.json`, regenerated during this audit despite its historical filename; identify it by observed time and SHA-256 `59fe3ee823bb942ac274cde0135377256ba6919911cb2ade6dd72a5f40924b9c`, not by its filename date. Private test logs: `config-preflight-unit.log`, `config-preflight-cloud.log`, `config-preflight-dependencies.log`.

An additional key-only negative probe to the unrelated Google Books API was rejected by automatic approval review as unnecessary, insufficiently authorized credential egress. It was not executed; its code was removed. Do not bypass that rejection with another destination or indirect invocation. Runtime exclusion remains unproven, while the direct provider restriction metadata is verified. No request for wider credential transfer is necessary to complete this plan.

## 3. Entry gate: controls to resolve before implementing the feature

Each row requires a dated result, evidence reference, scope and reviewer. No blank/TODO, omitted provider field, client-only check, or accepted residual risk may be relabeled as an enforced control. The owner-only audience remains in effect. The feature work in section 4 starts only after the owner-required preconditions are satisfied; public distribution additionally requires all public-release rows.

| ID / dependency | Required work | Objective acceptance | Present state |
| --- | --- | --- | --- |
| P-01 key/service boundary | Retain the two-service key allowlist; classify the three distributable values separately from true secrets. Refresh key/project inventory immediately before candidate generation | Exact project match and two allowed services; no wildcard/extra billable APIs; effective allowed read succeeds; runtime denial proof or explicitly scoped metadata-only result | Metadata passes; negative runtime proof open |
| P-02 provider password enforcement | Execute revised [exact policy proposal](PROVIDER_PASSWORD_POLICY_PLAN.md) under the owner's subsequent eight-character instruction; back up relevant values, deploy separately, independently re-read, test new/change/link/legacy/Unicode behavior with disposable identities and cleanup | Remote new-password min/max align with revised 8–128 policy; existing users retain documented sign-in/recovery behavior; direct weak-password requests denied; rollback procedure verified | PARTIAL: live ASCII 8–128 signup/change enforcement and legacy compatibility pass; six fixtures deleted. Unicode counting differs; raw attachment/reset and comprehensive screening remain open. Required MFA is now requested; [activation plan](REQUIRED_MFA_PLAN.md), inactive live |
| P-03 OAuth distribution eligibility | Confirm live Desktop registration belongs to project; verify provider accepts its ID; inspect consent testing/production state, permitted audience and scopes. Use isolated browser consent to test without local client secret | Real Google sign-in and restart succeed with no secret available to the fixture. State/nonce/PKCE/token audience validation and cancellation still pass | Local download passes; live registration/consent/secret-free transaction open |
| P-04 auth/read/global abuse architecture | Inventory configurable provider controls; compare supported provider enforcement versus authenticated gateway. Specify signup/reset/verification/login/read/denied-request budgets and campus shared-IP handling | Direct requests bypassing the desktop are throttled within approved account/IP/global policy; multi-account and concurrent-device tests pass; legitimate rights/recovery operations remain available | Current local/write limits insufficient; architecture/operator policy open |
| P-05 desktop attestation | Evaluate documented Windows/Electron support and custom-provider trust root; test legitimate installations and forged/replayed/debug-token requests | If used, genuine verifier-controlled evidence is required and provider/gateway enforcement independently observed; no static app secret/debug token shipped. If unsupported, P-04 must supply another enforceable design | No service enforcement established; feasibility open |
| P-06 operational alerting | Define operator/deputy, monitored request/denial/error/quota metrics, numerical thresholds, private routing, minimal identifiers, retention and response. Separately evaluate billing-budget/cap eligibility if billing is later proposed | Approved thresholds deployed; one safe synthetic event produces a real delivered/acknowledged alert; emergency containment and recovery demonstrated. Alert-only budgets never claimed as spend caps | Zero policies; thresholds/contact/cost choices open |
| P-07 account isolation and durability | Keep repository and deployed rule source equal; rerun emulator ownership/verification/mutation/quota tests. After separately approved control changes, verify with bounded disposable production identities | Anonymous, unverified and cross-account access denied; attempts to forge/reset quotas denied; conflicts/idempotent retry/deletion protections intact; denied writes remain queued and resume | Source/live match and 59 emulator cases pass; later approved deployment retest required |
| P-08 administrative and build trust | Verify owner MFA/recovery, least privilege, no public grants, secret custody, release reviews and approved build host; do not remove sole-owner access or service-agent roles by assumption | Dated actual verification and harmless denial/revocation tests; build operator authorized to handle configuration; no PR/untrusted code receives private inputs | Scoped IAM/key inventory passes; effective-access/MFA/custody decisions open |
| P-09 dependency/native gate | Remediate outstanding root advisories without disabling the existing gate; reconcile build/native components and preserved license notices | Release gate exits 0; reviewed dependency/source changes, exact-artifact inventory and relevant tests pass | 23 high entries keep gate blocked; no patched/waived claim |
| P-10 protected production distribution | Complete production fuse plan on a separately identified candidate; obtain signing identity/custody, sign executable/installer, verify signature/chain and build provenance | Reviewed shipping fuse values and independent boundary tests; real valid signature and provenance; altered artifact rejected | Public-distribution blocker, separately tracked from owner-only test artifacts |

### Enforcement design constraints

1. Provider quotas and per-account write budgets are separate controls. Record exact units/window/burst behavior. There must be no claim that a quota on accepted commits caps denied requests or all reads.
2. A gateway is ineffective if a modified client can still reach the protected Firestore resources directly. A proposed gateway must include a staged provider authorization change that denies direct user access to the protected route, or an equally demonstrated provider-enforced mechanism. Do not deploy such a change before migration/rollback is tested; it would break existing clients.
3. Gateway administrator access bypasses user rules. Every handler must independently verify identity/verification, bind UID from the verified token, validate schema/size and enforce version/idempotency/rate limits. Never trust caller-supplied owner IDs. Use a least-privileged runtime identity and hosted secret storage, not downloaded admin keys in a desktop or repository.
4. Authentication endpoints remain provider-facing even if calendar reads use a gateway. Apply a provider-supported auth abuse design and verify direct-endpoint bypass separately. Moving only desktop calls through a proxy is insufficient.
5. Proposed numerical limits must be selected before enforcement, using measured legitimate two-device sync/login/import/export behavior, expected audience, retries and acceptable recovery times. Record account/IP/global buckets, window, burst, exemptions, lockout recovery, privacy identifiers, shared-campus-IP treatment and responsible operator. Do not silently replace 180,000/minute with a guessed production quota.
6. App Check is an additional abuse signal, not user authorization, a complete abuse guarantee, or automatic proof that Electron supports platform attestation. Never ship a debug token as an alternative. See [App Check capabilities and custom providers](https://firebase.google.com/docs/app-check).
7. Alerts and budget notifications detect issues; enforceable throttling/containment must be separate. If a provider spend-cap option is considered, verify current product/project eligibility, covered services, enforcement delay and recovery. No billing account/upgrade is presently enabled or approved. See [billing budget and cap documentation](https://docs.cloud.google.com/billing/docs/how-to/budgets).
8. All denial/abuse tests use emulators or approved staging with explicit request bounds. Do not brute-force passwords, generate email floods, attack real accounts or load-test the production project to exhaustion.

## 4. Planned feature implementation, only after section 3 passes

### F-01 release input and artifact schema

- Add a dedicated release generator (planned `scripts/prepare-release-client-config.mjs`). Read only named variables from the private build environment/ignored input; never serialize the environment object or parse arbitrary user-selected config files.
- Output ignored `dist/release-client-config.json`. Proposed schema is strict: `schemaVersion` literal 1; `projectId` matching the existing project format; bounded `firebaseApiKey`; `googleClientId` ending in the expected Google client suffix. Exactly these four fields are permitted. Unknown fields, empty/malformed values, an unexpected project or incomplete configuration fail release packaging with a redacted error.
- `googleClientSecret`, administrator/service-account material and identity/session data are forbidden. P-03 must establish that the actual provider client works without the optional secret. If it does not, stop and design/review a server-held confidential-client alternative; never silently add a fifth credential field.
- Record a non-secret schema/build identifier and opaque artifact hash. No real values in source maps, logs, command lines, test snapshots, public reports or error messages.
- Tests build with synthetic values only. A named release mode distinguishes a configured owner candidate from an intentionally local-only development/test package. Missing release input must fail configured packaging, not quietly produce disabled sign-in.

### F-02 runtime selection and account binding

- Extend `src/main/config.ts` to accept a fixed packaged resource path supplied by the main process. Only packaged main-process code may load that path; the renderer receives existing readiness flags, never a new configuration/token API.
- Proposed precedence preserves process environment over private local file over the packaged default. Select a complete configuration source: do not splice a private Firebase project/key together with a packaged Google ID from another project. Partial explicit overrides fail with a redacted explanation. Development mode keeps its existing local-only behavior.
- Load synchronously during startup with a small reviewed file-size ceiling (proposed 8 KiB), UTF-8 JSON parsing, strict schema, regular-file checks and no user-controlled path or network fetch. Reject directories, oversized files, invalid JSON, unknown versions/fields and forbidden values. Validate symlink/reparse behavior in the packaged installation boundary.
- Bind remembered sessions and account data to the selected project as current authentication code does. Project mismatch requires fresh sign-in and never transfers a saved token/account database to the new project. Preserve pending edits for the original account instead of attempting a silent migration.
- Do not write configuration into an owner's `.local/.env`, overwrite private settings, copy remembered login or auto-merge local-preview records. Startup must not contact an arbitrary URL taken from configuration; Firebase/Google service origins stay fixed/validated in code.

### F-03 packaging and scans

- Update `forge.config.cjs` to include only the generated, reviewed release resource. Continue excluding `.local`, `.env`, OAuth downloads, tools, user data, evidence, backups and source-only files.
- Keep the repository scanner strict: the real client key/ID remain forbidden in tracked/publishable source, including PR descriptions, documentation, CI artifacts and source maps. Source scan failure still blocks a commit/release.
- Add a package-specific exception limited to the three reviewed values at the single resource path and strict schema. Do not turn off credential signatures globally, exempt a directory, allow secrets by filename, or allow a client value scattered into JavaScript/HTML/assets. Exact local Google secrets, private-key blocks, session tokens and administrator credentials remain forbidden everywhere.
- Inspect the whole distribution: ASAR, outside-ASAR resources, unpacked native directories, nupkg, extracted installer content and logs. The present archive-only credential scan is insufficient for a new outside-ASAR resource; expand it before allowing that resource into a release.
- Reject duplicate/case-variant config resources, unexpected resource names/fields, source maps containing real values and stale client-config files from a preceding build. Verify generation runs after ordinary build cleanup and before package copy, with cleanup on failure.
- Maintain license/native inventory checks unchanged. Reject a configured candidate unless both source cleanliness and exact-artifact package allowlist tests pass, including negative fixtures.

### F-04 build, GitHub and signing separation

- Public pull-request CI receives synthetic configuration and does not produce a production-configured installer. Never use `pull_request_target` or untrusted PR code with private inputs.
- Any future real release CI must use a protected, approved environment and authorized ref/reviewer, with values injected only during trusted packaging. Until that exists, controlled local packaging remains the candidate mechanism. No GitHub secret creation or workflow deployment is implied by this plan.
- Real configured installers remain private under ignored `release/` until explicit distribution authorization and P-10 acceptance. Their contents are extractable even when encrypted/obfuscated or omitted from GitHub.
- Produce per-candidate manifests/hashes, dependency and native inventories, license evidence and real signature results. Do not equate a hash with a signature, a test-copy fuse vector with the shipping vector, or a local package with the installed artifact.

## 5. Required acceptance matrix

Every feature case below is planned, not claimed passed. Existing 27/59 tests are prerequisite baseline evidence. Use isolated accounts/profiles; owner records and tokens never enter fixtures. Create synthetic data in the account's own UID only, bound all requests, and clean up test users/cloud records/config copies. Retain sanitized summaries rather than private logs or browser tokens.

| ID | Scenario | Required result |
| --- | --- | --- |
| V-01 | Fresh packaged profile; no `.local/.env` or process overrides | Email and Google controls available from packaged configuration; no owner session or user data present |
| V-02 | Ordinary quit/restart of fresh profile | Same configuration selected and controls available; profile path/version/artifact identity recorded |
| V-03 | Live disposable email account | Sign-in, verified-account sync, encrypted remembered session, sign-out and signed-out restart pass; cleanup independently confirmed |
| V-04 | Real browser Google consent without optional secret | Correct desktop client completes exchange; account identity/audience/nonce verified; restart restores expected account; interactive/provider steps recorded honestly |
| V-05 | Two independent installations/profiles, same verified UID | Device A save reaches cloud then device B; reverse edit/photo/theme/completion sync; no configuration file manually created on either; actual separate PC acceptance recorded separately |
| V-06 | Two different accounts | No cross-account records/photos/queues/session leakage; ordinary sign-out/switch does not mix databases |
| V-07 | Anonymous/unverified/expired/revoked session | Protected reads/writes denied; pending edits remain local; reauthentication required; older-token limitations stated |
| V-08 | Offline first launch and later reconnection | Local preview and durable saves work as designed; clear connection/auth failure; no misleading synced state or lost queue |
| V-09 | Offline edits, concurrent devices, retried commits | Idempotent retries, conflict review and accurate acknowledgement; no silent overwrite or duplication |
| V-10 | Provider/gateway quota reached and Retry-After | Local saves remain durable; cooldown cannot be bypassed by sync-now/focus/restart where policy requires persistence; resume succeeds |
| V-11 | Missing/malformed/oversized/version-unknown release resource | Configured build fails packaging or startup reports a redacted failure; no crash loop, accidental fallback or sensitive diagnostics |
| V-12 | Complete same-project private/process override | Override selected coherently; no packaged value leaks into that source; existing private owner configuration preserved |
| V-13 | Partial override or changed project | Clear safe failure/fresh identity requirement; no mixed configuration, owner-token reuse or silent calendar migration |
| V-14 | Build input contains extra environment variables/secrets | Only reviewed fields generated; forbidden fields rejected; raw `.env` never copied |
| V-15 | Key/ID inserted outside approved resource | Source/package scan fails. A valid resource does not exempt JavaScript, renderer, documentation, maps or logs |
| V-16 | Google secret/admin key/session/database in any shipped location | Packaging verification fails with redacted file identification; outside-ASAR and installer extraction included |
| V-17 | Missing/duplicate/case-variant/stale config artifacts | Configured package rejected; clean-build order and failed-build cleanup independently verified |
| V-18 | Renderer tries to obtain configuration or Node/admin access | IPC remains allowlisted; no new secret/config endpoint; sandbox/context isolation/CSP/navigation and 404 defenses pass |
| V-19 | Forged/duplicate/oversized/stale/canceled OAuth callback | Existing host/path/method/state/nonce/PKCE/time/connection bounds retained; no session accepted |
| V-20 | Direct requests bypass desktop/gateway and fake quota counters | Enforced server/provider policy still denies cross-account/weak-password/excess requests as designed; direct bypass cannot circumvent gateway protection |
| V-21 | Separate UIDs/devices and shared-campus IP | Multi-account/global budget enforced; legitimate shared-IP behavior and recovery match approved policy; client-only limits not counted |
| V-22 | Synthetic abuse/quota/error event | Real private alert delivered/acknowledged; log redaction/retention and safe containment/recovery demonstrated |
| V-23 | Upgrade existing populated 0.1.17 profile | Closed-profile backup; calendar/queues/conflicts/local overrides/login/startup approval preserved; actual normal-context sign-in checks pass |
| V-24 | Failed install/rollback to retained artifact | Restore exact previous binary without damaging schema/data; rolled-back client compatible with any staged cloud controls; old key retained until migration is proven |
| V-25 | Tampered executable/installer/resource | Signature/integrity verification detects altered distribution; candidate rejected; hashes alone not claimed to prevent local administrator tampering |
| V-26 | Complete candidate CI and independent native/manual acceptance | Exact artifact identified; no failed dependency gate, unexplained skip or missing interactive/native step represented as a clean release |

## 6. Execution order, change approval and rollback

1. Complete this read-only inventory and baseline tests; save/push only redacted planning documents. **Current step.**
2. Resolve P-01–P-08 prerequisite gaps using concrete proposals. For provider/password/quota/rules/enforcement changes, prepare exact before/after values, staging evidence, user impact, rollback and any cost first; obtain the specific deployment decision before applying them. Existing [abuse review](ABUSE_THREAT_MODEL.md), [provider policy proposal](PROVIDER_PASSWORD_POLICY_PLAN.md), [access governance](ACCESS_GOVERNANCE.md) and [operating program](SECURITY_OPERATING_PROGRAM.md) remain applicable.
3. Verify the resulting controls independently. Do not start F-01–F-04 while the user's prerequisite verification remains incomplete. Resolve P-09 before producing a release candidate; public release also requires P-10 and remaining privacy/organizational acceptance.
4. Implement F-01, F-02, F-03 and F-04 in that order, each with its meaningful negative tests. No version change during source work. Add synthetic CI and update local-configuration/update-gate documentation to describe the new behavior accurately.
5. Run the full relevant source/tooling/cloud/desktop/renderer/security/native/license checks and V-01–V-26, documenting separate human/device observations. Public-CI outputs remain synthetic. Any failed control stops candidate acceptance.
6. Prepare a separately versioned private candidate only when the user requests an update. Preserve retained 0.1.17 artifact/configuration/profile; require ordinary tray closure for a safe backup/install. Apply mandatory fresh/restart normal-context sign-in gate after installation.
7. Keep current key/provider compatibility until a staged rotation/migration and rollback have been independently demonstrated. Never delete an in-use key or deny older direct clients before the replacement path is deployed and accepted. Stop on data loss, unexpected project selection, sign-in disablement, configuration leakage or a control bypass.
8. Public distribution needs a separate reviewed go/no-go decision after all engineering, operational, signing and privacy gates. This feature supplies convenience; it does not confer SOC 2, ISO 27001, DGSI or PIPEDA certification/compliance. PHIPA remains excluded.

## 7. Current completion statement

The plan and fresh available read-only verification are complete. The feature is **not started** and prerequisite closure is **not achieved**. Verified items: exact active key API restriction/project match, one active restricted key, provider readiness metadata, local desktop OAuth-download consistency, live rule/source match, 27 configuration/OAuth/rate tests, 59 cloud cases, source/package exclusion checks and scoped administrative key metadata. Open items are individually identified above rather than represented as verified. No cloud or installed-app settings changed.
