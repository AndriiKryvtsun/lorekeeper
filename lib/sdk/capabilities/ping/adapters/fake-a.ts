import type { PingPort } from "@/lib/sdk/capabilities/ping/port";

// Fake adapter "a". Isomorphic, no network, no secrets — a reference implementation.
export const fakeAAdapter: PingPort = {
  async ping(message) {
    return { provider: "a", echo: `a:${message}` };
  },
};
