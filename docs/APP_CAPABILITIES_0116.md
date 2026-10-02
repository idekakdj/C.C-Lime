# C.C. Lime 0.1.16 capabilities, security and compliance

October 2, 2026. **0.1.16 is installed and the normal app window has reopened.** Both Windows CI runs pass 495 tests with zero skips; the installed physical configuration, 108 distributed files/launcher, profile preservation, fresh/restart sign-in controls and five live disposable password-account checks pass. Installation and exact validation results are recorded separately in [implementation status](IMPLEMENTATION_STATUS.md). Audience: an owner-only Ontario personal student-calendar pilot, Windows x64. No formal compliance report, certification or legal compliance conclusion has been issued.

## Calendar and student planning

The installed inventory below is unchanged. A [source-only password-session follow-up](PASSWORD_SESSION_CHANGE_PLAN.md) requires fresh sign-in after password changes and validates old refresh tokens before each sync; it has separate live-provider and source/test-package evidence and is not yet installed.

- Month, week and agenda views, expandable day detail, today/navigation controls, search, course/type filters and 12/24-hour time display. Twelve-hour calendar labels use AM/PM.
- Classes, events, assignments, exams, study sessions and tasks; timed, all-day, deadline and undated task scheduling as applicable. Titles, notes, location, priority, progress/completion state, reminders and course/assignment links.
- Every scheduled item type can repeat daily, weekly, monthly or yearly. Interval, weekday, end-date/count and monthly date/ordinal choices; occurrence cancellation/editing and series/occurrence scope. Undated tasks cannot repeat without a schedule.
- Courses and semesters can be created and edited, with instructor/location/color, semester dates and breaks. Editing courses preserves linked items. Schedule review exposes effects of date changes on occurrences, exceptions and completions.
- Week-view dragging/resizing with recurrence scope and scheduling review. Time-zone-aware scheduling and optional following of the computer's time zone without silently rewriting stored item time zones.
- Upcoming seven-day sidebar; to-do ranges for the current week, current month and all tasks; completed-task history and weekly progress. Assignment/task/study/exam occurrences count as tasks; classes/events do not inflate task statistics. Completion history survives reopening/deleting tracked items; previously deleted history predating tracking cannot be reconstructed. Infinite repeating schedules have a disclosed six-month forward task-display horizon; the calendar can navigate to other dates.
- Persistent SQLite storage, offline use, pending-write status, cloud synchronization, retries and explicit conflict handling. Queued writes now immediately display pending status until acknowledgment.

## Accounts, profile and appearance

- Email/password and Google desktop sign-in, account creation, email verification, password reset, sign-out and remembered-session restoration when Windows secure storage is available. Settings can link sign-in methods; Google-only accounts can add a separate password login with the applicable authentication checks. Cloud synchronization requires the appropriate account/verification state. Provider delivery and new Google browser consent are distinct from enabled controls.
- Profile username/display-name editing; sign-in remains email-based. Account join date when available, local creation information, lifetime task completions and open-task counts.
- Computer-uploaded PNG/JPEG photos with validation, drag/keyboard positioning, zoom/reset and explicit crop save/cancel. All avatar displays and the crop preview are circular; the stored icon is a bounded metadata-free 128 × 128 PNG. Inputs are limited to 5 MiB and 4,096 × 4,096 pixels. Drafts expire after ten minutes and do not enter saved data/sync/backups. Circular framing can omit corners; users position/zoom before saving.
- Profile name, icon and appearance sync privately with the account. Presets: black/purple, black/white, navy/gold. Custom color pickers and at most three saved custom schemes.
- New passwords require confirmation, strength feedback and the app's 15–128 Unicode-code-point policy with common/pattern rejection. Existing-password sign-in remains compatible. Password-enabled accounts can change passwords after current-password verification and two matching new entries. Provider-wide enforcement is a separate pending rollout; app validation alone cannot stop modified clients.
- Responsive centered profile layout, readable native select options, course editing and dialogs that remain open when text-selection drags end outside the dialog. Redundant workspace chevron removed.

## Desktop, portability and recovery

- Downloadable/installable Windows x64 app; tray/background operation, close-to-tray preference, quiet hours, reminder privacy, snooze/completion actions and configurable Windows login startup. Notifications need the app running and Windows permission; Do Not Disturb/OS suppression can hide banners. Physical logon/sleep/unlock/banner-click acceptance is tracked separately.
- ICS import with review, duplicate/changed-item handling and warnings; ICS export. Full backup export/restore with validation and explicit account/calendar-copy handling. Local recovery snapshots/checks and resumable account/calendar deletion with anti-resurrection handling.
- Sanitized diagnostics and a genuine desktop missing-page/404 recovery screen with keyboard navigation. There is no deployed public website whose 404 behavior is being claimed.
- Windows is the verified platform; another clean PC, Windows ARM, macOS and Linux are not yet accepted. The installer is an unsigned private preview, with no automatic public update distribution or signed-publisher claim.

## Implemented security controls and limits

| Area | Implemented control | Practical limit |
| --- | --- | --- |
| Secrets/configuration | Private ignored `.local` environment files, source/package credential scans and package exclusions; normal configuration preserved through updates | Local filesystem access remains the owner's responsibility; scan success is not proof no secret can ever leak |
| Remembered sessions | Windows secure-storage encryption; atomic staged writes; stale staged file removal; sign-out memory cleanup, removal retry and nonsecret signed-out marker | Calendar SQLite, exported backups, recovery copies and private configuration are not app-encrypted. Entirely unwritable storage can defeat persistence of the marker |
| Authentication/OAuth | Password reauthentication for sensitive actions, generic failures/cooldowns; PKCE/state/nonce/token checks and session-generation boundaries | Fresh Google consent, actual inbox delivery and provider-wide password rollout remain separate |
| OAuth callback resources | Exact loopback host/path/method/state checks, bounded headers/connections/timers and cancellation cleanup, nonreflecting responses and defensive headers | Not an independent attack assessment or general denial-of-service guarantee |
| Desktop renderer | Context isolation/sandbox boundaries, narrow validated IPC, no ordinary renderer Node API, navigation/window restrictions; CSP and blocked child-frame/worker boundaries | All-seven Electron fuse integration is tested on disposable copies but not shipped in this release; broader native surface acceptance is open |
| Protocol handling | Origin/path/traversal checks, safe GET/HEAD, real missing-page handling, response CSP including frame/object/base/form restrictions, no-referrer/nosniff | Desktop protocol controls do not describe a public HTTP service |
| Cloud access | Account ownership, verified-account checks, validated schemas, monotonic/retry/conflict handling, approved Firestore rules and per-account accepted-write quotas | Not a global rate limit across authentication, reads, distributed identities or billing abuse |
| Rate limiting | Monotonic local one-minute buckets: ten shared authentication attempts, three verification/reset attempts, five password changes; additional refresh/sync/image/file/notification limits and provider Retry-After cooldowns. Server accepts at most 60 mutation groups per account per server-timed minute | Modified clients bypass local limits; remote read/auth abuse architecture, budgets and alerting are unfinished. This quota counts accepted mutation groups, not all requests or individual records |
| Input/data handling | Shared schemas, bounded image import/re-encoding, import/restore review, checksummed recovery and deletion safeguards | Copies made outside the app and vendor-retained data require an approved retention/deletion program |
| Supply chain | Pinned dependencies/workflow action commits, scoped overrides, credential scanning, npm audit/SBOM, restricted CI tokens; native inventory and source/build reconciliation | Zero npm findings is a dated observation, not a native-code assessment. Independent native rebuilds are not byte-reproducible against the vendor binary |
| Redistribution | Ten actual bundled/copied runtime license notices, 23 unchanged covered MPL source files, Chromium notices; package/installer integrity checks | Qualified redistribution review remains open; notices are not security certification |
| Release safety | Private profile backup/preservation, populated upgrade tests, exact package fingerprints and required installed fresh/restart sign-in gate | Owner backup copies are plaintext; code signing, protected independent release review and clean second-PC acceptance are pending |

No app-level MFA enrollment, end-to-end calendar encryption, enforced Canada-only data residency, signed automatic updates or independent penetration-test report is claimed. Provider features and an organization's verified practices must be assessed separately from this desktop feature set.

## Compliance status: no formal level reached

| Requested framework/law | Status reached | Remaining condition |
| --- | --- | --- |
| SOC 2 | Readiness documentation and measured engineering evidence only. **No Type I or Type II report** | Define system/categories, approve and operate organizational controls, retain appropriate evidence, and engage a licensed CPA firm for the actual examination/report. SOC 2 is an assurance report, not an app certification; [AICPA report review guidance](https://assets.ctfassets.net/rb9cdnjh59cm/3xbcLlNc5rd72So4nQpNIk/7a3e8e5945c78c35fc5e116859b96e6a/SOC_2_Report_%C3%82_Review_Checklist.pdf) distinguishes point-in-time/period reports |
| ISO/IEC 27001 | ISMS/risk/operating-program preparation only. **Not certified** | Current normative text, agreed scope, complete approved applicability/risk treatment, actual operation, internal audit/management review and independent certification process. [ISO's overview](https://www.iso.org/standard/27001) describes the management system and risk process |
| CAN/DGSI 118 | Accessible edition recorded; **131 numbered leaf clauses mapped in a gap register**, with exclusions proposed. **No conformance conclusion** | Resolve healthcare-standard relevance to this personal calendar, assessor/operator-approved scope/exclusions, referenced CAN/DGSI 104 access and implementation/evidence for applicable clauses. [Official standard](https://dgc-cgn.org/wp-content/uploads/2026/02/FINAL_CAN_DGSI_118_R-2026_EN.pdf); [local gap register](DGSI_118_GAP_REGISTER.md) |
| PIPEDA | Privacy/data inventory, draft notice/rights/retention procedures and technical export/deletion controls prepared. **Compliance not established** | Confirm applicability to the operator/activity, appoint accountable people/contact, approve legally reviewed notice/consent/vendors/transfers/retention, exercise rights and breach processes and retain real operating evidence. PIPEDA is a law, not a certification tier; [OPC principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/) |
| PHIPA | **Excluded**, per owner instruction: personal student calendar, no patient records | Not a target or claimed compliance status |

These systems do not share a numerical compliance ladder. Tests and draft documents do not establish an audit result or legal conclusion. No completion percentage is assigned to external controls.

## Prepared compliance evidence

The project contains a system/data-flow description, scoped threat model, risk register, security operating program, measured access-governance inventory, training material, privacy notice/request/retention drafts, incident/continuity runbooks and tabletop/recovery packets, signing/protection decision proposals, supply-chain/native evidence and a DGSI clause register. These are prepared artifacts; unnamed roles, unsigned policy drafts and unperformed exercises are not operating controls.

The [current checklist](COMPLIANCE_CHECKLIST.md) names each dependency and required completion evidence. Principal remaining items: operator/owners/deputies and legal scope; authorized standards access; approved risk/privacy/retention program; provider-password rollout decision; distributed abuse monitoring/budgets; actual admin MFA/device protection/independent review; code-signing identity/budget; native/Google/inbox/physical OS/second-PC acceptance; encrypted off-device recovery and human incident drills; sustained operating evidence; independent security, legal and assurance review.
