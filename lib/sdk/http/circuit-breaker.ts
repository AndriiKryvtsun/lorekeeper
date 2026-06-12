// Per-provider circuit breaker. Isomorphic, in-process. Opens after a failure threshold,
// short-circuits while open, and recovers (half-open → closed) after a cooldown. The clock
// is injectable so tests are deterministic.

export type CircuitState = "closed" | "open" | "half-open";
export type Clock = () => number;

export type CircuitOptions = {
  failureThreshold: number;
  cooldownMs: number;
  now?: Clock;
};

type Entry = { failures: number; openedAt: number };

export class CircuitBreaker {
  private readonly entries = new Map<string, Entry>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: Clock;

  constructor(opts: CircuitOptions) {
    this.failureThreshold = opts.failureThreshold;
    this.cooldownMs = opts.cooldownMs;
    this.now = opts.now ?? Date.now;
  }

  stateOf(providerId: string): CircuitState {
    const entry = this.entries.get(providerId);
    if (!entry || entry.failures < this.failureThreshold) return "closed";
    if (this.now() - entry.openedAt >= this.cooldownMs) return "half-open";
    return "open";
  }

  // Whether a request to this provider may proceed (closed or half-open trial).
  canRequest(providerId: string): boolean {
    return this.stateOf(providerId) !== "open";
  }

  onSuccess(providerId: string): void {
    this.entries.delete(providerId);
  }

  onFailure(providerId: string): void {
    const entry = this.entries.get(providerId) ?? { failures: 0, openedAt: 0 };
    entry.failures += 1;
    if (entry.failures >= this.failureThreshold) {
      // (Re)stamp the open time when crossing/at the threshold.
      entry.openedAt = this.now();
    }
    this.entries.set(providerId, entry);
  }
}
