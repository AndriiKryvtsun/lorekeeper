import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";
import { env } from "~/env";

// Prisma 7 connects through a driver adapter. At runtime we use the pooled
// `DATABASE_URL` (the direct `DIRECT_URL` is reserved for migrations via
// prisma.config.ts). A `globalThis` cache prevents a new client (and pool) on every
// Next.js dev hot-reload.
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
