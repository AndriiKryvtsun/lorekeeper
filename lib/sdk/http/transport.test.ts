import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CircuitOpenError,
  RateLimitError,
  TimeoutError,
  UpstreamError,
} from "@/lib/sdk/core/errors";
import { resetTelemetrySink, setTelemetrySink } from "@/lib/sdk/core/telemetry";
import { CircuitBreaker } from "@/lib/sdk/http/circuit-breaker";
import { request, type TransportOptions } from "@/lib/sdk/http/transport";

const ctx = { capability: "test", providerId: "p" };

// Deterministic retry: no real delay, no random jitter.
const fastRetry: TransportOptions["retry"] = {
  maxAttempts: 3,
  baseDelayMs: 1,
  maxDelayMs: 1,
  jitter: () => 0,
  sleep: () => Promise.resolve(),
};

beforeEach(() => setTelemetrySink(() => {}));
afterEach(() => resetTelemetrySink());

describe("timeout", () => {
  it("aborts a hanging request and raises TimeoutError", async () => {
    const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      })) as typeof fetch;

    await expect(
      request("https://x.test", {}, ctx, {
        timeoutMs: 5,
        fetchImpl: hangingFetch,
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("retry / backoff", () => {
  it("retries an idempotent op until success", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls < 3) return new Response("", { status: 500 });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await request("https://x.test", {}, ctx, {
      idempotent: true,
      retry: fastRetry,
      fetchImpl,
    });
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });

  it("does not retry a non-idempotent op", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("", { status: 500 });
    }) as typeof fetch;

    await expect(
      request("https://x.test", {}, ctx, {
        idempotent: false,
        retry: fastRetry,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(UpstreamError);
    expect(calls).toBe(1);
  });

  it("retries when an idempotency key is present", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return calls < 2
        ? new Response("", { status: 503 })
        : new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await request("https://x.test", {}, ctx, {
      idempotencyKey: "key-1",
      retry: fastRetry,
      fetchImpl,
    });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });
});

describe("rate limiting", () => {
  it("surfaces 429 as RateLimitError with retry-after", async () => {
    const fetchImpl = (async () =>
      new Response("", {
        status: 429,
        headers: { "retry-after": "2" },
      })) as typeof fetch;

    const error = await request("https://x.test", {}, ctx, { fetchImpl }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(2000);
  });
});

describe("circuit breaker", () => {
  it("short-circuits with CircuitOpenError when the circuit is open", async () => {
    const circuit = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000 });
    const fetchImpl = (async () =>
      new Response("", { status: 500 })) as typeof fetch;

    // First call fails and trips the breaker (threshold 1).
    await expect(
      request("https://x.test", {}, ctx, { circuit, fetchImpl }),
    ).rejects.toBeInstanceOf(UpstreamError);

    // Next call is short-circuited without hitting fetch.
    const spy = vi.fn();
    await expect(
      request("https://x.test", {}, ctx, {
        circuit,
        fetchImpl: (async () => {
          spy();
          return new Response("", { status: 200 });
        }) as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
  });
});
