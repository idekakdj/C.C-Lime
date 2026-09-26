import { performance } from 'node:perf_hooks';

export class RateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before trying again.`);
  }
}

/** One bounded bucket, charged before effects. Monotonic time ignores wall-clock edits. */
export class AttemptWindow {
  private started = -Infinity;
  private used = 0;
  constructor(private limit: number, private windowMs: number, private now = () => performance.now()) {}
  take(): void {
    const now = this.now();
    if (now >= this.started + this.windowMs) { this.started = now; this.used = 0; }
    if (this.used >= this.limit) throw new RateLimitError(Math.max(1, this.started + this.windowMs - now));
    this.used++;
  }
}

export class CommandRateLimits {
  private readonly buckets: Map<string, AttemptWindow>;
  constructor(now?: () => number) {
    const policies: Array<[number, string[]]> = [
      [10, ['auth.signIn', 'auth.signUp', 'auth.google', 'auth.linkPassword', 'auth.reauthenticate']],
      [3, ['auth.verify', 'auth.reset']],
      [6, ['auth.refresh']], [6, ['sync']], [3, ['testNotification']],
      [10, ['import.preview', 'restore.preview', 'export', 'backup', 'diagnostics']],
    ];
    this.buckets = new Map(policies.flatMap(([limit, commands]) => {
      const bucket = new AttemptWindow(limit, 60_000, now);
      return commands.map(command => [command, bucket] as const);
    }));
  }
  take(command: string): void { this.buckets.get(command)?.take(); }
}

/** Provider Retry-After, bounded to one day; no header/body information is logged. */
export function retryAfterMs(headers: Headers, now = Date.now()): number {
  const value = headers.get('retry-after')?.trim();
  const serverDate = Date.parse(headers.get('date') ?? '');
  const delay = value && /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000
    : value ? Date.parse(value) - (Number.isFinite(serverDate) ? serverDate : now) : NaN;
  return Number.isFinite(delay) && delay > 0 ? Math.min(86_400_000, Math.ceil(delay)) : 60_000;
}

export class ProviderCooldown {
  private until = 0;
  constructor(private now = () => performance.now()) {}
  check(): void { if (this.now() < this.until) throw new RateLimitError(this.until - this.now()); }
  pause(delay: number): never { this.until = Math.max(this.until, this.now() + delay); throw new RateLimitError(delay); }
  observe(response: Response): void {
    if (response.status !== 429) return;
    const delay = retryAfterMs(response.headers);
    this.pause(delay);
  }
}
