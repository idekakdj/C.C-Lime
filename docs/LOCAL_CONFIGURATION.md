# Local cloud configuration

Cloud credentials are read by the desktop main process at runtime, never imported by source code or injected into the renderer/build bundle.

For development, copy the blank `.env.example` template to `.local/.env`. For an installed app, use `%APPDATA%/C.C. Lime/.local/.env`. Process environment variables override that file. Required variables are `CC_LIME_FIREBASE_PROJECT_ID` and `CC_LIME_FIREBASE_API_KEY`; Google desktop sign-in also uses `CC_LIME_GOOGLE_CLIENT_ID` and, if required by the installed-app OAuth client, `CC_LIME_GOOGLE_CLIENT_SECRET`.

Download a **Desktop app** OAuth client from the same Google project into `.local/google-oauth.json`. Run `node scripts/import-google-oauth.mjs` to validate its project, client type, endpoints and loopback redirect, then import its values into `.local/.env` without printing them. This preserves existing environment settings and rejects a mismatched project before changing the file. The runtime reads the environment file, not the downloaded JSON. A valid file is a configuration check; complete a real Google browser sign-in to verify the consent screen and Firebase token exchange as well.

The `.local` directory is excluded from Git and desktop packaging. Never use a `VITE_` prefix: those variables are exposed to frontend builds. Never commit a filled environment file, cloud client JSON, administrator key, or downloaded OAuth credential file. `.env.example` contains names and blank values only. Run `npm run check:secrets` before committing or publishing source.

An installer does not contain the project's key. Each computer needs its local environment configuration to enable cloud sign-in. Without it, a clearly labeled local calendar preview remains available. Keep this configuration separate from shared installer/source artifacts.

The proposed [automatic account setup plan](AUTOMATIC_ACCOUNT_SETUP_PLAN.md) would introduce an explicitly reviewed three-value client configuration during trusted release packaging, while retaining private repository exclusions and forbidding genuine secrets everywhere in the distribution. That feature is not implemented; prerequisite verification is incomplete. The instructions above continue to describe installed 0.1.17 and current application code.

## Windows normal-launch verification

Verify configuration from the same Windows context that opens the user's app. A tool running with filesystem virtualization can see a private redirected AppData copy at the ordinary logical path; a valid file in that copy does not prove a normal Start-menu/Explorer launch can read it. Microsoft describes the merged and redirected [AppData behavior](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes). Resolve the opened file's physical identity and separately check through the normal desktop context before claiming installed cloud configuration is preserved.

On September 30, the owner's normal 0.1.10 profile was missing `.local/.env`, while tool-launched checks saw the valid redirected copy. A hidden read-only diagnostic through Explorer reproduced the missing file. Only the validated private environment file was then copied into the normal profile: no existing configuration was overwritten, and no account database, settings or remembered session was copied or changed. Read-back through Explorer resolves to the ordinary profile and matches the validated bytes. No installer or application code change is needed for this configuration repair.

Configuration is read at application startup. Quit from the tray and reopen through the usual Windows shortcut after repairing it. Verify both email/password and Google controls are enabled before separately checking actual authentication; an isolated test supplied with its own configuration is not sufficient evidence of normal-launch readiness.

The [mandatory update gate](SIGNIN_UPDATE_GATE.md) combines physical normal-context configuration verification with fresh/restarted controls on the actual installed executable. Use [the Windows verifier](../scripts/verify-installed-signin.ps1) after every update. An isolated security fixture without `.local/.env` deliberately disables sign-in and must not be mistaken for the installed personal app or left as its replacement. Close the owned fixture and reopen the ordinary stable launcher. Valid configured and absent-config controls also run in baseline and combined-hardening CI without production keys; live authentication remains separately verified.

The previously hardcoded Firebase client key reached repository history in commit `45333f7`. Removing a file does not erase Git history. The remediation rotates the key and disables the old key; the ignored local rotation record records confirmation. Do not copy the historical key back into any configuration.

Firebase database authorization is still enforced by the committed per-account security rules. A client API key is not an administrator credential and must never replace those rules.
