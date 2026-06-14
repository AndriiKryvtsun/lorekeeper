import "server-only";

// Redacted structured logging + per-call audit for the assistant. By construction these
// accept ONLY non-sensitive fields — there is no parameter for the question, retrieved
// records, the answer, or secrets, so prompts/PII/secrets cannot be logged.

export type AssistantOutcome = "success" | "error" | "blocked";

export type AssistantAuditRecord = {
  userId: string;
  campaignId: string;
  outcome: AssistantOutcome;
  tier?: "answer" | "reasoning";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  // A coarse, non-sensitive reason (e.g. "rate_limit:ip", "not_found", "over_budget").
  reason?: string;
};

// Writes one durable, redacted audit line per assistant call. A DB-backed audit table can
// replace this sink later without changing callers.
export function auditAssistantCall(record: AssistantAuditRecord): void {
  console.info(
    JSON.stringify({
      kind: "assistant.audit",
      at: new Date().toISOString(),
      ...record,
    }),
  );
}

// Redacted audit for the write-proposal flow. Like the call audit, it has NO parameter for
// field values, the user's message, or secrets — only the coarse action/entity/ids and
// outcome are recorded, so PII cannot leak. The commit event ties the outcome to the
// confirming user.
export type ProposalAuditRecord = {
  event: "proposal_generated" | "proposal_committed";
  userId: string;
  campaignId: string;
  action: string;
  entity: string;
  outcome: AssistantOutcome;
  // The created/updated/deleted row id on a successful commit (non-sensitive).
  entityId?: string;
  // A coarse, non-sensitive reason (e.g. "not_found", "invalid_proposal", "no_proposal").
  reason?: string;
};

export function auditProposalEvent(record: ProposalAuditRecord): void {
  console.info(
    JSON.stringify({
      kind: "assistant.proposal_audit",
      at: new Date().toISOString(),
      ...record,
    }),
  );
}
