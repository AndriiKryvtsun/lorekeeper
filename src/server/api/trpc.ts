import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// The tRPC request context loads the current Supabase user. `user` is null when the
// request is unauthenticated. Both the HTTP fetch handler and the RSC server caller
// build the context through this function.
export const createTRPCContext = async (opts?: { headers?: Headers }) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, ...opts };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Surface Zod validation issues to clients for BAD_REQUEST errors.
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// Callable without authentication.
export const publicProcedure = t.procedure;

// Rejects unauthenticated calls before the resolver runs, and narrows `ctx.user` to a
// non-null user for the resolver.
const enforceAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(enforceAuthed);
