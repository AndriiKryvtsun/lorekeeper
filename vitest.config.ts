import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Default `vitest run` executes unit tests that mock the Prisma client, so no database
// is required (there is no CI Postgres). DB-integration tests guard themselves on
// `process.env.DIRECT_URL` and skip when it is unset — see tests using `describe.skipIf`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` throws when imported outside a React Server Component. In tests we
      // alias it to its no-op build so server modules can be unit-tested directly.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next", "app/generated"],
  },
});
