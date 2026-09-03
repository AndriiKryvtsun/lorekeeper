import { describe, expect, it } from "vitest";

import {
  clarificationFor,
  fieldHint,
  missingRequiredFields,
  validatePayload,
} from "@/lib/validation/action-validator";
import {
  ACTION_REGISTRY,
  describeFields,
} from "@/lib/validation/assistant-actions";

const createNpc = ACTION_REGISTRY["create:npc"];
const updateNpc = ACTION_REGISTRY["update:npc"];
const deleteNpc = ACTION_REGISTRY["delete:npc"];
const createSession = ACTION_REGISTRY["create:session"];
const createCharacter = ACTION_REGISTRY["create:character"];

describe("payload validation", () => {
  it("returns the typed payload for output that satisfies the schema", () => {
    const result = validatePayload(createNpc, { name: "Sera", role: "harbor guard" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The schema's default is applied, so the payload is exactly what the operation accepts.
      expect(result.payload).toEqual({
        name: "Sera",
        role: "harbor guard",
        status: "alive",
      });
    }
  });

  it("strips unknown and over-scoped keys", () => {
    const result = validatePayload(createNpc, {
      name: "Sera",
      campaignId: "someone-elses-campaign",
      id: "npc-forced",
      ownerId: "another-user",
      isAdmin: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.payload as object).sort()).toEqual(["name", "status"]);
    }
  });

  it("rejects output that violates the schema", () => {
    const result = validatePayload(createCharacter, {
      name: "Sera",
      playerName: "Ana",
      class: "rogue",
      level: 0, // below the schema minimum
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });

  it("treats a delete entry as having nothing for the model to supply", () => {
    const result = validatePayload(deleteNpc, { anything: "ignored" });
    expect(result).toEqual({ ok: true, payload: undefined });
  });

  it("rejects an update with no fields to change", () => {
    // The update schema's refinement requires at least one key.
    expect(validatePayload(updateNpc, {}).ok).toBe(false);
  });
});

describe("missing required fields are derived from the schema, not the model", () => {
  it("names an absent required string", () => {
    const result = validatePayload(createNpc, { role: "guard" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual(["name"]);
  });

  it("names an unusable required date and an unusable required number", () => {
    const session = validatePayload(createSession, { title: "Session 1" });
    expect(session.ok).toBe(false);
    if (!session.ok) expect(session.missing).toEqual(["date"]);

    const character = validatePayload(createCharacter, {
      name: "Sera",
      playerName: "Ana",
      class: "rogue",
    });
    expect(character.ok).toBe(false);
    if (!character.ok) expect(character.missing).toEqual(["level"]);
  });

  it("names an empty required string (a blank is not a value)", () => {
    const result = validatePayload(createNpc, { name: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual(["name"]);
  });

  it("names several missing required fields at once, in schema order", () => {
    const result = validatePayload(createCharacter, { notes: "a friend" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(["name", "playerName", "class", "level"]);
    }
  });

  it("does NOT report an optional field as missing (that is a rejection, not a question)", () => {
    const result = validatePayload(createNpc, { name: "Sera", role: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.missing).toEqual([]);
    }
  });

  it("ignores a model's own claim about what is missing", () => {
    // The model asserts everything is fine and volunteers a "missing" list; neither is trusted.
    const result = validatePayload(createNpc, {
      role: "guard",
      missing: [],
      complete: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual(["name"]);
  });

  it("derives nothing from an empty issue list", () => {
    expect(missingRequiredFields(createNpc, [])).toEqual([]);
  });
});

describe("field hints come from the descriptors", () => {
  it("describes text, dates, and bounded numbers", () => {
    const byName = (entry: typeof createNpc, name: string) =>
      describeFields(entry).find((f) => f.name === name)!;
    expect(fieldHint(byName(createNpc, "name"))).toBe("name (text)");
    expect(fieldHint(byName(createSession, "date"))).toContain("ISO 8601");
    expect(fieldHint(byName(createCharacter, "level"))).toBe(
      "level (whole number, at least 1)",
    );
  });
});

describe("clarifications carry a question and nothing confirmable", () => {
  it("asks for the missing fields by name", () => {
    const clarification = clarificationFor(createNpc, {
      kind: "missing_fields",
      fields: ["name"],
    });
    expect(clarification.outcome).toBe("clarification");
    expect(clarification.question).toContain("name (text)");
    expect(clarification.needs).toEqual(["name"]);
    expect(clarification).not.toHaveProperty("proposal");
  });

  it("lists several needed fields", () => {
    const clarification = clarificationFor(createCharacter, {
      kind: "missing_fields",
      fields: ["playerName", "level"],
    });
    expect(clarification.question).toContain("playerName");
    expect(clarification.question).toContain("level");
    expect(clarification.needs).toEqual(["playerName", "level"]);
  });

  it("asks for an exact name when the target matched nothing", () => {
    const clarification = clarificationFor(updateNpc, {
      kind: "target_none",
      name: "Sera",
    });
    expect(clarification.question).toContain('"Sera"');
    expect(clarification.question).toContain("exact name");
    expect(clarification).not.toHaveProperty("proposal");
  });

  it("says how many matched when the target is ambiguous, and picks none of them", () => {
    const clarification = clarificationFor(deleteNpc, {
      kind: "target_many",
      name: "Bob",
      candidates: ["Bob", "bob"],
    });
    expect(clarification.question).toContain("2 npcs");
    expect(clarification.question).toContain('"Bob"');
    expect(clarification).not.toHaveProperty("proposal");
  });

  it("carries the unfinished write and what was gathered, so the answer can continue it", () => {
    const clarification = clarificationFor(
      createNpc,
      { kind: "missing_fields", fields: ["name"] },
      { fields: { role: "harbor guard" } },
    );
    expect(clarification.pending).toEqual({
      action: "create",
      entity: "npc",
      needs: ["name"],
      fields: { role: "harbor guard" },
      target: undefined,
    });
  });

  it("carries the intent even when nothing was gathered yet", () => {
    const clarification = clarificationFor(deleteNpc, { kind: "target_unknown" });
    expect(clarification.pending).toMatchObject({ action: "delete", entity: "npc" });
    expect(clarification.needs).toEqual(["target"]);
  });

  it("does NOT carry back a target name that matched nothing or several rows", () => {
    const none = clarificationFor(
      updateNpc,
      { kind: "target_none", name: "Sera" },
      { target: "Sera", fields: { role: "guard" } },
    );
    const many = clarificationFor(
      updateNpc,
      { kind: "target_many", name: "Bob", candidates: ["Bob", "bob"] },
      { target: "Bob" },
    );
    // The answer replaces the name, so re-sending the failed one would just repeat the failure.
    expect(none.pending?.target).toBeUndefined();
    expect(none.pending?.fields).toEqual({ role: "guard" });
    expect(many.pending?.target).toBeUndefined();
  });

  it("drops the conflicting values on a contradiction but keeps the intent", () => {
    const clarification = clarificationFor(
      createNpc,
      { kind: "contradiction" },
      { fields: { name: "Sera" } },
    );
    expect(clarification.pending).toMatchObject({ action: "create", entity: "npc" });
    expect(clarification.pending?.target).toBeUndefined();
  });

  it("asks which value to use for a contradiction, and states nothing changed", () => {
    const clarification = clarificationFor(createNpc, { kind: "contradiction" });
    expect(clarification.question).toContain("conflicting");
    expect(clarification.question).toContain("haven't changed anything");
    expect(clarification).not.toHaveProperty("proposal");
  });
});
