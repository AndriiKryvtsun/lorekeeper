import type { z } from "zod";

import {
  describeFields,
  type ActionEntry,
  type ActionEnvelope,
  type FieldDescriptor,
  type PendingAction,
} from "@/lib/validation/assistant-actions";

// The independent validation boundary between model output and execution. Nothing here consults
// the model: a payload is checked against the resolved registry entry's own schema, and what the
// user still has to supply is DERIVED from the resulting Zod issues — never self-reported by the
// model. The module is isomorphic (schemas only, no data layer) so the commit path and the chat
// path share exactly one implementation.

export type PayloadValidation =
  | { ok: true; payload: unknown }
  | {
      ok: false;
      issues: z.ZodIssue[];
      // Required fields the user has not usably supplied. Empty when the payload is merely
      // malformed (e.g. garbage in an optional field), which is not a question but a rejection.
      missing: string[];
    };

// Validate raw (model-produced or request-supplied) output against the entry's payload schema.
// Unknown and over-scoped keys are stripped by the schema itself, so a payload that validates
// here is, by construction, exactly what the bound operation accepts.
export function validatePayload(entry: ActionEntry, raw: unknown): PayloadValidation {
  // A delete carries a target and no fields; there is nothing for the model to supply.
  if (!entry.payload) return { ok: true, payload: undefined };

  const parsed = entry.payload.safeParse(raw);
  if (parsed.success) return { ok: true, payload: parsed.data };

  const issues = parsed.error.issues;
  return { ok: false, issues, missing: missingRequiredFields(entry, issues) };
}

// Which REQUIRED fields the issues say are absent or unusable. Derived from the schema's own
// required set: an issue on an optional field means the model produced garbage (a rejection),
// while an issue on a required field means the user has not given us that value yet (a question).
export function missingRequiredFields(
  entry: ActionEntry,
  issues: readonly z.ZodIssue[],
): string[] {
  const required = new Set(
    describeFields(entry)
      .filter((field) => field.required)
      .map((field) => field.name),
  );
  const missing: string[] = [];
  for (const issue of issues) {
    const name = issue.path[0];
    if (typeof name !== "string") continue;
    if (!required.has(name) || missing.includes(name)) continue;
    missing.push(name);
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Clarification
// ---------------------------------------------------------------------------

export type Clarification = Extract<ActionEnvelope, { outcome: "clarification" }>;

// Why we are asking rather than proposing. Each case names something code established: a
// required field the schema says is absent, a target that matched nothing or several rows, or the
// classifier's contradiction signal.
export type ClarificationReason =
  | { kind: "missing_fields"; fields: string[] }
  // The request named no target at all for an update or delete.
  | { kind: "target_unknown" }
  | { kind: "target_none"; name: string }
  | { kind: "target_many"; name: string; candidates: string[] }
  | { kind: "contradiction" };

// A human hint for one field, derived from its descriptor — used in both the question and the
// model's output contract, so the two always describe the same schema.
export function fieldHint(field: FieldDescriptor): string {
  const parts: string[] = [];
  if (field.enumValues?.length) {
    parts.push(`one of ${field.enumValues.map((v) => `"${v}"`).join(", ")}`);
  } else if (field.type === "date") {
    parts.push("an ISO 8601 date, e.g. 2026-05-01");
  } else if (field.type === "number") {
    const bounds = [
      field.int ? "whole number" : "number",
      field.min !== undefined ? `at least ${field.min}` : null,
      field.max !== undefined ? `at most ${field.max}` : null,
    ].filter(Boolean);
    parts.push(bounds.join(", "));
  } else if (field.type === "string") {
    parts.push("text");
  }
  return parts.length > 0 ? `${field.name} (${parts.join("; ")})` : field.name;
}

const listOf = (parts: string[]): string =>
  parts.length <= 1
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

// What has been gathered so far. Carried on the clarification so the user's ANSWER can continue
// the same write, instead of being classified from scratch (a bare "The dark canyon" would
// otherwise look like a question).
export type CarriedValues = {
  fields?: Record<string, unknown>;
  target?: string;
};

// Build the question. A clarification NEVER carries a confirmable payload — that is what makes it
// impossible to confirm a value the user did not supply. It DOES carry the pending action, which
// is the registry key the question belongs to, so answering it resumes that entry.
export function clarificationFor(
  entry: ActionEntry,
  reason: ClarificationReason,
  carried: CarriedValues = {},
): Clarification {
  const { action, entity } = entry;

  const pending = (needs: string[], keepTarget = true): PendingAction => ({
    action,
    entity,
    needs,
    fields: carried.fields,
    target: keepTarget ? carried.target : undefined,
  });

  if (reason.kind === "missing_fields") {
    const byName = new Map(describeFields(entry).map((f) => [f.name, f]));
    const hints = reason.fields.map((name) => {
      const field = byName.get(name);
      return field ? fieldHint(field) : name;
    });
    return {
      outcome: "clarification",
      question:
        `To ${action} that ${entity} I still need ${listOf(hints)}. ` +
        `What should ${reason.fields.length === 1 ? "it" : "they"} be?`,
      needs: reason.fields,
      pending: pending(reason.fields),
    };
  }

  if (reason.kind === "target_unknown") {
    return {
      outcome: "clarification",
      question: `Which ${entity} should I ${action}? Tell me its exact name.`,
      needs: ["target"],
      pending: pending(["target"]),
    };
  }

  if (reason.kind === "target_none") {
    return {
      outcome: "clarification",
      question:
        `I couldn't find a ${entity} named "${reason.name}" in this campaign to ${action}. ` +
        "What is its exact name?",
      needs: ["target"],
      // The name that failed is not carried back — the answer replaces it.
      pending: pending(["target"], false),
    };
  }

  if (reason.kind === "target_many") {
    return {
      outcome: "clarification",
      question:
        `There are ${reason.candidates.length} ${entity}s named "${reason.name}" in this ` +
        `campaign, so I can't tell which one to ${action}. Rename one of them, or make the ` +
        `change from that ${entity}'s own page.`,
      needs: ["target"],
      pending: pending(["target"], false),
    };
  }

  return {
    outcome: "clarification",
    question:
      `That request gives conflicting details for the ${entity} to ${action}, so I haven't ` +
      "changed anything. Which values should I use?",
    // The conflicting values are dropped; the intent survives, so the answer continues the write.
    pending: pending([], false),
  };
}
