# Abuse-control review — C.C. Lime 0.1.3

Engineering review, updated September 27, 2026. T-53 is **not complete**. This document records current trust boundaries and concrete remaining decisions; it is not a penetration-test or assurance report. The application is a personal calendar, not a patient-record system. The operator is based in Ontario; the next release is owner-only. This audience choice does not restrict existing public provider endpoints.

## Boundaries and protected assets

Assets: private calendar content, account credentials/sessions, durable local changes, cloud availability/quota, usable reminders, installer integrity and operator administration. Trust boundaries: sandboxed renderer → allowlisted main process; operating-system user → local files; main process → Firebase/Google over TLS; verified UID → its Firestore documents; operator administrator → provider/repository configuration. Administrators can bypass user Firestore rules and need independent access governance. A modified desktop client is not trusted to enforce cloud policy.

## Abuse cases and controls

| Entry point / actor | Abuse and consequence | Current controls and evidence | Residual gap / precise next action |
| --- | --- | --- | --- |
| Renderer command bridge | Repeated email/sign-in/file-dialog/notification actions consume resources or annoy the user | Main-process bounded command buckets before effects; cancellation/sign-out/local saves exempt. Unit/service tests and packaged isolation | Restarted or modified clients can bypass local buckets. Keep them as UX/resource guards; do not present them as distributed account/IP enforcement |
| Direct Firestore commits by a verified user | Flood writes, forge head count, retry duplicate mutations or race devices | 60 accepted commits/server-timed window/account; immutable receipts, CAS, max four records; hostile REST and racing-device emulator tests | Live deployment/acceptance must be recorded separately. Quota is per UID; multiple accounts multiply it. Fixed windows allow boundary bursts. Measure realistic large import duration and denial costs |
| Direct Firestore reads | Poll/query own large account repeatedly, consuming shared quota | Verified UID isolation, payload sizes, shipped client cadence/request budget | No custom server-side read-rate counter. Rules cannot safely implement general request counting via read-only calls. Evaluate an authenticated gateway/read cache, budget and operational capacity before public release |
| Direct authentication endpoints | Signup farming, password guessing, reset/verification email abuse, enumeration | Provider-owned protections/quotas, generic bad-credential and reset responses, local action buckets, provider Retry-After hold | Confirm actual project controls and monitoring. Evaluate supported abuse/bot protections and distributed account/IP limits without locking out campus/shared-network users. Do not assume Firebase quotas equal the desired product policy |
| Many verified accounts | Bypass one-account write budget and exhaust project resources | Each account remains isolated and independently limited; free provider quotas cap available service | Registration/verification abuse strategy, owner-approved capacity policy, alerts, response runbook and negative tests remain |
| Invalid/denied requests | Cause rule evaluation costs or availability loss without successful writes | Strict owner/schema/group/rate checks; bounded local requests | Denial is not cost-free protection. Measure attempted/denied traffic at the provider, evaluate upstream limits and emergency response; never load-test the live project destructively |
| Account deletion | Recreate data using stale tokens or repeatedly trigger expensive cleanup | Recent authentication for immutable deletion marker, owner-only records, resumable bounded deletion; stale writes blocked; emulator/live prior tests | Verify rate-limited deletion recovery in final live matrix. Keep privacy-rights access available during ordinary throttling. Operator retention review for markers/receipts/backups remains |
| OAuth loopback | Forge callback state or leave stale callback browser tab | Random state/PKCE/nonce, loopback binding, finite attempt and cancellation; state-forgery tests | Review connection/request size/time limits and callback edge cases; test delayed/duplicate callbacks. A refused stale localhost URL is not the app's 404 screen |
| Custom app protocol | Request filesystem paths or trick a missing page into privileged IPC | Fixed origin, extension/file/root checks, symlink containment, controlled 404/405, CSP, exact document IPC/navigation allowlist; unit/desktop tests | Preserve controls when adding routes or deep links. No public HTTP server or website is deployed |
| Local OS user / compromised device | Read plaintext calendar database/export, edit local settings or steal an unlocked session | OS account boundary, encrypted persisted authentication tokens, local-account separation | Calendar databases/backups are not application-encrypted. Evaluate full-disk/device encryption expectations and application encryption/recovery tradeoffs; disclose actual behavior. Software cannot protect an already fully compromised logged-in account |
| Developer/operator access or build compromise | Publish credentials, change rules, ship malicious unsigned binaries | Ignored private configuration, source/archive scans, pinned dependencies, CI tests; unsigned preview label | Actual admin MFA/least privilege/review, secret rotation, branch protections, build advisories, provenance/signing and independent review remain T-57/T-58 |

## Observed provider configuration — September 27, 2026

Read-only administrative API inspection returned HTTP 200 for authentication configuration and the default database. Only the following selected, non-secret fields were retained; raw configuration, domains and account details were not published.

| Setting | Observed value | Implication / follow-up |
| --- | --- | --- |
| Authentication subtype | `IDENTITY_PLATFORM` | Inventory provider-specific supported controls; this field does not establish billing level or service capacity. |
| Email/password sign-in | Enabled | Required product sign-in path remains available. |
| Improved email privacy | Enabled | Retain this protection and verify enumeration behavior in the final auth abuse matrix. |
| Application-account MFA | `DISABLED` | End-user MFA is not enforced by this project. This does not describe administrator or upstream Google-account MFA; those need separate review. |
| Email/password reCAPTCHA enforcement | Field not returned | Unknown from this response; do not infer enabled or disabled. |
| Database region/type | `northamerica-northeast2` / `FIRESTORE_NATIVE` | One observed database location; not a guarantee that identity, logs, support or every processor stores data in the same region. |
| Point-in-time recovery | Disabled | T-60 must evaluate recovery requirements, retention, cost and a restore drill. Other cloud backup mechanisms were not inventoried by this call. |
| Whole-database deletion protection | Disabled | Evaluate enabling protection against administrative database deletion; this is distinct from user account/document deletion. |

No configuration or billing settings were changed by the inventory. The tested write-quota rules were deployed separately: live source matched the tested file, raw REST bypass attempts were denied, and a durable save resumed automatically after a real server-window reset. The two quota-test identities and a further sync-test identity were cleaned up. These bounded checks do not close the distributed read/auth abuse or monitoring gaps above.

## Architecture decision required before a public service (remaining work)

Keep the no-cost pilot within current scope while collecting actual request/denial counts using synthetic data. Before choosing an enforcement layer, specify numerical global/account/IP budgets, expected campus NAT behavior, acceptable upload delays, provider failure behavior, data minimization, emergency override ownership and deletion/recovery exemptions. Inventory the provider's current configurable protections, desktop attestation support and hosting requirements from primary documentation. Do not embed a permanent shared secret in the desktop app as proof of a trusted client.

Compare (1) direct provider access with a documented accepted pilot risk, and (2) a managed authenticated gateway with enforceable distributed limits and abuse monitoring. Gateway approval must include cost, hosting owner, key protection, fail-open/fail-closed behavior, privacy impact, operations and migration tests. A risk acceptance cannot satisfy R-20's still-unmet public remote-abuse acceptance by itself. No paid upgrade, new vendor contract, gateway deployment or enforcement toggle is authorized merely by this comparison.

## Required verification before closing T-53 / A-57

1. Record current live quota/protection configuration without credential values and identify which limits are provider-controlled versus operator-configurable.
2. With isolated test identities, attempt direct requests that bypass the app. Test separate UIDs, independent devices, forged counters, read/query bursts, denied-write bursts, duplicate identities, password/reset abuse and campus-style shared IPs in an approved non-destructive environment.
3. Prove legitimate local saves remain durable; sync resumes after waits; no denied request is mistaken for an acknowledgement; deletion/access requests remain possible with proportionate identity checks.
4. Exercise monitoring and a safe alert using synthetic traffic. Verify retention/redaction: no passwords, tokens, email addresses, item titles, notes or private file paths in public logs or test artifacts. Decide any necessary security-log identifiers with the privacy owner.
5. Measure provider/rule request costs and demonstrate emergency containment/recovery. Record both successful and rejected requests rather than only client diagnostic counters.
6. Obtain an independent review and operator decision for residual risks. Link evidence, reviewer, date and follow-up owner in IMPLEMENTATION_STATUS.md; do not mark pass while the read/auth distributed-control gaps remain.
