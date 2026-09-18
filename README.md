# C.C. Lime

C.C. Lime is a planned Windows-first calendar and task app for university students, with a black and purple interface.

The home screen is a conventional month calendar with events beneath each date. Selecting a day expands its detailed schedule. An upcoming-task sidebar shows today and the following six days, with overdue work listed separately.

## Project status

Planning is complete. Application implementation has not started; there is no downloadable app release yet.

## Project documents

- [Product specification and project plan](PROJECT_PLAN.md)
- [Implementation task register — 48 tasks](docs/IMPLEMENTATION_TASKS.md)
- [Acceptance test specification — 52 scenarios](docs/ACCEPTANCE_TESTS.md)

## Planned features

- Semesters, courses, recurring classes, assignments, exams, and study sessions.
- Persistent local storage, offline editing, and cloud synchronization across computers.
- Email/password and Google sign-in.
- Native desktop reminders while the app is open or running in the system tray, with optional startup at login.
- Month, week, and agenda views, expandable day details, search, and task completion.
- Calendar-file import/export and full backup/restore.
- A Windows installer that does not require development tools to run.

## Planned implementation

Electron, React, and TypeScript for the desktop app; SQLite for local storage; and Firebase Authentication/Firestore for accounts and cloud synchronization. Exact dependency versions will be pinned after the compatibility checks in the task register.

The initial cloud setup targets a free tier. Live authentication and synchronization require an owner-controlled Firebase/Google project. Build and development commands will be documented when the application scaffold is added.

## Development workflow

This repository is the source of truth for the project. Work in a local clone, keep the project specification and tests aligned with implementation changes, and record actual verification results rather than marking unperformed tests as passed. Do not commit personal calendars, credentials, local databases, or generated release installers.
