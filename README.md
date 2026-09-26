# C.C. Lime

C.C. Lime is a Windows-first calendar and task app for university students, with a black and purple interface.

The home screen is a conventional month calendar with events beneath each date. Selecting a day expands its detailed schedule. An upcoming-task sidebar shows today and the following six days, with overdue work listed separately.

## Project status

Version 0.1.1 is implemented as a **development preview**. It builds a Windows x64 installer and has automated desktop, domain, and cloud checks. It is not yet an accepted production release: the [implementation evidence](docs/IMPLEMENTATION_STATUS.md) records remaining work and verification. macOS and Linux packages have not been tested or published.

## Project documents

- [Product specification and project plan](PROJECT_PLAN.md)
- [Implementation task register — 48 tasks](docs/IMPLEMENTATION_TASKS.md)
- [Acceptance test specification — 52 scenarios](docs/ACCEPTANCE_TESTS.md)
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

Use Node.js 24 and npm on Windows x64. Native SQLite compilation may require Visual Studio C++ Build Tools and Python if a prebuilt binary is unavailable.

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

The unsigned installer is generated at `out/make/squirrel.windows/x64/CC-Lime-0.1.0-Setup-x64.exe`. A local build does not publish a GitHub release. Cloud emulator checks use `npm run test:cloud` and require Java 21 or later; see the maintainer guide.

## Development workflow

This repository is the source of truth for the project. Work in a local clone, keep the project specification and tests aligned with implementation changes, and record actual verification results rather than marking unperformed tests as passed. Do not commit personal calendars, credentials, local databases, or generated release installers.
