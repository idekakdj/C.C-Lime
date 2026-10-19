# C.C. Lime 0.1.18

October 19, 2026. Requested private Windows update under the [release plan](RELEASE_0118_PLAN.md). Installation verification is pending; do not treat a built installer as an installed update.

## Calendar and tasks

- My Tasks has **To do** and **Completed** tabs. Previously saved in-progress items remain available in To do; existing records, completion history and weekly progress are preserved.
- Week view has a keyboard-accessible **Time-slot scale** slider (22–100%), **Fit week**, and an original-size **100%** reset. The original 56 pixels/hour is the maximum. Scale and automatic-fit choice persist on this device across app restarts.
- Fit week measures the available height and responds to viewport/header changes. Seven columns, horizontal layout, fonts, **All day & due** and **Upcoming Tasks** retain their existing dimensions. Only hourly spacing and timed-event placement/duration geometry change. Event text keeps its size, with a 26-pixel readable minimum; visual collision lanes keep short adjacent items clickable.
- Early/late, cross-midnight and daylight-saving layouts use the displayed local-hour grid. Dragging/resizing uses the selected scale; changes still require editor review/save and Escape cancels gestures.
- When the unchanged headers leave too little room for the minimum readable 24-hour grid, the app explains that a taller window is needed and retains scrolling rather than clipping or shrinking text. Unlimited all-day rows/dense events cannot be guaranteed to fit every physical screen.
- Dialog confirmation/error messages participate in layout so a movement message cannot cover Save/Cancel.

## Security and staged authentication

Four narrowly scoped [dependency updates](RELEASE_0118_DEPENDENCIES.md) were applied after a fresh audit. Final root findings decreased from 27 entries (11 high, 16 moderate) to 23 (7 high, 16 moderate); remaining roots are `braces` and `sprintf-js` in build/emulator tooling. The full production gate stays blocked without suppression. All remaining affected package names are absent from the measured 13-component app bundle inventory and archive dependency paths; this is not comprehensive native assurance or a production waiver.

This release includes the earlier staged authenticator/passkey client code, disabled by default. No provider MFA, live rules, gateway hosting, signer key, IAM, billing or owner factors are activated. Firebase/Google private configuration remains external to source/package in ignored local files. Earlier eight-character new-password source behavior is included; mandatory live MFA is still pending, so NIST length/AAL conformance is not claimed. Account setup automation is still unimplemented.

Unsigned owner-only scope, seven shipping fuse gaps, physical OS/Google/second-device observations, operator/privacy decisions and independent assessment remain open. PHIPA is excluded; no SOC 2, ISO 27001, CAN/DGSI 118 or PIPEDA certification is asserted.

## Verification checkpoint

Source: 369 tests passed; type checking/build passed. Tooling: 82 passed, two existing Windows symlink-privilege skips. Cloud emulators: 84 passed. A populated synthetic upgrade retained 12 records, recurrence overrides/completions, profile, preferences and pending writes; the only expected device addition is the default weekly scale.

The initial sandbox test/backup attempts were rejected by temporary-file permissions/physical profile redirection; normal-context retries passed. One early UI test used an obsolete exact navigation label that omitted its task-count badge. A later 47-case packaged run passed 46 cases but exposed a real toast intercepting Save; that layout was repaired rather than bypassing pointer checks or extending timeouts. Final rebuilt package/installed results will be recorded below after completion. Intermediate package hashes are not the final installed identity.
