import { assistantRouter } from "~/server/api/routers/assistant";
import { campaignRouter } from "~/server/api/routers/campaign";
import { characterRouter } from "~/server/api/routers/character";
import { itemRouter } from "~/server/api/routers/item";
import { locationRouter } from "~/server/api/routers/location";
import { npcRouter } from "~/server/api/routers/npc";
import { sessionRouter } from "~/server/api/routers/session";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

// The merged application router. Add new domain routers here.
export const appRouter = createTRPCRouter({
  campaign: campaignRouter,
  npc: npcRouter,
  session: sessionRouter,
  location: locationRouter,
  item: itemRouter,
  character: characterRouter,
  assistant: assistantRouter,
});

// Exported type used by the clients for end-to-end type safety.
export type AppRouter = typeof appRouter;

// Factory for building a server-side caller (used by the RSC caller).
export const createCaller = createCallerFactory(appRouter);
