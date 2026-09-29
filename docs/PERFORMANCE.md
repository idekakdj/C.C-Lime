# Performance evidence — development previews

## Current run: 0.1.8, September 28

The [follow-up plan](PERFORMANCE_FOLLOWUP_PLAN.md) preceded these changes. On the same Windows 11 Home / Core Ultra 7 155H / 22 logical cores / 15.7 GiB host, the complete packaged 0.1.7 baseline and 0.1.8 follow-up used the existing 50-course, 5,000-master, 20,000-occurrence synthetic fixture. Both used ten starts, ten saves/day expansions/searches and twenty month navigations, with no concurrent build or desktop test. Timing endpoints are unchanged; the script now additionally records startup phases. There is no search debounce to subtract. Host load was not controlled, so these runs are observations rather than proof that every difference is caused by the code changes.

| Operation | Target | 0.1.7 median / slowest | 0.1.8 median / slowest | Current sample result |
| --- | --- | --- | --- | --- |
| Cold start | ≤3,000 ms | 2,649 / 3,511 ms | 2,175 / 2,561 ms | All ten samples meet target. |
| Durable local save | ≤200 ms | 24 / 28 ms | 19 / 31 ms | All ten samples meet target. |
| Month navigation | ≤200 ms | 159 / 302 ms | 154 / 194 ms | All twenty samples meet target. |
| Expanded day | ≤200 ms | 54 / 83 ms | 43 / 54 ms | All ten samples meet target. |
| Search | ≤300 ms | 233 / 242 ms | 33 / 63 ms | All ten samples meet target. |

Two bounded changes were retained. Status refreshes now count outbox rows directly instead of decoding every mutation; the 5,070-row baseline comparison measured 8–23 ms for reading/decoding versus 0.2–0.9 ms for a direct count. Sending, failed and pending changes remain counted. Synchronization still reads complete mutation records when actually processing them. Search selects possible matching masters and effective occurrence overrides before expanding the year window, then checks the resulting occurrences; it no longer expands and transfers every unrelated event for a narrow query. Tests preserve course/name/code/note/location matching, renamed/cancelled/moved overrides, completion, zone boundaries, no-date tasks, edited records, account resets and superseded queries. A class-heavy case also confirms unrelated schedules cannot exhaust the search expansion budget.

The search benchmark is a selective title query, not every broad query or worst-case 50,000-result calendar. Initial and changed full snapshots still transport all stored records; month data remains a full occurrence list. No new encryption, cloud protocol, recurrence rules or caching retention was introduced. The measured result advances T-44/A-47 on this host; cloud/reminder-load resource use, lower-spec/second-PC observations and full acceptance remain separate. The visible/tray idle follow-up is recorded below when complete.

Raw synthetic evidence remains ignored:

| Report | SHA-256 |
| --- | --- |
| `test-results/performance-0.1.7-baseline.json` | `1d9e5d09c607ec922500c3e1e07db967d38159b5b4798c9bbbf046cc684cc7e0` |
| `test-results/performance-0.1.8-first.json` | `1caae0655c3972847fd28d8ceb83c4aeabdc469f2c14674d724cc58a85fc1348` |
| `test-results/queue-profile-0.1.7.json` | `9a933dc3f5a89f8a31061d3729d7a09a38b0a89dd4ce62c71c08e9225a15bfdf` |

The earlier findings below are versioned history, not the latest performance result.

## Latest run: 0.1.2, September 26

The same 50-course, 5,000-master, 20,000-occurrence fixture was measured on the Windows 11 machine described below. These are complete packaged-app runs; no build or desktop test ran alongside the benchmark. The 0.1.1 baseline ran at 08:30 UTC and 0.1.2 later that day. Other host load and clock-dependent overdue counts were not held constant, so these runs do not establish a controlled before/after speedup. UI times include Playwright action and readiness-wait overhead.

| Operation | Target | 0.1.1 median / slowest | 0.1.2 median / slowest | Latest assessment |
| --- | --- | --- | --- | --- |
| Cold start | ≤3,000 ms | 4,377 / 4,911 ms | 4,870 / 7,326 ms | Target missed. |
| Durable local save | ≤200 ms | 22 / 40 ms | 28 / 46 ms | All samples meet target. |
| Month navigation | ≤200 ms | 402 / 1,364 ms | 322 / 1,074 ms | Target missed. |
| Expanded day | ≤200 ms | 122 / 161 ms | 108 / 186 ms | All samples meet target. |
| Search | ≤300 ms | 882 / 927 ms | 907 / 956 ms | Target missed. |

For the 5,050 stored records, a full snapshot serialized to 2,288,946 UTF-8 bytes; an unchanged revision returned 855 bytes with records omitted. This is a transport-size measurement, not a startup-speed guarantee. Full initial snapshots and changed-record snapshots still transfer all records; bounded initial pagination remains open. Worker responses now omit acknowledged unchanged sections and retain their renderer references. Unacknowledged results are resent, and account changes reset the cache.

Month/week/agenda dates share an indexed item lookup. Six-month task expansion excludes unrelated classes/events; the large-class regression fixture opens its valid one-day view without exceeding the task expansion budget. Day panels, agenda days, task groups and sidebar days render batches of 50 with an explicit Show more action. These measures do not constitute full list virtualization.

Private raw measurements are retained in ignored test-results/performance-0.1.1-baseline.json and test-results/performance-0.1.2-first.json. No new five-minute idle measurement was made for 0.1.2. The earlier CPU figures below apply only to 0.1.0.

## Earlier run: 0.1.0, September 25

Measured September 25, 2026 on Windows 11 Home, build 10.0.26200, Intel Core Ultra 7 155H (22 logical cores), 15.7 GiB reported RAM. This is the development machine, not a claim about every supported PC. Disk medium/speed was not separately verified.

The reproducible fixture has 50 courses, 5,000 master items and 20,000 occurrences across 31 calendar days. Its date schedule is deterministic; only UUIDs are randomized. It uses an isolated local calendar with no active reminder rules or cloud traffic. The app is the packaged executable. Cold start includes the explicit local-preview entry click. UI timings include Playwright round-trip overhead and wait for the calendar worker's result; durable-save timings exclude cloud sync.

Run `node scripts/measure-performance.mjs` after `npm run package`. The runner saves intermediate evidence to ignored `test-results/performance.json`, including failed/incomplete runs. It measures ten cold starts, ten saves/day expansions/searches and twenty month navigations. Do not run another build or desktop test at the same time as this measurement.

| Operation | Plan target | Median | Slowest | Assessment |
| --- | --- | --- | --- | --- |
| Cold start | ≤3,000 ms | 2,828 ms | 3,185 ms | Median meets target; slow samples remain above it. |
| Durable local save | ≤200 ms | 15 ms | 44 ms | All measured samples meet target. |
| Month navigation | ≤200 ms | 246 ms | 372 ms | Target missed; further work remains. |
| Expanded day | ≤200 ms | 180 ms | 242 ms | Median meets target; slow samples remain above it. |
| Search | ≤300 ms | 283 ms | 379 ms | Median meets target; slow samples remain above it. |

The preceding run's saves were approximately 595–795 ms. Avoiding expansion of schedules without reminder rules and reusing validation for unchanged SQLite payloads brought the maximum down to 44 ms. A regression test confirms occurrence-only reminders still work, and a database test confirms cached results respect other connections and transaction rollback. Crowded days render 50 rows initially and offer explicit additional batches; all dates remain reachable.

Other optimization work includes bounded recurrence/display caches, a worker range cache, reuse of upcoming results within the same clock interval, stable record references and memoized course/filter lookup. These are measured improvements, not a declaration that every performance gate has passed. Cached full snapshots and large UI lists still warrant further work.

`node scripts/measure-idle.mjs` measures separate five-minute visible-window and tray intervals using that isolated fixture. It records process CPU-time deltas and memory. The result is saved to ignored `test-results/idle.json`; only a completed interval is evidence. It reports both single-core-equivalent CPU percentage and percentage normalized by logical core count. Working-set totals can double-count shared pages. The measurement method follows Electron's [CPU usage documentation](https://www.electronjs.org/docs/latest/api/structures/cpu-usage).

Both five-minute idle intervals completed:

| Mode | Actual interval | CPU, normalized across 22 cores | Single-core-equivalent CPU | Summed working set |
| --- | --- | --- | --- | --- |
| Visible window | 300.132 s | 0.10% | 2.23% | 645 MiB |
| Tray | 300.095 s | 0.28% | 6.25% | 611 MiB |

The normalized machine CPU measurement is below 1% on this host. Tray CPU was higher than the visible interval and should be investigated before extrapolating to lower-core devices. This local fixture cannot establish live cloud polling usage or the full reminder-load resource budget. The live synthetic two-profile cloud session separately measured 51 client reads and 20 writes; security-rule reads and administrative setup/cleanup are additional operations.
