import { describe, expect, it } from "vitest";

import { ping } from "@/lib/sdk/server/ping";

// End-to-end through the server wiring: the registry selects the env-configured provider
// (default "a") and returns its result — exercising selection with no real network.
describe("ping capability (server)", () => {
  it("resolves the default provider and echoes the message", async () => {
    const result = await ping("hi");
    expect(result).toEqual({ provider: "a", echo: "a:hi" });
  });
});
