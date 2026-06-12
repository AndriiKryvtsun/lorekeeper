// Resilient HTTP transport. Isomorphic (uses global fetch/AbortController). Provides
// timeouts, retry (only for safe/idempotent ops), per-provider circuit breaking,
// rate-limit handling, typed errors, and per-call telemetry. Adapters may use this OR
// bring their own transport (e.g. a vendor SDK).

import {
  CircuitOpenError,
  RateLimitError,
  TimeoutError,
  UpstreamError,
} from "@/lib/sdk/core/errors";
import { recordTelemetry } from "@/lib/sdk/core/telemetry";
import { CircuitBreaker } from "@/lib/sdk/http/circuit-breaker";
import {
  DEFAULT_RETRY,
  backoffDelay,
  isRetryableError,
  type RetryOptions,
} from "@/lib/sdk/http/retry";

export type RequestContext = { capability: string; providerId: string };

export type TransportOptions = {
  timeoutMs?: number;
  idempotent?: boolean;
  idempotencyKey?: string;
  retry?: Partial<RetryOptions>;
  circuit?: CircuitBreaker;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

async function attemptFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  ctx: RequestContext,
  timeoutMs: number | undefined,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer =
    timeoutMs !== undefined
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new TimeoutError(`Request to "${ctx.providerId}" timed out`, ctx);
    }
    throw error; // network failure (TypeError) — classified retryable upstream
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (res.status === 429) {
    throw new RateLimitError(`Rate limited by "${ctx.providerId}"`, {
      ...ctx,
      retryAfterMs: parseRetryAfterMs(res.headers.get("retry-after")),
    });
  }
  if (res.status >= 400) {
    throw new UpstreamError(`Upstream error ${res.status}`, {
      ...ctx,
      status: res.status,
    });
  }
  return res;
}

export async function request(
  input: RequestInfo | URL,
  init: RequestInit,
  ctx: RequestContext,
  opts: TransportOptions = {},
): Promise<Response> {
  const retry: RetryOptions = { ...DEFAULT_RETRY, ...opts.retry };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const circuit = opts.circuit;

  // Retries are permitted only for safe/idempotent ops or those carrying an idempotency key.
  const canRetry = opts.idempotent === true || Boolean(opts.idempotencyKey);
  const maxAttempts = canRetry ? retry.maxAttempts : 1;

  const start = now();

  if (circuit && !circuit.canRequest(ctx.providerId)) {
    const error = new CircuitOpenError(
      `Circuit open for "${ctx.providerId}"`,
      ctx,
    );
    recordTelemetry({
      capability: ctx.capability,
      providerId: ctx.providerId,
      outcome: "error",
      latencyMs: now() - start,
      errorType: error.name,
    });
    throw error;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await attemptFetch(input, init, ctx, opts.timeoutMs, fetchImpl);
      circuit?.onSuccess(ctx.providerId);
      recordTelemetry({
        capability: ctx.capability,
        providerId: ctx.providerId,
        outcome: "success",
        status: res.status,
        latencyMs: now() - start,
      });
      return res;
    } catch (error) {
      lastError = error;
      circuit?.onFailure(ctx.providerId);

      const hasMoreAttempts = attempt < maxAttempts - 1;
      if (!(canRetry && hasMoreAttempts && isRetryableError(error))) {
        recordTelemetry({
          capability: ctx.capability,
          providerId: ctx.providerId,
          outcome: "error",
          status: error instanceof UpstreamError ? error.status : undefined,
          latencyMs: now() - start,
          errorType: error instanceof Error ? error.name : "Error",
        });
        throw error;
      }

      // Honor Retry-After for rate limits; otherwise exponential backoff with jitter.
      const delay =
        error instanceof RateLimitError && error.retryAfterMs !== undefined
          ? error.retryAfterMs
          : backoffDelay(attempt, retry);
      await retry.sleep(delay);
    }
  }

  throw lastError;
}
