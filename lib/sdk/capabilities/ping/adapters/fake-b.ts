import type { PingPort } from "@/lib/sdk/capabilities/ping/port";

// Fake adapter "b". Isomorphic, no network, no secrets — a reference implementation.
export const fakeBAdapter: PingPort = {
  async ping(message) {
    return { provider: "b", echo: `b:${message}` };
  },
};
