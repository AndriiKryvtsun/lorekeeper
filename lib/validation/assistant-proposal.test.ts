import { describe, expect, it } from "vitest";

import { parseProposal, proposalTitle } from "@/lib/validation/assistant-proposal";

describe("parseProposal", () => {
  it("parses a well-formed create proposal and applies field defaults", () => {
    const p = parseProposal({
      action: "create",
      entity: "npc",
      campaignId: "c1",
      fields: { name: "Sera" },
    });
    expect(p).not.toBeNull();
    expect(p).toMatchObject({
      action: "create",
      entity: "npc",
      campaignId: "c1",
      fields: { name: "Sera", status: "alive" },
    });
  });

  it("strips over-scoped/unknown field keys (cannot smuggle extra columns)", () => {
    const p = parseProposal({
      action: "create",
      entity: "location",
      campaignId: "c1",
      fields: { name: "Docks", campaignId: "other", id: "x", isAdmin: true },
    });
    expect(p?.action).toBe("create");
    if (p?.action === "create") {
      expect(p.fields).toEqual({ name: "Docks" });
    }
  });

  it("rejects a create proposal whose required fields are missing", () => {
    expect(
      parseProposal({ action: "create", entity: "npc", campaignId: "c1", fields: {} }),
    ).toBeNull();
  });

  it("rejects update/delete without a target", () => {
    expect(
      parseProposal({ action: "update", entity: "npc", campaignId: "c1", fields: { role: "x" } }),
    ).toBeNull();
    expect(parseProposal({ action: "delete", entity: "npc", campaignId: "c1" })).toBeNull();
  });

  it("parses update (target + partial fields) and delete (target only)", () => {
    expect(
      parseProposal({
        action: "update",
        entity: "npc",
        campaignId: "c1",
        target: "Sera",
        fields: { role: "captain" },
      }),
    ).toMatchObject({ action: "update", target: "Sera", fields: { role: "captain" } });
    expect(
      parseProposal({ action: "delete", entity: "item", campaignId: "c1", target: "Lantern" }),
    ).toMatchObject({ action: "delete", entity: "item", target: "Lantern" });
  });

  it("rejects an unknown entity or action", () => {
    expect(
      parseProposal({ action: "create", entity: "spaceship", campaignId: "c1", fields: { name: "X" } }),
    ).toBeNull();
    expect(
      parseProposal({ action: "summon", entity: "npc", campaignId: "c1", fields: { name: "X" } }),
    ).toBeNull();
  });

  it("requires a non-empty campaignId", () => {
    expect(
      parseProposal({ action: "create", entity: "npc", campaignId: "", fields: { name: "X" } }),
    ).toBeNull();
  });

  it("proposalTitle reads name for create and target otherwise", () => {
    const create = parseProposal({
      action: "create",
      entity: "session",
      campaignId: "c1",
      fields: { title: "Session 1", date: "2026-01-01T00:00:00.000Z" },
    });
    expect(create && proposalTitle(create)).toBe("Session 1");
    const del = parseProposal({
      action: "delete",
      entity: "npc",
      campaignId: "c1",
      target: "Sera",
    });
    expect(del && proposalTitle(del)).toBe("Sera");
  });
});
