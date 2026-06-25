import "server-only";

// Redacted structured logging + audit. Redaction is STRUCTURAL: fields are constrained to
// primitives the caller explicitly passes — there is no parameter for request/response bodies,
// prompts, tokens, or secrets, so sensitive data cannot be passed in. Callers must only pass
// non-sensitive, allow-listed fields (ids, outcomes, counts, coarse reasons).

export type LogFields = Record<string, string | number | boolean | undefined>;
type LogLevel = "info" | "warn" | "error";

function emit(payload: Record<string, unknown>): void {
  console.info(JSON.stringify(payload));
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  emit({ kind: event, level, at: new Date().toISOString(), ...fields });
}

// Durable audit record for a sensitive action (account deletion, assistant call/commit, …).
export function audit(event: string, fields: LogFields = {}): void {
  emit({ kind: "audit", event, at: new Date().toISOString(), ...fields });
}
