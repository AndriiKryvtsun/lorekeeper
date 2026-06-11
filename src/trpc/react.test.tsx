import { describe, expect, it } from "vitest";

import { api } from "~/trpc/react";

// The React client exposes typed hooks for Client Components (e.g.
// api.campaign.list.useQuery()). A full render needs a DOM + provider; here we assert the
// hook surface exists so Client Components can invoke procedures via hooks.
describe("React Query client exposes procedure hooks", () => {
  it("provides query hooks for campaign procedures", () => {
    expect(typeof api.campaign.list.useQuery).toBe("function");
    expect(typeof api.campaign.byId.useQuery).toBe("function");
  });

  it("provides mutation hooks for campaign and npc procedures", () => {
    expect(typeof api.campaign.create.useMutation).toBe("function");
    expect(typeof api.npc.create.useMutation).toBe("function");
  });

  it("exposes a client factory and provider", () => {
    expect(typeof api.createClient).toBe("function");
  });
});
