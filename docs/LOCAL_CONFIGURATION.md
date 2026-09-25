# Local cloud configuration

Cloud credentials are read by the desktop main process at runtime, never imported by source code or injected into the renderer/build bundle.

For development, copy the blank `.env.example` template to `.local/.env`. For an installed app, use `%APPDATA%/C.C. Lime/.local/.env`. Process environment variables override that file. Required variables are `CC_LIME_FIREBASE_PROJECT_ID` and `CC_LIME_FIREBASE_API_KEY`; Google desktop sign-in also uses `CC_LIME_GOOGLE_CLIENT_ID` and, if required by the installed-app OAuth client, `CC_LIME_GOOGLE_CLIENT_SECRET`.

Download a **Desktop app** OAuth client from the same Google project into `.local/google-oauth.json`. Run `node scripts/import-google-oauth.mjs` to validate its project, client type, endpoints and loopback redirect, then import its values into `.local/.env` without printing them. This preserves existing environment settings and rejects a mismatched project before changing the file. The runtime reads the environment file, not the downloaded JSON. A valid file is a configuration check; complete a real Google browser sign-in to verify the consent screen and Firebase token exchange as well.

The `.local` directory is excluded from Git and desktop packaging. Never use a `VITE_` prefix: those variables are exposed to frontend builds. Never commit a filled environment file, cloud client JSON, administrator key, or downloaded OAuth credential file. `.env.example` contains names and blank values only. Run `npm run check:secrets` before committing or publishing source.

An installer does not contain the project's key. Each computer needs its local environment configuration to enable cloud sign-in. Without it, a clearly labeled local calendar preview remains available. Keep this configuration separate from shared installer/source artifacts.

The previously hardcoded Firebase client key reached repository history in commit `45333f7`. Removing a file does not erase Git history. The remediation rotates the key and disables the old key; the ignored local rotation record records confirmation. Do not copy the historical key back into any configuration.

Firebase database authorization is still enforced by the committed per-account security rules. A client API key is not an administrator credential and must never replace those rules.
