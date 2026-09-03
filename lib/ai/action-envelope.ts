import "server-only";

import {
  CircuitOpenError,
  RateLimitError,
  SdkError,
  TimeoutError,
  UpstreamError,
} from "@/lib/sdk/core/errors";
import type {
  ActionEnvelope,
  ActionEntity,
  ActionVerb,
  EnvelopeCode,
} from "@/lib/validation/assistant-actions";
import type { Proposal } from "@/lib/validation/assistant-proposal";
import { proposalTitle } from "@/lib/validation/assistant-proposal";

// Every write-path outcome becomes one envelope HERE, and failures are normalised in one place so
// distinct failure modes stay distinguishable by code rather than by message text. Nothing in a
// message may carry prompt text, PII, a secret, a stack trace, an internal id, or a provider
// error string — diagnostics go to the redacted log instead.

// User-facing text per code. Deliberately actionable but free of internal detail.
const MESSAGES: Record<EnvelopeCode, string> = {
  unsupported_action:
    "I can answer questions about this campaign, or create, update, or delete an NPC, " +
    "location, item, session, or character. That one I can't do.",
  invalid_payload:
    "I couldn't turn that into a change I can make — try rephrasing, e.g. " +
    '"Create an NPC named Sera, a wary harbor guard."',
  not_found: "That campaign or entity could not be found.",
  invalid_operation: "That change isn't valid for this campaign.",
  timeout: "That took too long, so nothing was changed. Please try again.",
  rate_limited: "The assistant is busy right now. Please try again in a moment.",
  upstream: "The assistant is unavailable right now. Please try again.",
  unavailable: "The assistant is unavailable right now. Please try again.",
};

const validationError = (code: EnvelopeCode): ActionEnvelope => ({
  outcome: "validation_error",
  code,
  message: MESSAGES[code],
});

const operationError = (code: EnvelopeCode): ActionEnvelope => ({
  outcome: "operation_error",
  code,
  message: MESSAGES[code],
});

const transportError = (code: EnvelopeCode): ActionEnvelope => ({
  outcome: "transport_error",
  code,
  message: MESSAGES[code],
});

// An (action, entity) pair with no registry entry. Not executable, and not retryable.
export const unsupportedActionEnvelope = (): ActionEnvelope =>
  validationError("unsupported_action");

// Model output that does not satisfy the entry's payload schema (and is not merely incomplete —
// an incomplete payload becomes a clarification instead).
export const invalidPayloadEnvelope = (): ActionEnvelope =>
  validationError("invalid_payload");

// A refusal from the owner-scoped operation. `not_found` covers an unowned campaign as well as a
// missing one, so the envelope never reveals that a resource exists.
export const operationErrorEnvelope = (
  reason: "not_found" | "invalid",
): ActionEnvelope =>
  operationError(reason === "invalid" ? "invalid_operation" : "not_found");

export const proposalEnvelope = (
  proposal: Proposal,
  generated: string[] = [],
): ActionEnvelope => ({
  outcome: "proposal",
  proposal,
  ...(generated.length > 0 ? { generated } : {}),
});

export const successEnvelope = (
  action: ActionVerb,
  entity: ActionEntity,
  entityId: string,
  title: string,
): ActionEnvelope => ({ outcome: "success", action, entity, entityId, title });

// Normalise ANY failure into the envelope. Typed SDK errors map to their own transport codes; an
// unrecognised error maps to `transport_error`/`unavailable` rather than escaping unhandled or
// surfacing raw. A redacted line is logged so the failure stays diagnosable server-side.
export function normalizeFailure(error: unknown, where: string): ActionEnvelope {
  const code = transportCodeFor(error);
  console.warn(
    JSON.stringify({
      kind: "assistant.action_failure",
      where,
      code,
      // Error TYPE only — never the message, which can echo inputs.
      error: error instanceof Error ? error.name : typeof error,
    }),
  );
  return transportError(code);
}

function transportCodeFor(error: unknown): EnvelopeCode {
  if (error instanceof TimeoutError) return "timeout";
  if (error instanceof RateLimitError) return "rate_limited";
  if (error instanceof UpstreamError) return "upstream";
  if (error instanceof CircuitOpenError) return "unavailable";
  if (error instanceof SdkError) return "upstream";
  // Anything else: a bug, a network fault, an aborted stream. Normalised, never leaked.
  return "unavailable";
}

// The one line of assistant text that accompanies an envelope. Derived from the envelope so the
// text and the structured outcome can never disagree.
export function envelopeText(envelope: ActionEnvelope): string {
  switch (envelope.outcome) {
    case "success":
      return `✓ ${pastTense(envelope.action)} ${envelope.entity} "${envelope.title}".`;
    case "clarification":
      return envelope.question;
    case "proposal": {
      const what = `the ${envelope.proposal.action} of ${envelope.proposal.entity} "${proposalTitle(
        envelope.proposal,
      )}"`;
      // Say plainly which values the assistant chose, so nothing generated slips past unnoticed.
      const filled = envelope.generated?.length
        ? ` I chose ${envelope.generated.join(", ")} myself —`
        : "";
      return `I have drafted ${what} below.${filled} Review and confirm to apply it.`;
    }
    case "validation_error":
    case "operation_error":
    case "transport_error":
      return envelope.message;
  }
}

function pastTense(action: ActionVerb): string {
  return action === "create" ? "Created" : action === "update" ? "Updated" : "Deleted";
}
