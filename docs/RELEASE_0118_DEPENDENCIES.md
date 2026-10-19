# October 19 dependency refresh for 0.1.18

The first full-lock audit used the existing resolutions and reported **27 affected-package entries: 11 high, 16 moderate**, across 1,144 components. Historical October 3 results are not current approval. The production gate remains enforced; no severity exclusion or waiver is introduced.

Before installation, patch narrowly and verify:

- `sharp` 0.35.4 → 0.35.5, including its matched platform binaries/libvips. The [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) and [release](https://github.com/lovell/sharp/releases/tag/v0.35.5) identify the image-library update. Retest avatar decoding/bounds/cropping and icon/package generation.
- Firebase tooling's `@modelcontextprotocol/sdk` 1.30.0 → 1.31.0, the [maintainer-published OAuth fix](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h). Keep Firebase's existing version; scope the override to its dependency. Retest emulator tooling; do not invoke its MCP authorization flow.
- `source-map-js` 1.2.1 → 1.2.2, the [published source-map offset fix](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2). Retest source/UI builds.
- `http-cache-semantics` 4.2.0 → published minor 4.3.0, staying within its consumer's major range. The [advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) affects versions through 4.2.0; the advisory's patched-version field still says None. Registry confirms 4.3.0, but 4.2.1 does not exist. Do not invent a 4.2.1 patch or claim an upstream guarantee from that stale field. Verify the selected version with a fresh audit and package/build tests.

Do not run blanket `npm audit fix`, upgrade Forge to a new major or downgrade Firebase to obsolete 6.8.0 to manufacture a passing gate. `braces` and `sprintf-js` findings may remain in build/emulator paths; inspect the final inventory/archive for actual shipped exposure and record the final audit counts separately. Native Electron/Chromium dependencies are outside the npm scan's completeness claim.

This is a narrowly scoped repair plan and initial observation. Final results belong in the release evidence, not an assumed clean-audit statement.

## Observed repair checkpoint

The lockfile review found only the four intended libraries and sharp's matching platform/libvips packages changed, plus the root manifest/version metadata. No unrelated library version changed. Installation used `--ignore-scripts`. The fresh report retains 1,144 components and **23 findings: 7 high, 16 moderate**, with only `braces` and `sprintf-js` root advisories remaining. All four updated library names are no longer findings. This does not convert the full production gate to a pass.

Final source tests passed 369/369; tooling passed 82 with two existing symlink-privilege skips; the actual Firebase emulator suite passed 84/84. The patched sharp binary loaded and converted the owned SVG icon to PNG, then decoded it at the expected 128 × 128 dimensions (sharp 0.35.5, libvips 8.18.7, librsvg 2.63.2). Both subsequent application builds passed. Packaging retained 13 dependency notices and 23 covered-source files. Remaining affected library names are absent from the measured bundle inventory, available main source-map inputs and archive dependency paths; native assurance remains separate.
