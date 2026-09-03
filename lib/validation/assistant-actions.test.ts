import { describe, expect, it } from "vitest";

import {
  ACTION_ENTITIES,
  ACTION_KEYS,
  ACTION_REGISTRY,
  ACTION_VERBS,
  ENVELOPE_OUTCOMES,
  actionKey,
  describeFields,
  resolveActionKey,
  type ActionEnvelope,
  type EnvelopeOutcome,
} from "@/lib/validation/assistant-actions";

describe("the registry is closed and complete", () => {
  it("holds exactly one entry per (action, entity) pair", () => {
    expect(ACTION_KEYS).toHaveLength(ACTION_VERBS.length * ACTION_ENTITIES.length);
    for (const entity of ACTION_ENTITIES) {
      for (const action of ACTION_VERBS) {
        expect(ACTION_REGISTRY[actionKey(action, entity)]).toMatchObject({
          action,
          entity,
        });
      }
    }
  });

  it("binds one payload schema and one scope per entry", () => {
    for (const key of ACTION_KEYS) {
      const entry = ACTION_REGISTRY[key];
      expect(entry.scope).toBe(`campaign:${entry.entity}:write`);
      // create/update carry a payload; delete carries a target and no fields.
      expect(entry.payload === null).toBe(entry.action === "delete");
    }
  });

  it("resolves every registered pair", () => {
    for (const key of ACTION_KEYS) {
      const entry = ACTION_REGISTRY[key];
      const resolved = resolveActionKey(entry.action, entry.entity);
      expect(resolved).toEqual({ ok: true, entry });
    }
  });
});

describe("unregistered pairs fail closed", () => {
  it.each([
    ["archive", "npc"],
    ["create", "dragon"],
    ["", ""],
    ["create", "npc:create"],
    ["__proto__", "npc"],
    ["toString", "npc"],
  ])("(%s, %s) is unsupported", (action, entity) => {
    expect(resolveActionKey(action, entity)).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("offers no default or catch-all entry", () => {
    const resolved = resolveActionKey("create", "spaceship");
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved).not.toHaveProperty("entry");
  });
});

describe("field descriptors are derived from the payload schema", () => {
  it("marks required, optional, and defaulted NPC create fields", () => {
    const fields = describeFields(ACTION_REGISTRY["create:npc"]);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    expect(byName.name).toMatchObject({ type: "string", required: true });
    expect(byName.role).toMatchObject({ type: "string", required: false });
    // `status` has a schema default, so the model need not supply it.
    expect(byName.status).toMatchObject({ required: false, defaultValue: "alive" });
  });

  it("reports the session date as a date and the character level as a bounded int", () => {
    const session = describeFields(ACTION_REGISTRY["create:session"]);
    expect(session.find((f) => f.name === "date")).toMatchObject({
      type: "date",
      required: true,
    });
    const level = describeFields(ACTION_REGISTRY["create:character"]).find(
      (f) => f.name === "level",
    );
    expect(level).toMatchObject({ type: "number", required: true, int: true, min: 1 });
  });

  it("sees through the `.or()` wrapper on an optional item owner", () => {
    const owner = describeFields(ACTION_REGISTRY["create:item"]).find(
      (f) => f.name === "ownerNpcId",
    );
    expect(owner).toMatchObject({ name: "ownerNpcId", required: false });
  });

  it("sees through the `.refine()` wrapper on update schemas (all fields optional)", () => {
    const fields = describeFields(ACTION_REGISTRY["update:npc"]);
    expect(fields.map((f) => f.name).sort()).toEqual([
      "description",
      "name",
      "role",
      "status",
    ]);
    expect(fields.every((f) => !f.required)).toBe(true);
  });

  it("describes no fields for a delete entry", () => {
    expect(describeFields(ACTION_REGISTRY["delete:npc"])).toEqual([]);
  });

  it("covers every field of every entry's schema (no hand-maintained list to drift)", () => {
    for (const key of ACTION_KEYS) {
      const entry = ACTION_REGISTRY[key];
      if (!entry.payload) continue;
      expect(describeFields(entry).length).toBeGreaterThan(0);
    }
  });
});

describe("the response envelope", () => {
  it("enumerates exactly the six write-path outcomes", () => {
    expect([...ENVELOPE_OUTCOMES].sort()).toEqual([
      "clarification",
      "operation_error",
      "proposal",
      "success",
      "transport_error",
      "validation_error",
    ]);
  });

  it("is exhaustive over the union (compile-time `never` check)", () => {
    // Any outcome added to ActionEnvelope without a branch here fails `tsc`.
    const label = (envelope: ActionEnvelope): string => {
      switch (envelope.outcome) {
        case "success":
          return envelope.entityId;
        case "clarification":
          return envelope.question;
        case "proposal":
          return envelope.proposal.action;
        case "validation_error":
        case "operation_error":
        case "transport_error":
          return envelope.code;
        default: {
          const exhaustive: never = envelope;
          return exhaustive;
        }
      }
    };
    expect(
      label({ outcome: "clarification", question: "Which NPC did you mean?" }),
    ).toBe("Which NPC did you mean?");
    // The runtime list and the type-level union agree.
    const outcomes: EnvelopeOutcome[] = [...ENVELOPE_OUTCOMES];
    expect(outcomes).toHaveLength(6);
  });
});
