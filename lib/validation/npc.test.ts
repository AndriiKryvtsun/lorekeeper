import { describe, expect, it } from "vitest";

import { createNpcSchema } from "./npc";

describe("createNpcSchema", () => {
  it("accepts a valid body and strips unknown fields (including campaignId)", () => {
    const parsed = createNpcSchema.parse({
      name: "Mara",
      role: "Innkeeper",
      description: "Knows every rumor.",
      status: "alive",
      campaignId: "attacker-supplied",
    });

    expect(parsed).toEqual({
      name: "Mara",
      role: "Innkeeper",
      description: "Knows every rumor.",
      status: "alive",
    });
    expect(parsed).not.toHaveProperty("campaignId");
  });

  it("defaults status to 'alive' when omitted", () => {
    const parsed = createNpcSchema.parse({ name: "Mara" });
    expect(parsed.status).toBe("alive");
  });

  it("rejects a missing name", () => {
    expect(createNpcSchema.safeParse({ role: "Innkeeper" }).success).toBe(false);
  });

  it("rejects an empty/whitespace name", () => {
    expect(createNpcSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});
