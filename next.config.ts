import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // useChat posts to its default endpoint (/api/chat); rewrite it to the assistant route.
  // This keeps the AI SDK's client transport internal to the SDK (no `ai` import in our
  // client code) while the handler lives at /api/assistant per spec.
  async rewrites() {
    return [{ source: "/api/chat", destination: "/api/assistant" }];
  },
};

export default nextConfig;
