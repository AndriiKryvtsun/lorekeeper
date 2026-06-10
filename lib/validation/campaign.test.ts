import { describe, expect, it } from "vitest";

import { createCampaignSchema, updateCampaignSchema } from "./campaign";

describe("createCampaignSchema", () => {
  it("accepts a valid body and strips unknown fields", () => {
    const parsed = createCampaignSchema.parse({
      title: "Emberfall",
      system: "D&D 5e",
      description: "A grim frontier town.",
      id: "attacker-supplied",
      createdAt: "2000-01-01",
    });

    expect(parsed).toEqual({
      title: "Emberfall",
      system: "D&D 5e",
      description: "A grim frontier town.",
    });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("createdAt");
  });

  it("allows omitting the optional description", () => {
    const parsed = createCampaignSchema.parse({ title: "T", system: "S" });
    expect(parsed.description).toBeUndefined();
  });

  it("rejects a missing title", () => {
    expect(createCampaignSchema.safeParse({ system: "S" }).success).toBe(false);
  });

  it("rejects an empty/whitespace title", () => {
    expect(
      createCampaignSchema.safeParse({ title: "   ", system: "S" }).success,
    ).toBe(false);
  });
});

describe("updateCampaignSchema", () => {
  it("accepts a partial body", () => {
    const parsed = updateCampaignSchema.parse({ title: "New title" });
    expect(parsed).toEqual({ title: "New title" });
  });

  it("rejects an empty object (no fields to update)", () => {
    expect(updateCampaignSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an invalid field value", () => {
    expect(updateCampaignSchema.safeParse({ title: "" }).success).toBe(false);
  });
});
