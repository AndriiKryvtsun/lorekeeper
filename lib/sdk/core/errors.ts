// Typed error hierarchy for the SDK. Isomorphic: safe to import on client or server.
// Callers branch on error type rather than parsing messages.

export type SdkErrorContext = {
  capability?: string;
  providerId?: string;
};

export class SdkError extends Error {
  readonly capability?: string;
  readonly providerId?: string;

  constructor(message: string, ctx: SdkErrorContext = {}) {
    super(message);
    // Subclass name (TimeoutError, etc.) — used as the telemetry error type.
    this.name = new.target.name;
    this.capability = ctx.capability;
    this.providerId = ctx.providerId;
  }
}

// A request exceeded its timeout and was aborted.
export class TimeoutError extends SdkError {}

// Upstream signalled rate limiting (e.g. HTTP 429).
export class RateLimitError extends SdkError {
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    ctx: SdkErrorContext & { retryAfterMs?: number } = {},
  ) {
    super(message, ctx);
    this.retryAfterMs = ctx.retryAfterMs;
  }
}

// Upstream returned an error response (typically 4xx/5xx other than 429).
export class UpstreamError extends SdkError {
  readonly status?: number;

  constructor(message: string, ctx: SdkErrorContext & { status?: number } = {}) {
    super(message, ctx);
    this.status = ctx.status;
  }
}

// The provider's circuit breaker is open; the call was short-circuited.
export class CircuitOpenError extends SdkError {}

// The selected provider id is not registered for the capability.
export class UnknownProviderError extends SdkError {}

// No active provider is configured for the capability.
export class NoProviderConfiguredError extends SdkError {}
