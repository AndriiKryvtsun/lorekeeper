import { z } from "zod";

import {
  createCharacterSchema,
  updateCharacterSchema,
} from "@/lib/validation/character";
import { createItemSchema, updateItemSchema } from "@/lib/validation/item";
import {
  createLocationSchema,
  updateLocationSchema,
} from "@/lib/validation/location";
import { createNpcSchema, updateNpcSchema } from "@/lib/validation/npc";
import { createSessionSchema, updateSessionSchema } from "@/lib/validation/session";
import type { Proposal } from "@/lib/validation/assistant-proposal";

// The assistant's ACTION REGISTRY: the single closed list of writes the assistant may perform.
// Each `(action, entity)` pair is one entry binding a payload schema and a required scope; the
// owner-scoped operation is bound to the same key in `lib/data/action-registry.ts` (server-only,
// because it reaches Prisma). This module is isomorphic — the chat UI imports the envelope and
// payload types from here, so it MUST NOT import `server-only` or anything under `lib/data`.

export const ACTION_ENTITIES = [
  "npc",
  "location",
  "item",
  "session",
  "character",
] as const;
export type ActionEntity = (typeof ACTION_ENTITIES)[number];

export const ACTION_VERBS = ["create", "update", "delete"] as const;
export type ActionVerb = (typeof ACTION_VERBS)[number];

// A registry key. Every executable write is one of these and nothing else.
export type ActionKey = `${ActionVerb}:${ActionEntity}`;
export const actionKey = (action: ActionVerb, entity: ActionEntity): ActionKey =>
  `${action}:${entity}`;

// The scope a write requires. It is DECLARED here and enforced by construction: only an
// owner-scoped operation can be bound to a key (see `ActionOperation`), and that operation
// re-checks campaign ownership. The string is the audit/telemetry label and makes the
// authorised surface reviewable in one place. It is never supplied by the model or a request.
export type ScopeString = `campaign:${ActionEntity}:write`;
const scopeFor = (entity: ActionEntity): ScopeString => `campaign:${entity}:write`;

export type ActionEntry = {
  readonly action: ActionVerb;
  readonly entity: ActionEntity;
  readonly scope: ScopeString;
  // The payload the model may supply, validated independently before execution. `null` for
  // delete, which carries a target and no fields.
  readonly payload: z.ZodTypeAny | null;
};

// The payload schemas, kept precisely typed (not widened to ZodTypeAny) so callers that need
// per-entity inference — `parseProposal` — keep it. The registry below is built from these, so
// the two views cannot drift.
export const createPayloadSchemas = {
  npc: createNpcSchema,
  location: createLocationSchema,
  item: createItemSchema,
  session: createSessionSchema,
  character: createCharacterSchema,
} as const;

export const updatePayloadSchemas = {
  npc: updateNpcSchema,
  location: updateLocationSchema,
  item: updateItemSchema,
  session: updateSessionSchema,
  character: updateCharacterSchema,
} as const;

function buildRegistry(): Record<ActionKey, ActionEntry> {
  const out = {} as Record<ActionKey, ActionEntry>;
  for (const entity of ACTION_ENTITIES) {
    for (const action of ACTION_VERBS) {
      out[actionKey(action, entity)] = {
        action,
        entity,
        scope: scopeFor(entity),
        payload:
          action === "create"
            ? createPayloadSchemas[entity]
            : action === "update"
              ? updatePayloadSchemas[entity]
              : null,
      };
    }
  }
  return out;
}

export const ACTION_REGISTRY: Record<ActionKey, ActionEntry> = buildRegistry();

export const ACTION_KEYS = Object.keys(ACTION_REGISTRY) as ActionKey[];

// Resolution fails CLOSED: an unregistered pair yields `unsupported` and there is no default,
// catch-all, or inferred entry for it.
export type ActionResolution =
  | { ok: true; entry: ActionEntry }
  | { ok: false; reason: "unsupported" };

export function resolveActionKey(action: string, entity: string): ActionResolution {
  const entry = (ACTION_REGISTRY as Record<string, ActionEntry | undefined>)[
    `${action}:${entity}`
  ];
  return entry ? { ok: true, entry } : { ok: false, reason: "unsupported" };
}

// ---------------------------------------------------------------------------
// Field descriptors, DERIVED from each entry's payload schema
// ---------------------------------------------------------------------------

// Introspected description of one payload field. Derived from the Zod schema so a schema change
// flows into the model's output contract with no prompt edit; nothing here is hand-maintained.
export type FieldDescriptor = {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "enum" | "unknown";
  required: boolean;
  defaultValue?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  int?: boolean;
};

type ZodDefLike = {
  typeName?: string;
  innerType?: unknown;
  schema?: unknown;
  options?: unknown[];
  values?: unknown[];
  defaultValue?: () => unknown;
  checks?: { kind: string; value?: unknown }[];
};

const defOf = (schema: unknown): ZodDefLike =>
  ((schema as { _def?: ZodDefLike })?._def ?? {}) as ZodDefLike;

// Unwrap the object schema out of `.refine(...)` wrappers (the update schemas use one).
function objectShapeOf(schema: unknown): Record<string, unknown> | null {
  let current = schema;
  for (let depth = 0; depth < 8; depth += 1) {
    const def = defOf(current);
    if (def.typeName === "ZodObject") {
      const shape = (current as { shape: Record<string, unknown> }).shape;
      return shape;
    }
    if (def.schema !== undefined) {
      current = def.schema;
      continue;
    }
    if (def.innerType !== undefined) {
      current = def.innerType;
      continue;
    }
    return null;
  }
  return null;
}

function baseTypeOf(typeName: string | undefined): FieldDescriptor["type"] {
  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodDate":
      return "date";
    case "ZodBoolean":
      return "boolean";
    case "ZodEnum":
    case "ZodNativeEnum":
      return "enum";
    default:
      return "unknown";
  }
}

// Describe one field: peel optional/default/nullable/union wrappers, then read the base type's
// checks. `required` is false when the field is optional or carries a default.
function describeField(name: string, schema: unknown): FieldDescriptor {
  let current = schema;
  let required = true;
  let defaultValue: string | undefined;

  for (let depth = 0; depth < 8; depth += 1) {
    const def = defOf(current);
    if (def.typeName === "ZodOptional" || def.typeName === "ZodNullable") {
      required = false;
      current = def.innerType;
      continue;
    }
    if (def.typeName === "ZodDefault") {
      required = false;
      try {
        defaultValue = String(def.defaultValue?.());
      } catch {
        defaultValue = undefined;
      }
      current = def.innerType;
      continue;
    }
    if (def.typeName === "ZodUnion" && Array.isArray(def.options)) {
      // `.or(...)` variants (e.g. item.ownerNpcId) — describe the first branch, which is the
      // meaningful one; the others exist to coerce empty input away.
      const first = def.options[0];
      if (defOf(first).typeName === "ZodOptional") required = false;
      current = first;
      continue;
    }
    if (def.typeName === "ZodEffects" && def.schema !== undefined) {
      current = def.schema;
      continue;
    }
    break;
  }

  const def = defOf(current);
  const descriptor: FieldDescriptor = {
    name,
    type: baseTypeOf(def.typeName),
    required,
  };
  if (defaultValue !== undefined) descriptor.defaultValue = defaultValue;
  if (Array.isArray(def.values)) {
    descriptor.enumValues = def.values.map((v) => String(v));
  }
  for (const check of def.checks ?? []) {
    if (check.kind === "min" && typeof check.value === "number") {
      descriptor.min = check.value;
    }
    if (check.kind === "max" && typeof check.value === "number") {
      descriptor.max = check.value;
    }
    if (check.kind === "int") descriptor.int = true;
  }
  return descriptor;
}

// The payload fields of a registry entry, derived from its schema. Empty for delete.
export function describeFields(entry: ActionEntry): FieldDescriptor[] {
  if (!entry.payload) return [];
  const shape = objectShapeOf(entry.payload);
  if (!shape) return [];
  return Object.entries(shape).map(([name, field]) => describeField(name, field));
}

// ---------------------------------------------------------------------------
// Action plan
// ---------------------------------------------------------------------------

// The classifier's output, parsed leniently: an out-of-range value is treated as absent rather
// than failing the whole parse.
export const rawActionPlanSchema = z.object({
  kind: z.string(),
  action: z.string().nullish(),
  entity: z.string().nullish(),
  difficulty: z.string().nullish(),
  contradiction: z.boolean().nullish(),
  delegated: z.boolean().nullish(),
});

// The machine-readable plan. It carries NO missing-field list (those are derived from validation,
// not self-reported), no scope, and no ids. A write plan must resolve to a registry entry before
// anything else runs.
export type ActionPlan =
  | { kind: "question"; difficulty: "normal" | "hard"; delegated: boolean }
  | {
      kind: "write";
      action: ActionVerb;
      entity: ActionEntity;
      contradiction: boolean;
      // The user asked the assistant to choose the values it was not given. Derived from the
      // user.s own message only, and the ONLY licence to invent a value.
      delegated: boolean;
    };

export const asActionVerb = (v: unknown): ActionVerb | null =>
  ACTION_VERBS.includes(v as ActionVerb) ? (v as ActionVerb) : null;

export const asActionEntity = (v: unknown): ActionEntity | null =>
  ACTION_ENTITIES.includes(v as ActionEntity) ? (v as ActionEntity) : null;

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

// Stable, machine-readable failure codes. The UI branches on the outcome and these codes, never
// on message text.
export const ENVELOPE_CODES = [
  "unsupported_action",
  "invalid_payload",
  "not_found",
  "invalid_operation",
  "timeout",
  "rate_limited",
  "upstream",
  "unavailable",
] as const;
export type EnvelopeCode = (typeof ENVELOPE_CODES)[number];

// An UNFINISHED write, emitted with a clarification and echoed back by the client alongside the
// user's answer. It exists because classification reads the latest user message only (so a bare
// answer like "The dark canyon" would otherwise classify as a question and lose the write). It
// carries the registry key the question belongs to plus the values gathered so far.
//
// It arrives from the CLIENT — the user's own channel — so it grants no capability the user did
// not already have by typing "create a location named X". Intent still never originates in
// untrusted content: classification reads neither `<campaign_data>` nor conversation history, and
// this is a structured registry key rather than prose. The carried `fields` are re-validated
// against the entry's schema like any other payload, and confirmation still gates the write.
export const pendingActionSchema = z.object({
  action: z.enum(ACTION_VERBS),
  entity: z.enum(ACTION_ENTITIES),
  // The field names the question asked for (informational; validation re-derives what is missing).
  needs: z.array(z.string().min(1).max(64)).max(32).default([]),
  // Partial values already gathered. Bounded here; stripped and type-checked by the validator.
  fields: z
    .record(z.unknown())
    .refine((f) => Object.keys(f).length <= 32, "too many fields")
    .optional(),
  // A target name already given for an update/delete.
  target: z.string().trim().min(1).max(200).optional(),
});

export type PendingAction = z.infer<typeof pendingActionSchema>;

// One answer offered by a clarification (e.g. the enrichment source choice). Selecting one is
// answering the question — it is never a confirmable write.
export type ClarificationOption = {
  id: string;
  label: string;
  // Opaque payload the client hands to the flow that owns this option.
  data?: Record<string, unknown>;
};

// EVERY write-path outcome is one of these. `clarification` carries no confirmable payload;
// `proposal` carries the validated, committable proposal unchanged.
export type ActionEnvelope =
  | {
      outcome: "success";
      action: ActionVerb;
      entity: ActionEntity;
      entityId: string;
      title: string;
    }
  | {
      outcome: "clarification";
      question: string;
      // The field names the answer must supply, when the question is about missing values.
      needs?: string[];
      options?: ClarificationOption[];
      // The unfinished write this question belongs to, so the answer can continue it.
      pending?: PendingAction;
    }
  | {
      outcome: "proposal";
      proposal: Proposal;
      // Fields the assistant generated under delegation, labelled so the user sees what it
      // filled in before confirming. Computed from the payload, never self-reported.
      generated?: string[];
    }
  | { outcome: "validation_error"; code: EnvelopeCode; message: string }
  | { outcome: "operation_error"; code: EnvelopeCode; message: string }
  | { outcome: "transport_error"; code: EnvelopeCode; message: string };

export type EnvelopeOutcome = ActionEnvelope["outcome"];

export const ENVELOPE_OUTCOMES = [
  "success",
  "clarification",
  "proposal",
  "validation_error",
  "operation_error",
  "transport_error",
] as const;

// The stream part name the write path writes the envelope to.
export const ENVELOPE_PART = "data-action-result" as const;

// Whether retrying the same request could plausibly help. Drives the UI's retry affordance: a
// transport failure may succeed on a second attempt, while a validation or operation refusal
// will not.
export function isRetryableEnvelope(envelope: ActionEnvelope): boolean {
  return envelope.outcome === "transport_error";
}

// The user-facing message of a failure envelope, or null for a non-failure outcome. Lets a
// caller that needs a thrown error (a form flow, say) convert an envelope without re-deriving
// which outcomes carry a message.
export function envelopeErrorMessage(envelope: ActionEnvelope): string | null {
  switch (envelope.outcome) {
    case "validation_error":
    case "operation_error":
    case "transport_error":
      return envelope.message;
    default:
      return null;
  }
}
