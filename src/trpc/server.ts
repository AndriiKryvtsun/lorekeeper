import "server-only";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

// RSC server caller: Server Components invoke procedures directly (no HTTP round trip),
// building a fresh context (which loads the current user) per call.
export const api = createCaller(createTRPCContext);
