# C.C. Lime

C.C. Lime is a Windows-first calendar and task app for university students, with profile photos and customizable colors.

The home screen is a conventional month calendar with events beneath each date. Selecting a day expands its detailed schedule. An upcoming-task sidebar shows today and the following six days, with overdue work listed separately.

## Project status

The source and owner installation are **0.1.12, an owner-only development preview**. It includes synced profiles, user-controlled photo cropping, lifetime task progress, three color presets, up to three custom palettes, new-password confirmation/strength feedback and verified password changes. The [startup correction](docs/WINDOWS_STARTUP_FIX_PLAN.md) reads Windows' actual named-entry enablement and uses the installed launcher. Automatic notification shortcut alignment, server write quotas and secure 404 recovery remain. The operator is based in Ontario, Canada. It is not yet an accepted production release: the [implementation evidence](docs/IMPLEMENTATION_STATUS.md) records results and remaining work. macOS and Linux packages have not been tested or published. No SOC 2, ISO 27001, CAN/DGSI 118, PIPEDA or PHIPA compliance claim is made; the [assurance plan](docs/SECURITY_PRIVACY_PLAN.md) tracks the requested targets and organizational obligations.

## Project documents

- [Product specification and project plan](PROJECT_PLAN.md)
- [Implementation task register — 65 tasks](docs/IMPLEMENTATION_TASKS.md)
- [Acceptance test specification — 67 scenarios](docs/ACCEPTANCE_TESTS.md)
- [Security, privacy and assurance extension](docs/SECURITY_PRIVACY_PLAN.md)
- [Dependency treatment and release gate](docs/SUPPLY_CHAIN_REPORT.md)
- [Owner upgrade and follow-up engineering plan](docs/RELEASE_FOLLOWUP_PLAN.md)
- [Archive extraction repair and verification](docs/ARCHIVE_EXTRACTION_PLAN.md)
- [Privacy data and retention inventory](docs/PRIVACY_DATA_INVENTORY.md)
- [Initial security and privacy risk register](docs/RISK_REGISTER.md)
- [Administrative access and repository controls](docs/ACCESS_GOVERNANCE.md)
- [Incident response and continuity preparation](docs/INCIDENT_CONTINUITY.md)
- [Windows signing decision and verification gates](docs/SIGNING_DECISION.md)
- [Large-calendar performance follow-up plan](docs/PERFORMANCE_FOLLOWUP_PLAN.md)
- [User guide](docs/USER_GUIDE.md)
- [Maintainer guide](docs/MAINTAINER_GUIDE.md)
- [Local cloud configuration](docs/LOCAL_CONFIGURATION.md)
- [Verification and release evidence](docs/IMPLEMENTATION_STATUS.md)

## Features

- Semesters, courses, recurring classes, assignments, exams, and study sessions.
- Review semester and series changes before applying them; preserve removed occurrence history as separate items.
- Persistent local storage, offline editing, and cloud synchronization across computers.
- Email/password and Google sign-in.
- Native desktop reminders while the app is open or running in the system tray, with optional startup at login.
- Month, week, and agenda views, expandable day details, search, and task completion.
- Week movement/resizing with time snapping, recurrence scope choices, and optional device time-zone following.
- Calendar-file import/export and full backup/restore.
- A Windows installer that does not require development tools to run.

## Implementation

Electron, React, and TypeScript for the desktop app; SQLite for local storage; and Firebase Authentication/Firestore for accounts and cloud synchronization. Exact dependency versions are pinned in `package-lock.json`.

The initial cloud setup targets a free tier. Live authentication and synchronization require an owner-controlled Firebase/Google project and private configuration on each computer. Credentials are read from local environment variables at runtime and are excluded from source and installer files. A separate local calendar is available without cloud configuration.

## Run and build

Use Node.js 24.21.0 and npm 11.19.0 on Windows x64. Native compilation may require Visual Studio C++ Build Tools and Python if a prebuilt binary is unavailable. The manifest approves only reviewed, pinned esbuild/RE2 dependency scripts; see the maintainer guide before changing that policy.

```sh
npm ci
npm run check
npm run dev
```

`npm start` runs the production interface locally. The development runner rebuilds SQLite for Electron and restores the Node binary on ordinary exit; use `npm run rebuild:node` after a forced termination if unit tests report an ABI mismatch.

```sh
npm run make
npm run check:package
npm run test:e2e
```

The unsigned installer is generated at `out/make/squirrel.windows/x64/CC-Lime-0.1.9-Setup-x64.exe`. A local build does not install the app or publish a GitHub release. Cloud emulator checks use `npm run test:cloud` and require Java 21 or later; see the maintainer guide.

`npm run security:report` generates the full npm CycloneDX inventory and vulnerability report under ignored `test-results/supply-chain`. `npm run check:release-security` refreshes evidence and blocks the dependency gate while any finding remains. The 0.1.8 scan reports zero npm findings; this does not cover every native component or grant production/compliance approval.

## Development workflow

This repository is the source of truth for the project. Work in a local clone, keep the project specification and tests aligned with implementation changes, and record actual verification results rather than marking unperformed tests as passed. Do not commit personal calendars, credentials, local databases, or generated release installers.
