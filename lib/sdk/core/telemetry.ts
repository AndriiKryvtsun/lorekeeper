// Per-call telemetry. Isomorphic. Redaction is STRUCTURAL: the event type accepts only
// allow-listed, non-sensitive fields — there is no parameter for request/response bodies,
// prompts, args, or secrets, so sensitive data cannot be passed in or logged.

export type TelemetryOutcome = "success" | "error";

export type TelemetryEvent = {
  capability: string;
  providerId: string;
  outcome: TelemetryOutcome;
  latencyMs: number;
  // Optional, non-sensitive context.
  status?: number;
  errorType?: string;
};

export type TelemetrySink = (event: TelemetryEvent) => void;

// Default sink: a single structured line. Only allow-listed fields are present.
const defaultSink: TelemetrySink = (event) => {
  console.info(
    JSON.stringify({ kind: "sdk.call", ...event }),
  );
};

let currentSink: TelemetrySink = defaultSink;

export function setTelemetrySink(sink: TelemetrySink): void {
  currentSink = sink;
}

export function resetTelemetrySink(): void {
  currentSink = defaultSink;
}

export function recordTelemetry(event: TelemetryEvent): void {
  currentSink(event);
}
