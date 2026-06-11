import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Default `vitest run` executes unit tests that mock the Prisma client, so no database
// is required (there is no CI Postgres). DB-integration tests guard themselves on
// `process.env.DIRECT_URL` and skip when it is unset — see tests using `describe.skipIf`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws when imported outside a React Server Component. In tests we
      // alias it to its no-op build so server modules can be unit-tested directly.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    // Enables global test APIs and, importantly, React Testing Library's automatic
    // DOM cleanup between tests (registered via the global afterEach).
    globals: true,
    // Skip the module-level `~/env` validation when importing app modules in tests
    // (Vitest does not load .env). The env-validation test exercises createEnv directly.
    env: { SKIP_ENV_VALIDATION: "1" },
    // Node by default; component tests opt into jsdom with `// @vitest-environment jsdom`.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "app/generated"],
  },
});
