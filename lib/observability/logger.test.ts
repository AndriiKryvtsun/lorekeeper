import { afterEach, describe, expect, it, vi } from "vitest";

import { audit, log } from "@/lib/observability/logger";

afterEach(() => vi.restoreAllMocks());

describe("audit", () => {
  it("emits a structured audit record with only the fields passed", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    audit("account.deleted", { userId: "u1", outcome: "success" });
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload).toMatchObject({
      kind: "audit",
      event: "account.deleted",
      userId: "u1",
      outcome: "success",
    });
    // No body/secret keys leak in.
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("token");
  });
});

describe("log", () => {
  it("includes the level and event with allow-listed fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    log("warn", "rate.limited", { ip: "redacted", count: 3 });
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload).toMatchObject({ kind: "rate.limited", level: "warn", count: 3 });
  });
});
