import { campaignRouter } from "~/server/api/routers/campaign";
import { npcRouter } from "~/server/api/routers/npc";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

// The merged application router. Add new domain routers here.
export const appRouter = createTRPCRouter({
  campaign: campaignRouter,
  npc: npcRouter,
});

// Exported type used by the clients for end-to-end type safety.
export type AppRouter = typeof appRouter;

// Factory for building a server-side caller (used by the RSC caller).
export const createCaller = createCallerFactory(appRouter);
