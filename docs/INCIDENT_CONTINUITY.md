# Incident response and continuity preparation

Engineering draft, September 28, 2026. Advances T-59/T-60; **not an approved operating policy or completed human tabletop**. Scope: owner-operated student calendar in Ontario, no patient-record workflow. The owner's installed build remains 0.1.5; current engineering work targets 0.1.8. Actual contact details, evidence and recovery material belong in restricted private storage, never this public repository.

## Responsibilities and activation

The operator must name an incident lead and deputy, technical recovery owner, privacy/legal decision maker and communications approver. One person may cover several roles in the owner-only phase, but recovery cannot depend on an unavailable sole operator. Record two verified contact routes, provider account/support references and recovery custody privately. These appointments and escalation exercises are pending.

Proposed triage categories for approval:

| Category | Trigger | Initial action |
| --- | --- | --- |
| Critical | Suspected active credential/admin compromise, unauthorized personal-data access or distributed malicious build | Notify the incident lead immediately through a verified private route; stop affected releases or access through a scoped approved action; preserve evidence and assess privacy impact in parallel. |
| High | Data corruption/loss, unusable backup, repeated authentication abuse or prolonged provider failure | Protect remaining copies, identify affected accounts/devices and the last trustworthy recovery point; escalate to the technical owner and privacy reviewer where disclosure is possible. |
| Standard | Contained defect or warning without evidence of compromise/loss | Record scope and evidence, assign an owner and re-evaluate if new facts change severity. |

These categories are proposals, not response-time service commitments. Detection is currently based on local diagnostics, CI, provider/repository observations and owner reports; no staffed alert service is claimed. The process structure is informed by the [Canadian Cyber Centre incident-response guidance](https://www.cyber.gc.ca/en/guidance/developing-your-incident-response-plan-itsap40003).

## Response sequence and decision record

1. Open a private incident record with an identifier, discovered/estimated occurrence times in UTC, reporter, affected system/build/account categories, known facts versus hypotheses, severity, lead and next review time. Do not paste tokens, passwords or calendar entries into tickets or chat.
2. Preserve relevant logs/configuration snapshots, exact installer/source hashes and provider audit references. Record collection time, collector, source, SHA-256 and access/transfer history. Keep a restricted original and a separately redacted working copy. A file hash helps detect changes; it does not establish trusted custody by itself. Avoid casual deletion or retention cleanup of evidence under investigation.
3. Contain only the affected boundary. Record purpose, authorizer, scope, expected user impact, verification and rollback for each action. For exposed credentials, use provider revocation/rotation and verify rejection of the old credential against a harmless resource. Never test by locking out the sole owner. Quitting the desktop app stops local activity; it does not disable direct cloud access or revoke a stolen token.
4. Establish cause and extent using provider and local evidence. Determine whether data was read, changed, lost or merely unavailable; absence of a log is not proof of no access. Check affected time range, accounts/devices, artifacts, downstream copies and continuing access. Preserve unanswered questions and confidence levels.
5. Run the privacy/contract notification assessment below concurrently with technical investigation. The incident lead cannot postpone a required notice solely because root-cause analysis is unfinished. Contact external parties only through approved channels with an accountable sender.
6. Recover from an identified trustworthy copy/build in isolation. Compare records and relationships, verify pending work and authentication boundaries, then authorize reconnection. Do not reconnect an old synced database to production until stale cursors, receipts, tombstones and deletion markers have been assessed. Verify that the containment issue is repaired before restoring service.
7. Record residual loss, notices/decisions, validation evidence and recovery approval. Assign corrective actions with owners and dates; rerun failed controls, review lessons and protect retained evidence. Close only when the accountable owner accepts the documented outcome. No automated closure or risk acceptance is implied.

## Privacy assessment gate

The operator's qualified privacy/legal reviewer must determine applicable law and contractual obligations from the actual organization, data, affected people and service roles. The draft must not invent a universal 72-hour deadline.

For an organization subject to PIPEDA, the OPC describes reporting to the regulator and notifying affected people when a breach creates a real risk of significant harm, assessed using sensitivity and likelihood of misuse. Its guidance requires records of all breaches, including those below the reporting threshold, retained for two years (other duties may require longer), and notification as soon as feasible after determining the breach occurred. Record the assessment, rationale, reviewer, recipients, delivery evidence and follow-up; do not treat owner-only distribution as a legal exemption. [OPC reporting and record-keeping guidance](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/privacy-breaches-at-your-business/gd_pb_201810/).

PHIPA remains a separate applicability review. The current scope has no patient-record purpose; healthcare expansion requires analysis of custodian/agent roles and the resulting notification duties before use. The [IPC breach protocol](https://www.ipc.on.ca/en/health-organizations/responding-to-a-privacy-breach/privacy-breach-protocol) is a review input, not evidence that this product is a custodian or PHIPA-compliant. No notification or external message is sent by this document.

## Continuity and backup design

The operator must approve maximum tolerable interruption, **RTO** (time to restore a defined usable service) and **RPO** (maximum acceptable loss since a recoverable point), separately for local calendars, cloud synchronization and release/admin recovery. No targets are approved yet. The [Canadian Cyber Centre recovery guidance](https://www.cyber.gc.ca/en/guidance/developing-your-it-recovery-plan-itsap40004) supports identifying critical services, dependencies and recovery procedures before relying on a plan.

| Recovery asset | Existing behavior | Required operating decision/evidence |
| --- | --- | --- |
| Logical calendar backup | Exported JSON includes validated records/relationships and a checksum; restore uses previews and normal mutation queues | Approve frequency, encrypted independent storage, access, retention, recovery-key custody and a restore drill. A checksum is not encryption. |
| Local SQLite snapshots | Account-specific recovery copies preserve database state; damaged originals are quarantined during recovery | Copies on the same laptop do not survive laptop loss. Verify selected snapshot version/age and WAL-consistent creation; protect queues/history and quarantines as sensitive data. |
| Cloud calendar | Sync provides a replica and conflict handling | Replica deletion can propagate. Provider PITR and deletion protection were observed disabled in the September 27 inventory. Approve cost/scope and test independent backup/restore before an availability promise; no paid toggle is authorized here. |
| Identity/configuration/signing | Local encrypted session and privately supplied provider configuration; unsigned installers | Backup protected configuration separately from calendar exports; verify account recovery, provider/deputy access and future signing-key custody. Never place credentials in a calendar backup or repository. |
| Releases/evidence | Versioned local installers, source commits, hashes and finite CI retention | Approve trusted offline copies and evidence access/retention. Rebuilding from Git alone is not proof the earlier binary can be recovered. |

For local corruption, stop the affected writer normally, preserve database/WAL/SHM and known snapshots, validate a copy, then use documented recovery controls. For provider outage, retain durable local changes and avoid deleting/recreating accounts to force sync. For lost devices or compromised admin access, secure identity/provider access before reconnecting restored data. Account deletion markers and revocations must not be undone by restoration. Device-level encryption, independent storage and recovery access remain unverified.

## Ordered synthetic drill

Run only against newly created test profiles with no cloud configuration. Record app/ASAR version/hash, fixture count, backup creation time/hash, tested recovery start/end and exact assertions. Automation substitutes file-dialog destinations solely inside the fixture directory; it must never select a real user backup or profile.

1. Create linked semester/course, recurring class with an override/completion, assignment, linked study session, no-date task and synced preferences. Disable notifications and cloud traffic. Save device-only preferences separately to verify export exclusions.
2. Export through the packaged app. Verify the backup's schema/checksum, logical record equality and absence of session/device/queue/cursor/delivery fields. Preserve the source profile and exact backup; simulate loss only by opening an empty separate profile, not by deleting any original.
3. Start the recovery timer before launching the empty profile. Import via the normal preview/merge flow, verify record/relationship/completion equality, expected pending writes and a pre-restore snapshot. Verify that source device-only preferences were not imported.
4. Restart the restored profile and verify durability. Attempt a checksum-damaged backup and confirm rejection with unchanged records/pending writes. Record recovery duration and the exact backup boundary; no real outage, maximum loss or approved RPO/RTO pass is inferred.
5. Keep sanitized summary/hash evidence separate from raw synthetic profiles. A local automated drill does not establish encrypted off-device recovery, provider recovery, key loss, operator availability or a second-PC result.

## Human tabletop still required

The operator and named participants must rehearse: exposed GitHub/provider credential; inaccessible laptop with only an independent backup; provider outage with offline queued edits; suspected calendar disclosure with incomplete logs. At each inject, record who receives the alert, containment authorization, evidence custody, notification decision, recovery choice, elapsed time and unresolved dependency. The exercise must validate contact/escalation routes without sending a real breach notice or revoking production access. Participants, date, decisions, objective approvals and corrective-action retests remain pending; an automated restore is not this tabletop.

See [access governance](ACCESS_GOVERNANCE.md), [data inventory](PRIVACY_DATA_INVENTORY.md), [risk register](RISK_REGISTER.md) and [implementation evidence](IMPLEMENTATION_STATUS.md). T-59/T-60 remain open until approved ownership, operating controls and the required human/provider/off-device evidence exist.
