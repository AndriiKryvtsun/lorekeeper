import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/security/origin";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

// App Router tRPC handler. Serves the whole app router over HTTP at /api/trpc/*.
const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: request.headers }),
  });

// Queries (GET) are safe; mutations (POST) are state-changing — reject cross-origin POSTs
// (defense-in-depth alongside auth + Server Actions' built-in CSRF).
export function GET(request: Request) {
  return handler(request);
}

export function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return handler(request);
}
