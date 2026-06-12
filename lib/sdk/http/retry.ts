// Retry/backoff helpers. Isomorphic. Backoff is exponential with jitter; the jitter source
// and sleep are injectable for deterministic tests.

import {
  RateLimitError,
  TimeoutError,
  UpstreamError,
} from "@/lib/sdk/core/errors";

export type RetryOptions = {
  maxAttempts: number; // total attempts including the first
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: () => number; // [0,1)
  sleep: (ms: number) => Promise<void>;
};

export const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
  jitter: Math.random,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Exponential backoff with full jitter, capped at maxDelayMs. `attempt` is 0-based.
export function backoffDelay(attempt: number, opts: RetryOptions): number {
  const exponential = opts.baseDelayMs * 2 ** attempt;
  const capped = Math.min(exponential, opts.maxDelayMs);
  return Math.floor(capped * opts.jitter());
}

// Whether an error is worth retrying (only ever applied to safe/idempotent operations).
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof RateLimitError) return true;
  if (error instanceof UpstreamError) {
    return error.status === undefined || error.status >= 500;
  }
  // Network-level fetch failures surface as TypeError.
  if (error instanceof TypeError) return true;
  return false;
}
